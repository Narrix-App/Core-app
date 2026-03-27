-- CreateTable
CREATE TABLE "Bet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roundNumber" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "evmAddress" TEXT NOT NULL,
    "direction" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "entryScore" INTEGER NOT NULL,
    "exitScore" INTEGER,
    "pnl" REAL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "txId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Bet_roundNumber_status_idx" ON "Bet"("roundNumber", "status");

-- CreateIndex
CREATE INDEX "Bet_accountId_createdAt_idx" ON "Bet"("accountId", "createdAt");
