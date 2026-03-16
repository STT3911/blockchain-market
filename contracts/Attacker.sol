// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SecureMarketplace.sol"; // Ссылаемся на новый файл

contract Attacker {
    SecureMarketplace public marketplace;

    constructor(address _marketplaceAddress) {
        marketplace = SecureMarketplace(_marketplaceAddress);
    }

    receive() external payable {
        // Пытаемся запустить цикл атаки (теперь это не сработает благодаря Мьютексу!)
        if (address(marketplace).balance >= 1 ether) {
            marketplace.withdraw();
        }
    }

    function attack() external payable {
        require(msg.value >= 1 ether, unicode"Нужен 1 эфир для старта");
        
        marketplace.deposit{value: 1 ether}();
        marketplace.withdraw();
    }

    function getAttackerBalance() public view returns (uint256) {
        return address(this).balance;
    }
}