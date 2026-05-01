<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, computed, onMounted, watch } from 'vue'
import { useUiStore } from '../stores/ui'
import { useAuthStore } from '../stores/auth'
import { usePlanStore } from '../stores/plan'
import { useToast } from '../composables/useToast'

const ui = useUiStore()
const authStore = useAuthStore()
const { showToast } = useToast()

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

const isEditing = computed(() => !!ui.editingEstimate)

const triggerToast = (msg: string) => {
  toastMessage.value = msg
  showSuccessToast.value = true
  setTimeout(() => { showSuccessToast.value = false }, 4000)
}

const selectedPaperId = ref<number | null>(null)
const selectedFinishingId = ref<number | null>(null)
const selectedCustomerId = ref<number | null>(null)
const customerSearch = ref('')
const showCustomerDropdown = ref(false)
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
      apiFetch('/api/products?page=1&limit=200'),
      apiFetch('/api/customers?page=1&limit=200')
    ])

    if (pRes.ok) {
      const pd = await pRes.json()
      const allProducts: Product[] = Array.isArray(pd) ? pd : (pd.data ?? [])
      papers.value = allProducts.filter(p => p.productType?.hasStock)
      finishings.value = allProducts.filter(p => !p.productType?.hasStock)
      if (papers.value.length > 0 && !isEditing.value) selectedPaperId.value = papers.value[0]!.id
    }

    if (cRes.ok) {
      const cd = await cRes.json()
      customers.value = Array.isArray(cd) ? cd : (cd.data ?? [])
      const fallback = customers.value.find(c => c.name.toLowerCase().includes('balcão'))
      if (!isEditing.value) {
        if (fallback) { selectedCustomerId.value = fallback.id; customerSearch.value = fallback.name }
        else if (customers.value.length > 0) { selectedCustomerId.value = customers.value[0]!.id; customerSearch.value = customers.value[0]!.name }
      }
    }

    if (isEditing.value) loadEditingData()

  } catch (e) {
    console.error('Error fetching data', e)
  } finally {
    loading.value = false
  }
}

const selectedPaper = computed(() => papers.value.find(p => p.id === selectedPaperId.value))
const selectedFinishing = computed(() => finishings.value.find(f => f.id === selectedFinishingId.value))

const filteredCustomers = computed(() => {
  const q = customerSearch.value.toLowerCase().trim()
  if (!q) return customers.value
  return customers.value.filter(c => c.name.toLowerCase().includes(q))
})

const selectCustomer = (c: Customer) => {
  selectedCustomerId.value = c.id
  customerSearch.value = c.name
  showCustomerDropdown.value = false
}

const handleCustomerBlur = () => {
  setTimeout(() => { showCustomerDropdown.value = false }, 150)
}

watch(customerSearch, (newVal) => {
  const currentCustomer = customers.value.find(c => c.id === selectedCustomerId.value)
  if (currentCustomer && currentCustomer.name !== newVal) {
    selectedCustomerId.value = null
  }
})

const calculation = computed(() => {
  if (!selectedPaper.value) return { paperCost: 0, finishingCost: 0, paperSell: 0, finishingSell: 0, total: 0, totalMargin: 0 }
  const areaM2 = (width.value / 100) * (height.value / 100) * quantity.value
  const paperCost = areaM2 * selectedPaper.value.unitPrice
  const paperMargin = (selectedPaper.value.markup ?? 100) / 100
  const paperSell = paperCost * (1 + paperMargin)
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
    showToast('Selecione um cliente primeiro.', 'warning')
    return
  }

  saving.value = true
  try {
    const estimateData = {
      customerId: selectedCustomerId.value,
      totalPrice: calculation.value.total,
      salespersonId: authStore.user?.id,
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
    const url = isEditing.value ? `/api/estimates/${ui.editingEstimate.id}` : '/api/estimates'

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(estimateData)
    })

    if (res.ok) {
      const savedEstimate = await res.json()
      lastEstimateId.value = savedEstimate.id
      if (convertToOrder) await handleConvertToOrder(savedEstimate.id)
      else triggerToast(isEditing.value ? 'Orçamento atualizado!' : 'Orçamento salvo com sucesso!')
    }
  } catch (e) {
    console.error('Error saving estimate', e)
  } finally {
    saving.value = false
  }
}

