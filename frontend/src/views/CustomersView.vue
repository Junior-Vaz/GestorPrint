<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useConfirm } from '../composables/useConfirm'

const auth = useAuthStore()
const { confirm: confirmDialog } = useConfirm()

interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  zipCode: string | null;
  address: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  createdAt: string;
}

const customers = ref<Customer[]>([])
const loading = ref(true)
const showModal = ref(false)
const newCustomer = ref({
  name: '',
  email: '',
  phone: '',
  document: '',
  zipCode: '',
  address: '',
  number: '',
  neighborhood: '',
  city: '',
  state: ''
})

const isEditing = ref(false)
const editingId = ref<number | null>(null)

const openModal = (customer?: Customer) => {
  if (customer) {
    isEditing.value = true
    editingId.value = customer.id
    newCustomer.value = {
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      document: customer.document || '',
      zipCode: customer.zipCode || '',
      address: customer.address || '',
      number: customer.number || '',
      neighborhood: customer.neighborhood || '',
      city: customer.city || '',
      state: customer.state || ''
    }
  } else {
    isEditing.value = false
    editingId.value = null
    newCustomer.value = { name: '', email: '', phone: '', document: '', zipCode: '', address: '', number: '', neighborhood: '', city: '', state: '' }
  }
  showModal.value = true
}

const fetchCustomers = async () => {
  loading.value = true
  try {
    const res = await apiFetch('/api/customers')
    if (res.ok) {
      customers.value = await res.json()
    }
  } catch (e) {
    console.error('Error fetching customers', e)
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  if (!newCustomer.value.name) return;

  try {
    const method = isEditing.value ? 'PATCH' : 'POST'
    const url = isEditing.value
      ? `/api/customers/${editingId.value}`
      : '/api/customers'

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCustomer.value)
    })

    if (res.ok) {
      showModal.value = false;
      newCustomer.value = { name: '', email: '', phone: '', document: '', zipCode: '', address: '', number: '', neighborhood: '', city: '', state: '' };
      await fetchCustomers();
    }
  } catch (e) {
    console.error('Error saving customer', e)
  }
}

const deleteCustomer = async (id: number) => {
  if (!await confirmDialog('Tem certeza que deseja excluir este cliente? Isso pode afetar orçamentos e pedidos vinculados.', { title: 'Excluir cliente' })) return
  try {
    const res = await apiFetch(`/api/customers/${id}`, { method: 'DELETE' })
    if (res.ok) await fetchCustomers()
  } catch (e) {
    console.error('Error deleting customer', e)
  }
}

onMounted(fetchCustomers)
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 backdrop-blur-md p-6 rounded-2xl border border-white/20 shadow-xl shadow-slate-200/50">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
          <div class="p-2 bg-teal-500 rounded-xl text-white shadow-lg shadow-teal-100">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          Gestão de Clientes
        </h1>
        <p class="text-slate-500 mt-1 font-medium italic">Visualize e gerencie sua base de clientes da gráfica</p>
      </div>

      <div class="flex items-center gap-3">
        <button
          @click="openModal()"
          class="flex cursor-pointer items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          Adicionar Cliente
        </button>
      </div>
    </div>

    <!-- Table Card -->
    <div class="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-2xl shadow-slate-200/60 overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center p-20">
        <div class="flex flex-col items-center gap-2">
          <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-slate-400 text-sm font-medium">Buscando clientes...</p>
        </div>
      </div>

      <div v-else-if="customers.length === 0" class="flex items-center justify-center p-20 text-center">
        <div class="max-w-xs">
          <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <svg class="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </div>
          <h3 class="text-slate-800 font-bold mb-1">Nenhum cliente cadastrado</h3>
          <p class="text-slate-500 text-sm">Sua base de clientes está vazia. Comece adicionando o primeiro!</p>
        </div>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50/80 border-b border-slate-100">
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Nome / Razão Social</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Documento</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Contato</th>
              <th class="px-6 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="customer in customers" :key="customer.id" class="hover:bg-indigo-50/30 transition-colors group">
              <td class="px-6 py-4">
                <div class="font-bold text-slate-800">{{ customer.name }}</div>
                <div class="text-xs text-slate-400">{{ customer.email || 'Sem e-mail' }}</div>
              </td>
              <td class="px-6 py-4">
                <span class="text-sm text-slate-600 font-mono">{{ customer.document || '-' }}</span>
              </td>
              <td class="px-6 py-4 text-sm text-slate-600">
                {{ customer.phone || 'Sem telefone' }}
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex justify-end gap-2">
                  <button @click="openModal(customer)" class="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-md transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  </button>
                  <button v-if="auth.isAdmin" @click="deleteCustomer(customer.id)" class="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition-all">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div class="bg-white rounded-3xl p-8 shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
          <h3 class="font-extrabold text-xl text-slate-800 tracking-tight">
            {{ isEditing ? 'Editar Cliente' : 'Novo Cliente' }}
          </h3>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Nome / Razão Social *</label>
            <input v-model="newCustomer.name" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Documento (CPF/CNPJ)</label>
              <input v-model="newCustomer.document" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Telefone</label>
              <input v-model="newCustomer.phone" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
            </div>
          </div>
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">E-mail</label>
            <input v-model="newCustomer.email" type="email" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
          </div>

          <div class="border-t border-slate-100 pt-4">
            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Endereço</h4>
            <div class="grid grid-cols-3 gap-4 mb-4">
              <div class="col-span-1">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">CEP</label>
                <input v-model="newCustomer.zipCode" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
              </div>
              <div class="col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Endereço (Rua, Av)</label>
                <input v-model="newCustomer.address" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
              </div>
            </div>
            <div class="grid grid-cols-4 gap-4 mb-4">
              <div class="col-span-1">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Número</label>
                <input v-model="newCustomer.number" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
              </div>
              <div class="col-span-3">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Bairro</label>
                <input v-model="newCustomer.neighborhood" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
              </div>
            </div>
            <div class="grid grid-cols-4 gap-4">
              <div class="col-span-3">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Cidade</label>
                <input v-model="newCustomer.city" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
              </div>
              <div class="col-span-1">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">UF</label>
                <input v-model="newCustomer.state" type="text" class="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm">
              </div>
            </div>
          </div>
        </div>

        <div class="flex gap-3 mt-6 pt-4 border-t border-slate-100">
          <button @click="showModal = false" class="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm">Cancelar</button>
          <button @click="handleSave" class="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 text-sm">
            {{ isEditing ? 'Atualizar Cliente' : 'Salvar Cliente' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
