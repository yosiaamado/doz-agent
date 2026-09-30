// Runs before the first paint (a classic script in <head>): the theme and language are right immediately, with no flash.
// Kept in its own file (not inline) so the CSP can stay at `script-src 'self'`.
(function () {
  var root = document.documentElement;
  try {
    var pref = localStorage.getItem('doz-studio:theme') || 'system';
    var dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) { root.dataset.theme = 'dark'; }
  try {
    var locale = localStorage.getItem('doz-studio:locale');
    if (locale !== 'en' && locale !== 'id') locale = /^id/i.test(navigator.language || '') ? 'id' : 'en';
    root.lang = locale;
  } catch (e) { /* localStorage blocked: keep the default lang */ }
})();
