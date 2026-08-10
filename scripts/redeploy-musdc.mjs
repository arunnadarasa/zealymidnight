#!/usr/bin/env bun
/** Redeploy insert-only MidnightUSDC and patch deploy JSON addresses. */
import fs from "node:fs";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import {
  buildCompiledContract,
  buildUndeployedProviders,
  initialPrivateStateFor,
} from "../src/lib/midnight-providers.server.ts";
import { CONTRACTS, PRIVATE_STATE_ID, deployerSecretBytes } from "../src/lib/midnight-shared.ts";

const key = "midnightUsdc";
const meta = CONTRACTS[key];
const secret = deployerSecretBytes();
console.log(`→ Deploying ${meta.name}…`);
const compiledContract = await buildCompiledContract({
  contractName: meta.name,
  secretForDeploy: secret,
});
const { providers, midnightWallet } = await buildUndeployedProviders({
  contractName: meta.name,
});
let result;
for (let i = 0; i < 8; i++) {
  try {
    result = await deployContract(providers, {
      compiledContract,
      privateStateId: `${PRIVATE_STATE_ID}-${meta.name}`,
      initialPrivateState: initialPrivateStateFor(meta.name, secret),
    });
    break;
  } catch (e) {
    if (i === 7) throw e;
    console.warn(`  attempt ${i + 1} failed: ${e.message}. retry 10s`);
    await new Promise((r) => setTimeout(r, 10000));
  }
}
const address = result.deployTxData.public.contractAddress;
const deployTx = result.deployTxData.public.txHash ?? result.deployTxData.public.txId;
console.log(`✓ ${meta.name} @ ${address}`);
await midnightWallet.stop().catch(() => {});

for (const p of [
  "src/data/midnight-contract.undeployed.json",
  "src/data/midnight-contract.json",
]) {
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.deployedAt = new Date().toISOString();
  j.contracts = j.contracts || {};
  j.contracts.midnightUsdc = {
    name: meta.name,
    address,
    deployTx,
    privateStateId: `${PRIVATE_STATE_ID}-${meta.name}`,
  };
  fs.writeFileSync(p, JSON.stringify(j, null, 2));
  console.log(`wrote ${p}`);
}
