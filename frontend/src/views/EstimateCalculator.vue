<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()

interface Product {
  id: number;
  name: string;
  typeId: number;
  productType: { id: number; name: string; color: string; hasStock: boolean };
  unitPrice: number;
  unit: string;
  markup: number;
}

interface Customer {
  id: number;
  name: string;
}

const papers = ref<Product[]>([])
const finishings = ref<Product[]>([])
const customers = ref<Customer[]>([])
const loading = ref(true)
const saving = ref(false)
const showSuccessToast = ref(false)
const toastMessage = ref('')
const lastEstimateId = ref<number | null>(null)

// Editing state
const isEditing = computed(() => !!ui.editingEstimate)

const triggerToast = (msg: string) => {
  toastMessage.value = msg
  showSuccessToast.value = true
  setTimeout(() => { showSuccessToast.value = false }, 4000)
}

// Form state
const selectedPaperId = ref<number | null>(null)
const selectedFinishingId = ref<number | null>(null)
const selectedCustomerId = ref<number | null>(null)
const quantity = ref(100)
const width = ref(10)
const height = ref(15)
const colors = ref('4x0')
const productName = ref('Cartão de Visita')

const loadEditingData = () => {
  if (ui.editingEstimate) {
    const e = ui.editingEstimate
    selectedCustomerId.value = e.customerId
    productName.value = e.details.productName
    quantity.value = e.details.quantity
    width.value = e.details.width
    height.value = e.details.height
    colors.value = e.details.colors
    
    // Attempt to match paper by name or just use the first one if not found
    const paper = papers.value.find(p => p.name === e.details.paperName)
    if (paper) selectedPaperId.value = paper.id
    
    const fin = finishings.value.find(p => p.name === e.details.finishingName)
    if (fin) selectedFinishingId.value = fin.id
    
    lastEstimateId.value = e.id
  }
}

const fetchInitialData = async () => {
  loading.value = true
  try {
    const [pRes, cRes] = await Promise.all([
      fetch('http://localhost:3000/api/products'),
      fetch('http://localhost:3000/api/customers')
    ])
    
    if (pRes.ok) {
      const allProducts: Product[] = await pRes.json()
      // Products with stock = raw materials (paper, ink) → 'media' selector
      papers.value = allProducts.filter(p => p.productType?.hasStock)
      // Products without stock = services/finishings charged per unit
      finishings.value = allProducts.filter(p => !p.productType?.hasStock)
      if (papers.value.length > 0 && !isEditing.value) selectedPaperId.value = papers.value[0].id
    }

    if (cRes.ok) {
      customers.value = await cRes.json()
      if (customers.value.length > 0 && !isEditing.value) selectedCustomerId.value = customers.value[0].id
    }

    // Load data if editing
    if (isEditing.value) loadEditingData()
    
  } catch (e) {
    console.error('Error fetching data', e)
  } finally {
    loading.value = false
  }
}

const selectedPaper = computed(() => papers.value.find(p => p.id === selectedPaperId.value))
const selectedFinishing = computed(() => finishings.value.find(f => f.id === selectedFinishingId.value))

const calculation = computed(() => {
  if (!selectedPaper.value) return { paperCost: 0, finishingCost: 0, paperSell: 0, finishingSell: 0, total: 0, totalMargin: 0 }

  // Area in m²
  const areaM2 = (width.value / 100) * (height.value / 100) * quantity.value

  // Paper: cost + its own profit margin
  const paperCost = areaM2 * selectedPaper.value.unitPrice
  const paperMargin = (selectedPaper.value.markup ?? 100) / 100  // default 100% if not configured
  const paperSell = paperCost * (1 + paperMargin)

  // Finishing/Service: cost per unit + its own margin
  const finishingCost = selectedFinishing.value ? (quantity.value * selectedFinishing.value.unitPrice) : 0
  const finishingMargin = selectedFinishing.value ? ((selectedFinishing.value.markup ?? 80) / 100) : 0
  const finishingSell = finishingCost * (1 + finishingMargin)

  const total = paperSell + finishingSell
  const baseCost = paperCost + finishingCost
  const totalMargin = baseCost > 0 ? Math.round(((total - baseCost) / baseCost) * 100) : 0

  return { paperCost, finishingCost, paperSell, finishingSell, total, totalMargin }
})

