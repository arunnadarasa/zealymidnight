# Cursor Input — StreetRail on Midnight Local Undeployed

**Audience:** Lovable AI / Cursor agents continuing this repo.  
**Repo:** https://github.com/arunnadarasa/zealymidnight (push Midnight work **here only**).  
**Do not** force-push, rebase, or rewrite published Lovable history. **Do not** push Midnight Undeployed work to `streetdancearc` remotes.

**Cursor skill (load first):** [`.cursor/skills/midnight-undeployed/SKILL.md`](./.cursor/skills/midnight-undeployed/SKILL.md) — Local Undeployed playbook (server-append, insert-only Compact, public npm, witness binding). Detail: [reference.md](./.cursor/skills/midnight-undeployed/reference.md). Lovable-oriented Midnight skill (preview/preprod + Undeployed): [`.agents/skills/lovable-midnight/SKILL.md`](./.agents/skills/lovable-midnight/SKILL.md).

This file is the **ops + lessons brain**. Prefer it over rediscovering dust-wallet / LevelDB failures from scratch.

External refs (skim before long rabbit holes):

- https://docs.midnight.network/llms-full.txt
- https://github.com/midnightntwrk/midnight-local-dev
- https://midskills.sevryn.xyz/get-started

Human-facing technical overview: [`README.md`](./README.md).

---

## Mission snapshot

StreetRail = streetwear catalog + **private choreography rights** on Midnight **Local Undeployed**.

| Layer | Truth |
| --- | --- |
| Network | Docker Undeployed (node `:9944`, indexer `:8088`, proof `:6300`) |
| Contracts | **Five** Compact: MoveRegistry, MoveNft, MandateVault, OrderLedger, MidnightUSDC |
| Writes | Genesis **server-append** (`GENESIS_SEED` …0002). Lace does **not** sign Undeployed. |
| Reads | Local indexer GraphQL |
| App | Vite / TanStack Start `:8080` — confirm cwd is this repo before judging UX |
| Settlement token | Experimental **mUSDC** (no peg, never Mainnet) |

Shared constants (deploy + every append path must match or → **117**): `src/lib/midnight-shared.ts`.

---

## Non-negotiable engineering rules

1. **Insert-only / append-with-new-key Compact maps**  
   Updating an existing `Map` key on Undeployed → `feesWithMargin` / `transaction_merge` Unreachable / `SubmissionError`. Applies to **MoveNft and MidnightUSDC** (and any new contract).

2. **Never cache `MidnightWalletProvider` across HTTP requests**  
   Pattern: open → `callTx` → `stop()` in `finally` (`withMusdc`, `withMoveNft`, `append-entry.server.ts`). A cached wallet holds LevelDB open and breaks the next family of calls.

3. **Prefer deploy JSON over `VITE_*` addresses**  
   Read `src/data/midnight-contract.undeployed.json` first. After redeploy: restart Vite + **hard-refresh** browser (HMR is not enough).

4. **One Midnight write at a time**  
   Shared genesis LevelDB. UI: `railBusy` on A2H. Ops: no parallel agents `pkill`ing / wiping LevelDB mid-prove.

5. **Soft-fail secondary MoveRegistry appends**  
   A2H claim/payout: mUSDC transfer is the primary receipt; `appendEntry` failure must not fail the whole action.

6. **Git**  
   Commit when asked; push to `origin` = zealymidnight. No `--force` to main. No secrets (`.env`, LevelDB) in commits.

7. **UX copy**  
   User-facing strings = Midnight / Lace / mUSDC / local indexer — not EVM explorers, Circle faucet, Privy, or raw `CIRCLE_API_KEY`.

8. **Public clone must install from public npm**  
   Never commit a `bun.lock` generated inside Lovable. Sandbox tarball URLs (`europe-west*-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache`) 403 outside Lovable. `@lovable.dev/vite-tanstack-config` is **not** on the public registry. Use public Vite + TanStack Start plugins (`tanstackStart()`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `nitro/vite`).

9. **Midnight Undeployed does not need Supabase**  
   Do not register `attachSupabaseAuth` as global `functionMiddleware`. A missing `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` must not 500 the app. Guard the client (Pinata-style); leave those keys out of `.env.example`.

