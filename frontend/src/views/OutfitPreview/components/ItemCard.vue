<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ClothingItem } from '@/types/outfit'
import { categoryLabelMap } from '@/types/outfit'
import { useOutfitStore } from '@/stores/outfit'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const props = defineProps<{ item: ClothingItem }>()
const emit = defineEmits<{
  (e: 'edit', item: ClothingItem): void
  (e: 'dragstart', event: DragEvent, item: ClothingItem): void
}>()
const store = useOutfitStore()

// 图片加载失败时退回占位图，避免出现裂图
const imageFailed = ref(false)
watch(() => props.item.imageUrl, () => { imageFailed.value = false })

const imageUrl = computed(() => {
  if (!props.item.imageUrl) return ''
  return props.item.imageUrl.startsWith('http')
    ? props.item.imageUrl
    : `${BASE_URL}${props.item.imageUrl}`
})

const hasImage = computed(() => {
  if (imageFailed.value) return false
  return props.item.imageUrl && !props.item.imageUrl.includes('placeholder')
})

function handleAdd() {
  store.addItem(props.item)
}

function handleEdit() {
  emit('edit', props.item)
}
</script>

<template>
  <div class="item-card" :data-category="item.category" draggable="true" @dragstart="$emit('dragstart', $event, item)">
    <div class="item-image">
      <img
        v-if="hasImage"
        :src="imageUrl"
        :alt="item.name"
        class="image-real"
        @error="imageFailed = true"
      />
      <div v-else class="image-placeholder">
        {{ item.name.charAt(0) }}
      </div>
    </div>
    <div class="item-info">
      <div class="item-name" :title="item.name">{{ item.name }}</div>
      <div class="item-tags">
        <n-tag size="small" :bordered="false">{{ item.color }}</n-tag>
        <n-tag size="small" type="info" :bordered="false">{{ categoryLabelMap[item.category] }}</n-tag>
      </div>
      <div class="item-actions">
        <n-button size="tiny" @click.stop="handleEdit">编辑</n-button>
        <n-button size="tiny" type="primary" @click.stop="handleAdd">加入搭配</n-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.item-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-panel);
  transition: all 0.2s ease;
  cursor: grab;
  overflow: hidden;
  break-inside: avoid;
  margin-bottom: var(--gap-sm);
  
  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }
  
  &:active {
    cursor: grabbing;
    transform: translateY(0);
  }
}

.item-image {
  width: 100%;
  height: 0;
  padding-bottom: 100%; /* 1:1 宽高比 */
  position: relative;
  overflow: hidden;
  background: var(--color-bg);
}

.image-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary-light) 0%, var(--color-bg) 100%);
  color: var(--color-primary);
  font-size: 32px;
  font-weight: 600;
}

.image-real {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-info {
  padding: var(--gap-sm);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.item-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.item-actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
</style>