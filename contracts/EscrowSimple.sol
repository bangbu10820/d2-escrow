// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "hardhat/console.sol";

contract EscrowSimple {
    struct Fund {
        address owner;
        address payee;
        uint256 amount;
        uint unlockTime;
        uint expireTime;
        uint id;
        bool claimed;
    }

    uint256 public borrowAmount = 100;
    mapping(address => uint256) public balances;
    Fund[] private funds;

    event Borrow(address borrower);

    event LockFund(
        address owner,
        address payee,
        uint256 amount,
        uint unlockTime,
        uint expireTime,
        uint id
    );

    event Withdraw(address claimer, uint fundId, uint amount);

    constructor() {}

    // Send some fake money to borrower's address
    function borrow() external {
        balances[msg.sender] += borrowAmount;
        emit Borrow(msg.sender);
    }

    function lockFund(
        address payee,
        uint unlockTime,
        uint expireTime,
        uint amount
    ) external {
        require(balances[msg.sender] >= amount, "Not enough tokens");
        require(amount > 0, "Invalid amount");
        require(
            unlockTime > block.timestamp,
            "Unlock time must be in the future"
        );
        require(
            expireTime > unlockTime,
            "Expire time must be after unlock time"
        );

        uint id = funds.length + 1;
        balances[msg.sender] -= amount;
        funds.push(
            Fund({
                owner: msg.sender,
                payee: payee,
                unlockTime: unlockTime,
                expireTime: expireTime,
                amount: amount,
                id: id,
                claimed: false
            })
        );

        emit LockFund(msg.sender, payee, amount, unlockTime, expireTime, id);
    }

    // This is not working
    function getMyClaimableFunds() external view returns (Fund[] memory) {
        uint count = 0;
        for (uint i = 0; i < funds.length; i++) {
            Fund memory fund = funds[i];

            if (
                !fund.claimed &&
                ((fund.payee == msg.sender &&
                    fund.expireTime > block.timestamp &&
                    fund.unlockTime < block.timestamp) ||
                    (fund.owner == msg.sender &&
                        fund.expireTime < block.timestamp))
            ) {
                count++;
            }
        }

        Fund[] memory result = new Fund[](count);
        uint256 j;
        for (uint i = 0; i < funds.length; i++) {
            Fund memory fund = funds[i];
            if (
                !fund.claimed &&
                ((fund.payee == msg.sender &&
                    fund.expireTime > block.timestamp &&
                    fund.unlockTime < block.timestamp) ||
                    (fund.owner == msg.sender &&
                        fund.expireTime < block.timestamp))
            ) {
                result[j] = fund;
            }
        }
        return result;
    }

    function withdraw(uint fundId) external {
        require(fundId <= funds.length, "Invalid fund id");

        Fund storage fund = funds[fundId - 1];

        require(
            fund.payee == msg.sender || fund.owner == msg.sender,
            "You don't have permission to withdraw this fund"
        );
        require(fund.claimed == false, "This fund has already been claimed");

        if (msg.sender == fund.payee) {
            require(
                block.timestamp > fund.unlockTime,
                "You can not claim this fund yet"
            );
            require(block.timestamp < fund.expireTime, "Expired fund");
        } else {
            require(
                block.timestamp > fund.expireTime,
                "You can not withdraw this fund yet"
            );
        }

        fund.claimed = true;
        balances[msg.sender] += fund.amount;

        emit Withdraw(msg.sender, fundId, fund.amount);
    }

    function getMyRelatedFunds() external view returns (Fund[] memory) {
        uint count = 0;
        for (uint i = 0; i < funds.length; i++) {
            Fund memory fund = funds[i];
            if ((fund.payee == msg.sender || fund.owner == msg.sender)) {
                count++;
            }
        }

        Fund[] memory result = new Fund[](count);
        uint256 j;
        for (uint i = 0; i < funds.length; i++) {
            Fund memory fund = funds[i];
            if ((fund.payee == msg.sender || fund.owner == msg.sender)) {
                result[j] = fund;
            }
        }
        return result;
    }
}
