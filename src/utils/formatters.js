/**
 * Formatting and HTML sanitization utilities.
 */

export function formatRupiah(amount) {
  const numeric = Number.isFinite(Number(amount)) ? Math.round(Number(amount)) : 0;
  return 'Rp ' + numeric.toLocaleString('id-ID');
}

export function parseRupiahInput(raw) {
  if (typeof raw === 'number') return raw;
  const digits = String(raw ?? '').replace(/[^0-9]/g, '');
  return digits ? Number.parseInt(digits, 10) : 0;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getInitials(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'TA';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
