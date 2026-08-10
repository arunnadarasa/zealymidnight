#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { musdcTransfer } from "../src/lib/musdc.server.ts";

const toHex = createHash("sha256").update(`streetrail:debug:${Date.now()}`).digest("hex");
console.log("toHex", toHex.slice(0, 16));
try {
  const r = await musdcTransfer({ toHex, amountAtomic: "1000" });
  console.log("OK", String(r.midnightTxHash).slice(0, 24), String(r.contractAddress).slice(0, 16));
} catch (e) {
  const err = e instanceof Error ? e : new Error(String(e));
  console.log("FAIL_MSG", err.message.slice(0, 800));
  console.log("FAIL_STACK", (err.stack || "").slice(0, 2500));
  if (err.cause) console.log("FAIL_CAUSE", String(err.cause).slice(0, 1200));
  try {
    console.log("FAIL_JSON", JSON.stringify(err, Object.getOwnPropertyNames(err)).slice(0, 2500));
  } catch {}
}
