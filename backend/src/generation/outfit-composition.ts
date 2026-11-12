import type { ClothingItem } from '../common/types'
import { GARMENT_PLACEMENTS, SPECIAL_PLACEMENTS, renderItemArt } from './garment-art'

const CANVAS = 1024

/** 人台轮廓，纯路径绘制，无文字，保证任何环境下渲染一致 */
const MANNEQUIN = {
  head: '<ellipse cx="512" cy="140" rx="42" ry="50"/>',
  neck: '<path d="M494,178 L530,178 L533,218 L491,218 Z"/>',
  torso:
    '<path d="M410,248 C410,232 428,222 452,215 L494,208 L530,208 L572,215 C596,222 614,232 614,248 L606,344 L596,432 L596,480 L428,480 L428,432 L418,344 Z"/>',
  armLeft:
    '<path d="M410,250 C391,264 379,293 371,331 L357,437 C355,453 366,463 378,458 C386,455 390,446 392,432 L410,340 Z"/>',
  armRight:
    '<path d="M614,250 C633,264 645,293 653,331 L667,437 C669,453 658,463 646,458 C638,455 634,446 632,432 L614,340 Z"/>',
  legs:
    '<path d="M432,468 L592,468 L598,640 L588,860 L540,860 L512,652 L484,860 L436,860 L426,640 Z"/>',
}

/** 叠放顺序：越靠后越在外层（发型盖住人台头部，帽子盖住发型） */
const LAYER_ORDER = [
  'bottom',
  'hairstyle',
  'dress',
  'top',
  'outerwear',
  'shoes',
  'hosiery',
  'bag',
  'accessory',
  'hat',
] as const

/**
 * 把选中的单品合成到人台上，输出完整 SVG。
 *
 * 每个单品以嵌套 <svg> 形式放入，内部的渐变与裁剪路径使用独立 id 避免互相覆盖。
 */
export function buildOutfitSvg(items: ClothingItem[]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <rect width="${CANVAS}" height="${CANVAS}" fill="#C9C9C9"/>
  <ellipse cx="512" cy="930" rx="286" ry="34" fill="#000000" opacity="0.10"/>

  <g fill="#D8D8D8" stroke="#C2C2C2" stroke-width="2" stroke-linejoin="round">
    ${MANNEQUIN.legs}
    ${MANNEQUIN.armLeft}
    ${MANNEQUIN.armRight}
    ${MANNEQUIN.torso}
    ${MANNEQUIN.neck}
    ${MANNEQUIN.head}
  </g>

  ${buildGarments(items)}
</svg>`
}

function buildGarments(items: ClothingItem[]): string {
  const byCategory = new Map<string, ClothingItem[]>()
  for (const item of items) {
    const list = byCategory.get(item.category) ?? []
    list.push(item)
    byCategory.set(item.category, list)
  }

  const parts: string[] = []
  let seq = 0

  const place = (item: ClothingItem, slot: { x: number; y: number; width: number; height: number }, offset: number) => {
    const id = `a${seq++}`
    return `<svg x="${slot.x + offset}" y="${slot.y}" width="${slot.width}" height="${slot.height}" viewBox="0 0 100 100" overflow="visible">${renderItemArt(item, id)}</svg>`
  }

  for (const category of LAYER_ORDER) {
    const group = byCategory.get(category)
    if (!group || group.length === 0) continue

    const slots = GARMENT_PLACEMENTS[category]

    if (category === 'shoes') {
      // 一双鞋：同一个单品画两只
      for (const slot of slots) {
        parts.push(place(group[0], slot, 0))
      }
      continue
    }

    if (category === 'hosiery' && group.length === 1) {
      // 单件袜类（网袜/丝袜/连裤袜）左右腿各画一遍
      for (const slot of slots) {
        parts.push(place(group[0], slot, 0))
      }
      continue
    }

    group.forEach((item, index) => {
      // 丝袜等单品有专属位置，不占用类别的默认槽位
      const special = SPECIAL_PLACEMENTS.find(s => item.name.includes(s.keyword))
      if (special) {
        for (const p of special.placements) {
          parts.push(place(item, p, 0))
        }
        return
      }
      const slot = slots[index % slots.length]
      // 超出槽位数量的配饰向右错开，避免完全重叠
      const offset = index >= slots.length ? (index - slots.length + 1) * 96 : 0
      parts.push(place(item, slot, offset))
    })
  }

  return parts.join('\n')
}
