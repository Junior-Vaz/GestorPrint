/**
 * Centralized fetch wrapper for the SaaS Admin panel.
 * Uses 'sa_token' (separate from the main frontend's 'gp_token').
 * Auto-injects JWT and redirects to /login on 401.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('sa_token')

  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const mergedHeaders: Record<string, string> = {
    ...headers,
    ...(options.headers as Record<string, string> || {}),
  }

  const response = await fetch(url, { ...options, headers: mergedHeaders })

  // Só desloga em 401 (token inválido/expirado).
  // 403 (Forbidden) NÃO deve deslogar — pode ser endpoint específico bloqueado
  // (ex: tenant suspenso ao impersonar, plano TRIAL sem feature). O caller
  // trata localmente com mensagem amigável. Antes desloghávamos junto e o
  // super admin perdia a sessão ao tentar impersonar tenant com restrições.
  if (response.status === 401) {
    localStorage.removeItem('sa_token')
    localStorage.removeItem('sa_user')
    window.location.href = '/login'
  }

  return response
}
