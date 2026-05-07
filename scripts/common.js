import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const projectRoot = path.resolve(__dirname, "..");

export const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
export const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { cacheTimeout: 0 });

export const SIGNER_INDEX = {
  deployer: 0,
  user1: 1,
  user2: 2,
  user3: 3,
  hacker: 5,
};

export async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function isNodeReady() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      }),
      signal: controller.signal,
    });
    const payload = await response.json();
    return Boolean(payload.result);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function ensureNode() {
  if (await isNodeReady()) {
    return;
  }

  throw new Error(
    "Cannot connect to the local Hardhat node at http://127.0.0.1:8545. Run `npm start` or `npm run node` first.",
  );
}

export async function getWallet(name) {
  const signerIndex = SIGNER_INDEX[name];

  if (signerIndex === undefined) {
    throw new Error(`Unknown signer requested: ${name}`);
  }

  await ensureNode();
  return provider.getSigner(signerIndex);
}

export async function resetNode() {
  await ensureNode();

  try {
    await provider.send("hardhat_reset", []);
  } catch (error) {
    // Hardhat 3's standalone node doesn't expose this method. The demos deploy
    // fresh contracts each run, so a reset is only a convenience.
  }
}

export async function loadArtifact(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);
  const raw = await readFile(fullPath, "utf8");
  return JSON.parse(raw);
}

export async function deployArtifact(relativePath, signer, constructorArgs = []) {
  const artifact = await loadArtifact(relativePath);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(...constructorArgs);
  await contract.waitForDeployment();
  return contract;
}

export function formatEth(value) {
  return `${ethers.formatEther(value)} ETH`;
}
