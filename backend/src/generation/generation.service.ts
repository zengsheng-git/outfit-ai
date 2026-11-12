import { Injectable } from '@nestjs/common'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, extname, basename } from 'path'
import { BailianProvider } from './bailian.provider'
import { MiniMaxProvider } from './minimax.provider'
import { LocalRenderProvider } from './local-render.provider'
import { buildCompareBoard } from './reference-board'
import { readJson, writeJson } from '../common/file-db'
import type { GenerationTask, ClothingItem } from '../common/types'

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
}

interface RenderOutcome {
  imageUrl: string
  isFallback: boolean
  reason?: string
}

@Injectable()
export class GenerationService {
  private readonly uploadsDir = join(__dirname, '..', '..', 'public', 'uploads')
  private readonly generatedDir = join(__dirname, '..', '..', 'public', 'generated')

  constructor(
    private readonly bailianProvider: BailianProvider,
    private readonly miniMaxProvider: MiniMaxProvider,
    private readonly localRenderProvider: LocalRenderProvider,
  ) {}

  async generateOutfit(data: {
    items: Record<string, unknown>
    prompt?: string
    mode?: 'ai' | 'lookbook'
  }) {
    const clothingItems = this.extractClothingItems(data.items)
    const prompt = data.prompt || this.buildPrompt(clothingItems)

    try {
      // 实拍平铺模式：不调用 AI，直接用单品真实图片排版，所见即所得
      const result =
        data.mode === 'lookbook'
          ? await this.renderLookbook(clothingItems)
          : await this.render(clothingItems, prompt)

      // 记录任务
      const tasks = readJson<GenerationTask[]>('generation-tasks.json')
      const task: GenerationTask = {
        id: `task_${String(tasks.length + 1).padStart(3, '0')}`,
        prompt,
        imageUrl: result.imageUrl,
        isFallback: result.isFallback,
        createdAt: new Date().toISOString(),
      }
      tasks.push(task)
      writeJson('generation-tasks.json', tasks)

      return {
        code: 0,
        message: result.isFallback ? result.reason || '已使用本地示意图' : '生成成功',
        data: {
          taskId: task.id,
          status: 'success',
          imageUrl: result.imageUrl,
          prompt,
          isFallback: result.isFallback,
          reason: result.reason,
        },
      }
    } catch (error: any) {
      console.error('[GenerationService] Error:', error)
      return {
        code: 500,
        message: `生成失败: ${error.message || '请稍后重试'}`,
        data: null,
      }
    }
  }

  /**
   * 实拍平铺：直接用各单品的真实图片排版成搭配板。
   * 不经过 AI，画面里就是用户上传的那张图，不会有任何生成偏差。
   */
  private async renderLookbook(clothingItems: ClothingItem[]): Promise<RenderOutcome> {
    const local = await this.localRenderProvider.renderLookbook(clothingItems)
    return { ...local, isFallback: false }
  }

