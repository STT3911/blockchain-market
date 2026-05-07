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
    "function getMarketplaceBalance() public view returns (uint256)",
    "event DepositRecorded(address indexed account, uint256 amount, uint256 newBalance)",
    "event WithdrawalPrepared(address indexed account, uint256 amount)",
    "event WithdrawalSent(address indexed account, uint256 amount)"
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);
const contractInterface = new ethers.Interface(abi);

const logsDiv = document.getElementById("logs");
const walletAddress = document.getElementById("walletAddress");
const marketBalance = document.getElementById("marketBalance");
const nodeStatus = document.getElementById("nodeStatus");
const depositBtn = document.getElementById("depositBtn");
const withdrawBtn = document.getElementById("withdrawBtn");

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

function setBusy(isBusy) {
    depositBtn.disabled = isBusy;
    withdrawBtn.disabled = isBusy;
}

async function readState() {
    const userDeposit = await contract.balances(wallet.address);
    const contractEth = await provider.getBalance(CONTRACT_ADDRESS);
    const blockNumber = await provider.getBlockNumber();
    return { userDeposit, contractEth, blockNumber };
}

async function updateUI() {
    walletAddress.textContent = `${wallet.address.slice(0, 8)}...${wallet.address.slice(-4)}`;

    try {
        const state = await readState();
        nodeStatus.textContent = "online";
        marketBalance.textContent = Number(ethers.formatEther(state.userDeposit)).toFixed(4);
    } catch (error) {
        nodeStatus.textContent = "offline";
        addLog("Не удалось прочитать контракт. Запусти npm start и обнови страницу.", "error");
        console.error(error);
    }
}

async function logReceipt(receipt) {
    const block = await provider.getBlock(receipt.blockNumber);
    addLog(`Транзакция попала в блок #${receipt.blockNumber}.`, "success");
    addLog(`Block hash: ${short(block.hash)}; tx index: ${receipt.index}; gas: ${receipt.gasUsed.toString()}.`, "muted");

    for (const rawLog of receipt.logs) {
        try {
            const parsed = contractInterface.parseLog(rawLog);
            if (parsed.name === "DepositRecorded") {
                addLog(`Событие DepositRecorded: записан депозит ${formatEth(parsed.args.amount)}, новый баланс ${formatEth(parsed.args.newBalance)}.`, "success");
            }
            if (parsed.name === "WithdrawalPrepared") {
                addLog(`Событие WithdrawalPrepared: контракт обнулил внутренний баланс перед переводом ${formatEth(parsed.args.amount)}.`, "warning");
            }
            if (parsed.name === "WithdrawalSent") {
                addLog(`Событие WithdrawalSent: ETH отправлен кошельку ${short(parsed.args.account)}.`, "success");
            }
        } catch {
            // Skip logs from other contracts.
        }
    }
}

async function deposit() {
    setBusy(true);

    try {
        addLog("--------------------------------------------------", "muted");
        const before = await readState();
        addLog(`До операции: депозит пользователя ${formatEth(before.userDeposit)}, ETH на контракте ${formatEth(before.contractEth)}, текущий блок #${before.blockNumber}.`, "system");
        addLog(`Формируем транзакцию deposit(value=1 ETH): from ${short(wallet.address)} -> contract ${short(CONTRACT_ADDRESS)}.`, "system");

        const txResponse = await contract.deposit({ value: ethers.parseEther("1") });
        addLog(`RPC принял транзакцию. Hash: ${txResponse.hash}.`, "warning");
        addLog("Ждем майнинга: Hardhat включает транзакцию в следующий блок.", "system");

        const receipt = await txResponse.wait();
        await logReceipt(receipt);

        const after = await readState();
        addLog(`После записи: депозит пользователя ${formatEth(after.userDeposit)}, ETH на контракте ${formatEth(after.contractEth)}.`, "success");
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
        const before = await readState();
        addLog(`До операции: депозит пользователя ${formatEth(before.userDeposit)}, ETH на контракте ${formatEth(before.contractEth)}, текущий блок #${before.blockNumber}.`, "system");
        addLog("Формируем withdraw(): контракт проверит баланс, запишет 0, потом отправит ETH.", "system");

        const txResponse = await contract.withdraw();
        addLog(`RPC принял транзакцию. Hash: ${txResponse.hash}.`, "warning");
        addLog("Ждем блок: состояние изменится только после майнинга.", "system");

        const receipt = await txResponse.wait();
        await logReceipt(receipt);

        const after = await readState();
        addLog(`После обработки: депозит пользователя ${formatEth(after.userDeposit)}, ETH на контракте ${formatEth(after.contractEth)}.`, "success");
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

addLog(`Подключение к Hardhat RPC: ${RPC_URL}.`, "system");
addLog(`SecureMarketplace: ${CONTRACT_ADDRESS}.`, "muted");
addLog("Журнал покажет: отправку tx -> блок -> события контракта -> новое состояние.", "muted");
updateUI();
setInterval(updateUI, 3000);
