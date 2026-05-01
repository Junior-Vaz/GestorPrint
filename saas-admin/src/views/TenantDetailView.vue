<template>
  <SidebarLayout>
    <div class="p-6 max-w-5xl mx-auto space-y-6">

      <!-- Loading skeleton -->
      <div v-if="pageLoading" class="flex items-center justify-center py-20">
        <div class="h-8 w-8 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>

      <template v-else-if="tenant">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-md p-5">
          <div class="flex items-center gap-3">
            <button @click="router.push('/tenants')"
              class="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
            </button>
            <div>
              <p class="text-[11px] font-mono text-slate-400 uppercase tracking-[0.15em]">Tenant #{{ tenant.id }}</p>
              <h1 class="text-base font-medium text-slate-900 leading-tight">{{ tenant.name }}</h1>
              <p class="text-[11px] text-slate-400 font-mono mt-0.5">{{ tenant.slug }}</p>
            </div>
            <span :class="['inline-flex px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider', STATUS_COLORS[tenant.planStatus] || 'bg-slate-100 text-slate-500']">
              {{ tenant.planStatus }}
            </span>
          </div>
          <div class="flex gap-2">
            <button @click="impersonate" :disabled="impersonating || tenant.planStatus === 'SUSPENDED' || tenant.planStatus === 'CANCELLED'"
              :title="tenant.planStatus === 'SUSPENDED' || tenant.planStatus === 'CANCELLED' ? 'Reative o tenant pra acessar' : 'Abre o ERP do cliente em nova aba'"
              class="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <svg v-if="!impersonating" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
              <span v-else class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
              Acessar como
            </button>
            <button v-if="tenant.planStatus !== 'SUSPENDED' && tenant.planStatus !== 'CANCELLED'"
              @click="suspendTenant" :disabled="actionLoading"
              class="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 text-red-700 text-xs font-medium rounded-md border border-red-200 transition-colors disabled:opacity-50">
              Suspender
            </button>
            <button v-else @click="activateTenant" :disabled="actionLoading"
              class="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50">
              Reativar
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-0 border-b border-slate-200">
          <button v-for="tab in TABS" :key="tab.id" @click="activeTab = tab.id"
            :class="['px-4 py-2.5 text-xs font-medium transition-colors -mb-px border-b-2',
              activeTab === tab.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900']">
            {{ tab.label }}
          </button>
        </div>

        <!-- ─── Tab: Empresa ─────────────────────────────────────────────── -->
        <div v-if="activeTab === 'empresa'" class="bg-white border border-slate-200 rounded-md p-5 space-y-5">
          <h2 class="text-sm font-medium text-slate-900 flex items-center gap-2">
            <div class="w-1 h-4 bg-slate-900 rounded-sm"></div>
            Dados da Empresa
          </h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="field-label">Nome Fantasia</label>
              <input v-model="form.empresa.name" class="field-input" placeholder="Nome da empresa" />
            </div>
            <div>
              <label class="field-label">Slug</label>
              <input v-model="form.empresa.slug" class="field-input font-mono" placeholder="slug-da-empresa" />
            </div>
            <div>
              <label class="field-label">Razão Social</label>
              <input v-model="form.empresa.razaoSocial" class="field-input" placeholder="Razão Social Ltda" />
            </div>
            <div>
              <label class="field-label">CNPJ / CPF</label>
              <input v-model="form.empresa.cpfCnpj" class="field-input font-mono" placeholder="00000000000000" maxlength="14" />
            </div>
            <div>
              <label class="field-label">Inscrição Estadual</label>
              <input v-model="form.empresa.inscricaoEstadual" class="field-input" placeholder="Isento ou número" />
            </div>
          </div>

          <h3 class="text-[10px] font-mono text-slate-500 uppercase tracking-[0.15em] pt-2">Endereço</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="field-label">CEP</label>
              <input v-model="form.empresa.zipCode" class="field-input font-mono" placeholder="00000-000" maxlength="9" />
            </div>
            <div class="sm:col-span-2 grid grid-cols-3 gap-4">
              <div class="col-span-2">
                <label class="field-label">Logradouro</label>
                <input v-model="form.empresa.address" class="field-input" placeholder="Rua, Avenida..." />
              </div>
              <div>
                <label class="field-label">Número</label>
                <input v-model="form.empresa.number" class="field-input" placeholder="123" />
              </div>
            </div>
            <div>
              <label class="field-label">Complemento</label>
              <input v-model="form.empresa.complement" class="field-input" placeholder="Sala 01" />
            </div>
            <div>
              <label class="field-label">Bairro</label>
              <input v-model="form.empresa.neighborhood" class="field-input" placeholder="Centro" />
            </div>
            <div>
              <label class="field-label">Cidade</label>
              <input v-model="form.empresa.city" class="field-input" placeholder="São Paulo" />
            </div>
            <div>
              <label class="field-label">Estado (UF)</label>
              <input v-model="form.empresa.state" class="field-input" placeholder="SP" maxlength="2" />
            </div>
          </div>

          <h3 class="text-[10px] font-mono text-slate-500 uppercase tracking-[0.15em] pt-2">Responsável</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="field-label">Nome do Responsável</label>
              <input v-model="form.empresa.ownerName" class="field-input" placeholder="Nome completo" />
            </div>
            <div>
              <label class="field-label">E-mail do Responsável</label>
              <input v-model="form.empresa.ownerEmail" type="email" class="field-input" placeholder="email@empresa.com" />
            </div>
            <div>
              <label class="field-label">Telefone</label>
              <input v-model="form.empresa.ownerPhone" class="field-input" placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <button @click="saveEmpresa" :disabled="saving.empresa"
              class="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50">
              <div v-if="saving.empresa" class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              {{ saving.empresa ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </div>

        <!-- ─── Tab: Plano & Limites ──────────────────────────────────────── -->
        <div v-if="activeTab === 'plano'" class="bg-white border border-slate-200 rounded-md p-5 space-y-5">
          <h2 class="text-sm font-medium text-slate-900 flex items-center gap-2">
            <div class="w-1 h-4 bg-slate-900 rounded-sm"></div>
            Plano &amp; Limites
          </h2>

          <!-- Plan selection -->
          <div>
            <label class="field-label mb-2">Plano</label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button v-for="p in PLANS" :key="p.name" @click="form.plano.plan = p.name"
                :class="['rounded-md border p-2.5 text-left transition-colors',
                  form.plano.plan === p.name
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 hover:border-slate-400 text-slate-700']">
                <p class="text-xs font-medium font-mono uppercase tracking-wider">{{ p.name }}</p>
                <p class="text-[11px] mt-0.5" :class="form.plano.plan === p.name ? 'text-slate-300' : 'text-slate-400'">
                  {{ p.price === 0 ? 'Grátis' : `R$ ${p.price}/mês` }}
                </p>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="field-label">Status do Plano</label>
              <select v-model="form.plano.planStatus" class="field-input">
                <option value="TRIAL">TRIAL</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <div>
              <label class="field-label">Trial termina em</label>
              <input v-model="form.plano.trialEndsAt" type="date" class="field-input" />
            </div>
            <div>
              <label class="field-label">Plano expira em</label>
              <input v-model="form.plano.planExpiresAt" type="date" class="field-input" />
            </div>
          </div>

          <h3 class="text-[10px] font-mono text-slate-500 uppercase tracking-[0.15em] pt-2">Limites Personalizados</h3>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="field-label">Máx. Usuários</label>
              <input v-model.number="form.plano.maxUsers" type="number" min="1" class="field-input" />
            </div>
            <div>
              <label class="field-label">Máx. Pedidos/mês</label>
              <input v-model.number="form.plano.maxOrders" type="number" min="1" class="field-input" />
            </div>
            <div>
              <label class="field-label">Máx. Clientes</label>
              <input v-model.number="form.plano.maxCustomers" type="number" min="1" class="field-input" />
            </div>
          </div>

          <div class="flex justify-end pt-2">
            <button @click="savePlano" :disabled="saving.plano"
              class="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50">
              <div v-if="saving.plano" class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              {{ saving.plano ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </div>

        <!-- ─── Tab: Uso ──────────────────────────────────────────────────── -->
        <div v-if="activeTab === 'uso'" class="bg-white border border-slate-200 rounded-md p-5 space-y-5">
          <h2 class="text-sm font-medium text-slate-900 flex items-center gap-2">
            <div class="w-1 h-4 bg-slate-900 rounded-sm"></div>
            Uso vs Limites
          </h2>

          <div v-if="usageLoading" class="flex items-center justify-center py-12">
            <div class="h-5 w-5 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
          </div>

          <template v-else-if="usageData">
            <!-- Alertas no topo -->
            <div v-if="usageData.alerts.length" class="space-y-1.5">
              <div v-for="(a, i) in usageData.alerts" :key="i"
                :class="['flex items-center gap-2 px-3 py-2 rounded-md text-xs',
                  a.type === 'danger'
                    ? 'bg-red-50 border border-red-100 text-red-800'
                    : 'bg-amber-50 border border-amber-100 text-amber-800']">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
                {{ a.message }}
              </div>
            </div>

            <!-- Barras de progresso por recurso -->
            <div class="space-y-4">
              <div v-for="row in [
                { key: 'users',     label: 'Usuários',          data: usageData.usage.users     },
                { key: 'orders',    label: 'Pedidos no mês',    data: usageData.usage.orders    },
                { key: 'customers', label: 'Clientes',          data: usageData.usage.customers },
              ]" :key="row.key">
                <div class="flex items-baseline justify-between mb-1.5">
                  <span class="text-xs text-slate-700">{{ row.label }}</span>
                  <span class="text-xs font-mono tabular-nums" :class="[
                    row.data.pct >= 90 ? 'text-red-700'
                      : row.data.pct >= 70 ? 'text-amber-700'
                      : 'text-slate-700'
                  ]">
                    <span class="font-medium">{{ row.data.used.toLocaleString('pt-BR') }}</span>
                    <span class="text-slate-400">/</span>
                    {{ row.data.limit >= 99999 ? '∞' : row.data.limit.toLocaleString('pt-BR') }}
                    <span class="text-slate-400 ml-1">({{ row.data.pct }}%)</span>
                  </span>
                </div>
                <div class="h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                  <div :class="['h-full transition-all',
                    row.data.pct >= 90 ? 'bg-red-500'
                      : row.data.pct >= 70 ? 'bg-amber-500'
                      : 'bg-emerald-500']"
                    :style="{ width: row.data.pct + '%' }"></div>
                </div>
              </div>
            </div>

            <!-- Datas relevantes -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <div class="text-xs">
                <p class="text-slate-400 font-mono uppercase tracking-wider text-[10px]">Trial expira em</p>
                <p class="text-slate-700 mt-0.5">{{ usageData.trialEndsAt ? new Date(usageData.trialEndsAt).toLocaleDateString('pt-BR') : '—' }}</p>
              </div>
              <div class="text-xs">
                <p class="text-slate-400 font-mono uppercase tracking-wider text-[10px]">Plano expira em</p>
                <p class="text-slate-700 mt-0.5">{{ usageData.planExpiresAt ? new Date(usageData.planExpiresAt).toLocaleDateString('pt-BR') : '—' }}</p>
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <button @click="fetchUsage"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded transition-colors">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Atualizar
              </button>
            </div>
          </template>
        </div>

        <!-- ─── Tab: Features ─────────────────────────────────────────────── -->
        <div v-if="activeTab === 'features'" class="bg-white border border-slate-200 rounded-md p-5 space-y-4">
          <div class="flex items-start justify-between">
            <h2 class="text-sm font-medium text-slate-900 flex items-center gap-2">
              <div class="w-1 h-4 bg-slate-900 rounded-sm"></div>
              Features Override
            </h2>
            <p class="text-[11px] text-slate-500 max-w-md text-right">
              Override individual de feature do plano. Útil pra casos comerciais
              (ex: liberar cartão MP pra um cliente FREE).
            </p>
          </div>

          <div v-if="featuresLoading" class="flex items-center justify-center py-12">
            <div class="h-5 w-5 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
          </div>

          <template v-else-if="featuresData">
            <div v-for="g in featuresByGroup" :key="g.name" class="space-y-1.5">
              <p class="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{{ g.name }}</p>
              <div class="border border-slate-200 rounded-md overflow-hidden">
                <div v-for="(f, i) in g.items" :key="f.key"
                  :class="['flex items-center justify-between px-3 py-2 text-xs', i > 0 ? 'border-t border-slate-100' : '']">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-slate-900 font-medium">{{ f.label }}</span>
                      <span class="text-[10px] font-mono text-slate-400">{{ f.key }}</span>
                    </div>
                    <p class="text-[11px] text-slate-500 mt-0.5">
                      Plano:
                      <span :class="f.planAllows ? 'text-emerald-700' : 'text-slate-500'">
                        {{ f.planAllows ? 'libera' : 'não libera' }}
                      </span>
                      <template v-if="f.override">
                        · Override:
                        <span :class="f.override.granted ? 'text-emerald-700' : 'text-red-700'">
                          {{ f.override.granted ? 'liberado' : 'bloqueado' }}
                        </span>
                        <template v-if="f.override.expiresAt">
                          · até <span class="font-mono">{{ new Date(f.override.expiresAt).toLocaleDateString('pt-BR') }}</span>
                        </template>
                        <template v-if="f.override.reason">
                          · "{{ f.override.reason }}"
                        </template>
                      </template>
                    </p>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0 ml-3">
                    <span :class="['inline-flex px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider',
                      f.effective ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500']">
                      {{ f.effective ? 'Ativo' : 'Bloqueado' }}
                    </span>
                    <button @click="openFeatureEdit(f)"
                      class="px-2 py-1 text-[11px] text-slate-700 border border-slate-200 hover:bg-slate-50 rounded transition-colors">
                      {{ f.override ? 'Editar' : 'Override' }}
                    </button>
                    <button v-if="f.override" @click="resetFeatureOverride(f)"
                      class="px-2 py-1 text-[11px] text-slate-500 hover:text-red-700 border border-slate-200 hover:bg-red-50 rounded transition-colors"
                      title="Remover override (volta a usar regra do plano)">
                      ↺
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Modal de edição de override de feature -->
        <div v-if="editingFeature" class="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" @click.self="closeFeatureEdit">
          <div class="bg-white rounded-md border border-slate-200 shadow-xl w-full max-w-md">
            <div class="px-5 py-4 border-b border-slate-100">
              <p class="text-[10px] font-mono text-slate-400 uppercase tracking-[0.15em]">Override de feature</p>
              <h3 class="text-sm font-medium text-slate-900 mt-0.5">{{ editingFeature.label }}</h3>
              <p class="text-[11px] text-slate-400 font-mono mt-0.5">{{ editingFeature.key }}</p>
            </div>

            <div class="px-5 py-4 space-y-4">
              <!-- Granted/blocked toggle -->
              <div>
                <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">Decisão</label>
                <div class="flex gap-2">
                  <button @click="featureForm.granted = true"
                    :class="['flex-1 px-3 py-2 rounded-md text-xs font-medium border transition-colors',
                      featureForm.granted
                        ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50']">
                    ✓ Liberar
                  </button>
                  <button @click="featureForm.granted = false"
                    :class="['flex-1 px-3 py-2 rounded-md text-xs font-medium border transition-colors',
                      !featureForm.granted
                        ? 'border-red-700 bg-red-50 text-red-800'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50']">
                    ✕ Bloquear
                  </button>
                </div>
                <p class="text-[11px] text-slate-400 mt-1.5">
                  Plano atual {{ editingFeature.planAllows ? 'já libera' : 'não libera' }} essa feature.
                  Override sobrescreve a regra do plano.
                </p>
              </div>

              <div>
                <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Motivo (opcional)</label>
                <input v-model="featureForm.reason" type="text"
                  placeholder="Ex: Negociação comercial — contrato #123"
                  class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-slate-400" />
              </div>

              <div>
                <label class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Expira em (opcional)</label>
                <input v-model="featureForm.expiresAt" type="date"
                  class="w-full border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-slate-400" />
                <p class="text-[11px] text-slate-400 mt-1">Vazio = override permanente</p>
              </div>
            </div>

            <div class="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
              <button @click="closeFeatureEdit"
                class="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors">Cancelar</button>
              <button @click="saveFeatureOverride"
                class="inline-flex items-center px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors">
                Salvar override
              </button>
            </div>
          </div>
        </div>

        <!-- ─── Tab: Atividade ────────────────────────────────────────────── -->
        <div v-if="activeTab === 'atividade'" class="bg-white border border-slate-200 rounded-md">
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 class="text-sm font-medium text-slate-900 flex items-center gap-2">
              <div class="w-1 h-4 bg-slate-900 rounded-sm"></div>
              Atividade do tenant
            </h2>
            <button v-if="activityData" @click="fetchActivity(1)"
              class="text-[11px] font-mono text-slate-500 hover:text-slate-900 uppercase tracking-wider transition-colors">
              ↻ Atualizar
            </button>
          </div>

          <div v-if="activityLoading" class="flex items-center justify-center py-12">
            <div class="h-5 w-5 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
          </div>

          <template v-else-if="activityData && activityData.data.length">
            <div class="divide-y divide-slate-100">
              <div v-for="entry in activityData.data" :key="entry.id" class="px-5 py-3 hover:bg-slate-50/60 transition-colors">
                <div class="flex items-start gap-3">
                  <span class="inline-flex px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                    {{ entry.action }}
                  </span>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs text-slate-700">
                      <span v-if="entry.user" class="font-medium">{{ entry.user.name }}</span>
                      <span v-else class="text-slate-400 italic">Sistema</span>
                      <span v-if="entry.resourceType" class="text-slate-500"> · {{ entry.resourceType }}<span v-if="entry.resourceId" class="font-mono">#{{ entry.resourceId }}</span></span>
                    </p>
                    <p v-if="entry.description" class="text-[11px] text-slate-500 mt-0.5 truncate">{{ entry.description }}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-[11px] font-mono text-slate-500 tabular-nums">
                      {{ new Date(entry.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }}
                    </p>
                    <p v-if="entry.ipAddress" class="text-[10px] font-mono text-slate-400 mt-0.5">{{ entry.ipAddress }}</p>
                  </div>
                </div>
              </div>
            </div>
            <!-- Paginação simples -->
            <div v-if="activityData.total > activityData.pageSize" class="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span class="text-slate-500">
                Página {{ activityData.page }} · {{ activityData.total }} entradas
              </span>
              <div class="flex gap-1">
                <button @click="fetchActivity(activityData.page - 1)" :disabled="activityData.page <= 1"
                  class="px-3 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50">← Anterior</button>
                <button @click="fetchActivity(activityData.page + 1)" :disabled="activityData.page * activityData.pageSize >= activityData.total"
                  class="px-3 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50">Próxima →</button>
              </div>
            </div>
          </template>
          <div v-else-if="activityData" class="text-center py-12 text-xs text-slate-400">
            Nenhuma atividade registrada pra esse tenant.
            <p class="mt-1 text-[11px]">Auditoria depende do plano do tenant ter <span class="font-mono">hasAudit=true</span>.</p>
          </div>
        </div>

        <!-- ─── Tab: Cobrança ─────────────────────────────────────────────── -->
        <div v-if="activeTab === 'cobranca'" class="space-y-4">

          <!-- Config status -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="bg-white border border-slate-200 rounded-md p-4 flex items-center gap-3 sm:col-span-2">
              <div :class="['w-10 h-10 rounded-xl flex items-center justify-center shrink-0', billingConfig?.configured ? 'bg-emerald-100' : 'bg-red-100']">
                <svg class="w-5 h-5" :class="billingConfig?.configured ? 'text-emerald-600' : 'text-red-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path v-if="billingConfig?.configured" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">API Key Asaas</p>
                <p class="font-extrabold" :class="billingConfig?.configured ? 'text-emerald-600' : 'text-red-500'">
                  {{ billingConfig?.configured ? `Configurada (${billingConfig?.env})` : 'Não configurada' }}
                </p>
              </div>
            </div>
            <div class="bg-white border border-slate-200 rounded-md p-4 flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              </div>
              <button @click="fetchBilling" class="text-sm font-bold text-indigo-600 hover:underline">Atualizar dados</button>
            </div>
          </div>

          <!-- Customer card -->
          <div class="bg-white border border-slate-200 rounded-md p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="font-extrabold text-slate-800">Cliente Asaas</h3>
                <p v-if="tenant.asaasCustomerId" class="text-xs font-mono text-slate-500 mt-0.5">{{ tenant.asaasCustomerId }}</p>
                <p v-else class="text-xs text-slate-400 mt-0.5">Nenhum cliente criado</p>
              </div>
              <button v-if="!tenant.asaasCustomerId"
                @click="tenant.cpfCnpj ? createCustomer() : showAlert('warning', 'CPF/CNPJ obrigatório', 'Cadastre o CPF/CNPJ na aba Empresa antes de criar o cliente no Asaas.')"
                :disabled="billingLoading.customer"
                class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-60">
                {{ billingLoading.customer ? 'Criando...' : 'Criar cliente' }}
              </button>
            </div>
            <div v-if="tenant.asaasCustomerId" class="flex items-center gap-2">
              <span class="w-2 h-2 bg-emerald-500 rounded-full"></span>
              <span class="text-sm font-bold text-emerald-700">Cadastrado no Asaas</span>
            </div>
          </div>

          <!-- Subscription card -->
          <div class="bg-white border border-slate-200 rounded-md p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="font-extrabold text-slate-800">Assinatura</h3>
                <p v-if="tenant.asaasSubscriptionId" class="text-xs font-mono text-slate-500 mt-0.5">{{ tenant.asaasSubscriptionId }}</p>
                <p v-else class="text-xs text-slate-400 mt-0.5">Sem assinatura ativa</p>
              </div>
              <div class="flex gap-2">
                <button v-if="tenant.asaasCustomerId && tenant.plan !== 'FREE'" @click="openSubscriptionModal"
                  class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-100">
                  {{ tenant.asaasSubscriptionId ? 'Alterar' : 'Assinar' }}
                </button>
                <button v-if="tenant.asaasSubscriptionId" @click="cancelSubscription"
                  :disabled="billingLoading.cancel"
                  class="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold rounded-xl border border-red-100 transition-all disabled:opacity-60">
                  {{ billingLoading.cancel ? 'Cancelando...' : 'Cancelar' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Subscription interna + Timeline de eventos do gateway -->
          <div class="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div class="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-1 h-4 bg-slate-900 rounded-sm"></div>
                <h3 class="text-sm font-medium text-slate-900">Assinatura interna · timeline</h3>
              </div>
              <button @click="fetchSubscription" :disabled="subscriptionLoading"
                class="text-[11px] font-mono text-slate-500 hover:text-slate-900 uppercase tracking-wider transition-colors disabled:opacity-50">
                {{ subscriptionLoading ? 'Carregando...' : 'Atualizar' }}
              </button>
            </div>

            <!-- Resumo da Subscription -->
            <div v-if="subscription" class="px-5 py-3.5 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p class="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Status</p>
                <span :class="['inline-flex mt-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider',
                  subscription.status === 'ACTIVE'    ? 'bg-emerald-50 text-emerald-700' :
                  subscription.status === 'TRIALING'  ? 'bg-amber-50 text-amber-700' :
                  subscription.status === 'PAST_DUE'  ? 'bg-red-50 text-red-700' :
                  subscription.status === 'CANCELLED' ? 'bg-slate-100 text-slate-500' :
                                                        'bg-slate-100 text-slate-600']">
                  {{ subscription.status }}
                </span>
              </div>
              <div>
                <p class="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Plano</p>
                <p class="text-xs font-mono text-slate-700 mt-1.5">{{ subscription.planName }}</p>
              </div>
              <div>
                <p class="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Período atual</p>
                <p class="text-xs text-slate-700 mt-1.5 tabular-nums">
                  {{ subscription.currentPeriodEnd
                      ? `Até ${new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}`
                      : '—' }}
                </p>
              </div>
              <div>
                <p class="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Gateway</p>
                <p class="text-xs font-mono text-slate-700 mt-1.5">{{ subscription.gatewayName || '—' }}</p>
              </div>
            </div>

            <!-- Timeline de eventos -->
            <div v-if="subscriptionLoading" class="px-5 py-8 text-center">
              <div class="inline-block h-4 w-4 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"></div>
            </div>
            <div v-else-if="!subscription" class="px-5 py-8 text-center text-xs text-slate-400">
              Sem assinatura interna registrada. Será criada após a primeira cobrança.
            </div>
            <div v-else-if="subscriptionEvents.length === 0" class="px-5 py-8 text-center text-xs text-slate-400">
              Sem eventos ainda. Webhooks do gateway aparecem aqui assim que chegarem.
            </div>
            <ul v-else class="divide-y divide-slate-50">
              <li v-for="ev in subscriptionEvents" :key="ev.id"
                class="px-5 py-3 flex items-start gap-3 hover:bg-slate-50/60 transition-colors">
                <!-- Bolinha colorida do evento -->
                <span :class="['mt-1.5 w-1.5 h-1.5 rounded-full shrink-0',
                  ev.eventType.includes('PAYMENT_CONFIRMED') || ev.eventType.includes('PAID')   ? 'bg-emerald-500' :
                  ev.eventType.includes('OVERDUE')          || ev.eventType.includes('FAILED') ? 'bg-red-500'     :
                  ev.eventType.includes('TRIAL_EXPIRED')    || ev.eventType.includes('SUSPEND')? 'bg-amber-500'   :
                  ev.eventType.includes('CANCEL')                                              ? 'bg-slate-400'   :
                                                                                                 'bg-slate-300']"></span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline gap-2 flex-wrap">
                    <span class="text-xs font-medium text-slate-800">{{ ev.eventType }}</span>
                    <span v-if="ev.fromStatus !== ev.toStatus" class="text-[10px] font-mono text-slate-400">
                      {{ ev.fromStatus }} → {{ ev.toStatus }}
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-400 font-mono mt-0.5 tabular-nums">
                    {{ new Date(ev.createdAt).toLocaleString('pt-BR') }}
                    <span v-if="ev.performedBy" class="ml-2">· {{ ev.performedBy }}</span>
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <!-- Invoices -->
          <div v-if="tenant.asaasCustomerId" class="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 class="font-extrabold text-slate-800">Faturas</h3>
              <button @click="fetchInvoices" class="text-xs text-indigo-600 font-bold hover:underline">Carregar</button>
            </div>
            <div v-if="invoicesLoading" class="px-6 py-8 text-center">
              <div class="inline-block h-5 w-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
            <div v-else-if="invoices.length === 0" class="px-6 py-8 text-center text-slate-400 text-sm italic">
              Nenhuma fatura carregada.
            </div>
            <div v-else class="divide-y divide-slate-50">
              <div v-for="inv in invoices" :key="inv.id" class="px-6 py-4 flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <span :class="['px-2.5 py-0.5 rounded-full text-xs font-black', INVOICE_STATUS[inv.status] || 'bg-slate-100 text-slate-500']">{{ inv.status }}</span>
                  <span class="text-xs text-slate-500">Vence: {{ inv.dueDate }}</span>
                  <span v-if="inv.paymentDate" class="text-xs text-emerald-600 font-bold">Pago: {{ inv.paymentDate }}</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="font-extrabold text-slate-800">R$ {{ inv.value?.toFixed(2) }}</span>
                  <a v-if="inv.invoiceUrl" :href="inv.invoiceUrl" target="_blank"
                    class="text-xs text-indigo-600 font-bold hover:underline">Ver →</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ─── Tab: Acesso Admin ─────────────────────────────────────────── -->
        <div v-if="activeTab === 'acesso'" class="bg-white border border-slate-200 rounded-md p-6 space-y-5">
          <h2 class="text-sm font-medium text-slate-900 flex items-center gap-2">
            <div class="w-1 h-4 bg-slate-900 rounded-sm"></div>
            Acesso Admin do Tenant
          </h2>

          <div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-start gap-2">
            <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Se já existe um usuário com este e-mail neste tenant, a senha será redefinida.
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <label class="field-label">Nome</label>
              <input v-model="adminForm.name" class="field-input" placeholder="Nome do administrador" />
            </div>
            <div>
              <label class="field-label">E-mail</label>
              <input v-model="adminForm.email" type="email" class="field-input" placeholder="admin@empresa.com" />
            </div>
            <div>
              <label class="field-label">Senha (mínimo 6 caracteres)</label>
              <input v-model="adminForm.password" type="password" class="field-input" placeholder="••••••••" />
            </div>
          </div>

          <div v-if="adminResult" class="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
            <p class="text-emerald-800 font-extrabold text-sm flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Usuário criado / atualizado com sucesso!
            </p>
            <div class="mt-2 space-y-1 text-xs text-emerald-700 font-mono bg-emerald-100/60 p-3 rounded-xl">
              <p><span class="font-bold text-emerald-900">Nome:</span> {{ adminResult.name }}</p>
              <p><span class="font-bold text-emerald-900">E-mail:</span> {{ adminResult.email }}</p>
              <p><span class="font-bold text-emerald-900">Role:</span> {{ adminResult.role }}</p>
            </div>
          </div>

          <div class="flex justify-end">
            <button @click="createAdmin" :disabled="saving.admin"
              class="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50">
              <div v-if="saving.admin" class="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              {{ saving.admin ? 'Processando...' : 'Criar / Redefinir Acesso' }}
            </button>
          </div>
        </div>

      </template>

      <!-- Not found -->
      <div v-else class="text-center py-20 text-slate-400 font-medium italic">
        Tenant não encontrado.
      </div>
    </div>

    <!-- Modal: Ativar Assinatura -->
    <div v-if="subscriptionModal" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" @click.self="subscriptionModal = false">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
        <h3 class="text-lg font-extrabold text-slate-800 mb-1">Ativar Assinatura</h3>
        <p class="text-sm text-slate-500 mb-5">
          Plano <strong class="text-indigo-600">{{ tenant?.plan }}</strong>
        </p>
        <div class="space-y-2 mb-5">
          <button v-for="bt in ['PIX', 'BOLETO']" :key="bt" @click="selectedBillingType = bt"
            :class="['w-full border-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all text-left',
              selectedBillingType === bt ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md shadow-indigo-100' : 'border-slate-200 text-slate-700 hover:border-slate-300']">
            {{ bt === 'PIX' ? '⚡ PIX (recomendado)' : '🟦 Boleto Bancário' }}
          </button>
        </div>
        <div class="flex gap-2">
          <button @click="subscriptionModal = false" class="flex-1 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700">Cancelar</button>
          <button @click="confirmSubscription" :disabled="!selectedBillingType || billingLoading.subscription"
            class="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95">
            {{ billingLoading.subscription ? 'Gerando...' : 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>

    <AlertModal :show="alert.show" :type="alert.type" :title="alert.title" :message="alert.message" @close="alert.show = false" />
  </SidebarLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import SidebarLayout from '../components/SidebarLayout.vue'
import AlertModal from '../components/AlertModal.vue'
import { apiFetch } from '../utils/api'

const router = useRouter()
const route = useRoute()
const tenantId = Number(route.params.id)

const TABS = [
  { id: 'empresa',    label: 'Empresa' },
  { id: 'plano',      label: 'Plano & Limites' },
  { id: 'uso',        label: 'Uso' },
  { id: 'features',   label: 'Features' },
  { id: 'cobranca',   label: 'Cobrança' },
  { id: 'atividade',  label: 'Atividade' },
  { id: 'acesso',     label: 'Acesso Admin' },
]
const activeTab = ref('empresa')

const STATUS_COLORS: Record<string, string> = {
  TRIAL: 'bg-amber-50 text-amber-700', ACTIVE: 'bg-emerald-50 text-emerald-700',
  SUSPENDED: 'bg-red-50 text-red-700', CANCELLED: 'bg-slate-100 text-slate-500',
}
const INVOICE_STATUS: Record<string, string> = {
  CONFIRMED: 'bg-emerald-50 text-emerald-700', RECEIVED: 'bg-emerald-50 text-emerald-700',
  PENDING: 'bg-amber-50 text-amber-700', OVERDUE: 'bg-red-50 text-red-700',
  REFUNDED: 'bg-slate-100 text-slate-500',
}
const PLANS = [
  { name: 'FREE', price: 0 }, { name: 'BASIC', price: 79 },
  { name: 'PRO', price: 179 }, { name: 'ENTERPRISE', price: 349 },
]

const tenant = ref<any>(null)
const pageLoading = ref(true)
const actionLoading = ref(false)

// Forms
const form = reactive({
  empresa: {
    name: '', slug: '', razaoSocial: '', cpfCnpj: '', inscricaoEstadual: '',
    zipCode: '', address: '', number: '', complement: '', neighborhood: '', city: '', state: '',
    ownerName: '', ownerEmail: '', ownerPhone: '',
  },
  plano: {
    plan: 'FREE', planStatus: 'TRIAL',
    trialEndsAt: '', planExpiresAt: '',
    maxUsers: 1, maxOrders: 30, maxCustomers: 50,
  },
})
const saving = reactive({ empresa: false, plano: false, admin: false })

// Admin form
const adminForm = reactive({ name: '', email: '', password: '' })
const adminResult = ref<any>(null)

// Billing
// Uso (limites vs consumo + alertas) — carregado quando a tab "Uso" é aberta
interface UsageDetail { used: number; limit: number; pct: number }
interface UsageInfo {
  plan: string
  planStatus: string
  trialEndsAt?: string | null
  planExpiresAt?: string | null
  usage: { users: UsageDetail; orders: UsageDetail; customers: UsageDetail }
  alerts: { type: 'warning' | 'danger'; message: string }[]
}
const usageData = ref<UsageInfo | null>(null)
const usageLoading = ref(false)

// Impersonate — abre ERP do cliente em nova aba com token temporário
const impersonating = ref(false)
const impersonate = async () => {
  if (impersonating.value) return
  impersonating.value = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}/impersonate`, { method: 'POST' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showAlert('error', 'Falha no impersonate', err.message || 'Não foi possível gerar o token.')
      return
    }
    const data = await res.json()
    // VITE_ERP_URL pode ser configurado via env build-time. Default: localhost:5173.
    const erpBase = (import.meta.env.VITE_ERP_URL as string) || 'http://localhost:5173'
    // Abre nova aba com o token na query — o ERP detecta e armazena no localStorage
    window.open(`${erpBase}/?impersonate=${encodeURIComponent(data.token)}`, '_blank')
  } catch {
    showAlert('error', 'Erro de conexão', 'Falha ao gerar token de impersonate.')
  } finally {
    impersonating.value = false
  }
}

const fetchUsage = async () => {
  usageLoading.value = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}/usage`)
    if (res.ok) usageData.value = await res.json()
  } finally { usageLoading.value = false }
}

// Carrega uso ao trocar pra aba Uso (lazy — não bate na rota toda vez que abre detail)
watch(() => activeTab.value, (tab) => {
  if (tab === 'uso'        && !usageData.value)     fetchUsage()
  if (tab === 'features'   && !featuresData.value)  fetchFeatures()
  if (tab === 'atividade'  && !activityData.value)  fetchActivity()
})

// ── Atividade (auditoria filtrada por tenant) ─────────────────────────────
interface AuditEntry {
  id: number
  action: string
  resourceType: string
  resourceId: number | null
  description: string | null
  ipAddress: string | null
  createdAt: string
  user: { id: number; name: string; email: string } | null
}
interface ActivityResponse { data: AuditEntry[]; total: number; page: number; pageSize: number }
const activityData = ref<ActivityResponse | null>(null)
const activityLoading = ref(false)

const fetchActivity = async (page = 1) => {
  activityLoading.value = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}/activity?page=${page}&pageSize=30`)
    if (res.ok) activityData.value = await res.json()
  } finally { activityLoading.value = false }
}

// ── Feature overrides ──────────────────────────────────────────────────────
interface FeatureRow {
  key: string
  label: string
  group: string
  planAllows: boolean
  override: { granted: boolean; reason: string | null; expiresAt: string | null; createdAt: string } | null
  effective: boolean
}
interface FeaturesResponse { plan: string; features: FeatureRow[] }

const featuresData = ref<FeaturesResponse | null>(null)
const featuresLoading = ref(false)
const editingFeature = ref<FeatureRow | null>(null)
const featureForm = reactive({ granted: true, reason: '', expiresAt: '' })

const fetchFeatures = async () => {
  featuresLoading.value = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}/features`)
    if (res.ok) featuresData.value = await res.json()
  } finally { featuresLoading.value = false }
}

