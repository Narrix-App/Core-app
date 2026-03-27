import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";

// Convert Hedera txId "0.0.xxxx@1234567.890" → HashScan URL
function hashscanUrl(txId) {
  if (!txId) return null;
  // Format: "0.0.xxxx@seconds.nanos" → "0.0.xxxx-seconds-nanos"
  const formatted = txId.replace("@", "-").replace(/\./g, "-");
  // But account ID dots need to stay → re-insert: "0.0.xxxx" part
  // txId format: "0.0.ACCOUNT@SECS.NANOS"
  const match = txId.match(/^(\d+\.\d+\.\d+)@(\d+)\.(\d+)$/);
  if (!match) return `https://hashscan.io/testnet/transaction/${formatted}`;
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

  if (!accountId) return null;

  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-[3px] text-[var(--color-muted)] mb-2">My History</div>
      <div className="max-h-[160px] overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-[var(--color-muted)] border-b border-[var(--color-border)]">
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
                <tr key={b.id} className="border-b border-[var(--color-border)]/30 hover:bg-white/[0.02]">
                  <td className="py-1.5 tabular-nums">
                    {isFaucet ? <span className="text-[var(--color-gold)]">FAUCET</span> : `#${b.roundNumber}`}
                  </td>
                  <td className={`py-1.5 font-bold ${
                    isFaucet ? "text-[var(--color-gold)]"
                      : b.direction === 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"
                  }`}>
                    {isFaucet ? "+NRX" : b.direction === 0 ? "UP" : "DOWN"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{b.amount}</td>
                  <td className={`py-1.5 text-right font-bold tabular-nums ${
                    isFaucet ? "text-[var(--color-gold)]"
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
                        className="text-[var(--color-accent)] hover:text-white transition-colors inline-flex items-center gap-0.5"
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
            {bets.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-[var(--color-muted)]">No bets yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
