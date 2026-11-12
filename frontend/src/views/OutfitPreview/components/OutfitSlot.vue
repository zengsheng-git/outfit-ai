<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { useOutfitStore } from '@/stores/outfit'
import type { SlotDefinition, ClothingItem } from '@/types/outfit'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const props = defineProps<{ slotDef: SlotDefinition }>()
const store = useOutfitStore()
const message = useMessage()

// 记录加载失败的单品，退回占位图
const failedIds = ref<Set<string>>(new Set())

const slotItems = computed(() => {
  const val = store.selectedItems[props.slotDef.key]
  if (!val) return []
  if (Array.isArray(val)) return val
  return [val]
})

function getImageUrl(item: ClothingItem): string {
  if (!item.imageUrl) return ''
  return item.imageUrl.startsWith('http')
    ? item.imageUrl
    : `${BASE_URL}${item.imageUrl}`
}

function hasImage(item: ClothingItem): boolean {
  if (failedIds.value.has(item.id)) return false
  return !!item.imageUrl && !item.imageUrl.includes('placeholder')
}

function markFailed(itemId: string) {
  failedIds.value = new Set(failedIds.value).add(itemId)
}

function handleRemove(itemId?: string) {
  store.removeItem(props.slotDef.acceptCategory, itemId)
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  if (!event.dataTransfer) return

  try {
    const item: ClothingItem = JSON.parse(event.dataTransfer.getData('application/json'))
    if (item.category !== props.slotDef.acceptCategory) {
      message.warning(`该槽位只接受「${props.slotDef.label}」类别的单品`)
      return
    }
    store.addItem(item)
    message.success(`已添加 ${item.name}`)
  } catch {
    message.error('添加失败')
  }
}
</script>

<template>
  <div class="outfit-slot">
    <div class="slot-label">{{ slotDef.label }}</div>
    <div
      class="slot-content"
      :class="{ 'is-empty': slotItems.length === 0 }"
      @dragover="onDragOver"
      @drop="onDrop"
    >
      <div v-if="slotItems.length === 0" class="slot-empty">
        <span>拖拽或点击添加{{ slotDef.label }}</span>
      </div>
      <div 
        v-for="item in slotItems" 
        :key="item.id" 
        class="slot-item"
      >
        <div class="item-image">
          <img
            v-if="hasImage(item)"
            :src="getImageUrl(item)"
            :alt="item.name"
            class="image-real"
            @error="markFailed(item.id)"
          />
          <div v-else class="image-placeholder">{{ item.name.charAt(0) }}</div>
          <button class="remove-btn" @click="handleRemove(item.id)">×</button>
        </div>
        <div class="item-info">
          <span class="item-name" :title="item.name">{{ item.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.outfit-slot {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}

.slot-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.slot-content {
  min-height: 120px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--gap-sm);
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
  transition: all 0.2s;
  
  &.is-empty {
    align-items: center;
    justify-content: center;
  }
  
  &:hover {
    border-color: var(--color-primary);
  }
}

.slot-empty {
  color: var(--color-muted);
  font-size: 13px;
  text-align: center;
}

.slot-item {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-panel);
  overflow: hidden;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
  font-size: 24px;
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

.remove-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border: none;
  background: var(--color-danger);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 1;
  
  &:hover {
    background: #c94444;
  }
}

.slot-item:hover .remove-btn {
  opacity: 1;
}

.item-info {
  padding: var(--gap-sm);
}

.item-name {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
</style>