10. **Witness hash ≠ empty is not access control**  
    MandateVault pattern: `assert(pk == buyer)` (or stored `minter_pk` / `signing_key_fpr` / `faucet_claimed.member(fromPk)`). Any non-empty secret satisfies `auth != pad(32, "")`.

11. **Quest / awesome-list README attribution**  
    Near the top of `README.md`, exact sentence: `This project is built on the Midnight Network.` Paraphrases do not count. `bun run typecheck` (`tsc --noEmit`) must exit 0.

---

## Five contracts (judge + deploy)

| Key | Compact | Circuits / actions | Witness domain |
| --- | --- | --- | --- |
| moveRegistry | `MoveRegistry.compact` | `appendEntry` | `abodc:author:v1` |
| moveNft | `MoveNft.compact` | `mint`, `listSale`, `buy`, `cancel`, `transfer` | `movenft:minter:v1` |
| mandateVault | `MandateVault.compact` | `anchorMandate` | `ap2:buyer:v1` |
| orderLedger | `OrderLedger.compact` | `recordSigningKey`, `recordOrder` | `ucp:merchant:v1` |
| midnightUsdc | `MidnightUSDC.compact` | `faucet`, `transfer` | `musdc:signer:v1` |

UI list: `src/lib/contracts.ts` → `CONTRACTS` (length **5**). Judge heading must say **five** deployed contracts (`src/routes/judge.tsx`).

### MoveNft ledger design

```
owners: Map       // insert on mint only
listed_price: Map // insert on listSale / cancel-with-new-key
sales: Map        // append buy/transfer with fresh random id
minter_pk         // Bytes<32> — first call discloses pk; later assert(pk == minter_pk)
```

Owner for demo UX: `src/data/move-nft-state.undeployed.json` (reset on deploy).  
Owner PK = `sha256("movenft:owner:v1:" + label)` — **not** raw `sha256(label)`.  
Circuit name is **`listSale`** (`list` is a Compact keyword).  
Minter auth is **in-circuit** (`movenft:minter:v1` vs stored `minter_pk`). Per-token owner stays off-chain because `owners.lookup` / overwrite is dust-unsafe.

### OrderLedger auth

`recordSigningKey` bootstraps `signing_key_fpr`. **`recordOrder` must read `merchantSecret()`** and `assert(pk == signing_key_fpr)` after `signing_key_fpr != empty`. An unused witness on the order path fails Aliit review even if `recordSigningKey` is correct. Server already calls `recordSigningKey` first (`src/lib/record-order.server.ts`).

### MidnightUSDC ledger design

```
credits / credit_to   // insert by nonce (transfer) or once by pk (faucet)
faucet_claimed        // Set — transfer requires member(fromPk)
spent_nonces          // Set
```

**Do not** overwrite `balances[from]` / `balances[to]`. That was the A2H settle/claim `SubmissionError` after MoveNft was already fixed.  
**Do not** replace spend auth with `fromPk != pad(32, "")` — that is the same empty-hash undercut as old MoveNft. Bind the witness: `assert(faucet_claimed.member(disclose(fromPk)), "signer")`.

Buy path atomicity is **API-level only**: mUSDC then MoveNft.buy, same genesis family, sequential sessions.

---

## Successes (keep doing)

