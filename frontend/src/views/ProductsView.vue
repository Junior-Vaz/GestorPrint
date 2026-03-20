<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted, computed } from 'vue'

interface ProductType {
  id: number
  name: string
  color: string
  hasStock: boolean
  _count?: { products: number }
}

interface Product {
  id: number
  name: string
  typeId: number
  productType: ProductType
  unit: string
  unitPrice: number
  brand: string | null
  markup: number
  stock: number
  minStock: number
  description: string | null
  supplier?: { id: number; name: string } | null
}

interface Supplier { id: number; name: string }

const products = ref<Product[]>([])
const productTypes = ref<ProductType[]>([])
const suppliers = ref<Supplier[]>([])
const loading = ref(true)
const activeTab = ref<number | null>(null) // null = All
const showProductModal = ref(false)
const showTypeModal = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)
const editingTypeId = ref<number | null>(null)

const form = ref({
  name: '', typeId: 0, unitPrice: 0, unit: 'un',
  brand: '', markup: 0, stock: 0, minStock: 0,
  description: '', supplierId: null as number | null
})

const typeForm = ref({ name: '', color: '#6366f1', hasStock: true })

// --- Computed ---
const filteredProducts = computed(() => {
  if (activeTab.value === null) return products.value
  return products.value.filter(p => p.typeId === activeTab.value)
})

const lowStockCount = computed(() =>
  products.value.filter(p => p.productType.hasStock && p.stock <= p.minStock).length
)

// --- Data fetch ---
const fetchAll = async () => {
  loading.value = true
  try {
    const [pRes, tRes, sRes] = await Promise.all([
      apiFetch('/api/products'),
      apiFetch('/api/product-types'),
      apiFetch('/api/suppliers'),
    ])
    if (pRes.ok) products.value = await pRes.json()
    if (tRes.ok) productTypes.value = await tRes.json()
    if (sRes.ok) suppliers.value = await sRes.json()
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

// --- Product CRUD ---
const openProductModal = (product?: Product) => {
  if (product) {
    isEditing.value = true; editingId.value = product.id
    form.value = {
      name: product.name, typeId: product.typeId,
      unitPrice: product.unitPrice, unit: product.unit,
      brand: product.brand || '', markup: product.markup,
      stock: product.stock, minStock: product.minStock,
      description: product.description || '',
      supplierId: product.supplier?.id ?? null
    }
  } else {
    isEditing.value = false; editingId.value = null
    form.value = { name: '', typeId: productTypes.value[0]?.id ?? 0, unitPrice: 0, unit: 'un', brand: '', markup: 0, stock: 0, minStock: 0, description: '', supplierId: null }
  }
  showProductModal.value = true
}

const saveProduct = async () => {
  if (!form.value.name || !form.value.typeId || form.value.unitPrice <= 0) return
  const method = isEditing.value ? 'PATCH' : 'POST'
  const url = isEditing.value
    ? `/api/products/${editingId.value}`
    : '/api/products'
  const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form.value) })
  if (res.ok) { showProductModal.value = false; await fetchAll() }
}

const deleteProduct = async (id: number) => {
  if (!confirm('Excluir este insumo?')) return
  await apiFetch(`/api/products/${id}`, { method: 'DELETE' })
  await fetchAll()
}

// --- Type CRUD ---
const openTypeModal = (type?: ProductType) => {
  if (type) {
    editingTypeId.value = type.id
    typeForm.value = { name: type.name, color: type.color, hasStock: type.hasStock }
  } else {
    editingTypeId.value = null
    typeForm.value = { name: '', color: '#6366f1', hasStock: true }
  }
  showTypeModal.value = true
}

const saveType = async () => {
  if (!typeForm.value.name) return
  const method = editingTypeId.value ? 'PATCH' : 'POST'
  const url = editingTypeId.value
    ? `/api/product-types/${editingTypeId.value}`
    : '/api/product-types'
  const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(typeForm.value) })
  if (res.ok) { showTypeModal.value = false; await fetchAll() }
}

const deleteType = async (id: number) => {
  if (!confirm('Excluir este tipo?')) return
  const res = await apiFetch(`/api/product-types/${id}`, { method: 'DELETE' })
  if (!res.ok) { const e = await res.json(); alert(e.message || 'Erro ao excluir') }
  await fetchAll()
}