  /**
   * 出图优先级：百炼 → MiniMax H3 → 本地人台合成。
   *
   * MiniMax 换用 H3-Image 系列（/v1/images/edits，最多 16 张参考图）后
   * 重新进入降级链路：每件单品单独作为参考图，实测单人、纯色背景、
   * 颜色还原都能达标。旧模型 image-01-live 的 subject_reference 只支持
   * character 类型，会把服装板画成一排人，已弃用。
   * 全部失败时本地人台合成兜底：单人、纯色背景、服装矢量与选中单品完全一致。
   */
  private async render(clothingItems: ClothingItem[], prompt: string): Promise<RenderOutcome> {
    const failures: string[] = []

    // 每件单品一张参考图（data URI），百炼和 MiniMax H3 共用
    const referenceImages = clothingItems
      .filter(item => item.imageUrl && !item.imageUrl.includes('placeholder'))
      .map(item => this.imageToBase64(item.imageUrl))
      .filter((img): img is string => img !== null)

    if (this.bailianProvider.isEnabled()) {
      try {
        console.log(`[GenerationService] 百炼出图，参考图 ${referenceImages.length} 张`)

        const result = await this.bailianProvider.generate({
          prompt,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        })

        const modelImage = await this.persistRemoteImage(result.imageUrl)
        return {
          imageUrl: await this.composeCompareImage(clothingItems, modelImage, modelImage),
          isFallback: false,
        }
      } catch (error) {
        console.error('[GenerationService] 百炼出图失败：', error)
        failures.push('百炼出图失败')
      }
    } else {
      failures.push('未配置百炼 API Key')
    }

    if (this.miniMaxProvider.isEnabled()) {
      try {
        console.log(
          `[GenerationService] MiniMax H3 出图（${this.miniMaxProvider.getModel()}），参考图 ${referenceImages.length} 张`,
        )

        const result = await this.miniMaxProvider.generate({
          prompt,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        })

        const modelImage = await this.persistRemoteImage(result.imageUrl)
        return {
          imageUrl: await this.composeCompareImage(clothingItems, modelImage, modelImage),
          isFallback: false,
        }
      } catch (error) {
        console.error('[GenerationService] MiniMax H3 出图失败：', error)
        failures.push('MiniMax 出图失败')
      }
    } else {
      failures.push('未配置 MiniMax API Key')
    }

    const mannequin = await this.localRenderProvider.renderMannequin(clothingItems)
    const imageUrl = await this.composeCompareImage(
      clothingItems,
      mannequin.imagePath,
      mannequin.imageUrl,
      { trimModel: true },
    )
    return {
      imageUrl,
      isFallback: true,
      reason: `${failures.join('，')}，已使用本地示意图合成（服装与选中单品完全一致）`,
    }
  }

  /**
   * 把模特图（AI 生成的或本地人台合成的）和选中的单品原图合成一张「上身对比板」：
   * 左侧竖排单品原图（像素级一致），右侧是模特，整体纯色背景。
   * 合成失败或单品没有本地图片时，退回裸模特图，不影响出图主链路。
   */
  private async composeCompareImage(
    clothingItems: ClothingItem[],
    model: string | Buffer,
    fallbackUrl: string,
    options?: { trimModel?: boolean },
  ): Promise<string> {
    try {
      // 字符串是 /generated/xxx 形式的 URL，sharp 需要绝对路径，先转换
      let modelSource: string | Buffer = model
      if (typeof model === 'string' && model.startsWith('/generated/')) {
        const candidate = join(this.generatedDir, basename(model))
        if (existsSync(candidate)) modelSource = candidate
      }

      const board = await buildCompareBoard(clothingItems, modelSource, this.uploadsDir, options)
      if (board) return this.writeGeneratedPng(board, 'compare')
    } catch (error) {
      console.warn('[GenerationService] 对比板合成失败，直接返回模特图：', error)
    }

    if (Buffer.isBuffer(model)) {
      try {
        return this.writeGeneratedPng(model, 'model')
      } catch {
        // 落盘失败就走 fallbackUrl
      }
    }
    return fallbackUrl
  }

