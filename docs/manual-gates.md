# Manual Gates

These actions cannot be automated safely:

- Telegram account sign-in and OTP.
- Telegram two-step verification and recovery email.
- BotFather bot creation and token retrieval.
- Telegram channel creation and bot administrator assignment.
- Telegram Business enablement, if available.
- USDT-TRC20 and USDC-Base receiving address entry.
- Read-only Tron/Base provider credentials.
- GitHub authentication or repository-creation approval.
- GitHub account billing or Actions spending-limit fixes when GitHub prevents CI jobs from starting.
- Deployment-provider login, billing approval, production secrets, DNS, and domain configuration.

Never provide a seed phrase, private key, session string, OTP, or recovery code.
