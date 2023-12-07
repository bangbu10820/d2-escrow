import { ethers } from "hardhat";
import { EscrowErc20, Token } from "../typechain-types";
import { expect } from "chai";
import { ZeroAddress, parseEther } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("EscrowErc20 contract", () => {
	let contract: EscrowErc20;
	let token: Token;

	let contractOwner: HardhatEthersSigner;
	let lender: HardhatEthersSigner;
	let borrower: HardhatEthersSigner;

	before(async () => {
		[contractOwner, lender, borrower] = await ethers.getSigners();

		const Token = await ethers.getContractFactory("Token");
		token = await Token.deploy("Anya Quote", "AQ", 18);

		const EE20 = await ethers.getContractFactory("EscrowErc20");
		contract = await EE20.deploy();

		await token.transfer(lender.address, parseEther("100"));
	});

	it("should have empty contract value", async () => {
		expect(await contract.lender()).to.eq(ZeroAddress);
		expect(await contract.borrower()).to.eq(ZeroAddress);
	});

	it("should have lender and borrower after fund", async () => {
		await token
			.connect(lender)
			.approve(await contract.getAddress(), parseEther("1"));

		await contract
			.connect(lender)
			.fund(token, borrower.address, parseEther("1"));

		expect(await contract.lender()).to.eq(lender.address);
		expect(await contract.borrower()).to.eq(borrower.address);
		expect(await contract.loan()).to.eq(parseEther("1"));
	});

	it("Withdraw", async () => {
		await contract.connect(borrower).withdraw();
		expect(await contract.claimed()).to.eq(true);
		expect(await token.balanceOf(borrower.address)).to.eq(parseEther("1"));
	});
});
