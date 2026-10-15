// Applies the saved or system theme before the first paint, so the prerendered landing page and
// the app shell never flash light for a dark-mode visitor. Mirrors stores/uiStore.ts.
(function () {
  var theme = 'system';
  try {
    var saved = localStorage.getItem('fintrack-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') theme = saved;
  } catch (e) {
    // Blocked storage: follow the system.
  }
  var dark = theme === 'dark' || (theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
})();
