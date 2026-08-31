# Glossary

Terms you'll see across the UI, explained plainly — click through from any badge or tooltip that links here.

## Upgradeable / Proxy

**What "Upgradeable" means:** the contract you're looking at is a **proxy** — a
thin contract that forwards every call to a separate **implementation**
contract, rather than containing its logic directly. The proxy's address never
changes, but the implementation it points to can be swapped out later (an
"upgrade"), which is how a team ships new logic to an already-deployed
contract without moving users to a new address.

**What this means practically:**
- The proxy's own address is stable — it's the one you interact with, share,
  and reference everywhere.
- Its "Bytecode match" check verifies the *implementation's* code, not the
  proxy's own (the proxy's bytecode never changes on an upgrade — only its
  stored implementation address does, so checking the proxy itself wouldn't
  tell you anything useful).
- When the implementation was deployed by this same project, this tool treats
  the proxy and its implementation as a single contract — one profile page,
  showing both addresses, rather than two disconnected entities.

**Patterns currently detected:**
- [EIP-1967](https://eips.ethereum.org/EIPS/eip-1967) — the standard used by
  Transparent Proxies, and in practice by most UUPS proxies too
- The legacy pre-EIP-1967 OpenZeppelin SDK (zOS) storage slot convention —
  EIP-1967 was standardized from this exact pattern
- Beacon proxies — the implementation is resolved via a separate Beacon
  contract rather than stored directly on the proxy

See [Scope & Limitations](./SCOPE.md#proxy-detection) for exactly what's
supported and what isn't (Diamond, Safe smart accounts, and fully custom
proxies aren't detected yet).