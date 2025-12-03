/**
 * Points System Configuration
 *
 * Earning Points:
 * - Customers earn 1 point per dollar spent (rounded to nearest dollar)
 * - Example: $100 order = 100 points, $44.99 order = 45 points, $44.49 = 44 points
 * - Formula: Math.round(totalCents / 100)
 *
 * Redeeming Points:
 * - 100 points = $5 discount
 * - 20 points = $1 discount
 * - 1 point = $0.05 discount
 * - Formula: pointsToRedeem * 5 (to get cents)
 */

/**
 * Calculate points earned from an order
 * @param totalCents Order total in cents
 * @returns Points earned (1 point per dollar, rounded to nearest)
 */
export function calculatePointsEarned(totalCents: number): number {
  return Math.round(totalCents / 100);
}

/**
 * Calculate discount amount from points
 * @param points Number of points to redeem
 * @returns Discount amount in cents (points * 5)
 */
export function calculatePointsDiscount(points: number): number {
  return points * 5; // 1 point = 5 cents
}

/**
 * Calculate how many dollars a point value is worth
 * @param points Number of points
 * @returns Dollar value (100 points = $5.00)
 */
export function pointsToDollars(points: number): number {
  return (points * 5) / 100; // Convert cents to dollars
}

/**
 * Get human-readable description of points value
 * @param points Number of points
 * @returns Description like "100 points ($5.00)"
 */
export function formatPointsValue(points: number): string {
  const dollars = pointsToDollars(points);
  return `${points} points ($${dollars.toFixed(2)})`;
}
