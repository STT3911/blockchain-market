# 🚀 Запуск blockchain-market

## Шаг 1: Установка зависимостей

```bash
npm install
```

## Шаг 2: Запуск Hardhat локального узла

**Откройте ПЕРВЫЙ терминал:**
```bash
npm run node
```

Вывод должен показать:
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/
```

## Шаг 3: Развертывание контрактов

**Откройте ВТОРОЙ терминал (в том же каталоге):**

### Для безопасного маркетплейса:
```bash
npm run deploy
```

Это выведет адрес контракта. **Скопируйте адрес!**

Вставьте его в `index.html` в строке:
```javascript
const CONTRACT_ADDRESS = "0x5FbDB2315678afccb333f8a9c45b65d30061dFf48"; // ← ВАШЕ ЗНАЧЕНИЕ
```

### Для демонстрации атаки:
```bash
npm run setup-hack
```

Это выведет адреса. Вставьте их в `hacker.html`:
```javascript
const MARKET_ADDRESS = "0x...";     // ← TARGET_MARKET_ADDRESS  
const ATTACKER_ADDRESS = "0x...";  // ← ATTACKER_CONTRACT_ADDRESS
```

## Шаг 4: Открыть интерфейсы в браузере

**Безопасный маркетплейс:**
```
file:///d:/blockchain-market/index.html
```

**Инструмент атаки:**
```
file:///d:/blockchain-market/hacker.html
```

## Шаг 5: Тестирование (опционально)

```bash
npm test
```

Или запустить полную симуляцию:
```bash
npm run simulate
```

---

## 📋 Краткая инструкция

```bash
# Терминал 1:
npm install
npm run node

# Терминал 2:
npm run deploy          # Скопировать адрес в index.html
npm run setup-hack      # Скопировать адреса в hacker.html

# Затем открыть index.html и hacker.html в браузере
```

## Что происходит:

1. **index.html** → Безопасный маркетплейс с защитой от reentrancy
2. **hacker.html** → Демонстрация атаки на уязвимый контракт
3. **Terminal logs** → Видеть все транзакции и блокирования
