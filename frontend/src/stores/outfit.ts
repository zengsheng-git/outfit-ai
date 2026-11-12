import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { ClothingItem, ClothingCategory, OutfitSelection, GenerateStatus } from '@/types/outfit'
import { isMultiItemCategory } from '@/types/outfit'

export const useOutfitStore = defineStore('outfit', () => {
  const selectedItems = reactive<OutfitSelection>({})
  const resultImageUrl = ref('')
  const generateStatus = ref<GenerateStatus>('idle')
  const generateError = ref('')
  const currentPrompt = ref('')
  const isFallback = ref(false)
  const generateReason = ref('')

  function addItem(item: ClothingItem) {
    if (isMultiItemCategory(item.category)) {
      const list = ((selectedItems as Record<string, unknown>)[item.category] ??=
        []) as ClothingItem[]
      if (!list.some(i => i.id === item.id)) {
        list.push(item)
      }
      return
    }
    ;(selectedItems as Record<string, ClothingItem | ClothingItem[] | undefined>)[item.category] = item
  }

  function removeItem(category: ClothingCategory, itemId?: string) {
    if (isMultiItemCategory(category) && itemId) {
      const list = (selectedItems as Record<string, ClothingItem[] | undefined>)[category]
      if (list) {
        const next = list.filter(i => i.id !== itemId)
        if (next.length === 0) {
          delete (selectedItems as Record<string, unknown>)[category]
        } else {
          ;(selectedItems as Record<string, unknown>)[category] = next
        }
      }
      return
    }
    delete (selectedItems as Record<string, unknown>)[category]
  }

  function clearOutfit() {
    Object.keys(selectedItems).forEach(key => {
      delete (selectedItems as Record<string, unknown>)[key]
    })
    resultImageUrl.value = ''
    generateStatus.value = 'idle'
    generateError.value = ''
    currentPrompt.value = ''
    isFallback.value = false
    generateReason.value = ''
  }

  function setGenerating() {
    generateStatus.value = 'generating'
    generateError.value = ''
    isFallback.value = false
    generateReason.value = ''
  }

  function setGenerateSuccess(url: string, fallback = false, reason = '') {
    resultImageUrl.value = url
    generateStatus.value = 'success'
    isFallback.value = fallback
    generateReason.value = reason
  }

  function setGenerateFailed(error: string) {
    generateStatus.value = 'failed'
    generateError.value = error
  }

  function hasSelectedItems(): boolean {
    return Object.values(selectedItems).some(value => {
      if (Array.isArray(value)) return value.length > 0
      return Boolean(value)
    })
  }

  return {
    selectedItems,
    resultImageUrl,
    generateStatus,
    generateError,
    currentPrompt,
    isFallback,
    generateReason,
    addItem,
    removeItem,
    clearOutfit,
    setGenerating,
    setGenerateSuccess,
    setGenerateFailed,
    hasSelectedItems,
  }
})
