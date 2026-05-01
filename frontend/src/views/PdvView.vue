<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted, computed, watch } from 'vue'
import PaymentModal from '../components/shared/PaymentModal.vue'
import PaymentErrorModal from '../components/shared/PaymentErrorModal.vue'
import { useAuthStore } from '../stores/auth'
import { usePermissionsStore } from '../stores/permissions'
import { usePlanStore } from '../stores/plan'

const authStore = useAuthStore()
const perms = usePermissionsStore()
const plan = usePlanStore()
const isErrorModalOpen = ref(false)

interface ProductType {
  id: number
  name: string
  color: string
  hasStock: boolean
}

interface Product {
  id: number
  name: string
  typeId: number
  productType: ProductType
  unitPrice: number
  stock: number
  unit: string
}

interface Customer {
  id: number
  name: string
  phone: string | null
}

interface CartItem extends Product {
  cartQuantity: number
}

const products = ref<Product[]>([])
const productTypes = ref<ProductType[]>([])
const customers = ref<Customer[]>([])
const loading = ref(true)
const saving = ref(false)

const searchQuery = ref('')
const activeType = ref<number | null>(null)
const selectedCustomerId = ref<number | null>(null)
const customerSearch = ref('')
const showCustomerDropdown = ref(false)
const cart = ref<CartItem[]>([])
const discountAmount = ref(0)
const discountIsPercent = ref(true)

// ── Programa de Fidelidade — saldo do cliente + resgate aplicado nesta venda ──
// loyaltySummary: saldo + tier + valor do ponto. Carregado quando cliente é
//   selecionado (silentOn403 — se feature off ou sem permissão, ignoramos).
// applyPoints/applyCashback: o que o operador escolheu aplicar nesta venda.
//   Persistido só localmente até o checkout — backend valida saldo de novo.
interface LoyaltyTierConfig { name: string; minSpend: number; discount: number; pointsMultiplier: number }
interface LoyaltyCustomerSummary {
  loyaltyPoints: number
  loyaltyBalance: number
  loyaltyTier: string | null
  pointsValue: number
  tierConfig: LoyaltyTierConfig | null
}
const loyaltySummary = ref<LoyaltyCustomerSummary | null>(null)
// loyaltyConfig agora também carrega `enabled` — usado pra esconder o card
// quando o admin DESATIVA o programa mesmo com plano que libera a feature.
// Sem esse check, gráficas que desligam fidelidade temporariamente ainda
// veriam o card no PDV.
const loyaltyConfig = ref<{ realsPerPoint: number; minRedeemPoints: number; enabled: boolean } | null>(null)
const applyPoints = ref(0)
const applyCashback = ref(0)
const loyaltyExpanded = ref(false)
// canUseLoyalty: 3 condições devem ser true:
//  1. Plano libera a feature (BASIC+)
//  2. User tem permissão de criar pedido (resgate é parte do checkout)
//  3. Tenant ATIVOU o programa em ERP → Fidelidade → toggle "Programa ativo"
const canUseLoyalty = computed(() =>
  plan.hasLoyalty
  && perms.can.create('orders')
  && loyaltyConfig.value?.enabled === true
)
const selectedPaymentMethod = ref('DINHEIRO')
const lastOrderId = ref<number | null>(null)
const paymentUrl = ref('')
const isPaymentModalOpen = ref(false)
const pixQrCode = ref('')
const pixQrCodeBase64 = ref('')
const paymentAmount = ref(0)
const currentTransactionId = ref<number | null>(null)
const isConfirmingPix = ref(false)
const orderToPay = ref<number | null>(null)
const isIntegrated = ref(true) // Default to true, check on mount

const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

const showSangriaModal = ref(false)
const sangriaForm = ref({
  amount: 0,
  description: ''
})

const saveSangria = async () => {
  if (sangriaForm.value.amount <= 0) return
  try {
    const res = await apiFetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: `Sangria PDV: ${sangriaForm.value.description || 'Retirada de Caixa'}`,
        amount: sangriaForm.value.amount,
        category: 'Sangria',
        date: new Date().toISOString()
      })
    })
    if (res.ok) {
      showSangriaModal.value = false
      sangriaForm.value = { amount: 0, description: '' }
      triggerToast('Sangria registrada com sucesso! 💸')
    }
  } catch (e) {
    console.error('Error saving sangria', e)
    triggerToast('Erro ao registrar sangria.')
  }
}

