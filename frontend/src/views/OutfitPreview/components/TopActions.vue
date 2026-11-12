<script setup lang="ts">
import { useOutfitStore } from '@/stores/outfit'
import { computed, onMounted, ref, watch } from 'vue'
import { generateOutfitImage, getGenerationStatus } from '@/api/generation'
import type { GenerationQuota } from '@/api/generation'
import type { OutfitSelection, ClothingItem } from '@/types/outfit'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const store = useOutfitStore()

// 出图渠道与配额胶囊：页面加载 / 生成结束后自动刷新，点击胶囊立即刷新
interface ChannelInfo {
  label: string
  model?: string
  keyHint?: string
  quota?: GenerationQuota
}

const channel = ref<ChannelInfo | null>(null)
const refreshing = ref(false)

async function refreshChannel() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    const status = await getGenerationStatus()
    const active = status.providers.find(p => p.key === status.active)
    channel.value = active
      ? {
          label: active.name ?? '未知',
          model: 'model' in active ? active.model : undefined,
          keyHint: 'keyHint' in active ? active.keyHint : undefined,
          quota: 'quota' in active ? active.quota : undefined,
        }
      : null
  } catch (e) {
    console.error('Failed to load generation status:', e)
  } finally {
    refreshing.value = false
  }
}

onMounted(refreshChannel)
watch(
  () => store.generateStatus,
  status => {
    if (status === 'success' || status === 'failed') refreshChannel()
  },
)

const quotaView = computed(() => {
  const quota = channel.value?.quota
  if (!quota || quota.weeklyPercent == null) return null
  return {
    percent: quota.weeklyPercent,
    barWidth: `${Math.max(0, Math.min(100, quota.weeklyPercent))}%`,
    reset: formatTime(quota.weeklyResetAt),
  }
})

const fetchedText = computed(() => formatTime(channel.value?.quota?.fetchedAt))

function formatTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

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
    <n-tooltip v-if="channel" trigger="hover" placement="bottom-right" :show-arrow="false">
      <template #trigger>
        <div class="quota-pill" @click="refreshChannel">
          <span class="quota-dot" :class="{ refreshing }"></span>
          <span class="quota-name">{{ channel.label }}</span>
          <template v-if="quotaView">
            <span class="quota-bar">
              <span class="quota-bar-fill" :style="{ width: quotaView.barWidth }"></span>
            </span>
            <span class="quota-num">{{ quotaView.percent }}%</span>
            <span class="quota-reset" v-if="quotaView.reset">{{ quotaView.reset }} 重置</span>
          </template>
        </div>
      </template>
      <div class="quota-detail">
        <div class="quota-detail-title">出图渠道</div>
        <div class="quota-detail-row">
          <span>{{ channel.label }}</span>
          <span class="quota-detail-muted" v-if="channel.model">{{ channel.model }}</span>
        </div>
        <div class="quota-detail-row" v-if="channel.keyHint">
          <span class="quota-detail-muted">密钥</span>
          <span>{{ channel.keyHint }}</span>
        </div>
        <template v-if="quotaView">
          <div class="quota-detail-title">周额度余量</div>
          <div class="quota-detail-row">
            <span>{{ quotaView.percent }}%</span>
            <span class="quota-detail-muted" v-if="quotaView.reset">{{ quotaView.reset }} 重置</span>
          </div>
        </template>
        <template v-if="channel.quota">
          <div class="quota-detail-title">5h 窗口</div>
          <div class="quota-detail-row">
            <span v-if="channel.quota.intervalHasQuota && channel.quota.intervalPercent != null">
              {{ channel.quota.intervalPercent }}%
            </span>
            <span class="quota-detail-muted" v-else>当前套餐未分配</span>
          </div>
        </template>
        <div class="quota-detail-row" v-if="fetchedText">
          <span class="quota-detail-muted">查询时间</span>
          <span>{{ fetchedText }}</span>
        </div>
        <div class="quota-detail-row">
          <span class="quota-detail-muted">刷新方式</span>
          <span>点击胶囊立即刷新</span>
        </div>
      </div>
    </n-tooltip>
  </div>
</template>

<style lang="scss" scoped>
.top-actions {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
}

.quota-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px;
  background: linear-gradient(135deg, #f8fafc, #eef2f7);
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  font-size: 12px;
  color: #475569;
  white-space: nowrap;
  flex-shrink: 0;
  user-select: none;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: #cbd5e1;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
  }

  &:active {
    transform: scale(0.97);
  }
}

.quota-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.45);

  &.refreshing {
    animation: quota-pulse 0.8s ease-in-out infinite;
  }
}

@keyframes quota-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(0.7);
  }
}

.quota-name {
  font-weight: 600;
  color: #1e293b;
  letter-spacing: 0.02em;
}

.quota-bar {
  width: 48px;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.quota-bar-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #34d399, #10b981);
  transition: width 0.4s ease;
}

.quota-num {
  font-weight: 700;
  color: #059669;
  font-variant-numeric: tabular-nums;
}

.quota-reset {
  color: #94a3b8;
}

.quota-detail {
  min-width: 200px;
  font-size: 12px;
  line-height: 1.5;
}

.quota-detail-title {
  margin: 8px 0 2px;
  font-weight: 600;
  opacity: 0.9;

  &:first-child {
    margin-top: 0;
  }
}

.quota-detail-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.quota-detail-muted {
  opacity: 0.65;
}
</style>
