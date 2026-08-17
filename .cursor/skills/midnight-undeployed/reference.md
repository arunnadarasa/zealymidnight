# Midnight Undeployed — reference

Read from [SKILL.md](SKILL.md) first. This file is Compact snippets, RpcError actions, and the wallet session pattern.

## Wallet session (every write)

```ts
import WebSocket from "ws";
(globalThis as any).WebSocket = WebSocket;

import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { MidnightWalletProvider } from "@midnight-ntwrk/wallet-sdk";

setNetworkId("undeployed"); // string, not a runtime enum

const wallet = await MidnightWalletProvider.create({
  networkId: "undeployed",
  seedHex: GENESIS_SEED, // …0002 from midnight-shared.ts
  indexerUrl: process.env.VITE_INDEXER_URL!,
  indexerWsUrl: process.env.VITE_INDEXER_WS_URL!,
  proofServerUrl: process.env.VITE_PROOF_SERVER_URL!,
  nodeUrl: "ws://localhost:9944",
});
await wallet.start(true);
try {
  // CompiledContract + callTx …
} finally {
  await wallet.stop();
}
```

Do **not** keep a module-level `ctxPromise` / cached provider. This repo’s pattern: `withMusdc`, `withMoveNft`, `append-entry.server.ts`.

Writes:

```text
Undeployed:  UI → POST /api/public/<verb> → genesis wallet (server) → chain
Preview/Preprod:  UI → Lace publishKit → chain
Reads (all nets):  indexer GraphQL, no wallet
```

## Compact: insert-only maps

**Wrong** (Undeployed dust / `transaction_merge` Unreachable):

```
balances.insert(from, balances.lookup(from) - amount); // overwrite existing key
```

**Right** (this repo):

```
owners: Map          // insert on mint only
listed_price: Map    // insert on listSale / cancel-with-new-key
sales: Map           // append buy/transfer with a fresh random id
credits / credit_to  // insert by nonce (transfer) or once by pk (faucet)
faucet_claimed       // Set
spent_nonces         // Set
```

Owner PK for MoveNft demo UX = `sha256("movenft:owner:v1:" + label)` — **not** raw `sha256(label)`. Off-chain owner file: `src/data/move-nft-state.undeployed.json` (reset on deploy). Per-token owner stays off-chain because `owners.lookup` / overwrite is dust-unsafe.

## Compact: bind the witness

**Wrong** (Aliit reject — any non-empty secret works):

```
const auth = disclose(persistentHash<Bytes<32>>(pad(32, "movenft:minter:v1"), localSecretKey()));
assert(auth != pad(32, ""), "unauthorized");
```

Same failure as `assert(fromPk != pad(32, ""))` on mUSDC transfer.

**Right — stored pk bootstrap (MoveNft / OrderLedger):**

```
const pk = disclose(persistentHash<Bytes<32>>(pad(32, "movenft:minter:v1"), localSecretKey()));
if (minter_pk == pad(32, "")) {
  minter_pk = pk;           // first call discloses
} else {
  assert(pk == minter_pk, "minter");
}
```

`recordOrder` **must read** `merchantSecret()` and `assert(pk == signing_key_fpr)` after the fingerprint is set. An unused witness on the order path fails review even if `recordSigningKey` is correct.

**Right — membership (MidnightUSDC transfer):**

```
assert(faucet_claimed.member(disclose(fromPk)), "signer");
```

Stay insert-only: do **not** overwrite `balances[from]` / `balances[to]`. MandateVault `assert(pk == buyer)` is the reference circuit.

## RpcError / UX

`SubmissionError` / `FiberFailure` often wrap `RpcError 1010: Invalid Transaction: Custom error: 117`.

| Code | Meaning | Agent action |
| --- | --- | --- |
| 117 | Private state / seed / store mismatch | Recovery checklist in SKILL.md — do not keep retrying the same UI click |
| 104 | Dust / wallet state | Wipe LevelDB + full deploy |
| 196 | Verifier / artefact mismatch | compile → artefacts → wipe → deploy |
| Pending on `/judge` | Indexer miss or pre-wipe hash in `localStorage` | Refresh; Clear if the chain was wiped |

Humanize 117 in A2H copy (`a2h-engine.server.ts`). Skip Circle ERC-1271 on Undeployed / missing `CIRCLE_API_KEY` — never show `missing_secret: CIRCLE_API_KEY`.

Cold prove can take ~4 minutes. Show elapsed (`useElapsed`); “Failed to fetch” on Approve is often a browser timeout, not a dead chain — check indexer first.

## Public Vite (Aliit clone bar)

Do **not** use `@lovable.dev/vite-tanstack-config`. `vite.config.ts` should import public plugins:

- `@tanstack/react-start/plugin/vite` → `tanstackStart()`
- `@vitejs/plugin-react`
- `@tailwindcss/vite`
- `nitro/vite`
- `vite-plugin-wasm` + `vite-plugin-top-level-await`

If `bun.lock` contains `europe-west*-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache`, delete the lockfile and regenerate **outside** Lovable.

Do not register `attachSupabaseAuth` in `src/start.ts`. Guard `src/integrations/supabase/client.ts` so missing `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` does not throw. Leave those keys out of `.env.example`.

`musdcTransfer` needs `toHex` (sha256 of the treasury label), not only `amountAtomic`.

## Key files (this repo)

| Concern | Path |
| --- | --- |
| Compact sources | `contracts/*.compact` |
| Shared seed / state ids | `src/lib/midnight-shared.ts` |
| Deploy addresses | `src/data/midnight-contract.undeployed.json` |
| Contract UI cards | `src/lib/contracts.ts` |
| mUSDC / MoveNft / append / A2H | `src/lib/*.server.ts` |
| SSR stubs | `vite.config.ts` `midnightSsrStub` |
| Judge page | `src/routes/judge.tsx` |
| Optional Supabase | `src/start.ts`, `src/integrations/supabase/client.ts` |
