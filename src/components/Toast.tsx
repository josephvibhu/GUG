"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, X, AlertTriangle } from "lucide-react";

export type ToastType = "fill" | "cancel" | "error";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  body: string;
}

let _emit: ((msg: Omit<ToastMessage, "id">) => void) | null = null;

export function emitToast(msg: Omit<ToastMessage, "id">) {
  _emit?.(msg);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    _emit = (msg) => {
      const id = `toast_${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev.slice(-4), { ...msg, id }]);
      setTimeout(() => remove(id), 5000);
    };
    return () => { _emit = null; };
  }, [remove]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-[320px] pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl pointer-events-auto backdrop-blur-sm
            ${t.type === "fill"
              ? "bg-emerald-950/90 border-emerald-700/60 text-emerald-100"
              : t.type === "cancel"
              ? "bg-zinc-900/95 border-zinc-700 text-zinc-200"
              : "bg-rose-950/90 border-rose-700/60 text-rose-100"
            }`}
        >
          <div className="pt-0.5 shrink-0">
            {t.type === "fill" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-zinc-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-snug">{t.title}</p>
            <p className="text-[12px] opacity-75 leading-snug mt-0.5">{t.body}</p>
          </div>
          <button
            onClick={() => remove(t.id)}
            className="shrink-0 opacity-50 hover:opacity-100 transition"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
