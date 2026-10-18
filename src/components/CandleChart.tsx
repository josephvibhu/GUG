"use client";

import { useState, useMemo } from "react";
import { CandleData } from "@/lib/market";

interface CandleChartProps {
  candles: CandleData[];
  ticker: string;
  currentPrice: number;
}

export default function CandleChart({ candles, ticker, currentPrice }: CandleChartProps) {
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (!candles || candles.length === 0) {
      // Mock minimal series around current price
      return Array.from({ length: 24 }).map((_, i) => ({
        time: `${i}:00`,
        open: currentPrice * 0.98,
        high: currentPrice * 1.02,
        low: currentPrice * 0.97,
        close: currentPrice,
        volume: 500,
      }));
    }
    return candles;
  }, [candles, currentPrice]);

  const { minPrice, maxPrice, maxVolume } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    let maxVol = 0;

    for (const c of chartData) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
    }

    if (min === Infinity) {
      min = currentPrice * 0.9;
      max = currentPrice * 1.1;
      maxVol = 1000;
    }

    const padding = (max - min) * 0.08 || 1;
    return {
      minPrice: Math.max(0.1, min - padding),
      maxPrice: max + padding,
      maxVolume: maxVol || 1000,
    };
  }, [chartData, currentPrice]);

  const width = 800;
  const height = 340;
  const candleAreaHeight = 260;
  const volumeAreaHeight = 60;
  const paddingRight = 65;
  const paddingBottom = 25;

  const chartWidth = width - paddingRight;

  const getPriceY = (val: number) => {
    const range = maxPrice - minPrice;
    if (range === 0) return candleAreaHeight / 2;
    return candleAreaHeight - ((val - minPrice) / range) * candleAreaHeight;
  };

  const getVolumeY = (vol: number) => {
    if (maxVolume === 0) return height - paddingBottom;
    const h = (vol / maxVolume) * volumeAreaHeight;
    return height - paddingBottom - h;
  };

  const candleWidth = Math.max(4, Math.floor(chartWidth / chartData.length) - 3);
  const activeCandle = hoveredCandle || chartData[chartData.length - 1];

  const priceTicks = [
    maxPrice,
    minPrice + (maxPrice - minPrice) * 0.75,
    minPrice + (maxPrice - minPrice) * 0.5,
    minPrice + (maxPrice - minPrice) * 0.25,
    minPrice,
  ];

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col">
      {/* Header with OHLC readout */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800 text-xs">
        <div className="flex items-center gap-4">
          <span className="font-bold text-white tracking-wide font-mono text-sm">${ticker} / Gold</span>
          {activeCandle && (
            <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
              <span>
                O: <strong className="text-zinc-200">{activeCandle.open.toFixed(2)}</strong>
              </span>
              <span>
                H: <strong className="text-zinc-200">{activeCandle.high.toFixed(2)}</strong>
              </span>
              <span>
                L: <strong className="text-zinc-200">{activeCandle.low.toFixed(2)}</strong>
              </span>
              <span>
                C:{" "}
                <strong
                  className={
                    activeCandle.close >= activeCandle.open ? "text-emerald-400" : "text-rose-400"
                  }
                >
                  {activeCandle.close.toFixed(2)}
                </strong>
              </span>
              <span>
                Vol: <strong className="text-zinc-300">{activeCandle.volume.toLocaleString()}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
          <button className="px-2 py-0.5 text-[11px] font-semibold rounded bg-zinc-800 text-amber-300">
            1H
          </button>
          <button className="px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200">
            4H
          </button>
          <button className="px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200">
            1D
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative mt-2 w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block"
          onMouseLeave={() => {
            setHoveredCandle(null);
            setHoverIndex(null);
          }}
        >
          {/* Price Gridlines and Right Y-Axis labels */}
          {priceTicks.map((price, idx) => {
            const y = getPriceY(price);
            return (
              <g key={idx}>
                <line
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="#27272a"
                  strokeDasharray="2 3"
                  strokeWidth="1"
                />
                <text
                  x={chartWidth + 6}
                  y={y + 3.5}
                  fill="#71717a"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {price.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Volume Separator */}
          <line
            x1={0}
            y1={candleAreaHeight + 10}
            x2={chartWidth}
            y2={candleAreaHeight + 10}
            stroke="#27272a"
            strokeWidth="1"
          />

          {/* Candlesticks & Volume Bars */}
          {chartData.map((c, i) => {
            const step = chartWidth / chartData.length;
            const x = i * step + step / 2;
            const openY = getPriceY(c.open);
            const closeY = getPriceY(c.close);
            const highY = getPriceY(c.high);
            const lowY = getPriceY(c.low);

            const isUp = c.close >= c.open;
            const color = isUp ? "#10b981" : "#f43f5e";

            const candleTop = Math.min(openY, closeY);
            const candleHeight = Math.max(2, Math.abs(openY - closeY));

            const volY = getVolumeY(c.volume);
            const volHeight = Math.max(1, height - paddingBottom - volY);

            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => {
                  setHoveredCandle(c);
                  setHoverIndex(i);
                }}
              >
                {/* Volume Bar */}
                <rect
                  x={x - candleWidth / 2}
                  y={volY}
                  width={candleWidth}
                  height={volHeight}
                  fill={isUp ? "#065f46" : "#881337"}
                  opacity="0.65"
                />

                {/* Wick High-Low */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={color}
                  strokeWidth="1.2"
                />

                {/* Candle Body */}
                <rect
                  x={x - candleWidth / 2}
                  y={candleTop}
                  width={candleWidth}
                  height={candleHeight}
                  fill={color}
                  rx="1"
                />
              </g>
            );
          })}

          {/* Crosshair indicator when hovering */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={hoverIndex * (chartWidth / chartData.length) + (chartWidth / chartData.length) / 2}
                y1={0}
                x2={hoverIndex * (chartWidth / chartData.length) + (chartWidth / chartData.length) / 2}
                y2={height - paddingBottom}
                stroke="#a1a1aa"
                strokeDasharray="2 2"
                strokeWidth="1"
                opacity="0.75"
              />
              {hoveredCandle && (
                <line
                  x1={0}
                  y1={getPriceY(hoveredCandle.close)}
                  x2={chartWidth}
                  y2={getPriceY(hoveredCandle.close)}
                  stroke="#a1a1aa"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                  opacity="0.75"
                />
              )}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
