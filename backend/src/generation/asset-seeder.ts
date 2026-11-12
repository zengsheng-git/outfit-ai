import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import { readJson, writeJson } from '../common/file-db'
import type { ClothingItem } from '../common/types'
import { renderItemSvg } from './garment-art'

/**
 * 单品图资源播种器
 *
 * 仓库不保存上传目录（见 backend/.gitignore），所以全新克隆下来时 data/items.json
 * 里的 imageUrl 会指向不存在的文件，单品库将全部显示裂图。
 * 这里在后端启动时检查每个单品的图片是否真实存在，缺失的按分类与颜色生成一张
 * 矢量插画并写回 items.json，保证任何环境启动后都有可用的单品图。
 */
@Injectable()
export class AssetSeeder implements OnModuleInit {
  private readonly logger = new Logger(AssetSeeder.name)
  private readonly uploadsDir = join(__dirname, '..', '..', 'public', 'uploads')

  async onModuleInit(): Promise<void> {
    try {
      const count = await this.seedMissingAssets()
      if (count > 0) {
        this.logger.log(`已为 ${count} 件单品生成占位插画`)
      }
    } catch (error) {
      this.logger.warn(`单品图播种失败：${(error as Error).message}`)
    }
  }

  async seedMissingAssets(): Promise<number> {
    if (!existsSync(this.uploadsDir)) {
      mkdirSync(this.uploadsDir, { recursive: true })
    }

    const items = readJson<ClothingItem[]>('items.json')
    let changed = 0

    for (const item of items) {
      if (this.hasUsableImage(item.imageUrl)) continue

      const filename = `seed-${item.id}.png`
      const filepath = join(this.uploadsDir, filename)
      const svg = renderItemSvg(item)

      await sharp(Buffer.from(svg)).resize(600, 600).png().toFile(filepath)

      item.imageUrl = `/uploads/${filename}`
      changed++
    }

    if (changed > 0) {
      writeJson('items.json', items)
    }

    return changed
  }

  /** 判断 imageUrl 指向的图片是否真实存在；外链图片不做本地校验 */
  private hasUsableImage(imageUrl?: string): boolean {
    if (!imageUrl) return false
    if (imageUrl.startsWith('http')) return true
    if (!imageUrl.startsWith('/uploads/')) return true
    return existsSync(join(this.uploadsDir, imageUrl.replace('/uploads/', '')))
  }
}