// Agrupa pra UI: Operacionais, Orçamento, Gestão, Integrações, Ecommerce
const featuresByGroup = computed(() => {
  if (!featuresData.value) return [] as { name: string; items: FeatureRow[] }[]
  const order: string[] = []
  const map = new Map<string, FeatureRow[]>()
  for (const f of featuresData.value.features) {
    if (!map.has(f.group)) { order.push(f.group); map.set(f.group, []) }
    map.get(f.group)!.push(f)
  }
  return order.map((name) => ({ name, items: map.get(name)! }))
})

const openFeatureEdit = (f: FeatureRow) => {
  editingFeature.value = f
  // Pré-preenche com override existente, ou inverte o que o plano dá
  // (libera se plano bloqueia, bloqueia se plano libera).
  featureForm.granted   = f.override ? f.override.granted : !f.planAllows
  featureForm.reason    = f.override?.reason || ''
  featureForm.expiresAt = f.override?.expiresAt ? f.override.expiresAt.substring(0, 10) : ''
}
const closeFeatureEdit = () => { editingFeature.value = null }

const saveFeatureOverride = async () => {
  if (!editingFeature.value) return
  const res = await apiFetch(`/api/tenants/${tenantId}/features/${editingFeature.value.key}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      granted:   featureForm.granted,
      reason:    featureForm.reason || null,
      expiresAt: featureForm.expiresAt || null,
    }),
  })
  if (res.ok) {
    closeFeatureEdit()
    await fetchFeatures()
  } else {
    showAlert('error', 'Erro', 'Não foi possível salvar o override.')
  }
}

const resetFeatureOverride = async (f: FeatureRow) => {
  const res = await apiFetch(`/api/tenants/${tenantId}/features/${f.key}/reset`, { method: 'PATCH' })
  if (res.ok) await fetchFeatures()
  else showAlert('error', 'Erro', 'Não foi possível remover o override.')
}

const billingConfig = ref<any>(null)
const invoices = ref<any[]>([])
const invoicesLoading = ref(false)
const subscriptionModal = ref(false)
const selectedBillingType = ref('PIX')
const billingLoading = reactive({ customer: false, cancel: false, subscription: false })

// Subscription interna (Subscription + SubscriptionEvents) — fonte de verdade
// local, independente do Asaas. /api/tenants/:id/subscription.
interface SubEvent {
  id: string
  eventType: string
  fromStatus: string
  toStatus: string
  performedBy: string | null
  payload: any
  createdAt: string
}
interface SubData {
  id: string
  status: string
  planName: string
  trialEndsAt: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelledAt: string | null
  gatewayName: string | null
  gatewayCustomerId: string | null
  gatewaySubscriptionId: string | null
  createdAt: string
  updatedAt: string
}
const subscription = ref<SubData | null>(null)
const subscriptionEvents = ref<SubEvent[]>([])
const subscriptionLoading = ref(false)

// Alert
const alert = ref({ show: false, type: 'error' as 'error' | 'warning' | 'success', title: '', message: '' })
const showAlert = (type: 'error' | 'warning' | 'success', title: string, message: string) => {
  alert.value = { show: true, type, title, message }
}

const parseError = async (res: Response): Promise<string> => {
  try {
    const err = await res.json()
    const msg = err?.message || err?.error || 'Erro desconhecido'
    return Array.isArray(msg) ? msg.join(', ') : String(msg)
  } catch { return `Erro ${res.status}` }
}

// Populate forms from tenant data
const populateForms = (t: any) => {
  form.empresa.name = t.name || ''
  form.empresa.slug = t.slug || ''
  form.empresa.razaoSocial = t.razaoSocial || ''
  form.empresa.cpfCnpj = t.cpfCnpj || ''
  form.empresa.inscricaoEstadual = t.inscricaoEstadual || ''
  form.empresa.zipCode = t.zipCode || ''
  form.empresa.address = t.address || ''
  form.empresa.number = t.number || ''
  form.empresa.complement = t.complement || ''
  form.empresa.neighborhood = t.neighborhood || ''
  form.empresa.city = t.city || ''
  form.empresa.state = t.state || ''
  form.empresa.ownerName = t.ownerName || ''
  form.empresa.ownerEmail = t.ownerEmail || ''
  form.empresa.ownerPhone = t.ownerPhone || ''

  form.plano.plan = t.plan || 'FREE'
  form.plano.planStatus = t.planStatus || 'TRIAL'
  form.plano.trialEndsAt = t.trialEndsAt ? t.trialEndsAt.split('T')[0] : ''
  form.plano.planExpiresAt = t.planExpiresAt ? t.planExpiresAt.split('T')[0] : ''
  form.plano.maxUsers = t.maxUsers ?? 1
  form.plano.maxOrders = t.maxOrders ?? 30
  form.plano.maxCustomers = t.maxCustomers ?? 50
}

const fetchTenant = async () => {
  pageLoading.value = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}`)
    if (res.ok) {
      tenant.value = await res.json()
      populateForms(tenant.value)
    } else {
      tenant.value = null
    }
  } finally {
    pageLoading.value = false
  }
}

