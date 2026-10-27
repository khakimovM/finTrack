// A visitor who chose Russian and opens "/" goes on to the Russian landing page before anything is
// drawn, instead of seeing the Uzbek one flash first. Search engines keep no choice, so they read
// both addresses. Mirrors stores/localeStore.ts (the key) and lib/i18n/address.ts (the addresses).
(function () {
  if (location.pathname !== '/') return;
  try {
    if (localStorage.getItem('fintrack.locale') === 'ru') location.replace('/ru' + location.search + location.hash);
  } catch (e) {
    // Blocked storage: stay on "/".
  }
})();
