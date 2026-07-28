# BotFather Setup

## Proposed identity

- Display name: `Jawad Dev Desk`
- Username candidates: `@JawadDevDeskBot`, `@JawadRescueBot`, `@JawadBuildDeskBot`, `@JawadProductionBot`
- Description: `Submit a web-app bug, production rescue request, or white-label agency task. Receive a clear scope, acceptance test, delivery window, and crypto invoice.`
- About: `Full-stack production rescue and agency overflow engineering by Jawad Zeineddine.`

## Commands for `/setcommands`

```text
start - Open the Dev Desk
fix - Submit one technical bug
agency - Submit agency overflow work
rescue - Request production rescue
portfolio - View engineering work
services - View supported services
pricing - View starting packages
availability - Check current capacity
payment - View supported crypto payments
status - Check an existing ticket
privacy - View privacy and security rules
cancel - Cancel the current submission
help - Get help
```

## Manual sequence

1. Open `@BotFather` and run `/newbot`.
2. Enter the display name and one available username ending in `bot`.
3. Copy the token directly into local `.env` as `TELEGRAM_BOT_TOKEN`. Do not paste it into chat, commit it, or place it in screenshots.
4. Run `/setdescription`, choose the bot, and paste the description above.
5. Run `/setabouttext` and paste the About text.
6. Run `/setcommands` and paste the command block.
7. Prepare a square, simple logo and use `/setuserpic`.
8. Run `/setmenubutton`, select the bot, set button text `Open Dev Desk`, and enter the deployed HTTPS Mini App URL.
9. Review `/setprivacy`:
   - Keep privacy mode enabled unless an authorised group-monitoring use case requires message visibility.
   - Even when disabled, enable monitoring only for groups with explicit admin authorisation recorded in the dashboard.
10. Add only the minimal default administrator rights needed for approved channel posting or group monitoring.

## Webhook

Production should call `setWebhook` with the deployed HTTPS endpoint, `secret_token`, and an explicit `allowed_updates` list. Verify `X-Telegram-Bot-Api-Secret-Token` with a timing-safe comparison. Local development uses long polling.
