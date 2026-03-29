import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

export function useSocket() {
  const socketRef = useRef(null);
  const [globalBets, setGlobalBets] = useState([]);
  const [lastSettlement, setLastSettlement] = useState(null);

  useEffect(() => {
    // CRIT-2 partial fix: use relative URL so proxies work
    const socket = io("/", { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("global_bet", (bet) => {
      setGlobalBets((prev) => [bet, ...prev].slice(0, 50));
    });

    socket.on("round_settled", (result) => {
      setLastSettlement(result);
    });

    return () => socket.disconnect();
  }, []);

  const addOptimisticBet = useCallback((bet) => {
    setGlobalBets((prev) => [bet, ...prev].slice(0, 50));
  }, []);

  // CRIT-4: Remove an optimistic bet on failure
  const removeOptimisticBet = useCallback((id) => {
    setGlobalBets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return { globalBets, lastSettlement, addOptimisticBet, removeOptimisticBet };
}
