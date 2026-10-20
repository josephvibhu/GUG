import Link from "next/link";

// The one place the site states what it is; pages don't repeat it
export default function Footer() {
  return (
    <footer className="mt-auto border-t border-rule">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between text-[12px] text-ash">
        <p className="max-w-[62ch] leading-relaxed">
          Played with Parlamentum gold only: no real money goes in or comes out. Grow Ur Gold is an independent player project, not run by
          the Parlamentum team.
        </p>
        <nav aria-label="Rules" className="flex gap-4 shrink-0">
          <Link href="/terms" className="hover:text-paper">Terms</Link>
          <Link href="/terms#gold-rules" className="hover:text-paper">Gold rules</Link>
          <Link href="/terms#operator" className="hover:text-paper">Operator</Link>
        </nav>
      </div>
    </footer>
  );
}
