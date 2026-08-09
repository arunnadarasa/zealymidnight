# StreetRail

This project is built on the Midnight Network.

Streetwear commerce and private-by-default choreography rights on **Midnight Local Undeployed**. Humans and agents share the same catalog; settlement and move anchoring use Compact contracts, witnesses, and ZK commitments — not a public EVM rail.

## What it demonstrates

| Compact contract | Privacy model |
| --- | --- |
| `MoveRegistry` | `witness localSecretKey()` stays off-chain; public ledger stores only a `persistentHash` **author commitment** + disclosed CID/message |
| `MandateVault` | Buyer secret derives `ap2:buyer:v1` public key in-circuit; secret never enters the ledger |
| `OrderLedger` | Merchant signing-key fingerprint via `ucp:merchant:v1` witness |
| `MidnightUSDC` | Experimental mUSDC mimic; signer key is a witness (`musdc:signer:v1`); spent nonces + balances are public |

Undeployed writes use a genesis **server-append** path (Lace cannot sign on Undeployed). Reads go through the local indexer GraphQL API.

## Prerequisites

- Node.js ≥ 22
- [bun](https://bun.sh)
- Docker Desktop (or compatible Compose v2)
- [Compact toolchain](https://docs.midnight.network) (`compact` CLI)

## Quick start

```bash
bun install
bun run compile   # compact compile → copy artefacts → docker compose up → deploy
bun run dev
```

Open the app, connect Lace on **Undeployed** (optional — checkout works via server-append), then:

1. Log a move on `/moves` (proves `appendEntry`; first proof can take up to ~4 minutes cold)
2. Settle a cart on `/shop` via experimental mUSDC
3. Verify with a GraphQL POST to `http://localhost:8088/api/v4/graphql`

### Environment

Copy `.env.example` to `.env`. Deploy writes contract addresses into `.env` automatically.

```
VITE_NETWORK_ID=undeployed
VITE_INDEXER_URL=http://localhost:8088/api/v4/graphql
VITE_INDEXER_WS_URL=ws://localhost:8088/api/v4/graphql/ws
VITE_PROOF_SERVER_URL=http://localhost:6300
VITE_NODE_URL=http://localhost:9944
VITE_DEFAULT_CONTRACT=<from deploy>
```

### Docker pins

| Service | Image |
| --- | --- |
| Node | `midnightntwrk/midnight-node:0.22.5` |
| Indexer | `midnightntwrk/indexer-standalone:4.0.2` |
| Proof server | `midnightntwrk/proof-server:8.0.3` |

After `bun run midnight:down` then `midnight:up`, run `bun run midnight:deploy` again and restart Vite — chain state and LevelDB private state reset together.

## Scripts

| Script | Purpose |
| --- | --- |
| `bun run midnight:compile` | Compile all `.compact` sources |
| `bun run midnight:artefacts` | Copy keys/zkir/contract into `public/contract/` |
| `bun run midnight:up` / `down` | Start/stop local Undeployed stack |
| `bun run midnight:deploy` | Deploy with genesis seed `…0002` |
| `bun run compile` | Full compile → up → deploy pipeline |
| `bun run dev` | Vite / TanStack Start app |

## API surface (Undeployed writes)

| Route | Circuit |
| --- | --- |
| `POST /api/public/append-entry` | MoveRegistry `appendEntry` |
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

## Notes

- **mUSDC is experimental** — no peg, never deploy to Mainnet.
- Cloudflare production builds stub Midnight Node modules; local `vite dev` keeps real server-append (`midnightSsrStub` uses `apply: "build"`).
- Nested `@midnight-ntwrk/onchain-runtime-v3` is removed in `postinstall` to avoid `expected instance of StateValue` / `ChargedState` crashes.

## License

MIT (see `LICENSE` if present) / project source as published on GitHub.
