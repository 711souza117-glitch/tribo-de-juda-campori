# Tribo de Judá — Campori 2026 (Mercado Pago automático)

Site de arrecadação com meta de R$ 12.000, mapa da jornada Brumadinho–Barretos, ônibus proporcional ao progresso e pagamentos pelo Checkout Pro do Mercado Pago.

## O que já está implementado
- Página responsiva para celular e computador.
- Seleção de valor da contribuição e redirecionamento para o checkout seguro do Mercado Pago.
- Criação de preferência de pagamento no servidor (o token não é exposto no navegador).
- Endpoint de webhook `/webhooks/mercadopago` que consulta a API do Mercado Pago e só registra pagamentos aprovados pertencentes a esta campanha.
- Deduplicação por ID de pagamento para não contar o mesmo pagamento duas vezes.
- Painel público consultado automaticamente a cada 10 segundos; a meta e o ônibus avançam após confirmação do webhook.
- Meta inicial de R$ 12.000.

## Antes de publicar: configuração necessária
O projeto está pronto em código, mas **não pode receber pagamentos reais até você inserir as credenciais da sua aplicação e publicar em uma URL HTTPS**.

1. No Mercado Pago Developers, crie/abra a aplicação e obtenha o **Access Token de produção**. Não use a Public Key no lugar do Access Token.
2. Na hospedagem, configure as variáveis de ambiente:
   - `MERCADOPAGO_ACCESS_TOKEN`: Access Token de produção (secreto).
   - `BASE_URL`: URL HTTPS pública exata do site, sem barra final.
   - `DATA_DIR`: caminho de armazenamento persistente, se disponível (por exemplo `/app/data` no Render com disco montado).
3. No painel Mercado Pago Developers > sua aplicação > Webhooks, configure a URL de produção `https://SEU-DOMINIO/webhooks/mercadopago` e habilite o evento **Pagamentos (payment)**. Salve e teste a notificação.
4. Faça um pagamento de teste antes de divulgar a campanha. Confirme que a notificação chegou e que o total mudou apenas depois do status aprovado.

## Deploy no Render
- Build command: `npm install`
- Start command: `npm start`
- Runtime: Node
- Configure as variáveis de ambiente acima.
- Para não perder o histórico após reinícios/deploys, configure armazenamento persistente e defina `DATA_DIR` para o caminho montado, por exemplo `/app/data`.

## Segurança
- Nunca coloque o Access Token em `public/`, HTML ou JavaScript do navegador.
- Nunca envie seu token em mensagens, prints ou repositórios públicos.
- O webhook não confia no valor/status enviado no corpo: consulta a API do Mercado Pago usando o token do servidor.
- Use somente credenciais da aplicação correta e valide o fluxo com pagamentos de teste antes de ativar a campanha.

## Desenvolvimento local
1. Instale Node.js 20 ou superior.
2. Execute `npm install`.
3. Copie `.env.example` para `.env` e preencha as variáveis.
4. Execute `npm start` e abra `http://localhost:3000`.

Documentação oficial: [Criar preferência de pagamento](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/create-payment-preference) · [Webhooks de pagamento](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications)
