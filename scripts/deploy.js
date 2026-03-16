const { ethers } = require("hardhat");

async function main() {
    console.log("Запуск ЗАЩИЩЕННОЙ торговой площадки...");
    const Marketplace = await ethers.getContractFactory("SecureMarketplace");
    const marketplace = await Marketplace.deploy();
    await marketplace.waitForDeployment();
    
    const address = await marketplace.getAddress();
    console.log(`✅ Защищенная площадка успешно развернута!`);
    console.log(`Адрес контракта: ${address}`);
    console.log(`\nВСТАВЬ ЭТОТ АДРЕС В ФАЙЛ app.js!`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});