// --- Stock adjustment ---
const adjustStock = async (product: Product) => {
  const qtyStr = prompt(`Ajustar estoque de "${product.name}" (use + para entrada, - para saída):\nAtual: ${product.stock} ${product.unit}`)
  if (qtyStr === null) return
  const qty = parseFloat(qtyStr)
  if (isNaN(qty)) { alert('Valor inválido'); return }
  await apiFetch(`/api/products/${product.id}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity: qty, type: qty > 0 ? 'PURCHASE' : 'ADJUSTMENT', reason: 'Ajuste manual' })
  })
  await fetchAll()
}

onMounted(fetchAll)
</script>

<template>
  <div class="flex flex-col space-y-6 h-full">

    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 class="text-3xl font-black text-slate-900 tracking-tight">Insumos & Serviços</h2>
        <p class="text-slate-500 font-medium">Gerencie papéis, acabamentos, tintas e serviços com categorias personalizadas.</p>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <div v-if="lowStockCount > 0" class="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-black animate-pulse">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          {{ lowStockCount }} Estoque Baixo
        </div>
        <button @click="openTypeModal()" class="px-5 py-2.5 border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-50 transition-all text-sm flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z"></path></svg>
          Gerenciar Tipos
        </button>
        <button @click="openProductModal()" class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-indigo-200 text-sm flex items-center gap-2 active:scale-95">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Novo Insumo
        </button>
      </div>
    </div>

    <!-- Tabs by Type -->
    <div class="flex gap-2 flex-wrap">
      <button
        @click="activeTab = null"
        :class="['px-4 py-2 rounded-xl text-xs font-black transition-all border', activeTab === null ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-500 hover:border-slate-400']"
      >
        Todos ({{ products.length }})
      </button>
      <button
        v-for="type in productTypes" :key="type.id"
        @click="activeTab = type.id"
        :class="['px-4 py-2 rounded-xl text-xs font-black transition-all border flex items-center gap-2', activeTab === type.id ? 'text-white border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-400']"
        :style="activeTab === type.id ? { backgroundColor: type.color, borderColor: type.color } : {}"
      >
        <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: activeTab === type.id ? '#fff' : type.color }"></span>
        {{ type.name }} ({{ type._count?.products ?? 0 }})
      </button>
    </div>

    <!-- Products Table -->
    <div class="flex-1 bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center p-20">
        <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else-if="filteredProducts.length === 0" class="p-20 text-center">
        <div class="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
        </div>
        <p class="font-black text-slate-700 mb-1">Nenhum item encontrado</p>
        <p class="text-slate-400 text-sm">Adicione um novo insumo ou mude a categoria.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/80 border-b border-slate-100">
              <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Insumo</th>
              <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
              <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estoque</th>
              <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Preço Base</th>
              <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Margem de Lucro</th>
              <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="product in filteredProducts" :key="product.id" class="hover:bg-slate-50/50 transition-colors group">
              <td class="px-6 py-4">
                <div class="font-black text-slate-800">{{ product.name }}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">
                  {{ product.brand ? product.brand + ' • ' : '' }}{{ product.description || 'Sem descrição' }}
                </div>
                <div v-if="product.supplier" class="text-[10px] text-indigo-500 font-bold mt-0.5">📦 {{ product.supplier.name }}</div>
              </td>
              <td class="px-6 py-4">
                <span
                  class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-white"
                  :style="{ backgroundColor: product.productType.color }"
                >
                  {{ product.productType.name }}
                </span>
              </td>
              <td class="px-6 py-4">
                <template v-if="product.productType.hasStock">
                  <div class="flex items-center gap-2">
                    <span :class="['font-mono font-black text-sm', product.stock <= product.minStock ? 'text-red-500' : 'text-slate-700']">
                      {{ product.stock }} <span class="text-slate-400 font-medium text-[10px]">{{ product.unit }}</span>
                    </span>
                    <span v-if="product.stock <= product.minStock" class="animate-pulse bg-red-50 text-red-500 text-[9px] font-black px-1.5 py-0.5 rounded border border-red-100">BAIXO</span>
                  </div>
                  <div class="text-[10px] text-slate-400">Min: {{ product.minStock }} {{ product.unit }}</div>
                </template>
                <span v-else class="text-[10px] text-slate-400 italic">— sem controle</span>
              </td>
              <td class="px-6 py-4">
                <div class="font-mono font-black text-indigo-600">
                  R$ {{ product.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
                  <span class="text-[10px] text-slate-400 font-normal">/ {{ product.unit }}</span>
                </div>
              </td>
              <td class="px-6 py-4">
                <span v-if="product.markup > 0" class="text-emerald-600 font-black text-sm">+{{ product.markup }}%</span>
                <span v-else class="text-slate-300 text-xs">—</span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    v-if="product.productType.hasStock"
                    @click="adjustStock(product)"
                    title="Ajustar Estoque"
                    class="text-slate-400 hover:text-amber-600 p-1.5 hover:bg-amber-50 rounded-lg transition-all"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>
                  </button>
                  <button @click="openProductModal(product)" title="Editar" class="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-lg transition-all">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  </button>
                  <button @click="deleteProduct(product.id)" title="Excluir" class="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-all">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Product Modal -->
    <div v-if="showProductModal" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div class="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 class="font-black text-xl text-slate-800">{{ isEditing ? 'Editar Insumo' : 'Novo Insumo' }}</h3>
          <button @click="showProductModal = false" class="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-all">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form @submit.prevent="saveProduct">
          <div class="p-6 space-y-4 max-h-[65vh] overflow-y-auto">

            <!-- Name + Type -->
            <div>
              <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Nome *</label>
              <input v-model="form.name" required type="text" placeholder="Ex: Couchê 300g Brilho" class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-bold">
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Categoria *</label>
                <select v-model.number="form.typeId" required class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none bg-white text-sm font-bold">
                  <option v-for="t in productTypes" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Unidade</label>
                <select v-model="form.unit" class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none bg-white text-sm font-bold">
                  <option value="un">Unidade (un)</option>
                  <option value="m²">Metro² (m²)</option>
                  <option value="kg">Quilograma (kg)</option>
                  <option value="h">Hora (h)</option>
                  <option value="l">Litro (l)</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Preço Base (R$) *</label>
                <input v-model.number="form.unitPrice" required type="number" step="0.01" class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-bold">
              </div>
              <div>
                <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Margem de Lucro (%)</label>
                <input v-model.number="form.markup" type="number" step="1" placeholder="0" class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-sm font-bold">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Estoque Atual</label>
                <input v-model.number="form.stock" type="number" step="0.1" class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none transition-all text-sm font-bold">
              </div>
              <div>
                <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Estoque Mínimo</label>
                <input v-model.number="form.minStock" type="number" step="0.1" class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none transition-all text-sm font-bold">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Marca / Fabricante</label>
                <input v-model="form.brand" type="text" placeholder="Ex: Suzano, IP..." class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none transition-all text-sm font-bold">
              </div>
              <div>
                <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Fornecedor</label>
                <select v-model.number="form.supplierId" class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none bg-white text-sm font-bold">
                  <option :value="null">Nenhum</option>
                  <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">Descrição</label>
              <textarea v-model="form.description" rows="2" placeholder="Observações adicionais..." class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 outline-none transition-all text-sm font-bold resize-none"></textarea>
            </div>
          </div>
          <div class="p-5 border-t border-slate-100 flex gap-3">
            <button type="button" @click="showProductModal = false" class="flex-1 py-3 border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-50 transition-all text-sm">Cancelar</button>
            <button type="submit" class="flex-1 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-500 transition-all shadow-sm text-sm">{{ isEditing ? 'Atualizar' : 'Salvar' }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Type Manager Modal -->
    <div v-if="showTypeModal" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div class="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 class="font-black text-xl text-slate-800">Categorias de Insumo</h3>
          <button @click="showTypeModal = false" class="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-all">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <!-- Existing types list -->
        <div class="p-4 space-y-2 max-h-[40vh] overflow-y-auto">
          <div v-for="type in productTypes" :key="type.id" class="flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all group">
            <div class="flex items-center gap-3">
              <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: type.color }"></span>
              <div>
                <div class="font-black text-slate-800 text-sm">{{ type.name }}</div>
                <div class="text-[10px] text-slate-400">{{ type.hasStock ? '📦 Controla estoque' : '🔧 Sem estoque' }} • {{ type._count?.products ?? 0 }} itens</div>
              </div>
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button @click="openTypeModal(type)" class="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-lg transition-all">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              </button>
              <button @click="deleteType(type.id)" class="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-all">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Add new type form -->
        <div class="p-5 border-t border-slate-100 bg-slate-50/50">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{{ editingTypeId ? 'Editar Tipo' : 'Novo Tipo' }}</p>
          <div class="flex gap-3 mb-3">
            <input v-model="typeForm.name" type="text" placeholder="Nome do tipo..." class="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm font-bold">
            <input v-model="typeForm.color" type="color" class="w-12 h-10 rounded-xl border border-slate-200 cursor-pointer p-1">
          </div>
          <label class="flex items-center gap-2 text-sm font-bold text-slate-600 mb-3 cursor-pointer">
            <input v-model="typeForm.hasStock" type="checkbox" class="w-4 h-4 rounded">
            Controla estoque físico
          </label>
          <button @click="saveType" class="w-full py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-500 transition-all text-sm">
            {{ editingTypeId ? 'Atualizar Tipo' : 'Criar Tipo' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