const fetchBilling = async () => {
  const res = await apiFetch('/api/billing/config')
  if (res.ok) billingConfig.value = await res.json()
}

const fetchInvoices = async () => {
  invoicesLoading.value = true
  invoices.value = []
  try {
    const res = await apiFetch(`/api/billing/invoices/${tenantId}`)
    if (res.ok) invoices.value = await res.json()
    else showAlert('error', 'Erro ao carregar faturas', await parseError(res))
  } finally {
    invoicesLoading.value = false
  }
}

// Carrega Subscription (interna) + timeline de eventos do gateway. Não falha
// silenciosamente — mas como o tenant pode ainda não ter Subscription, aceita
// retorno { subscription: null, events: [] } como caso normal.
const fetchSubscription = async () => {
  subscriptionLoading.value = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}/subscription`)
    if (res.ok) {
      const data = await res.json()
      subscription.value = data.subscription
      subscriptionEvents.value = data.events || []
    }
  } finally {
    subscriptionLoading.value = false
  }
}

const saveEmpresa = async () => {
  saving.empresa = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.empresa),
    })
    if (res.ok) {
      tenant.value = { ...tenant.value, ...form.empresa }
      showAlert('success', 'Salvo!', 'Dados da empresa atualizados com sucesso.')
    } else {
      showAlert('error', 'Erro ao salvar', await parseError(res))
    }
  } finally {
    saving.empresa = false
  }
}

const savePlano = async () => {
  saving.plano = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.plano),
    })
    if (res.ok) {
      tenant.value = { ...tenant.value, ...form.plano }
      showAlert('success', 'Salvo!', 'Plano atualizado com sucesso.')
    } else {
      showAlert('error', 'Erro ao salvar', await parseError(res))
    }
  } finally {
    saving.plano = false
  }
}

const createAdmin = async () => {
  if (!adminForm.name || !adminForm.email || !adminForm.password) {
    showAlert('warning', 'Campos obrigatórios', 'Preencha nome, e-mail e senha.')
    return
  }
  saving.admin = true
  adminResult.value = null
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}/admin-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminForm),
    })
    if (res.ok) {
      adminResult.value = await res.json()
    } else {
      showAlert('error', 'Erro ao criar usuário', await parseError(res))
    }
  } finally {
    saving.admin = false
  }
}

const suspendTenant = async () => {
  actionLoading.value = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}/suspend`, { method: 'PATCH' })
    if (res.ok) {
      await fetchTenant()
      showAlert('success', 'Suspenso', 'Tenant suspenso com sucesso.')
    } else {
      showAlert('error', 'Erro', await parseError(res))
    }
  } finally {
    actionLoading.value = false
  }
}

