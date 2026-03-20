<script setup lang="ts">
import { apiFetch } from '../utils/api'
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

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
  if (!confirm('Tem certeza que deseja excluir este cliente? Isso pode afetar orçamentos e pedidos vinculados.')) return
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
  <div class="h-full flex flex-col space-y-6">
    <!-- Header Area -->
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold text-slate-800 tracking-tight">Gestão de Clientes</h2>
        <p class="text-slate-500 text-sm">Visualize e gerencie sua base de clientes da gráfica.</p>
      </div>
      <button 
        @click="openModal()"
        class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-semibold transition-all shadow-sm"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
        Adicionar Cliente
      </button>
    </div>

    <!-- Table Card -->
    <div class="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div v-if="loading" class="flex-1 flex items-center justify-center">
        <div class="flex flex-col items-center gap-2">
          <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-slate-400 text-sm font-medium">Buscando clientes...</p>
        </div>
      </div>

      <div v-else-if="customers.length === 0" class="flex-1 flex items-center justify-center p-12 text-center">
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
            <tr class="bg-slate-50 border-b border-slate-100">
              <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Nome / Razão Social</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Documento</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Contato</th>
              <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="customer in customers" :key="customer.id" class="hover:bg-slate-50/50 transition-colors">
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

    <!-- Modal Simple -->
    <div v-if="showModal" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div class="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 class="font-extrabold text-xl text-slate-800 tracking-tight">
            {{ isEditing ? 'Editar Cliente' : 'Novo Cliente' }}
          </h3>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-600"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-semibold text-slate-600 mb-1.5">Nome / Razão Social *</label>
            <input v-model="newCustomer.name" type="text" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-slate-600 mb-1.5">Documento (CPF/CNPJ)</label>
              <input v-model="newCustomer.document" type="text" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700">
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-600 mb-1.5">Telefone</label>
              <input v-model="newCustomer.phone" type="text" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700">
            </div>
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-600 mb-1.5">E-mail</label>
            <input v-model="newCustomer.email" type="email" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700">
          </div>
          <div class="border-t border-slate-100 my-4 pt-4">
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Endereço</h4>
            <div class="grid grid-cols-3 gap-4 mb-4">
              <div class="col-span-1">
                <label class="block text-sm font-semibold text-slate-600 mb-1.5">CEP</label>
                <input v-model="newCustomer.zipCode" type="text" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700">
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-semibold text-slate-600 mb-1.5">Endereço (Rua, Av)</label>
                <input v-model="newCustomer.address" type="text" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700">
              </div>
            </div>
            <div class="grid grid-cols-4 gap-4 mb-4">
              <div class="col-span-1">
                <label class="block text-sm font-semibold text-slate-600 mb-1.5">Número</label>
                <input v-model="newCustomer.number" type="text" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700">
              </div>
              <div class="col-span-3">
                <label class="block text-sm font-semibold text-slate-600 mb-1.5">Bairro</label>
                <input v-model="newCustomer.neighborhood" type="text" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700">
              </div>
            </div>
            <div class="grid grid-cols-4 gap-4">
              <div class="col-span-3">
                <label class="block text-sm font-semibold text-slate-600 mb-1.5">Cidade</label>
                <input v-model="newCustomer.city" type="text" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700">
              </div>
              <div class="col-span-1">
                <label class="block text-sm font-semibold text-slate-600 mb-1.5">UF</label>
                <input v-model="newCustomer.state" type="text" class="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700">
              </div>
            </div>
          </div>
        </div>
        <div class="p-6 bg-slate-50 flex gap-3">
          <button @click="showModal = false" class="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-white transition-all text-sm">Cancelar</button>
          <button @click="handleSave" class="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-500 transition-all shadow-sm hover:shadow text-sm">
            {{ isEditing ? 'Atualizar Cliente' : 'Salvar Cliente' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
