import { useRef, useEffect, useCallback } from "react";
import { createChart, ColorType, LineStyle, LineSeries } from "lightweight-charts";

const SEED_ENDPOINT = "/api/state";
const SEED_POINTS = 60;

// Brand color
const CHART_COLOR = "#F0FF00";
const CHART_COLOR_DIM = "rgba(240,255,0,0.4)";

export default function PulseChart({ score, entryScore, entryDirection, narrativeDirection, narrativeTag }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const priceLineRef = useRef(null);
  const lastTimeRef = useRef(0);
  const seededRef = useRef(false);

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.2)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(240,255,0,0.015)" },
        horzLines: { color: "rgba(240,255,0,0.015)" },
      },
      crosshair: {
        horzLine: { color: "rgba(240,255,0,0.12)", labelBackgroundColor: "#0a0a0a" },
        vertLine: { color: "rgba(240,255,0,0.12)", labelBackgroundColor: "#0a0a0a" },
      },
      rightPriceScale: {
        borderColor: "rgba(240,255,0,0.04)",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "rgba(240,255,0,0.04)",
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 5,
      },
      handleScale: false,
      handleScroll: false,
    });

    const series = chart.addSeries(LineSeries, {
      color: CHART_COLOR,
      lineWidth: 2,
      lineType: 2, // Curved spline
      crosshairMarkerRadius: 4,
      crosshairMarkerBackgroundColor: CHART_COLOR,
      crosshairMarkerBorderColor: CHART_COLOR_DIM,
      crosshairMarkerBorderWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  // Cold-start fix: Brownian bridge historical seed
  const seedChart = useCallback(async () => {
    if (!seriesRef.current) return;
    try {
      const res = await fetch(SEED_ENDPOINT);
      const data = await res.json();
      if (!data.score) return;

      const basePrice = data.score / 100;
      const now = Math.floor(Date.now() / 1000);
      const points = [];

      let walkPrice = basePrice + (Math.random() - 0.5) * 2.0;
      for (let i = SEED_POINTS; i >= 1; i--) {
        const drift = (basePrice - walkPrice) * 0.08;
        const noise = (Math.random() - 0.5) * 1.2;
        walkPrice += drift + noise;
        points.push({ time: now - i, value: walkPrice });
      }

      points.push({ time: now, value: basePrice });

      seriesRef.current.setData(points);
      chartRef.current?.timeScale().fitContent();
      lastTimeRef.current = now;
      seededRef.current = true;
    } catch {
      // Seed failed — live data will populate naturally
    }
  }, [narrativeTag]);

  // Seed on mount and when narrative switches
  useEffect(() => {
    seededRef.current = false;
    lastTimeRef.current = 0;
    if (seriesRef.current) {
      seriesRef.current.setData([]);
    }
    seedChart();
  }, [narrativeTag, seedChart]);

  // Push live score every poll tick
  useEffect(() => {
    if (!seriesRef.current || score === 0) return;

    const displayPrice = score / 100;
    const now = Math.floor(Date.now() / 1000);
    const time = now > lastTimeRef.current ? now : lastTimeRef.current + 1;
    lastTimeRef.current = time;

    seriesRef.current.update({ time, value: displayPrice });
    chartRef.current?.timeScale().scrollToRealTime();
  }, [score]);

  // Entry price line
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (priceLineRef.current) {
      series.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }

    if (entryScore != null && entryDirection != null) {
      const displayEntry = entryScore / 100;
      const color = entryDirection === 0 ? "#00ff88" : "#ff4466";
      priceLineRef.current = series.createPriceLine({
        price: displayEntry, color, lineWidth: 2, lineStyle: LineStyle.Solid,
        axisLabelVisible: true, axisLabelColor: color, axisLabelTextColor: "#000",
        title: entryDirection === 0 ? "ENTRY ▲" : "ENTRY ▼",
      });
    }
  }, [entryScore, entryDirection]);

  return (
    <div
      ref={containerRef}
      className="w-full flex-1 min-h-[320px] bg-white/[0.02] border border-white/10 rounded-xl p-1 overflow-hidden transition-all duration-700"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 0 30px rgba(240,255,0,0.04)' }}
    />
  );
}
