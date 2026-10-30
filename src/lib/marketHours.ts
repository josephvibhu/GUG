import { getDb, initDb } from "./db";
import { getSetting } from "./wallet";

export interface MarketSchedule {
  isOpen: boolean;
  statusText: string;
  openTimeStr: string;
  closeTimeStr: string;
  timezone: string;
  currentUTC: string;
  timeRemainingSeconds: number;
  timeRemainingFormatted: string;
  override: "auto" | "force_open" | "force_closed";
  reason?: string;
  is247?: boolean;
}

/**
 * Calculates current market status in Coordinated Universal Time (UTC)
 * Default: 24/7 continuous trading floor.
 */
export async function getMarketSchedule(): Promise<MarketSchedule> {
  await initDb();
  
  const [openTimeSetting, closeTimeSetting, overrideSetting, reasonSetting, is247Setting] = await Promise.all([
    getSetting("market_open_time", "00:00"),
    getSetting("market_close_time", "24:00"),
    getSetting("market_override", "auto"),
    getSetting("market_close_reason", "Closed due to the World War"),
    getSetting("market_is_24_7", "true"),
  ]);

  const override = (overrideSetting as "auto" | "force_open" | "force_closed") || "auto";
  const closeReason = reasonSetting || "Closed due to the World War";
  const is247 = is247Setting !== "false";

  // Calculate current time in UTC
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const utcSeconds = now.getUTCSeconds();
  const currentMinutesTotal = utcHours * 60 + utcMinutes;

  const currentUTCStr = `${String(utcHours).padStart(2, "0")}:${String(utcMinutes).padStart(2, "0")}:${String(utcSeconds).padStart(2, "0")} UTC`;

  if (override === "force_closed") {
    return {
      isOpen: false,
      statusText: `Floor Closed: ${closeReason}`,
      openTimeStr: openTimeSetting,
      closeTimeStr: closeTimeSetting,
      timezone: "UTC",
      currentUTC: currentUTCStr,
      timeRemainingSeconds: 0,
      timeRemainingFormatted: "Suspended",
      override,
      reason: closeReason,
      is247,
    };
  }

  if (is247 || override === "force_open" || (openTimeSetting === "00:00" && (closeTimeSetting === "24:00" || closeTimeSetting === "00:00"))) {
    return {
      isOpen: true,
      statusText: "Continuous Floor Active · 24/7 Trading",
      openTimeStr: "00:00",
      closeTimeStr: "24:00",
      timezone: "UTC",
      currentUTC: currentUTCStr,
      timeRemainingSeconds: 0,
      timeRemainingFormatted: "24/7 Continuous",
      override,
      is247: true,
    };
  }

  // Parse Open & Close times (format "HH:MM")
  const [openH, openM] = openTimeSetting.split(":").map((v) => parseInt(v, 10) || 0);
  const [closeH, closeM] = closeTimeSetting.split(":").map((v) => parseInt(v, 10) || 0);

  const openMinutesTotal = openH * 60 + openM;
  const closeMinutesTotal = closeH * 60 + closeM;

  // Determine open/closed under "auto"
  let isCurrentlyWindow = false;
  if (closeMinutesTotal > openMinutesTotal) {
    isCurrentlyWindow = currentMinutesTotal >= openMinutesTotal && currentMinutesTotal < closeMinutesTotal;
  } else {
    isCurrentlyWindow = currentMinutesTotal >= openMinutesTotal || currentMinutesTotal < closeMinutesTotal;
  }

  let isOpen = isCurrentlyWindow;
  let statusText = "";
  let timeRemainingSeconds = 0;

  if (isCurrentlyWindow) {
    isOpen = true;
    const secsLeftInWindow = (closeMinutesTotal - currentMinutesTotal) * 60 - utcSeconds;
    timeRemainingSeconds = Math.max(0, secsLeftInWindow);
    statusText = `Market Open · Closes at ${closeTimeSetting} UTC (${format12HourUTC(closeTimeSetting)})`;
  } else {
    isOpen = false;
    let minsUntilOpen = 0;
    if (currentMinutesTotal < openMinutesTotal) {
      minsUntilOpen = openMinutesTotal - currentMinutesTotal;
    } else {
      minsUntilOpen = 24 * 60 - currentMinutesTotal + openMinutesTotal;
    }
    timeRemainingSeconds = Math.max(0, minsUntilOpen * 60 - utcSeconds);
    statusText = `Market Closed · Opens at ${openTimeSetting} UTC (${format12HourUTC(openTimeSetting)})`;
  }

  const hoursLeft = Math.floor(timeRemainingSeconds / 3600);
  const minsLeft = Math.floor((timeRemainingSeconds % 3600) / 60);
  const secsLeft = timeRemainingSeconds % 60;
  const timeRemainingFormatted = `${hoursLeft}h ${minsLeft}m ${secsLeft}s`;

  return {
    isOpen,
    statusText,
    openTimeStr: openTimeSetting,
    closeTimeStr: closeTimeSetting,
    timezone: "UTC",
    currentUTC: currentUTCStr,
    timeRemainingSeconds,
    timeRemainingFormatted,
    override,
    reason: undefined,
    is247: false,
  };
}

export async function isTradingAllowed(): Promise<{ allowed: boolean; reason?: string }> {
  const schedule = await getMarketSchedule();
  if (schedule.isOpen) {
    return { allowed: true };
  }
  if (schedule.override === "force_closed") {
    return {
      allowed: false,
      reason: `The Parlamentum Bourse trading floor is CLOSED due to the World War. All trading and order executions are suspended.`,
    };
  }
  return {
    allowed: false,
    reason: `The Parlamentum Bourse trading floor is currently CLOSED. Official market hours this week: ${schedule.openTimeStr} – ${schedule.closeTimeStr} UTC (${format12HourUTC(schedule.openTimeStr)} – ${format12HourUTC(schedule.closeTimeStr)}). Current time: ${schedule.currentUTC}.`,
  };
}

function format12HourUTC(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period} UTC`;
}
