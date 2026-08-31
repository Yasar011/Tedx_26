/** One generated interview slot. */
export interface Slot {
  applicationId: string;
  name: string;
  email: string;
  startsAt: number;
}

export interface SlotPlan {
  startDate: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  minutesEach: number;
  perDay: number;
  /** Minutes of gap between interviews, e.g. for notes or overrun. */
  gapMinutes: number;
}

export const DEFAULT_SLOT_PLAN: SlotPlan = {
  startDate: "",
  startTime: "10:00",
  minutesEach: 20,
  perDay: 12,
  gapMinutes: 5,
};

/**
 * Lays a list of applicants out into back-to-back interview slots.
 *
 * Runs day by day: once `perDay` interviews are placed, it rolls to the
 * next calendar day and restarts at the same clock time, so a long list
 * spreads across several days instead of running into the night.
 *
 * Pure and side-effect free so the caller can show an exact preview of
 * who gets which time before anything is written or emailed.
 */
export function buildSlots(
  applicants: { id: string; name: string; email: string }[],
  plan: SlotPlan
): Slot[] {
  if (!plan.startDate || !plan.startTime) return [];

  const [hh, mm] = plan.startTime.split(":").map(Number);
  const step = Math.max(1, plan.minutesEach) + Math.max(0, plan.gapMinutes);
  const perDay = Math.max(1, plan.perDay);

  return applicants.map((a, i) => {
    const dayOffset = Math.floor(i / perDay);
    const indexInDay = i % perDay;

    // Build from the date parts so the slot lands in the organiser's own
    // timezone rather than being shifted by UTC parsing.
    const [y, mo, d] = plan.startDate.split("-").map(Number);
    const start = new Date(y, (mo ?? 1) - 1, d ?? 1, hh ?? 10, mm ?? 0, 0, 0);
    start.setDate(start.getDate() + dayOffset);
    start.setMinutes(start.getMinutes() + indexInDay * step);

    return {
      applicationId: a.id,
      name: a.name,
      email: a.email,
      startsAt: start.getTime(),
    };
  });
}
