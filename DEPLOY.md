# Guia de Deploy (Docker)

Esta aplicação utiliza **Puppeteer (Chrome)** e **SQLite**, o que a torna incompatível com plataformas Serverless padrão (como Vercel ou AWS Lambda) devido aos requisitos de:
1.  Execução persistente (o navegador precisa ficar aberto).
2.  Sistema de arquivos gravável (para o banco de dados e sessões do WhatsApp).

Recomendamos o uso do **Render** ou **Railway**.

## Opção 1: Render (Recomendado)

1.  Crie uma conta no [Render.com](https://render.com).
2.  Clique em **New +** -> **Web Service**.
3.  Conecte seu repositório GitHub.
4.  Configure:
    *   **Runtime**: Docker
    *   **Region**: Escolha a mais próxima (ex: Ohio ou Frankfurt).
    *   **Instance Type**: Free ou Starter (O Free pode desligar após inatividade, o que desconectaria o WhatsApp. O plano *Starter* é recomendado para produção 24/7).
5.  **Environment Variables** (Adicione as suas):
    *   `JWT_SECRET`: (Gere uma chave segura)
    *   `NODE_ENV`: `production`
6.  **Persistent Disk (Importante!)**:
    *   Para garantir que o QR Code não precise ser lido a cada deploy e que o banco de dados não seja apagado, você precisa de um *Disk*.
    *   No Render, vá em **Disks** -> **Add Disk**.
    *   Nome: `data`
    *   Mount Path: `/app/data` (Você precisará ajustar o código para salvar o `database.sqlite` e `.wwebjs_auth` dentro dessa pasta `/app/data` se quiser persistência total).
    *   *Nota: O plano gratuito do Render não suporta Disks. Sem disco, os dados somem ao reiniciar.*

## Opção 2: Railway

1.  Crie uma conta no [Railway.app](https://railway.app).
2.  **New Project** -> **Deploy from GitHub repo**.
3.  O Railway detectará o `Dockerfile` automaticamente.
4.  Vá em **Variables** e adicione as variáveis do `.env`.
5.  **Volumes**:
    *   Clique no serviço -> **Settings** -> **Volumes**.
    *   Add Volume. Mount Path: `/app` (ou pastas específicas).
    *   *Nota: O Railway cobra por uso, mas inclui um trial.*

## Testando Localmente

Para verificar se o Docker está funcionando antes de subir:

```bash
# Construir a imagem
docker build -t meu-bot-whatsapp .

# Rodar (Acesse http://localhost:3001)
docker run -p 3001:3001 meu-bot-whatsapp
```
