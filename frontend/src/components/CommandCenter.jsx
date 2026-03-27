import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Zap, TrendingUp, TrendingDown, LogOut, Plus, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";
import { useWallet } from "../context/WalletContext";

const CHIPS = [100, 500, 1000, 5000];

function truncId(id) {
  if (!id) return "";
  const parts = id.split(".");
  const num = parts[2] || id;
  return num.length > 6 ? `0.0.${num.slice(0, 2)}...${num.slice(-3)}` : id;
}

export default function CommandCenter({ config, balance, displayBalance, refreshBalance, onBet, entryDirection, lastSettlement, accountId }) {
  const wallet = useWallet();
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [chip, setChip] = useState(500);
  const [betting, setBetting] = useState(false);
  const [outcome, setOutcome] = useState(null); // { type: "win"|"lose", amount }

  const hasPosition = entryDirection != null;

  // Handle settlement effects
  useEffect(() => {
    if (!lastSettlement || !accountId) return;

    const myBet = lastSettlement.settledBets.find((b) => b.accountId === accountId);
    if (!myBet) return;

    const won = myBet.status === "won";
    setOutcome({ type: won ? "win" : "lose", pnl: myBet.pnl });

    if (won) fireWinConfetti();
    else fireLoseConfetti();

    refreshBalance();
    setTimeout(() => setOutcome(null), 3000);
  }, [lastSettlement, accountId, refreshBalance]);

  const handleFaucet = useCallback(async () => {
    if (faucetLoading || !wallet.accountId) return;
    setFaucetLoading(true);
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: wallet.accountId }),
      });
      const data = await res.json();

      if (data.code === "TOKEN_NOT_ASSOCIATED") {
        // Trigger association via HashConnect then retry
        await wallet.runSetup();
        setFaucetLoading(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Faucet failed");

      // Wait for Mirror Node to reflect, then refresh balance
      await new Promise((r) => setTimeout(r, 3000));
      refreshBalance();
    } catch (err) {
      console.error("Faucet error:", err);
    } finally {
      setFaucetLoading(false);
    }
  }, [faucetLoading, wallet, refreshBalance]);

  const handleBet = useCallback(async (direction) => {
    if (betting || hasPosition) return;
    setBetting(true);
    await onBet(direction, chip);
    setBetting(false);
  }, [betting, hasPosition, chip, onBet]);

  // ── Disconnected / Setup states ──
  if (wallet.status === "disconnected") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <Wallet className="w-10 h-10 text-[var(--color-accent)]" />
        <button onClick={wallet.connect} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold text-sm tracking-wide hover:shadow-[0_0_20px_rgba(155,89,255,0.4)] transition-all active:scale-95">
          Connect HashPack
        </button>
        <span className="text-[10px] text-[var(--color-muted)]">Hedera Testnet</span>
      </div>
    );
  }

  if (wallet.status === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-[var(--color-muted)]">Pairing with HashPack...</span>
      </div>
    );
  }

  if (wallet.status === "setup") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <div className="text-sm font-bold">Wallet Connected</div>
        <div className="text-[11px] text-[var(--color-accent)]">{truncId(wallet.accountId)}</div>
        <button onClick={wallet.runSetup} className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--color-up)] to-[var(--color-accent)] text-black font-bold text-sm tracking-wide hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all active:scale-95">
          Set Up Account
        </button>
        <span className="text-[10px] text-[var(--color-muted)]">Associate token + approve betting</span>
      </div>
    );
  }

  // ── Ready state: full command center ──
  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Profile */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
            {(wallet.accountId || "").slice(-2)}
          </div>
          <div>
            <div className="text-[11px] font-bold">{truncId(wallet.accountId)}</div>
            <div className="text-[10px] text-[var(--color-muted)]">Testnet</div>
          </div>
        </div>
        <button onClick={wallet.disconnect} className="text-[var(--color-muted)] hover:text-white transition-colors">
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Balance + Faucet */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] uppercase tracking-[3px] text-[var(--color-muted)]">Balance</div>
          <button
            onClick={handleFaucet}
            disabled={faucetLoading}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-all disabled:opacity-40"
            title="Get 1,000 test NRX"
          >
            {faucetLoading
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Plus className="w-3 h-3" />}
            GET NRX
          </button>
        </div>
        <div className="text-center">
          <motion.div
            key={Math.round(displayBalance)}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 0.3 }}
            className="text-3xl font-black tabular-nums text-white"
          >
            {displayBalance.toLocaleString()} <span className="text-sm text-[var(--color-accent)]">NRX</span>
          </motion.div>
        </div>
      </div>

      {/* Quick Bet Chips */}
      <div>
        <div className="text-[10px] uppercase tracking-[3px] text-[var(--color-muted)] mb-2">Bet Amount</div>
        <div className="grid grid-cols-4 gap-2">
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={`py-2 rounded-lg text-xs font-bold transition-all ${
                chip === c
                  ? "bg-[var(--color-accent)]/15 border border-[var(--color-accent)] text-[var(--color-accent)]"
                  : "bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50"
              }`}
            >
              {c >= 1000 ? c / 1000 + "K" : c}
            </button>
          ))}
        </div>
      </div>

      {/* SMASH Buttons */}
      <div className="flex flex-col gap-3 mt-auto">
        {hasPosition && (
          <div className={`text-center text-xs font-bold py-2 rounded-lg ${
            entryDirection === 0
              ? "bg-[var(--color-up)]/10 text-[var(--color-up)] border border-[var(--color-up)]/20"
              : "bg-[var(--color-down)]/10 text-[var(--color-down)] border border-[var(--color-down)]/20"
          }`}>
            <Zap className="w-3 h-3 inline mr-1" />
            Position Active — {entryDirection === 0 ? "UP" : "DOWN"}
          </div>
        )}

        <button
          onClick={() => handleBet(0)}
          disabled={betting || hasPosition}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-green-600 to-[var(--color-up)] text-black font-black text-base tracking-wider flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_30px_rgba(0,255,136,0.3)] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          <TrendingUp className="w-5 h-5" /> SMASH UP
        </button>

        <button
          onClick={() => handleBet(1)}
          disabled={betting || hasPosition}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-red-700 to-[var(--color-down)] text-white font-black text-base tracking-wider flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_30px_rgba(255,68,102,0.3)] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          <TrendingDown className="w-5 h-5" /> SMASH DOWN
        </button>
      </div>

      {/* Outcome Overlay */}
      <AnimatePresence>
        {outcome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -30 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className={`text-6xl md:text-8xl font-black ${
              outcome.type === "win" ? "text-[var(--color-up)]" : "text-[var(--color-down)]"
            }`} style={{ textShadow: `0 0 60px currentColor` }}>
              {outcome.type === "win"
                ? `+${Math.round(outcome.pnl)} NRX`
                : "REKT"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function fireWinConfetti() {
  const colors = ["#00ff88", "#00cc6a", "#FFD700", "#FFC107"];
  const opts = { startVelocity: 45, spread: 80, ticks: 120, zIndex: 300 };
  confetti({ ...opts, particleCount: 80, origin: { x: 0.1, y: 1 }, colors, angle: 60 });
  confetti({ ...opts, particleCount: 80, origin: { x: 0.9, y: 1 }, colors, angle: 120 });
  setTimeout(() => {
    confetti({ ...opts, particleCount: 50, origin: { x: 0.4, y: 1 }, colors, angle: 75, startVelocity: 35 });
    confetti({ ...opts, particleCount: 50, origin: { x: 0.6, y: 1 }, colors, angle: 105, startVelocity: 35 });
  }, 300);
}

function fireLoseConfetti() {
  confetti({
    particleCount: 60, origin: { x: 0.5, y: 0 },
    colors: ["#ff4466", "#cc3355", "#333", "#1a1a1a"],
    spread: 120, startVelocity: 15, gravity: 0.6, ticks: 150, zIndex: 300, scalar: 1.2,
  });
}
