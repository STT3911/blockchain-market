const config = window.DEMO_CONFIG ?? {};
const TARGET_MARKET = config.targetMarket ?? "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ATTACKER_CONTRACT = config.attackerContract ?? "0x0116686E2291dbd5e317F47faDBFb43B599786Ef";
const RPC_URL = config.rpcUrl ?? "http://127.0.0.1:8545";

const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { cacheTimeout: 0 });
const hackerWallet = new ethers.Wallet(
    "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
    provider
);

const attackerAbi = ["function attack() external payable"];
const attackerContract = new ethers.Contract(ATTACKER_CONTRACT, attackerAbi, hackerWallet);

const logsDiv = document.getElementById("logs");
const attackerAddress = document.getElementById("attackerAddress");
const targetBalance = document.getElementById("targetBalance");
const nodeStatus = document.getElementById("nodeStatus");
const hackBtn = document.getElementById("hackBtn");

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

async function updateUI() {
    attackerAddress.textContent = `${hackerWallet.address.slice(0, 8)}...${hackerWallet.address.slice(-4)}`;

    try {
        await provider.getBlockNumber();
        nodeStatus.textContent = "online";

        const balance = await provider.getBalance(TARGET_MARKET);
        const eth = Number(ethers.formatEther(balance));
        targetBalance.textContent = eth.toFixed(4);
        return eth;
    } catch (error) {
        nodeStatus.textContent = "offline";
        addLog("Не удалось прочитать баланс цели. Запусти npm start и обнови страницу.", "error");
        console.error(error);
        return 0;
    }
}

async function executeHack() {
    hackBtn.disabled = true;

    try {
        const initialBalance = await updateUI();
        addLog("--------------------------------------------------", "muted");
        addLog("Отправляем Attacker.attack() с 1 ETH.", "system");
        await sleep(200);

        const tx = await attackerContract.attack({ value: ethers.parseEther("1") });
        addLog(`Транзакция отправлена: ${tx.hash.slice(0, 26)}...`, "warning");

        await tx.wait();
        addLog("Транзакция смайнена. Fallback успел повторно вызвать withdraw().", "success");

        const loops = Math.max(1, Math.floor(initialBalance));
        for (let i = 1; i <= loops; i += 1) {
            addLog(`re-entry #${i}: повторный withdraw() до обнуления баланса`, "error");
            await sleep(90);
        }

        await updateUI();
        addLog("Баланс цели обновлен после атаки.", "success");
    } catch (error) {
        addLog(`Exploit не выполнен: ${error.shortMessage || error.message}`, "error");
        console.error(error);
    } finally {
        hackBtn.disabled = false;
    }
}

hackBtn.addEventListener("click", executeHack);

addLog("Стенд атаки инициализирован.", "system");
addLog("Готов к запуску Attacker.attack().", "muted");
updateUI();