1. E2E Move Rights rail on Undeployed — `bun scripts/z-check.mjs` → `E2E_OK`.  
2. Server-append write path (Lace optional for identity only).  
3. Insert-only MoveNft (`1aa7194` lineage) + insert-only MidnightUSDC (`65870c4`).  
4. Deploy JSON address resolution; move-nft state reset on deploy.  
5. Market / gallery / activity on Undeployed (off the paused EVM market path).  
6. Pinata server-only (`PINATA_JWT`, never `VITE_PINATA_*`).  
7. A2H `railBusy` + `useElapsed` timers (`f1c44d5`, `160eff2`) — cold prove ~4 min.  
8. EVM→Midnight UX scrub (shop, A2A, primer, judge, mandate/treasury) — `9d917d7`, `6893850`, `7997c8b`, `a2583d3`.  
9. `append-entry` fresh wallet + `stop()` (no long-lived `ctxPromise`).  
10. Claim soft-fails registry append (aligned with payout).  
11. Humanized RpcError **117** copy in `a2h-engine.server.ts`.  
12. Circle ERC-1271 skipped on Undeployed / missing `CIRCLE_API_KEY` (`erc1271.server.ts`) — UI never shows `missing_secret: CIRCLE_API_KEY`.  
13. Verified 2× sequential `musdcTransfer` after wipe + full deploy (`scripts/debug-musdc-transfer.mjs`).  
14. Aliit R1 recovery: public Vite config + regenerated `bun.lock`; Supabase optional; MoveNft `minter_pk`; OrderLedger `recordOrder` binds merchant pk; mUSDC `faucet_claimed.member(fromPk)`; `purchase` passes `toHex`; `bun run typecheck` clean; `z-check` → `E2E_OK`.

---

## Failures / traps (do not repeat)

| # | Trap | Symptom | Fix |
| --- | --- | --- | --- |
| 1 | Map key overwrite in Compact | `feesWithMargin` / `transaction_merge` Unreachable | Insert-only design |
| 2 | Cached genesis wallet | Next `musdcTransfer` SubmissionError | Fresh wallet + `stop()` |
| 3 | Wipe LevelDB without redeploy | RpcError **117** | Full deploy after wipe |
| 4 | Partial musdc-only redeploy on dirty state | 117 / key mismatch | Prefer full `midnight:deploy` |
| 5 | LevelDB goes stale again after success | Later claim fails 117 | Re-run recovery loop; one UI action |
| 6 | Claim threw on append after mUSDC OK | “Claim failed” with transfer on chain | Soft-fail append |
| 7 | Parallel A2H clicks / agents | Database failed to open | `railBusy` + exclusive ops |
| 8 | Wrong Vite tree | Stale EVM UX on `:8080` | Confirm `/tmp/zealy-recover` or zealymidnight cwd |
| 9 | Vite not restarted / no hard-refresh | Dead contract / missing timers | Restart + hard-refresh |
| 10 | `bun <<'EOF'` | Help text, no script | `bun scripts/foo.mjs` |
| 11 | Docker workdir vanished | Containers orphaned | Recreate via this repo `docker-compose.yml` |
| 12 | Piping proves through `awk`/`head` | SIGPIPE / fake flakes | `tee` + `rg` afterward |
| 13 | Broad `pkill` shared patterns | Truncated e2e, wiped LevelDB mid-run | Unique script names; no parallel stack owners |
| 14 | Wrong owner PK in scripts | on-chain `not owner` | Use `movenft:owner:v1` domain |
| 15 | “Failed to fetch” on Approve | Browser timeout during cold prove | Check indexer; show elapsed |
| 16 | Stale `/judge` Pending rows | After chain wipe | Clear localStorage panel — not live stuck txs |
| 17 | RpcError **196** | Verifier mismatch | compile → artefacts → wipe → deploy |
| 18 | `VITE_PINATA_*` | JWT leak / CF build break | Server-only `PINATA_JWT` |
| 19 | Lovable `bun.lock` / `@lovable.dev/vite-tanstack-config` | Fresh clone `bun install` HTTP 403 | Public plugins in `vite.config.ts`; regenerate lockfile **outside** Lovable |
| 20 | Global `attachSupabaseAuth` | `bun run dev` 500; undocumented `SUPABASE_*` | Remove from `src/start.ts`; guard supabase client |
| 21 | `assert(auth != pad(32, ""))` / `fromPk != empty` | “Privacy on paper”; any secret works | Stored pk / `faucet_claimed.member` / MandateVault `pk == buyer` |
| 22 | `recordOrder` never reads `merchantSecret` | Witness unused on the order path | Assert `pk == signing_key_fpr` |
| 23 | `musdcTransfer({ amountAtomic })` | `tsc` error; settle path cannot typecheck | Pass `toHex` (sha256 of treasury label) |
| 24 | Missing exact README attribution | awesome-dapps PR blocked | Exact: `This project is built on the Midnight Network.` |

