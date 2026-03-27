import { useState, useEffect, useRef } from "react";

export function useGameState() {
  const [state, setState] = useState({
    score: 0, roundStartScore: 0, scoreDelta: 0,
    roundTimer: 30, roundNumber: -1,
    poolUp: 0, poolDown: 0, recentResults: [],
  });
  const prevRound = useRef(-1);
  const [roundChanged, setRoundChanged] = useState(false);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/state");
        const s = await res.json();
        if (!active) return;

        if (s.roundNumber !== prevRound.current && prevRound.current !== -1) {
          setRoundChanged(true);
          setTimeout(() => setRoundChanged(false), 100);
        }
        prevRound.current = s.roundNumber;
        setState(s);
      } catch { /* silent */ }
    };

    poll();
    const id = setInterval(poll, 1000);
    return () => { active = false; clearInterval(id); };
  }, []);

  return { ...state, roundChanged };
}
