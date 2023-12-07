import { ethers } from "hardhat";
import { EscrowErc20, Token } from "../typechain-types";
import { expect } from "chai";
import { ZeroAddress, parseEther } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

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
			.approve(await contract.getAddress(), parseEther("6"));

		await contract
			.connect(lender)
			.fund(token, borrower.address, parseEther("6"), 6);

		expect(await contract.lender()).to.eq(lender.address);
		expect(await contract.borrower()).to.eq(borrower.address);
		expect(await contract.loan()).to.eq(parseEther("6"));
	});

	it("should claim 1 week", async () => {
		const lockedAt = await contract.lockedAt();

		await time.increaseTo(Number(lockedAt) + 60 * 60 * 24 * 7 + 1);

		await expect(contract.connect(borrower).withdraw()).to.changeTokenBalance(
			token,
			borrower,
			parseEther("1")
		);

		expect(await contract.claimedSteps()).to.eq(1n);
		expect(await contract.claimedAmount()).to.eq(parseEther("1"));
	});

	it("should claim 0 if same step", async () => {
		const lockedAt = await contract.lockedAt();

		await time.setNextBlockTimestamp(
			Number(lockedAt) + 60 * 60 * 24 * 7 + 60 * 60 * 24
		);

		await expect(contract.connect(borrower).withdraw()).to.changeTokenBalance(
			token,
			borrower,
			parseEther("0")
		);

		expect(await contract.claimedSteps()).to.eq(1n);
		expect(await contract.claimedAmount()).to.eq(parseEther("1"));

		expect(await token.balanceOf(borrower)).to.eq(parseEther("1"));
	});

	it("should success claim 2 more week", async () => {
		const lockedAt = await contract.lockedAt();

		await time.increaseTo(Number(lockedAt) + 60 * 60 * 24 * 7 * 3 + 1);

		await expect(contract.connect(borrower).withdraw()).to.changeTokenBalance(
			token,
			borrower,
			parseEther("2")
		);

		expect(await contract.claimedSteps()).to.eq(3n);
		expect(await contract.claimedAmount()).to.eq(parseEther("3"));

		expect(await token.balanceOf(borrower)).to.eq(parseEther("3"));
	});

	it("should success to claim after 10 more week", async () => {
		const lockedAt = await contract.lockedAt();

		await time.increaseTo(Number(lockedAt) + 60 * 60 * 24 * 7 * 10 + 1);

		await expect(contract.connect(borrower).withdraw()).to.changeTokenBalance(
			token,
			borrower,
			parseEther("3")
		);

		expect(await contract.claimedSteps()).to.eq(6n);
		expect(await contract.claimedAmount()).to.eq(parseEther("6"));

		expect(await token.balanceOf(borrower)).to.eq(parseEther("6"));
	});

	it("should fail if try to claim more", async () => {
		await expect(contract.connect(borrower).withdraw()).to.revertedWith(
			"this fund is empty"
		);
	});

	describe("working with odd fund", () => {
		const fundAmount = parseEther("7");
		const steps = 5;
		let baseBalance: bigint;
		let contract2: EscrowErc20;

		before(async () => {
			const EE20 = await ethers.getContractFactory("EscrowErc20");
			contract2 = await EE20.deploy();

			await token
				.connect(lender)
				.approve(await contract2.getAddress(), fundAmount);

			await contract2
				.connect(lender)
				.fund(token, borrower.address, fundAmount, steps);

			baseBalance = await token.balanceOf(borrower.address);
		});

		it("should success claim half", async () => {
			const lockedAt = await contract2.lockedAt();

			await time.increaseTo(Number(lockedAt) + 60 * 60 * 24 * 7 * 3 + 1);

			await expect(
				contract2.connect(borrower).withdraw()
			).to.changeTokenBalance(token, borrower, parseEther("4.2"));

			expect(await contract2.claimedSteps()).to.eq(3n);
			expect(await contract2.claimedAmount()).to.eq(parseEther("4.2"));

			expect(await token.balanceOf(borrower)).to.eq(parseEther("10.2"));
		});

		it("should success claim all", async () => {
			const lockedAt = await contract2.lockedAt();

			await time.increaseTo(Number(lockedAt) + 60 * 60 * 24 * 7 * 10 + 1);

			await expect(
				contract2.connect(borrower).withdraw()
			).to.changeTokenBalance(token, borrower, parseEther("2.8"));

			expect(await contract2.claimedSteps()).to.eq(steps);
			expect(await contract2.claimedAmount()).to.eq(parseEther("7"));

			expect(await token.balanceOf(borrower)).to.eq(parseEther("13"));

			await expect(contract2.connect(borrower).withdraw()).to.revertedWith(
				"this fund is empty"
			);
		});
	});

	// it("Withdraw", async () => {
	// 	await contract.connect(borrower).withdraw();
	// 	expect(await contract.claimed()).to.eq(true);
	// 	expect(await token.balanceOf(borrower.address)).to.eq(parseEther("1"));
	// });
});
