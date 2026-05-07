import { deployArtifact, getWallet } from "./common.js";

async function main() {
  const deployer = await getWallet("deployer");
  const marketplace = await deployArtifact(
    "artifacts/contracts/SecureMarketplace.sol/SecureMarketplace.json",
    deployer,
  );
  const address = await marketplace.getAddress();

  console.log("SecureMarketplace deployed");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
