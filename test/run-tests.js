import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const testPort = Number(process.env.TEST_RPC_PORT ?? 18545);
const testRpcUrl = `http://127.0.0.1:${testPort}`;

let deployArtifact;
let ensureNode;
let getWallet;
let provider;

async function waitForRpc(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_blockNumber",
          params: [],
        }),
      });
      const payload = await response.json();
      if (payload.result) return;
    } catch {
      // Keep polling while the node starts.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Test Hardhat node did not start on ${url}`);
}

async function startTestNode() {
  const hardhatCli = path.join(projectRoot, "node_modules", "hardhat", "dist", "src", "cli.js");
  const child = spawn(
    process.execPath,
    [hardhatCli, "node", "--hostname", "127.0.0.1", "--port", String(testPort)],
    {
      cwd: projectRoot,
      stdio: ["ignore", "ignore", "pipe"],
    },
  );

  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitForRpc(testRpcUrl);
  return child;
}

async function loadCommon() {
  process.env.RPC_URL = testRpcUrl;
  const common = await import("../scripts/common.js");
  deployArtifact = common.deployArtifact;
  ensureNode = common.ensureNode;
  getWallet = common.getWallet;
  provider = common.provider;
}

async function expectReject(action, message) {
  let rejected = false;

  try {
    await action();
  } catch (error) {
    rejected = true;
    if (message !== undefined) {
      assert.match(
        error.shortMessage ?? error.message,
        message,
        `Expected error to match ${message}, got: ${error.message}`,
      );
    }
  }

  assert.equal(rejected, true, "Expected call to reject");
}

async function testSecureMarketplace() {
  const deployer = await getWallet("deployer");
  const user = await getWallet("user1");

  const market = await deployArtifact(
    "artifacts/contracts/SecureMarketplace.sol/SecureMarketplace.json",
    deployer,
  );
  const marketAddress = await market.getAddress();

  await (await market.connect(user).deposit({ value: ethers.parseEther("1") })).wait();
  assert.equal(await market.balances(user.address), ethers.parseEther("1"));
  assert.equal(await provider.getBalance(marketAddress), ethers.parseEther("1"));

  await (await market.connect(user).withdraw()).wait();
  assert.equal(await market.balances(user.address), 0n);
  assert.equal(await provider.getBalance(marketAddress), 0n);

  await (await market.togglePause()).wait();
  await expectReject(async () =>
    market.connect(user).deposit({ value: ethers.parseEther("1") }),
  );
}

async function testSecureMarketStopsAttacker() {
  const deployer = await getWallet("deployer");
  const victims = [await getWallet("user1"), await getWallet("user2"), await getWallet("user3")];
  const hacker = await getWallet("hacker");

  const market = await deployArtifact(
    "artifacts/contracts/SecureMarketplace.sol/SecureMarketplace.json",
    deployer,
  );
  const marketAddress = await market.getAddress();

  for (const victim of victims) {
    await (await market.connect(victim).deposit({ value: ethers.parseEther("2") })).wait();
  }

  const attacker = await deployArtifact(
    "artifacts/contracts/Vulnerable.sol/Attacker.json",
    hacker,
    [marketAddress],
  );
  const attackerAddress = await attacker.getAddress();

  await expectReject(
    async () => attacker.connect(hacker).attack({ value: ethers.parseEther("1") }),
    /reentrancy|reentrant|transfer|revert|missing revert data|call_exception/i,
  );

  assert.equal(await provider.getBalance(marketAddress), ethers.parseEther("6"));
  assert.equal(await provider.getBalance(attackerAddress), 0n);
}

async function testVulnerableMarketGetsDrained() {
  const deployer = await getWallet("deployer");
  const victims = [await getWallet("user1"), await getWallet("user2"), await getWallet("user3")];
  const hacker = await getWallet("hacker");

  const market = await deployArtifact(
    "artifacts/contracts/Vulnerable.sol/VulnerableMarket.json",
    deployer,
  );
  const marketAddress = await market.getAddress();

  for (const victim of victims) {
    await (await market.connect(victim).deposit({ value: ethers.parseEther("2") })).wait();
  }

  const attacker = await deployArtifact(
    "artifacts/contracts/Vulnerable.sol/Attacker.json",
    hacker,
    [marketAddress],
  );
  const attackerAddress = await attacker.getAddress();

  await (await attacker.connect(hacker).attack({ value: ethers.parseEther("1") })).wait();

  assert.equal(await provider.getBalance(marketAddress), 0n);
  assert.equal(await provider.getBalance(attackerAddress), ethers.parseEther("7"));
}

async function main() {
  const testNode = await startTestNode();
  await loadCommon();
  await ensureNode();

  const tests = [
    ["Secure marketplace supports deposit/withdraw and pause", testSecureMarketplace],
    ["Secure marketplace rejects reentrancy attack", testSecureMarketStopsAttacker],
    ["Vulnerable marketplace gets drained by attacker", testVulnerableMarketGetsDrained],
  ];

  let passed = 0;

  try {
    for (const [name, fn] of tests) {
      process.stdout.write(`- ${name} ... `);
      await fn();
      passed += 1;
      process.stdout.write("OK\n");
    }
  } finally {
    testNode.kill();
  }

  console.log(`\n${passed}/${tests.length} checks passed.`);
}

main().catch((error) => {
  console.error(`\nTest run failed: ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