// Notifications
const showToast = ref(false)
const toastMessage = ref('')
const triggerToast = (msg: string) => {
  toastMessage.value = msg
  showToast.value = true
  setTimeout(() => showToast.value = false, 3000)
}

// Data Fetching
const fetchAll = async () => {
  loading.value = true
  try {
    const [pRes, tRes, cRes] = await Promise.all([
      apiFetch('/api/products?page=1&limit=200'),
      apiFetch('/api/product-types'),
      apiFetch('/api/customers?page=1&limit=200')
    ])
    if (pRes.ok) {
      const pd = await pRes.json()
      products.value = Array.isArray(pd) ? pd : (pd.data ?? [])
    }
    if (tRes.ok) productTypes.value = await tRes.json()
    if (cRes.ok) {
      const cd = await cRes.json()
      customers.value = Array.isArray(cd) ? cd : (cd.data ?? [])
      // Default to "Cliente Balcão" if exists
      const fallback = (customers.value as any[]).find(c => c.name.toLowerCase().includes('balcão'))
      if (fallback) { selectedCustomerId.value = fallback.id; customerSearch.value = fallback.name }
      else if (customers.value && customers.value.length > 0) { selectedCustomerId.value = (customers.value[0] as any).id; customerSearch.value = (customers.value[0] as any).name }
    }

    // Check integration status
    const statusRes = await apiFetch('/api/payments/config-status')
    if (statusRes.ok) {
      const statusData = await statusRes.json()
      isIntegrated.value = statusData.integrated
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchAll()
  // Plan store é carregado pelo App.vue no boot — se já carregou, busca config
  // imediato; se não, watch reativo cobre quando carregar.
  if (!plan.data) await plan.load()
  await loadLoyaltyConfig()
  // Após config carregar, força reload do summary do cliente já selecionado.
  // Sem isso, o boot do PDV setou cliente antes da config existir e o
  // watcher de selectedCustomerId saiu cedo (canUseLoyalty=false).
  if (canUseLoyalty.value && selectedCustomerId.value) {
    loadCustomerLoyalty(selectedCustomerId.value)
  }
})

// Recarrega config se o plano carregar depois (boot lento) e liberar o feature
watch(() => plan.hasLoyalty, (val) => { if (val && !loyaltyConfig.value) loadLoyaltyConfig() })

// Customer search (same pattern as EstimateCalculator)
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
  setTimeout(() => {
    showCustomerDropdown.value = false
  }, 150)
}

// Clear ID if search text is manually changed (to force fresh selection)
watch(customerSearch, (newVal) => {
  const currentCustomer = customers.value.find(c => c.id === selectedCustomerId.value)
  if (currentCustomer && currentCustomer.name !== newVal) {
    selectedCustomerId.value = null
  }
})

// Computed
const filteredProducts = computed(() => {
  let result = products.value

  // Tab filter
  if (activeType.value !== null) {
    result = result.filter(p => p.typeId === activeType.value)
  }

  // Search filter
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p => p.name.toLowerCase().includes(q))
  }

  return result
})

// Cart Logic
const addToCart = (product: Product) => {
  const existing = cart.value.find(item => item.id === product.id)

  // Optional: Prevent adding more than stock if it's a stocked item
  if (product.productType.hasStock) {
    const currentQty = existing ? existing.cartQuantity : 0
    if (currentQty >= product.stock) {
      triggerToast(`Estoque insuficiente de ${product.name}`)
      return
    }
  }

  if (existing) {
    existing.cartQuantity++
  } else {
    cart.value.push({ ...product, cartQuantity: 1 })
  }
}

const updateQuantity = (item: CartItem, delta: number) => {
  if (delta > 0 && item.productType.hasStock && item.cartQuantity >= item.stock) {
    triggerToast(`Estoque insuficiente de ${item.name}`)
    return
  }

  const newQty = item.cartQuantity + delta
  if (newQty <= 0) {
    removeFromCart(item.id)
  } else {
    item.cartQuantity = newQty
  }
}

const removeFromCart = (id: number) => {
  cart.value = cart.value.filter(item => item.id !== id)
}

const handleManualQuantity = (item: CartItem) => {
  if (item.cartQuantity < 1) {
    item.cartQuantity = 1
  }

  if (item.productType.hasStock && item.cartQuantity > item.stock) {
    triggerToast(`Estoque insuficiente de ${item.name} (${item.stock} disponíveis)`)
    item.cartQuantity = item.stock
  }
}

