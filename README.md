# oiiaoiiae_bot Telegram Bot

## Setup
1. Send a POST request to Telegram API servers to 
  ```bash
  curl -X POST https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook -H "Content-type: application/json" -d '{"url": "https://oiiaoiiae-bot.vercel.app/api/webhook"}'
  ```

See https://www.marclittlemore.com/serverless-telegram-chatbot-vercel/ for reference