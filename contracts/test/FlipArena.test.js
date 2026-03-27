const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FlipArena", function () {
  let nrx, arena;
  let relayer, userA, userB, userC;

  const MINT = 10_000n; // each user gets 10,000 NRX (raw units)
  const UP = 0;
  const DOWN = 1;

  beforeEach(async function () {
    [relayer, userA, userB, userC] = await ethers.getSigners();

    // Deploy mock ERC20
    const MockNRX = await ethers.getContractFactory("MockNRX");
    nrx = await MockNRX.deploy();

    // Deploy FlipArena (relayer = msg.sender)
    const FlipArena = await ethers.getContractFactory("FlipArena");
    arena = await FlipArena.deploy(await nrx.getAddress());

    // Fund users
    for (const user of [userA, userB, userC]) {
      await nrx.mint(user.address, MINT);
      await nrx.connect(user).approve(await arena.getAddress(), MINT);
    }
  });

  it("should accept deposits and track pools correctly", async function () {
    await arena.deposit(userA.address, UP, 100n);
    await arena.deposit(userB.address, UP, 200n);
    await arena.deposit(userC.address, DOWN, 150n);

    const [, poolUp, poolDown, upCount, downCount] =
      await arena.getRoundInfo();

    expect(poolUp).to.equal(300n);
    expect(poolDown).to.equal(150n);
    expect(upCount).to.equal(2n);
    expect(downCount).to.equal(1n);
  });

  it("should settle UP correctly with proportional payouts", async function () {
    // A bets 100 UP, B bets 200 UP, C bets 150 DOWN
    await arena.deposit(userA.address, UP, 100n);
    await arena.deposit(userB.address, UP, 200n);
    await arena.deposit(userC.address, DOWN, 150n);

    const balBefore_A = await nrx.balanceOf(userA.address);
    const balBefore_B = await nrx.balanceOf(userB.address);
    const balBefore_C = await nrx.balanceOf(userC.address);

    // Total pool = 450.  UP pool = 300.
    // A gets (100 / 300) * 450 = 150
    // B gets (200 / 300) * 450 = 300
    // C gets nothing
    await arena.settleRound(UP);

    const balAfter_A = await nrx.balanceOf(userA.address);
    const balAfter_B = await nrx.balanceOf(userB.address);
    const balAfter_C = await nrx.balanceOf(userC.address);

    expect(balAfter_A - balBefore_A).to.equal(150n);
    expect(balAfter_B - balBefore_B).to.equal(300n);
    expect(balAfter_C - balBefore_C).to.equal(0n);

    // Verify pools reset
    const [round, poolUp, poolDown] = await arena.getRoundInfo();
    expect(round).to.equal(1n);
    expect(poolUp).to.equal(0n);
    expect(poolDown).to.equal(0n);
  });

  it("should settle DOWN correctly", async function () {
    await arena.deposit(userA.address, UP, 100n);
    await arena.deposit(userB.address, DOWN, 200n);
    await arena.deposit(userC.address, DOWN, 100n);

    const balBefore_A = await nrx.balanceOf(userA.address);
    const balBefore_B = await nrx.balanceOf(userB.address);
    const balBefore_C = await nrx.balanceOf(userC.address);

    // Total = 400.  DOWN pool = 300.
    // B gets (200 / 300) * 400 = 266  (integer division)
    // C gets (100 / 300) * 400 = 133
    // A gets nothing
    // Note: 266 + 133 = 399 — 1 token stays in contract due to rounding
    await arena.settleRound(DOWN);

    expect(await nrx.balanceOf(userA.address) - balBefore_A).to.equal(0n);
    expect(await nrx.balanceOf(userB.address) - balBefore_B).to.equal(266n);
    expect(await nrx.balanceOf(userC.address) - balBefore_C).to.equal(133n);
  });

  it("should handle single-sided UP pool (everyone wins back their stake)", async function () {
    await arena.deposit(userA.address, UP, 100n);
    await arena.deposit(userB.address, UP, 200n);
    // No DOWN bets

    const balBefore_A = await nrx.balanceOf(userA.address);
    const balBefore_B = await nrx.balanceOf(userB.address);

    // Total = 300, UP pool = 300.  A gets 100, B gets 200 (exact refund)
    await arena.settleRound(UP);

    expect(await nrx.balanceOf(userA.address) - balBefore_A).to.equal(100n);
    expect(await nrx.balanceOf(userB.address) - balBefore_B).to.equal(200n);
  });

  it("should keep funds in contract when no one bet on the winning side", async function () {
    await arena.deposit(userA.address, DOWN, 300n);

    const balBefore_A = await nrx.balanceOf(userA.address);

    // UP wins but nobody bet UP — funds stay in contract
    await arena.settleRound(UP);

    expect(await nrx.balanceOf(userA.address) - balBefore_A).to.equal(0n);
    expect(await nrx.balanceOf(await arena.getAddress())).to.equal(300n);
  });

  it("should settle empty rounds without reverting", async function () {
    await arena.settleRound(UP);
    const [round] = await arena.getRoundInfo();
    expect(round).to.equal(1n);
  });

  it("should reject deposits from non-relayer", async function () {
    await expect(
      arena.connect(userA).deposit(userA.address, UP, 100n)
    ).to.be.revertedWith("Not relayer");
  });

  it("should reject settleRound from non-relayer", async function () {
    await expect(
      arena.connect(userA).settleRound(UP)
    ).to.be.revertedWith("Not relayer");
  });

  it("should reject invalid direction", async function () {
    await expect(arena.deposit(userA.address, 2, 100n)).to.be.revertedWith(
      "Bad dir"
    );
  });

  it("should reject zero-amount deposits", async function () {
    await expect(arena.deposit(userA.address, UP, 0n)).to.be.revertedWith(
      "Zero"
    );
  });

  it("should increment round number on each settlement", async function () {
    await arena.settleRound(UP);
    await arena.settleRound(DOWN);
    await arena.settleRound(UP);
    const [round] = await arena.getRoundInfo();
    expect(round).to.equal(3n);
  });

  it("should handle large asymmetric pools without precision loss", async function () {
    // A bets 1 UP, B bets 9999 DOWN
    await arena.deposit(userA.address, UP, 1n);
    await arena.deposit(userB.address, DOWN, 9999n);

    const balBefore_A = await nrx.balanceOf(userA.address);

    // UP wins. A gets (1 / 1) * 10000 = 10000
    await arena.settleRound(UP);

    expect(await nrx.balanceOf(userA.address) - balBefore_A).to.equal(10000n);
  });
});
