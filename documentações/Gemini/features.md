Especificação Técnica: Motor de Fluxo Visual com IA Situacional
1. Visão Geral
Esta feature implementa um Visual Flow Builder (utilizando Vue Flow) dentro do ERP GestorPrint. A grande inovação é que a IA não é um chatbot genérico, mas sim um Agente de Contexto presente em cada "caixinha" (nó) do fluxo. Ela identifica em tempo real o que o sistema possui (serviços disponíveis, materiais, prazos) para guiar o cliente sem alucinações.

2. A centralidade do "Vue Flow"
O usuário do ERP desenha a jornada de atendimento arrastando componentes. O Vue Flow gera o mapa de navegação que o backend percorre a cada mensagem recebida via Evolution API.

Estrutura dos Nós (Nodes):
Nó de Triagem (IA de Identificação): Recebe o texto livre do cliente. A IA analisa o que o cliente quer e "identifica" qual o próximo passo no fluxo (ex: "O cliente quer um orçamento" ou "O cliente quer saber se o banner dele está pronto").

Nó de Coleta (IA de Extração): Focado em dados técnicos. Se o cliente diz "Quero 10 adesivos 20x30", a IA identifica as entidades: { quantidade: 10, largura: 20, altura: 30 }.

Nó de Consulta Situacional (IA + Sistema): Este nó "pergunta" ao ERP o que há disponível no momento. A IA recebe os dados brutos do sistema (ex: tipos de lona em estoque) e apresenta ao cliente de forma amigável.

3. Inteligência Sem Alucinação (Identificação vs. Invenção)
A principal mudança de paradigma aqui é que a IA não inventa dados. Ela funciona sob o princípio de Identificação de Contexto Atual:

Entrada: Mensagem do WhatsApp ("Quero fazer um banner").

Identificação: A IA do nó atual identifica que "banner" é um serviço ativo no sistema.

Cruzamento: O sistema fornece à IA as opções de materiais que existem hoje (Lona 440g, Blackout, Brilho).

Resposta: A IA apresenta as opções reais: "Temos essas 3 lonas hoje, qual prefere?".

4. Gestão de Tokens e Performance
Para manter o sistema sustentável e barato para o cliente final:

Prompt por Etapa: Cada caixinha do Vue Flow carrega apenas as instruções necessárias para aquele momento. Isso reduz o tamanho do prompt em até 90%.

IA de Baixa Latência: Utilização do modelo Gemini 1.5 Flash dentro dos nós, garantindo que a resposta no WhatsApp seja quase instantânea.

Identificação de Intenção: Se o cliente clica em um botão, o sistema pula o processamento de IA, economizando 100% dos tokens daquela interação.