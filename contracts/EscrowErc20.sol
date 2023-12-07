// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EscrowErc20 {
    address public lender;
    address public borrower;
    uint public loan;
    IERC20 public token;
    bool public claimed;

    function fund(IERC20 _token, address _borrower, uint _loan) external {
        lender = msg.sender;
        borrower = _borrower;
        loan = _loan;
        token = _token;
        claimed = false;

        token.transferFrom(msg.sender, address(this), _loan);
    }

    function withdraw() external {
        require(msg.sender == borrower, "Only borrower can withdraw!");
        require(!claimed, "This fund had already been claimed");

        token.transfer(msg.sender, loan);
        claimed = true;
    }
}
