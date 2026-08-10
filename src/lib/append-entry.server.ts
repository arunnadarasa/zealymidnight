import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { PRIVATE_STATE_ID, PRIMARY_CONTRACT, deployerSecretBytes } from "./midnight-shared";
import {
  buildCompiledContract,
  buildUndeployedProviders,
  initialPrivateStateFor,
} from "./midnight-providers.server";

const STATE_ID = `${PRIVATE_STATE_ID}-${PRIMARY_CONTRACT}`;

export type AppendInput = {
  contractAddress: string;
  appTag: string;
  message: string;
  payload?: unknown;
};

/**
 * Fresh genesis wallet per call — a long-lived cache held LevelDB open and
 * caused the next mUSDC/MoveNft submit to fail with SubmissionError / FiberFailure.
 */
export async function appendEntry(input: AppendInput): Promise<{
  txId: string;
  blockHeight?: number;
  simulated?: boolean;
}> {
  const secret = deployerSecretBytes();
  const { providers, midnightWallet } = await buildUndeployedProviders({
    contractName: PRIMARY_CONTRACT,
  });
  try {
    await providers.privateStateProvider.setContractAddress(input.contractAddress);
    const compiledContract = await buildCompiledContract({
      contractName: PRIMARY_CONTRACT,
    });

    let found;
    try {
      found = await findDeployedContract(providers, {
        compiledContract,
        contractAddress: input.contractAddress,
        privateStateId: STATE_ID,
        initialPrivateState: initialPrivateStateFor(PRIMARY_CONTRACT, secret),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/private state|IncompleteFind|not found|missing/i.test(msg)) throw e;
      found = await findDeployedContract(providers, {
        compiledContract: await buildCompiledContract({
          contractName: PRIMARY_CONTRACT,
          secretForDeploy: secret,
        }),
        contractAddress: input.contractAddress,
        privateStateId: STATE_ID,
        initialPrivateState: initialPrivateStateFor(PRIMARY_CONTRACT, secret),
      });
    }

    const result = await found.callTx.appendEntry(input.message);
    const publicData = result.public as {
      txId?: string;
      txHash?: string;
      blockHeight?: number;
    };
    const txId = publicData.txId ?? publicData.txHash;
    if (!txId) {
      throw new Error("appendEntry succeeded but no txId/txHash in public result");
    }
    return { txId, blockHeight: publicData.blockHeight };
  } finally {
    try {
      await midnightWallet.stop();
    } catch {
      /* ignore */
    }
  }
}
