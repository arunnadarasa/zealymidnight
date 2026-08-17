---
name: midnight-undeployed
description: >-
  Ships Midnight Network Local Undeployed dApps (Compact contracts, genesis
  server-append, Lace identity-only, proof server, indexer GraphQL, tDUST,
  mUSDC). Use when working on Midnight, Undeployed, Compact, StreetRail,
  zealymidnight, z-check, MoveNft, MidnightUSDC, RpcError 117/196, Docker
  node/indexer/proof-server, or a clone-and-README hackathon demo that must
  run offline.
---

# Midnight Undeployed (Cursor)

Local Undeployed is a Docker Midnight stack. **Lace does not sign writes.** Every Compact write goes through a server route that opens the **genesis** wallet, proves, submits, then `stop()`s.

Ops brain for this repo: [`Cursor Input.md`](../../../Cursor%20Input.md). Human README: [`README.md`](../../../README.md). RpcError table and Compact snippets: [reference.md](reference.md).

## Stack pins (this repo)

| Piece | Pin / port |
| --- | --- |
| Node | `midnight-node:0.22.5` `:9944` |
| Indexer | `indexer-standalone:4.0.2` `:8088` |
| Proof server | `proof-server:8.0.3` `:6300` |
| midnight-js / testkit | `4.1.1` |
| wallet-sdk | `1.2.0` — **not** `@midnight-ntwrk/wallet@5` |
| compact-runtime | `0.16.0` |
| Compact | `0.31.x`, pragma `0.23` |
| App | Vite / TanStack Start `:8080` |

