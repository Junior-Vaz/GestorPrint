/**
 * Wrapper centralizado de fetch que injeta o token JWT automaticamente.
 * Redireciona para /login em caso de 401.
 *
 * Opção `silentOn403`: quando a página chama um endpoint gated mas a feature
 * é "extra" (ex: HomeView mostra relatórios SE o plano tiver, mas não trava
 * a página se não tiver), passe `silentOn403: true` pra suprimir o popup
 * "Recurso não disponível". O Response 403 ainda chega normal pro caller
 * tratar com `if (!res.ok)`. Use só pra fetches secundários — chamadas que
 * o usuário disparou explicitamente devem mostrar o alerta normal.
 */
export interface ApiFetchOptions extends RequestInit {
  silentOn403?: boolean
}

export async function apiFetch(url: string, options: ApiFetchOptions = {}): Promise<Response> {
  const token = localStorage.getItem('gp_token')
  const { silentOn403, ...fetchOptions } = options

  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  // Mescla com headers existentes (os explícitos têm prioridade)
  const mergedHeaders: Record<string, string> = {
    ...headers,
    ...(fetchOptions.headers as Record<string, string> || {}),
  }

  const response = await fetch(url, { ...fetchOptions, headers: mergedHeaders })

  if (response.status === 401) {
    localStorage.removeItem('gp_token')
    localStorage.removeItem('gp_user')
    window.location.href = '/login'
  }

  if (response.status === 403) {
    response.clone().json().then((body: any) => {
      const msg = body?.message || 'Funcionalidade não disponível no seu plano atual.'
      // Account suspended/cancelled during active session → force logout
      // (acontece independente do silentOn403 — segurança vem antes de UX)
      if (msg.includes('suspensa') || msg.includes('cancelada')) {
        localStorage.removeItem('gp_token')
        localStorage.removeItem('gp_user')
        sessionStorage.setItem('suspended_msg', msg)
        window.location.href = '/login'
        return
      }
      // Só dispara o popup "Recurso não disponível" se a chamada foi explícita
      // (silentOn403 não pediu pra suprimir).
      if (!silentOn403) {
        window.dispatchEvent(new CustomEvent('plan:limit', { detail: msg }))
      }
    }).catch(() => {})
  }

  return response
}

/**
 * Parse defensivo de Response.json() — retorna fallback se o body estiver
 * vazio ou inválido em vez de jogar SyntaxError. Usar em call sites que
 * só precisam dos dados quando válidos (dashboards, listas que toleram
 * vazio). NÃO usar quando precisa propagar erro de parse pra UI.
 *
 *   const data = await safeJson(res, {})        // fallback objeto vazio
 *   const list = await safeJson<any[]>(res, []) // fallback array vazio
 *
 * Por que existe: backend ocasionalmente retorna 200 com body vazio
 * (ex: middleware curtando, proxy reverso, response truncado pelo
 * helmet+CSP). Sem isso, o `.json()` joga e quebra o fluxo de fetch
 * mesmo quando os outros endpoints respondem certo.
 */
export async function safeJson<T = any>(res: Response, fallback: T): Promise<T> {
  try {
    const text = await res.text()
    if (!text) return fallback
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}
