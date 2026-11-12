import { post, get } from './request'
import type { OutfitSelection } from '@/types/outfit'

interface GenerateResult {
  taskId: string
  status: string
  imageUrl: string
  prompt: string
  isFallback: boolean
  reason?: string
}

export function generateOutfitImage(data: {
  items: OutfitSelection
  prompt?: string
  /** ai = AI 模特图，lookbook = 实拍平铺（直接用原图排版） */
  mode?: 'ai' | 'lookbook'
}) {
  return post<GenerateResult>('/api/generation/outfit', data)
}

/** MiniMax token plan 配额余量 */
export interface GenerationQuota {
  weeklyPercent?: number
  /** 周窗口重置时间（ISO） */
  weeklyResetAt?: string
  intervalPercent?: number
  /** 套餐是否分配了 5h 窗口额度 */
  intervalHasQuota?: boolean
  /** 数据查询时间（ISO） */
  fetchedAt?: string
}

export interface GenerationProvider {
  key: string
  name: string
  enabled: boolean
  model?: string
  keyHint?: string
  quota?: GenerationQuota
}

export interface GenerationStatus {
  active: string
  providers: GenerationProvider[]
}

/** 查询当前可用的出图渠道 */
export function getGenerationStatus() {
  return get<GenerationStatus>('/api/generation/status')
}
