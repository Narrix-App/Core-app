import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketServer } from "socket.io";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  Client,
  PrivateKey,
  AccountId,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  TransferTransaction,
} from "@hashgraph/sdk";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

// ─── Config ──────────────────────────────────────────────
const operatorId = process.env.OPERATOR_ID;
const operatorKey = PrivateKey.fromStringDer(process.env.OPERATOR_KEY);
const FLIPARENA_ID = process.env.FLIPARENA_ID;
const NRX_TOKEN_ID = process.env.NRX_TOKEN_ID;
const NRX_TOKEN_EVM = process.env.NRX_TOKEN_EVM;
const FLIPARENA_EVM = process.env.FLIPARENA_EVM;

if (!FLIPARENA_ID || !NRX_TOKEN_ID) {
  console.error("Missing FLIPARENA_ID or NRX_TOKEN_ID in .env.");
  process.exit(1);
}

const client = Client.forTestnet();
client.setOperator(operatorId, operatorKey);

const operatorEvmAddress =
  "0x" + AccountId.fromString(operatorId).toSolidityAddress();

// ─── Express + Socket.io ─────────────────────────────────
const app = express();
const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());
app.use(express.static(resolve(__dirname, "../frontend/dist")));
app.use(express.static(resolve(__dirname, "../frontend")));

io.on("connection", (socket) => {
  console.log(`  [ws] Client connected (${io.engine.clientsCount} total)`);
  socket.on("disconnect", () => {
    console.log(`  [ws] Client disconnected (${io.engine.clientsCount} total)`);
  });
});

// ─── Oracle State ────────────────────────────────────────
let latestScore = 5000;
let roundStartScore = 5000;
let topicId = process.env.HCS_TOPIC_ID || null;

// ─── Round State ─────────────────────────────────────────
const ROUND_DURATION = 30;
let roundTimer = ROUND_DURATION;
let roundNumber = 0;
let localPoolUp = 0;
let localPoolDown = 0;
let recentResults = [];

// ─── HCS Oracle ──────────────────────────────────────────
async function initOracle() {
  if (topicId) {
    console.log(`Using existing HCS Topic: ${topicId}`);
    return;
  }

  console.log("Creating HCS Topic...");
  const tx = await new TopicCreateTransaction()
    .setSubmitKey(client.operatorPublicKey)
    .setTopicMemo("Narrix NAI Score Oracle")
    .execute(client);

  const receipt = await tx.getReceipt(client);
  topicId = receipt.topicId.toString();
  console.log(`HCS Topic Created: ${topicId}`);
}

function startOracle() {
  setInterval(async () => {
    const delta = Math.floor(Math.random() * 301) - 150;
    latestScore = Math.max(1000, Math.min(9999, latestScore + delta));

    const payload = JSON.stringify({
      score: latestScore,
      timestamp: Date.now(),
    });

    try {
      await new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(payload)
        .execute(client);
    } catch (err) {
      console.error("Oracle publish error:", err.message);
    }
  }, 2000);
}

// ─── Settlement Loop ─────────────────────────────────────
function startSettlementLoop() {
  roundStartScore = latestScore;
  roundTimer = ROUND_DURATION;

  setInterval(async () => {
    roundTimer--;
    if (roundTimer <= 0) {
      await settleCurrentRound();
      roundStartScore = latestScore;
      roundTimer = ROUND_DURATION;
    }
  }, 1000);
}

