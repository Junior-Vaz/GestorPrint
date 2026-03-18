<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { io, Socket } from 'socket.io-client'
import draggable from 'vuedraggable'
import PaymentModal from './PaymentModal.vue'
import PaymentErrorModal from './PaymentErrorModal.vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const showStockWarningModal = ref(false)

interface Order {
  id: number;
  customerName: string;
  customerPhone?: string;
  amount: number;
  status: string;
  salesperson?: { id: number, name: string };
  producer?: { id: number, name: string };
  createdAt: string;
  attachments?: any[];
}

const socket = ref<Socket | null>(null)
const orders = ref<Order[]>([])
const selectedOrder = ref<Order | null>(null)
const isModalOpen = ref(false)
const drag = ref(false)
const searchQuery = ref('')
const connectionStatus = ref('Desconectado')
const loading = ref(true)
const paymentUrl = ref('')
const isPaymentModalOpen = ref(false)
const payingOrderId = ref<number | null>(null)
const pixQrCode = ref('')
const pixQrCodeBase64 = ref('')
const paymentAmount = ref(0)
const currentTransactionId = ref<number | null>(null)
const isConfirmingPix = ref(false)
const orderToPay = ref<number | null>(null)
const verifyingOrderId = ref<number | null>(null)
const isIntegrated = ref(true)

// New modal refs
const isErrorModalOpen = ref(false)
const isConfirmingDelete = ref(false)
const orderToDelete = ref<number | null>(null)

// Notifications
const showToast = ref(false)
const toastMessage = ref('')
const triggerToast = (msg: string) => {
  toastMessage.value = msg
  showToast.value = true
  setTimeout(() => showToast.value = false, 3000)
}

const filteredOrders = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return orders.value
  return orders.value.filter(o => 
    o.customerName.toLowerCase().includes(query) || 
    o.productDescription.toLowerCase().includes(query) ||
    o.id.toString().includes(query)
  )
})

// Computed columns for draggable
const pendingOrders = computed({
  get: () => filteredOrders.value.filter(o => o.status === 'PENDING'),
  set: (val) => updateOrderStatusLocal(val, 'PENDING')
})

const productionOrders = computed({
  get: () => filteredOrders.value.filter(o => o.status === 'PRODUCTION'),
  set: (val) => updateOrderStatusLocal(val, 'PRODUCTION')
})

const finishedOrders = computed({
  get: () => filteredOrders.value.filter(o => o.status === 'FINISHED'),
  set: (val) => updateOrderStatusLocal(val, 'FINISHED')
})

const deliveredOrders = computed({
  get: () => filteredOrders.value.filter(o => o.status === 'DELIVERED'),
  set: (val) => updateOrderStatusLocal(val, 'DELIVERED')
})

const columns = computed(() => [
  { id: 'PENDING', name: 'Pendentes', color: 'bg-slate-400', orders: pendingOrders },
  { id: 'PRODUCTION', name: 'Produção', color: 'bg-amber-500', orders: productionOrders },
  { id: 'FINISHED', name: 'Finalizado', color: 'bg-emerald-500', orders: finishedOrders },
  { id: 'DELIVERED', name: 'Entregues', color: 'bg-indigo-600', orders: deliveredOrders }
])

