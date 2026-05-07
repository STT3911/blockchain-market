const config = window.DEMO_CONFIG ?? {};
const CONTRACT_ADDRESS = config.secureMarketplace ?? "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const RPC_URL = config.rpcUrl ?? "http://127.0.0.1:8545";

const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { cacheTimeout: 0 });
const privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const wallet = new ethers.Wallet(privateKey, provider);

const abi = [
    "function deposit() public payable",
    "function withdraw() public",
    "function balances(address) public view returns (uint256)",
    "function getMarketplaceBalance() public view returns (uint256)"
];
const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

const logsDiv = document.getElementById("logs");
const walletAddress = document.getElementById("walletAddress");
const marketBalance = document.getElementById("marketBalance");
const nodeStatus = document.getElementById("nodeStatus");
const depositBtn = document.getElementById("depositBtn");
const withdrawBtn = document.getElementById("withdrawBtn");

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTimestamp() {
    return new Date().toLocaleTimeString("ru-RU", { hour12: false });
}

function addLog(message, type = "system") {
    const line = document.createElement("p");
    line.className = `log-line log-${type}`;
    line.textContent = `[${getTimestamp()}] ${message}`;
    logsDiv.appendChild(line);
    logsDiv.scrollTop = logsDiv.scrollHeight;
}

function setBusy(isBusy) {
    depositBtn.disabled = isBusy;
    withdrawBtn.disabled = isBusy;
}

async function updateUI() {
    walletAddress.textContent = `${wallet.address.slice(0, 8)}...${wallet.address.slice(-4)}`;

    try {
        await provider.getBlockNumber();
        nodeStatus.textContent = "online";

        const userBalance = await contract.balances(wallet.address);
        marketBalance.textContent = Number(ethers.formatEther(userBalance)).toFixed(4);
    } catch (error) {
        nodeStatus.textContent = "offline";
        addLog("Не удалось прочитать контракт. Запусти npm start и обнови страницу.", "error");
        console.error(error);
    }
}

async function deposit() {
    setBusy(true);

    try {
        addLog("--------------------------------------------------", "muted");
        addLog("Отправляем deposit() на 1 ETH.", "system");
        await sleep(150);

        const txResponse = await contract.deposit({ value: ethers.parseEther("1") });
        addLog(`Транзакция отправлена: ${txResponse.hash.slice(0, 26)}...`, "warning");

        const receipt = await txResponse.wait();
        addLog(`Депозит записан в блок #${receipt.blockNumber}.`, "success");
        await updateUI();
    } catch (error) {
        addLog(`deposit() отклонен: ${error.shortMessage || error.message}`, "error");
        console.error(error);
    } finally {
        setBusy(false);
    }
}

async function withdraw() {
    setBusy(true);

    try {
        addLog("--------------------------------------------------", "muted");
        addLog("Запускаем withdraw(): баланс обнуляется до перевода ETH.", "system");
        await sleep(150);

        const txResponse = await contract.withdraw();
        addLog(`Транзакция отправлена: ${txResponse.hash.slice(0, 26)}...`, "warning");

        const receipt = await txResponse.wait();
        addLog(`Средства возвращены кошельку в блоке #${receipt.blockNumber}.`, "success");
        await updateUI();
    } catch (error) {
        addLog(`withdraw() отклонен: ${error.shortMessage || error.message}`, "error");
        console.error(error);
    } finally {
        setBusy(false);
    }
}

depositBtn.addEventListener("click", deposit);
withdrawBtn.addEventListener("click", withdraw);

addLog("Интерфейс подключается к локальной сети Hardhat.", "system");
addLog("Готов к вызовам deposit() и withdraw().", "muted");
updateUI();
