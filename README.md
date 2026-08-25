# Contracts Registry

A cross-chain deployment registry for [Foundry](https://book.getfoundry.sh/) projects. It reads the deployment records Foundry already writes to your `broadcast/` folder, aggregates them across every chain you deploy to, and gives you a single local dashboard to browse, verify, and interact with your deployed contracts — no hosting, no external database, everything runs on your machine and talks directly to the chains you configure.

![License](https://img.shields.io/npm/l/contracts-registry)
![npm version](https://img.shields.io/npm/v/contracts-registry)

## Why

Foundry's `broadcast/` folder already has everything about your deployments — but it's split per script, per chain, one JSON file at a time. There's no single view of "where is `Counter` deployed, on which chains, and is what's live actually what I have locally compiled?" This tool builds that view, live, from files you already have.

## Install

```bash
npx contracts-registry
```

or install it globally:

```bash
npm install -g contracts-registry
contracts-registry
```

This starts a local server and opens your browser automatically. No account, no signup, nothing leaves your machine except the RPC calls you configure.

Supported platforms: macOS (Intel and Apple Silicon), Linux (x64). Windows isn't packaged yet.

## Quick start

Run it from the root of your Foundry project. It needs one config file there: `registry.config.json`.

```json
{
  "broadcast_path": "broadcast",
  "out_path": "out",
  "chains": {
    "1": {
      "rpc_url": "https://eth-mainnet.example.com",
      "explorer_url": "https://etherscan.io"
    },
    "8453": {
      "rpc_url": "https://base-mainnet.example.com",
      "explorer_url": "https://basescan.org"
    },
    "31337": {
      "rpc_url": "http://localhost:8545"
    }
  }
}
```

| Field | Required | Description |
|---|---|---|
| `broadcast_path` | Yes | Path to your Foundry `broadcast/` folder, relative to the project root. |
| `out_path` | Yes | Path to your Foundry `out/` folder (compiled artifacts), relative to the project root. |
| `chains` | Yes (one entry per chain you've deployed to) | Maps a chain ID to its RPC and (optionally) block explorer. |
| `chains.<id>.rpc_url` | Yes, per chain | Any chain that appears in your deployment history needs an RPC here, or requests involving that chain will fail. |
| `chains.<id>.explorer_url` | No | Used to link addresses and transactions to a block explorer. If omitted, those links are simply not shown — you'll see a warning in the terminal when the server starts. |

Once the file's in place, just run `contracts-registry` from that same folder.

## What it does

- **Contract discovery** — every contract you've successfully deployed is found automatically by scanning `broadcast/` and matching each one to its compiled artifact in `out/`. No need to list your contracts anywhere.
- **Current vs. historical instances** — the most recent deployment per contract per chain is front and center; every prior deployment stays browsable in its own section.
- **Deployment history** — a searchable, paginated log of every deployment transaction, with gas cost, status, and a link to the transaction and resulting address.
- **Bytecode match** — compares the bytecode actually deployed on-chain against what your local build produces, so you know if what's live matches your current source. Runs automatically, cached for 24 hours, with a per-row button to force a fresh check.
- **Interact** — call any read function on a deployed instance directly from the UI, against whichever chain you pick.

## Troubleshooting

**"Could not find or read 'registry.config.json'"**
You're not running `contracts-registry` from your Foundry project's root, or the file doesn't exist there yet. See [Quick start](#quick-start).

**"No RPC configured for chain X"**
Your `broadcast/` history includes a deployment on a chain that isn't listed under `chains` in your config, or is listed without an `rpc_url`. Add it.

**"No artifact found for contract 'X' — has it been compiled?"**
The tool found a record of `X` being deployed, but can't find a matching compiled artifact in `out_path`. Run `forge build` and try again.

**"Contract name 'X' is ambiguous: found in ..."**
Two different `.sol` files define a contract with the same name, and `X` was deployed — the tool can't tell which one to use. Rename one of them.

## Development

The Rust backend (`engine/`) and the React frontend (`web/`) run as two separate processes in development:

```bash
# terminal 1
cd web && npm install && npm run dev

# terminal 2 — from a Foundry project with a registry.config.json
cargo run --manifest-path <path-to-repo>/engine/Cargo.toml
```

Building a distributable binary (embeds the frontend into a single executable):

```bash
cd web && npm run build
cd engine && cargo build --release --features embed-frontend
```

## License

MIT — see [LICENSE](./LICENSE).

---

Built by [Agustín Velez](https://github.com/AgusVelez5) · [LinkedIn](https://www.linkedin.com/in/agustin-velez/)

If this saved you time, donations to `0x91A1F7ea46FeAB0E955A12f5161E53c63f025725` are appreciated.
