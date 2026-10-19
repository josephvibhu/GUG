"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { RotateCcw } from "lucide-react";

// TradingView's own charting library (lightweight-charts) with TradingView's dark theme colours.
const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1D"] as const;
type ChartInterval = (typeof INTERVALS)[number];

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const UP = "#26a69a";
const DOWN = "#ef5350";
const volumeColor = (b: Bar) => (b.close >= b.open ? "rgba(38,166,154,0.42)" : "rgba(239,83,80,0.42)");
const toCandle = (b: Bar) => ({ time: b.time as UTCTimestamp, open: b.open, high: b.high, low: b.low, close: b.close });
const toVolume = (b: Bar) => ({ time: b.time as UTCTimestamp, value: b.volume, color: volumeColor(b) });

async function fetchBars(ticker: string, interval: string, signal?: AbortSignal): Promise<{ candles: Bar[]; ipoPrice: number }> {
  const res = await fetch(`/api/market/${ticker}/candles?interval=${interval}`, { cache: "no-store", signal });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "candles failed");
  return data;
}

interface Props {
  ticker: string;
  name: string;
  /** Changes whenever this company trades; the chart then fetches just the newest bars */
  lastTradeId: string | null;
}

function TVChartImpl({ ticker, name, lastTradeId }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ipoLineRef = useRef<IPriceLine | null>(null);
  const barsRef = useRef<Bar[]>([]);
  const seenTradeRef = useRef<string | null>(lastTradeId);
  const [interval, setChartInterval] = useState<ChartInterval>("15m");
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [ipoPrice, setIpoPrice] = useState<number | null>(null);

  // OHLC legend, written straight to the DOM so crosshair moves don't re-render React
  const writeLegend = useCallback((bar: Bar | undefined) => {
    const el = legendRef.current;
    if (!el) return;
    const set = (key: string, text: string) => {
      const node = el.querySelector(`[data-k="${key}"]`);
      if (node) node.textContent = text;
    };
    if (!bar) {
      ["o", "h", "l", "c", "chg", "v"].forEach((k) => set(k, "–"));
      return;
    }
    const change = bar.close - bar.open;
    const pct = bar.open ? (change / bar.open) * 100 : 0;
    set("o", bar.open.toFixed(2));
    set("h", bar.high.toFixed(2));
    set("l", bar.low.toFixed(2));
    set("c", bar.close.toFixed(2));
    set("chg", `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)} (${change >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(2)}%)`);
    set("v", bar.volume.toLocaleString("en-US"));
    el.dataset.dir = change > 0 ? "up" : change < 0 ? "down" : "flat";
  }, []);

  // Create the chart once
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#8b90a0",
        fontSize: 11,
        fontFamily: getComputedStyle(document.body).fontFamily,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "rgba(42,46,57,0.6)" },
        horzLines: { color: "rgba(42,46,57,0.6)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#6a6f7d", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#363a45" },
        horzLine: { color: "#6a6f7d", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#363a45" },
      },
      rightPriceScale: { borderColor: "#2a2e39" },
      timeScale: { borderColor: "#2a2e39", timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 9, minBarSpacing: 2 },
      localization: { priceFormatter: (p: number) => p.toFixed(2) },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.12, bottom: 0.26 } });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const onMove = (p: MouseEventParams<Time>) => {
      const bars = barsRef.current;
      if (p.time === undefined) {
        writeLegend(bars[bars.length - 1]);
        return;
      }
      writeLegend(bars.find((b) => b.time === p.time) || bars[bars.length - 1]);
    };
    chart.subscribeCrosshairMove(onMove);

    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;
    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      ipoLineRef.current = null;
    };
  }, [writeLegend]);

  const applyAll = useCallback(
    (bars: Bar[], ipo: number) => {
      const chart = chartRef.current;
      const candles = candleRef.current;
      const volume = volumeRef.current;
      if (!chart || !candles || !volume) return;
      barsRef.current = bars;
      candles.setData(bars.map(toCandle));
      volume.setData(bars.map(toVolume));
      if (ipoLineRef.current) candles.removePriceLine(ipoLineRef.current);
      ipoLineRef.current = candles.createPriceLine({
        price: ipo,
        color: "rgba(233,180,64,0.6)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "IPO",
      });
      const n = bars.length;
      if (n > 140) chart.timeScale().setVisibleLogicalRange({ from: n - 140, to: n + 4 });
      else chart.timeScale().fitContent();
      writeLegend(bars[n - 1]);
      setIpoPrice(ipo);
      setStatus(n ? "ready" : "empty");
    },
    [writeLegend]
  );

  // Newest bars only: replaces the last bar and appends new ones, so zoom and scroll stay put
  const applyTail = useCallback(
    (bars: Bar[], ipo: number) => {
      const old = barsRef.current;
      const candles = candleRef.current;
      const volume = volumeRef.current;
      if (!candles || !volume) return;
      const lastOld = old[old.length - 1];
      const start = lastOld ? bars.findIndex((b) => b.time >= lastOld.time) : -1;
      if (!lastOld || start === -1) {
        applyAll(bars, ipo);
        return;
      }
      for (let i = start; i < bars.length; i++) {
        candles.update(toCandle(bars[i]));
        volume.update(toVolume(bars[i]));
      }
      barsRef.current = bars;
      writeLegend(bars[bars.length - 1]);
    },
    [applyAll, writeLegend]
  );

  // Full load when the interval changes
  useEffect(() => {
    const controller = new AbortController();
    fetchBars(ticker, interval, controller.signal)
      .then((data) => applyAll(data.candles, data.ipoPrice))
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [ticker, interval, applyAll]);

  // A new trade on this company: fetch and apply only the newest bars
  useEffect(() => {
    if (!lastTradeId || lastTradeId === seenTradeRef.current) return;
    seenTradeRef.current = lastTradeId;
    fetchBars(ticker, interval)
      .then((data) => applyTail(data.candles, data.ipoPrice))
      .catch(() => {});
  }, [lastTradeId, ticker, interval, applyTail]);

  const retry = () => {
    setStatus("loading");
    fetchBars(ticker, interval)
      .then((data) => applyAll(data.candles, data.ipoPrice))
      .catch(() => setStatus("error"));
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-9 shrink-0 flex items-center gap-0.5 px-2 border-b border-rule" role="toolbar" aria-label="Chart interval">
        {INTERVALS.map((iv) => (
          <button
            key={iv}
            type="button"
            aria-pressed={iv === interval}
            onClick={() => {
              if (iv === interval) return;
              setStatus("loading");
              setChartInterval(iv);
            }}
            className={`h-7 min-w-9 px-2 rounded-[3px] text-[13px] transition-colors ${
              iv === interval ? "bg-rule text-zinc-50 font-semibold" : "text-ash hover:text-paper hover:bg-pane"
            }`}
          >
            {iv}
          </button>
        ))}
        <span className="ml-auto text-[12px] text-ash pr-1">UTC</span>
        <button
          type="button"
          title="Fit all bars"
          aria-label="Fit all bars"
          onClick={() => chartRef.current?.timeScale().fitContent()}
          className="h-7 w-7 rounded-[3px] flex items-center justify-center text-ash hover:text-paper hover:bg-pane"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative flex-1 min-h-[300px]">
        <div ref={hostRef} className="absolute inset-0" />
        <div
          ref={legendRef}
          data-dir="flat"
          className="tv-legend absolute left-3 top-2 z-10 pointer-events-none flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12px] pr-16"
        >
          <span className="condensed font-bold text-[14px] text-zinc-50">{ticker}</span>
          <span className="text-ash">{interval}</span>
          <span className="text-ash hidden sm:inline truncate max-w-[200px]">{name}</span>
          <span className="flex items-baseline gap-2 text-paper">
            <span>O <b data-k="o">–</b></span>
            <span>H <b data-k="h">–</b></span>
            <span>L <b data-k="l">–</b></span>
            <span>C <b data-k="c">–</b></span>
            <b data-k="chg">–</b>
          </span>
          <span className="text-ash">Vol <span data-k="v" className="text-paper">–</span></span>
        </div>
        {status === "empty" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-ash">
              No trades in this range yet{ipoPrice ? `. Listed at ${ipoPrice.toFixed(2)} gold.` : "."}
            </p>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <button type="button" onClick={retry} className="text-sm text-paper underline underline-offset-4">
              Chart data didn&apos;t load. Try again.
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(TVChartImpl);
