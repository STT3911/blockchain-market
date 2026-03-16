// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SecureMarketplace {
    mapping(address => uint256) public balances;
    
    // Мьютекс (Reentrancy Guard)
    // Эти переменные блокируют выполнение функции, если хакер пытается 
    // вызвать её повторно до завершения первого вызова.
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    //CircuitBreaker(Аварийная пауза)
    bool public paused = false;
    address public admin;

    constructor() {
        _status = _NOT_ENTERED;
        admin = msg.sender; // Тот, кто развернул контракт, становится админом
    }

    // Модификатор защиты от атаки повторного входа
    modifier nonReentrant() {
        require(_status != _ENTERED, unicode"ReentrancyGuard: обнаружена атака повторного входа!");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED; // Снимаем блокировку только после полного завершения
    }

    // модификатор проверки паузы
    modifier whenNotPaused() {
        require(!paused, unicode"Pausable: Контракт остановлен админом из-за угрозы");
        _;
    }

    // функция депозита (работает только если нет паузы)
    function deposit() public payable whenNotPaused {
        balances[msg.sender] += msg.value;
    }

    // функция возврата средств (с Мьютексом и проверкой паузы)
    function withdraw() public nonReentrant whenNotPaused {
        uint256 bal = balances[msg.sender];
        require(bal > 0, unicode"Недостаточно средств");

        // Паттерн Checks-Effects-Interactions всё еще соблюдается!
        balances[msg.sender] = 0;

        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent, unicode"Ошибка перевода");
    }

    // Админ может заморозить все операции при обнаружении взлома
    function togglePause() public {
        require(msg.sender == admin, unicode"Только админ может нажать рубильник");
        paused = !paused;
    }

    function getMarketplaceBalance() public view returns (uint256) {
        return address(this).balance;
    }
}