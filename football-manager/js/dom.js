// Tiny DOM helpers. No framework: the screens are strings, events are delegated.

export const $ = (sel, root = document) => root.querySelector(sel);

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function setHTML(el, html) { el.innerHTML = html; return el; }

const luminance = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex ?? '');
  if (!m) return 0.5;
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const inkOn = (hex) => (luminance(hex) > 0.55 ? '#12180f' : '#f4f7f2');

export function crest(team, cls = '') {
  const ink = inkOn(team.home);
  return `<svg class="crest ${cls}" viewBox="0 0 34 38" role="img" aria-label="${esc(team.name)}">
    <path d="M2 2.5h30v20.2c0 8.4-8.7 12.4-15 15.3-6.3-2.9-15-6.9-15-15.3z" fill="${esc(team.home)}" stroke="rgba(0,0,0,.4)" stroke-width="1"/>
    <path d="M2 2.5h30v6.4H2z" fill="${esc(team.away)}" opacity=".9"/>
    <text x="17" y="25" text-anchor="middle" font-size="10.5" font-weight="800" fill="${ink}" font-family="system-ui, sans-serif">${esc(team.abbr)}</text>
  </svg>`;
}

export function meter(pct, cls = '') {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return `<div class="meter ${cls}"><i style="width:${v}%"></i></div>`;
}

export function conditionMeter(condition) {
  const cls = condition >= 80 ? '' : condition >= 55 ? 'gold' : 'gold';
  const colour = condition >= 80 ? 'var(--good)' : condition >= 55 ? 'var(--warn)' : 'var(--danger)';
  const v = Math.max(0, Math.min(100, Math.round(condition)));
  return `<div class="meter ${cls}"><i style="width:${v}%;background:${colour}"></i></div>`;
}

export function formRun(form) {
  if (!form || !form.length) return '<span class="tiny muted">—</span>';
  return `<span class="form-run">${form.map((f) => `<i class="${f}">${f}</i>`).join('')}</span>`;
}

export function ratingBadge(rating) {
  if (rating == null) return '<span class="muted">—</span>';
  const colour = rating >= 7.5 ? 'var(--good)' : rating >= 6.5 ? 'var(--text)' : rating >= 5.8 ? 'var(--warn)' : 'var(--danger)';
  return `<span style="color:${colour}">${rating.toFixed(1)}</span>`;
}

let toastTimer = null;
export function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

// Bottom sheets --------------------------------------------------------------

let sheetCloser = null;

export function openSheet(html, onMount) {
  closeSheet();
  const root = $('#sheet-root');
  const overlay = $('#overlay');
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.innerHTML = `<div class="grab"></div>
    <button class="sheet-close" data-action="close-sheet" data-sheet-close aria-label="Close">&times;</button>
    ${html}`;
  root.appendChild(sheet);
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';

  const close = () => closeSheet();
  const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
  overlay.addEventListener('click', close, { once: true });
  document.addEventListener('keydown', onKey);
  sheetCloser = () => {
    overlay.removeEventListener('click', close);
    document.removeEventListener('keydown', onKey);
    sheet.remove();
    overlay.hidden = true;
    document.body.style.overflow = '';
    sheetCloser = null;
  };
  onMount?.(sheet);
  return sheet;
}

export function closeSheet() {
  sheetCloser?.();
}

export const sheetOpen = () => !!sheetCloser;
