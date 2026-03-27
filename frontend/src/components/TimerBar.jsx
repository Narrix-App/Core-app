export default function TimerBar({ roundTimer, roundNumber, score, scoreDelta }) {
  const pct = (roundTimer / 30) * 100;
  const urgent = roundTimer <= 5;

  return (
    <div className="flex items-center gap-3 px-1 mb-3">
      <span className="text-[11px] text-[var(--color-muted)] tracking-wider">R{roundNumber}</span>

      <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: pct + "%",
            background: urgent
              ? "linear-gradient(90deg, #ff4466, #ff6688)"
              : "linear-gradient(90deg, #00ff88, #00ccff)",
          }}
        />
      </div>

      <span className={`text-lg font-black tabular-nums min-w-[32px] text-right ${urgent ? "text-[var(--color-down)] animate-pulse" : "text-white"}`}>
        {roundTimer}
      </span>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black tabular-nums text-white">{score}</span>
        <span className={`text-sm font-bold ${scoreDelta >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}`}>
          {scoreDelta >= 0 ? "+" : ""}{scoreDelta}
        </span>
      </div>
    </div>
  );
}
