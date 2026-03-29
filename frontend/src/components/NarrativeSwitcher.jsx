import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export default function NarrativeSwitcher({ onSwitch }) {
  const [narratives, setNarratives] = useState([]);
  const [active, setActive] = useState("");
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/narratives");
        const data = await res.json();
        if (mounted) {
          setNarratives(data.narratives || []);
          setActive(data.active || "");
        }
      } catch { /* silent */ }
    };
    load();
    const id = setInterval(load, 10000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const handleSelect = async (tag) => {
    if (tag === active || switching) return;
    setSwitching(true);
    setOpen(false);

    try {
      const res = await fetch("/api/set-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative: tag }),
      });
      const data = await res.json();
      if (data.success) {
        setActive(tag);
        if (onSwitch) onSwitch(tag);
      }
    } catch { /* silent */ }
    setSwitching(false);
  };

  const activeNarrative = narratives.find((n) => n.tag === active);
  const label = activeNarrative?.label || active || "Loading...";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 transition-all text-xs font-bold"
      >
        {activeNarrative && (
          <span className="w-2 h-2 rounded-full" style={{ background: activeNarrative.color }} />
        )}
        <span className="text-white">{label}</span>
        <ChevronDown className={`w-3 h-3 text-[var(--color-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-2xl z-50 py-1 max-h-[300px] overflow-y-auto">
          {narratives.map((n) => (
            <button
              key={n.tag}
              onClick={() => handleSelect(n.tag)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/[0.04] transition-colors ${
                n.tag === active ? "bg-white/[0.06]" : ""
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: n.color }} />
              <span className={`flex-1 font-medium ${n.tag === active ? "text-white" : "text-gray-400"}`}>
                {n.label}
              </span>
              <span className="text-[10px] text-[var(--color-muted)] tabular-nums">
                ${(n.volume / 1e6).toFixed(0)}M
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
