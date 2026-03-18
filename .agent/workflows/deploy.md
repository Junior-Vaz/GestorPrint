---
description: Como realizar o deploy do GestorPrint garantindo sincronização de banco e imagens.
---
# Fluxo de Trabalho: Deployment (GestorPrint)

Para garantir que o sistema suba sem erros no EasyPanel ou em outros ambientes, siga sempre este fluxo ao implementar novas colunas no banco de dados ou funcionalidades críticas.

## 1. Atualização do Banco (Prisma)
Sempre que o `schema.prisma` for alterado:
1. Gere a migração local: `npx prisma migrate dev --name <descricao>` na pasta `backend`.
2. Verifique se a nova pasta em `backend/prisma/migrations` foi criada.
3. Suba essa pasta para o Git. O `Dockerfile` usará esses arquivos para atualizar o banco de produção com `npx prisma migrate deploy`.

## 2. Controle de Versão (Docker Tags)
Sempre que fizer um `push` para a `main`:
1. Espere o GitHub Action terminar o build (luz verde).
2. Pegue o **SHA curto** (7 dígitos) do commit de hoje.
3. Atualize o arquivo `docker-compose.easypanel.yml` substituindo as tags das imagens pelo novo SHA.
   - Exemplo: `gestorprint-backend:a8fbf5e`
4. Isso garante que o EasyPanel baixe exatamente a versão que você acabou de criar, evitando problemas de cache com a tag `:latest`.

## 3. Verificação Pós-Deploy
1. Verifique os logs do `backend` no EasyPanel.
2. Procure pela mensagem `npx prisma migrate deploy` para confirmar que as tabelas foram criadas/alteradas com sucesso.
