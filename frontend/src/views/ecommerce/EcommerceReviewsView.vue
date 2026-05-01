<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { apiFetch } from '../../utils/api'
import { useToast } from '../../composables/useToast'
import PaginationControls from '../../components/shared/PaginationControls.vue'

const { showToast } = useToast()

interface Review {
  id: number
  rating: number
  title?: string | null
  comment?: string | null
  photos: string[]
  status: 'PUBLISHED' | 'PENDING' | 'REJECTED'
  createdAt: string
  customer: { id: number; name: string; email: string }
  product:  { id: number; name: string; slug: string }
}

const reviews = ref<Review[]>([])
const loading = ref(true)
const filterStatus = ref<'all' | 'PUBLISHED' | 'PENDING' | 'REJECTED'>('all')

// Paginação server-side. Quando admin troca o filtro de status, voltamos pra
// página 1 (senão o usuário ficaria numa página vazia se mudasse de "todas"
// pra "rejeitadas" sem ter rejeições suficientes).
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const fetchReviews = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filterStatus.value !== 'all') params.set('status', filterStatus.value)
    params.set('page', String(page.value))
    params.set('pageSize', String(pageSize.value))
    const res = await apiFetch(`/api/ecommerce/admin/reviews?${params.toString()}`)
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json)) {
        reviews.value = json
        total.value = json.length
      } else {
        reviews.value = json.data || []
        total.value = json.total || 0
      }
    }
  } finally { loading.value = false }
}

const goToPage = (p: number) => {
  if (p < 1 || p > totalPages.value || p === page.value) return
  page.value = p
  fetchReviews()
}

const updateStatus = async (r: Review, status: string) => {
  try {
    const res = await apiFetch(`/api/ecommerce/admin/reviews/${r.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      showToast(status === 'PUBLISHED' ? 'Avaliação publicada' : status === 'REJECTED' ? 'Avaliação rejeitada' : 'Status atualizado', 'success')
      await fetchReviews()
    }
  } catch { showToast('Erro ao atualizar', 'error') }
}

const deleteReview = async (r: Review) => {
  if (!confirm(`Excluir avaliação de "${r.customer.name}"? Essa ação é permanente.`)) return
  try {
    const res = await apiFetch(`/api/ecommerce/admin/reviews/${r.id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Avaliação excluída', 'success')
      await fetchReviews()
    }
  } catch { showToast('Erro ao excluir', 'error') }
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

const stars = (n: number) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n)

const counts = computed(() => ({
  all:       reviews.value.length,
  published: reviews.value.filter(r => r.status === 'PUBLISHED').length,
  pending:   reviews.value.filter(r => r.status === 'PENDING').length,
  rejected:  reviews.value.filter(r => r.status === 'REJECTED').length,
}))

// Mudou filtro? Volta pra página 1 antes de buscar
watch(filterStatus, () => { page.value = 1; fetchReviews() })
onMounted(fetchReviews)
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-8 space-y-6">
    <div>
      <h1 class="text-xl font-medium text-slate-900">Avaliações</h1>
      <p class="text-sm text-slate-500 mt-1">Modere as avaliações dos seus clientes antes de elas aparecerem na loja</p>
    </div>

    <div class="border border-slate-200 rounded-xl p-3 flex items-center gap-2">
      <span class="text-xs text-slate-500 ml-1">Status</span>
      <button v-for="f in [
        { v: 'all',       l: 'Todas' },
        { v: 'PUBLISHED', l: 'Publicadas' },
        { v: 'PENDING',   l: 'Aguardando moderação' },
        { v: 'REJECTED',  l: 'Rejeitadas' },
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

      <div v-else-if="!reviews.length" class="px-5 py-16 text-center text-sm text-slate-400">
        Nenhuma avaliação {{ filterStatus !== 'all' ? 'nesse status' : 'cadastrada' }}.
      </div>

      <div v-else class="divide-y divide-slate-100">
        <article v-for="r in reviews" :key="r.id" class="p-5 flex items-start gap-4 hover:bg-slate-50/40">
          <!-- Estrelas + rating -->
          <div class="w-20 shrink-0">
            <div class="text-amber-500 text-base leading-none">{{ stars(r.rating) }}</div>
            <div class="text-xs text-slate-500 mt-1">{{ r.rating.toFixed(1) }}/5</div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2 mb-1">
              <span class="text-sm font-medium text-slate-900">{{ r.customer.name }}</span>
              <span class="text-[11px] text-slate-400">{{ r.customer.email }}</span>
              <span class="text-[11px] text-slate-400">· {{ fmtDate(r.createdAt) }}</span>
            </div>
            <div class="text-[12px] text-slate-500 mb-2">
              em <strong class="text-slate-700">{{ r.product.name }}</strong>
              <span class="font-mono text-slate-400">/{{ r.product.slug }}</span>
            </div>
            <h3 v-if="r.title" class="text-sm font-medium text-slate-900 mb-1">{{ r.title }}</h3>
            <p v-if="r.comment" class="text-sm text-slate-700 leading-relaxed">{{ r.comment }}</p>
            <div v-if="r.photos?.length" class="flex gap-2 mt-2">
              <img v-for="(p, i) in r.photos" :key="i" :src="p" alt="" class="w-14 h-14 object-cover rounded border border-slate-200" />
            </div>
          </div>

          <div class="flex flex-col items-end gap-2 shrink-0">
            <span :class="['text-[10px] font-medium px-2 py-1 rounded-full',
              r.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' :
              r.status === 'PENDING'   ? 'bg-amber-100 text-amber-800' :
                                          'bg-red-100 text-red-800']">
              {{ r.status === 'PUBLISHED' ? '✓ Publicada' : r.status === 'PENDING' ? 'Aguardando' : 'Rejeitada' }}
            </span>
            <div class="flex gap-1.5">
              <button v-if="r.status !== 'PUBLISHED'" @click="updateStatus(r, 'PUBLISHED')"
                class="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-2.5 py-1">
                ✓ Publicar
              </button>
              <button v-if="r.status !== 'REJECTED'" @click="updateStatus(r, 'REJECTED')"
                class="text-[11px] text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-2.5 py-1">
                Rejeitar
              </button>
              <button @click="deleteReview(r)" title="Excluir permanentemente"
                class="text-[11px] text-red-700 border border-red-100 hover:bg-red-50 rounded-full px-2.5 py-1">
                Excluir
              </button>
            </div>
          </div>
        </article>
      </div>

      <!-- Paginação — componente compartilhado -->
      <div v-if="!loading && total > 0" class="px-5 border-t border-slate-200">
        <PaginationControls
          :page="page"
          :total-pages="totalPages"
          :total="total"
          :limit="pageSize"
          @update:page="(p) => { page = p; fetchReviews() }"
          @update:limit="(n) => { pageSize = n; page = 1; fetchReviews() }"
        />
      </div>
    </div>
  </div>
</template>