const handleSaveEstimate = async (convertToOrder = false) => {
  if (!selectedCustomerId.value) {
    alert('Selecione um cliente primeiro')
    return
  }

  saving.value = true
  try {
    const estimateData = {
      customerId: selectedCustomerId.value,
      totalPrice: calculation.value.total,
      details: {
        productName: productName.value,
        width: width.value,
        height: height.value,
        quantity: quantity.value,
        colors: colors.value,
        paperName: selectedPaper.value?.name,
        finishingName: selectedFinishing.value?.name
      }
    }

    const method = isEditing.value ? 'PATCH' : 'POST'
    const url = isEditing.value 
      ? `http://localhost:3000/api/estimates/${ui.editingEstimate.id}`
      : 'http://localhost:3000/api/estimates'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(estimateData)
    })

    if (res.ok) {
      const savedEstimate = await res.json()
      lastEstimateId.value = savedEstimate.id
      
      if (convertToOrder) {
        await handleConvertToOrder(savedEstimate.id)
      } else {
        triggerToast(isEditing.value ? 'Orçamento atualizado!' : 'Orçamento salvo com sucesso!')
      }
    }
  } catch (e) {
    console.error('Error saving estimate', e)
  } finally {
    saving.value = false
  }
}

const handleConvertToOrder = async (estimateId: number) => {
  try {
    const res = await fetch(`http://localhost:3000/api/estimates/${estimateId}/convert`, {
      method: 'POST'
    })
    if (res.ok) {
      triggerToast('Pedido gerado e enviado para produção!')
      setTimeout(() => ui.setTab('board'), 1500)
    }
  } catch (e) {
    console.error('Error converting to order', e)
  }
}

const generatePDF = () => {
  if (!lastEstimateId.value) {
    alert('Por favor, salve o orçamento primeiro para gerar o documento PDF oficial.')
    return
  }
  window.open(`http://localhost:3000/api/estimates/${lastEstimateId.value}/pdf`, '_blank')
}

onMounted(fetchInitialData)
</script>

