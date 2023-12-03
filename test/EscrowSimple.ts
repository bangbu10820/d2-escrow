import { ethers } from "hardhat";
import { before } from "mocha";
import { EscrowSimple } from "../typechain-types";
import { expect } from "chai";
import { AddressLike } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
	time,
	loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

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

	describe("Lock fund", () => {
		let address1: HardhatEthersSigner;
		let balance: bigint;

		let address2: HardhatEthersSigner;

		before(async () => {
			const [address, addressNext] = await ethers.getSigners();
			address1 = address;
			address2 = addressNext;
		});

		beforeEach(async () => {
			balance = await contract.balances(address1.address);
			if (balance === 0n) {
				await contract.connect(address1).borrow();
			}
			balance = await contract.balances(address1.address);
		});

		it("should throw if not enough balance", () => {
			expect(
				contract
					.connect(address1)
					.lockFund(address2.address, Date.now(), Date.now(), balance + 1n)
			).to.be.revertedWith("Not enough tokens");
		});

		it("should throw if invalid amount", () => {
			expect(
				contract
					.connect(address1)
					.lockFund(address2.address, Date.now(), Date.now(), 0)
			).to.be.revertedWith("Invalid amount");
		});

		describe("Invalid unlock time and expire time", async () => {
			it("should throw if unlock time in the past", () => {
				expect(
					contract
						.connect(address1)
						.lockFund(address2.address, Date.now() / 1000, Date.now(), balance)
				).to.be.revertedWith("Unlock time must be in the future");
			});

			it("should throw if expire time is before unlock time", () => {
				const unlockTime = new Date();
				unlockTime.setMilliseconds(
					unlockTime.getMilliseconds() + 1000 * 60 * 60
				);
				it("should throw if unlock time in the past", () => {
					expect(
						contract
							.connect(address1)
							.lockFund(
								address2.address,
								unlockTime.getMilliseconds(),
								Date.now(),
								balance
							)
					).to.be.revertedWith("Expire time must be after unlock time");
				});
			});
		});

		it("should have fund after lock", async () => {
			const currentDate = new Date();

			await contract
				.connect(address1)
				.lockFund(
					address2.address,
					Math.round((currentDate.getTime() * 1000 * 20) / 1000),
					Math.round((currentDate.getTime() * 1000 * 60) / 1000),
					balance
				);

			const funds = await contract.connect(address2).getMyRelatedFunds();
			expect(funds.length).to.greaterThan(0);

			const newestFund = funds.sort((a, b) => Number(b.id - a.id))[0];
			expect(newestFund.amount).to.eq(balance);
		});

		it("should have more claimable fund after lock", async () => {
			const currentDate = new Date();

			await contract
				.connect(address1)
				.lockFund(
					address2.address,
					Math.round((currentDate.getTime() * 1000 * 20) / 1000),
					Math.round((currentDate.getTime() * 1000 * 60 * 60) / 1000),
					balance / 2n
				);

			const funds = await contract.connect(address2).getMyRelatedFunds();
			expect(funds.length).to.greaterThan(0);

			await contract
				.connect(address1)
				.lockFund(
					address2.address,
					Math.round((currentDate.getTime() * 1000 * 20) / 1000),
					Math.round((currentDate.getTime() * 1000 * 60 * 60) / 1000),
					balance / 2n
				);

			expect(
				(await contract.connect(address2).getMyRelatedFunds()).length
			).to.greaterThan(funds.length);
		});
	});

	describe("Claim fund", () => {
		let address1: HardhatEthersSigner;
		let balance: bigint;

		let address2: HardhatEthersSigner;

		before(async () => {
			const addresses = await ethers.getSigners(); // default 2
			address1 = addresses[addresses.length - 1];
			address2 = addresses[addresses.length - 2];
		});

		beforeEach(async () => {
			balance = await contract.balances(address1.address);
			if (balance === 0n) {
				await contract.connect(address1).borrow();
			}
			balance = await contract.balances(address1.address);
		});

		it("should have 0 claimable funds", async () => {
			const funds1 = await contract.connect(address1).getMyRelatedFunds();
			expect(funds1.length).to.eq(0);

			const funds2 = await contract.connect(address2).getMyRelatedFunds();
			expect(funds2.length).to.eq(0);
		});

		describe("Payee claim", () => {
			beforeEach(async () => {
				balance = await contract.balances(address1.address);
				if (balance === 0n) {
					await contract.connect(address1).borrow();
				}
				balance = await contract.balances(address1.address);
			});

			it("should fail to claim if fund not unlocked", async () => {
				await contract
					.connect(address1)
					.lockFund(
						address2.address,
						Math.round((new Date().getTime() + 1000 * 60 * 60) / 1000),
						Math.round((new Date().getTime() + 1000 * 60 * 120) / 1000),
						balance
					);

				const relatedFunds = await contract
					.connect(address2)
					.getMyRelatedFunds();
				const claimableFunds = await contract
					.connect(address2)
					.getMyClaimableFunds();

				expect(relatedFunds.length).to.eq(1);
				expect(claimableFunds.length).to.eq(0);

				expect(
					contract.connect(address2).withdraw(relatedFunds[0].id)
				).to.be.revertedWith("You can not claim this fund yet");
			});

			it("should not claimable if not have permission", async () => {
				const addresses = await ethers.getSigners();

				const relatedFunds = await contract
					.connect(address2)
					.getMyRelatedFunds();

				expect(
					contract
						.connect(
							addresses.find(
								(address) =>
									address.address !== address1.address &&
									address.address !== address2.address
							)
						)
						.withdraw(relatedFunds[0].id)
				).to.be.revertedWith("You don't have permission to withdraw this fund");
			});

			it("should claimable in time", async () => {
				const unlockTime = (await time.latest()) + 60;
				const address1Balance = await contract.balances(address1.address);

				await contract
					.connect(address1)
					.lockFund(address2.address, unlockTime, unlockTime + 120, balance);

				await time.increaseTo(unlockTime + 1);

				const claimableFunds = await contract
					.connect(address2)
					.getMyClaimableFunds();

				const claimFund = claimableFunds[0];

				const address2Balance = await contract.balances(address2.address);

				await contract.connect(address2).withdraw(claimFund.id);

				expect(await contract.balances(address1.address)).to.eq(
					address1Balance - claimFund.amount
				);
				expect(await contract.balances(address2.address)).to.eq(
					address2Balance + claimFund.amount
				);

				const relatedFunds = await contract
					.connect(address2)
					.getMyRelatedFunds();

				expect(relatedFunds.find((f) => f.id === claimFund.id)?.claimed).to.eq(
					true
				);
			});
		});

		describe("Payer withdraw", () => {
			let unlockTime;
			let expireTime;
			let fundId: bigint;
			before(async () => {
				await contract.connect(address1).borrow();

				unlockTime = (await time.latest()) + 60 * 60;
				expireTime = unlockTime + 120;
				const address1Balance = await contract.balances(address1.address);

				await contract
					.connect(address1)
					.lockFund(address2.address, unlockTime, expireTime, address1Balance);

				const relatedFunds = await contract
					.connect(address1)
					.getMyRelatedFunds();

				fundId = relatedFunds[0].id;
			});
			beforeEach(async () => {
				balance = await contract.balances(address1.address);
				if (balance === 0n) {
					await contract.connect(address1).borrow();
				}
				balance = await contract.balances(address1.address);
			});

			it("should not claimable before unlock time", async () => {
				expect(contract.connect(address1).withdraw(fundId!)).to.be.revertedWith(
					"You can not withdraw this fund yet"
				);
			});

			it("should not claimable between unlock time and expire itme", async () => {
				await time.increaseTo(unlockTime! + 1);

				expect(contract.connect(address1).withdraw(fundId!)).to.be.revertedWith(
					"You can not withdraw this fund yet"
				);
			});

			it("should claimable after expire time", async () => {
				await time.increaseTo(expireTime! + 1);

				const relatedFunds = await contract
					.connect(address1)
					.getMyRelatedFunds();

				await contract.connect(address1).withdraw(fundId!);

				const newBalance = await contract.balances(address1.address);

				expect(newBalance).to.be.eq(
					(relatedFunds.find((f) => f.id === fundId!)?.amount || 0n) + balance
				);
			});
		});
	});
});
