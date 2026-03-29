import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WalletProvider, useWallet } from "./context/WalletContext";
import { useSocket } from "./hooks/useSocket";
import { useGameState } from "./hooks/useGameState";
import { useBalance } from "./hooks/useBalance";
import PulseChart from "./components/PulseChart";
import TimerBar from "./components/TimerBar";
import HistoryTable from "./components/HistoryTable";
import CommandCenter from "./components/CommandCenter";
import NarrativeDropdown from "./components/NarrativeDropdown";

// ── Toast ────────────────────────────────────────────────
function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`fixed top-4 right-4 z-[200] px-4 py-2.5 rounded-lg text-sm font-bold shadow-xl backdrop-blur-md ${
        type === "error"
          ? "bg-[var(--color-down)]/15 border border-[var(--color-down)]/30 text-[var(--color-down)]"
          : "bg-[var(--color-up)]/15 border border-[var(--color-up)]/30 text-[var(--color-up)]"
      }`}
    >
      {message}
    </motion.div>
  );
}

function Terminal({ config }) {
  const wallet = useWallet();
  const game = useGameState();
  const { globalBets, lastSettlement, addOptimisticBet, removeOptimisticBet } = useSocket();
  const { displayBalance: bal = 0, refresh: refreshBal } = useBalance(
    wallet.accountId,
    config?.nrxTokenId
  );

  const [entryScore, setEntryScore] = useState(null);
  const [entryDirection, setEntryDirection] = useState(null);
  const [toast, setToast] = useState(null);
  const [narrativeTag, setNarrativeTag] = useState(null);

  // Track narrative from server
  useEffect(() => {
    if (game.narrative?.tag && !narrativeTag) setNarrativeTag(game.narrative.tag);
  }, [game.narrative?.tag, narrativeTag]);

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

    const optimisticId = `local-${Date.now()}`;
    addOptimisticBet({
      id: optimisticId,
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
      } else {
        removeOptimisticBet(optimisticId);
        setToast({ message: `Bet failed: ${data.error || "Unknown error"}`, type: "error" });
      }
    } catch (err) {
      removeOptimisticBet(optimisticId);
      setToast({ message: `Network error: ${err.message || "Could not reach server"}`, type: "error" });
    }
  }, [wallet, config, addOptimisticBet, removeOptimisticBet, refreshBal]);

  const handleNarrativeSwitch = useCallback((tag) => {
    setNarrativeTag(tag);
    setEntryScore(null);
    setEntryDirection(null);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--color-bg)" }}>
      <AnimatePresence>
        {toast && <Toast key={toast.message} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(240,255,0,0.06)' }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <img src="/narrix-eye.png" alt="Narrix" className="w-7 h-7 object-contain" style={{ filter: 'drop-shadow(0 0 8px rgba(240,255,0,0.4))' }} />
            <div>
              <span className="text-sm font-black tracking-[4px] text-[var(--color-accent)]" style={{ textShadow: '0 0 20px rgba(240,255,0,0.3)' }}>
                NARRIX
              </span>
              <div className="text-[11px] text-slate-400 mt-0.5 tracking-wide">
                Predict real-time sentiment shifts. 30s rounds. Winner takes the pool.
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <NarrativeDropdown activeTag={narrativeTag} onSwitch={handleNarrativeSwitch} />
          <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
            <span className="font-mono">TESTNET</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_6px_var(--color-accent)]" />
              LIVE
            </span>
          </div>
        </div>
      </header>

      {/* ── 2-Column Cinematic Grid ── */}
      <div className="flex-1 grid grid-cols-[1fr_360px] min-h-0 overflow-hidden">

        {/* Left Column: The Arena */}
        <div className="flex flex-col p-4 gap-3 min-h-0 min-w-0">
          <TimerBar
            roundTimer={game.roundTimer}
            roundNumber={game.roundNumber}
            score={game.score}
            scoreDelta={game.scoreDelta}
            narrative={game.narrative}
          />

          {/* Chart: expands to fill the arena */}
          <PulseChart
            score={game.score}
            entryScore={entryScore}
            entryDirection={entryDirection}
            narrativeDirection={game.narrative?.direction}
            narrativeTag={narrativeTag}
          />

          {/* Oracle Sources: Drivers */}
          {game.narrative?.topMarkets?.length > 0 && (
            <div className="flex flex-col gap-2 px-1 overflow-hidden min-w-0">
              <span className="text-xs text-slate-500 tracking-widest uppercase">⚡ ORACLE SOURCES: Aggregating live sentiment from the following prediction markets:</span>
              <div className="flex gap-2 overflow-x-auto min-w-0">
                {game.narrative.topMarkets.map((m, i) => (
                  <span key={i} className="whitespace-nowrap bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1 text-[10px] text-slate-400">
                    {m.length > 55 ? m.slice(0, 52) + "..." : m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Betting Prompt */}
          <div className="text-center text-sm text-slate-300 font-bold tracking-widest uppercase mt-1">
            PREDICT THE 30-SECOND TREND
          </div>

          {/* Pool Cards */}
          <div className="flex gap-3">
            <PoolCard direction="UP" amount={game.poolUp} otherAmount={game.poolDown} />
            <PoolCard direction="DOWN" amount={game.poolDown} otherAmount={game.poolUp} />
          </div>

          {/* Institutional Footer */}
          {game.narrative?.volume > 0 && (
            <div className="flex items-center justify-center gap-4 text-[10px] text-[var(--color-muted)] tracking-wider uppercase font-mono">
              <span>24H Pulse Volume: <span className="text-[var(--color-accent)] font-bold font-mono">${(game.narrative.volume / 1e6).toFixed(1)}M</span></span>
              <span className="opacity-20">│</span>
              <span>Narrative: <span className={`font-bold ${game.narrative.direction === "heating" ? "text-[var(--color-down)]" : game.narrative.direction === "cooling" ? "text-[var(--color-accent)]" : "text-white"}`}>{game.narrative.label}</span></span>
              <span className="opacity-20">│</span>
              <span className={`font-bold ${game.narrative.direction === "heating" ? "text-[var(--color-down)]" : "text-[var(--color-accent)]"}`}>
                {game.narrative.direction === "heating" ? "HEATING" : game.narrative.direction === "cooling" ? "COOLING" : "STABLE"}
              </span>
            </div>
          )}
        </div>

        {/* Right Column: The Action Center */}
        <div className="flex flex-col min-h-0 overflow-y-auto bg-[#0A0A0A] border-l border-white/10">
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
          {/* History table moved into the right column */}
          <div className="px-4 pb-4">
            <HistoryTable accountId={wallet.accountId} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pool Card with Dynamic Payout ────────────────────────
function PoolCard({ direction, amount, otherAmount }) {
  const total = amount + otherAmount;
  const isUp = direction === "UP";
  // Dynamic payout: total / side. If side is 0, default to 2.00x
  const multiplier = amount > 0 ? (total / amount) : 2.0;

  return (
    <div className={`flex-1 bg-white/[0.03] border border-white/10 rounded-xl p-6 text-center transition-all duration-200 cursor-default ${isUp ? 'hover:bg-white/[0.05] hover:border-white/20 hover:shadow-[0_0_15px_rgba(0,255,136,0.15)]' : 'hover:bg-white/[0.05] hover:border-white/20 hover:shadow-[0_0_15px_rgba(255,68,102,0.15)]'}`}>
      <div className={`text-xs font-bold tracking-[3px] ${isUp ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}`}>
        {direction}
      </div>
      <div className="text-[10px] text-[var(--color-muted)] mt-1 uppercase tracking-wider">Total Pool</div>
      <div className="text-xl font-black tabular-nums font-mono mt-1">{amount.toLocaleString()} <span className="text-xs text-[var(--color-muted)]">NRX</span></div>
      <div className={`text-3xl font-black mt-2 font-mono ${isUp ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}`} style={{ textShadow: `0 0 20px ${isUp ? 'rgba(0,255,136,0.3)' : 'rgba(255,68,102,0.3)'}` }}>
        {multiplier.toFixed(2)}x
      </div>
      <div className="text-[9px] text-[var(--color-muted)] uppercase tracking-wider mt-0.5">Est. Payout</div>
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
      <div className="h-screen flex items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <WalletProvider config={config}>
      <Terminal config={config} />
    </WalletProvider>
  );
}