<template>
  <div class="h-full flex flex-col space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold text-slate-800 tracking-tight">
          {{ isEditing ? 'Editar Orçamento' : 'Simulador de Orçamento' }}
        </h2>
        <p class="text-slate-500 text-sm">
          {{ isEditing ? `Editando ref #ORC-${ui.editingEstimate.id}` : 'Calcule custos de impressão em tempo real.' }}
        </p>
      </div>
      <div class="flex gap-2">
        <button @click="generatePDF" class="p-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white transition-all">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
      <!-- Form Section -->
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          
          <!-- Basic Info -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cliente</label>
              <select v-model="selectedCustomerId" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-slate-50/50">
                <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nome do Produto</label>
              <input v-model="productName" type="text" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-slate-50/50" placeholder="Ex: Panfleto Promocional">
            </div>
          </div>

          <!-- Specs -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Qtd</label>
              <input v-model.number="quantity" type="number" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-slate-50/50">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">L (cm)</label>
              <input v-model.number="width" type="number" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-slate-50/50">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">A (cm)</label>
              <input v-model.number="height" type="number" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-slate-50/50">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cores</label>
              <select v-model="colors" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-slate-50/50">
                <option value="4x0">4x0 (Frente)</option>
                <option value="4x4">4x4 (Frente/Verso)</option>
                <option value="1x0">1x0 (Preto)</option>
              </select>
            </div>
          </div>

          <!-- Materials -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div>
              <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Mídia / Material</label>
              <div class="space-y-2">
                <label v-for="paper in papers" :key="paper.id" 
                  :class="['flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all', 
                    selectedPaperId === paper.id ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-slate-100 hover:border-slate-300 bg-slate-50/30']">
                  <div class="flex items-center gap-3">
                    <input type="radio" :value="paper.id" v-model="selectedPaperId" class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300">
                    <div>
                      <span class="text-sm font-semibold text-slate-700">{{ paper.name }}</span>
                      <span class="ml-2 text-[9px] font-black px-1.5 py-0.5 rounded text-white" :style="{ backgroundColor: paper.productType?.color || '#6366f1' }">{{ paper.productType?.name }}</span>
                    </div>
                  </div>
                  <span class="text-[10px] font-bold text-slate-400">R$ {{ paper.unitPrice.toFixed(2) }}/{{ paper.unit }}</span>
                </label>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Serviços / Acabamento</label>
              <div class="space-y-2">
                <label 
                  :class="['flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all', 
                    selectedFinishingId === null ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-slate-100 hover:border-slate-300 bg-slate-50/30']">
                  <div class="flex items-center gap-3">
                    <input type="radio" :value="null" v-model="selectedFinishingId" class="w-4 h-4 text-indigo-600">
                    <span class="text-sm font-semibold text-slate-700">Sem Acabamento</span>
                  </div>
                </label>
                <label v-for="fin in finishings" :key="fin.id" 
                  :class="['flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all', 
                    selectedFinishingId === fin.id ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' : 'border-slate-100 hover:border-slate-300 bg-slate-50/30']">
                  <div class="flex items-center gap-3">
                    <input type="radio" :value="fin.id" v-model="selectedFinishingId" class="w-4 h-4 text-indigo-600">
                    <span class="text-sm font-semibold text-slate-700">{{ fin.name }}</span>
                  </div>
                  <span class="text-[10px] font-bold text-slate-400">R$ {{ fin.unitPrice.toFixed(2) }}/un</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Result Card -->
      <div class="lg:col-span-1">
        <div class="bg-slate-900 rounded-3xl p-8 text-white sticky top-8 shadow-xl shadow-indigo-900/20">
          <h3 class="text-indigo-400 text-xs font-bold uppercase tracking-widest mb-6">Resumo do Orçamento</h3>
          
          <div class="space-y-4 mb-8">
            <div class="flex justify-between items-end border-b border-slate-800 pb-4">
              <span class="text-slate-400 text-sm">Custo de Materiais</span>
              <span class="font-mono text-lg font-bold">R$ {{ calculation.paperCost.toFixed(2) }}</span>
            </div>
            <div v-if="calculation.finishingCost > 0" class="flex justify-between items-end border-b border-slate-800 pb-4">
              <span class="text-slate-400 text-sm">Custo de Serviços</span>
              <span class="font-mono text-lg font-bold">R$ {{ calculation.finishingCost.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between items-end border-b border-slate-800 pb-4">
              <span class="text-slate-400 text-sm">Margem de Lucro Ativa</span>
              <span class="font-mono text-lg font-bold text-emerald-400">+{{ calculation.totalMargin }}%</span>
            </div>
            <div class="flex justify-between items-end pt-2">
              <span class="text-white font-bold">Total Sugerido</span>
              <span class="text-3xl font-black text-indigo-400 font-mono">R$ {{ calculation.total.toFixed(2) }}</span>
            </div>
          </div>

          <div class="space-y-3">
            <button 
              @click="handleSaveEstimate(false)"
              :disabled="saving"
              class="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 border border-slate-700 active:scale-95 disabled:opacity-50"
            >
              <span v-if="saving" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
              {{ isEditing ? 'Atualizar Orçamento' : 'Salvar Orçamento' }}
            </button>
            <button 
              @click="handleSaveEstimate(true)"
              :disabled="saving"
              class="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <span v-if="saving" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Aprovar e Gerar Pedido
            </button>
          </div>

          <!-- Toast feedback -->
          <Transition
            enter-active-class="transform transition ease-out duration-300"
            enter-from-class="translate-y-2 opacity-0"
            enter-to-class="translate-y-0 opacity-100"
            leave-active-class="transition ease-in duration-200"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="showSuccessToast" class="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
              {{ toastMessage }}
            </div>
          </Transition>

          <p class="text-[10px] text-slate-500 mt-6 text-center leading-relaxed">
            * O Total Sugerido já inclui a "Margem de Lucro (%)" configurada individualmente para cada material ou serviço utilizado.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