const clearCart = () => {
  cart.value = []
  discountAmount.value = 0
  applyPoints.value = 0
  applyCashback.value = 0
}

// Carrega config global de fidelidade uma única vez ao montar.
// IMPORTANTE: NÃO checamos `canUseLoyalty` aqui — `canUseLoyalty` depende do
// próprio `loyaltyConfig.enabled`, então criaria deadlock (config nunca carrega
// porque canUseLoyalty é false porque config não carregou). Em vez disso,
// checamos só o plano + permissão (condições estáveis do user).
async function loadLoyaltyConfig() {
  if (!plan.hasLoyalty || !perms.can.create('orders')) return
  const res = await apiFetch('/api/loyalty/config', { silentOn403: true })
  if (res.ok) {
    const cfg = await res.json()
    loyaltyConfig.value = {
      realsPerPoint: cfg.realsPerPoint || 0.05,
      minRedeemPoints: cfg.minRedeemPoints || 0,
      enabled: cfg.enabled === true,
    }
  }
}

// Quando o operador troca de cliente no PDV, busca saldo. Reset dos valores
// aplicados (pontos do cliente A não devem aparecer pra cliente B).
async function loadCustomerLoyalty(customerId: number | null) {
  applyPoints.value = 0
  applyCashback.value = 0
  loyaltySummary.value = null
  if (!customerId || !canUseLoyalty.value) return
  const res = await apiFetch(`/api/loyalty/customers/${customerId}/summary`, { silentOn403: true })
  if (res.ok) loyaltySummary.value = await res.json()
}

watch(selectedCustomerId, (id) => loadCustomerLoyalty(id))

// Desconto vindo do resgate de pontos/cashback — soma com o desconto manual.
const loyaltyDiscount = computed(() => {
  if (!loyaltyConfig.value) return 0
  const fromPoints = (applyPoints.value || 0) * loyaltyConfig.value.realsPerPoint
  return +(fromPoints + (applyCashback.value || 0)).toFixed(2)
})

// Valor máximo de pontos resgatáveis: limitado pelo saldo, pelo subtotal
// e pelo mínimo configurado. Idem cashback.
const maxRedeemablePoints = computed(() => {
  if (!loyaltySummary.value || !loyaltyConfig.value) return 0
  const fromSubtotal = Math.floor(subtotal.value / loyaltyConfig.value.realsPerPoint)
  const lim = Math.min(loyaltySummary.value.loyaltyPoints, fromSubtotal)
  return lim >= loyaltyConfig.value.minRedeemPoints ? lim : 0
})
const maxRedeemableCashback = computed(() => {
  if (!loyaltySummary.value) return 0
  return Math.min(loyaltySummary.value.loyaltyBalance, subtotal.value)
})

// Financials
const subtotal = computed(() => {
  return cart.value.reduce((acc, item) => acc + (item.unitPrice * item.cartQuantity), 0)
})

const appliedDiscount = computed(() => {
  // Always positive or 0
  const val = Math.max(0, discountAmount.value || 0)
  if (discountIsPercent.value) {
    return subtotal.value * (val / 100)
  }
  return val
})

const total = computed(() => {
  // Resgate de fidelidade entra como mais um desconto somado ao manual.
  return Math.max(0, subtotal.value - appliedDiscount.value - loyaltyDiscount.value)
})

