"use client";

import { useState } from "react";
import { X, Copy, Check, ShieldCheck, ExternalLink } from "lucide-react";

interface Props {
  ticker: string;
  username: string;
  onClose: () => void;
}

export default function ShareholderBadgeModal({ ticker, username, onClose }: Props) {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://growurgold.vercel.app";
  const badgeUrl = `${origin}/api/badge/${ticker}/${username}`;
  const exchangeUrl = `${origin}/trade/${ticker}`;
  const markdownCode = `[![${ticker} Shareholder](${badgeUrl})](${exchangeUrl})`;
  const bbCode = `[url=${exchangeUrl}][img]${badgeUrl}[/img][/url]`;

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.warn("Failed to copy:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-pane border border-rule rounded-[6px] shadow-2xl p-5 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-bullion" />
            <h3 className="text-[16px] font-bold text-zinc-50 tracking-tight">
              Verified Shareholder Card · ${ticker}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-ash hover:text-paper text-sm p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live SVG Badge Preview */}
        <div className="flex flex-col items-center justify-center p-2 rounded-[4px] bg-floor border border-rule overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/badge/${ticker}/${username}?t=${Date.now()}`}
            alt={`${ticker} Shareholder Card`}
            className="w-full max-w-[540px] h-auto rounded-[6px] shadow-md border border-rule/60"
          />
        </div>

        {/* Share & Embed Codes */}
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-ash">Markdown Embed (Discord Bio, GitHub, Reddit)</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={markdownCode}
                className="h-9 flex-1 px-3 rounded-[4px] bg-floor border border-rule text-[12px] text-zinc-300 font-mono select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(markdownCode, "markdown")}
                className="h-9 px-3 rounded-[4px] bg-bullion hover:bg-amber-300 text-floor font-semibold text-[12px] flex items-center gap-1 shrink-0"
              >
                {copiedType === "markdown" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedType === "markdown" ? "Copied" : "Copy"}
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-ash">Direct Image URL</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={badgeUrl}
                className="h-9 flex-1 px-3 rounded-[4px] bg-floor border border-rule text-[12px] text-zinc-300 font-mono select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(badgeUrl, "url")}
                className="h-9 px-3 rounded-[4px] border border-rule hover:bg-rule text-[12px] text-paper flex items-center gap-1 shrink-0"
              >
                {copiedType === "url" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedType === "url" ? "Copied" : "Copy"}
              </button>
              <a
                href={badgeUrl}
                target="_blank"
                rel="noreferrer"
                className="h-9 px-2.5 rounded-[4px] border border-rule hover:bg-rule text-ash hover:text-paper flex items-center justify-center shrink-0"
                title="Open image in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-ash">BBCode (Parlamentum Forums & Guild Signatures)</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={bbCode}
                className="h-9 flex-1 px-3 rounded-[4px] bg-floor border border-rule text-[12px] text-zinc-300 font-mono select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(bbCode, "bbcode")}
                className="h-9 px-3 rounded-[4px] border border-rule hover:bg-rule text-[12px] text-paper flex items-center gap-1 shrink-0"
              >
                {copiedType === "bbcode" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedType === "bbcode" ? "Copied" : "Copy"}
              </button>
            </div>
          </label>
        </div>

        <div className="flex justify-end pt-2 border-t border-rule">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-[4px] border border-rule hover:bg-rule text-[13px] text-paper"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
