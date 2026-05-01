/**
 * Resolução central do JWT_SECRET.
 *
 * Regras:
 *  • Em produção (NODE_ENV === 'production'), exige JWT_SECRET com pelo menos
 *    32 caracteres. Sem isso, a aplicação **não sobe** — qualquer um com
 *    acesso ao repositório poderia forjar tokens com o fallback hardcoded.
 *  • Em dev/test, aceita um fallback fixo pra facilitar onboarding, mas
 *    avisa em log na 1ª chamada pro dev não esquecer.
 *
 * Antes a aplicação tinha `process.env.JWT_SECRET ?? 'gestorprint-secret-...'`
 * espalhado em 5 lugares. Se o env var não fosse configurado em prod, a app
 * seguia funcionando aceitando o secret público — qualquer agressor que
 * lesse o repo no GitHub podia forjar JWT de admin.
 */

const DEV_FALLBACK = 'gestorprint-dev-only-secret-DO-NOT-USE-IN-PROD-2026';
let warned = false;

export function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  const isProd  = process.env.NODE_ENV === 'production';

  if (fromEnv && fromEnv.length >= 32) {
    return fromEnv;
  }

  if (isProd) {
    // Falha alto e claro — log + throw bloqueia o boot do Nest.
    const reason = !fromEnv
      ? 'JWT_SECRET não definida'
      : `JWT_SECRET muito curta (${fromEnv.length} chars; mínimo 32)`;
    // eslint-disable-next-line no-console
    console.error(
      `[FATAL] ${reason}. Em produção JWT_SECRET é obrigatória e deve ter ` +
      `≥32 caracteres aleatórios. Gere com: openssl rand -hex 32`,
    );
    throw new Error(`JWT_SECRET inválida em produção: ${reason}`);
  }

  if (!warned) {
    // eslint-disable-next-line no-console
    console.warn(
      '[WARN] JWT_SECRET não configurada — usando fallback de DEV. ' +
      'NÃO sobe pra produção sem definir um JWT_SECRET de ≥32 chars.',
    );
    warned = true;
  }
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEV_FALLBACK;
}
