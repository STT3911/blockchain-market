// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SecureMarketplace {
    mapping(address => uint256) public balances;

    event DepositRecorded(address indexed account, uint256 amount, uint256 newBalance);
    event WithdrawalPrepared(address indexed account, uint256 amount);
    event WithdrawalSent(address indexed account, uint256 amount);
    event PauseChanged(bool paused);

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    bool public paused = false;
    address public admin;

    constructor() {
        _status = _NOT_ENTERED;
        admin = msg.sender;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    modifier whenNotPaused() {
        require(!paused, "Pausable: contract is paused");
        _;
    }

    function deposit() public payable whenNotPaused {
        balances[msg.sender] += msg.value;
        emit DepositRecorded(msg.sender, msg.value, balances[msg.sender]);
    }

    function withdraw() public nonReentrant whenNotPaused {
        uint256 bal = balances[msg.sender];
        require(bal > 0, "Insufficient balance");

        balances[msg.sender] = 0;
        emit WithdrawalPrepared(msg.sender, bal);

        (bool sent, ) = msg.sender.call{value: bal}("");
        require(sent, "Transfer failed");
        emit WithdrawalSent(msg.sender, bal);
    }

    function togglePause() public {
        require(msg.sender == admin, "Only admin can pause");
        paused = !paused;
        emit PauseChanged(paused);
    }

    function getMarketplaceBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
