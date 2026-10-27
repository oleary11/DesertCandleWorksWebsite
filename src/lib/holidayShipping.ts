// Holiday shipping cutoff shown in the bar above the site header and in the cart.
// Dates are Arizona time. Update these each year (or set to null to hide the bar).

export type HolidayShipping = {
  /** First day the bar shows. */
  showFrom: string;
  /** Last day to order for delivery by Christmas with standard shipping. */
  orderBy: string;
  /** Last day for local pickup in Scottsdale before Christmas. */
  pickupBy: string;
};

export const HOLIDAY_SHIPPING: HolidayShipping | null = {
  showFrom: "2026-11-01",
  // USPS Ground Advantage usually needs ~5 days before Dec 25, plus 1–3 days for us to
  // pour, pack and ship.
  orderBy: "2026-12-14",
  pickupBy: "2026-12-23",
};

const arizonaToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00-07:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Phoenix",
  });

/** What to tell shoppers today, or null when nothing should show. */
export function holidayShippingMessage(today = arizonaToday()): { text: string; urgent: boolean } | null {
  const h = HOLIDAY_SHIPPING;
  if (!h || today < h.showFrom || today > h.pickupBy) return null;
  if (today <= h.orderBy) {
    const daysLeft = Math.round(
      (new Date(`${h.orderBy}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000
    );
    return {
      text:
        daysLeft === 0
          ? "Today is the last day to order for delivery by Christmas"
          : `Order by ${dayLabel(h.orderBy)} for delivery by Christmas`,
      urgent: daysLeft <= 3,
    };
  }
  return {
    text: `Too late to ship for Christmas, but free local pickup in Scottsdale is open through ${dayLabel(h.pickupBy)}`,
    urgent: true,
  };
}
