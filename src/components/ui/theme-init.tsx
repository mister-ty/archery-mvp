/**
 * Inline script that runs BEFORE the first paint to apply the right
 * theme class on <html>, preventing FOUC (flash of unstyled content).
 *
 * Reads from localStorage (`theme: 'dark' | 'light'`) and falls back to
 * `prefers-color-scheme` from the OS. Intentionally tiny and stringified
 * to keep it inline in <head>.
 */
const SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var p=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t==='dark'||(t!=='light'&&p);if(d)document.documentElement.classList.add('dark');document.documentElement.style.colorScheme=d?'dark':'light';}catch(_){}})();`;

export function ThemeInit() {
  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  );
}
