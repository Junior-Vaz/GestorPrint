import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const currentTab = ref('home')
  const editingEstimate = ref<any>(null)

  const setTab = (tab: string, data: any = null) => {
    currentTab.value = tab
    if (tab === 'calculator' && data) {
      editingEstimate.value = data
    } else if (tab === 'calculator' && !data) {
       // Clear if just clicking "New"
       editingEstimate.value = null
    }
  }

  return {
    currentTab,
    editingEstimate,
    setTab
  }
})