const activateTenant = async () => {
  actionLoading.value = true
  try {
    const res = await apiFetch(`/api/tenants/${tenantId}/activate`, { method: 'PATCH' })
    if (res.ok) {
      await fetchTenant()
      showAlert('success', 'Reativado', 'Tenant reativado com sucesso.')
    } else {
      showAlert('error', 'Erro', await parseError(res))
    }
  } finally {
    actionLoading.value = false
  }
}

const createCustomer = async () => {
  billingLoading.customer = true
  try {
    const res = await apiFetch(`/api/billing/customers/${tenantId}`, { method: 'POST' })
    if (res.ok) {
      await fetchTenant()
      showAlert('success', 'Cliente criado!', 'Cliente Asaas criado com sucesso.')
    } else {
      showAlert('error', 'Erro ao criar cliente', await parseError(res))
    }
  } finally {
    billingLoading.customer = false
  }
}

const openSubscriptionModal = () => {
  selectedBillingType.value = 'PIX'
  subscriptionModal.value = true
}

const confirmSubscription = async () => {
  billingLoading.subscription = true
  try {
    const res = await apiFetch(`/api/billing/subscriptions/${tenantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billingType: selectedBillingType.value }),
    })
    if (res.ok) {
      subscriptionModal.value = false
      await fetchTenant()
      showAlert('success', 'Assinatura ativada!', `Assinatura ${selectedBillingType.value} criada com sucesso.`)
    } else {
      showAlert('error', 'Erro na Assinatura', await parseError(res))
    }
  } finally {
    billingLoading.subscription = false
  }
}

const cancelSubscription = async () => {
  billingLoading.cancel = true
  try {
    const res = await apiFetch(`/api/billing/subscriptions/${tenantId}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchTenant()
      showAlert('success', 'Cancelada', 'Assinatura cancelada com sucesso.')
    } else {
      showAlert('error', 'Erro ao cancelar', await parseError(res))
    }
  } finally {
    billingLoading.cancel = false
  }
}

onMounted(async () => {
  await fetchTenant()
  fetchBilling()
  fetchSubscription()
})
</script>

<style scoped>
@reference "tailwindcss";

.field-label {
  @apply block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1;
}
.field-input {
  @apply w-full px-3 py-2 rounded-md bg-white border border-slate-200 focus:outline-none focus:border-slate-400 transition-colors text-slate-800 text-xs;
}
</style>
