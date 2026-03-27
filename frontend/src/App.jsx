import { useState, useEffect, useCallback, useRef } from "react";
import { WalletProvider, useWallet } from "./context/WalletContext";
import { useSocket } from "./hooks/useSocket";
import { useGameState } from "./hooks/useGameState";
import { useBalance } from "./hooks/useBalance";
import PulseChart from "./components/PulseChart";
import TimerBar from "./components/TimerBar";
import HistoryTable from "./components/HistoryTable";
import CommandCenter from "./components/CommandCenter";
import HypeFeed from "./components/HypeFeed";
import { Zap } from "lucide-react";

function Terminal() {
  const wallet = useWallet();
  const game = useGameState();
  const { globalBets, lastSettlement, addOptimisticBet } = useSocket();
  const { balance, displayBalance, refresh: refreshBalance } = useBalance(
    wallet.accountId,
    null // set after config loads
  );

  const [config, setConfig] = useState(null);
  const [entryScore, setEntryScore] = useState(null);
  const [entryDirection, setEntryDirection] = useState(null);

  // Fetch config
  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setConfig);
  }, []);

  // Load balance with token ID from config
  const { displayBalance: bal, refresh: refreshBal } = useBalance(
    wallet.accountId,
    config?.nrxTokenId
  );

  // Clear entry on round change
  const prevRound = useRef(game.roundNumber);
  useEffect(() => {
    if (game.roundNumber !== prevRound.current && prevRound.current !== -1) {
      setEntryScore(null);
      setEntryDirection(null);
    }
    prevRound.current = game.roundNumber;
  }, [game.roundNumber]);

  const handleBet = useCallback(async (direction, amount) => {
    if (!wallet.evmAddress || !config) return;

    // Optimistic feed entry
    addOptimisticBet({
      id: `local-${Date.now()}`,
      accountId: wallet.accountId,
      direction: direction === 0 ? "UP" : "DOWN",
      amount,
      timestamp: Date.now(),
    });

    try {
      const res = await fetch("/api/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evmAddress: wallet.evmAddress,
          accountId: wallet.accountId,
          direction,
          amount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEntryScore(data.entryScore);
        setEntryDirection(direction);
        refreshBal();
      }
    } catch { /* handled by UI */ }
  }, [wallet, config, addOptimisticBet, refreshBal]);

  if (!config) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-[var(--color-up)]" />
          <span className="text-sm font-black tracking-[4px] bg-gradient-to-r from-[var(--color-up)] to-[var(--color-accent)] bg-clip-text text-transparent">
            NARRIX
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
          <span>TESTNET</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-up)] shadow-[0_0_4px_var(--color-up)]" />
            LIVE
          </span>
        </div>
      </header>

      {/* 3-Column Grid */}
      <div className="flex-1 grid grid-cols-[280px_1fr_300px] min-h-0">

        {/* Left: Hype Feed */}
        <div className="border-r border-[var(--color-border)] flex flex-col min-h-0">
          <HypeFeed globalBets={globalBets} />
        </div>

        {/* Center: Arena */}
        <div className="flex flex-col p-4 min-h-0">
          <TimerBar
            roundTimer={game.roundTimer}
            roundNumber={game.roundNumber}
            score={game.score}
            scoreDelta={game.scoreDelta}
          />
          <PulseChart
            score={game.score}
            entryScore={entryScore}
            entryDirection={entryDirection}
          />

          {/* Pool Bars */}
          <div className="flex gap-3 mt-3">
            <PoolCard direction="UP" amount={game.poolUp} otherAmount={game.poolDown} />
            <PoolCard direction="DOWN" amount={game.poolDown} otherAmount={game.poolUp} />
          </div>

          <HistoryTable accountId={wallet.accountId} />
        </div>

        {/* Right: Command Center */}
        <div className="border-l border-[var(--color-border)] flex flex-col min-h-0">
          <CommandCenter
            config={config}
            balance={bal}
            displayBalance={bal}
            refreshBalance={refreshBal}
            onBet={handleBet}
            entryDirection={entryDirection}
            lastSettlement={lastSettlement}
            accountId={wallet.accountId}
          />
        </div>
      </div>
    </div>
  );
}

function PoolCard({ direction, amount, otherAmount }) {
  const total = amount + otherAmount;
  const pct = total > 0 ? Math.round((amount / total) * 100) : 50;
  const isUp = direction === "UP";

  return (
    <div className="flex-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 text-center">
      <div className={`text-[11px] font-bold tracking-[3px] ${isUp ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}`}>
        {direction}
      </div>
      <div className="text-xl font-black tabular-nums mt-1">{amount}</div>
      <div className="text-[11px] text-[var(--color-muted)]">{pct}%</div>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then(setConfig);
  }, []);

  if (!config) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0b10]">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <WalletProvider config={config}>
      <Terminal />
    </WalletProvider>
  );
}
