/** The coin mark used next to the wordmark and the purse */
export function CoinMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <circle cx="10" cy="10" r="9" fill="var(--color-bullion)" />
      <circle cx="10" cy="10" r="6.2" fill="none" stroke="#131722" strokeOpacity="0.45" strokeWidth="1.2" />
    </svg>
  );
}
