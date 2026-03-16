const { ethers } = require("hardhat");

async function main() {
    console.log("🛠️ Подготовка стенда для взлома...\n");
    const signers = await ethers.getSigners();
    const victims = signers.slice(1, 4);
    const hacker = signers[5]; 

    const Market = await ethers.getContractFactory("VulnerableMarket");
    const market = await Market.deploy();
    await market.waitForDeployment();
    const marketAddress = await market.getAddress();
    
    for (let victim of victims) {
        await market.connect(victim).deposit({ value: ethers.parseEther("2") });
    }
    console.log(`💰 На площадке собрано: 6.0 ETH (Деньги жертв)`);

    const Attacker = await ethers.getContractFactory("contracts/Vulnerable.sol:Attacker");
    const attacker = await Attacker.connect(hacker).deploy(marketAddress);
    await attacker.waitForDeployment();
    const attackerAddress = await attacker.getAddress();

    console.log(`\n✅ СТЕНД ГОТОВ! ВСТАВЬ ЭТИ АДРЕСА В hacker.html:`);
    console.log(`TARGET_MARKET = "${marketAddress}"`);
    console.log(`ATTACKER_CONTRACT = "${attackerAddress}"`);
}

main().catch(console.error);