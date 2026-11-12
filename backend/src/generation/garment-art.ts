import type { ClothingCategory } from '../common/types'

/**
 * 服装矢量图形库
 *
 * 目的：为没有真实商品图的单品提供可辨识的占位插画，并作为离线穿搭合成的素材。
 * 全部使用纯路径绘制，不含文字，因此不依赖任何字体，浏览器与图片处理库渲染结果一致。
 */

const COLOR_MAP: Record<string, string> = {
  黑色: '#2B2B2E',
  白色: '#F3F2EF',
  灰色: '#9AA0A6',
  银色: '#C3C7CB',
  米色: '#D8C6A4',
  棕色: '#8B5A2B',
  褐色: '#6B4A2F',
  卡其色: '#B49B63',
  红色: '#C0392B',
  粉色: '#E39AAF',
  蓝色: '#2E5FA3',
  蓝白: '#9FBEDC',
  金色: '#D4AF37',
  多色: '#9B7EDE',
  绿色: '#4C8C5A',
  肤色: '#E8C4A8',
  肉色: '#E5BFA2',
}

export function colorToHex(color: string): string {
  return COLOR_MAP[color] ?? '#8A8F98'
}

function shift(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  const r = clamp(((n >> 16) & 0xff) + amount)
  const g = clamp(((n >> 8) & 0xff) + amount)
  const b = clamp((n & 0xff) + amount)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

const SKIRT_SHAPE = 'M28,16 L72,16 L86,84 L14,84 Z'
const TOTE_SHAPE = 'M24,38 L76,38 L80,84 L20,84 Z'
const CHAIN_SHAPE = 'M24,46 L76,46 L76,80 L24,80 Z'
const BELT_SHAPE = 'M12,45 L88,45 L88,61 L12,61 Z'
const SCARF_SHAPE = 'M22,28 L78,28 L50,84 Z'

/**
 * 生成袜子轮廓：竖直的筒身 + 底部向左弯出的脚。
 * 各款袜子的区别主要在筒身长度，所以脚部位置固定，只让袖口高度变化。
 * @param cuffY 袖口位置，越小袜子越长
 */
function sockShape(cuffY: number): string {
  const ankleY = 60
  const toeY = 86
  return [
    `M35,${cuffY}`,
    `L65,${cuffY}`,
    `L65,${ankleY}`,
    `C65,${ankleY + 8} 62,${ankleY + 12} 57,${ankleY + 15}`,
    `L38,${toeY}`,
    `C31,${toeY + 4} 24,${toeY + 1} 24,${toeY - 7}`,
    `C24,${toeY - 13} 29,${toeY - 15} 33,${ankleY - 1}`,
    `L35,${ankleY}`,
    'Z',
  ].join(' ')
}

/** 船袜：只到脚踝 */
const SOCK_ANKLE = sockShape(52)
/** 中筒袜：到小腿中段 */
const SOCK_CREW = sockShape(30)
/** 长筒袜：过膝 */
const SOCK_LONG = sockShape(8)
/** 堆堆袜：筒身较短，袖口有堆叠的褶皱 */
const SOCK_SLOUCH = sockShape(24)
/** 丝袜 / 网袜：上宽下窄的锥形筒，没有脚 */
const STOCKING_SHAPE =
  'M34,14 L66,14 L63,46 C62,64 59,78 58,85 Q57,92 50,92 Q43,92 42,85 C41,78 38,64 37,46 Z'
/** 连裤袜：更长的筒身 + 腰头 */
const TIGHTS_SHAPE =
  'M31,8 L69,8 L67,44 C66,64 63,82 60,92 Q50,97 40,92 C37,82 34,64 33,44 Z'

/** 高跟鞋侧影：前掌流线 + 细跟，鞋跟在右侧 */
const HEEL_SHAPE =
  'M14,76 C14,64 22,55 36,52 C52,49 66,53 76,62 L86,76 Z M72,60 L66,76 L72,76 L80,60 Z'

/* 发型（正面视角，中间留出脸部） */

/** 长直发：顶部薄刘海 + 两侧细发条，中间大面积留出脸部 */
const HAIR_LONG =
  'M50,8 C32,8 20,24 20,42 C20,62 24,82 30,96 L38,96 C34,80 32,60 34,44 L36,34 C40,26 44,24 50,24 C56,24 60,26 64,34 L66,44 C68,60 66,80 62,96 L70,96 C76,82 80,62 80,42 C80,24 68,8 50,8 Z'

/** 长卷发：外缘波浪起伏 */
const HAIR_CURLY =
  'M50,6 C30,6 16,20 16,40 C14,50 18,56 14,64 C18,72 14,80 18,90 C22,96 28,96 30,92 C26,78 30,62 32,46 C33,36 40,28 50,28 C60,28 67,36 68,46 C70,62 74,78 70,92 C72,96 78,96 82,90 C86,80 82,72 86,64 C82,56 86,50 84,40 C84,20 70,6 50,6 Z'

/** 短发：两侧只到下巴 */
const HAIR_SHORT =
  'M50,10 C31,10 20,25 20,43 C20,56 23,68 29,76 L38,74 C32,64 31,50 33,42 C35,32 41,27 50,27 C59,27 65,32 67,42 C69,50 68,64 62,74 L71,76 C77,68 80,56 80,43 C80,25 69,10 50,10 Z'

/** 高马尾：短发包 + 右侧马尾束 */
const HAIR_PONYTAIL =
  'M50,9 C31,9 21,24 21,42 C21,55 24,66 29,74 L38,72 C33,63 32,50 34,42 C36,32 42,27 50,27 C58,27 64,32 66,42 C68,54 66,64 62,72 L71,74 C76,64 78,52 76,42 C75,24 68,9 50,9 Z M68,26 C78,24 86,32 88,42 C90,52 86,62 80,68 L73,62 C79,56 81,48 78,41 C75,35 71,30 68,26 Z'

/* 帽子 */

/** 贝雷帽：圆顶 + 帽蒂 */
const BERET_SHAPE =
  'M22,56 C22,38 34,26 50,26 C66,26 78,38 78,56 C78,60 74,63 70,63 L30,63 C26,63 22,60 22,56 Z M48,24 C50,18 54,15 58,15 C60,15 61,17 60,19 C58,22 54,24 50,25 Z'

/** 棒球帽：帽顶 + 右伸帽檐 */
const CAP_SHAPE =
  'M24,58 C24,38 35,26 50,26 C65,26 76,38 76,54 L76,60 L24,60 Z M74,52 C82,52 90,56 94,61 C96,64 93,67 88,66 L74,62 Z'

/** 宽檐帽 / 草帽：大帽檐 + 圆顶 */
const WIDE_HAT_SHAPE =
  'M12,54 C12,48 28,44 50,44 C72,44 88,48 88,54 C88,60 72,64 50,64 C28,64 12,60 12,54 Z M28,52 C28,38 38,28 50,28 C62,28 72,38 72,52 Z'

/** 各分类的主轮廓路径，viewBox 为 0 0 100 100 */
const SHAPES: Record<ClothingCategory, string> = {
  top: 'M30,20 L41,15 L50,24 L59,15 L70,20 L86,33 L77,44 L70,36 L70,86 L30,86 L30,36 L23,44 L14,33 Z',
  outerwear:
    'M27,18 L39,13 L46,19 L50,32 L54,19 L61,13 L73,18 L86,28 L92,62 L80,66 L72,36 L72,90 L28,90 L28,36 L20,66 L8,62 L14,28 Z',
  bottom: 'M27,14 L73,14 L75,42 L73,88 L57,88 L50,54 L43,88 L27,88 L25,42 Z',
  dress:
    'M36,17 L44,14 L50,22 L56,14 L64,17 L69,30 L63,36 L65,52 L86,88 L14,88 L35,52 L37,36 L31,30 Z',
  shoes:
    'M16,72 L16,50 C16,45 20,41 26,41 L32,41 C37,41 41,45 44,51 L50,61 L64,66 C74,69 86,71 86,72 Z',
  bag: 'M24,38 L76,38 L80,84 L20,84 Z',
  accessory: 'M50,56 m-12,0 a12,12 0 1,0 24,0 a12,12 0 1,0 -24,0',
  hosiery: SOCK_CREW,
  hairstyle: HAIR_LONG,
  hat: BERET_SHAPE,
}

/** 碎花图案的花朵中心坐标 */
const FLORAL_CENTERS: [number, number][] = [
  [30, 32],
  [62, 24],
  [46, 52],
  [24, 68],
  [68, 66],
  [48, 80],
]

/** 依据单品名称挑选更贴切的形状变体 */
function resolveShape(category: ClothingCategory, name: string): string {
  if (category === 'shoes' && name.includes('高跟')) return HEEL_SHAPE
  if (category === 'hairstyle') {
    if (name.includes('卷')) return HAIR_CURLY
    if (name.includes('短发') || name.includes('波波')) return HAIR_SHORT
    if (name.includes('马尾')) return HAIR_PONYTAIL
    return HAIR_LONG
  }
  if (category === 'hat') {
    if (name.includes('棒球')) return CAP_SHAPE
    if (name.includes('草帽') || name.includes('宽檐') || name.includes('渔夫')) return WIDE_HAT_SHAPE
    return BERET_SHAPE
  }
  if (category === 'bottom' && name.includes('裙')) return SKIRT_SHAPE
  if (category === 'bag' && name.includes('链')) return CHAIN_SHAPE
  if (category === 'bag') return TOTE_SHAPE
  if (category === 'accessory') {
    if (name.includes('皮带') || name.includes('带')) return BELT_SHAPE
    if (name.includes('巾') || name.includes('披')) return SCARF_SHAPE
  }
  if (category === 'hosiery') {
    if (name.includes('连裤')) return TIGHTS_SHAPE
    if (name.includes('丝袜') || name.includes('网袜')) return STOCKING_SHAPE
    if (name.includes('堆堆')) return SOCK_SLOUCH
    if (name.includes('长筒') || name.includes('过膝')) return SOCK_LONG
    if (name.includes('短袜') || name.includes('船袜')) return SOCK_ANKLE
    return SOCK_CREW
  }
  return SHAPES[category]
}

/** 依据单品名称挑选叠加图案 */
function resolvePattern(name: string): 'plaid' | 'stripe' | 'floral' | 'mesh' | null {
  if (name.includes('格纹') || name.includes('格子')) return 'plaid'
  if (name.includes('条纹')) return 'stripe'
  if (name.includes('碎花') || name.includes('花朵')) return 'floral'
  if (name.includes('网袜')) return 'mesh'
  return null
}

/** 图案以剪裁方式叠加在服装轮廓内部 */
function buildPattern(
  id: string,
  pattern: 'plaid' | 'stripe' | 'floral' | 'mesh',
  ink: string,
): string {
  if (pattern === 'plaid') {
    return `<g clip-path="url(#clip-${id})" stroke="${ink}" stroke-width="3" opacity="0.45">
      <line x1="10" y1="20" x2="90" y2="20"/><line x1="10" y1="50" x2="90" y2="50"/><line x1="10" y1="80" x2="90" y2="80"/>
      <line x1="25" y1="8" x2="25" y2="95"/><line x1="60" y1="8" x2="60" y2="95"/>
      <line x1="85" y1="8" x2="85" y2="95"/>
    </g>`
  }
  if (pattern === 'stripe') {
    return `<g clip-path="url(#clip-${id})" stroke="${ink}" stroke-width="5" opacity="0.4">
      <line x1="0" y1="28" x2="100" y2="28"/><line x1="0" y1="46" x2="100" y2="46"/>
      <line x1="0" y1="64" x2="100" y2="64"/><line x1="0" y1="82" x2="100" y2="82"/>
    </g>`
  }
  if (pattern === 'mesh') {
    // 网袜：菱形网格
    const lines: string[] = []
    for (let i = -100; i <= 200; i += 9) {
      lines.push(`<line x1="${i}" y1="0" x2="${i + 100}" y2="100"/>`)
      lines.push(`<line x1="${i}" y1="100" x2="${i + 100}" y2="0"/>`)
    }
    return `<g clip-path="url(#clip-${id})" stroke="${ink}" stroke-width="0.9" opacity="0.6">${lines.join('')}</g>`
  }

  return `<g clip-path="url(#clip-${id})" fill="${ink}" opacity="0.5">
    ${FLORAL_CENTERS.map(([cx, cy]) => {
      const petals: string[] = []
      for (let i = 0; i < 5; i++) {
        const angle = (i * 72 * Math.PI) / 180
        petals.push(
          `<circle cx="${(cx + Math.cos(angle) * 4.5).toFixed(1)}" cy="${(cy + Math.sin(angle) * 4.5).toFixed(1)}" r="2.6"/>`,
        )
      }
      return `<g>${petals.join('')}<circle cx="${cx}" cy="${cy}" r="1.7" fill="#F6E7A8"/></g>`
    }).join('')}
  </g>`
}

/** 轮廓之外的装饰线（门襟、口袋、鞋带等） */
function buildDetails(category: ClothingCategory, name: string, ink: string): string {
  const stroke = `stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.55"`
  if (category === 'outerwear') {
    return `<g ${stroke}><line x1="50" y1="34" x2="50" y2="90"/><path d="M46,19 L38,30 L50,34"/><path d="M54,19 L62,30 L50,34"/></g>`
  }
  if (category === 'top') {
    return `<g ${stroke}><path d="M41,15 C44,24 56,24 59,15"/></g>`
  }
  if (category === 'dress') {
    return `<g ${stroke}><path d="M44,14 C46,21 54,21 56,14"/><line x1="35" y1="52" x2="65" y2="52"/></g>`
  }
  if (category === 'bottom' && !name.includes('裙')) {
    return `<g ${stroke}><line x1="25" y1="24" x2="75" y2="24"/></g>`
  }
  if (category === 'bottom') {
    return `<g ${stroke}><line x1="28" y1="26" x2="72" y2="26"/></g>`
  }
  if (category === 'shoes') {
    return `<g>
      <rect x="13" y="70" width="76" height="10" rx="3" fill="${ink}" stroke="none"/>
      <g ${stroke}><path d="M31,47 L41,53"/><path d="M34,42 L44,49"/><path d="M50,61 L62,66"/></g>
    </g>`
  }
  if (category === 'bag' && name.includes('链')) {
    return `<g ${stroke}><path d="M28,46 C28,32 72,32 72,46"/></g>`
  }
  if (category === 'bag') {
    return `<g ${stroke}><path d="M36,38 C36,20 64,20 64,38"/></g>`
  }
  if (category === 'accessory' && (name.includes('皮带') || name.includes('带'))) {
    return `<g ${stroke}><rect x="43" y="41" width="14" height="24" rx="2"/></g>`
  }
  if (category === 'accessory' && (name.includes('巾') || name.includes('披'))) {
    return `<g ${stroke}><path d="M30,36 L70,36"/></g>`
  }
  if (category === 'hosiery') {
    if (name.includes('连裤')) {
      // 连裤袜：腰头 + 裆部接缝
      return `<g ${stroke}>
        <line x1="31" y1="18" x2="69" y2="18"/>
        <line x1="50" y1="20" x2="50" y2="58"/>
      </g>`
    }
    if (name.includes('丝袜')) {
      // 丝袜：袜口蕾丝边
      const ribs = [39, 44, 50, 56, 61]
        .map(x => `<line x1="${x}" y1="17" x2="${x}" y2="27"/>`)
        .join('')
      return `<g ${stroke}>
        <line x1="35" y1="18" x2="65" y2="18"/>
        <line x1="35" y1="28" x2="64" y2="28"/>
        ${ribs}
      </g>`
    }
    if (name.includes('堆堆')) {
      // 堆堆袜：袖口堆叠的褶皱
      return `<g ${stroke}>
        <line x1="36" y1="27" x2="64" y2="27"/>
        <line x1="36" y1="34" x2="64" y2="34"/>
        <line x1="36" y1="41" x2="64" y2="41"/>
      </g>`
    }
    // 各类筒袜：袜口罗纹
    const cuff = name.includes('短袜') || name.includes('船袜') ? 54 : name.includes('长筒') || name.includes('过膝') ? 10 : 32
    return `<g ${stroke}>
      <line x1="35" y1="${cuff}" x2="65" y2="${cuff}"/>
      <line x1="35" y1="${cuff + 7}" x2="65" y2="${cuff + 7}"/>
    </g>`
  }
  if (category === 'accessory') {
    // 项链/耳环：链条用描边表现，主体只保留吊坠
    return `<g ${stroke}><path d="M30,20 C30,42 38,52 50,56"/><path d="M70,20 C70,42 62,52 50,56"/><circle cx="50" cy="56" r="3"/></g>`
  }
  if (category === 'hairstyle') {
    // 发丝走向：画在两侧发条上，不落在脸部留白区
    return `<g ${stroke}><path d="M28,42 C27,60 29,78 32,90"/><path d="M72,42 C73,60 71,78 68,90"/></g>`
  }
  if (category === 'hat') {
    // 帽饰：帽檐处一条饰带；宽檐帽除外（自身已有大檐）
    if (name.includes('草帽') || name.includes('宽檐')) {
      return `<g ${stroke}><path d="M30,50 C40,54 60,54 70,50"/></g>`
    }
    return `<g ${stroke}><line x1="28" y1="54" x2="72" y2="54"/></g>`
  }
  return ''
}

/**
 * 生成单品图形的内部标记（不含最外层 svg，可嵌套进合成画布）
 */
export function renderItemArt(
  item: { name: string; category: ClothingCategory; color: string },
  idSuffix = 'g',
): string {
  const id = idSuffix
  const base = colorToHex(item.color)
  const dark = shift(base, -38)
  const light = shift(base, 34)
  const shape = resolveShape(item.category, item.name)
  const pattern = resolvePattern(item.name)
  const patternInk = base === '#F3F2EF' ? '#9AA0A6' : light

  return `<defs>
    <linearGradient id="fab-${id}" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="55%" stop-color="${base}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <clipPath id="clip-${id}"><path d="${shape}"/></clipPath>
  </defs>
  <path d="${shape}" fill="url(#fab-${id})" stroke="${dark}" stroke-width="1" stroke-linejoin="round"/>
  ${pattern ? buildPattern(id, pattern, patternInk) : ''}
  ${buildDetails(item.category, item.name, dark)}`
}

/**
 * 生成单品的 SVG 插画
 * @param size 输出的像素边长
 * @param withBackground 是否带背景色块（单品库卡片用 true，穿搭合成用 false）
 */
export function renderItemSvg(
  item: { name: string; category: ClothingCategory; color: string },
  size = 600,
  withBackground = true,
  idSuffix = 'g',
): string {
  const id = idSuffix
  const background = withBackground
    ? `<defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#EDEFF2"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#bg-${id})"/>
  <ellipse cx="50" cy="92" rx="26" ry="3.5" fill="#000" opacity="0.08"/>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  ${background}
  ${renderItemArt(item, idSuffix)}
</svg>`
}

/**
 * 服装轮廓在 1024 画布上的位置与尺寸，供离线穿搭合成使用
 */
export interface GarmentPlacement {
  x: number
  y: number
  width: number
  height: number
}

export const GARMENT_PLACEMENTS: Record<ClothingCategory, GarmentPlacement[]> = {
  outerwear: [{ x: 366, y: 196, width: 292, height: 372 }],
  top: [{ x: 417, y: 226, width: 190, height: 214 }],
  bottom: [{ x: 404, y: 428, width: 216, height: 268 }],
  // 连衣裙从肩部一直盖到膝盖下方（人台腿根在 y≈470，膝盖在 y≈650）
  dress: [{ x: 396, y: 150, width: 232, height: 560 }],
  // 一双鞋：同一个单品画两只
  shoes: [
    { x: 414, y: 820, width: 100, height: 84 },
    { x: 522, y: 820, width: 100, height: 84 },
  ],
  bag: [{ x: 648, y: 446, width: 150, height: 150 }],
  accessory: [{ x: 452, y: 172, width: 120, height: 92 }],
  // 袜类画在两条腿上：槽位对准左右腿，图案绘制范围只占槽位中段
  hosiery: [
    { x: 365, y: 425, width: 200, height: 462 },
    { x: 460, y: 425, width: 200, height: 462 },
  ],
  // 发型罩在人台头部（头部约 x470-554，y90-190），两侧垂到肩下
  hairstyle: [{ x: 442, y: 84, width: 140, height: 120 }],
  // 帽子扣在头顶，位于发型图层之上（略宽于头型才有"戴着"的感觉）
  hat: [{ x: 432, y: 44, width: 160, height: 120 }],
}

/**
 * 特定单品的专属位置（按名称关键词匹配）。
 * 目前没有需要单独处理的单品，保留这个扩展点。
 */
export const SPECIAL_PLACEMENTS: { keyword: string; placements: GarmentPlacement[] }[] = []

