import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";

function hashscanUrl(txId) {
  if (!txId) return null;
  const match = txId.match(/^(\d+\.\d+\.\d+)@(\d+)\.(\d+)$/);
  if (!match) {
    const formatted = txId.replace("@", "-").replace(/\./g, "-");
    return `https://hashscan.io/testnet/transaction/${formatted}`;
  }
  const [, acct, secs, nanos] = match;
  return `https://hashscan.io/testnet/transaction/${acct}-${secs}-${nanos}`;
}

function truncTxId(txId) {
  if (!txId) return "—";
  const match = txId.match(/^(\d+\.\d+\.\d+)@(\d+)\.(\d+)$/);
  if (!match) return txId.slice(0, 12) + "...";
  const [, acct, , nanos] = match;
  const shortAcct = acct.length > 8 ? acct.slice(0, 5) + ".." : acct;
  return `${shortAcct}-${nanos.slice(-3)}`;
}

// ── Onboarding "How to Play" ─────────────────────────────
function OnboardingGuide({ connected }) {
  if (!connected) {
    return (
      <div className="mt-3 flex items-center justify-center p-6 glass-card text-center">
        <span className="text-[12px] text-[var(--color-muted)]">
          Connect your wallet to start playing
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3 p-5 glass-card">
      <div className="text-[10px] uppercase tracking-[3px] text-[var(--color-muted)] mb-4 text-center">How to Play</div>
      <div className="flex justify-around text-[var(--color-muted)] text-[11px]">
        <div className="flex flex-col items-center text-center gap-1.5 max-w-[120px]">
          <span className="text-xl">&#x1FA99;</span>
          <span className="text-white font-bold text-[12px]">1. Get Funded</span>
          <span>Connect wallet & hit +GET NRX</span>
        </div>
        <div className="flex flex-col items-center text-center gap-1.5 max-w-[120px]">
          <span className="text-xl">&#x1F3AF;</span>
          <span className="text-white font-bold text-[12px]">2. Lock Entry</span>
          <span>Pick an amount and SMASH UP or DOWN</span>
        </div>
        <div className="flex flex-col items-center text-center gap-1.5 max-w-[120px]">
          <span className="text-xl">&#x23F1;</span>
          <span className="text-white font-bold text-[12px]">3. Survive 30s</span>
          <span>If the pulse finishes your way, you take the pool</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────
export default function HistoryTable({ accountId }) {
  const [bets, setBets] = useState([]);

  useEffect(() => {
    if (!accountId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/history/${accountId}`);
        const data = await res.json();
        if (active) setBets(data);
      } catch { /* silent */ }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { active = false; clearInterval(id); };
  }, [accountId]);

  // Empty state: show onboarding guide
  if (!accountId || bets.length === 0) {
    return <OnboardingGuide connected={!!accountId} />;
  }

  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-[3px] text-[var(--color-muted)] mb-2">My History</div>
      <div className="max-h-[160px] overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-[var(--color-muted)]" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <th className="text-left py-1 font-medium">Round</th>
              <th className="text-left py-1 font-medium">Side</th>
              <th className="text-right py-1 font-medium">Amount</th>
              <th className="text-right py-1 font-medium">PnL</th>
              <th className="text-right py-1 font-medium">Txn</th>
            </tr>
          </thead>
          <tbody>
            {bets.slice(0, 20).map((b) => {
              const url = hashscanUrl(b.txId);
              const isFaucet = b.status === "faucet" || b.direction === -1;

              return (
                <tr key={b.id} className="hover:bg-white/[0.02]" style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td className="py-1.5 tabular-nums font-mono">
                    {isFaucet ? <span className="text-[var(--color-accent)]">FAUCET</span> : `#${b.roundNumber}`}
                  </td>
                  <td className={`py-1.5 font-bold ${
                    isFaucet ? "text-[var(--color-accent)]"
                      : b.direction === 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"
                  }`}>
                    {isFaucet ? "+NRX" : b.direction === 0 ? "UP" : "DOWN"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-mono">{b.amount}</td>
                  <td className={`py-1.5 text-right font-bold tabular-nums font-mono ${
                    isFaucet ? "text-[var(--color-accent)]"
                      : b.status === "pending" ? "text-[var(--color-muted)]"
                      : (b.pnl ?? 0) >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"
                  }`}>
                    {isFaucet ? "+1,000" : b.status === "pending" ? "..." : ((b.pnl ?? 0) >= 0 ? "+" : "") + (b.pnl ?? 0).toFixed(0)}
                  </td>
                  <td className="py-1.5 text-right">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-accent)] hover:text-white transition-colors inline-flex items-center gap-0.5 font-mono"
                        title={b.txId}
                      >
                        {truncTxId(b.txId)}
                        <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                      </a>
                    ) : (
                      <span className="text-[var(--color-muted)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
