# Scope & Limitations

This document tracks exactly what **contracts-registry** supports today, feature
by feature — and just as importantly, what it deliberately doesn't support yet.
Nothing here is silent or guessed: where a case isn't covered, the tool fails
visibly (a clear error or a "not verifiable" state) rather than showing
misleading data.

This is a living reference. It's updated as scope expands — treat it as the
source of truth for "does this tool handle X?" before assuming either way.

## Contract discovery

Automatically discovers every contract deployed via Foundry, by scanning
`broadcast/` (all deploy scripts, all chains) and matching each deployed
contract name to its compiled artifact in `out/`.

**Supported:**
- Multiple contracts deployed by the same script
- Multiple deploy scripts
- Multiple chains
- Contracts with real inheritance (base contracts never appear as false
  "deployed" entries — only names that were actually deployed are resolved)
- Failed deployments (shown in Deployment History, excluded from Current
  Instances)

**Not supported:**
- Two different `.sol` files defining a contract with the identical name, where
  that name was deployed — this is ambiguous and the tool refuses to guess
  which one is correct (`409 Conflict`, listing both candidate files). Rename
  one of them to resolve it.

## Bytecode verification ("Bytecode match")

Compares the bytecode actually deployed on-chain against what your local build
currently produces — entirely locally, no external service, works identically
on Anvil/local chains and public chains.

**Supported:**
- `immutable` variables (their byte ranges are masked out before comparing,
  since they legitimately differ per deployment — same technique Sourcify uses
  for its "partial match" verification)
- Differences in the trailing Solidity metadata hash between builds of
  otherwise-identical source (also masked out)
- Proxies (see [Proxy detection](#proxy-detection) below) — when a contract is
  detected as a proxy and its implementation is a known contract in this
  project, verification runs against the implementation's bytecode/artifact,
  not the proxy's own (whose bytecode never changes on an upgrade)

**Not supported:**
- Contracts linked against external libraries — the tool has no mechanism yet
  to discover which address a given library was deployed to (Foundry itself
  doesn't cleanly track this either), so it can't reconstruct the correct
  linked bytecode to compare against. Returns a "not verifiable" state with
  this reason, rather than a false positive or negative

## Proxy detection

Detects whether a deployed contract is a proxy delegating to a separate
implementation contract, and if so, resolves and displays that implementation
address. See the [Glossary](./GLOSSARY.md#upgradeable--proxy) for what this
means and why it matters.

**Supported:**
- EIP-1967 (the standard used by Transparent Proxies, and in practice by most
  UUPS proxies too — they typically also write to the EIP-1967 slots)
- Legacy OpenZeppelin SDK / zOS proxies (the pre-EIP-1967 storage slot
  convention that EIP-1967 itself was standardized from) — checked as a
  fallback when the EIP-1967 slot is empty, the same approach OpenZeppelin's
  own upgrades tooling uses
- Beacon proxies (EIP-1967 beacon slot, resolving the implementation via a
  call to the beacon's `implementation()` function)

**Not supported:**
- Fully custom/non-standard proxy implementations — there's no standardized
  slot or interface to check, so these can't be reliably detected
- Diamond proxies (EIP-2535) — this pattern has no single "implementation"
  address by design (calls are routed per function selector across multiple
  "facet" contracts), so it doesn't fit this feature's data model at all
- Safe (Gnosis) smart account proxies — detected via bytecode signature
  matching rather than storage slots, a fundamentally different mechanism
- ERC-3643 proxies — resolve their implementation via a separate
  "implementation authority" contract with its own interface
- Implementations that get renamed between upgrades (e.g. a proxy pointing to
  `Counter` today, then to a differently-named `CounterV2` after an upgrade)
  — this tool assumes an implementation's `contract_name` stays the same
  across upgrades, the common real-world pattern (teams typically ship a new
  proxy for a major rewrite instead, e.g. Uniswap v2/v3/v4 as separate
  contracts). A renamed implementation won't be recognized as related to its
  proxy's deployment history.

## RPC & chain configuration

**Supported:**
- Per-chain RPC URLs (required) and block explorer URLs (optional)
- Any EVM-compatible chain, including local dev chains (Anvil, Hardhat Network)

**Not supported:**
- Auto-detecting or guessing an RPC URL for a chain not listed in
  `registry.config.json` — every chain your deployment history references must
  be explicitly configured, or requests involving it fail with a clear error

## Framework support

**Supported:**
- Foundry (`broadcast/` + `out/` layout)

**Not supported:**
- Hardhat and other frameworks — not implemented yet. This is a real
  possibility for the future (Hardhat coexists with Foundry across the
  industry), not a rejected idea