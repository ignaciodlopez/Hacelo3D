const KEY = 'b3d.theme';
const listeners = new Set();

function read() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function isDark() {
  return document.documentElement.dataset.theme !== 'light';
}

const THEME_COLOR = { dark: '#1a1214', light: '#f6f3f2' };

function applyThemeColor(theme) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  applyThemeColor(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* sin storage */
  }
  listeners.forEach((fn) => fn(theme === 'dark'));
}

export function toggleTheme() {
  setTheme(isDark() ? 'light' : 'dark');
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initTheme() {
  const saved = read();
  const theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
  document.documentElement.dataset.theme = theme;
  applyThemeColor(theme);
}