`SubmissionError` / `FiberFailure` often **wrap** `RpcError 1010: Invalid Transaction: Custom error: 117`.

---

## How to do things differently (standing playbook)

1. Design **all** Compact public maps insert/append-only before the first Undeployed demo.  
2. Never cache wallet providers; always `stop()` in `finally`.  
3. Soft-fail secondary registry appends; primary = mUSDC (or primary Compact write).  
4. **117 recovery checklist** (in order):  
   - Stop Vite  
   - `rm -rf midnight-level-db .midnight`  
   - Recreate node/indexer/proof if chain may be dirty:  
     `docker compose -p streetdancearc-main -f docker-compose.yml up -d`  
   - `bun run midnight:deploy`  
   - `bun scripts/debug-musdc-transfer.mjs` → expect **two** `OK` lines  
   - `bun run dev -- --port 8080 --host 127.0.0.1`  
   - Hard-refresh UI → **one** action only (Claim / settle / mint)  
5. Prefer full redeploy over musdc-only when private state may be dirty.  
6. Hard-refresh after every deploy JSON change.  
7. Instrument transfer vs append separately when debugging claim.  
8. One exclusive stack-owner for e2e; no parallel Docker/LevelDB users.  
9. Resolve addresses: undeployed JSON → then env.  
10. Document wallet session ≠ HTTP request: Undeployed = server genesis; preview/preprod = Lace.  
11. Keep README + this file + artefacts in sync with every green e2e / recovery.  
12. Scrub leftover EVM/Circle chrome when user screenshots still show Circle/`CIRCLE_API_KEY`.  
13. Before claiming “clone and follow the README”: `bun install` from a **public** lockfile, `bun run typecheck`, `bun run dev` with **only** `.env.example` (no Supabase), then `z-check`.  
14. After any Compact auth change: compile → artefacts → wipe LevelDB → full deploy → restart Vite → `z-check`. Circuit **signatures** can stay the same; witnesses must actually bind.

---

## RpcError / status UX

| Code | Agent action |
| --- | --- |
| 117 | Run recovery checklist above; do not keep retrying the same UI click |
| 104 | Wipe LevelDB + full deploy |
| 196 | Recompile artefacts + wipe + deploy |
| Pending on `/judge` | Indexer lookup miss or pre-wipe hash in `localStorage` — Refresh; Clear if wiped |

---

## Useful commands

```bash
bun run midnight:status
bun run midnight:compile && bun run midnight:artefacts
docker compose -p streetdancearc-main -f docker-compose.yml up -d
rm -rf midnight-level-db .midnight && bun run midnight:deploy
bun scripts/debug-musdc-transfer.mjs
bun scripts/redeploy-musdc.mjs          # only if state is known-clean
bun scripts/z-check.mjs
bun run typecheck
bun run dev -- --port 8080 --host 127.0.0.1
```

Image pins: node `0.22.5`, indexer `4.0.2`, proof-server `8.0.3` (see README / compose).

---

## Key files (where to edit)

| Concern | Path |
| --- | --- |
| Compact sources | `contracts/*.compact` |
| Shared seed / state ids | `src/lib/midnight-shared.ts` |
| Deploy addresses | `src/data/midnight-contract.undeployed.json` |
| Contract UI cards | `src/lib/contracts.ts` |
| mUSDC server | `src/lib/musdc.server.ts` |
| MoveNft server | move-nft `*.server.ts` / API routes |
| appendEntry | `src/lib/append-entry.server.ts` |
| A2H engine | `src/lib/a2h-engine.server.ts` |
| Mandate ERC-1271 skip | `src/lib/erc1271.server.ts` |
| Judge page | `src/routes/judge.tsx` |
| Tx history Pending/Confirmed | `src/components/dance/TxHistoryPanel.tsx`, `src/lib/tx-status.functions.ts` |
| A2H inbox / railBusy | `src/components/a2h/*` |
| Docs | `README.md`, this file |
| Public Vite (no Lovable) | `vite.config.ts`, `bunfig.toml`, `package.json` |
| Optional Supabase | `src/start.ts`, `src/integrations/supabase/client.ts` |

---

