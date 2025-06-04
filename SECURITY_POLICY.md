# ✅ Security Policy: Solana Market-Maker Bot (Pump.fun)

This project is built under strict security and source-validation policies to prevent supply chain attacks, wallet compromise, and backdoor integrations.

---

## 1. 🔐 Source Code Trust Rules

Only the following sources are allowed for code imports, architecture references, SDKs, or implementation strategies:

### ✅ Official SDKs:
- `@pump-fun/pump-sdk`, `@pump-fun/pump-swap-sdk`
- `@jito-ts/core`, `@helius-labs/sdk`, `@jup-ag/core`
- `@solana/web3.js`, `@solana/spl-token`

### ✅ GitHub Repositories:
- `Pump.fun`, `Solana Labs`, `Jito Labs`, `Helius Labs`, `Jupiter Aggregator`, `Metaplex`, `Solana Cookbook`

### ✅ Infrastructure & Cloud Providers:
- Amazon Web Services (AWS), Cloudflare, DigitalOcean
- Redis Labs, Grafana, Prometheus, Kafka (Apache)

### ✅ Top Academic Institutions:
- MIT CSAIL, Stanford, SSE (Stockholm School of Economics)
- UC Berkeley EECS, Harvard SEAS (CS50, Trading & ML), Cambridge Computer Lab

### ❌ Forbidden Sources:
- Unverified GitHub repos (not owned by above organizations)
- Reddit/Gist/pastebin/unknown blog code snippets
- StackOverflow with no attribution to official docs
- AI-generated code with unknown provenance

---

## 2. 💳 Key Security Practices

- Private keys **must not be hardcoded**
- All signing must occur via **local encrypted keypairs**
- For critical actions (>1 SOL), **multisig or 2FA** via Telegram bot is required
- Vaults (e.g., Hashicorp Vault, AWS KMS) are approved for future Phase 2

---

## 3. ⚠️ License and Distribution

- MIT license applies
- You may fork, contribute, or deploy, but **must preserve this policy**
