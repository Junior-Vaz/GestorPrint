# Definição Técnica de Funcionalidades Enterprise

## 1. Padrão de Rotas e Segurança (Inspirado no Chatwoot)
Para garantir o multi-tenancy absoluto, todas as rotas operacionais devem conter o ID da organização na URL.
* **Application API (Consumida pelo Frontend):**
  * `GET  /api/v1/orgs/{org_id}/inboxes`
  * `GET  /api/v1/orgs/{org_id}/conversations`
  * `POST /api/v1/orgs/{org_id}/conversations/{conv_id}/messages`
  * `POST /api/v1/orgs/{org_id}/macros/{macro_id}/execute`

## 2. Mecanismo de Macros (Automação Sequencial)
As Macros permitem que o atendente execute múltiplas tarefas com um clique. 
**Exemplo de Payload Salvo no Banco:**
```json
[
  { "type": "ADD_TAG", "value": "uuid-tag-financeiro" },
  { "type": "SEND_MESSAGE", "value": "Recebemos seu comprovante. Seu pedido será atualizado." },
  { "type": "TRANSFER_TEAM", "value": "uuid-team-financeiro" }
]

3. Menções e NotificaçõesInterno: Ao detectar @uuid em uma mensagem do tipo INTERNAL_NOTE, o backend emite um evento via Socket.io para o usuário específico.Integração ERP: O Chat Engine pode realizar um webhook POST para a tabela Notification do ERP, garantindo que o alerta apareça na central de notificações global do GestorPrint.4. Estratégia de Integração ERP ↔ ChatRecursoFonte (ERP GestorPrint)Destino (Microserviço Chat)AutenticaçãoJWT assinado com SECRETMiddleware de validação do TokenSincronizaçãoPOST /platform/api/v1/orgsRota protegida Server-to-ServerTenantTenant.uuidOrganization.id (Na URL da API)OperadorUser.uuidUser.id (No Token JWT)ClienteCustomer.phoneContact.phoneConfig. APIAiConfig.evolutionUrlInbox.instanceId