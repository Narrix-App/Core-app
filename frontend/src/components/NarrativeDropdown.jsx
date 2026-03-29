import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

export default function NarrativeDropdown({ activeTag, onSwitch }) {
  const [narratives, setNarratives] = useState([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef(null);

  // Fetch available narratives
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/narratives");
        const data = await res.json();
        if (mounted) setNarratives(data.narratives || []);
      } catch { /* silent */ }
    };
    load();
    const id = setInterval(load, 15000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Click-outside-to-close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = async (tag) => {
    if (tag === activeTag || switching) return;
    setSwitching(true);
    setOpen(false);

    try {
      const res = await fetch("/api/set-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative: tag }),
      });
      const data = await res.json();
      if (data.success && onSwitch) onSwitch(tag);
    } catch { /* silent */ }
    setSwitching(false);
  };

  const active = narratives.find((n) => n.tag === activeTag);
  const label = active?.label || activeTag || "...";

  return (
    <div className="relative" ref={ref}>
      {/* Sleek trading-pair selector style */}
      <button
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-xs font-bold font-mono min-w-[120px] hover:bg-white/[0.04]"
        style={{ border: '1px solid rgba(240,255,0,0.1)' }}
      >
        <span className="text-[var(--color-accent)] truncate uppercase tracking-wider">
          {switching ? "..." : label}
        </span>
        <ChevronDown className={`w-3 h-3 text-[var(--color-accent)]/50 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-60 glass-card border border-white/[0.06] shadow-2xl z-50 py-1 max-h-[320px] overflow-y-auto" style={{ background: '#0a0a0a' }}>
          {narratives.map((n) => (
            <button
              key={n.tag}
              onClick={() => handleSelect(n.tag)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-white/[0.04] transition-colors ${
                n.tag === activeTag ? "bg-[var(--color-accent)]/[0.06]" : ""
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: n.tag === activeTag ? '#F0FF00' : (n.color || '#555') }} />
              <span className={`flex-1 font-medium truncate ${n.tag === activeTag ? "text-[var(--color-accent)]" : "text-gray-400"}`}>
                {n.label}
              </span>
              <span className="text-[10px] text-[var(--color-muted)] tabular-nums font-mono shrink-0">
                ${(n.volume / 1e6).toFixed(0)}M
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