const updateOrderStatusLocal = async (newOrders: Order[], newStatus: string) => {
  const movedOrder = newOrders.find(o => o.status !== newStatus);
  
  if (movedOrder) {
    const oldStatus = movedOrder.status;
    movedOrder.status = newStatus;
    
    try {
      const payload: any = { status: newStatus }
      
      // Auto-assign producer & Show warning if moving to PRODUCTION
      if (newStatus === 'PRODUCTION') {
        payload.producerId = authStore.user?.id
        showStockWarningModal.value = true
      }
      
      const res = await fetch(`/api/orders/${movedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to update status');
    } catch (e) {
      console.error('Error updating order status', e);
      movedOrder.status = oldStatus;
    }
  }
}

onMounted(async () => {
  try {
    const res = await fetch('/api/orders');
    if (res.ok) {
      orders.value = await res.json()
    }
  } catch(e) {
    console.error('Failed to fetch initial orders', e)
  } finally {
    loading.value = false
  }

  // Check integration status
  const statusRes = await fetch('/api/payments/config-status')
  if (statusRes.ok) {
    const statusData = await statusRes.json()
    isIntegrated.value = statusData.integrated
  }

  socket.value = io()
  socket.value.on('connect', () => connectionStatus.value = 'ON')
  socket.value.on('disconnect', () => connectionStatus.value = 'OFF')
  socket.value.on('new_order', (newOrder: Order) => {
    if (!orders.value.find(o => o.id === newOrder.id)) orders.value.push(newOrder)
  })
  socket.value.on('order_updated', (updatedOrder: any) => {
    const index = orders.value.findIndex(o => o.id === updatedOrder.id)
    if (index > -1) {
      const existing = orders.value[index]
      // Merge intelligently: preserve attachments if the update doesn't have them
      const attachments = (updatedOrder.attachments && updatedOrder.attachments.length > 0) 
        ? updatedOrder.attachments 
        : existing.attachments;
        
      orders.value[index] = { 
        ...existing, 
        ...updatedOrder,
        attachments: attachments || []
      }
      
      // Update selectedOrder if it's the same one
      if (selectedOrder.value && selectedOrder.value.id === updatedOrder.id) {
        selectedOrder.value = { ...selectedOrder.value, ...updatedOrder, attachments: attachments || [] }
      }
      
      // If the paying order was just paid, close the payment modal
      if (payingOrderId.value === updatedOrder.id && updatedOrder.status === 'PRODUCTION') {
        isPaymentModalOpen.value = false
        payingOrderId.value = null
      }
    }
  })
})

onUnmounted(() => {
  if (socket.value) socket.value.disconnect()
})

// Função de teste removida conforme solicitação do usuário

const confirmPix = (orderId: number) => {
  orderToPay.value = orderId
  isConfirmingPix.value = true
}

const generatePix = async (orderId: number) => {
  isConfirmingPix.value = false
  try {
    const res = await fetch(`/api/payments/create/${orderId}?type=PIX`, {
      method: 'POST'
    })
    if (res.status === 500) {
      isErrorModalOpen.value = true;
      return;
    }
    if (res.ok) {
      const transaction = await res.json()
      if (transaction.paymentUrl) {
        paymentUrl.value = transaction.paymentUrl
        pixQrCode.value = transaction.qrCode || ''
        pixQrCodeBase64.value = transaction.qrCodeBase64 || ''
        paymentAmount.value = transaction.amount || 0
        currentTransactionId.value = transaction.id
        payingOrderId.value = orderId
        isPaymentModalOpen.value = true
      }
    }
  } catch (e) {
    console.error('Error generating PIX', e)
  }
}

const verifyPaymentDirectly = async (orderId: number) => {
  if (verifyingOrderId.value) return
  verifyingOrderId.value = orderId
  try {
    const orderRes = await fetch(`/api/orders/${orderId}`)
    if (orderRes.ok) {
      const orderData = await orderRes.json()
      const lastTx = orderData.transactions?.find((t: any) => t.status === 'PENDING')
      if (lastTx) {
        const res = await fetch(`/api/payments/check/${lastTx.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'PAID') {
            triggerToast('Pagamento confirmado!')
          } else {
            triggerToast('Pagamento ainda pendente.')
          }
        }
      } else {
        triggerToast('Nenhum Pix gerado para este pedido.')
      }
    }
  } catch (e) {
    console.error('Error verifying directly', e)
    triggerToast('Erro ao verificar pagamento.')
  } finally {
    verifyingOrderId.value = null
  }
}

const startDeleteOrder = (id: number) => {
  orderToDelete.value = id;
  isConfirmingDelete.value = true;
}

const confirmDeleteOrder = async () => {
  if (!orderToDelete.value) return;
  try {
    const res = await fetch(`/api/orders/${orderToDelete.value}`, { method: 'DELETE' })
    if (res.ok) {
      orders.value = orders.value.filter(o => o.id !== orderToDelete.value)
      triggerToast('Pedido excluído com sucesso!')
      if (selectedOrder.value?.id === orderToDelete.value) {
        isModalOpen.value = false;
      }
    }
  } catch (e) {
    console.error('Error deleting order', e)
    triggerToast('Erro ao excluir pedido.')
  } finally {
    isConfirmingDelete.value = false;
    orderToDelete.value = null;
  }
}

