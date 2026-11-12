<script setup lang="ts">
import { computed } from 'vue'
import { useOutfitStore } from '@/stores/outfit'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const store = useOutfitStore()

// 后端返回的可能是相对路径（如 /generated/outfit-xxx.png），需要补上后端地址
const resultImageSrc = computed(() => {
  const url = store.resultImageUrl
  if (!url) return ''
  return url.startsWith('http') ? url : `${BASE_URL}${url}`
})

const statusText = computed(() => {
  switch (store.generateStatus) {
    case 'idle': return '暂无生成结果'
    case 'generating': return 'AI 正在生成穿搭效果图...'
    case 'success': return '生成成功'
    case 'failed': return '生成失败'
    default: return ''
  }
})
</script>

<template>
  <div class="result-preview">
    <div class="result-header">
      <h3>成果展示</h3>
    </div>
    <div class="result-content">
      <!-- idle 状态 -->
      <div v-if="store.generateStatus === 'idle'" class="result-idle">
        <div class="idle-icon">👗</div>
        <p>请先选择单品并点击"生成效果图"</p>
      </div>

      <!-- generating 状态 -->
      <div v-else-if="store.generateStatus === 'generating'" class="result-generating">
        <n-spin size="large" />
        <p>{{ statusText }}</p>
      </div>

      <!-- success 状态 -->
      <div v-else-if="store.generateStatus === 'success'" class="result-success">
        <img :src="resultImageSrc" alt="穿搭效果图" />
        <div v-if="store.isFallback" class="fallback-notice">
          {{ store.generateReason || '当前展示的是本地示意图' }}
        </div>
      </div>
      
      <!-- failed 状态 -->
      <div v-else-if="store.generateStatus === 'failed'" class="result-failed">
        <div class="error-icon">❌</div>
        <p>{{ store.generateError || '生成失败，请重试' }}</p>
        <n-button @click="store.setGenerating()">重新生成</n-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.result-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.result-header {
  padding: var(--gap-md);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-sm);
  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
}
.result-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--gap-md);
  overflow-y: auto;
}
.result-idle, .result-generating, .result-failed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gap-md);
  text-align: center;
  color: var(--color-muted);
}
.idle-icon {
  font-size: 48px;
}
.error-icon {
  font-size: 48px;
}
.result-success {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gap-sm);
  
  img {
    max-width: 100%;
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
}
.fallback-notice {
  font-size: 12px;
  color: var(--color-warning);
  background: rgba(230, 162, 60, 0.1);
  padding: 4px 12px;
  border-radius: var(--radius-sm);
}
</style>
