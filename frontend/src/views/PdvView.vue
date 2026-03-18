<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import PaymentModal from '../components/PaymentModal.vue'
import PaymentErrorModal from '../components/PaymentErrorModal.vue'

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
const cart = ref<CartItem[]>([])
const discountAmount = ref(0)
const discountIsPercent = ref(true)
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

const showSangriaModal = ref(false)
const sangriaForm = ref({
  amount: 0,
  description: ''
})

const saveSangria = async () => {
  if (sangriaForm.value.amount <= 0) return
  try {
    const res = await fetch('/api/expenses', {
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
      fetch('/api/products'),
      fetch('/api/product-types'),
      fetch('/api/customers')
    ])
    if (pRes.ok) products.value = await pRes.json()
    if (tRes.ok) productTypes.value = await tRes.json()
    if (cRes.ok) {
      customers.value = await cRes.json()
      // Default to "Cliente Balcão" if exists
      const fallback = (customers.value as any[]).find(c => c.name.toLowerCase().includes('balcão'))
      if (fallback) selectedCustomerId.value = fallback.id
      else if (customers.value && customers.value.length > 0) selectedCustomerId.value = (customers.value[0] as any).id
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(fetchAll)

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
}

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
  return Math.max(0, subtotal.value - appliedDiscount.value)
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

    const orderData = {
      customerName: selectedCustomer?.name || 'Cliente Balcão',
      productDescription: description,
      amount: total.value,
      isPdv: true, // Triggers auto-DELIVERED & stock deduction backend side
      paymentMethod: selectedPaymentMethod.value,
      details: {
        items: cart.value.map(i => ({
          id: i.id,
          name: i.name,
          quantity: i.cartQuantity,
          unitPrice: i.unitPrice,
          hasStock: i.productType.hasStock
        })),
        subtotal: subtotal.value,
        discount: appliedDiscount.value
      }
    }

    const res = await fetch('/api/orders', {
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
  window.open(`/api/orders/${orderId}/receipt`, '_blank')
}

const confirmPix = (orderId: number) => {
  orderToPay.value = orderId
  isConfirmingPix.value = true
}

const payPix = async (orderId: number) => {
  isConfirmingPix.value = false
  try {
    const res = await fetch(`/api/payments/create/${orderId}?type=PIX`, {
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
  <div class="h-full flex flex-col lg:flex-row gap-6 bg-slate-50/50">
    
    <!-- Left: Store / Products -->
    <div class="flex-1 flex flex-col h-full bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
      <!-- PDV Header & Search -->
      <div class="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-black text-slate-800 tracking-tight">Frente de Caixa</h2>
          <p class="text-slate-500 text-sm font-medium">Venda rápida de insumos e serviços prontos.</p>
        </div>
        <div class="relative w-full md:w-72">
          <svg class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input v-model="searchQuery" type="text" placeholder="Buscar por nome..." class="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-bold bg-slate-50/50">
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="px-6 py-4 border-b border-slate-100 bg-slate-50/50 overflow-x-auto flex gap-2 no-scrollbar">
        <button
          @click="activeType = null"
          :class="['px-4 py-2 rounded-xl text-xs font-black transition-all border whitespace-nowrap', activeType === null ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'border-slate-200 text-slate-500 hover:border-slate-400 bg-white']"
        >
          Todos
        </button>
        <button
          v-for="type in productTypes" :key="type.id"
          @click="activeType = type.id"
          :class="['px-4 py-2 rounded-xl text-xs font-black transition-all border whitespace-nowrap flex items-center gap-2', activeType === type.id ? 'text-white border-transparent shadow-md' : 'border-slate-200 text-slate-500 hover:border-slate-400 bg-white']"
          :style="activeType === type.id ? { backgroundColor: type.color } : {}"
        >
          <span v-if="activeType !== type.id" class="w-2 h-2 rounded-full" :style="{ backgroundColor: type.color }"></span>
          {{ type.name }}
        </button>
      </div>

      <!-- Products Grid -->
      <div class="flex-1 overflow-y-auto p-6 bg-slate-50/20">
        <div v-if="loading" class="flex justify-center items-center h-full">
          <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        
        <div v-else-if="filteredProducts.length === 0" class="flex flex-col items-center justify-center h-full text-slate-400">
          <svg class="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
          <p class="font-bold">Nenhum produto encontrado</p>
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
          <button 
            v-for="product in filteredProducts" :key="product.id"
            @click="addToCart(product)"
            class="group text-left bg-white border border-slate-200 p-4 rounded-2xl hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-900/5 transition-all outline-none focus:ring-2 focus:ring-indigo-500 relative overflow-hidden"
          >
            <!-- Badge -->
            <div class="absolute top-0 right-0 w-8 h-8 bg-slate-100 rounded-bl-2xl opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-indigo-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            </div>
            
            <div class="w-2 h-2 rounded-full mb-3" :style="{ backgroundColor: product.productType.color }"></div>
            
            <h3 class="font-black text-slate-800 text-sm leading-tight mb-1 truncate">{{ product.name }}</h3>
            
            <div class="flex justify-between items-end mt-4">
              <div class="font-mono font-black text-indigo-600">R$ {{ product.unitPrice.toFixed(2) }}</div>
              <div v-if="product.productType.hasStock" :class="['text-[10px] font-bold px-1.5 py-0.5 rounded', product.stock > 0 ? 'bg-slate-100 text-slate-500' : 'bg-red-100 text-red-600']">
                {{ product.stock }} {{ product.unit }}
              </div>
              <div v-else class="text-[10px] text-slate-400 font-bold bg-slate-50 px-1.5 py-0.5 rounded">
                S/ Estq
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Right: Cart & Checkout -->
    <div class="w-full lg:w-[400px] xl:w-[480px] h-[80vh] lg:h-full flex flex-col bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden shrink-0 border border-slate-800 relative text-white">
      
      <!-- Cart Header -->
      <div class="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
        <h3 class="font-black text-lg flex items-center gap-2">
          <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          Carrinho
        </h3>
        <div class="flex items-center gap-3">
          <button @click="showSangriaModal = true" class="w-8 h-8 flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all" title="Retirada de Caixa (Sangria)">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2 17l10 5 10-5M2 12l10 5 10-5M12 2l10 5-10 5-10-5 10-5z"></path></svg>
          </button>
          <button v-if="cart.length > 0" @click="clearCart" class="text-xs font-black text-slate-400 hover:text-red-400 transition-colors">
            Limpar
          </button>
        </div>
      </div>

      <!-- Cart Items list -->
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        <div v-if="cart.length === 0" class="h-full flex flex-col justify-center items-center text-slate-500 space-y-3">
          <svg class="w-16 h-16 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
          <p class="font-bold">Carrinho vazio</p>
          <p class="text-xs">Selecione itens à esquerda para adicionar.</p>
        </div>

        <TransitionGroup name="list">
          <div v-for="item in cart" :key="item.id" class="bg-slate-800/80 p-3 rounded-2xl border border-white/5 flex flex-col justify-between group">
            <div class="flex justify-between items-start mb-3">
              <div class="pr-2">
                <h4 class="font-bold text-sm leading-tight text-white mb-0.5">{{ item.name }}</h4>
                <div class="text-[10px] text-slate-400 font-mono">
                  R$ {{ item.unitPrice.toFixed(2) }} / {{ item.unit }}
                </div>
              </div>
              <div class="text-right shrink-0 font-mono font-black text-indigo-300">
                R$ {{ (item.unitPrice * item.cartQuantity).toFixed(2) }}
              </div>
            </div>
            <div class="flex justify-between items-center bg-slate-900/50 rounded-xl p-1">
              <div class="flex items-center">
                <button @click="updateQuantity(item, -1)" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">-</button>
                <input 
                  type="number" 
                  v-model.number="item.cartQuantity"
                  @change="handleManualQuantity(item)"
                  class="w-12 bg-transparent text-center font-black text-sm font-mono border-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button @click="updateQuantity(item, 1)" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all">+</button>
              </div>
              <button @click="removeFromCart(item.id)" class="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          </div>
        </TransitionGroup>
      </div>

      <!-- Checkout Footer -->
      <div class="bg-indigo-950 p-6 rounded-t-[32px] border-t border-indigo-500/20 z-10">
        <!-- Customer & Discount -->
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-[10px] font-black text-indigo-300/60 uppercase tracking-widest mb-1.5">Cliente</label>
            <select v-model="selectedCustomerId" class="w-full px-3 py-2.5 rounded-xl border border-indigo-900/50 bg-indigo-900/30 text-white focus:border-indigo-400 outline-none text-xs font-bold appearance-none">
              <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div>
            <label class="flex items-center justify-between text-[10px] font-black text-indigo-300/60 uppercase tracking-widest mb-1.5 cursor-pointer">
              <span>Desconto</span>
              <span class="flex items-center gap-1 bg-indigo-900/40 px-1.5 py-0.5 rounded">
                <input type="checkbox" v-model="discountIsPercent" class="w-3 h-3 text-indigo-500 bg-indigo-900 border-indigo-700 rounded-sm">
                %
              </span>
            </label>
            <div class="relative">
              <span v-if="!discountIsPercent" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs font-bold">R$</span>
              <input v-model.number="discountAmount" type="number" step="0.01" min="0" :placeholder="discountIsPercent ? '0 %' : '0.00'" :class="['w-full py-2.5 rounded-xl border border-indigo-900/50 bg-indigo-900/30 text-white focus:border-indigo-400 outline-none text-xs font-bold font-mono transition-all', discountIsPercent ? 'px-3 text-right' : 'pl-8 pr-3']">
              <span v-if="discountIsPercent" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs font-bold">%</span>
            </div>
          </div>
        </div>

        <!-- Totals -->
        <div class="space-y-2 mb-6">
          <div v-if="discountAmount > 0" class="flex justify-between items-center text-sm text-indigo-300/80 px-1">
            <span>Subtotal</span>
            <span>R$ {{ subtotal.toFixed(2) }}</span>
          </div>
          <div v-if="discountAmount > 0" class="flex justify-between items-center text-sm text-emerald-400 px-1">
            <span>Desconto</span>
            <span>- R$ {{ appliedDiscount.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between items-end pt-2 border-t border-indigo-500/20 px-1">
            <span class="text-white font-bold">Total a Cobrar</span>
            <span class="text-3xl font-black text-indigo-300 font-mono">R$ {{ total.toFixed(2) }}</span>
          </div>
        </div>

        <!-- Payment Method -->
        <div class="mt-8 mb-6 space-y-3">
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Forma de Recebimento</span>
          <div class="grid grid-cols-3 gap-2.5">
            <button 
              v-for="m in [
                { id: 'DINHEIRO', label: 'Dinheiro', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7m0 0a1 1 0 011-1h2a1 1 0 011 1v1m-6 0a1 1 0 00-1-1H7a1 1 0 00-1 1v1' },
                { id: 'PIX', label: 'Pix', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
                { id: 'CARTÃO', label: 'Cartão', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' }
              ]" 
              :key="m.id"
              @click="selectedPaymentMethod = m.id"
              :class="['group flex flex-col items-center gap-2 py-4 rounded-2xl transition-all border-2', 
                selectedPaymentMethod === m.id 
                  ? 'bg-indigo-600 border-indigo-600 text-white' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-indigo-500 hover:bg-slate-800/80']"
            >
              <div :class="['w-8 h-8 rounded-xl flex items-center justify-center transition-colors', 
                selectedPaymentMethod === m.id ? 'bg-white/20' : 'bg-slate-700 group-hover:bg-indigo-900 group-hover:text-indigo-400']">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" :d="m.icon"></path>
                </svg>
              </div>
              <span class="text-[10px] font-black uppercase tracking-widest">{{ m.label }}</span>
            </button>
          </div>
        </div>

        <button 
          @click="finalizeSale"
          :disabled="cart.length === 0 || saving"
          class="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-2xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="saving" class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          {{ saving ? 'Processando...' : 'Finalizar Venda' }}
        </button>
      </div>
      
      <!-- Toast Overlay -->
      <Transition
        enter-active-class="transform transition ease-out duration-300"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition ease-in duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showToast" class="absolute top-6 left-1/2 -translate-x-1/2 p-3 bg-indigo-600/90 backdrop-blur border border-indigo-400/50 rounded-2xl flex flex-col items-center gap-3 text-white shadow-2xl z-50 min-w-[200px]">
          <span class="text-sm font-bold">{{ toastMessage }}</span>
          <button 
            v-if="lastOrderId" 
            @click="printReceipt(lastOrderId)"
            class="px-4 py-1.5 bg-white text-indigo-600 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors shadow-sm"
          >
            Imprimir Recibo
          </button>
          <button 
            v-if="lastOrderId" 
            @click="confirmPix(lastOrderId)"
            class="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-colors shadow-sm"
          >
            Pagar via Pix
          </button>
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

      <!-- Confirmation Modal Pix -->
      <div v-if="isConfirmingPix" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="isConfirmingPix = false"></div>
        <div class="bg-white w-full max-w-sm p-8 rounded-[32px] shadow-2xl relative z-10 text-center animate-in zoom-in-95 duration-200">
            <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7m0 0a1 1 0 011-1h2a1 1 0 011 1v1m-6 0a1 1 0 00-1-1H7a1 1 0 00-1 1v1"></path></svg>
            </div>
            <h3 class="text-xl font-black text-slate-800 mb-2">Gerar Pagamento Pix?</h3>
            <p class="text-slate-500 text-sm font-medium mb-8">Isso criará uma nova transação no Mercado Pago para este pedido.</p>
            <div class="flex gap-3">
              <button @click="isConfirmingPix = false" class="flex-1 py-3.5 px-4 rounded-2xl font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all active:scale-95 uppercase text-[10px] tracking-widest border border-transparent hover:border-slate-100">Cancelar</button>
              <button @click="payPix(orderToPay!)" class="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-black hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-emerald-500/30 uppercase text-[10px] tracking-widest">Confirmar</button>
            </div>
        </div>
      </div>

      <!-- Sangria Modal -->
      <div v-if="showSangriaModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/80 backdrop-blur-md" @click="showSangriaModal = false"></div>
        <div class="bg-white w-full max-w-sm rounded-[40px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
          <header class="p-8 border-b border-slate-100 text-center">
            <div class="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2 17l10 5 10-5M2 12l10 5 10-5M12 2l10 5-10 5-10-5 10-5z"></path></svg>
            </div>
            <h3 class="text-2xl font-black text-slate-900 leading-tight">Retirada de Caixa</h3>
            <p class="text-slate-500 text-sm font-medium">Registre uma saída rápida (Sangria).</p>
          </header>

          <form @submit.prevent="saveSangria" class="p-8 space-y-6">
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label>
                <input 
                  v-model.number="sangriaForm.amount"
                  type="number" 
                  step="0.01"
                  required
                  autofocus
                  class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-2xl font-black text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                />
              </div>

              <div class="space-y-2">
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                <input 
                  v-model="sangriaForm.description"
                  type="text" 
                  placeholder="Ex: Almoço, Troco..."
                  class="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700"
                />
              </div>
            </div>

            <div class="flex gap-3 pt-2">
              <button 
                type="button"
                @click="showSangriaModal = false"
                class="flex-1 py-4 border border-slate-100 text-slate-400 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase text-[10px] tracking-widest"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                class="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all active:scale-95 uppercase text-[10px] tracking-widest"
              >
                Confirmar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>

  <!-- Payment Error Modal -->
  <PaymentErrorModal :is-open="isErrorModalOpen" @close="isErrorModalOpen = false" />
</template>

<style scoped>
/* List transitions for cart items */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
input[type=number] {
  -moz-appearance: textfield;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

button:active {
  transform: scale(0.98);
}
</style>