## Outcome snapshot

| Item | Status |
| --- | --- |
| Five Compact contracts + artefacts | Working |
| Insert-only MoveNft + MidnightUSDC | Shipped |
| Server mint/list/buy/cancel/transfer | Working |
| E2E mint → list → buy | Verified (`E2E_OK`) |
| A2H railBusy + timers + soft-fail claim | Shipped |
| EVM → Midnight UX (incl. CIRCLE scrub) | Shipped |
| appendEntry fresh wallet | Shipped |
| Pinata optional clip | Wired server-side |
| Legacy EVM ERC-721 market | Feature-gated / out of path |
| Judge “five deployed contracts” | Keep in sync with `CONTRACTS.length` |
| RpcError 117 | Recoverable via wipe + compose + full deploy + 2× transfer verify |
| Fresh clone `bun install` (public npm) | Working — no Lovable registry |
| `bun run dev` without Supabase | Working (`/` `/judge` `/moves` `/market` `/shop` 200) |
| Compact witness binding (minter / merchant / mUSDC signer) | Shipped |
| `bun run typecheck` | Clean |

---

## Agent response habits for this repo

- Confirm **cwd** and that Vite serves **this** tree before claiming UX bugs.  
- After Compact or deploy JSON changes: compile → artefacts → wipe if needed → deploy → restart Vite → hard-refresh → verify with scripts before asking the user to click.  
- When user says “scrub leftover EVM chrome”: hunt user-visible strings + mandate `detail` + treasury panel + primer/judge — not only one brand name.  
- When user asks to push: commit docs + relevant code to **zealymidnight** only.  
- Do not invent Mainnet / peg claims for mUSDC.  
- Do not commit a lockfile produced inside Lovable. If `bun.lock` contains `pkg.dev/lovable`, delete it and `bun install` on a public machine.  
- Aliit / Zealy: a circuit that hashes a witness and only checks non-empty is a **reject**. Copy MandateVault.

---

## Aliit R1 (2026-08-16) — what actually failed the quest

Reviewed as published on GitHub. Compact + z-check worked **after a reviewer-only install workaround**. The quest still requires another developer can clone and follow the README.

| Finding | Lesson |
| --- | --- |
| **CRITICAL** `bun install` 403 | Lockfile had 128 Lovable sandbox tarball URLs, zero `registry.npmjs.org`. `@lovable.dev/vite-tanstack-config` is not public. Rewrite `vite.config.ts` with `tanstackStart` / react / tailwind / nitro; strip `@lovable.dev/*` from `bunfig.toml`; regenerate `bun.lock` outside Lovable. |
| **CRITICAL** `bun run dev` 500 | Root loader `getPublicConfig` ran through `attachSupabaseAuth` → supabase client threw on missing `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`. Those names were not in `.env.example`. Midnight path does not need Supabase. Drop global middleware; guard the client. |
| **CRITICAL** MoveNft / mUSDC “auth” | Circuits hashed the witness then `assert(auth != pad(32, ""))` / `fromPk != empty`. Any secret passes. Fix: stored `minter_pk` bootstrap (same shape as OrderLedger `signing_key_fpr`); mUSDC `assert(faucet_claimed.member(fromPk))` while staying insert-only. MandateVault `pk == buyer` is the reference. |
| **RECOMMENDED** unused `merchantSecret` | `recordOrder` never read the witness (`recordSigningKey` did). Bind `pk == signing_key_fpr` on the order path. |
| **RECOMMENDED** typecheck | `POST /api/public/purchase` called `musdcTransfer({ amountAtomic })` without `toHex`. `tsc --noEmit` was 31 errors. Ship `bun run typecheck`; hash treasury label like `musdc-transfer.ts`. |
| Attribution | awesome-dapps requires the **exact** README sentence `This project is built on the Midnight Network.` near the top. Checklist-marked-done is not enough. |

Verified after the fix: public `bun install`, typecheck 0, routes 200 without Supabase, deploy five addresses, `z-check` `E2E_OK`.

---

*Feed this file to Lovable / Cursor at session start. Update it whenever you learn a new Undeployed failure mode or ship a recovery that should become default practice.*