async function settleCurrentRound() {
  const exitScore = latestScore;
  const winningDirection = exitScore >= roundStartScore ? 0 : 1;
  const dirLabel = winningDirection === 0 ? "UP" : "DOWN";

  // ── 1. Query all pending bets for this round from DB ──
  const pendingBets = await prisma.bet.findMany({
    where: { roundNumber, status: "pending" },
  });

  const totalPool = localPoolUp + localPoolDown;

  console.log(
    `\n⚡ ROUND ${roundNumber} SETTLED — ` +
      `${dirLabel} wins (${roundStartScore} → ${exitScore}) | ` +
      `Pool: ${localPoolUp} UP / ${localPoolDown} DOWN | ` +
      `${pendingBets.length} bets in DB`
  );

  // ── 2. On-chain settlement ────────────────────────────
  if (totalPool > 0) {
    try {
      const tx = await new ContractExecuteTransaction()
        .setContractId(FLIPARENA_ID)
        .setFunction(
          "settleRound",
          new ContractFunctionParameters().addUint8(winningDirection)
        )
        .setGas(500_000)
        .execute(client);

      const receipt = await tx.getReceipt(client);
      console.log(`  On-chain settlement: ${receipt.status}`);
    } catch (err) {
      console.error(`  On-chain settlement FAILED: ${err.message}`);
      // Still update DB so UI isn't stuck — bets are lost on-chain failure
    }
  }

  // ── 3. Calculate PnL and bulk-update every pending bet ─
  const winningPool =
    winningDirection === 0 ? localPoolUp : localPoolDown;

  const settledBets = [];

  for (const bet of pendingBets) {
    const won = bet.direction === winningDirection;
    let pnl;

    if (won && winningPool > 0) {
      // Proportional share of total pool
      const payout = (bet.amount * totalPool) / winningPool;
      pnl = payout - bet.amount; // profit only
    } else {
      pnl = -bet.amount; // lost everything
    }

    const status = won && winningPool > 0 ? "won" : "lost";

    await prisma.bet.update({
      where: { id: bet.id },
      data: { exitScore, pnl, status },
    });

    settledBets.push({
      id: bet.id,
      accountId: bet.accountId,
      direction: bet.direction,
      amount: bet.amount,
      entryScore: bet.entryScore,
      exitScore,
      pnl,
      status,
    });
  }

  // ── 4. Build round result and emit via Socket.io ──────
  const roundResult = {
    round: roundNumber,
    winner: dirLabel,
    startScore: roundStartScore,
    endScore: exitScore,
    poolUp: localPoolUp,
    poolDown: localPoolDown,
    totalBets: pendingBets.length,
    settledBets,
  };

  recentResults.unshift(roundResult);
  recentResults = recentResults.slice(0, 10);

  io.emit("round_settled", roundResult);
  console.log(
    `  DB updated: ${settledBets.filter((b) => b.status === "won").length} winners, ` +
      `${settledBets.filter((b) => b.status === "lost").length} losers`
  );

  // ── 5. Reset for next round ───────────────────────────
  localPoolUp = 0;
  localPoolDown = 0;
  roundNumber++;
}

