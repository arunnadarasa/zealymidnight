#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { musdcTransfer } from "../src/lib/musdc.server.ts";

const lace = process.argv[2] || "mn_addr_undeployed1test";
const toHex = createHash("sha256").update(`streetrail:a2h-claim:${lace}`).digest("hex");
const amount = process.argv[3] || "33270";
console.log({ lace: lace.slice(0, 24), toHex: toHex.slice(0, 16), amount });
try {
  const r = await musdcTransfer({ toHex, amountAtomic: amount });
  console.log("OK", r.midnightTxHash.slice(0, 24), r.contractAddress.slice(0, 16));
} catch (e) {
  const m = e instanceof Error ? e.message : String(e);
  console.log("FAIL", m.slice(0, 400));
  console.log("HAS_117", /Custom error:\s*117|\b117\b/.test(m));
}
