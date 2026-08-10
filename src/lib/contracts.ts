import { INDEXER_URL } from "@/lib/tokens";
import midnight from "@/data/midnight-contract.json";

export type DeployedContract = {
  key: string;
  name: string;
  blurb: string;
  address: string;
  standards: string[];
  verified: boolean;
  explorerUrl: string;
};

type DeployFile = {
  address?: string;
  contracts?: Record<string, { name?: string; address?: string }>;
};

const deploy = midnight as DeployFile;

function entry(
  key: string,
  name: string,
  blurb: string,
  address: string,
  standards: string[],
): DeployedContract {
  return {
    key,
    name,
    blurb,
    address: address || "not-deployed",
    standards,
    verified: !!address && !/^0+$/.test(address.replace(/^0x/, "")),
    explorerUrl: `${INDEXER_URL}#contract=${encodeURIComponent(address || "")}`,
  };
}

/** StreetRail Compact contracts on Midnight Local Undeployed. */
export const CONTRACTS: DeployedContract[] = [
  entry(
    "registry",
    "MoveRegistry",
    "Compact move / choreography registry — appendEntry discloses CID + author commitment.",
    deploy.contracts?.moveRegistry?.address || deploy.address || "",
    ["Compact", "appendEntry"],
  ),
  entry(
    "moveNft",
    "MoveNft",
    "Compact Move Rights NFTs — mint / listSale / buy with insert-only maps + mUSDC settle.",
    deploy.contracts?.moveNft?.address || "",
    ["Compact", "mint", "listSale", "buy"],
  ),
  entry(
    "mandate",
    "MandateVault",
    "AP2 CartMandate anchors with buyer public-key check (ap2:buyer:v1).",
    deploy.contracts?.mandateVault?.address || "",
    ["AP2", "anchorMandate"],
  ),
  entry(
    "orders",
    "OrderLedger",
    "UCP order recorder + merchant signing-key fingerprint.",
    deploy.contracts?.orderLedger?.address || "",
    ["UCP", "recordOrder"],
  ),
  entry(
    "musdc",
    "MidnightUSDC",
    "Experimental mUSDC mimic (faucet + transfer + spent nonces). No peg — never Mainnet.",
    deploy.contracts?.midnightUsdc?.address || "",
    ["mUSDC", "x402"],
  ),
];

/** Midnight Undeployed network caption (alias kept for Arc-era imports). */
export const NETWORK_CAPTION =
  "Midnight Local Undeployed · Compact + indexer GraphQL · Lace optional";

/** @deprecated Use NETWORK_CAPTION */
export const ARC_CHAIN_CAPTION = NETWORK_CAPTION;

export function shortAddress(address: string) {
  const a = address.trim();
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
