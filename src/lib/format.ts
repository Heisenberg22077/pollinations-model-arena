export function formatLatency(ms: number | undefined): string {
  if (ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatPollen(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return "—";
  if (n === 0) return "0";
  if (n < 0.000001) return "<0.000001";
  if (n < 0.001) return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, ".0");
  if (n < 1) return n.toFixed(5).replace(/0+$/, "").replace(/\.$/, ".0");
  return n.toFixed(3);
}

export function formatTokens(n: number | undefined): string {
  if (n === undefined) return "—";
  return n.toLocaleString("en-US");
}

export function formatMsTick(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
