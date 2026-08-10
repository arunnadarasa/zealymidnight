# StreetRail

This project is built on the Midnight Network.

Streetwear commerce and private-by-default choreography rights on **Midnight Local Undeployed**. Humans and agents share the same catalog; settlement and move anchoring use Compact contracts, witnesses, and ZK commitments — not a public EVM rail.

**Move Rights NFTs** complete the rail: prove a move → mint a Compact NFT → list for mUSDC → buy. Ownership and listings use insert-only ledger maps designed for Undeployed dust-wallet limits.

## What it demonstrates

| Compact contract | Privacy model |
| --- | --- |
| `MoveRegistry` | `witness localSecretKey()` stays off-chain; public ledger stores only a `persistentHash` **author commitment** + disclosed CID/message |
| **`MoveNft`** | Owner label → `sha256("movenft:owner:v1:" + label)` witness; public maps are **insert-only** (mint/list insert; buy/transfer append to `sales` with a fresh id). Current owner mirrored in local JSON for the demo |
| `MandateVault` | Buyer secret derives `ap2:buyer:v1` public key in-circuit; secret never enters the ledger |
| `OrderLedger` | Merchant signing-key fingerprint via `ucp:merchant:v1` witness |
| `MidnightUSDC` | Experimental mUSDC mimic; signer key is a witness (`musdc:signer:v1`); spent nonces + balances are public |

Undeployed writes use a genesis **server-append** path (Lace cannot sign on Undeployed). Reads go through the local indexer GraphQL API.

### MoveNft circuits

| Circuit | Role |
| --- | --- |
| `mint` | Insert a new NFT key (CID / message / owner commitment) |
| `listSale` | Insert a listing (`list` is a Compact keyword — do not name the circuit `list`) |
| `buy` | Append a sale record; settle mUSDC off-circuit in the same server handler |
| `cancel` | Cancel an active listing |
| `transfer` | Append a transfer record with a new random id |

v1 does **not** do cross-contract Compact atomic buy: the API runs `musdcFaucet` / `musdcTransfer` then `MoveNft.buy` with the same genesis wallet (demo atomicity).

## Prerequisites

