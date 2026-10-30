// Trading-floor session maths on the client, mirroring lib/marketHours.ts (which needs the DB).
// The server sends the schedule once; the countdown then ticks locally instead of being polled.

export interface FloorSchedule {
  isOpen: boolean;
  openTimeStr: string; // "15:30" UTC
  closeTimeStr: string; // "16:30" UTC
  override: "auto" | "force_open" | "force_closed";
  reason?: string;
  statusText?: string;
  is247?: boolean;
}

export interface FloorState {
  isOpen: boolean;
  byOperator: boolean;
  is247?: boolean;
  secondsLeft: number | null; // to close when open, to open when closed; null when the operator overrides or 24/7
  openMinutes: number;
  closeMinutes: number;
  nowMinutes: number; // minutes since 00:00 UTC, fractional
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map((v) => parseInt(v, 10) || 0);
  return h * 60 + m;
};

export function floorAt(schedule: FloorSchedule, nowMs: number): FloorState {
  const now = new Date(nowMs);
  const nowSeconds = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  const openMinutes = toMinutes(schedule.openTimeStr);
  const closeMinutes = toMinutes(schedule.closeTimeStr);
  const open = openMinutes * 60;
  const close = closeMinutes * 60;
  const inWindow = close > open ? nowSeconds >= open && nowSeconds < close : nowSeconds >= open || nowSeconds < close;
  const nowMinutes = nowSeconds / 60;

  if (schedule.override === "force_closed") {
    return { isOpen: false, byOperator: true, is247: !!schedule.is247, secondsLeft: null, openMinutes, closeMinutes, nowMinutes };
  }

  if (schedule.is247 || (schedule.openTimeStr === "00:00" && (schedule.closeTimeStr === "24:00" || schedule.closeTimeStr === "00:00"))) {
    return {
      isOpen: true,
      byOperator: schedule.override === "force_open",
      is247: true,
      secondsLeft: null,
      openMinutes: 0,
      closeMinutes: 1440,
      nowMinutes,
    };
  }

  if (schedule.override === "force_open") {
    return { isOpen: true, byOperator: true, is247: false, secondsLeft: null, openMinutes, closeMinutes, nowMinutes };
  }

  const day = 24 * 3600;
  const until = (target: number) => (target - nowSeconds + day) % day;
  return {
    isOpen: inWindow,
    byOperator: false,
    is247: false,
    secondsLeft: inWindow ? until(close) : until(open),
    openMinutes,
    closeMinutes,
    nowMinutes,
  };
}