// Checkout
const finalizeSale = async () => {
  if (cart.value.length === 0) return
  if (!selectedCustomerId.value) {
    triggerToast('Selecione um cliente!')
    return
  }

  saving.value = true
  try {
    const selectedCustomer = customers.value.find(c => c.id === selectedCustomerId.value)

    // Build cart description for Kanban card view (even though it's DELIVERED)
    const itemsDesc = cart.value.map(i => `${i.cartQuantity}x ${i.name}`).join(', ')
    const description = `PDV: ${itemsDesc}`

    const orderData: any = {
      // customerId: ID do cliente selecionado pelo dropdown — backend usa esse
      // pra resolver direto, sem ambiguidade de findOrCreateByName quando há
      // clientes homônimos. customerName fica como fallback de display.
      customerId: selectedCustomerId.value,
      customerName: selectedCustomer?.name || 'Cliente Balcão',
      productDescription: description,
      amount: total.value,
      isPdv: true, // Triggers auto-DELIVERED & stock deduction backend side
      paymentMethod: selectedPaymentMethod.value,
      salespersonId: authStore.user?.id,
      producerId: authStore.user?.id,
      details: {
        items: cart.value.map(i => ({
          id: i.id,
          name: i.name,
          quantity: i.cartQuantity,
          unitPrice: i.unitPrice,
          hasStock: i.productType.hasStock
        })),
        subtotal: subtotal.value,
        discount: appliedDiscount.value,
        loyaltyDiscount: loyaltyDiscount.value,
      }
    }
    // Inclui resgate só se houver — backend trata zeros mas evita ruído no DTO.
    if (applyPoints.value > 0)   orderData.pointsRedeemed   = applyPoints.value
    if (applyCashback.value > 0) orderData.cashbackRedeemed = applyCashback.value

    const res = await apiFetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    })

    if (res.ok) {
      const createdOrder = await res.json()
      lastOrderId.value = createdOrder.id
      triggerToast('Venda finalizada com sucesso! 🎉')
      clearCart()
      await fetchAll() // Refresh stock levels in the product grid
    } else {
      const err = await res.json()
      triggerToast(err.message || 'Erro ao finalizar venda.')
    }
  } catch (e) {
    console.error(e)
    triggerToast('Erro de conexão ao finalizar.')
  } finally {
    saving.value = false
  }
}

const printReceipt = (orderId: number) => {
  const token = localStorage.getItem('gp_token') || ''
  window.open(`/api/orders/${orderId}/receipt?token=${token}`, '_blank')
}

const confirmPix = (orderId: number) => {
  orderToPay.value = orderId
  isConfirmingPix.value = true
}

const payPix = async (orderId: number) => {
  isConfirmingPix.value = false
  try {
    const res = await apiFetch(`/api/payments/create/${orderId}?type=PIX`, {
      method: 'POST'
    })
    if (res.status === 500) {
      isErrorModalOpen.value = true
      return
    }
    if (res.ok) {
      const transaction = await res.json()
      if (transaction.paymentUrl) {
        paymentUrl.value = transaction.paymentUrl
        pixQrCode.value = transaction.qrCode || ''
        pixQrCodeBase64.value = transaction.qrCodeBase64 || ''
        paymentAmount.value = transaction.amount || 0
        currentTransactionId.value = transaction.id
        isPaymentModalOpen.value = true
      }
    }
  } catch (e) {
    console.error('Error generating PIX', e)
    isErrorModalOpen.value = true
  }
}
</script>

