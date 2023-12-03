// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

contract EscrowSimple {
    uint256 public borrowAmount = 100;
    mapping(address => uint256) public balances;

    event Borrow(address borrower);

    constructor() {}

    // Send some fake money to borrower's address
    function borrow() external {
        balances[msg.sender] += borrowAmount;
        emit Borrow(msg.sender);
    }
}
