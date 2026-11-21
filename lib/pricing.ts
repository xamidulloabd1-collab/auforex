/** "1200000" → "1 200 000" (narrow no-break spaces keep the number on one line). */
export function formatPrice(value: number) {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Discount in whole percent, or null when there is no valid previous price. */
export function discountPercent(price: number, oldPrice: number | null | undefined) {
  if (!oldPrice || oldPrice <= price) return null;
  return Math.round((1 - price / oldPrice) * 100);
}