const triggerUpload = (orderId: number) => {
  const input = document.getElementById(`file-input-${orderId}`) as HTMLInputElement;
  if (input) input.click();
}

const handleFileUpload = async (event: any, orderId: number) => {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`/api/files/upload/${orderId}`, {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const newAttachment = await res.json();
      const order = orders.value.find(o => o.id === orderId);
      if (order) {
        if (!order.attachments) order.attachments = [];
        order.attachments.push(newAttachment);
      }
    }
  } catch (e) {
    console.error('Upload failed', e);
  }
}

const downloadFile = (filename: string) => {
  window.open(`/api/files/${filename}`, '_blank');
}

const deleteAttachment = async (id: number, orderId: number) => {
  try {
    const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const order = orders.value.find(o => o.id === orderId);
      if (order && order.attachments) {
        order.attachments = order.attachments.filter(a => a.id !== id);
      }
    }
  } catch (e) {
    console.error('Delete attachment failed', e);
  }
}

const openWhatsApp = (order: Order) => {
  if (!order.customerPhone) {
    alert('Cliente não possui telefone cadastrado.')
    return
  }
  
  const phone = order.customerPhone.replace(/\D/g, '')
  let msg = `Olá ${order.customerName}, aqui é da GestorPrint! `
  
  if (order.status === 'PENDING') msg += `Recebemos seu pedido #${order.id} (${order.productDescription}). Vamos iniciar em breve!`
  if (order.status === 'PRODUCTION') msg += `Seu pedido #${order.id} já está em produção! 🚀`
  if (order.status === 'FINISHED') msg += `Boas notícias! Seu pedido #${order.id} está pronto para retirada. ✅`
  if (order.status === 'DELIVERED') msg += `Seu pedido #${order.id} foi entregue. Esperamos que tenha gostado! 😊`
  
  window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, '_blank')
}

const openOrderDetails = (order: Order) => {
  selectedOrder.value = order
  isModalOpen.value = true
}

const downloadReceipt = (orderId: number) => {
  window.open(`/api/orders/${orderId}/receipt`, '_blank');
}

const closeOrderDetails = () => {
  isModalOpen.value = false
  selectedOrder.value = null
}

const getPreviewUrl = (filename: string) => {
  return `/api/files/${filename}`
}

const isImage = (mimetype: string) => {
  return mimetype.startsWith('image/')
}

