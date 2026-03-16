from web3 import Web3

# 1. Подключаемся к локальному блокчейну Hardhat
rpc_url = "http://127.0.0.1:8545"
web3 = Web3(Web3.HTTPProvider(rpc_url))

# Проверяем, удалось ли подключиться
if web3.is_connected():
    print("✅ Успешное подключение к локальному блокчейну Hardhat!")
else:
    print("❌ Ошибка подключения. Убедитесь, что 'npx hardhat node' запущен.")
    exit()

print("-" * 50)

# 2. Получаем список аккаунтов, которые нам выдал Hardhat
accounts = web3.eth.accounts
admin_account = accounts[0]
hacker_account = accounts[3]

print(f"🕵️ Адрес хакера: {hacker_account}")

# 3. Читаем баланс хакера напрямую из блокчейна (баланс возвращается в Wei, мельчайших частицах)
hacker_balance_wei = web3.eth.get_balance(hacker_account)

# 4. Переводим Wei в понятный формат (Эфиры - ETH)
hacker_balance_eth = web3.from_wei(hacker_balance_wei, 'ether')

print(f"💰 Баланс хакера в сети: {hacker_balance_eth} ETH")
print("-" * 50)