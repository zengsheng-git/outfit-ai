import { existsSync } from 'fs'
import { join, extname } from 'path'
import sharp from 'sharp'
import type { ClothingItem } from '../common/types'
import { renderItemSvg } from './garment-art'

const CANVAS = 1024
const MARGIN = 40
const SUPPORTED_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif']

/**
 * 把选中的单品平铺成一张参考图
 *
 * MiniMax 的 subject_reference 只接受一张图片，而穿搭往往有 5~6 件单品，
 * 所以这里先把它们拼成一张「平铺板」再作为唯一参考图发出去，
 * 模型就能据此还原整套搭配的配色与款式。
 *
 * 所有单品必须排成**一行**：排成多行时模型会把参考图理解成多联画，
 * 输出左右并排的两个人，而不是一个穿着整套衣服的模特。
 */
export async function buildReferenceBoard(
  items: ClothingItem[],
  uploadsDir: string,
): Promise<string | null> {
  const sources = items
    .map(item => resolveLocalFile(item.imageUrl, uploadsDir))
    .filter((path): path is string => path !== null)

  if (sources.length === 0) return null

  const cell = Math.floor((CANVAS - MARGIN * 2) / sources.length)
  const tile = cell - 16
  const top = Math.floor((CANVAS - tile) / 2)

  const overlays: sharp.OverlayOptions[] = []

  for (let i = 0; i < sources.length; i++) {
    const buffer = await sharp(sources[i])
      .resize(tile, tile, { fit: 'contain', background: '#ffffff' })
      .png()
      .toBuffer()

    overlays.push({ input: buffer, left: MARGIN + i * cell + 8, top })
  }

  const board = await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite(overlays)
    .png()
    .toBuffer()

  return `data:image/png;base64,${board.toString('base64')}`
}

/** 只处理本地上传目录里的图片；远程 URL 无法读取，不作为参考图 */
function resolveLocalFile(
  imageUrl: string | undefined,
  uploadsDir: string,
): string | null {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return null

  const filename = imageUrl.replace('/uploads/', '')
  if (!SUPPORTED_EXT.includes(extname(filename).toLowerCase())) return null

  const filepath = join(uploadsDir, filename)
  return existsSync(filepath) ? filepath : null
}

/**
 * 判断某件单品用的是不是自动生成的矢量插画（而非用户上传的实拍图）。
 * 矢量插画由 AssetSeeder 以 seed-<id>.png 命名。
 */
export function isGeneratedArt(imageUrl: string | undefined): boolean {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return true
  return imageUrl.replace('/uploads/', '').startsWith('seed-')
}

/**
 * 生成「实拍平铺板」：直接用各单品的真实图片排版成一张搭配图。
 *
 * 离线兜底出图时，如果选中的单品里有用户上传的实拍图，
 * 用矢量人台示意图会完全丢掉这些实物信息；
 * 这时改用真实照片排版，所见即所得。
 */
export async function buildLookbookBoard(
  items: ClothingItem[],
  uploadsDir: string,
): Promise<string | null> {
  const sources = items
    .map(item => resolveLocalFile(item.imageUrl, uploadsDir))
    .filter((path): path is string => path !== null)

  if (sources.length === 0) return null

  const cols = Math.ceil(Math.sqrt(sources.length))
  const rows = Math.ceil(sources.length / cols)
  const cell = Math.floor(Math.min(CANVAS / cols, CANVAS / rows))
  const tile = cell - 12
  const gridWidth = cols * cell
  const gridHeight = rows * cell
  const offsetX = Math.floor((CANVAS - gridWidth) / 2)
  const offsetY = Math.floor((CANVAS - gridHeight) / 2)

  const overlays: sharp.OverlayOptions[] = []

  for (let i = 0; i < sources.length; i++) {
    const buffer = await sharp(sources[i])
      .resize(tile, tile, { fit: 'contain', background: '#ffffff' })
      .png()
      .toBuffer()

    overlays.push({
      input: buffer,
      left: offsetX + (i % cols) * cell + 6,
      top: offsetY + Math.floor(i / cols) * cell + 6,
    })
  }

  const board = await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite(overlays)
    .png()
    .toBuffer()

  return `data:image/png;base64,${board.toString('base64')}`
}

/* ------------------------------------------------------------------ */
/* 对比预演板：左侧单品原图（像素级一致）+ 右侧 AI 模特，纯色背景      */
/* ------------------------------------------------------------------ */

const COMPARE_WIDTH = 1024
const COMPARE_HEIGHT = 1280
// 纯色背景（浅灰），与提示词里要求 AI 出图的背景色保持一致，拼接后过渡更自然
const COMPARE_BACKGROUND = { r: 201, g: 201, b: 201, alpha: 1 }
const COMPARE_MARGIN = 24
const COMPARE_GAP = 48
const LEFT_ZONE_WIDTH = 424

/** 白底阈值：RGB 全部不低于该值的像素视为背景白，抠为透明 */
const WHITE_THRESHOLD = 245

/** 四角取样块边长：用图片四角判断是不是纯白底商品图 */
const CORNER_PATCH = 24

/**
 * 把白底商品图的白底抠成透明，让单品能无缝贴在纯色画布上。
 * 商品图大多是纯白背景，按阈值处理效果稳定；
 * 极少数整件衣服接近纯白的图可能被误伤，失败时由调用方回退为原图。
 */
async function cutoutWhiteBackground(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  for (let i = 0; i < data.length; i += info.channels) {
    if (
      data[i] >= WHITE_THRESHOLD &&
      data[i + 1] >= WHITE_THRESHOLD &&
      data[i + 2] >= WHITE_THRESHOLD
    ) {
      data[i + 3] = 0
    }
  }

  return sharp(data, { raw: info }).png().toBuffer()
}

