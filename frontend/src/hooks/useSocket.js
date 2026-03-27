import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

export function useSocket() {
  const socketRef = useRef(null);
  const [globalBets, setGlobalBets] = useState([]);
  const [lastSettlement, setLastSettlement] = useState(null);

  useEffect(() => {
    const socket = io(window.location.hostname + ":3001", { transports: ["websocket", "polling"] });
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

  return { globalBets, lastSettlement, addOptimisticBet };
}
