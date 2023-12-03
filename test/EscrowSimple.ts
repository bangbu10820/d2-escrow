import { ethers } from "hardhat";
import { before } from "mocha";
import { EscrowSimple } from "../typechain-types";
import { expect } from "chai";

describe("EscrowSimple contract", () => {
	let contract: EscrowSimple;

	before(async () => {
		contract = await ethers.deployContract("EscrowSimple");

		await contract.waitForDeployment();
	});

	describe("Borrow", () => {
		it("should increase borrower's balance", async () => {
			const [borrower] = await ethers.getSigners();
			const baseBalance = await contract.balances(borrower);

			await contract.connect(borrower).borrow();

			const borrowAmount = await contract.borrowAmount();

			expect(await contract.balances(borrower)).to.eq(
				baseBalance + borrowAmount
			);
		});

		it("should emit Borrow event", async () => {
			const [borrower] = await ethers.getSigners();

			await expect(contract.connect(borrower).borrow())
				.to.emit(contract, "Borrow")
				.withArgs(borrower.address);
		});
	});
});