const handleConvertToOrder = async (estimateId: number) => {
  try {
    const res = await apiFetch(`/api/estimates/${estimateId}/convert`, { method: 'POST' })
    if (res.ok) {
      triggerToast('Pedido gerado e enviado para produção!')
      setTimeout(() => ui.setTab('board'), 1500)
    }
  } catch (e) {
    console.error('Error converting to order', e)
  }
}

const plan = usePlanStore()

const generatePDF = () => {
  if (!plan.hasPdf) {
    plan.setLimitError('Geração de PDF não disponível no plano atual.')
    return
  }
  if (!lastEstimateId.value) {
    showToast('Salve o orçamento primeiro para gerar o PDF.', 'warning')
    return
  }
  const token = localStorage.getItem('gp_token') || ''
  window.open(`/api/estimates/${lastEstimateId.value}/pdf?token=${token}`, '_blank')
}

onMounted(fetchInitialData)
</script>

<template>
  <div class="max-w-7xl mx-auto px-6 py-8 space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div>
        <h1 class="text-xl font-medium text-slate-900">
          {{ isEditing ? 'Editar orçamento' : 'Calculadora de orçamento' }}
        </h1>
        <p class="text-sm text-slate-500 mt-1">
          {{ isEditing ? `Editando #ORC-${ui.editingEstimate.id}` : 'Calcule preços e gere orçamentos para clientes' }}
        </p>
      </div>
      <button
        @click="generatePDF"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-4 py-2 transition-colors"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        Gerar PDF
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
    </div>

    <!-- Grid: Form + Resumo -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Form -->
      <div class="lg:col-span-2 space-y-5">
        <!-- Informações do pedido -->
        <section class="border border-slate-200 rounded-xl overflow-hidden">
          <header class="px-5 py-3 border-b border-slate-200">
            <h3 class="text-sm font-medium text-slate-900">Informações do pedido</h3>
          </header>
          <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="relative">
              <label class="block text-xs text-slate-500 mb-1.5">Cliente</label>
              <input
                v-model="customerSearch"
                @focus="showCustomerDropdown = true"
                @input="showCustomerDropdown = true"
                @click="showCustomerDropdown = true"
                @blur="handleCustomerBlur"
                type="text"
                placeholder="Buscar cliente..."
                class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors"
              />
              <div v-if="showCustomerDropdown && filteredCustomers.length > 0"
                   class="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                <button
                  v-for="c in filteredCustomers"
                  :key="c.id"
                  @mousedown.prevent="selectCustomer(c)"
                  class="w-full text-left px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >{{ c.name }}</button>
              </div>
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Nome do produto</label>
              <input
                v-model="productName"
                type="text"
                placeholder="Ex: Panfleto promocional"
                class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors"
              />
            </div>
          </div>
        </section>

        <!-- Especificações -->
        <section class="border border-slate-200 rounded-xl overflow-hidden">
          <header class="px-5 py-3 border-b border-slate-200">
            <h3 class="text-sm font-medium text-slate-900">Especificações técnicas</h3>
          </header>
          <div class="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Quantidade</label>
              <input v-model.number="quantity" type="number" class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Largura (cm)</label>
              <input v-model.number="width" type="number" class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Altura (cm)</label>
              <input v-model.number="height" type="number" class="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Cores</label>
              <select v-model="colors" class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 transition-colors bg-white">
                <option value="4x0">4x0 (frente)</option>
                <option value="4x4">4x4 (frente e verso)</option>
                <option value="1x0">1x0 (preto)</option>
              </select>
            </div>
          </div>
        </section>

        <!-- Material + Acabamento -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <section class="border border-slate-200 rounded-xl overflow-hidden">
            <header class="px-5 py-3 border-b border-slate-200">
              <h3 class="text-sm font-medium text-slate-900">Mídia / material</h3>
            </header>
            <div class="p-3 space-y-1.5 max-h-80 overflow-y-auto">
              <label v-for="paper in papers" :key="paper.id"
                :class="['flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedPaperId === paper.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300']">
                <div class="flex items-center gap-2.5 min-w-0">
                  <input type="radio" :value="paper.id" v-model="selectedPaperId" class="w-3.5 h-3.5 text-slate-900 focus:ring-slate-400 border-slate-300" />
                  <div class="min-w-0">
                    <div class="text-sm text-slate-800 truncate">{{ paper.name }}</div>
                    <div class="text-[10px] text-slate-400">{{ paper.productType?.name }}</div>
                  </div>
                </div>
                <span class="text-[11px] text-slate-500 shrink-0">R$ {{ paper.unitPrice.toFixed(2) }}/{{ paper.unit }}</span>
              </label>
            </div>
          </section>

          <section class="border border-slate-200 rounded-xl overflow-hidden">
            <header class="px-5 py-3 border-b border-slate-200">
              <h3 class="text-sm font-medium text-slate-900">Serviços / acabamento</h3>
            </header>
            <div class="p-3 space-y-1.5 max-h-80 overflow-y-auto">
              <label :class="['flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors',
                selectedFinishingId === null ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300']">
                <input type="radio" :value="null" v-model="selectedFinishingId" class="w-3.5 h-3.5 text-slate-900 focus:ring-slate-400 border-slate-300" />
                <span class="text-sm text-slate-800">Sem acabamento</span>
              </label>
              <label v-for="fin in finishings" :key="fin.id"
                :class="['flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                  selectedFinishingId === fin.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300']">
                <div class="flex items-center gap-2.5 min-w-0">
                  <input type="radio" :value="fin.id" v-model="selectedFinishingId" class="w-3.5 h-3.5 text-slate-900 focus:ring-slate-400 border-slate-300" />
                  <span class="text-sm text-slate-800 truncate">{{ fin.name }}</span>
                </div>
                <span class="text-[11px] text-slate-500 shrink-0">R$ {{ fin.unitPrice.toFixed(2) }}/un</span>
              </label>
            </div>
          </section>
        </div>
      </div>

      <!-- Resumo -->
      <div class="lg:col-span-1">
        <div class="border border-slate-200 rounded-xl overflow-hidden sticky top-6">
          <header class="px-5 py-3 border-b border-slate-200">
            <h3 class="text-sm font-medium text-slate-900">Resumo do orçamento</h3>
          </header>

          <div class="p-5 space-y-3">
            <div class="flex items-center justify-between text-sm">
              <span class="text-slate-500">Custo de materiais</span>
              <span class="text-slate-900">R$ {{ calculation.paperCost.toFixed(2) }}</span>
            </div>
            <div v-if="calculation.finishingCost > 0" class="flex items-center justify-between text-sm">
              <span class="text-slate-500">Custo de serviços</span>
              <span class="text-slate-900">R$ {{ calculation.finishingCost.toFixed(2) }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-slate-500">Margem de lucro</span>
              <span style="color:#1D9E75">+{{ calculation.totalMargin }}%</span>
            </div>

            <div class="pt-4 border-t border-slate-100">
              <div class="text-xs text-slate-500 mb-1">Total sugerido</div>
              <div class="text-3xl font-medium" style="color:#1D9E75">
                R$ {{ calculation.total.toFixed(2) }}
              </div>
            </div>
          </div>

          <div class="p-5 pt-0 space-y-2">
            <button
              @click="handleSaveEstimate(false)"
              :disabled="saving"
              class="w-full inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-medium border border-slate-200 rounded-lg py-2.5 transition-colors"
            >
              <span v-if="saving" class="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"></span>
              <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
              {{ isEditing ? 'Atualizar orçamento' : 'Salvar orçamento' }}
            </button>
            <button
              @click="handleSaveEstimate(true)"
              :disabled="saving"
              class="w-full inline-flex items-center justify-center gap-2 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
              style="background:#1D9E75"
              onmouseover="this.style.background='#0F6E56'"
              onmouseout="this.style.background='#1D9E75'"
            >
              <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin"></span>
              <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Aprovar e gerar pedido
            </button>

            <Transition
              enter-active-class="transition-all duration-200"
              enter-from-class="translate-y-1 opacity-0"
              enter-to-class="translate-y-0 opacity-100"
              leave-active-class="transition-opacity duration-150"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <div v-if="showSuccessToast" class="mt-1 flex items-center gap-2 p-2.5 rounded-lg text-xs" style="background:#E1F5EE; color:#0F6E56">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                {{ toastMessage }}
              </div>
            </Transition>

            <p class="text-[11px] text-slate-400 mt-3 text-center leading-relaxed">
              O total já inclui a margem configurada individualmente para cada material e serviço.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
