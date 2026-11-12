<script setup lang="ts">
import { useOutfitStore } from '@/stores/outfit'
import { computed, ref } from 'vue'
import { generateOutfitImage } from '@/api/generation'
import type { OutfitSelection, ClothingItem } from '@/types/outfit'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const store = useOutfitStore()

// 出图方式：AI 模特图（会参考单品图生成，可能有偏差）/ 实拍平铺（直接用原图，零偏差）
const generateMode = ref<'ai' | 'lookbook'>('ai')

const hasItems = computed(() => store.hasSelectedItems())
const isGenerating = computed(() => store.generateStatus === 'generating')

function buildOutfitPrompt(selection: OutfitSelection): string {
  const clothingTexts: string[] = []

  const describe = (item: ClothingItem) => {
    // 「黑色」+「黑色小礼服」这类颜色与名称重复时只保留一个；单字颜色补成「白色」
    const color = !item.color ? '' : item.color.length === 1 ? `${item.color}色` : item.color
    if (color && item.name.includes(color)) return item.note ? `${item.name}（${item.note}）` : item.name
    return item.note ? `${color}${item.name}（${item.note}）` : `${color}${item.name}`
  }

  // 发型/帽子单独描述（不是"穿着"），其余分类归入服装清单
  const hairText = selection.hairstyle
    ? `模特的发型必须完全按参考图中的「${describe(selection.hairstyle)}」绘制，发型样式和发色与参考图一致。`
    : '发型自然。'
  const hatText = selection.hat
    ? `模特头上必须戴着参考图中的「${describe(selection.hat)}」，帽子的颜色、款式与参考图完全一致。`
    : ''

  Object.entries(selection).forEach(([key, value]) => {
    if (!value || key === 'hairstyle' || key === 'hat') return
    if (Array.isArray(value)) {
      value.forEach(item => clothingTexts.push(describe(item)))
    } else {
      clothingTexts.push(describe(value))
    }
  })

  return [
    '请生成一张精美二次元动漫风格的时尚穿搭插画，韩系插画质感，人物五官精致漂亮。',
    hairText,
    hatText,
    '模特身材高挑修长，九头身比例，脖子肩膀线条舒展，双腿细长笔直，身材纤细。',
    '模特正面站立，全身构图，从头到脚完整入画，画面中只有一位模特。',
    '背景为单一纯色浅灰色，干净无杂物、无道具、无文字。',
    '模特身上的服装必须与描述的单品完全一致，不要添加描述之外的服饰或配饰。',
    clothingTexts.length ? `模特穿着：${clothingTexts.join('、')}。` : '',
    '整体是高级感的时尚搭配插画，适合服装搭配预览。'
  ]
    .filter(Boolean)
    .join('')
}

function handleClear() {
  if (confirm('确定要清空当前搭配吗？')) {
    store.clearOutfit()
  }
}

async function handleSave() {
  if (!store.resultImageUrl) {
    alert('请先生成效果图')
    return
  }

  try {
    const imageUrl = store.resultImageUrl.startsWith('http')
      ? store.resultImageUrl
      : `${BASE_URL}${store.resultImageUrl}`

    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)

    // 按实际返回的内容类型决定扩展名，避免 svg 内容被存成 .png
    const ext = blob.type.includes('svg') ? 'svg' : blob.type.includes('jpeg') ? 'jpg' : 'png'

    const a = document.createElement('a')
    a.href = url
    a.download = `outfit-${Date.now()}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Download failed:', error)
    alert('下载失败')
  }
}

async function handleGenerate() {
  if (!hasItems.value) {
    alert('请先选择至少一个单品')
    return
  }

  const prompt = buildOutfitPrompt(store.selectedItems)
  store.currentPrompt = prompt
  store.setGenerating()

  try {
    const result = await generateOutfitImage({
      items: store.selectedItems,
      prompt,
      mode: generateMode.value,
    })
    store.setGenerateSuccess(result.imageUrl, result.isFallback, result.reason)
    if (result.isFallback) {
      console.warn('[Generation] 使用本地示意图：', result.reason)
    } else {
      console.log('[Generation] Success, imageUrl:', result.imageUrl)
    }
  } catch (error: any) {
    console.error('[Generation] Error:', error)
    store.setGenerateFailed(error.message || '生成失败，请稍后重试')
    alert('生成失败: ' + (error.message || '请稍后重试'))
  }
}
</script>

<template>
  <div class="top-actions">
    <n-radio-group v-model:value="generateMode" size="small" name="generate-mode">
      <n-radio-button value="ai">AI 模特图</n-radio-button>
      <n-radio-button value="lookbook">实拍平铺</n-radio-button>
    </n-radio-group>
    <n-button quaternary size="small" @click="handleClear">清空</n-button>
    <n-button quaternary size="small" @click="handleSave">保存套装</n-button>
    <n-button
      type="primary"
      size="small"
      :loading="isGenerating"
      :disabled="isGenerating"
      @click="handleGenerate"
    >
      生成效果图
    </n-button>
  </div>
</template>

<style lang="scss" scoped>
.top-actions {
  display: flex;
  gap: var(--gap-sm);
}
</style>