- Node.js ≥ 22
- [bun](https://bun.sh)
- Docker Desktop (or compatible Compose v2)
- [Compact toolchain](https://docs.midnight.network) (`compact` CLI)

## Quick start

```bash
bun install
bun run compile   # compact compile → copy artefacts → docker compose up → deploy
bun run dev       # http://localhost:8080/
```

Open the app (Lace on **Undeployed** is optional — writes go through server-append), then:

1. **Preview metadata** on `/moves` (optional: pin a move clip to IPFS via Pinata — see below)
2. **Prove & append** + **mint** MoveNft from the same form (`appendEntry` + `move-nft-mint`; first proof can take ~4 minutes cold)
3. **List / buy** on `/market` with experimental mUSDC
4. Verify with GraphQL at `http://localhost:8088/api/v4/graphql`

### End-to-end check

After a clean deploy (and Vite restart):

```bash
bun scripts/z-check.mjs    # mint → list → buy; prints E2E_OK
# or: bun scripts/e2e-move-nft.mjs
```

### Environment

Copy `.env.example` to `.env`. Deploy writes contract addresses into `.env` and `src/data/midnight-contract.undeployed.json`. Prefer the deploy JSON over stale `VITE_*` addresses after redeploy.

```
VITE_NETWORK_ID=undeployed
VITE_INDEXER_URL=http://localhost:8088/api/v4/graphql
VITE_INDEXER_WS_URL=ws://localhost:8088/api/v4/graphql/ws
VITE_PROOF_SERVER_URL=http://localhost:6300
VITE_NODE_URL=http://localhost:9944
VITE_DEFAULT_CONTRACT=<from deploy>
```

### Pinata / IPFS move clips

Clip upload is **chain-agnostic** (HTTP to Pinata) and already wired into the Midnight `/moves` form via `MetadataPreview` / `ClipPreview`. The CID is disclosed on MoveRegistry and stored as the MoveNft local `uri` — nothing Pinata-specific runs inside Compact.

Add to `.env` (**never** `VITE_PINATA_*` — that leaks the JWT to the browser / breaks Cloudflare Worker builds):

```
PINATA_JWT=...          # Pinata API key with pinFileToIPFS + pinJSONToIPFS
PINATA_GATEWAY=...      # optional dedicated gateway host
```

Then **restart** `bun run dev` so the server process reloads env. Confirm:

```bash
curl -s http://localhost:8080/api/public/pin
# → {"enabled":true,"gateway":"https://gateway.pinata.cloud/ipfs","maxBytes":26214400,...}
```

| With `PINATA_JWT` | Without |
| --- | --- |
| Step 1 shows **Move clip (optional evidence)** — MP4/MOV/WebM or image, max 25 MB | Clip field hidden |
| Pin clip → pin metadata JSON → confirmed CID resolves on the gateway | Local CIDv1 preview still works; paste/confirm CID manually |

Flow: stage clip in-browser (local UnixFS hash) → `POST /api/public/pin` → pin metadata JSON → confirm CID → Prove & append / mint.

### Docker pins

| Service | Image |
| --- | --- |
| Node | `midnightntwrk/midnight-node:0.22.5` |
| Indexer | `midnightntwrk/indexer-standalone:4.0.2` |
| Proof server | `midnightntwrk/proof-server:8.0.3` |

After `bun run midnight:down` then `midnight:up`, run `bun run midnight:deploy` again and **restart Vite** — chain state and LevelDB private state reset together.

### Redeploy checklist (after any Compact change)

```bash
bun run midnight:compile && bun run midnight:artefacts
rm -rf midnight-level-db .midnight
bun run midnight:deploy
# restart bun run dev, then:
bun scripts/z-check.mjs
```

Never mix new verifier keys with an old LevelDB or old on-chain state (RpcError **196**).

## Scripts

| Script | Purpose |
| --- | --- |
| `bun run midnight:compile` | Compile all `.compact` sources |
| `bun run midnight:artefacts` | Copy keys/zkir/contract into `public/contract/` |
| `bun run midnight:up` / `down` | Start/stop local Undeployed stack |
| `bun run midnight:deploy` | Deploy with genesis seed `…0002` (also resets move-nft local state) |
| `bun run compile` | Full compile → up → deploy pipeline |
| `bun run dev` | Vite / TanStack Start app |
| `bun scripts/z-check.mjs` | Exclusive e2e: mint → list → buy (`E2E_OK`) |
| `bun scripts/e2e-move-nft.mjs` | Thin wrapper around the MoveNft rail check |
| `bun scripts/verify-movenft-rail.mjs` | Rail / artefact sanity checks |
| `bun scripts/rail-check.mjs` | Broader Undeployed rail diagnostics |

## API surface (Undeployed writes)

| Route | Circuit / action |
| --- | --- |
| `POST /api/public/append-entry` | MoveRegistry `appendEntry` |
| `POST /api/public/move-nft-mint` | MoveNft `mint` |
| `POST /api/public/move-nft-list` | MoveNft `listSale` |
| `POST /api/public/move-nft-buy` | mUSDC pay + MoveNft `buy` |
| `POST /api/public/move-nft-cancel` | MoveNft `cancel` |
| `POST /api/public/move-nft-transfer` | MoveNft `transfer` |
| `GET` / `POST /api/public/pin` | Pinata status + clip/file pin (requires `PINATA_JWT`) |
| `POST /api/public/ap2-anchor` | MandateVault `anchorMandate` |
| `POST /api/public/ucp-record-order` | OrderLedger `recordOrder` |
| `POST /api/public/musdc-faucet` | MidnightUSDC `faucet` |
| `POST /api/public/musdc-transfer` | MidnightUSDC `transfer` |
| `POST /api/public/purchase` | x402 challenge + server settle |

## Verify an anchor

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

Indexer tx hashes and midnight-js `txId` strings differ — use the indexer as source of truth.

## Learnings (Undeployed MoveNft)

Full write-up: [`Cursor Input.md`](./Cursor%20Input.md).

### What worked

- **Insert-only Compact maps** — Undeployed dust-wallet fee balancing panics (`feesWithMargin` / `transaction_merge` Unreachable) when a circuit **updates an existing map key**. Mint/list insert; buy/transfer append to `sales` with a new random id; ownership for the demo lives in `src/data/move-nft-state.undeployed.json`.
- **Fresh wallet session per `callTx`** — `withMoveNft` / `withMusdc` open a genesis wallet, submit, then `stop()`, matching the mUSDC pattern.
- **Deploy JSON over env** — Vite caches `VITE_*` across redeploys; resolve addresses from `src/data/midnight-contract.undeployed.json` first.
- **Server-append only on Undeployed** — don’t half-wire Lace signing locally.
- **UI off the Arc pause path** — market/gallery/activity use Midnight + indexer when `VITE_NETWORK_ID=undeployed`.
- **Pinata stays server-only** — same clip UX as Arc; `PINATA_JWT` enables `/moves` upload without touching Compact. Restart Vite after adding the JWT; check `GET /api/public/pin` → `enabled: true`.

### Traps to avoid

| Symptom | Likely cause |
| --- | --- |
| `wasm.transaction_feesWithMargin` / `transaction_merge` Unreachable | Map key overwrite in Compact, or reused wallet after a bad state |
| RpcError **117** / **104** | Stale or dirty LevelDB vs chain (wipe + redeploy) |
| RpcError **196** | Verifier key mismatch (recompile artefacts without redeploy) |
| “not owner” while local ledger looks fine | Owner PK must be `sha256("movenft:owner:v1:" + label)`, not raw `sha256(label)` |
| Mint to a dead contract | Stale Vite env — restart after deploy |
| Clip upload field missing | `PINATA_JWT` unset, mistyped as `VITE_PINATA_*`, or Vite not restarted after `.env` change |
| Flaky e2e / truncated logs | Parallel agents `pkill`ing shared processes, or piping proves through `awk`/`head` (SIGPIPE) |

### Do differently next time

1. Design Compact for Undeployed dust limits first (insert/append-only public maps).
2. One exclusive stack-owner script for e2e; no parallel agents on the same Docker stack.
3. After Compact changes: compile → artefacts → wipe LevelDB → deploy → restart Vite → `z-check`.
4. Keep Zealy (`zealymidnight`) README + artefacts in sync with every green e2e — not a final dump.

## Notes

- **mUSDC is experimental** — no peg, never deploy to Mainnet.
- Cloudflare production builds stub Midnight Node modules; local `vite dev` keeps real server-append (`midnightSsrStub` uses `apply: "build"`).
- Nested `@midnight-ntwrk/onchain-runtime-v3` is removed in `postinstall` to avoid `expected instance of StateValue` / `ChargedState` crashes.
- Arc ERC-721 market code may remain in the tree but is **feature-gated / out of the Undeployed path**.

## License

MIT (see `LICENSE` if present) / project source as published on GitHub.
