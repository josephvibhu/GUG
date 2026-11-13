"use client";

import Link from "next/link";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";

// The one place the site states what it is; pages don't repeat it
export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="mt-auto border-t border-rule">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-[12px] text-ash">
        <p className="max-w-[62ch] leading-relaxed">
          {t("footer.disclaimer")}
        </p>
        <div className="flex items-center gap-4 shrink-0 flex-wrap">
          <nav aria-label="Rules" className="flex gap-4">
            <Link href="/terms" className="hover:text-paper">{t("footer.terms")}</Link>
            <Link href="/terms#gold-rules" className="hover:text-paper">{t("footer.goldRules")}</Link>
            <Link href="/terms#operator" className="hover:text-paper">{t("footer.operator")}</Link>
          </nav>
          <div className="h-3 w-px bg-rule hidden sm:block" />
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
