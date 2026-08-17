# StreetRail — Midnight Local Undeployed

This project is built on the Midnight Network.

**Repository:** [github.com/arunnadarasa/zealymidnight](https://github.com/arunnadarasa/zealymidnight)  
**Network:** Midnight **Local Undeployed** (Docker node + indexer + proof server)  
**Contracts:** five Compact programs (`pragma language_version 0.23`)  
**App:** TanStack Start / Vite storefront for streetwear commerce + private choreography rights

This README is aimed at the **Midnight technical community**: Compact authors, indexer users, Lace/wallet integrators, and hackathon judges who need to reproduce the stack, understand the privacy model, and avoid Undeployed dust-wallet footguns.

> **Not** a public EVM / Arc Testnet rail. Legacy Arc/Circle code may remain feature-gated in the tree; the Undeployed path is Compact + genesis **server-append** + local indexer GraphQL.

Companion ops brief for AI agents (Lovable / Cursor): [`Cursor Input.md`](./Cursor%20Input.md).

---

## Why Midnight

StreetRail shows **private-by-default** rights and settlement on Midnight:

| Concern | Public EVM typical | StreetRail on Undeployed |
| --- | --- | --- |
| Author / buyer / merchant secrets | Often on-chain or in clear txs | Compact **witnesses**; ledger holds commitments / fingerprints |
| Settlement token | USDC on EVM | Experimental **mUSDC** Compact mimic (no peg — never Mainnet) |
| NFT ownership | Mutable ERC-721 storage slots | **Insert-only** maps + local JSON owner mirror (dust-safe) |
| Writes from the browser | Wallet signs every tx | Lace optional; **writes use genesis server-append** (Lace cannot sign Undeployed) |
| Verification | Block explorer | Local **indexer GraphQL** (`:8088`) |

Demo modes share one catalog and one settlement rail:

| Mode | Meaning | Midnight touchpoints |
| --- | --- | --- |
| **H2H** | Human checkout | x402-style challenge → mUSDC + OrderLedger |
| **H2A** | Human → agent spend | Mandate + mUSDC |
| **A2A** | Agent negotiation | AP2 / UCP shapes → mUSDC settle |
| **A2H** | Agent → human payout / claim | mUSDC transfer + MoveRegistry append (soft-fail) |

Judge surface: `/judge` (“five deployed contracts” + settlement history).

---

## Architecture

```
Browser (Vite :8080)
  │  reads: indexer GraphQL, deploy JSON, optional Lace (Undeployed = identity only)
  ▼
TanStack server routes (/api/public/*)
  │  genesis seed …0002 + LevelDB private state
  │  fresh MidnightWalletProvider per callTx → stop() in finally
  ▼
┌─────────────────┬──────────────────┬─────────────────┐
│ midnight-node   │ indexer-standalone│ proof-server    │
│ :9944           │ :8088 GraphQL     │ :6300           │
└─────────────────┴──────────────────┴─────────────────┘
          ▲
          │ Compact artefacts in public/contract/{move-registry,move-nft,…}
```

**Private state store name** (must match deploy + every append path or you get **RpcError 117**): see `src/lib/midnight-shared.ts` (`PRIVATE_STATE_STORE`, `GENESIS_SEED`, `DEPLOYER_SECRET_HEX`).

---

## Five Compact contracts

Sources: `contracts/*.compact` → managed artefacts → `public/contract/<name>/`.

| # | Contract | Source | Witness domain | Role |
| --- | --- | --- | --- | --- |
| 1 | **MoveRegistry** | `MoveRegistry.compact` | `abodc:author:v1` / `localSecretKey` | Append choreography CID + author commitment |
| 2 | **MoveNft** | `MoveNft.compact` | `movenft:minter:v1` | Mint / list / buy / cancel / transfer Move Rights NFTs |
| 3 | **MandateVault** | `MandateVault.compact` | `ap2:buyer:v1` | Anchor AP2-shaped mandates |
| 4 | **OrderLedger** | `OrderLedger.compact` | `ucp:merchant:v1` | Record UCP orders + merchant fingerprint |
| 5 | **MidnightUSDC** | `MidnightUSDC.compact` | `musdc:signer:v1` | Experimental mUSDC faucet + transfer |

Deploy addresses land in:

- `src/data/midnight-contract.undeployed.json` (**prefer this**)
- `.env` `VITE_*` (stale after redeploy until Vite restart)

UI catalog: `src/lib/contracts.ts` (`CONTRACTS` length = **5**).

### Privacy model (per contract)

| Contract | Off-chain (witness) | On ledger (disclosed / public) |
| --- | --- | --- |
| MoveRegistry | `localSecretKey()` | `persistentHash` author commitment + CID/message |
| MoveNft | minter secret derives `movenft:minter:v1` pk; first call stores `minter_pk`, later `assert(pk == minter_pk)`. Owner label hashed as `sha256("movenft:owner:v1:" + label)` | Insert-only `owners` / `listed_price`; append-only `sales` with fresh ids |
| MandateVault | buyer secret | `ap2:buyer:v1` public key derived in-circuit; `assert(pk == buyer)` |
| OrderLedger | merchant secret | `recordSigningKey` stores `ucp:merchant:v1` fingerprint; `recordOrder` requires `pk == signing_key_fpr` |
| MidnightUSDC | signer secret | Append-only `credits` / `credit_to` by nonce; `spent_nonces`; `transfer` requires `faucet_claimed.member(fromPk)` (not an empty-hash check) |

### MoveNft circuits

| Circuit | Ledger effect | Notes |
| --- | --- | --- |
| `mint` | `owners.insert(tokenId → to)` | New key only |
| `listSale` | `listed_price.insert` | **`list` is a Compact keyword** — never name the circuit `list` |
| `buy` | `sales.insert(saleId → …)` | Append-only; mUSDC paid in the same HTTP handler |
| `cancel` | insert cancel key with price `0` | Never overwrite listing key |
| `transfer` | `sales`-style append with new id | |

**v1 is not cross-contract atomic in Compact.** Buy path: `musdcTransfer` (or faucet) then `MoveNft.buy` with the **same genesis wallet family**, sequential `callTx`, each session `stop()`’d.

### MidnightUSDC circuits (insert-only)

Undeployed dust wallet panics when a circuit **updates an existing `Map` key** (`feesWithMargin` / `transaction_merge` Unreachable). Do **not** maintain `balances[pk] = balances[pk] - amount`.

| Circuit | Effect |
| --- | --- |
| `faucet` | Once per signer pk: insert credit + `faucet_claimed` |
| `transfer` | Require `faucet_claimed.member(fromPk)` and a fresh `nonce`; append credit rows |

Demo balances are reconstructed off-chain / in UI; the ledger is an append-only credit log.

---

## Critical Undeployed constraint: insert-only maps

**Symptom:** `Wallet.Other: wasm.transaction_feesWithMargin` or `transaction_merge` Unreachable / `SubmissionError` / `FiberFailure`.

**Cause:** Compact `Map.insert` on a key that already exists (overwrite) interacts badly with Undeployed dust fee balancing.

**Design rule for this stack:** public maps are insert-or-append-with-new-key only. Current NFT owner / spendable balance for the demo may live in:

- `src/data/move-nft-state.undeployed.json`
- server-side aggregation over credit rows

Same lesson shipped for MoveNft and MidnightUSDC. Assume it for any new Compact demo map.

---

## RpcError cheat sheet

| Code / shape | Meaning | Fix |
| --- | --- | --- |
| **117** (`Invalid Transaction: Custom error: 117`) | Private state / LevelDB out of sync with chain | Stop Vite → wipe `midnight-level-db` (+ often recreate Docker chain) → full `midnight:deploy` → restart Vite → one write |
| **104** | Dirty LevelDB after failed faucet/mint handoff | Wipe + redeploy |
| **196** | Verifier key mismatch | Recompile + artefacts + wipe + redeploy (never mix new keys with old chain/LevelDB) |
| `SubmissionError` / `FiberFailure` | Often wraps 117 or dust panic | Check logs for `Custom error: 117` or map overwrite |
| `Database failed to open` | Two processes on same LevelDB | One A2H / one script at a time; no parallel agents |

LevelDB directory default often collides with name `midnight-level-db`. **Wipe LevelDB without redeploy** → reliable 117.

---

## Prerequisites

- **Node.js ≥ 22**
- [bun](https://bun.sh)
- **Docker Desktop** (Compose v2)
- [Compact toolchain](https://docs.midnight.network) (`compact` CLI)
- Optional: [Lace](https://www.lace.io/) wallet set to Undeployed (reads / identity; writes are server-append)

Useful docs:

- [Midnight docs (llms-full)](https://docs.midnight.network/llms-full.txt)
- [midnight-local-dev](https://github.com/midnightntwrk/midnight-local-dev)
- [midskills get-started](https://midskills.sevryn.xyz/get-started)

---

## Quick start

Public npm only — no Lovable registry or Supabase project is required. The Midnight Undeployed path does not use `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`.

```bash
git clone https://github.com/arunnadarasa/zealymidnight.git
cd zealymidnight
bun install
cp .env.example .env   # if present; deploy also writes addresses
bun run compile        # compact → artefacts → docker up → deploy
bun run typecheck
bun run dev            # http://127.0.0.1:8080/
```

Confirm stack:

```bash
bun run midnight:status
# Indexer GraphQL: http://localhost:8088/api/v4/graphql
```

### End-to-end Move Rights rail

After clean deploy **and Vite restart**:

```bash
bun scripts/z-check.mjs          # mint → list → buy; prints E2E_OK
# or: bun scripts/e2e-move-nft.mjs
bun scripts/debug-musdc-transfer.mjs   # expect two sequential OK lines before A2H demos
```

Manual UI path:

1. `/moves` — preview metadata (optional Pinata clip) → **Prove & append** + **mint**
2. `/market` — list / buy with experimental mUSDC
3. `/shop?mode=a2h` — one Claim / Approve / Settle at a time (shared LevelDB)
4. `/judge` — five contracts + settlement history (browser `localStorage` ledger)

First cold proof can take **~4 minutes**.

---

## Environment

Prefer **deploy JSON** over env after every redeploy.

```
VITE_NETWORK_ID=undeployed
VITE_INDEXER_URL=http://localhost:8088/api/v4/graphql
VITE_INDEXER_WS_URL=ws://localhost:8088/api/v4/graphql/ws
VITE_PROOF_SERVER_URL=http://localhost:6300
VITE_NODE_URL=http://localhost:9944
VITE_DEFAULT_CONTRACT=<from deploy>
```

### Pinata / IPFS (optional, server-only)

Never prefix with `VITE_` (leaks JWT to the browser / breaks Cloudflare builds):

```
PINATA_JWT=...
PINATA_GATEWAY=...   # optional
```

Restart Vite, then:

```bash
curl -s http://localhost:8080/api/public/pin
# → {"enabled":true,...}
```

---

## Docker image pins

| Service | Image | Port |
| --- | --- | --- |
| Node | `midnightntwrk/midnight-node:0.22.5` | 9944 |
| Indexer | `midnightntwrk/indexer-standalone:4.0.2` | 8088 |
| Proof server | `midnightntwrk/proof-server:8.0.3` | 6300 |

Compose file: `docker-compose.yml`. Project name in some environments: `streetdancearc-main` (containers may outlive a deleted Downloads checkout — recreate with this repo’s compose).

```bash
bun run midnight:down
bun run midnight:up
bun run midnight:deploy   # required after chain reset
# restart bun run dev + hard-refresh browser
```

---

## Redeploy checklist (after any Compact change)

```bash
bun run midnight:compile && bun run midnight:artefacts
# stop Vite
rm -rf midnight-level-db .midnight
# if chain/private state may be dirty, recreate containers too
bun run midnight:deploy
bun run dev -- --port 8080 --host 127.0.0.1
# hard-refresh browser
bun scripts/debug-musdc-transfer.mjs
bun scripts/z-check.mjs
```

Never mix new verifier keys with an old LevelDB or old on-chain state (**196**). Prefer **full** deploy over musdc-only when state may be dirty.

---

## Scripts

| Script | Purpose |
| --- | --- |
| `bun run midnight:compile` | Compile all five `.compact` sources |
| `bun run midnight:artefacts` | Copy keys/zkir/contract into `public/contract/` |
| `bun run midnight:up` / `down` / `status` | Local Undeployed stack |
| `bun run midnight:deploy` | Deploy genesis seed `…0002`; reset move-nft local state |
| `bun run compile` | compile → artefacts → up → deploy |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run dev` | App on `:8080` |
| `bun scripts/z-check.mjs` | Exclusive e2e mint → list → buy (`E2E_OK`) |
| `bun scripts/debug-musdc-transfer.mjs` | Two sequential mUSDC transfers (sanity before A2H) |
| `bun scripts/redeploy-musdc.mjs` | Insert-only mUSDC only (prefer full deploy if dirty) |
| `bun scripts/verify-movenft-rail.mjs` | Artefact / rail sanity |
| `bun scripts/rail-check.mjs` | Broader Undeployed diagnostics |

Use `bun scripts/foo.mjs` — **`bun <<'EOF'` does not execute scripts**.

---

## HTTP API (Undeployed writes)

| Route | Circuit / action |
| --- | --- |
| `POST /api/public/append-entry` | MoveRegistry `appendEntry` |
| `POST /api/public/move-nft-mint` | MoveNft `mint` |
| `POST /api/public/move-nft-list` | MoveNft `listSale` |
| `POST /api/public/move-nft-buy` | mUSDC pay + MoveNft `buy` |
| `POST /api/public/move-nft-cancel` | MoveNft `cancel` |
| `POST /api/public/move-nft-transfer` | MoveNft `transfer` |
| `GET` / `POST /api/public/pin` | Pinata status + pin |
| `POST /api/public/ap2-anchor` | MandateVault `anchorMandate` |
| `POST /api/public/ucp-record-order` | OrderLedger `recordOrder` |
| `POST /api/public/musdc-faucet` | MidnightUSDC `faucet` |
| `POST /api/public/musdc-transfer` | MidnightUSDC `transfer` |
| `POST /api/public/purchase` | x402 challenge + server settle |

Implementation pattern (all families): open wallet → `findDeployedContract` → `callTx` → **`stop()` in `finally`**. Do **not** cache `MidnightWalletProvider` across HTTP requests (`append-entry` used to; that blocked the next mUSDC call).

---

## Verify on the indexer

```graphql
query($addr: HexEncoded!) {
  contractAction(address: $addr) {
    ... on ContractCall {
      entryPoint
      transaction { hash block { height } }
    }
  }
}
```

```graphql
query($h: HexEncoded!) {
  transactions(offset: { hash: $h }) {
    hash
    id
    block { height }
  }
}
```

Indexer tx hashes and midnight-js `txId` strings can differ — **indexer is source of truth**.

`/judge` settlement rows start as **Pending** in browser `localStorage` until `fetchTxStatuses` finds the hash in the indexer. After a chain wipe, old rows stay Pending forever — **Clear** the panel; they are not stuck in-flight txs.

---

## A2H / agent payout notes

- Shared genesis LevelDB → **one write at a time** (`railBusy` in UI).
- Primary receipt = **mUSDC transfer**; MoveRegistry `appendEntry` is **soft-fail** on claim/payout.
- On Undeployed, Circle ERC-1271 is **skipped** (no `CIRCLE_API_KEY` in the UI); Ed25519 + optional MandateVault anchor.
- “Failed to fetch” on long Approve often means the **browser dropped** during a cold prove — check indexer before retrying.

---

## Wallet session model

| Environment | Who signs |
| --- | --- |
| Local Undeployed | Server genesis wallet (`GENESIS_SEED` …0002) |
| Preview / preprod (future) | Lace |

Cloudflare production builds **stub** Midnight Node modules; local `vite dev` keeps real server-append (`midnightSsrStub` applies on `build` only). Nested `@midnight-ntwrk/onchain-runtime-v3` is removed in `postinstall` to avoid `ChargedState` / `StateValue` crashes.

---

## Learnings (summary)

Full narrative: [`Cursor Input.md`](./Cursor%20Input.md).

**What worked**

- Insert-only Compact maps (MoveNft **and** MidnightUSDC)
- Fresh wallet + `stop()` per `callTx`
- Deploy JSON over stale `VITE_*`
- Server-append only on Undeployed
- Soft-fail secondary registry appends
- Pinata server-only JWT

**Do differently next time**

1. Design all demo maps insert/append-only before first Undeployed demo  
2. Never cache wallet providers across requests  
3. One exclusive stack-owner process for e2e (no parallel agents on Docker/LevelDB)  
4. After Compact changes: compile → artefacts → wipe LevelDB → deploy → restart Vite → hard-refresh → `z-check`  
5. Push Midnight work only to `zealymidnight` — never force-push Lovable history  

---

## Notes

- **mUSDC is experimental** — no peg, never Mainnet.
- Arc ERC-721 market code may remain but is **out of the Undeployed path**.
- Git: do not rewrite published Lovable history (see `AGENTS.md`).

## License

MIT (see `LICENSE` if present) / project source as published on GitHub.
