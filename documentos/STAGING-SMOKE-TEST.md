# Smoke Test de Staging

Este checklist valida o rollout das imagens novas antes de promover para producao.

## 1) Preparacao

- Atualize as tags de imagem no ambiente de staging para o mesmo SHA publicado no GHCR.
- Confirme que as variaveis obrigatorias estao definidas (JWT, banco, chaves de integracao).
- Suba os servicos e aguarde healthchecks:
  - `docker compose -f docker-compose.easypanel.yml up -d`
  - `docker compose -f docker-compose.easypanel.yml ps`

## 2) Validacoes HTTP

- Backend health:
  - `curl -fsS https://api-staging.seu-dominio.com/api/health`
  - Esperado: JSON com `status: "ok"`.
- Frontend:
  - `curl -I https://app-staging.seu-dominio.com`
  - Esperado: `HTTP 200`.
- SaaS Admin:
  - `curl -I https://admin-staging.seu-dominio.com`
  - Esperado: `HTTP 200`.
- WhatsApp AI:
  - `curl -fsS https://wa-staging.seu-dominio.com/`
  - Esperado: texto indicando servico ativo.

## 3) Fluxos funcionais minimos

- Login no frontend com usuario valido.
- Criacao de um cliente e um produto.
- Criacao de um orcamento simples e consulta na listagem.
- Login no SaaS Admin e visualizacao de tenants.
- Chamada de preview do WhatsApp AI com payload basico.

## 4) Observabilidade e rollback

- Verifique logs sem erros criticos nos 4 servicos por pelo menos 10 minutos.
- Se houver falha:
  - reverta as tags para o ultimo SHA estavel;
  - execute novamente os testes HTTP da secao 2;
  - abra incidente com o SHA problemático e logs anexados.
