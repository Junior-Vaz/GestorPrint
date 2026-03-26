/**
 * Wrapper centralizado de fetch que injeta o token JWT automaticamente.
 * Redireciona para /login em caso de 401.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('gp_token')

  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  // Mescla com headers existentes (os explícitos têm prioridade)
  const mergedHeaders: Record<string, string> = {
    ...headers,
    ...(options.headers as Record<string, string> || {}),
  }

  const response = await fetch(url, { ...options, headers: mergedHeaders })

  if (response.status === 401) {
    localStorage.removeItem('gp_token')
    localStorage.removeItem('gp_user')
    window.location.href = '/login'
  }

  if (response.status === 403) {
    response.clone().json().then((body: any) => {
      const msg = body?.message || 'Funcionalidade não disponível no seu plano atual.'
      // Account suspended/cancelled during active session → force logout
      if (msg.includes('suspensa') || msg.includes('cancelada')) {
        localStorage.removeItem('gp_token')
        localStorage.removeItem('gp_user')
        sessionStorage.setItem('suspended_msg', msg)
        window.location.href = '/login'
        return
      }
      window.dispatchEvent(new CustomEvent('plan:limit', { detail: msg }))
    }).catch(() => {})
  }

  return response
}
