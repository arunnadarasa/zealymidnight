# Cursor Input — StreetRail on Midnight Local Undeployed

**Audience:** Lovable AI / Cursor agents continuing this repo.  
**Repo:** https://github.com/arunnadarasa/zealymidnight (push Midnight work **here only**).  
**Do not** force-push, rebase, or rewrite published Lovable history. **Do not** push Midnight Undeployed work to `streetdancearc` / Arc remotes.

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
   User-facing strings = Midnight / Lace / mUSDC / local indexer — not Arcscan, Arc Testnet, Circle faucet, Privy, or raw `CIRCLE_API_KEY`.

---

## Five contracts (judge + deploy)

| Key | Compact | Circuits / actions | Witness domain |
| --- | --- | --- | --- |
| moveRegistry | `MoveRegistry.compact` | `appendEntry` | `abodc:author:v1` |
| moveNft | `MoveNft.compact` | `mint`, `listSale`, `buy`, `cancel`, `transfer` | `movenft:minter:v1` |
| mandateVault | `MandateVault.compact` | `anchorMandate` | `ap2:buyer:v1` |
| orderLedger | `OrderLedger.compact` | `recordOrder` | `ucp:merchant:v1` |
| midnightUsdc | `MidnightUSDC.compact` | `faucet`, `transfer` | `musdc:signer:v1` |

UI list: `src/lib/contracts.ts` → `CONTRACTS` (length **5**). Judge heading must say **five** deployed contracts (`src/routes/judge.tsx`).

### MoveNft ledger design

```
owners: Map       // insert on mint only
listed_price: Map // insert on listSale / cancel-with-new-key
sales: Map        // append buy/transfer with fresh random id
```

Owner for demo UX: `src/data/move-nft-state.undeployed.json` (reset on deploy).  
Owner PK = `sha256("movenft:owner:v1:" + label)` — **not** raw `sha256(label)`.  
Circuit name is **`listSale`** (`list` is a Compact keyword).

### MidnightUSDC ledger design

```
credits / credit_to   // insert by nonce (transfer) or once by pk (faucet)
faucet_claimed        // Set
spent_nonces          // Set
```

**Do not** overwrite `balances[from]` / `balances[to]`. That was the A2H settle/claim `SubmissionError` after MoveNft was already fixed.

Buy path atomicity is **API-level only**: mUSDC then MoveNft.buy, same genesis family, sequential sessions.

---

## Successes (keep doing)

1. E2E Move Rights rail on Undeployed — `bun scripts/z-check.mjs` → `E2E_OK`.  
2. Server-append write path (Lace optional for identity only).  
3. Insert-only MoveNft (`1aa7194` lineage) + insert-only MidnightUSDC (`65870c4`).  
4. Deploy JSON address resolution; move-nft state reset on deploy.  
5. Market / gallery / activity on Undeployed (off Arc pause path).  
6. Pinata server-only (`PINATA_JWT`, never `VITE_PINATA_*`).  
7. A2H `railBusy` + `useElapsed` timers (`f1c44d5`, `160eff2`) — cold prove ~4 min.  
8. Arc→Midnight UX scrub (shop, A2A, primer, judge, mandate/treasury) — `9d917d7`, `6893850`, `7997c8b`, `a2583d3`.  
9. `append-entry` fresh wallet + `stop()` (no long-lived `ctxPromise`).  
10. Claim soft-fails registry append (aligned with payout).  
11. Humanized RpcError **117** copy in `a2h-engine.server.ts`.  
12. Circle ERC-1271 skipped on Undeployed / missing `CIRCLE_API_KEY` (`erc1271.server.ts`) — UI never shows `missing_secret: CIRCLE_API_KEY`.  
13. Verified 2× sequential `musdcTransfer` after wipe + full deploy (`scripts/debug-musdc-transfer.mjs`).

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
| 8 | Wrong Vite tree | Arc UX on `:8080` | Confirm `/tmp/zealy-recover` or zealymidnight cwd |
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
12. Scrub Arc chrome when user screenshots still show Circle/Arcscan/`CIRCLE_API_KEY`.

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

---

## Outcome snapshot

| Item | Status |
| --- | --- |
| Five Compact contracts + artefacts | Working |
| Insert-only MoveNft + MidnightUSDC | Shipped |
| Server mint/list/buy/cancel/transfer | Working |
| E2E mint → list → buy | Verified (`E2E_OK`) |
| A2H railBusy + timers + soft-fail claim | Shipped |
| Arc → Midnight UX (incl. CIRCLE scrub) | Shipped |
| appendEntry fresh wallet | Shipped |
| Pinata optional clip | Wired server-side |
| Arc ERC-721 market | Feature-gated / out of path |
| Judge “five deployed contracts” | Keep in sync with `CONTRACTS.length` |
| RpcError 117 | Recoverable via wipe + compose + full deploy + 2× transfer verify |

---

## Agent response habits for this repo

- Confirm **cwd** and that Vite serves **this** tree before claiming UX bugs.  
- After Compact or deploy JSON changes: compile → artefacts → wipe if needed → deploy → restart Vite → hard-refresh → verify with scripts before asking the user to click.  
- When user says “scrub Arc”: hunt user-visible strings + mandate `detail` + treasury panel + primer/judge — not only the word “Arc”.  
- When user asks to push: commit docs + relevant code to **zealymidnight** only.  
- Do not invent Mainnet / peg claims for mUSDC.

---

*Feed this file to Lovable / Cursor at session start. Update it whenever you learn a new Undeployed failure mode or ship a recovery that should become default practice.*