If the [Midnight Support Matrix](https://docs.midnight.network/relnotes/support-matrix) disagrees on public networks, the matrix wins. For **this** Undeployed compose file, the table above wins.

## Shared constants (mismatch = RpcError 117)

One module imported by **deploy and every append path**: `src/lib/midnight-shared.ts`.

- `GENESIS_SEED` ends in `…0002` (standalone funds this seed, **not** `…0001`)
- Stable `PRIVATE_STATE_ID` / `PRIVATE_STATE_STORE` (never `Date.now()`)
- `DEPLOYER_SECRET_HEX` + witness **domains** (`abodc:author:v1`, `movenft:minter:v1`, `musdc:signer:v1`, …)
- `setNetworkId("undeployed")` as a **string** (`NetworkId` from midnight-js is type-only at 4.1.1)
- Node scripts: `import WebSocket from "ws"; globalThis.WebSocket = WebSocket`
- Resolve Compact emit as `contracts/managed/<name>/contract/index.js` (`.cjs` fallback only)

Prefer `src/data/midnight-contract.undeployed.json` over `VITE_*` addresses. After redeploy: restart Vite **and hard-refresh** the browser.

## Non-negotiables

1. **Insert-only Compact maps.** Updating an existing `Map` key on Undeployed → `feesWithMargin` / `transaction_merge` Unreachable / `SubmissionError`. Applies to MoveNft **and** MidnightUSDC.
2. **Never cache `MidnightWalletProvider` across HTTP requests.** Open → `callTx` → `stop()` in `finally`. A cached wallet holds LevelDB open.
3. **One Midnight write at a time.** Shared genesis LevelDB. UI: `railBusy`. Ops: no parallel agents wiping LevelDB mid-prove.
4. **Witness hash ≠ empty is not access control.** MandateVault pattern: `assert(pk == buyer)` (or stored `minter_pk` / `signing_key_fpr` / `faucet_claimed.member(fromPk)`). Any non-empty secret satisfies `auth != pad(32, "")`.
5. **Public clone must install from public npm.** Never commit a `bun.lock` generated inside Lovable. Sandbox `*.pkg.dev/lovable*` URLs 403. `@lovable.dev/vite-tanstack-config` is not on the public registry.
6. **Midnight Undeployed does not need Supabase.** Do not register `attachSupabaseAuth` as global middleware. Missing `SUPABASE_*` must not 500 the app.
7. **Quest README attribution** (exact, near the top): `This project is built on the Midnight Network.`
8. **Do not force-push / rebase published Lovable history.** Push Midnight work to this repo only.

## Vite / TanStack

- Public plugins only: `tanstackStart()`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `nitro/vite`, wasm + TLA.
- `midnightSsrStub` must use `apply: "build"` (not `"serve"`). `"serve"` stubs `/api/public/*` in `vite dev` and the UI never hits Compact.
- Pinata is server-only (`PINATA_JWT`). Never `VITE_PINATA_*`.
- `postinstall` may strip nested `onchain-runtime-v3` under `midnight-js-protocol` — keep that.

## Five contracts (this app)

| Key | Compact | Witness domain |
| --- | --- | --- |
| moveRegistry | `MoveRegistry.compact` | `abodc:author:v1` |
| moveNft | `MoveNft.compact` | `movenft:minter:v1` |
| mandateVault | `MandateVault.compact` | `ap2:buyer:v1` |
| orderLedger | `OrderLedger.compact` | `ucp:merchant:v1` |
| midnightUsdc | `MidnightUSDC.compact` | `musdc:signer:v1` |

UI list `src/lib/contracts.ts` must stay length **5**. Circuit `listSale` — `list` is a Compact keyword.

Soft-fail secondary `appendEntry` after a successful mUSDC transfer. Buy atomicity is **API-level only** (sequential genesis sessions).

## Commands

```bash
bun install
bun run typecheck
bun run midnight:status
bun run midnight:compile && bun run midnight:artefacts
docker compose -p streetdancearc-main -f docker-compose.yml up -d
rm -rf midnight-level-db .midnight && bun run midnight:deploy
bun scripts/debug-musdc-transfer.mjs    # expect two OK lines
bun scripts/z-check.mjs                 # expect E2E_OK
bun run dev -- --port 8080 --host 127.0.0.1
```

Confirm cwd is **this** repo before judging UX. Do not pipe proves through `awk`/`head` (SIGPIPE). Use `tee` then `rg`.

## 117 / 196 recovery (in order)

RpcError **117** = private-state / seed / store mismatch. **196** = verifier mismatch.

1. Stop Vite
2. `rm -rf midnight-level-db .midnight`
3. Recreate compose if the chain may be dirty: `docker compose -p streetdancearc-main -f docker-compose.yml up -d`
4. For **196**: `bun run midnight:compile && bun run midnight:artefacts` first
5. `bun run midnight:deploy` (prefer full deploy over musdc-only)
6. `bun scripts/debug-musdc-transfer.mjs`
7. Restart Vite, hard-refresh, **one** UI action

After any Compact auth change: compile → artefacts → wipe → full deploy → restart Vite → `z-check`. Circuit **signatures** can stay the same; witnesses must actually bind.

## Clone-and-README bar (Aliit / Zealy)

Before claiming a fresh clone works:

- [ ] `bun.lock` has **zero** `pkg.dev/lovable` URLs
- [ ] `bun install` from public npm
- [ ] `bun run typecheck` (`tsc --noEmit`) exits 0
- [ ] `bun run dev` with **only** `.env.example` — `/` `/judge` `/moves` `/market` `/shop` HTTP 200
- [ ] Five contracts deploy; `bun scripts/z-check.mjs` prints `E2E_OK`
- [ ] README contains the exact Midnight Network sentence

## UX copy

User-facing strings = Midnight / Lace / mUSDC / local indexer. Not Arcscan, Arc Testnet, Circle faucet, Privy, or raw `CIRCLE_API_KEY`. mUSDC is experimental — no peg, never Mainnet.

## Additional resources

- [reference.md](reference.md) — Compact auth snippets, RpcError table, wallet session pattern
- [`Cursor Input.md`](../../../Cursor%20Input.md) — full trap list and Aliit R1 notes
- [`.agents/skills/lovable-midnight/SKILL.md`](../../../.agents/skills/lovable-midnight/SKILL.md) — broader Midnight (preview/preprod + Lovable) skill
