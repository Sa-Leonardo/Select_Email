# 📧 Email Bridge (Select_Email)

Um sistema completo de notificações que envia alertas no **WhatsApp** sempre que você recebe um email de remetentes específicos. Ideal para quem não quer perder emails importantes.

## ✨ Funcionalidades

*   **Multi-usuário**: Suporte a múltiplas contas, cada uma com sua própria sessão do WhatsApp e configurações de email.
*   **Filtro de Remetentes**: Adicione apenas os emails que você deseja monitorar (Whitelist).
*   **Integração WhatsApp**: Utiliza `whatsapp-web.js` para conectar ao seu WhatsApp via QR Code.
*   **Monitoramento em Tempo Real**: Conexão IMAP persistente para detectar emails instantaneamente.
*   **Dashboard Intuitivo**: Frontend moderno em React para gerenciar configurações e visualizar logs.

## 🚀 Tecnologias

*   **Backend**: Node.js, Express, Socket.io, SQLite (better-sqlite3), IMAP, WhatsApp-Web.js.
*   **Frontend**: React, Vite, Socket.io-client.

## 🛠️ Pré-requisitos

*   Node.js (v18 ou superior)
*   Uma conta de Email com acesso IMAP habilitado (Para Gmail, você precisará de uma **Senha de App**).
*   Uma conta de WhatsApp (pode ser o seu pessoal ou business).

## 📦 Instalação

1.  **Clone o repositório**:
    ```bash
    git clone https://github.com/Sa-Leonardo/Select_Email.git
    cd Select_Email
    ```

2.  **Instale as dependências do Backend**:
    ```bash
    npm install
    # Isso instalará também as dependências de sistema necessárias para o Puppeteer (Chrome)
    ```

3.  **Instale as dependências do Frontend**:
    ```bash
    cd frontend
    npm install
    cd ..
    ```

4.  **Configuração de Ambiente (.env)**:
    Crie um arquivo `.env` na raiz do projeto (opcional, pois o sistema tem valores padrão):
    ```env
    PORT=3001
    JWT_SECRET=super-secreto-seguro
    ```

## ▶️ Como Rodar

### Modo Desenvolvimento
Para rodar tanto o backend quanto o frontend simultaneamente com hot-reload:

```bash
npm run dev
```
*   O Backend rodará em `http://localhost:3001`
*   O Frontend geralmente em `http://localhost:5173`

### Somente Backend
```bash
npm start
```

### Somente Frontend
```bash
npm run client
```

## 📖 Como Usar

1.  Acesse o painel web (ex: `http://localhost:5173`).
2.  **Crie uma conta** com um nome de usuário e senha.
3.  No primeiro acesso, configure:
    *   **Seu número de WhatsApp**: Formato internacional com `@c.us` (Ex: `5511999998888@c.us` para Brasil, DDD 11).
    *   **Email User**: Seu endereço de email completo.
    *   **Email Password**: Sua senha de email (ou Senha de App).
4.  No Dashboard, escaneie o **QR Code** que aparecerá com seu celular (WhatsApp > Aparelhos Conectados).
5.  Adicione endereços de email na lista de **Senders** (Remetentes).
6.  Pronto! Sempre que um desses remetentes enviar um email, você receberá um alerta no WhatsApp.

## ⚠️ Notas Importantes

*   **Gmail**: Se usar Gmail, você DEVE ativar a autenticação de dois fatores (2FA) e criar uma "Senha de App" para usar no campo de senha. A senha normal do Google no funcionará.
*   **Sessão WhatsApp**: Os arquivos de sessão são salvos localmente na pasta `.wwebjs_auth`. Mantenha esta pasta segura e não a compartilhe.

## 📄 Licença

Este projeto é de código aberto.
