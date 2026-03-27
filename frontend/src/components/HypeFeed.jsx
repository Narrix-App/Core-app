import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Trophy } from "lucide-react";

function truncId(id) {
  if (!id) return "???";
  const parts = id.split(".");
  const num = parts[2] || id;
  return num.length > 6 ? `0.0.${num.slice(0, 2)}...${num.slice(-3)}` : id;
}

export default function HypeFeed({ globalBets }) {
  const [tab, setTab] = useState("feed"); // feed | leaders
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    if (tab !== "leaders") return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();
        if (active) setLeaders(data);
      } catch { /* silent */ }
    };
    load();
    const id = setInterval(load, 10000);
    return () => { active = false; clearInterval(id); };
  }, [tab]);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)]">
        <button
          onClick={() => setTab("feed")}
          className={`flex-1 py-2.5 text-[11px] font-bold tracking-wider flex items-center justify-center gap-1.5 transition-colors ${
            tab === "feed" ? "text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]" : "text-[var(--color-muted)] hover:text-white"
          }`}
        >
          <Activity className="w-3 h-3" /> LIVE
        </button>
        <button
          onClick={() => setTab("leaders")}
          className={`flex-1 py-2.5 text-[11px] font-bold tracking-wider flex items-center justify-center gap-1.5 transition-colors ${
            tab === "leaders" ? "text-[var(--color-gold)] border-b-2 border-[var(--color-gold)]" : "text-[var(--color-muted)] hover:text-white"
          }`}
        >
          <Trophy className="w-3 h-3" /> TOP 10
        </button>
      </div>

      {/* Feed */}
      {tab === "feed" && (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <AnimatePresence initial={false}>
            {globalBets.map((bet, i) => (
              <motion.div
                key={bet.id || `local-${bet.timestamp}-${i}`}
                initial={{ opacity: 0, x: -30, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--color-card)]/50 text-[11px]"
              >
                <span className={`font-bold ${bet.direction === "UP" || bet.direction === 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}`}>
                  {bet.direction === 0 ? "UP" : bet.direction === 1 ? "DOWN" : bet.direction}
                </span>
                <span className="text-[var(--color-muted)] flex-1 truncate">{truncId(bet.accountId)}</span>
                <span className="font-bold tabular-nums text-white">{bet.amount}</span>
                <span className="text-[var(--color-muted)] text-[10px]">NRX</span>
              </motion.div>
            ))}
          </AnimatePresence>
          {globalBets.length === 0 && (
            <div className="text-center text-[var(--color-muted)] text-[11px] mt-8">
              Waiting for bets...
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {tab === "leaders" && (
        <div className="flex-1 overflow-y-auto p-2">
          {leaders.map((l, i) => (
            <div key={l.accountId} className="flex items-center gap-2 px-2.5 py-2 border-b border-[var(--color-border)]/30 text-[11px]">
              <span className={`w-5 text-center font-black ${i === 0 ? "text-[var(--color-gold)]" : i < 3 ? "text-white" : "text-[var(--color-muted)]"}`}>
                {i + 1}
              </span>
              <span className="flex-1 truncate">{truncId(l.accountId)}</span>
              <span className="font-bold tabular-nums text-[var(--color-up)]">
                +{l.totalPnl.toLocaleString()}
              </span>
              <span className="text-[var(--color-muted)] text-[10px]">{l.wins}W</span>
            </div>
          ))}
          {leaders.length === 0 && (
            <div className="text-center text-[var(--color-muted)] text-[11px] mt-8">
              No winners today yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