/**
 * 判断图片四角是否都接近纯白。
 * 只有四角全白的才是真正的白底商品图，可以放心整图抠白；
 * 带环境背景的实拍图（地板、墙面等）四角不会全白，抠图会把画面撕烂，保持原样。
 */
async function hasWhiteCorners(input: Buffer): Promise<boolean> {
  const meta = await sharp(input).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (width < CORNER_PATCH * 2 || height < CORNER_PATCH * 2) return false

  const corners: Array<[number, number]> = [
    [0, 0],
    [width - CORNER_PATCH, 0],
    [0, height - CORNER_PATCH],
    [width - CORNER_PATCH, height - CORNER_PATCH],
  ]

  for (const [left, top] of corners) {
    const stats = await sharp(input)
      .extract({ left, top, width: CORNER_PATCH, height: CORNER_PATCH })
      .stats()
    const isWhite = stats.channels
      .slice(0, 3)
      .every(channel => channel.mean >= 238)
    if (!isWhite) return false
  }

  return true
}

/**
 * 准备左侧单品素材：
 * - 矢量插画（seed 图）：不从带渐变底的 PNG 里抠色，
 *   而是用 garment-art 以透明背景重新渲染，衣服悬浮在纯色画布上；
 * - 用户实拍图：四角全白才做白底抠图，否则保留原图并垫白色圆角卡片。
 *
 * 返回 cut=false 表示保留了原始矩形照片，需要卡片衬托。
 */
async function prepareItemSource(entry: {
  item: ClothingItem
  path: string
  generated: boolean
}): Promise<{ buffer: Buffer; cut: boolean }> {
  if (entry.generated) {
    const svg = renderItemSvg(entry.item, 600, false)
    return { buffer: await sharp(Buffer.from(svg)).png().toBuffer(), cut: true }
  }

  const raw = await sharp(entry.path).toBuffer()
  try {
    if (await hasWhiteCorners(raw)) {
      return { buffer: await cutoutWhiteBackground(raw), cut: true }
    }
  } catch {
    // 抠图失败就垫卡片展示原图
  }
  return { buffer: raw, cut: false }
}

/**
 * 生成「上身对比板」：左侧竖排选中的单品，右侧是 AI 生成的模特图，
 * 整体铺在一张纯色画布上。
 *
 * 左侧矢量插画透明悬浮、实拍图去白底后悬浮（与选中服装一模一样），
 * 右侧由 AI 参考这些单品生成上身效果。
 * 任一步失败返回 null，由调用方回退为裸 AI 图。
 */
export async function buildCompareBoard(
  items: ClothingItem[],
  modelImage: string | Buffer,
  uploadsDir: string,
  options?: { trimModel?: boolean },
): Promise<Buffer | null> {
  const entries = items
    .map(item => ({
      item,
      path: resolveLocalFile(item.imageUrl, uploadsDir),
      generated: isGeneratedArt(item.imageUrl),
    }))
    .filter((entry): entry is { item: ClothingItem; path: string; generated: boolean } =>
      entry.path !== null,
    )

  if (entries.length === 0) return null

  const cellHeight = Math.floor((COMPARE_HEIGHT - COMPARE_MARGIN * 2) / entries.length)
  const overlays: sharp.OverlayOptions[] = []

  // 左侧：单品竖排，能抠的抠成透明悬浮，不能抠的垫白色圆角卡片
  for (let i = 0; i < entries.length; i++) {
    const { buffer, cut } = await prepareItemSource(entries[i])

    const tile = await sharp(buffer)
      .resize(LEFT_ZONE_WIDTH, cellHeight, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()

    if (!cut) {
      const card = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${LEFT_ZONE_WIDTH}" height="${cellHeight}">
          <rect x="8" y="8" width="${LEFT_ZONE_WIDTH - 16}" height="${cellHeight - 16}" rx="18" fill="#FFFFFF"/>
        </svg>`,
      )
      overlays.push({
        input: card,
        left: COMPARE_MARGIN,
        top: COMPARE_MARGIN + i * cellHeight,
      })
    }

    overlays.push({
      input: tile,
      left: COMPARE_MARGIN,
      top: COMPARE_MARGIN + i * cellHeight,
    })
  }

  // 右侧：模特图（AI 生成或本地人台合成），等比缩放后放在右半区。
  // 人台合成图背景是纯色且四周大量留白，先按内容裁边再缩放，模特在右半区更大更醒目
  let modelPipeline = sharp(modelImage)
  if (options?.trimModel) {
    modelPipeline = modelPipeline.trim({
      background: COMPARE_BACKGROUND,
      threshold: 12,
    })
  }
  const rightZoneWidth = COMPARE_WIDTH - COMPARE_MARGIN * 2 - LEFT_ZONE_WIDTH - COMPARE_GAP
  const rightZoneHeight = COMPARE_HEIGHT - COMPARE_MARGIN * 2
  const model = await modelPipeline
    .resize(rightZoneWidth, rightZoneHeight, {
      fit: 'contain',
      background: COMPARE_BACKGROUND,
    })
    .png()
    .toBuffer()

  overlays.push({
    input: model,
    left: COMPARE_MARGIN + LEFT_ZONE_WIDTH + COMPARE_GAP,
    top: COMPARE_MARGIN,
  })

  return sharp({
    create: {
      width: COMPARE_WIDTH,
      height: COMPARE_HEIGHT,
      channels: 4,
      background: COMPARE_BACKGROUND,
    },
  })
    .composite(overlays)
    .png()
    .toBuffer()
}
