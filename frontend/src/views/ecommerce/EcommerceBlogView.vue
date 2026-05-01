<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiFetch } from '../../utils/api'
import { useToast } from '../../composables/useToast'
import { usePermissionsStore } from '../../stores/permissions'
import PaginationControls from '../../components/shared/PaginationControls.vue'

const { showToast } = useToast()
const perms = usePermissionsStore()

interface Post {
  id: number
  title: string
  slug: string
  coverImage?: string | null
  excerpt?: string | null
  content: string
  category?: string | null
  tags: string[]
  author?: string | null
  status: 'DRAFT' | 'PUBLISHED'
  publishedAt?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  createdAt: string
  updatedAt: string
}

const posts = ref<Post[]>([])
const loading = ref(true)
const search = ref('')
const filterStatus = ref<'all' | 'DRAFT' | 'PUBLISHED'>('all')

// Paginação server-side. Filtros (search/status) seguem aplicados no cliente
// dentro da página atual — admins raramente têm centenas de posts, então
// busca local sobre 20 itens é suficiente.
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const editing = ref<Partial<Post> | null>(null)
const saving = ref(false)
const tagsInput = ref('')

const fetchPosts = async () => {
  loading.value = true
  try {
    const res = await apiFetch(`/api/ecommerce/admin/blog?page=${page.value}&pageSize=${pageSize.value}`)
    if (res.ok) {
      const json = await res.json()
      // Backward compat: aceita tanto array (versão antiga) quanto envelope paginado
      if (Array.isArray(json)) {
        posts.value = json
        total.value = json.length
      } else {
        posts.value = json.data || []
        total.value = json.total || 0
      }
    }
  } finally { loading.value = false }
}

const goToPage = (p: number) => {
  if (p < 1 || p > totalPages.value || p === page.value) return
  page.value = p
  fetchPosts()
}

