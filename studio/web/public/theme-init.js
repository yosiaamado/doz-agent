// Dijalankan sebelum first paint (classic script di <head>): tema dan bahasa langsung benar, tanpa kedip.
// File terpisah (bukan inline) supaya CSP cukup `script-src 'self'`.
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
  } catch (e) { /* localStorage diblokir: biarkan lang bawaan */ }
})();
