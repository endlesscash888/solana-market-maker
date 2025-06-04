# ✅ Security Policy: Solana Market-Making Bot Deployment

## Purpose

This policy defines the approved sources of software, SDKs, Docker containers, and academic references used in the development and deployment of the Solana-based Pump.fun market-making bot. It enforces security best practices and eliminates the risk of integrating unknown, malicious, or backdoored code.

---

## 📚 Approved Knowledge & Code Sources

### ✅ SDKs & Repositories (official only)

* GitHub Organizations:

  * `pump-fun`
  * `jito-labs`
  * `solana-labs`
  * `helius-labs`
  * `jup-ag`
  * `project-serum`
  * `metaplex-foundation`
* NPM Verified Packages:

  * `@pump-fun/pump-sdk`
  * `@jito-ts/core`
  * `@helius-labs/sdk`
  * `@jup-ag/core`
  * `@solana/web3.js`
* DockerHub Official Images:

  * `solanalabs`
  * `redis`
  * `grafana`
  * `node`
  * `prometheus`
  * `postgres`
  * `nginx`
  * `ubuntu`, `debian`

### ✅ Infrastructure & Cloud Providers

* [Helius Docs & Pricing](https://docs.helius.xyz/)
* [DigitalOcean Documentation](https://docs.digitalocean.com/)
* [Redis Cloud Docs](https://redis.com/docs/)
* [Grafana Labs Documentation](https://grafana.com/docs/)
* [GitHub Docs](https://docs.github.com)
* [Docker Docs](https://docs.docker.com)
* [AWS Documentation](https://docs.aws.amazon.com/)
* [Jito Labs Docs](https://docs.jito.wtf)
* [Prometheus Monitoring Docs](https://prometheus.io/docs/)

### ✅ Academic and Scientific References

* [MIT OpenCourseWare](https://ocw.mit.edu/)
* [Stanford CS & Financial Math](https://cs.stanford.edu/)
* [Cambridge Mathematical Finance](https://maths.cam.ac.uk/)
* [Stockholm School of Economics (SSE)](https://www.hhs.se/en/)
* [Cornell eCommons](https://ecommons.cornell.edu/)
* [arXiv.org (CS.MA, Q.FIN categories)](https://arxiv.org/)

---

## ⛔️ Strictly Prohibited Sources

* ❌ Random GitHub repositories outside approved organizations
* ❌ Pastebin, Gist, personal Discord messages
* ❌ Reddit code snippets or comments
* ❌ Unknown or GPT-generated repos without manual review
* ❌ Dev blogs unless officially associated with approved vendors (e.g., `grafana.com/blog`, `dev.to/@helius`)

---

## 🎯 Enforcement Goals

* Ensure all production and development dependencies are secure, traceable, and auditable
* Prevent accidental use of unsafe libraries, forked SDKs, or copied unvetted code
* Establish a zero-tolerance policy for mixing trusted and untrusted components in the same runtime

All development team members and AI copilots (Claude, Perplexity, Grok) must adhere to this policy throughout all phases of the project lifecycle.

---

*Last updated: June 2025*

Maintainer: Sir Michael the Victorious
