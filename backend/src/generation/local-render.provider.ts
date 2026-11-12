import { Injectable } from '@nestjs/common'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import type { ClothingItem } from '../common/types'
import { buildOutfitSvg } from './outfit-composition'
import { buildLookbookBoard, isGeneratedArt } from './reference-board'

/**
 * 离线穿搭渲染器
 *
 * 未配置百炼 / MiniMax 时，用它产出一张随选择变化的示意图，保证 Demo 链路完整可用。
 *
 * 两种呈现方式：
 * - 选中的单品里有用户上传的实拍图 → 直接用真实照片排版成搭配板（所见即所得）
 * - 全是自动生成的矢量插画 → 合成到人台上，做出「穿在身上的效果」
 */
@Injectable()
export class LocalRenderProvider {
  private readonly uploadsDir = join(__dirname, '..', '..', 'public', 'uploads')
  private readonly generatedDir = join(__dirname, '..', '..', 'public', 'generated')

  constructor() {
    if (!existsSync(this.generatedDir)) {
      mkdirSync(this.generatedDir, { recursive: true })
    }
  }

  async render(items: ClothingItem[]): Promise<{ imageUrl: string; isFallback: boolean }> {
    const hasRealPhoto = items.some(item => !isGeneratedArt(item.imageUrl))
    const png = hasRealPhoto
      ? await this.lookbookBuffer(items)
      : await this.mannequinBuffer(items)

    return this.writeOut(png, true)
  }

  /** 实拍平铺：无论有没有实拍图都走这条路 */
  async renderLookbook(items: ClothingItem[]): Promise<{ imageUrl: string; isFallback: boolean }> {
    const png = await this.lookbookBuffer(items)
    return this.writeOut(png, false)
  }

  /**
   * 人台合成（「AI 模特图」在无百炼时的主力出图方式）：
   * 服装矢量直接由单品数据驱动，颜色款式与选中单品完全一致。
   * 返回落盘文件路径与可访问 URL，供对比板继续合成。
   */
  async renderMannequin(items: ClothingItem[]): Promise<{ imagePath: string; imageUrl: string }> {
    const png = await this.mannequinBuffer(items)
    const filename = `outfit-${Date.now()}.png`
    writeFileSync(join(this.generatedDir, filename), png)
    return { imagePath: join(this.generatedDir, filename), imageUrl: `/generated/${filename}` }
  }

  private async writeOut(
    png: Buffer,
    isFallback: boolean,
  ): Promise<{ imageUrl: string; isFallback: boolean }> {
    const filename = `outfit-${Date.now()}.png`
    const filepath = join(this.generatedDir, filename)
    writeFileSync(filepath, png)

    return { imageUrl: `/generated/${filename}`, isFallback }
  }

  /** 用真实照片排版 */
  private async lookbookBuffer(items: ClothingItem[]): Promise<Buffer> {
    const board = await buildLookbookBoard(items, this.uploadsDir)
    if (!board) {
      return this.mannequinBuffer(items)
    }
    return sharp(Buffer.from(board.split(',')[1], 'base64')).png().toBuffer()
  }

  /** 合成到人台上 */
  private async mannequinBuffer(items: ClothingItem[]): Promise<Buffer> {
    const svg = buildOutfitSvg(items)
    return sharp(Buffer.from(svg)).png().toBuffer()
  }
}
