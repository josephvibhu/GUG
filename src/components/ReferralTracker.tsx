"use client";

import { useEffect } from "react";

export default function ReferralTracker() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get("ref") || url.searchParams.get("r");
      if (ref && ref.trim()) {
        const clean = ref.trim().toUpperCase();
        localStorage.setItem("gug_ref", clean);
        document.cookie = `gug_ref=${clean}; path=/; max-age=2592000; SameSite=Lax`;
      }
    } catch {}
  }, []);

  return null;
}
