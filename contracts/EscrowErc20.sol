// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract EscrowErc20 {
    address public lender;
    address public borrower;
    uint public loan;
    IERC20 public token;
    uint public steps;
    uint public claimedSteps;
    uint public lockedAt;
    uint public claimedAmount;

    function fund(
        IERC20 _token,
        address _borrower,
        uint _loan,
        uint _steps
    ) external {
        require(lender == address(0), "You cant fund again");
        lender = msg.sender;
        borrower = _borrower;
        loan = _loan;
        token = _token;
        steps = _steps;
        claimedSteps = 0;
        lockedAt = block.timestamp;
        claimedAmount = 0;

        token.transferFrom(msg.sender, address(this), _loan);
    }

    function withdraw() external {
        require(msg.sender == borrower, "Only borrower can withdraw!");
        require(claimedSteps != steps, "this fund is empty");

        uint weekDiff = (block.timestamp - lockedAt) / 1 weeks;

        uint releaseAmount = 0;

        if (weekDiff >= steps) {
            releaseAmount = loan - claimedAmount;
        } else if (weekDiff < 1) {
            releaseAmount = 0;
        } else {
            uint releaseStepCount = weekDiff - claimedSteps;
            releaseAmount = ((loan) / steps) * releaseStepCount;
        }

        claimedSteps = steps < weekDiff ? steps : weekDiff;
        claimedAmount += releaseAmount;

        token.transfer(msg.sender, releaseAmount);
    }
}