const filtered = computed(() => {
  let arr = posts.value
  if (filterStatus.value !== 'all') arr = arr.filter(p => p.status === filterStatus.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    arr = arr.filter(p => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
  }
  return arr
})

const openNew = () => {
  editing.value = {
    title: '', slug: '', coverImage: '', excerpt: '', content: '',
    category: '', tags: [], author: '', status: 'DRAFT',
    metaTitle: '', metaDescription: '',
  }
  tagsInput.value = ''
}

const openEdit = (p: Post) => {
  editing.value = { ...p }
  tagsInput.value = (p.tags || []).join(', ')
}

const closeEdit = () => { editing.value = null }

const save = async () => {
  if (!editing.value || !editing.value.title || !editing.value.content) {
    showToast('Título e conteúdo são obrigatórios', 'error')
    return
  }
  saving.value = true
  try {
    const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean)
    const payload = { ...editing.value, tags }
    const isNew = !editing.value.id
    const url = isNew ? '/api/ecommerce/admin/blog' : `/api/ecommerce/admin/blog/${editing.value.id}`
    const res = await apiFetch(url, {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      showToast(isNew ? 'Post criado' : 'Post atualizado', 'success')
      await fetchPosts()
      closeEdit()
    } else {
      const err = await res.json().catch(() => ({}))
      showToast(err.message || 'Erro ao salvar', 'error')
    }
  } finally { saving.value = false }
}

const togglePublish = async (p: Post) => {
  const newStatus = p.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
  try {
    const res = await apiFetch(`/api/ecommerce/admin/blog/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      showToast(newStatus === 'PUBLISHED' ? 'Post publicado' : 'Post despublicado', 'success')
      await fetchPosts()
    }
  } catch { showToast('Erro ao atualizar', 'error') }
}

const deletePost = async (p: Post) => {
  if (!confirm(`Excluir "${p.title}"? Essa ação é permanente.`)) return
  try {
    const res = await apiFetch(`/api/ecommerce/admin/blog/${p.id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Post excluído', 'success')
      await fetchPosts()
    }
  } catch { showToast('Erro ao excluir', 'error') }
}

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
const publishedCount = computed(() => posts.value.filter(p => p.status === 'PUBLISHED').length)
const draftCount = computed(() => posts.value.filter(p => p.status === 'DRAFT').length)

onMounted(fetchPosts)
</script>

<template>
  <div class="max-w-7xl mx-auto px-6 py-8 space-y-6">
    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div>
        <h1 class="text-xl font-medium text-slate-900">Blog</h1>
        <p class="text-sm text-slate-500 mt-1">Gerencie os posts que aparecem na sua loja</p>
      </div>
      <div class="flex gap-2">
        <div class="relative">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input v-model="search" type="text" placeholder="Buscar..."
            class="pl-9 pr-3 py-2 w-56 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400" />
        </div>
        <button v-if="perms.can.create('ecommerce-blog')" @click="openNew" class="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-full px-4 py-2 transition-colors">
          + Novo post
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="border border-slate-200 rounded-xl p-5">
        <div class="text-xs text-slate-500">Total</div>
        <div class="text-2xl font-medium text-slate-900 mt-1">{{ posts.length }}</div>
      </div>
      <div class="border border-slate-200 rounded-xl p-5">
        <div class="text-xs text-slate-500">Publicados</div>
        <div class="text-2xl font-medium mt-1" style="color:#1D9E75">{{ publishedCount }}</div>
      </div>
      <div class="border border-slate-200 rounded-xl p-5">
        <div class="text-xs text-slate-500">Rascunhos</div>
        <div class="text-2xl font-medium text-slate-900 mt-1">{{ draftCount }}</div>
      </div>
    </div>

    <div class="border border-slate-200 rounded-xl p-3 flex items-center gap-2">
      <span class="text-xs text-slate-500 ml-1">Status</span>
      <button v-for="f in [
        { v: 'all',       l: 'Todos' },
        { v: 'PUBLISHED', l: 'Publicados' },
        { v: 'DRAFT',     l: 'Rascunhos' },
      ]" :key="f.v"
        @click="filterStatus = f.v as any"
        :class="['px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          filterStatus === f.v ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50']">
        {{ f.l }}
      </button>
    </div>

    <div class="border border-slate-200 rounded-xl overflow-hidden">
      <div v-if="loading" class="flex items-center justify-center py-16">
        <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
      </div>
      <table v-else class="w-full text-left">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50/50">
            <th class="px-5 py-3 text-xs font-medium text-slate-500 w-16">Capa</th>
            <th class="px-5 py-3 text-xs font-medium text-slate-500">Título</th>
            <th class="px-5 py-3 text-xs font-medium text-slate-500">Categoria</th>
            <th class="px-5 py-3 text-xs font-medium text-slate-500">Status</th>
            <th class="px-5 py-3 text-xs font-medium text-slate-500">Publicado</th>
            <th class="px-5 py-3 text-xs font-medium text-slate-500"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filtered" :key="p.id" class="border-b border-slate-100 hover:bg-slate-50/60">
            <td class="px-5 py-3">
              <div class="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                <img v-if="p.coverImage" :src="p.coverImage" alt="" class="w-full h-full object-cover" />
                <svg v-else class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              </div>
            </td>
            <td class="px-5 py-3">
              <div class="text-sm font-medium text-slate-900">{{ p.title }}</div>
              <div class="text-[11px] text-slate-400 font-mono">/blog/{{ p.slug }}</div>
            </td>
            <td class="px-5 py-3 text-sm text-slate-600">{{ p.category || '-' }}</td>
            <td class="px-5 py-3">
              <button @click="togglePublish(p)" :disabled="!perms.can.edit('ecommerce-blog')"
                :class="['text-[10px] font-medium px-2 py-1 rounded-full',
                  perms.can.edit('ecommerce-blog') ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                  p.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200']">
                {{ p.status === 'PUBLISHED' ? '✓ Publicado' : 'Rascunho' }}
              </button>
            </td>
            <td class="px-5 py-3 text-[11px] text-slate-500">{{ fmtDate(p.publishedAt) }}</td>
            <td class="px-5 py-3 text-right space-x-2 whitespace-nowrap">
              <button v-if="perms.can.edit('ecommerce-blog')" @click="openEdit(p)" class="text-xs text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-3 py-1.5">Editar</button>
              <button v-if="perms.can.delete('ecommerce-blog')" @click="deletePost(p)" class="text-xs text-red-700 border border-red-100 hover:bg-red-50 rounded-full px-3 py-1.5">Excluir</button>
            </td>
          </tr>
          <tr v-if="!filtered.length && !loading">
            <td colspan="6" class="px-5 py-12 text-center text-sm text-slate-400">
              Nenhum post {{ search ? 'encontrado' : 'cadastrado' }}.
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Paginação — componente compartilhado -->
      <div v-if="!loading && total > 0" class="px-5 border-t border-slate-200">
        <PaginationControls
          :page="page"
          :total-pages="totalPages"
          :total="total"
          :limit="pageSize"
          @update:page="(p) => { page = p; fetchPosts() }"
          @update:limit="(n) => { pageSize = n; page = 1; fetchPosts() }"
        />
      </div>
    </div>

    <!-- Modal de edição -->
    <div v-if="editing" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40" @click="closeEdit"></div>
      <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto z-10">
        <header class="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 class="text-base font-medium text-slate-900">{{ editing.id ? 'Editar post' : 'Novo post' }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">{{ editing.id ? `ID #${editing.id}` : 'Rascunho não publicado' }}</p>
          </div>
          <button @click="closeEdit" class="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </header>

        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Título *</label>
            <input v-model="editing.title" type="text" placeholder="Como escolher o papel certo pra cartões..."
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>

          <div>
            <label class="block text-xs text-slate-500 mb-1.5">URL (slug)</label>
            <div class="flex items-center gap-1">
              <span class="text-xs text-slate-400 font-mono">/blog/</span>
              <input v-model="editing.slug" type="text" placeholder="auto-gerado a partir do título"
                class="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400" />
            </div>
          </div>

          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Imagem de capa (URL)</label>
            <input v-model="editing.coverImage" type="text" placeholder="https://..."
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            <img v-if="editing.coverImage" :src="editing.coverImage" alt="" class="mt-2 h-32 w-full object-cover rounded border border-slate-200" />
          </div>

          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Resumo (cards do blog)</label>
            <input v-model="editing.excerpt" type="text" maxlength="200"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>

          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Conteúdo (HTML ou Markdown) *</label>
            <textarea v-model="editing.content" rows="12"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-slate-400 resize-y"></textarea>
            <p class="text-[11px] text-slate-400 mt-1">Aceita HTML: &lt;p&gt;, &lt;h2&gt;, &lt;ul&gt;, &lt;img&gt;, etc.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Categoria</label>
              <input v-model="editing.category" type="text" placeholder="Dicas técnicas, Inspiração..."
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1.5">Autor</label>
              <input v-model="editing.author" type="text"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
            </div>
          </div>

          <div>
            <label class="block text-xs text-slate-500 mb-1.5">Tags (separadas por vírgula)</label>
            <input v-model="tagsInput" type="text" placeholder="impressão, papel, qualidade"
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
          </div>

          <details class="text-sm border border-slate-200 rounded-lg">
            <summary class="px-3 py-2 cursor-pointer text-slate-600 hover:bg-slate-50">SEO (meta tags)</summary>
            <div class="p-3 pt-0 space-y-3">
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Meta title</label>
                <input v-model="editing.metaTitle" type="text" maxlength="60"
                  class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" />
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1.5">Meta description</label>
                <textarea v-model="editing.metaDescription" maxlength="160" rows="2"
                  class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400 resize-none"></textarea>
              </div>
            </div>
          </details>

          <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <div class="text-sm font-medium text-slate-900">Publicado</div>
              <div class="text-xs text-slate-500">Aparece no blog público</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" :checked="editing.status === 'PUBLISHED'"
                @change="(e) => editing!.status = (e.target as HTMLInputElement).checked ? 'PUBLISHED' : 'DRAFT'"
                class="sr-only peer" />
              <div class="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-4 peer-checked:bg-[#1D9E75] after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </label>
          </div>
        </div>

        <footer class="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button @click="closeEdit" class="text-sm text-slate-600 hover:text-slate-900 px-4 py-2">Cancelar</button>
          <button @click="save" :disabled="saving"
            class="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-full px-5 py-2 transition-colors">
            <span v-if="saving" class="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin"></span>
            <span v-else>{{ editing.id ? 'Salvar' : 'Criar post' }}</span>
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>