const isPDF = (mimetype: string) => {
  return mimetype === 'application/pdf'
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Topbar -->
    <header class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 shrink-0">
      <div>
        <h2 class="text-2xl font-black text-slate-900 tracking-tight">Painel de Produção</h2>
        <p class="text-slate-500 text-xs font-medium">Acompanhe e mova os pedidos em tempo real.</p>
      </div>
      
      <div class="flex flex-wrap items-center gap-4">
        <!-- Search bar -->
        <div class="relative min-w-[300px]">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Buscar por cliente ou produto..."
            class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
          />
        </div>

        <div :class="['flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest border rounded-xl shadow-sm transition-all', isIntegrated ? 'bg-white text-slate-500 border-slate-200' : 'bg-red-50 text-red-600 border-red-100 animate-pulse']">
          <div :class="['w-2 h-2 rounded-full', isIntegrated ? 'bg-emerald-500' : 'bg-red-500']"></div>
          Mercado Pago {{ isIntegrated ? 'ON' : 'OFF' }}
        </div>

        <div class="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div class="w-2 h-2 rounded-full" :class="connectionStatus === 'ON' ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-red-500'"></div>
          Socket {{ connectionStatus }}
        </div>
      </div>
    </header>

    <!-- Kanban -->
    <div class="flex-1 overflow-x-auto pb-4">
      <div class="flex gap-6 h-full items-start min-w-[1024px]">
        <div v-for="col in columns" :key="col.id" class="flex flex-col w-80 max-h-full bg-slate-100/70 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          
          <div class="p-4 border-b border-slate-200 bg-slate-100/80 flex justify-between items-center shrink-0">
            <h3 class="font-extrabold text-slate-700 flex items-center gap-2 text-xs uppercase tracking-widest">
              <span :class="['w-2 h-2 rounded-full', col.color]"></span> {{ col.name }}
            </h3>
            <span class="bg-white text-[10px] text-slate-500 py-0.5 px-2 rounded-full border border-slate-200 font-bold">
              {{ col.orders.value.length }}
            </span>
          </div>
          
          <draggable 
            v-model="col.orders.value" 
            group="orders" 
            item-key="id"
            class="p-3 flex-1 overflow-y-auto space-y-4 custom-scrollbar min-h-[200px]"
            ghost-class="ghost"
          >
            <template #item="{ element }">
              <div 
                @click="openOrderDetails(element)"
                class="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 transition-all cursor-grab active:cursor-grabbing shadow-sm hover:shadow-xl hover:-translate-y-1 transform duration-300 group">
                <div class="flex justify-between items-start mb-3">
                  <span class="text-[10px] font-black text-slate-300 tracking-tighter uppercase">#GP-{{ element.id.toString().padStart(4, '0') }}</span>
                  <div class="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">R$ {{ element.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}</div>
                </div>
                
                <h4 class="font-black text-slate-800 text-sm mb-2 leading-tight group-hover:text-indigo-600 transition-colors">{{ element.customerName }}</h4>
                
                <p class="text-[11px] font-bold text-slate-500 leading-relaxed mb-4 border-l-2 border-slate-100 pl-3">
                  {{ element.productDescription }}
                </p>

                <div class="flex flex-wrap gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  <span v-if="element.productDescription.toLowerCase().includes('papel')" class="text-[9px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase tracking-tighter">Papel</span>
                  <span v-if="element.productDescription.toLowerCase().includes('brilh')" class="text-[9px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-md uppercase tracking-tighter">Brilho</span>
                  <span v-if="element.productDescription.toLowerCase().includes('fosco')" class="text-[9px] font-black bg-slate-800 text-white px-2 py-0.5 rounded-md uppercase tracking-tighter">Fosco</span>
                  <span v-if="element.productDescription.toLowerCase().includes('verniz')" class="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md uppercase tracking-tighter">Verniz</span>
                </div>

                <div class="mt-3 flex items-center gap-2 border-t border-slate-50 pt-3">
                  <div v-if="element.salesperson" class="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[9px] font-bold" title="Vendedor">
                    <svg class="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    {{ element.salesperson.name.split(' ')[0] }}
                  </div>
                  <div v-if="element.producer" class="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-md text-[9px] font-bold" title="Produtor">
                    <svg class="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    {{ element.producer.name.split(' ')[0] }}
                  </div>
                </div>

                <div class="mt-4 pt-4 border-t border-slate-50">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Arquivos / Artes</span>
                    <button @click.stop="triggerUpload(element.id)" class="text-indigo-600 hover:text-indigo-800 transition-colors">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    </button>
                    <input :id="'file-input-' + element.id" type="file" class="hidden" @change="handleFileUpload($event, element.id)" />
                  </div>
                  <div v-if="element.attachments && element.attachments.length > 0" class="flex flex-wrap gap-2">
                    <div 
                      v-for="file in element.attachments" 
                      :key="file.id"
                      class="flex items-center gap-2 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg group/file"
                    >
                      <span class="text-[9px] font-bold text-slate-600 truncate max-w-[80px]" :title="file.originalName">{{ file.originalName }}</span>
                      <div class="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity">
                        <button @click.stop="downloadFile(file.filename)" class="text-indigo-600 hover:text-indigo-800">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path></svg>
                        </button>
                        <button @click.stop="deleteAttachment(file.id, element.id)" class="text-red-400 hover:text-red-600">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-[9px] text-slate-300 italic">Nenhum anexo</div>
                </div>

                <div class="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
                  <button 
                    @click.stop="confirmPix(element.id)"
                    class="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700 transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7m0 0a1 1 0 011-1h2a1 1 0 011 1v1m-6 0a1 1 0 00-1-1H7a1 1 0 00-1 1v1"></path></svg>
                    Pagar Pix
                  </button>

                  <button 
                    v-if="element.status === 'PENDING'"
                    @click.stop="verifyPaymentDirectly(element.id)"
                    :disabled="verifyingOrderId === element.id"
                    class="flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-black uppercase text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all active:scale-95 disabled:opacity-50">
                    <span v-if="verifyingOrderId === element.id" class="w-2.5 h-2.5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin"></span>
                    <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Verificar
                  </button>
                  <div class="flex items-center gap-3">
                    <button 
                      @click.stop="openWhatsApp(element)"
                      class="text-slate-300 hover:text-emerald-500 transition-colors"
                      title="Enviar WhatsApp">
                      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 448 512"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-5.5-2.8-23.4-8.6-44.6-27.5-16.5-14.7-27.6-32.8-30.8-38.4-3.2-5.5-.3-8.6 2.5-11.3 2.5-2.5 5.5-6.5 8.3-9.7 2.8-3.3 3.7-5.6 5.5-9.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 13.2 5.8 23.5 9.2 31.5 11.8 13.3 4.2 25.4 3.6 35 2.2 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
                    </button>
                    <button v-if="!authStore.isOnlyProduction" @click.stop="startDeleteOrder(element.id)" class="text-slate-300 hover:text-red-500 transition-colors">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                    <div class="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                  </div>
                </div>
              </div>
            </template>
          </draggable>
        </div>
      </div>
    </div>

    <!-- Order Details Modal -->
    <div v-if="isModalOpen && selectedOrder" class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="closeOrderDetails"></div>
      
      <div class="bg-white w-full max-w-6xl h-full max-h-[85vh] rounded-[40px] shadow-2xl relative z-10 overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300 slide-in-from-bottom-8">
        <!-- Close Button -->
        <button @click="closeOrderDetails" class="absolute top-6 right-6 z-20 w-10 h-10 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full flex items-center justify-center transition-all group">
          <svg class="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <!-- Left Column: Details -->
        <div class="w-full md:w-[400px] border-r border-slate-100 flex flex-col h-full bg-slate-50/50">
          <div class="p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
            <header>
              <div class="flex items-center gap-3 mb-2">
                <span class="px-3 py-1 bg-indigo-600 text-[10px] font-black text-white rounded-full tracking-widest uppercase">Pedido #{{ selectedOrder.id }}</span>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{{ new Date(selectedOrder.createdAt).toLocaleDateString() }}</span>
              </div>
              <h2 class="text-2xl font-black text-slate-900 leading-tight">{{ selectedOrder.productDescription }}</h2>
            </header>

            <!-- Customer Info -->
            <div class="space-y-4">
              <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Cliente</h4>
              <div class="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                <div class="text-lg font-black text-slate-800 mb-1">{{ selectedOrder.customerName }}</div>
                <div class="flex flex-col gap-1">
                  <span class="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                    {{ selectedOrder.customerPhone || 'Não informado' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Equipe / Atribuição -->
            <div v-if="selectedOrder.salesperson || selectedOrder.producer" class="space-y-4">
              <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Equipe</h4>
              <div class="flex items-center gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                <div v-if="selectedOrder.salesperson" class="flex-1 min-w-0">
                  <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 truncate">Vendedor</div>
                  <div class="font-black text-slate-800 flex items-center gap-2">
                    <svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    <span class="truncate text-[12px]" :title="selectedOrder.salesperson.name">{{ selectedOrder.salesperson.name }}</span>
                  </div>
                </div>
                <!-- Divisor -->
                <div v-if="selectedOrder.salesperson && selectedOrder.producer" class="w-px h-8 bg-slate-100 shrink-0"></div>
                <div v-if="selectedOrder.producer" class="flex-1 min-w-0">
                  <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 truncate">Produtor</div>
                  <div class="font-black text-slate-800 flex items-center gap-2">
                    <svg class="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    <span class="truncate text-[12px]" :title="selectedOrder.producer.name">{{ selectedOrder.producer.name }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Financials -->
            <div class="space-y-4">
              <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Financeiro</h4>
              <div class="flex items-center justify-between bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100">
                <span class="text-xs font-bold text-emerald-600 uppercase tracking-widest">Valor Total</span>
                <span class="text-2xl font-black text-emerald-700">R$ {{ selectedOrder.amount.toFixed(2) }}</span>
              </div>
            </div>

            <!-- Receipt Button -->
            <div class="space-y-4">
              <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Documentos</h4>
              <button 
                @click="downloadReceipt(selectedOrder.id)"
                class="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                Gerar Recibo (2 Vias)
              </button>
            </div>

            <!-- Attachments List -->
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Arquivos da Arte</h4>
                <button @click="triggerUpload(selectedOrder.id)" class="text-[10px] font-black text-indigo-600 uppercase hover:underline">Adicionar Novo</button>
              </div>
              <div v-if="selectedOrder.attachments?.length" class="space-y-2">
                <div 
                  v-for="file in selectedOrder.attachments" 
                  :key="file.id"
                  class="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors group/fileli"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                      <svg v-if="isImage(file.mimetype)" class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      <svg v-else-if="isPDF(file.mimetype)" class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                      <svg v-else class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[11px] font-bold text-slate-700 truncate max-w-[150px]">{{ file.originalName }}</span>
                      <span class="text-[9px] font-medium text-slate-400">{{ (file.size / 1024).toFixed(1) }} KB</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <button @click="downloadFile(file.filename)" class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    </button>
                    <button @click="deleteAttachment(file.id, selectedOrder.id)" class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div v-else class="text-xs text-slate-400 italic bg-slate-100/50 p-6 rounded-3xl border border-dashed border-slate-200 text-center">
                Sem arquivos anexados
              </div>
            </div>
          </div>
          
          <div class="p-8 border-t border-slate-100 bg-white">
            <button 
              @click="openWhatsApp(selectedOrder)"
              class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-3"
            >
              Falar com Cliente
            </button>
          </div>
        </div>

        <!-- Right Column: Preview Area -->
        <div class="flex-1 bg-slate-100 relative overflow-hidden flex flex-col">
          <div class="absolute inset-0 flex items-center justify-center p-8 md:p-12">
            <!-- If no attachments -->
            <div v-if="!selectedOrder.attachments?.length" class="text-center space-y-4 max-w-sm">
              <div class="w-20 h-20 bg-white/50 backdrop-blur-md rounded-[32px] mx-auto flex items-center justify-center shadow-sm">
                <svg class="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              </div>
              <h3 class="text-xl font-black text-slate-800">Aguardando Arte</h3>
              <p class="text-slate-500 font-medium">Anexe um arquivo ao lado para visualizar o preview da produção.</p>
              <button @click="triggerUpload(selectedOrder.id)" class="px-8 py-3 bg-white text-indigo-600 font-black rounded-xl shadow-sm hover:shadow-md transition-all">Upload da Arte</button>
            </div>

            <!-- If there are attachments, show the first one as preview -->
            <div v-else class="w-full h-full flex flex-col items-center justify-center">
              <div class="w-full h-full bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden relative flex flex-col">
                <div class="h-12 border-b border-slate-100 bg-slate-50 flex items-center justify-between px-6 shrink-0">
                  <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visualização da Arte: {{ selectedOrder.attachments[0].originalName }}</span>
                  <div class="flex items-center gap-2">
                    <button @click="downloadFile(selectedOrder.attachments[0].filename)" class="text-indigo-600 font-black text-[10px] uppercase hover:underline">Download Full Size</button>
                  </div>
                </div>
                <div class="flex-1 overflow-auto bg-[url('https://www.transparenttextures.com/patterns/graphy.png')] flex items-center justify-center p-4">
                  <img 
                    v-if="isImage(selectedOrder.attachments[0].mimetype)" 
                    :src="getPreviewUrl(selectedOrder.attachments[0].filename)" 
                    class="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  />
                  <iframe 
                    v-else-if="isPDF(selectedOrder.attachments[0].mimetype)" 
                    :src="getPreviewUrl(selectedOrder.attachments[0].filename)" 
                    class="w-full h-full rounded-2xl"
                    frameborder="0"
                  ></iframe>
                  <div v-else class="text-center space-y-4">
                    <div class="w-32 h-32 bg-indigo-50 rounded-[40px] flex items-center justify-center mx-auto">
                      <svg class="w-16 h-16 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    </div>
                    <h4 class="text-lg font-black text-slate-700">Preview não disponível</h4>
                    <p class="text-slate-400 font-medium">Arquivos deste tipo devem ser baixados.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment Modal -->
    <PaymentModal 
      :url="paymentUrl" 
      :qr-code="pixQrCode"
      :qr-code-base64="pixQrCodeBase64"
      :amount="paymentAmount"
      :transaction-id="currentTransactionId || undefined"
      :is-open="isPaymentModalOpen" 
      @close="isPaymentModalOpen = false" 
      @paid="triggerToast('Pagamento confirmado com sucesso!')"
    />

    <!-- Toast Overlay -->
    <Transition
      enter-active-class="transform transition ease-out duration-300"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="showToast" class="fixed top-6 left-1/2 -translate-x-1/2 p-4 bg-indigo-600/90 backdrop-blur border border-indigo-400/50 rounded-2xl flex items-center gap-3 text-white shadow-2xl z-[150] min-w-[300px]">
        <div class="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <span class="text-sm font-black uppercase tracking-wider">{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- Confirmation Modal Pix -->
    <div v-if="isConfirmingPix" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="isConfirmingPix = false"></div>
      <div class="bg-white w-full max-w-sm p-8 rounded-[32px] shadow-2xl relative z-10 text-center animate-in zoom-in-95 duration-200">
        <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16v1m0-1V7m0 0a1 1 0 011-1h2a1 1 0 011 1v1m-6 0a1 1 0 00-1-1H7a1 1 0 00-1 1v1"></path></svg>
        </div>
        <h3 class="text-xl font-black text-slate-900 mb-2">Gerar Pagamento Pix?</h3>
        <p class="text-slate-500 text-sm font-medium mb-8">Isso criará uma nova transação no Mercado Pago para este pedido.</p>
        <div class="flex gap-3">
          <button @click="isConfirmingPix = false" class="flex-1 py-3.5 px-4 rounded-2xl font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all active:scale-95 uppercase text-[10px] tracking-widest border border-transparent hover:border-slate-100">Cancelar</button>
          <button @click="generatePix(orderToPay!)" class="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-black hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-emerald-500/30 uppercase text-[10px] tracking-widest">Gerar Pix</button>
        </div>
      </div>
    </div>

    <!-- Payment Error Modal -->
    <PaymentErrorModal :show="isErrorModalOpen" @close="isErrorModalOpen = false" />

    <!-- Stock Warning Modal -->
    <div v-if="showStockWarningModal" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="showStockWarningModal = false"></div>
      <div class="bg-white w-full max-w-sm p-8 rounded-[32px] shadow-2xl relative z-10 text-center animate-in zoom-in-95 duration-200">
        <div class="w-16 h-16 bg-amber-100 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <h3 class="text-xl font-black text-slate-800 mb-2">Atenção ao Estoque</h3>
        <p class="text-slate-500 text-sm font-medium mb-8">
          O estoque dos insumos vinculados a este pedido foi <strong class="text-slate-700">atualizado automaticamente</strong>.
        </p>
        <button 
          @click="showStockWarningModal = false" 
          class="w-full py-4 rounded-2xl bg-amber-500 text-white font-black hover:bg-amber-600 active:scale-95 transition-all shadow-lg shadow-amber-500/30 uppercase text-[10px] tracking-widest"
        >
          OK, Entendi
        </button>
      </div>
    </div>

    <!-- Confirmation Modal Delete Order -->
    <div v-if="isConfirmingDelete" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="isConfirmingDelete = false"></div>
      <div class="bg-white w-full max-w-sm p-8 rounded-[32px] shadow-2xl relative z-10 text-center animate-in zoom-in-95 duration-200">
        <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </div>
        <h3 class="text-xl font-black text-slate-900 mb-2">Excluir Pedido?</h3>
        <p class="text-slate-500 text-sm font-medium mb-8">Esta ação não poderá ser desfeita e removerá todos os arquivos vinculados.</p>
        <div class="flex gap-3">
          <button @click="isConfirmingDelete = false" class="flex-1 py-3.5 px-4 rounded-2xl font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all active:scale-95 uppercase text-[10px] tracking-widest border border-transparent hover:border-slate-100">Manter</button>
          <button @click="confirmDeleteOrder" class="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 text-white font-black hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-rose-500/30 uppercase text-[10px] tracking-widest">Excluir</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
.ghost { opacity: 0.4; background: #e0e7ff; border: 2px dashed #6366f1; }
</style>
