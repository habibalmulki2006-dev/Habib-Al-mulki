import { escapeHtml } from '../utils/formatters.js';

export function showToast(title, message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const isWarn = type === 'warning';
  const toast = document.createElement('div');
  toast.className = `toast-item ${isWarn ? 'toast-item--warn' : ''}`;
  toast.setAttribute('role', 'status');

  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${isWarn ? '!' : '✓'}</span>
    <div>
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-msg">${escapeHtml(message)}</div>
    </div>
  `;

  container.appendChild(toast);

  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 220ms ease';
    window.setTimeout(() => toast.remove(), 230);
  }, 3600);
}
