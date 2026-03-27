import { useState, useEffect, useCallback, useRef } from "react";

const MIRROR = "https://testnet.mirrornode.hedera.com";

export function useBalance(accountId, tokenId) {
  const [balance, setBalance] = useState(0);
  const [displayBalance, setDisplayBalance] = useState(0);
  const animRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!accountId || !tokenId) return;
    try {
      const res = await fetch(`${MIRROR}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`);
      const data = await res.json();
      if (data.tokens?.length) {
        setBalance(parseInt(data.tokens[0].balance) / 100);
      }
    } catch { /* silent */ }
  }, [accountId, tokenId]);

  // Animated count-up/down
  useEffect(() => {
    if (displayBalance === balance) return;
    const start = displayBalance;
    const diff = balance - start;
    const duration = 600;
    const t0 = performance.now();

    const frame = (now) => {
      const elapsed = now - t0;
      const pct = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - pct, 3); // ease-out cubic
      setDisplayBalance(Math.round((start + diff * eased) * 100) / 100);
      if (pct < 1) animRef.current = requestAnimationFrame(frame);
    };
    animRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animRef.current);
  }, [balance]);

  useEffect(() => { refresh(); const id = setInterval(refresh, 8000); return () => clearInterval(id); }, [refresh]);

  return { balance, displayBalance, refresh };
}
