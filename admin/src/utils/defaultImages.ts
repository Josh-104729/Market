// Default images as text-based SVGs (no binary assets needed).
// Theme-aware: switches based on the `dark` class on <html> (see `main.tsx`).

const DEFAULT_SERVICE_IMAGE_SVG_LIGHT = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fafc"/>
      <stop offset="1" stop-color="#e2e8f0"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="#cbd5e1" stroke-opacity="0.22" stroke-width="2"/>
    </pattern>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563eb"/>
      <stop offset="1" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="800" fill="url(#bg)"/>
  <rect width="1200" height="800" fill="url(#grid)"/>
  <circle cx="240" cy="210" r="170" fill="url(#accent)" opacity="0.08"/>
  <circle cx="1010" cy="640" r="230" fill="url(#accent)" opacity="0.06"/>

  <g transform="translate(300,200)">
    <rect x="0" y="60" width="600" height="420" rx="28" fill="#ffffff" stroke="#cbd5e1"/>
    <rect x="28" y="88" width="544" height="260" rx="18" fill="#f8fafc" stroke="#e2e8f0"/>

    <g transform="translate(300,225)" fill="none" stroke="#475569" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-120 36 L0 -36 L120 36 L0 108 Z"/>
      <path d="M-120 36 L-120 176 L0 248 L0 108"/>
      <path d="M120 36 L120 176 L0 248"/>
    </g>
  </g>
</svg>
`.trim();

const DEFAULT_SERVICE_IMAGE_SVG_DARK = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="#94a3b8" stroke-opacity="0.12" stroke-width="2"/>
    </pattern>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#60a5fa"/>
      <stop offset="1" stop-color="#a78bfa"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="800" fill="url(#bg)"/>
  <rect width="1200" height="800" fill="url(#grid)"/>
  <circle cx="240" cy="210" r="170" fill="url(#accent)" opacity="0.14"/>
  <circle cx="1010" cy="640" r="230" fill="url(#accent)" opacity="0.10"/>

  <g transform="translate(300,200)">
    <rect x="0" y="60" width="600" height="420" rx="28" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)"/>
    <rect x="28" y="88" width="544" height="260" rx="18" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)"/>

    <g transform="translate(300,225)" fill="none" stroke="rgba(255,255,255,0.78)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-120 36 L0 -36 L120 36 L0 108 Z"/>
      <path d="M-120 36 L-120 176 L0 248 L0 108"/>
      <path d="M120 36 L120 176 L0 248"/>
    </g>
  </g>
</svg>
`.trim();

export const DEFAULT_SERVICE_IMAGE_SRC_LIGHT =
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(DEFAULT_SERVICE_IMAGE_SVG_LIGHT);

export const DEFAULT_SERVICE_IMAGE_SRC_DARK =
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(DEFAULT_SERVICE_IMAGE_SVG_DARK);

export function getDefaultServiceImageSrc() {
  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return isDark ? DEFAULT_SERVICE_IMAGE_SRC_DARK : DEFAULT_SERVICE_IMAGE_SRC_LIGHT;
}

export function getServiceImageSrc(src?: string | null) {
  if (typeof src !== 'string') return getDefaultServiceImageSrc();
  const trimmed = src.trim();
  return trimmed ? trimmed : getDefaultServiceImageSrc();
}


