import { useRef, useEffect, useCallback } from "react";
import { createChart, ColorType, LineStyle, LineSeries } from "lightweight-charts";

export default function PulseChart({ score, entryScore, entryDirection }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLineRef = useRef(null);
  const prevScoreRef = useRef(null);

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#0c0c14" }, textColor: "#444", fontFamily: "monospace", fontSize: 10 },
      grid: { vertLines: { color: "rgba(255,255,255,0.02)" }, horzLines: { color: "rgba(255,255,255,0.02)" } },
      crosshair: { horzLine: { color: "rgba(0,204,255,0.2)", labelBackgroundColor: "#111" }, vertLine: { color: "rgba(0,204,255,0.2)", labelBackgroundColor: "#111" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.05)", scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderColor: "rgba(255,255,255,0.05)", timeVisible: true, secondsVisible: true, rightOffset: 5 },
      handleScale: false, handleScroll: false,
    });

    const series = chart.addSeries(LineSeries, {
      color: "#00ccff", lineWidth: 2,
      crosshairMarkerRadius: 3, crosshairMarkerBackgroundColor: "#00ccff",
      priceLineVisible: false, lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current.clientWidth }));
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  // Push score
  useEffect(() => {
    if (!seriesRef.current || score === prevScoreRef.current) return;
    prevScoreRef.current = score;
    seriesRef.current.update({ time: Math.floor(Date.now() / 1000), value: score });
    chartRef.current?.timeScale().scrollToRealTime();
  }, [score]);

  // Entry price line
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Clear old
    if (priceLineRef.current) {
      series.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }

    // Draw new
    if (entryScore != null && entryDirection != null) {
      const color = entryDirection === 0 ? "#00ff88" : "#ff4466";
      priceLineRef.current = series.createPriceLine({
        price: entryScore, color, lineWidth: 2, lineStyle: LineStyle.Solid,
        axisLabelVisible: true, axisLabelColor: color, axisLabelTextColor: "#000",
        title: entryDirection === 0 ? "ENTRY (UP)" : "ENTRY (DOWN)",
      });
    }
  }, [entryScore, entryDirection]);

  return <div ref={containerRef} className="w-full h-[280px] rounded-xl border border-[var(--color-border)] overflow-hidden" />;
}
