# Capability Audit — 28 July 2026

## Verified Telegram capabilities

Sources: official Telegram Bot API and Mini Apps documentation.

- Bot API 10.2 is current as of 14 July 2026.
- Local development may use `getUpdates` long polling; production should use `setWebhook` with an HTTPS endpoint and a secret token.
- `getFile` provides a temporary file URL. Telegram currently documents bot downloads up to 20 MB; this project applies a lower configurable application limit.
- `setMyCommands` and `setChatMenuButton` support the command menu and Mini App menu button.
- Bot deep links support a `/start` parameter. This project allows only sanitised attribution tokens.
- Mini Apps expose `initData`; `initDataUnsafe` must not be trusted. The server validates `auth_date` and HMAC before accepting Telegram identity.
- Telegram theme parameters can be used for mobile theming. Start parameters are preserved without putting secrets in query strings.
- Business connections and business messages exist in the current Bot API, but account eligibility and permissions require manual Telegram configuration. They are optional here.
- A bot sees group messages only according to its membership, permissions, privacy mode, and Telegram update delivery. The monitor additionally requires recorded admin authorisation.
- Bots can post to a channel only after being added with the appropriate administrator rights.

Official references:
- https://core.telegram.org/bots/api
- https://core.telegram.org/bots/webapps
- https://core.telegram.org/bots/features#deep-linking
- https://core.telegram.org/bots/faq#what-messages-will-my-bot-get

## Framework decision

`grammY` is selected for the production adapter. Its official GitHub repository showed release 1.45.1 in July 2026 and active maintenance. The domain and intake engines remain framework-independent and can run without the package in safe demo mode.

## Payment verification capabilities

### TRON / TRC20

- TronGrid v1 exposes account TRC20 transaction history with confirmed/unconfirmed filters and contract filtering.
- Verification must compare chain, successful transfer, configured token contract, configured recipient, amount, confirmation policy, timestamp window, and transaction reuse.
- The application never creates, signs, or broadcasts a transfer.

References:
- https://developers.tron.network/docs/get-trc20-transaction-history
- https://developers.tron.network/reference/get-trc20-transaction-info-by-account-address

### Base / native USDC

- Base Mainnet chain ID is 8453. Base public RPC endpoints are rate-limited and not recommended as the production provider.
- `eth_getTransactionReceipt` confirms inclusion and status. ERC-20 `Transfer` logs must be decoded and checked against the configured USDC contract, recipient, and amount.
- Circle currently documents native USDC on Base at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`; this repository still loads the contract from environment configuration to prevent silent assumptions.

References:
- https://docs.base.org/base-chain/quickstart/connecting-to-base
- https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_getTransactionReceipt
- https://developers.circle.com/stablecoins/usdc-contract-addresses

## Limitations

- Real Bot API calls are unavailable until BotFather creates a bot and supplies a token.
- Real on-chain checks are unavailable until receiving addresses and read-only provider credentials are configured.
- Telegram Business features depend on the account and Telegram's current eligibility controls.
- No arbitrary client URL is fetched automatically; this avoids SSRF and accidental private-network access.
