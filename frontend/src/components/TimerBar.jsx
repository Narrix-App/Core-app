export default function TimerBar({ roundTimer, roundNumber, score, scoreDelta, narrative }) {
  const pct = (roundTimer / 30) * 100;
  const urgent = roundTimer <= 5;

  const loading = score === 0 || roundNumber < 0;
  const displayPrice = loading ? "—" : (score / 100).toFixed(2);
  const displayDelta = loading ? "" : ((scoreDelta / 100) >= 0 ? "+" : "") + (scoreDelta / 100).toFixed(2);
  const roundLabel = loading ? "—" : `R${roundNumber}`;

  return (
    <div className="flex items-center gap-3 px-1 mb-3">
      <span className="text-[11px] text-[var(--color-muted)] tracking-wider font-mono">{roundLabel}</span>

      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: (loading ? 100 : pct) + "%",
            background: loading
              ? "rgba(255,255,255,0.05)"
              : urgent
              ? "linear-gradient(90deg, #ff4466, #ff6688)"
              : "linear-gradient(90deg, #F0FF00, #c8d900)",
            boxShadow: !loading && !urgent ? '0 0 10px rgba(240,255,0,0.5)' : undefined,
          }}
        />
      </div>

      <span className={`text-lg font-black tabular-nums font-mono min-w-[32px] text-right ${
        loading ? "text-[var(--color-muted)]" : urgent ? "text-[var(--color-down)] animate-pulse" : "text-white"
      }`}>
        {loading ? "—" : roundTimer}
      </span>

      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-black tabular-nums font-mono ${loading ? "text-[var(--color-muted)] animate-pulse" : "text-white"}`}>
          {displayPrice}
        </span>
        {!loading && (
          <span className={`text-sm font-bold font-mono ${scoreDelta >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}`}>
            {displayDelta}
          </span>
        )}
        {narrative?.label && narrative.label !== "—" && (
          <span className="text-[10px] text-[var(--color-muted)] tracking-wider uppercase ml-1">{narrative.label}</span>
        )}
      </div>
    </div>
  );
}
