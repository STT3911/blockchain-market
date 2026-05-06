var CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

var provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
var privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
var wallet = new ethers.Wallet(privateKey, provider);

var abi = [
    "function deposit() public payable",
    "function withdraw() public",
    "function balances(address) public view returns (uint256)",
    "function paused() public view returns (bool)",
    "function admin() public view returns (address)",
    "function getMarketplaceBalance() public view returns (uint256)"
];
var contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

function sleep(ms) {
    return new Promise(function(resolve) { return setTimeout(resolve, ms); });
}

function getTimestamp() {
    var now = new Date();
    return [
        now.getHours().toString().padStart(2, "0"),
        now.getMinutes().toString().padStart(2, "0"),
        now.getSeconds().toString().padStart(2, "0")
    ].join(":");
}

function addLog(message, type) {
    var logsDiv = document.getElementById("logs");
    var colorClass = "text-[#cbd5e1]";

    if (type === "success") colorClass = "text-[#86efac]";
    else if (type === "warning") colorClass = "text-[#facc15]";
    else if (type === "error") colorClass = "text-[#fca5a5]";
    else if (type === "system") colorClass = "text-[#93c5fd]";
    else if (type === "muted") colorClass = "text-[#64748b]";

    logsDiv.innerHTML += '<p class="' + colorClass + '">[' + getTimestamp() + "] " + message + "</p>";
    logsDiv.scrollTop = logsDiv.scrollHeight;
}

async function updateUI() {
    document.getElementById("walletAddress").innerText =
        wallet.address.substring(0, 8) + "..." + wallet.address.slice(-4);

    try {
        var userBalance = await contract.balances(wallet.address);
        document.getElementById("marketBalance").innerText =
            parseFloat(ethers.formatEther(userBalance)).toFixed(4);
    } catch (e) {
        addLog("Не удалось прочитать контракт. Проверьте npx hardhat node и адрес в app.js.", "error");
    }
}

async function deposit() {
    try {
        addLog("--------------------------------------------------", "muted");
        addLog("Формируем вызов deposit() на 1 ETH.", "system");
        await sleep(250);

        var txResponse = await contract.deposit({ value: ethers.parseEther("1") });
        addLog("Транзакция отправлена: " + txResponse.hash.substring(0, 26) + "...", "warning");

        var receipt = await txResponse.wait();
        addLog("Депозит записан в блок #" + receipt.blockNumber + ".", "success");
        await updateUI();
    } catch (error) {
        var errorMsg = error.shortMessage || error.message || "Неизвестная ошибка";
        addLog("Операция deposit() отклонена: " + errorMsg, "error");
        console.error(error);
    }
}

async function withdraw() {
    try {
        addLog("--------------------------------------------------", "muted");
        addLog("Запускаем withdraw(): проверка баланса, блокировка reentrancy, затем перевод.", "system");
        await sleep(250);

        var txResponse = await contract.withdraw();
        addLog("Транзакция отправлена: " + txResponse.hash.substring(0, 26) + "...", "warning");

        var receipt = await txResponse.wait();
        addLog("Средства возвращены кошельку в блоке #" + receipt.blockNumber + ".", "success");
        await updateUI();
    } catch (error) {
        var errorMsg = error.shortMessage || error.message || "Неизвестная ошибка";
        addLog("Операция withdraw() отклонена: " + errorMsg, "error");
        console.error(error);
    }
}

provider.on("block", async function(blockNumber) {
    addLog("Новый блок #" + blockNumber + " в локальной сети.", "system");
});

updateUI();
