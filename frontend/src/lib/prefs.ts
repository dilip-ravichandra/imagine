export interface Prefs { largeText: boolean; reduceMotion: boolean; voiceTarget: string; voiceSource: string }
const KEY = 'imagineai_prefs';
const DEFAULTS: Prefs = { largeText: false, reduceMotion: false, voiceTarget: 'hi', voiceSource: 'en' };

export function loadPrefs(): Prefs {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Prefs>) }; } catch { return DEFAULTS; }
}
export function applyPrefs(p: Prefs): void {
  document.documentElement.style.fontSize = p.largeText ? '118%' : '';
  let el = document.getElementById('prefs-motion');
  if (p.reduceMotion && !el) {
    el = document.createElement('style'); el.id = 'prefs-motion';
    el.textContent = '*,*::before,*::after{animation-duration:0.001ms!important;animation-iteration-count:1!important;transition-duration:0.001ms!important;scroll-behavior:auto!important}';
    document.head.appendChild(el);
  } else if (!p.reduceMotion && el) el.remove();
}
export function savePrefs(p: Prefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: the setting still applies for this visit */ }
  applyPrefs(p);
}