<template>
  <div class="min-h-full bg-white">
    <div class="mx-auto max-w-[1320px] px-4 md:px-8 pt-2 pb-10">

      <!-- Contexto + status -->
      <div class="flex items-center justify-between mb-6 gap-4">
        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900 truncate">{{ authStore.user?.name || 'Operador' }}</div>
          <div class="text-xs text-slate-500 mt-0.5 capitalize">{{ todayLabel }}</div>
        </div>
        <div class="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
          <span :class="['w-1.5 h-1.5 rounded-full', isIntegrated ? 'bg-emerald-500' : 'bg-red-500']"></span>
          Mercado Pago {{ isIntegrated ? 'online' : 'offline' }}
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 min-h-[calc(100vh-200px)]">

        <!-- ── Coluna esquerda: produtos ─────────────────────── -->
        <section class="flex flex-col">
          <!-- Busca -->
          <div class="mb-4">
            <div class="relative">
              <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Buscar produto…"
                class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400 transition-colors"
              />
            </div>
          </div>

          <!-- Categorias -->
          <div class="flex gap-2 overflow-x-auto no-scrollbar mb-5 pb-1">
            <button
              @click="activeType = null"
              :class="['shrink-0 px-3.5 py-1.5 rounded-full text-xs transition-colors border',
                activeType === null
                  ? 'bg-slate-900 text-white border-slate-900 font-medium'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50']"
            >
              Todos
            </button>
            <button
              v-for="type in productTypes" :key="type.id"
              @click="activeType = type.id"
              :class="['shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs transition-colors border',
                activeType === type.id
                  ? 'bg-slate-900 text-white border-slate-900 font-medium'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50']"
            >
              <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: type.color }"></span>
              {{ type.name }}
            </button>
          </div>

          <!-- Grid de produtos -->
          <div class="flex-1 overflow-y-auto">
            <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              <div v-for="i in 8" :key="`pl${i}`" class="bg-white border border-slate-200 rounded-lg p-4">
                <div class="w-2 h-2 rounded-full bg-slate-100 mb-3 animate-pulse"></div>
                <div class="h-3.5 bg-slate-100 rounded animate-pulse w-3/4 mb-3"></div>
                <div class="flex items-center justify-between mt-4">
                  <div class="h-4 bg-slate-100 rounded animate-pulse w-16"></div>
                  <div class="h-3 bg-slate-50 rounded animate-pulse w-10"></div>
                </div>
              </div>
            </div>

            <div v-else-if="filteredProducts.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
              <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              </div>
              <div class="text-sm text-slate-500">Nenhum produto encontrado</div>
            </div>

            <div v-else class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
              <button
                v-for="product in filteredProducts" :key="product.id"
                @click="addToCart(product)"
                class="group text-left bg-white border border-slate-200 hover:border-slate-300 p-4 rounded-lg transition-colors outline-none"
              >
                <div class="flex items-center justify-between mb-3">
                  <span class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: product.productType.color }"></span>
                  <svg class="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"/></svg>
                </div>

                <h3 class="text-sm font-medium text-slate-900 leading-tight truncate mb-3">{{ product.name }}</h3>

                <div class="flex items-baseline justify-between">
                  <span class="text-base font-medium text-slate-900">R$ {{ product.unitPrice.toFixed(2) }}</span>
                  <span v-if="product.productType.hasStock" :class="['text-[11px]', product.stock > 0 ? 'text-slate-400' : 'text-red-600']">
                    {{ product.stock }} {{ product.unit }}
                  </span>
                  <span v-else class="text-[11px] text-slate-400">—</span>
                </div>
              </button>
            </div>
          </div>
        </section>

        <!-- ── Coluna direita: carrinho ───────────────────────── -->
        <aside class="bg-slate-50 rounded-2xl border border-slate-200 flex flex-col h-fit lg:sticky lg:top-2 max-h-[calc(100vh-120px)]">

          <!-- Header do carrinho -->
          <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="text-base font-medium text-slate-900">Carrinho</div>
              <span v-if="cart.length" class="text-xs text-slate-400">{{ cart.length }}</span>
            </div>
            <div class="flex items-center gap-1">
              <button
                v-if="perms.can.create('pdv')"
                @click="showSangriaModal = true"
                class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Sangria / Retirada de caixa"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2 17l10 5 10-5M2 12l10 5 10-5M12 2l10 5-10 5-10-5 10-5z"/></svg>
              </button>
              <button
                v-if="cart.length > 0"
                @click="clearCart"
                class="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>

          <!-- Itens -->
          <div class="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
            <div v-if="cart.length === 0" class="h-full flex flex-col items-center justify-center py-10 text-center gap-2">
              <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
              </div>
              <div class="text-sm text-slate-500">Carrinho vazio</div>
              <div class="text-xs text-slate-400">Selecione produtos ao lado</div>
            </div>

            <TransitionGroup name="list">
              <div v-for="item in cart" :key="item.id" class="bg-white border border-slate-200 rounded-lg p-3">
                <div class="flex justify-between items-start gap-2 mb-3">
                  <div class="min-w-0">
                    <div class="text-sm text-slate-900 font-medium truncate">{{ item.name }}</div>
                    <div class="text-[11px] text-slate-400 mt-0.5">R$ {{ item.unitPrice.toFixed(2) }} / {{ item.unit }}</div>
                  </div>
                  <div class="text-sm font-medium text-slate-900 shrink-0">R$ {{ (item.unitPrice * item.cartQuantity).toFixed(2) }}</div>
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1 bg-slate-50 rounded-md">
                    <button @click="updateQuantity(item, -1)" class="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors">&minus;</button>
                    <input
                      type="number"
                      v-model.number="item.cartQuantity"
                      @change="handleManualQuantity(item)"
                      class="w-10 bg-transparent text-center text-sm text-slate-900 border-none focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button @click="updateQuantity(item, 1)" class="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors">+</button>
                  </div>
                  <button @click="removeFromCart(item.id)" class="p-1 text-slate-400 hover:text-red-600 transition-colors" title="Remover">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            </TransitionGroup>
          </div>

          <!-- Checkout -->
          <div class="px-5 py-4 border-t border-slate-200 space-y-4">

            <!-- Cliente + Desconto -->
            <div class="grid grid-cols-2 gap-3">
              <div class="relative">
                <label class="text-[11px] text-slate-500 mb-1 block">Cliente</label>
                <input
                  v-model="customerSearch"
                  @focus="showCustomerDropdown = true"
                  @input="showCustomerDropdown = true"
                  @click="showCustomerDropdown = true"
                  @blur="handleCustomerBlur"
                  type="text"
                  placeholder="Buscar…"
                  class="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-slate-400 transition-colors"
                />
                <div v-if="showCustomerDropdown && filteredCustomers.length > 0" class="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-lg z-50 max-h-48 overflow-y-auto">
                  <button
                    v-for="c in filteredCustomers"
                    :key="c.id"
                    @mousedown.prevent="selectCustomer(c)"
                    class="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                  >{{ c.name }}</button>
                </div>
              </div>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[11px] text-slate-500">Desconto</label>
                  <label class="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                    <input type="checkbox" v-model="discountIsPercent" class="w-3 h-3 rounded-sm accent-slate-900">
                    %
                  </label>
                </div>
                <div class="relative">
                  <span v-if="!discountIsPercent" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
                  <input
                    v-model.number="discountAmount"
                    type="number" step="0.01" min="0"
                    :placeholder="discountIsPercent ? '0' : '0,00'"
                    :class="['w-full py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-slate-400 transition-colors', discountIsPercent ? 'px-2.5 text-right' : 'pl-7 pr-2.5']"
                  />
                  <span v-if="discountIsPercent" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                </div>
              </div>
            </div>

            <!-- Programa de Fidelidade — aparece sempre que feature liberada
                 + cliente selecionado, mesmo sem saldo (mostra estado vazio
                 educativo). Não aparece pra Cliente Balcão (sem id). -->
            <div v-if="canUseLoyalty && selectedCustomerId"
                 class="border border-violet-200 bg-violet-50 rounded-lg p-2.5">
              <button @click="loyaltyExpanded = !loyaltyExpanded" type="button"
                      class="w-full flex items-center justify-between gap-2 text-left">
                <div class="flex items-center gap-2 min-w-0">
                  <svg class="w-3.5 h-3.5 text-violet-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                  <span class="text-[11px] font-semibold text-violet-900 uppercase tracking-wider">Fidelidade</span>
                  <span v-if="loyaltySummary" class="text-[11px] text-violet-700 truncate">
                    <template v-if="loyaltySummary.loyaltyPoints > 0 || loyaltySummary.loyaltyBalance > 0">
                      {{ loyaltySummary.loyaltyPoints.toLocaleString('pt-BR') }} pts
                      <span v-if="loyaltySummary.loyaltyBalance > 0"> · R$ {{ loyaltySummary.loyaltyBalance.toFixed(2) }}</span>
                    </template>
                    <template v-else>
                      <span class="italic text-violet-500">Sem saldo</span>
                    </template>
                  </span>
                  <span v-else class="text-[11px] text-violet-500 italic">Carregando…</span>
                </div>
                <svg :class="['w-3 h-3 text-violet-600 transition-transform shrink-0', loyaltyExpanded ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </button>

              <div v-if="loyaltyExpanded" class="mt-2.5 space-y-2 pt-2 border-t border-violet-200">
                <!-- Estado vazio: cliente ainda não tem saldo -->
                <p v-if="loyaltySummary && loyaltySummary.loyaltyPoints === 0 && loyaltySummary.loyaltyBalance === 0"
                   class="text-[11px] text-violet-700 leading-relaxed">
                  Este cliente ainda não acumulou pontos ou cashback. O saldo será creditado automaticamente quando pedidos forem marcados como finalizados/entregues.
                </p>
                <!-- Aplicar pontos -->
                <div v-if="maxRedeemablePoints > 0">
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-[11px] text-violet-800">Aplicar pontos (máx: {{ maxRedeemablePoints.toLocaleString('pt-BR') }})</label>
                    <button v-if="applyPoints !== maxRedeemablePoints" @click="applyPoints = maxRedeemablePoints" type="button"
                            class="text-[10px] text-violet-700 hover:text-violet-900 font-medium">Usar máximo</button>
                  </div>
                  <input v-model.number="applyPoints" type="number" min="0" :max="maxRedeemablePoints"
                         placeholder="0"
                         class="w-full px-2.5 py-1.5 rounded-md border border-violet-200 bg-white text-xs text-violet-900 focus:outline-none focus:border-violet-400" />
                </div>
                <!-- Aplicar cashback -->
                <div v-if="maxRedeemableCashback > 0">
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-[11px] text-violet-800">Aplicar cashback (máx: R$ {{ maxRedeemableCashback.toFixed(2) }})</label>
                    <button v-if="applyCashback !== maxRedeemableCashback" @click="applyCashback = maxRedeemableCashback" type="button"
                            class="text-[10px] text-violet-700 hover:text-violet-900 font-medium">Usar máximo</button>
                  </div>
                  <input v-model.number="applyCashback" type="number" min="0" step="0.01" :max="maxRedeemableCashback"
                         placeholder="0,00"
                         class="w-full px-2.5 py-1.5 rounded-md border border-violet-200 bg-white text-xs text-violet-900 focus:outline-none focus:border-violet-400" />
                </div>
                <!-- Cliente tem saldo mas abaixo do mínimo configurado -->
                <p v-if="loyaltySummary && loyaltySummary.loyaltyPoints > 0 && maxRedeemablePoints === 0 && maxRedeemableCashback === 0"
                   class="text-[11px] text-violet-700 italic">
                  Saldo abaixo do mínimo pra resgate ou subtotal insuficiente.
                </p>
                <p v-if="loyaltyDiscount > 0" class="text-[11px] text-violet-700 font-medium">
                  Desconto aplicado: R$ {{ loyaltyDiscount.toFixed(2) }}
                </p>
              </div>
            </div>

            <!-- Totais -->
            <div class="space-y-1.5 text-sm">
              <div v-if="discountAmount > 0 || loyaltyDiscount > 0" class="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>R$ {{ subtotal.toFixed(2) }}</span>
              </div>
              <div v-if="discountAmount > 0" class="flex justify-between" style="color:#1D9E75">
                <span>Desconto</span>
                <span>&minus; R$ {{ appliedDiscount.toFixed(2) }}</span>
              </div>
              <div v-if="loyaltyDiscount > 0" class="flex justify-between text-violet-700">
                <span>Resgate fidelidade</span>
                <span>&minus; R$ {{ loyaltyDiscount.toFixed(2) }}</span>
              </div>
              <div class="flex justify-between items-baseline p-3 rounded-lg" style="background-color:#E1F5EE">
                <div class="flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full" style="background:#1D9E75"></span>
                  <span class="text-xs" style="color:#0F6E56">Total a receber</span>
                </div>
                <span class="text-2xl font-medium" style="color:#0F6E56">R$ {{ total.toFixed(2) }}</span>
              </div>
            </div>

            <!-- Forma de pagamento -->
            <div>
              <div class="text-[11px] text-slate-500 mb-2">Forma de recebimento</div>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="m in [
                    { id: 'DINHEIRO', label: 'Dinheiro', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7m0 0a1 1 0 011-1h2a1 1 0 011 1v1m-6 0a1 1 0 00-1-1H7a1 1 0 00-1 1v1' },
                    { id: 'PIX', label: 'Pix', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
                    { id: 'CARTÃO', label: 'Cartão', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' }
                  ]"
                  :key="m.id"
                  @click="selectedPaymentMethod = m.id"
                  :class="['flex flex-col items-center gap-1 py-2.5 rounded-lg border transition-colors bg-white',
                    selectedPaymentMethod === m.id
                      ? (m.id === 'PIX' ? 'border-2 text-[color:#0F6E56]' : 'border-slate-900 text-slate-900')
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-900']"
                  :style="selectedPaymentMethod === m.id && m.id === 'PIX' ? { borderColor: '#1D9E75', backgroundColor: '#E1F5EE' } : {}"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="m.icon"/>
                  </svg>
                  <span class="text-[11px]">{{ m.label }}</span>
                </button>
              </div>
            </div>

            <!-- Finalizar -->
            <button
              v-if="perms.can.create('pdv')"
              @click="finalizeSale"
              :disabled="cart.length === 0 || saving"
              class="w-full py-3 rounded-full bg-[#1D9E75] hover:bg-[#0F6E56] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1D9E75]"
            >
              <span v-if="saving" class="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></span>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              {{ saving ? 'Processando…' : 'Finalizar venda' }}
            </button>
          </div>

          <!-- Toast -->
          <Transition
            enter-active-class="transition ease-out duration-200"
            enter-from-class="translate-y-2 opacity-0"
            enter-to-class="translate-y-0 opacity-100"
            leave-active-class="transition ease-in duration-150"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="showToast" class="absolute -top-3 left-1/2 -translate-x-1/2 -translate-y-full px-4 py-3 bg-slate-900 text-white rounded-xl flex flex-col items-center gap-2 z-50 min-w-[220px]">
              <span class="text-sm">{{ toastMessage }}</span>
              <div v-if="lastOrderId" class="flex items-center gap-2">
                <button
                  @click="printReceipt(lastOrderId)"
                  class="px-3 py-1 bg-white text-slate-900 rounded-full text-xs font-medium hover:bg-slate-100 transition-colors"
                >
                  Imprimir recibo
                </button>
                <button
                  @click="confirmPix(lastOrderId)"
                  class="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-xs font-medium transition-colors"
                >
                  Pagar Pix
                </button>
              </div>
            </div>
          </Transition>

          <!-- Payment Modal -->
          <PaymentModal
            :url="paymentUrl"
            :qr-code="pixQrCode"
            :qr-code-base64="pixQrCodeBase64"
            :amount="paymentAmount"
            :transaction-id="currentTransactionId || undefined"
            :is-open="isPaymentModalOpen"
            @close="isPaymentModalOpen = false"
            @paid="triggerToast('Pagamento confirmado!')"
          />

          <!-- PIX Confirm Modal -->
          <div v-if="isConfirmingPix" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-slate-900/40" @click="isConfirmingPix = false"></div>
            <div class="bg-white w-full max-w-sm p-6 rounded-2xl border border-slate-200 relative z-10 text-center">
              <div class="w-11 h-11 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7"/></svg>
              </div>
              <h3 class="text-base font-medium text-slate-900 mb-2">Gerar pagamento Pix?</h3>
              <p class="text-sm text-slate-500 mb-6 leading-relaxed">Isso cria uma nova transação no Mercado Pago para este pedido.</p>
              <div class="flex gap-2">
                <button @click="isConfirmingPix = false" class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button @click="payPix(orderToPay!)" class="flex-1 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors">Confirmar</button>
              </div>
            </div>
          </div>

          <!-- Sangria Modal -->
          <div v-if="showSangriaModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-slate-900/40" @click="showSangriaModal = false"></div>
            <div class="bg-white w-full max-w-sm rounded-2xl border border-slate-200 relative z-10 overflow-hidden">
              <header class="p-6 border-b border-slate-100 text-center">
                <div class="w-11 h-11 bg-red-50 text-red-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2 17l10 5 10-5M2 12l10 5 10-5M12 2l10 5-10 5-10-5 10-5z"/></svg>
                </div>
                <h3 class="text-base font-medium text-slate-900">Retirada de caixa</h3>
                <p class="text-xs text-slate-500 mt-1">Registre uma sangria rápida.</p>
              </header>

              <form @submit.prevent="saveSangria" class="p-6 space-y-4">
                <div>
                  <label class="text-[11px] text-slate-500 mb-1 block">Valor (R$)</label>
                  <input
                    v-model.number="sangriaForm.amount"
                    type="number"
                    step="0.01"
                    required
                    autofocus
                    class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-lg text-slate-900 focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div>
                  <label class="text-[11px] text-slate-500 mb-1 block">Descrição</label>
                  <input
                    v-model="sangriaForm.description"
                    type="text"
                    placeholder="Ex: almoço, troco…"
                    class="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 transition-colors"
                  />
                </div>

                <div class="flex gap-2 pt-1">
                  <button
                    type="button"
                    @click="showSangriaModal = false"
                    class="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    class="flex-1 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </aside>

      </div>
    </div>

    <!-- Payment Error Modal -->
    <PaymentErrorModal :show="isErrorModalOpen" @close="isErrorModalOpen = false" />
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active { transition: all 0.2s ease; }
.list-enter-from { opacity: 0; transform: translateX(8px); }
.list-leave-to { opacity: 0; transform: translateX(-8px); }

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type=number] { -moz-appearance: textfield; }

.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