  /** 把 PNG 落盘到 public/generated 并返回可访问 URL */
  private writeGeneratedPng(png: Buffer, prefix: string): string {
    if (!existsSync(this.generatedDir)) {
      mkdirSync(this.generatedDir, { recursive: true })
    }
    const filename = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}.png`
    writeFileSync(join(this.generatedDir, filename), png)
    return `/generated/${filename}`
  }

  /**
   * 当前可用的出图渠道。
   * 密钥只在启动时读取一次，所以改完 .env 必须重启后端才会生效。
   */
  async getStatus() {
    const bailian = this.bailianProvider.isEnabled()
    const minimax = this.miniMaxProvider.isEnabled()
    // 查询 MiniMax 配额余量，查询失败不影响渠道状态展示
    const quota = minimax ? await this.miniMaxProvider.getQuota() : undefined

    return {
      code: 0,
      message: 'ok',
      data: {
        active: bailian ? 'bailian' : minimax ? 'minimax' : 'local',
        providers: [
          { key: 'bailian', name: '阿里云百炼', enabled: bailian },
          {
            key: 'minimax',
            name: 'MiniMax',
            enabled: minimax,
            model: minimax ? this.miniMaxProvider.getModel() : undefined,
            keyHint: minimax ? this.miniMaxProvider.getKeyFingerprint() : undefined,
            quota,
          },
          { key: 'local', name: '本地示意图', enabled: true },
        ],
      },
    }
  }

  /**
   * 把远端生成的图片下载到本地。
   * 百炼返回的是带过期时间的 OSS 链接，落盘后结果才不会随时间失效，
   * 「保存套装」下载按钮也能正常工作。
   */
  private async persistRemoteImage(remoteUrl: string): Promise<string> {
    if (!remoteUrl.startsWith('http')) return remoteUrl

    try {
      const response = await fetch(remoteUrl)
      if (!response.ok) return remoteUrl

      const contentType = response.headers.get('content-type') || ''
      const ext = contentType.includes('jpeg') ? '.jpg' : contentType.includes('webp') ? '.webp' : '.png'
      const filename = `ai-${Date.now()}-${Math.floor(Math.random() * 1e6)}${ext}`

      if (!existsSync(this.generatedDir)) {
        mkdirSync(this.generatedDir, { recursive: true })
      }
      writeFileSync(join(this.generatedDir, filename), Buffer.from(await response.arrayBuffer()))

      return `/generated/${filename}`
    } catch (error) {
      console.error('[GenerationService] 生成图下载失败，改为直接使用远端链接：', error)
      return remoteUrl
    }
  }

  private extractClothingItems(items: Record<string, unknown>): ClothingItem[] {
    const result: ClothingItem[] = []
    for (const value of Object.values(items)) {
      if (!value) continue
      if (Array.isArray(value)) {
        result.push(...(value as ClothingItem[]))
      } else {
        result.push(value as ClothingItem)
      }
    }
    return result
  }

  private imageToBase64(imagePath: string): string | null {
    try {
      // 处理相对路径
      let filePath = imagePath
      if (imagePath.startsWith('/uploads/')) {
        filePath = join(this.uploadsDir, imagePath.replace('/uploads/', ''))
      }
      
      if (!existsSync(filePath)) {
        console.warn('[GenerationService] Image file not found:', filePath)
        return null
      }

      const ext = extname(filePath).toLowerCase()
      const mimeType = MIME_MAP[ext]
      if (!mimeType) {
        console.warn('[GenerationService] Unsupported image format:', ext)
        return null
      }

      const buffer = readFileSync(filePath)
      const base64 = buffer.toString('base64')
      return `data:${mimeType};base64,${base64}`
    } catch (error) {
      console.error('[GenerationService] Failed to convert image to base64:', error)
      return null
    }
  }

  private buildPrompt(items: ClothingItem[]): string {
    if (items.length === 0) {
      return '请生成一张穿搭效果图'
    }

    const itemDescriptions = items.map(item => {
      const parts = [item.color, item.name]
      if (item.note) parts.push(item.note)
      return parts.join('')
    })

    return [
      '请生成一张精美二次元动漫风格的时尚穿搭插画，韩系插画质感，人物五官精致漂亮，发型自然。',
      '模特身材高挑修长，九头身比例，脖子肩膀线条舒展，双腿细长笔直，身材纤细。',
      '模特正面站立，全身构图，从头到脚完整入画，画面中只有一位模特。',
      '背景为单一纯色浅灰色，干净无杂物、无道具、无文字。',
      '模特身上的服装必须与描述的单品完全一致，不要添加描述之外的服饰或配饰。',
      `模特穿着：${itemDescriptions.join('、')}。`,
      '整体是高级感的时尚搭配插画，适合服装搭配预览。'
    ].join('')
  }
}
