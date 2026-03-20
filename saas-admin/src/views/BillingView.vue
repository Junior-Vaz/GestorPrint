<template>
  <SidebarLayout>
    <div class="p-6">
      <div class="max-w-2xl mx-auto mt-12 text-center">
        <!-- Icon -->
        <div class="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-2xl mb-5">
          <svg class="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
          </svg>
        </div>

        <h2 class="text-xl font-bold text-slate-800">Cobrança Recorrente — Asaas</h2>
        <p class="text-slate-500 mt-2 text-sm leading-relaxed">
          Esta seção irá integrar a cobrança automática mensal dos assinantes via <strong class="text-slate-700">Asaas</strong>,
          o gateway de pagamentos SaaS escolhido para o GestorPrint.
        </p>

        <!-- Planned features -->
        <div class="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-left overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100">
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wide">Funcionalidades Planejadas</p>
          </div>
          <ul class="divide-y divide-slate-100">
            <li v-for="feature in PLANNED_FEATURES" :key="feature.title" class="px-5 py-3.5 flex items-start gap-3">
              <span class="mt-0.5 w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <svg class="w-2.5 h-2.5 text-slate-400" fill="currentColor" viewBox="0 0 8 8">
                  <circle cx="4" cy="4" r="3"/>
                </svg>
              </span>
              <div>
                <p class="text-sm font-semibold text-slate-700">{{ feature.title }}</p>
                <p class="text-xs text-slate-400 mt-0.5">{{ feature.description }}</p>
              </div>
            </li>
          </ul>
        </div>

        <!-- Asaas info -->
        <div class="mt-6 bg-indigo-50 rounded-2xl px-5 py-4 text-left border border-indigo-100">
          <p class="text-xs font-bold text-indigo-700 mb-2">Sobre o Asaas</p>
          <p class="text-xs text-indigo-600 leading-relaxed">
            O Asaas é um gateway de pagamentos brasileiro focado em SaaS e cobranças recorrentes.
            Suporta PIX, boleto e cartão com criação automática de assinaturas via API REST.
            A integração será feita no backend (<code class="bg-indigo-100 px-1 rounded">backend/src/billing/</code>)
            e os webhooks de pagamento atualizarão automaticamente o <code class="bg-indigo-100 px-1 rounded">planStatus</code> do tenant.
          </p>
        </div>

        <p class="text-xs text-slate-400 mt-6">
          Em implementação — módulo <code>billing</code> no backend ainda não criado.
        </p>
      </div>
    </div>
  </SidebarLayout>
</template>

<script setup lang="ts">
import SidebarLayout from '../components/SidebarLayout.vue'

/**
 * ASAAS INTEGRATION ROADMAP
 *
 * Backend (futuro: backend/src/billing/):
 *   POST /api/billing/customers         → criar cliente no Asaas
 *   POST /api/billing/subscriptions     → criar assinatura recorrente (mensal)
 *   POST /api/billing/webhooks          → receber notificações de pagamento
 *   GET  /api/billing/invoices/:tenantId → listar faturas de um tenant
 *
 * Asaas API base URL: https://sandbox.asaas.com/api/v3 (sandbox) | https://api.asaas.com/v3 (prod)
 * Auth: header 'access_token: $aact_...'
 *
 * Fluxo de cobrança:
 *   1. Tenant cadastrado → criar Customer no Asaas (POST /customers)
 *   2. Plano selecionado → criar Subscription (POST /subscriptions) com billingType=PIX/BOLETO
 *   3. Asaas gera cobranças mensais automaticamente
 *   4. Webhook PAYMENT_CONFIRMED → atualizar tenant.planStatus = 'ACTIVE'
 *   5. Webhook PAYMENT_OVERDUE → atualizar tenant.planStatus = 'SUSPENDED'
 *
 * Preços dos planos (definir em BillingModule):
 *   FREE       → R$ 0    (sem cobrança)
 *   BASIC      → R$ 49   (mensal)
 *   PRO        → R$ 149  (mensal)
 *   ENTERPRISE → R$ 299  (mensal)
 */

const PLANNED_FEATURES = [
  {
    title: 'Criar cliente no Asaas',
    description: 'Ao cadastrar um tenant, criar automaticamente o customer no Asaas com dados do responsável.',
  },
  {
    title: 'Assinaturas Recorrentes',
    description: 'Gerar assinatura mensal automática baseada no plano escolhido (BASIC, PRO, ENTERPRISE).',
  },
  {
    title: 'Webhooks de Pagamento',
    description: 'Receber eventos do Asaas e atualizar planStatus do tenant automaticamente.',
  },
  {
    title: 'Listagem de Faturas',
    description: 'Visualizar histórico de cobranças e status de pagamento por tenant.',
  },
  {
    title: 'Cancelamento / Downgrade',
    description: 'Cancelar ou rebaixar assinaturas ativas diretamente do painel.',
  },
  {
    title: 'Notificações por E-mail',
    description: 'Avisos de vencimento, inadimplência e confirmação de pagamento para o responsável.',
  },
]
</script>
