import { ethers } from "ethers";
import { deployArtifact, getWallet, provider } from "./common.js";

async function main() {
  const victims = [await getWallet("user1"), await getWallet("user2"), await getWallet("user3")];
  const hacker = await getWallet("hacker");

  const market = await deployArtifact(
    "artifacts/contracts/Vulnerable.sol/VulnerableMarket.json",
    await getWallet("deployer"),
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
  const balance = await provider.getBalance(marketAddress);

  console.log("Reentrancy lab deployed");
  console.log(`TARGET_MARKET=${marketAddress}`);
  console.log(`ATTACKER_CONTRACT=${attackerAddress}`);
  console.log(`TARGET_BALANCE=${ethers.formatEther(balance)} ETH`);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
