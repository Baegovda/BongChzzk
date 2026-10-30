export function formatBadgeCount(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (!Number.isFinite(n)) return '0';
  if (n <= 999) return String(n);
  if (n < 9950) {
    const tenths = Math.round(n / 100);
    const whole = Math.floor(tenths / 10);
    const frac = tenths % 10;
    if (whole >= 10) return '10k';
    return frac === 0 ? `${whole}k` : `${whole}.${frac}k`;
  }
  if (n < 99500) {
    const rounded = Math.round(n / 1000);
    if (rounded >= 100) return '99k+';
    return `${rounded}k`;
  }
  return '99k+';
}

export function badgeForStatus(status) {
  const idle = { text: '', color: '#1d4ed8' };
  if (!status || status.showOriginal) return idle;
  if (status.error) return { text: '!', color: '#b91c1c' };
  if (status.started && status.done > 0) {
    return { text: formatBadgeCount(status.done), color: '#1d4ed8' };
  }
  return idle;
}
