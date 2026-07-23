const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex) => {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length === 3) {
    return normalized.split('').map((ch) => parseInt(ch + ch, 16));
  }

  if (normalized.length !== 6) {
    return [51, 144, 250];
  }

  const value = normalized.match(/.{1,2}/g) || [];
  return value.map((chunk) => parseInt(chunk, 16));
};

const rgbToHex = (values) => values.map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('');

export const buildBrandPalette = (hexColor) => {
  const base = hexColor || '#3390fa';
  const [r, g, b] = hexToRgb(base);

  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  const palette = {};

  steps.forEach((step, index) => {
    const factor = index <= 5 ? 0.12 + index * 0.08 : 0.72 + (index - 5) * 0.07;
    const adjusted = [r, g, b].map((channel) => channel * (1 - factor) + (step >= 600 ? 20 : 0));

    if (step === 500) {
      palette[step] = base;
    } else {
      palette[step] = `#${rgbToHex(adjusted)}`;
    }
  });

  return palette;
};

export const applyBrandTheme = (settings = {}) => {
  if (typeof document === 'undefined') return;

  const brandColor = settings.brandColor || '#3390fa';
  const accentColor = settings.accentColor || '#10b981';
  const palette = buildBrandPalette(brandColor);
  const root = document.documentElement;

  Object.entries(palette).forEach(([shade, value]) => {
    root.style.setProperty(`--brand-${shade}`, value);
  });

  root.style.setProperty('--brand-primary', palette['500']);
  root.style.setProperty('--accent-color', accentColor);
};