// ─── API: Place a Bet ────────────────────────────────────
app.post("/api/bet", async (req, res) => {
  const { evmAddress, direction, amount, accountId } = req.body;

  if (!evmAddress || direction === undefined || !amount) {
    return res
      .status(400)
      .json({ error: "Missing evmAddress, direction, or amount" });
  }
  if (direction !== 0 && direction !== 1) {
    return res.status(400).json({ error: "direction must be 0 (UP) or 1 (DOWN)" });
  }
  if (amount <= 0) {
    return res.status(400).json({ error: "amount must be > 0" });
  }

  const rawAmount = Math.floor(amount * 100);
  const dirLabel = direction === 0 ? "UP" : "DOWN";

  try {
    const tx = await new ContractExecuteTransaction()
      .setContractId(FLIPARENA_ID)
      .setFunction(
        "deposit",
        new ContractFunctionParameters()
          .addAddress(evmAddress.replace("0x", ""))
          .addUint8(direction)
          .addUint256(rawAmount)
      )
      .setGas(300_000)
      .execute(client);

    const receipt = await tx.getReceipt(client);

    if (direction === 0) localPoolUp += amount;
    else localPoolDown += amount;

    // ── Save to DB ──────────────────────────────────────
    const bet = await prisma.bet.create({
      data: {
        roundNumber,
        accountId: accountId || evmAddress,
        evmAddress,
        direction,
        amount,
        entryScore: latestScore,
        status: "pending",
        txId: tx.transactionId.toString(),
      },
    });

    // ── Broadcast to all clients ────────────────────────
    const betEvent = {
      id: bet.id,
      accountId: bet.accountId,
      direction: dirLabel,
      amount,
      roundNumber,
      timestamp: Date.now(),
    };

    io.emit("global_bet", betEvent);

    console.log(
      `  BET #${bet.id}: ${dirLabel} ${amount} NRX from ` +
        `${(bet.accountId || "").slice(0, 7)}... | Round ${roundNumber}`
    );

    res.json({
      success: true,
      betId: bet.id,
      transactionId: tx.transactionId.toString(),
      direction: dirLabel,
      amount,
      entryScore: latestScore,
    });
  } catch (err) {
    console.error(`  Bet failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Faucet ─────────────────────────────────────────
const faucetCooldowns = new Map(); // accountId → last faucet timestamp
const FAUCET_AMOUNT = 1000_00;
const FAUCET_COOLDOWN_MS = 60_000; // 1 minute between faucets

app.post("/api/faucet", async (req, res) => {
  const { accountId } = req.body;
  if (!accountId) {
    return res.status(400).json({ error: "Missing accountId" });
  }

  // Rate limit
  const lastFaucet = faucetCooldowns.get(accountId) || 0;
  if (Date.now() - lastFaucet < FAUCET_COOLDOWN_MS) {
    const wait = Math.ceil((FAUCET_COOLDOWN_MS - (Date.now() - lastFaucet)) / 1000);
    return res.status(429).json({ error: `Wait ${wait}s before next faucet`, code: "RATE_LIMITED" });
  }

  try {
    const tx = await new TransferTransaction()
      .addTokenTransfer(NRX_TOKEN_ID, operatorId, -FAUCET_AMOUNT)
      .addTokenTransfer(NRX_TOKEN_ID, accountId, FAUCET_AMOUNT)
      .execute(client);

    const receipt = await tx.getReceipt(client);
    faucetCooldowns.set(accountId, Date.now());

    const txId = tx.transactionId.toString();
    console.log(`  FAUCET: 1,000 NRX → ${accountId} | ${receipt.status} | ${txId}`);

    // Record in DB so it shows in history
    await prisma.bet.create({
      data: {
        roundNumber: -1,
        accountId,
        evmAddress: "",
        direction: -1, // -1 = faucet
        amount: 1000,
        entryScore: 0,
        pnl: 1000,
        status: "faucet",
        txId,
      },
    });

    res.json({ success: true, amount: 1000, txId });
  } catch (err) {
    const msg = err.message || "";
    // Detect TOKEN_NOT_ASSOCIATED from Hedera error
    if (msg.includes("TOKEN_NOT_ASSOCIATED") || msg.includes("TOKEN_NOT_ASSOCIATED_TO_ACCOUNT")) {
      console.error(`  Faucet: ${accountId} not associated with NRX`);
      return res.status(400).json({ error: "Token not associated", code: "TOKEN_NOT_ASSOCIATED" });
    }
    console.error(`  Faucet failed: ${msg}`);
    res.status(500).json({ error: msg });
  }
});

// ─── API: Leaderboard (Top 10 daily winners) ─────────────
app.get("/api/leaderboard", async (_req, res) => {
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const rows = await prisma.bet.groupBy({
    by: ["accountId"],
    where: {
      status: "won",
      createdAt: { gte: since },
    },
    _sum: { pnl: true },
    _count: true,
    orderBy: { _sum: { pnl: "desc" } },
    take: 10,
  });

  res.json(
    rows.map((r) => ({
      accountId: r.accountId,
      totalPnl: Math.round((r._sum.pnl || 0) * 100) / 100,
      wins: r._count,
    }))
  );
});

// ─── API: User history (last 30 bets) ────────────────────
app.get("/api/history/:accountId", async (req, res) => {
  const bets = await prisma.bet.findMany({
    where: { accountId: req.params.accountId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  res.json(bets);
});

// ─── API: Game State ─────────────────────────────────────
app.get("/api/state", (_req, res) => {
  res.json({
    score: latestScore,
    roundStartScore,
    scoreDelta: latestScore - roundStartScore,
    roundTimer,
    roundNumber,
    poolUp: localPoolUp,
    poolDown: localPoolDown,
    topicId,
    recentResults,
  });
});

// ─── API: Config ─────────────────────────────────────────
app.get("/api/config", (_req, res) => {
  res.json({
    operatorId,
    operatorEvmAddress,
    nrxTokenId: NRX_TOKEN_ID,
    nrxTokenEvm: NRX_TOKEN_EVM,
    fliparenaId: FLIPARENA_ID,
    fliparenaEvm: FLIPARENA_EVM,
    wcProjectId: process.env.WC_PROJECT_ID || "",
    topicId,
  });
});

// ─── Start ───────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

async function main() {
  await prisma.$connect();
  console.log("  DB connected (SQLite)");

  await initOracle();
  startOracle();
  startSettlementLoop();

  httpServer.listen(PORT, () => {
    console.log(`\n⚡ Narrix Relayer running on http://localhost:${PORT}`);
    console.log(`  Contract:   ${FLIPARENA_ID}`);
    console.log(`  NRX Token:  ${NRX_TOKEN_ID}`);
    console.log(`  HCS Topic:  ${topicId}`);
    console.log(`  Operator:   ${operatorId} (${operatorEvmAddress})`);
    console.log(`  Socket.io:  enabled`);
    console.log(`  Database:   SQLite (prisma/dev.db)`);
    console.log(`  Settlement: every ${ROUND_DURATION}s\n`);
  });
}

main().catch(console.error);
