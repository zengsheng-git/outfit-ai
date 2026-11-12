import { Injectable } from '@nestjs/common'
import 'dotenv/config'

interface GenerateImageInput {
  prompt: string
  /** 参考图（data URI 或公网 URL），每件单品一张，最多 16 张 */
  referenceImages?: string[]
}

interface GenerateImageOutput {
  imageUrl: string
}

/** token plan 配额余量（周窗口 + 5h 窗口） */
export interface MiniMaxQuota {
  /** 周窗口剩余百分比 */
  weeklyPercent?: number
  /** 周窗口重置时间（ISO） */
  weeklyResetAt?: string
  /** 5h 窗口剩余百分比 */
  intervalPercent?: number
  /** 套餐是否分配了 5h 窗口额度 */
  intervalHasQuota: boolean
  /** 数据查询时间（ISO） */
  fetchedAt: string
}

/**
 * MiniMax 图像生成（H3-Image 系列）
 *
 * 走新的 /v1/images/edits 端点，支持 1-16 张参考图，
 * 每件单品单独作为一张参考图传入（不再拼平铺板）。
 *
 * 旧模型 image-01-live 的 /v1/image_generation + subject_reference 已弃用：
 * subject_reference 只支持 character 类型，传服装板会把单品画成多个人。
 *
 * 注意：编辑端点始终做提示词增强（响应中的 revised_prompt），无法关闭；
 * 端点为同步调用，最长可等 600 秒。
 *
 * 密钥只从环境变量读取（backend/.env），不读取其它应用的配置文件。
 */
@Injectable()
export class MiniMaxProvider {
  private readonly apiKey = process.env.MINIMAX_API_KEY || ''
  private readonly baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com'
  private readonly model = process.env.MINIMAX_IMAGE_MODEL || 'MiniMax-H3-Image'
  // 竖版画幅：H3-Image 的 aspect_ratio 在省略 size 时生效
  private readonly aspectRatio = process.env.MINIMAX_ASPECT_RATIO || '2:3'
  private readonly useMock = process.env.AI_IMAGE_USE_MOCK === 'true'

  isEnabled(): boolean {
    return !this.useMock && !!this.apiKey
  }

  getModel(): string {
    return this.model
  }

  /** 密钥指纹，方便确认当前用的是哪一把（不暴露完整密钥） */
  getKeyFingerprint(): string {
    if (!this.apiKey) return ''
    return `${this.apiKey.slice(0, 8)}…${this.apiKey.slice(-4)}`
  }

  /**
   * 查询配额余量（token plan，图片生成归在 general 桶），返回结构化数据。
   * 注意：状态 2 表示该窗口在套餐中未分配额度（而非"用完"）；
   * 实测图像生成不消耗此配额，按量计费走账户余额。
   * 纯展示用途：任何失败都静默返回 undefined，不影响出图主链路。
   */
  async getQuota(): Promise<MiniMaxQuota | undefined> {
    if (!this.apiKey) return undefined
    try {
      const response = await fetch(`${this.baseUrl}/v1/token_plan/remains`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(8000),
      })
      const data = await response.json()
      if (data?.base_resp?.status_code !== 0) return undefined

      const remains: Array<{
        model_name?: string
        current_interval_total_count?: number
        current_interval_status?: number
        current_interval_remaining_percent?: number
        current_weekly_remaining_percent?: number
        weekly_end_time?: number
      }> = data?.model_remains ?? []

      const general = remains.find(r => r.model_name === 'general') ?? remains[0]
      if (!general) return undefined

      return {
        weeklyPercent:
          typeof general.current_weekly_remaining_percent === 'number'
            ? general.current_weekly_remaining_percent
            : undefined,
        weeklyResetAt: general.weekly_end_time
          ? new Date(general.weekly_end_time).toISOString()
          : undefined,
        intervalPercent:
          typeof general.current_interval_remaining_percent === 'number'
            ? general.current_interval_remaining_percent
            : undefined,
        intervalHasQuota:
          (general.current_interval_total_count ?? 0) > 0 || general.current_interval_status === 1,
        fetchedAt: new Date().toISOString(),
      }
    } catch {
      return undefined
    }
  }

  async generate(input: GenerateImageInput): Promise<GenerateImageOutput> {
    if (!this.isEnabled()) {
      throw new Error('未配置 MINIMAX_API_KEY，无法调用 MiniMax 出图')
    }

    const body: Record<string, unknown> = {
      model: this.model,
      prompt: input.prompt,
      n: 1,
      aspect_ratio: this.aspectRatio,
      response_format: 'url',
      output_format: 'jpeg',
    }

    if (input.referenceImages && input.referenceImages.length > 0) {
      body.images = input.referenceImages.slice(0, 16).map(image_url => ({ image_url }))
    }

    const response = await fetch(`${this.baseUrl}/v1/images/edits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()

    // 只要有一张成功 HTTP 就是 200，失败项藏在 data[].error 里，必须逐项检查
    const first = result?.data?.[0]
    if (first?.error) {
      const message = first.error.message ?? first.error.code ?? JSON.stringify(first.error)
      throw new Error(`MiniMax H3 出图失败: ${message}`)
    }

    const imageUrl = first?.url
    if (!imageUrl) {
      const detail = result?.message ? `: ${result.message}` : ''
      throw new Error(`MiniMax H3 未返回图片地址${detail}`)
    }

    return { imageUrl }
  }
}
