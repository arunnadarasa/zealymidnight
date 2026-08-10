# Cursor Input — Midnight Undeployed build notes

Lessons from shipping StreetRail’s Compact Move Rights NFT rail (mint → list → buy with mUSDC) on Midnight Local Undeployed, plus A2H payout/claim recovery and Arc→Midnight UX scrub for Zealy (`zealymidnight`).

External refs worth skimming before long Undeployed rabbit holes: [docs.midnight.network/llms-full.txt](https://docs.midnight.network/llms-full.txt), [midnight-local-dev](https://github.com/midnightntwrk/midnight-local-dev), [midskills get-started](https://midskills.sevryn.xyz/get-started).

---

## Successes

1. **End-to-end rail works on Undeployed**  
   Prove & append → MoveNft mint → market list → mUSDC pay → buy, with activity in the local ledger + indexer links. Verified with `scripts/z-check.mjs` / `scripts/e2e-move-nft.mjs` after a clean deploy (`E2E_OK`).

2. **Undeployed write path is server-append**  
   Lace cannot sign on Undeployed. Matching existing MoveRegistry / mUSDC patterns (genesis wallet + `findDeployedContract` + `callTx`) unblocked the demo without pretending Lace works locally.

3. **Insert-only Compact maps unblocked list/buy**  
   Root cause of repeated `feesWithMargin` / `transaction_merge` Unreachable: dust-wallet fee balancing panics when a circuit **updates an existing map key**. Mint/list insert new keys; buy/transfer append to a `sales` map with a fresh random id; current owner lives in the local JSON mirror for the demo.

4. **`list` is a Compact keyword**  
   Circuit renamed to `listSale` with matching prover/verifier artefacts. Calling `callTx.list` against `listSale` keys is a silent footgun.

5. **Prefer deploy JSON over stale `VITE_*` addresses**  
   Vite caches env across redeploys. Reading `src/data/midnight-contract.undeployed.json` (and resetting move-nft state on deploy) avoided “mint to dead contract” confusion.

6. **mUSDC settlement sequenced in the API**  
   No cross-contract Compact call in v1: `musdcFaucet` / `musdcTransfer` then `MoveNft.buy` in one server handler. Documented as demo atomicity (same genesis wallet).

7. **UI off the Arc pause path**  
   Market / gallery / activity rewired for Midnight + indexer when `VITE_NETWORK_ID=undeployed`, so Prove & append produces something listable instead of an amber “nothing to sell” banner.

8. **Pinata stays server-only**  
   `PINATA_JWT` / `PINATA_GATEWAY` never use the `VITE_` prefix (Arc/Cloudflare trap). MintForm enables clip UI from server config.

9. **Git hygiene for Lovable**  
   No force-push / rebase of published history. `.env` untracked; LevelDB gitignored. Midnight work pushes only to `zealymidnight` — never force-push Lovable/`streetdancearc`.

10. **A2H one-at-a-time UX + elapsed timers** (`f1c44d5`, `160eff2`)  
    Shared `railBusy` lock disables sweep / settle / claim / approve / renew while a Midnight write runs; amber banner warns about shared genesis LevelDB. `useElapsed` shows live seconds and “up to ~4 min cold” on busy actions.

11. **Arc chrome scrubbed to Midnight** (`9d917d7`, `6893850`, `7997c8b`)  
    Shop receipts, A2A `GxHome` x402 steps, primer cards/glossary, and `/judge` copy now say Midnight Undeployed / Lace / mUSDC / local indexer (not Arcscan / Circle faucet / Privy).

12. **Insert-only MidnightUSDC** (`65870c4`)  
    Same dust lesson as MoveNft (`1aa7194`): `transfer` no longer overwrites `balances[fromPk]` / `balances[to]`. Ledger is append-only `credits` / `credit_to` keyed by nonce; faucet credits the signer once. Helper: `scripts/redeploy-musdc.mjs`.

13. **`appendEntry` no longer caches a genesis wallet**  
    Long-lived `ctxPromise` held LevelDB open and caused the next `musdcTransfer` to fail with `SubmissionError`. Pattern now matches `withMusdc` / `withMoveNft`: fresh wallet + `stop()` in `finally`.

14. **Claim soft-fails registry append**  
    After a successful mUSDC transfer, MoveRegistry `appendEntry` errors no longer fail the whole claim (same as `sendPayoutMidnight`).

15. **Humanized RpcError 117**  
    A2H engine maps `Custom error: 117` to actionable wipe → redeploy → restart Vite copy instead of a raw FiberFailure blob.

16. **Verified clean-stack transfers**  
    After wipe + full `midnight:deploy`, two sequential `musdcTransfer` calls succeed via `scripts/debug-musdc-transfer.mjs` (e.g. earlier `OK cedc4c…` / `OK d91a23…`; post-recovery `OK 0d7334…` / `OK 0704e4…`).

---

## Failures / traps

1. **Second `callTx` on the same genesis wallet after map overwrites**  
   Mint succeeded; list/buy failed with `Wallet.Other: wasm.transaction_feesWithMargin` or `transaction_merge` Unreachable. Looked like “cache invalidation” or “process isolation” for a long time; the real fix was insert-only ledger design + fresh wallet per call (`withMoveNft`, same idea as mUSDC `withMusdc`).

2. **RpcError 117 / 104 / 196**  
   - **117**: stale private state / LevelDB vs chain (concurrent clients, killed mid-prove, wipe LevelDB without redeploy). `SubmissionError` / `FiberFailure` often **wrap** `RpcError 1010: Invalid Transaction: Custom error: 117`.  
   - **104**: dirty LevelDB after a failed faucet/mint handoff.  
   - **196**: verifier key mismatch (recompiled artefacts without redeploy, or deploy against wrong keys).

3. **Competing agents killing each other’s processes**  
   Parallel Cursor shells `pkill`’d `bun -e`, `e2e-move`, `deploy-midnight`, and wiped `midnight-level-db` mid-run. Symptoms: “exit 0” with truncated logs, empty tee output, deploy JSON timestamps that didn’t match the run. Use uniquely named scripts (`z-check.mjs`) and never broadly pkill shared patterns while another job holds the stack.

4. **Piping long proves through `awk`/`head`**  
   SIGPIPE killed prove processes; e2e looked flaky. Prefer `tee` to a log file and `rg` afterward.

5. **Faucet before mint in the same LevelDB session**  
   Opening mUSDC then MoveNft on the shared genesis LevelDB left the next MoveNft submit broken. Order that worked for full rail: mint → list → faucet (if needed) → pay → buy, with wallet `stop()` between contract families.

6. **Wrong owner PK in diagnostics**  
   Server uses `sha256("movenft:owner:v1:" + label)`; ad-hoc scripts used raw `sha256(label)` → on-chain `not owner` while local ledger looked fine.

7. **Vite not restarted after redeploy**  
   SSR kept old contract addresses until process restart. Redeploy ⇒ restart `bun run dev` ⇒ **hard-refresh** the browser (HMR alone can leave a stale client bundle — e.g. missing elapsed timers).

8. **README / GitHub drift**  
   Docs described MoveNft while substantial code was still local-only; a follow-up push was required so Zealy/GitHub matched the README.

9. **macOS has no `flock`**  
   Exclusive locks need `mkdir`-based locks or careful process naming, not Linux `flock`.

10. **“Failed to fetch” on long Approve**  
    Browser `fetch` dropped during a cold prove (minutes), not necessarily a Compact failure. Check indexer before retrying; show elapsed timers so judges don’t think the UI hung.

11. **Old mUSDC `transfer` still overwrote balances**  
    Even after MoveNft was insert-only, mUSDC debit/credit `balances.insert` on existing keys kept causing dust panics / `SubmissionError` on settle and claim.

12. **Cached `append-entry` wallet**  
    Genesis wallet left open across requests → next `musdcTransfer` hit LevelDB contention / SubmissionError even when mUSDC Compact was already fixed.

13. **Claim failed after a successful mUSDC tx**  
    Claim used to throw when `appendEntry` failed; payout soft-failed. Align claim with payout: transfer is the primary receipt.

14. **Wipe LevelDB without redeploy**  
    Private state / signing keys gone while contracts remain on chain → reliable **117**. Partial mUSDC-only redeploy can leave signing keys mismatched; prefer **full** `midnight:deploy` when state may be dirty.

15. **LevelDB goes stale again after success**  
    Two transfers can succeed post-redeploy, then later claim-like transfers fail with 117 again. Treat wipe → fresh chain → full redeploy → verify → one UI action as the recovery loop, not a one-shot.

16. **Wrong Vite tree**  
    If `/tmp/zealy-recover` is missing, `cd` fails and `bun run dev` can start from `streetdancearc` on `:8080`. Always confirm cwd / SSR path before judging Midnight UX.

17. **`bun <<'EOF'` does not run scripts**  
    Use `bun scripts/foo.mjs` (or `bun run …`). Heredoc to `bun` prints help and exits.

18. **Docker project workdir can vanish**  
    `streetdancearc-main-*` containers may still run after the Downloads tree is gone. Recreate via `/tmp/zealy-recover/docker-compose.yml` (same image pins). If the daemon is stopped, start Docker Desktop before redeploy.

19. **Parallel A2H clicks**  
    Shared genesis LevelDB → “Database failed to open” / contention. Enforce one settle/claim/approve/renew at a time in UX **and** ops.

---

## How we would do it differently

1. **Design Compact for Undeployed dust limits first**  
   Assume insert-only / append-only public maps for **all** demo contracts (MoveNft **and** mUSDC, MandateVault, etc.) before the first Undeployed demo. Defer lookup-heavy ownership / balance maps to a server mirror or a later shielded design.

2. **Never cache `MidnightWalletProvider` across requests**  
   Always `stop()` in `finally` (`withMusdc` / `withMoveNft` / `appendEntry`). One open genesis wallet per process is enough to break the next family of calls.

3. **Soft-fail secondary registry appends**  
   Treat mUSDC (or primary Compact write) as the receipt; MoveRegistry append is best-effort for A2H claim/payout demos.

4. **RpcError 117 recovery checklist**  
   Stop Vite → wipe `midnight-level-db` → recreate node/indexer/proof (`docker compose -f /tmp/zealy-recover/docker-compose.yml up -d`) for a fresh chain when needed → `bun run midnight:deploy` → verify **two** transfers with `scripts/debug-musdc-transfer.mjs` → start Vite → **one** UI action only → hard-refresh.

5. **Prefer full redeploy over musdc-only** when private state may be dirty.

6. **Hard-refresh UI after deploy JSON changes**  
   SSR + client both need the new addresses; HMR is not enough.

7. **Push Midnight only to `zealymidnight`**  
   Never force-push Lovable/`streetdancearc`. Keep README, Compact, artefacts, and this note in sync.

8. **Instrument transfer vs append separately** when debugging `SubmissionError` on claim (otherwise a successful transfer looks like a failed claim).

9. **Consult this file + midnight-local-dev / midskills before long dust-wallet rabbit holes.**

10. **One exclusive “stack owner” process for e2e**  
    Single script: compile → artefacts → wipe LevelDB → deploy → mint/list/buy. No parallel agents on the same Docker stack.

11. **Keep deploy address resolution in one helper**  
    Undeployed JSON first, then env.

12. **Separate “wallet session” from “HTTP request” in docs**  
    Undeployed demo = server genesis wallet; preview/preprod = Lace.

---

## Useful commands

```bash
bun run midnight:status
bun run midnight:compile && bun run midnight:artefacts
# Prefer project compose when streetdancearc Downloads tree is gone:
docker compose -p streetdancearc-main -f docker-compose.yml up -d
rm -rf midnight-level-db .midnight && bun run midnight:deploy
bun scripts/debug-musdc-transfer.mjs   # expect two OKs before UI demos
bun scripts/redeploy-musdc.mjs         # insert-only mUSDC only (prefer full deploy if dirty)
bun scripts/z-check.mjs                # mint → list → buy
bun run dev -- --port 8080 --host 127.0.0.1
```

---

## Outcome snapshot

| Item | Status |
|------|--------|
| MoveNft Compact + artefacts | Working (insert-only / `listSale` / `sales`) |
| Server mint/list/buy/cancel/transfer | Working |
| MintForm → append + mint | Working |
| Market UI on Undeployed | Working |
| E2E mint → list → buy + mUSDC | Verified (`E2E_OK`) |
| Insert-only MidnightUSDC | Shipped (`65870c4`); redeploy after wipe |
| A2H railBusy + elapsed timers | Shipped |
| Arc → Midnight UX scrub (shop/A2A/primer/judge) | Shipped |
| appendEntry fresh wallet + claim soft-fail | Shipped; debug ingest removed |
| Pinata clip pin (optional JWT) | Wired server-side |
| Arc ERC-721 market | Feature-gated / out of Undeployed path |
| RpcError 117 recovery | Stack healthy after wipe + compose recreate + full deploy; 2× transfer OK — retry **one** Claim after hard-refresh |

---

*Written for the Zealy Midnight submission and future Cursor agents touching this stack.*
