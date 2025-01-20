# oiiaoiiae_bot Telegram Bot

## Setup
To setup an instance of this bot,
1. Clone this repo.
2. Setup a Telegram bot via [@BotFather](https://t.me/botfather) on Telegram, note the `TELEGRAM_TOKEN` provided.
3. Set the Telegram bot to send webhook Send a POST request to Telegram API servers to 
```bash
curl -X POST https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook -H "Content-type: application/json" -d '{"url": "https://oiiaoiiae-bot.vercel.app/api/webhook"}'
```

See https://www.marclittlemore.com/serverless-telegram-chatbot-vercel/ for reference

## Troubleshooting

- If the Telegram bot hangs (server does not receive requests despite messages sent to the bot), coupled with periodic requests of earlier sent messages, it could mean that the **Telegram API did not receive any response back from the server** and thus retries the request (even if there is response to Telegram but of error status like 500, Telegram will still retry the request). See https://stackoverflow.com/questions/41348883/clear-pending-update-count-in-telegram-bot
  - To clear pending updates, add a query string for `"drop_pending_updates": "true"`
```bash
curl -X POST https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook -H "Content-type: application/json" -d '{"url": "https://oiiaoiiae-bot.vercel.app/api/webhook", "drop_pending_updates": "true"}'
```
- To check for pending updates,
```bash
curl -X POST https://api.telegram.org/bot<TELEGRAM_TOKEN>/getWebhookInfo
```