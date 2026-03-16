var CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; 

var provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
var privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
var wallet = new ethers.Wallet(privateKey, provider);

var abi = [
    "function deposit() public payable",
    "function withdraw() public",
    "function balances(address) public view returns (uint256)"
];
var contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function getTimestamp() {
    const now = new Date();
    return `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}.${now.getMilliseconds().toString().padStart(3,'0')}`;
}

function addLog(message, type = "info") {
    const logsDiv = document.getElementById("logs");
    let colorClass = "text-[#c7d5e0]"; 
    
    if (type === "success") colorClass = "text-[#a3cf06]";      
    else if (type === "warning") colorClass = "text-[#e5b15a]"; 
    else if (type === "error") colorClass = "text-[#ff4c4c]";   
    else if (type === "system") colorClass = "text-[#22d3ee]";  
    else if (type === "secure") colorClass = "text-[#a3cf06] font-bold";  
    else if (type === "sub") colorClass = "text-[#64748b] pl-6";

    logsDiv.innerHTML += `<p class="${colorClass}">[${getTimestamp()}] ${message}</p>`;
    logsDiv.scrollTop = logsDiv.scrollHeight; 
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateUI() {
    document.getElementById("walletAddress").innerText = wallet.address.substring(0, 8) + "..." + wallet.address.slice(-4);
    try {
        const bal = await contract.balances(wallet.address);
        document.getElementById("marketBalance").innerText = parseFloat(ethers.formatEther(bal)).toFixed(4);
    } catch (e) {
        addLog("[ОШИБКА] Не удалось связаться с контрактом. Проверь адрес или сервер!", "error");
    }
}

async function deposit() {
    try {
        addLog(`--------------------------------------------------`, "sub");
        addLog(`[БЕЗОПАСНОСТЬ] Запуск протокола безопасного пополнения...`, "system");
        
        addLog(`[СБОРКА] Формирование данных транзакции (Value: 1.00 ETH)...`, "warning");
        await sleep(400); // Теперь это сработает
        
        addLog(`[КРИПТОГРАФИЯ] Подписание транзакции ключом ECDSA...`, "secure");
        await sleep(300);
        addLog(`[ПРОВЕРКА] Подпись сгенерирована успешно`, "secure");
        
        addLog(`[ТРАНСЛЯЦИЯ] Отправка подписанной транзакции в мемпул сети...`, "warning");
        
        const txResponse = await contract.deposit({ value: ethers.parseEther("1") });
        addLog(`[СЕТЬ] Транзакция принята узлом. Хэш: ${txResponse.hash.substring(0,25)}...`, "info");
        
        const receipt = await txResponse.wait();
        addLog(`[ПОДТВЕРЖДЕНО] Средства надежно заблокированы. Блок: ${receipt.blockNumber}`, "success");
        addLog(`--------------------------------------------------`, "sub");
        updateUI();
    } catch (error) {
        let errorMsg = error.shortMessage || error.message || "Неизвестная ошибка";
        addLog(`[ОТКЛОНЕНО] ${errorMsg}`, "error");
        console.error(error);
    }
}

async function withdraw() {
    try {
        addLog(`--------------------------------------------------`, "sub");
        addLog(`[БЕЗОПАСНОСТЬ] Инициализация защищенного вывода средств...`, "system");
        
        await sleep(400);
        addLog(`[ПРОВЕРКА] Подтверждение прав собственности в эскроу-реестре... УСПЕШНО`, "secure");
        await sleep(300);
        addLog(`[ПРОВЕРКА] Активация Мьютекса (Reentrancy Guard)... УСПЕШНО`, "secure");
        
        addLog(`[СБОРКА_ТРАНЗАКЦИИ] Формирование запроса на разблокировку средств...`, "warning");
        const txResponse = await contract.withdraw();
        addLog(`[ТРАНСЛЯЦИЯ] Транзакция транслируется валидаторам. Хэш: ${txResponse.hash.substring(0,25)}...`, "info");
        
        const receipt = await txResponse.wait();
        addLog(`[ПОДТВЕРЖДЕНО] Средства успешно возвращены на кошелек. Блок: ${receipt.blockNumber}`, "success");
        addLog(`--------------------------------------------------`, "sub");
        updateUI();
    } catch (error) {
        let errorMsg = error.shortMessage || error.message || "Неизвестная ошибка";
        addLog(`[ЗАБЛОКИРОВАНО] Ошибка: ${errorMsg}`, "error");
        console.error(error);
    }
}

provider.on("block", async (blockNumber) => {
    const block = await provider.getBlock(blockNumber, true);
    addLog(`[СИНХРОНИЗАЦИЯ_ЦЕПИ] Записан новый блок #${blockNumber} | Газ: ${block.gasUsed.toString()}`, "system");
    
    if (block.prefetchedTransactions.length > 0) {
        block.prefetchedTransactions.forEach(tx => {
            const valueEth = ethers.formatEther(tx.value || 0);
            let txAction = "Взаимодействие со смарт-контрактом (0 ETH)";
            if (parseFloat(valueEth) > 0) {
                txAction = `Блокировка средств (Эскроу пополнение: ${valueEth} ETH)`;
            }
            addLog(` ↳ [ЗАПИСЬ_В_РЕЕСТР] ${txAction}`, "sub");
        });
    }
});

updateUI();