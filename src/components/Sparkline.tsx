import { memo } from "react";

/** Two weeks of daily closes as a small line, teal when the period ended up, red when down */
function SparklineImpl({ points, width = 88, height = 24 }: { points: number[]; width?: number; height?: number }) {
  if (!points || points.length < 2) {
    return <svg width={width} height={height} aria-hidden><line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="var(--color-rule)" strokeWidth="1" /></svg>;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - 2 - ((p - min) / span) * (height - 4)).toFixed(1)}`)
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke={up ? "var(--color-bull)" : "var(--color-bear)"} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default memo(SparklineImpl);
