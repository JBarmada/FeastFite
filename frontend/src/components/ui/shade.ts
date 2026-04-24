/** Lighten (+pct) or darken (-pct) a hex color. pct is a signed percentage 0–100. */
export function shade(hex: string, pct: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * pct);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0xff) + amt;
  const B = (num & 0xff) + amt;
  const clamp = (x: number) => Math.max(0, Math.min(255, x));
  return (
    '#' +
    ((1 << 24) + (clamp(R) << 16) + (clamp(G) << 8) + clamp(B))
      .toString(16)
      .slice(1)
  );
}
