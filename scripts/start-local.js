import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import {
  deployArtifact,
  getWallet,
  isNodeReady,
  projectRoot,
  resetNode,
} from "./common.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localDir = path.join(projectRoot, ".local");
const configPath = path.join(projectRoot, "local-config.js");

const REQUIRED_ARTIFACTS = [
  "artifacts/contracts/SecureMarketplace.sol/SecureMarketplace.json",
  "artifacts/contracts/Vulnerable.sol/VulnerableMarket.json",
  "artifacts/contracts/Vulnerable.sol/Attacker.json",
];

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function ensureArtifacts() {
  const missing = REQUIRED_ARTIFACTS.filter((relativePath) => {
    return !existsSync(path.join(projectRoot, relativePath));
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing contract artifacts. Run \`npm run compile\` first.\n${missing.join("\n")}`,
    );
  }
}

async function waitForHardhatNode(timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isNodeReady()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Hardhat node did not become ready in time.");
}

async function startHardhatNode() {
  if (await isNodeReady()) {
    console.log("Using existing Hardhat node at http://127.0.0.1:8545");
    return null;
  }

  const hardhatCli = path.join(projectRoot, "node_modules", "hardhat", "dist", "src", "cli.js");
  const child = spawn(process.execPath, [hardhatCli, "node", "--hostname", "127.0.0.1", "--port", "8545"], {
    cwd: projectRoot,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    if (/Started|JSON-RPC|Account #0/i.test(text)) {
      process.stdout.write(text);
    }
  });
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`Hardhat node exited with code ${code}`);
    }
  });

  await waitForHardhatNode();
  return child;
}

async function deployDemoState() {
  await resetNode();

  const deployer = await getWallet("deployer");
  const victims = [await getWallet("user1"), await getWallet("user2"), await getWallet("user3")];
  const hacker = await getWallet("hacker");

  const secure = await deployArtifact(
    "artifacts/contracts/SecureMarketplace.sol/SecureMarketplace.json",
    deployer,
  );
  const secureMarketplace = await secure.getAddress();

  const target = await deployArtifact(
    "artifacts/contracts/Vulnerable.sol/VulnerableMarket.json",
    deployer,
  );
  const targetMarket = await target.getAddress();

  for (const victim of victims) {
    await (await target.connect(victim).deposit({ value: ethers.parseEther("2") })).wait();
  }

  const attacker = await deployArtifact(
    "artifacts/contracts/Vulnerable.sol/Attacker.json",
    hacker,
    [targetMarket],
  );
  const attackerContract = await attacker.getAddress();

  const config = {
    rpcUrl: "http://127.0.0.1:8545",
    secureMarketplace,
    targetMarket,
    attackerContract,
  };

  writeFileSync(
    configPath,
    `window.DEMO_CONFIG = ${JSON.stringify(config, null, 2)};\n`,
    "utf8",
  );

  return config;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findPort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortFree(port)) {
      return port;
    }
  }
  throw new Error("No free local web port found.");
}

function serveStatic(port) {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const pathname = requestUrl.pathname === "/" ? "/index.html" : decodeURIComponent(requestUrl.pathname);
    const normalizedPath = path.normalize(path.join(projectRoot, pathname));

    if (!normalizedPath.startsWith(projectRoot)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    if (!existsSync(normalizedPath) || !statSync(normalizedPath).isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const extension = path.extname(normalizedPath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });

    const stream = createReadStream(normalizedPath);
    stream.on("error", () => response.end("Not found"));
    stream.pipe(response);
  });

  server.listen(port, "127.0.0.1");
  return server;
}

async function main() {
  ensureArtifacts();
  await mkdir(localDir, { recursive: true });

  const hardhat = await startHardhatNode();
  const config = await deployDemoState();
  const port = await findPort(Number(process.env.PORT ?? 3000));
  const server = serveStatic(port);

  writeFileSync(
    path.join(localDir, "runtime.json"),
    JSON.stringify({ webPort: port, hardhatPid: hardhat?.pid ?? null }, null, 2),
    "utf8",
  );

  console.log("");
  console.log("Local demo is ready:");
  console.log(`  Secure marketplace: http://127.0.0.1:${port}/index.html`);
  console.log(`  Reentrancy lab:     http://127.0.0.1:${port}/hacker.html`);
  console.log("");
  console.log(`SecureMarketplace=${config.secureMarketplace}`);
  console.log(`TARGET_MARKET=${config.targetMarket}`);
  console.log(`ATTACKER_CONTRACT=${config.attackerContract}`);
  console.log("");
  console.log("Keep this process running while using the demo. Press Ctrl+C to stop.");

  const shutdown = () => {
    server.close();
    if (hardhat) {
      hardhat.kill();
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
