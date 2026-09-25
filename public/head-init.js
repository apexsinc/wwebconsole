/*
 * Head bootstrap, extracted from index.html so the Content-Security-Policy does
 * not need `script-src 'unsafe-inline'`.
 *
 * This is a plain classic script (no type="module") and is deliberately NOT
 * async/defer: a synchronous script in <head> blocks parsing and first paint
 * until it has executed, which is what prevents a light/dark theme flash. That
 * is the same rendering guarantee the previous inline <script> block provided.
 */
(function () {
  // 1. Apply the stored theme before first paint to avoid a flash of the wrong
  //    theme. Kept byte-for-byte equivalent to the previous inline version.
  try {
    var t = localStorage.getItem('wwc_theme');
    if (t === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (e) {}

  // 2. The Google Fonts stylesheet is loaded with media="print" so it never
  //    blocks the first render, then promoted to media="all" once it arrives.
  //    This used to be an inline `onload="this.media='all'"` attribute, which
  //    forced `unsafe-inline` into script-src (inline event handlers are
  //    governed by script-src). Doing it here keeps the non-blocking font load
  //    without weakening the CSP.
  var links = document.querySelectorAll('link[rel="stylesheet"][data-font-defer]');
  for (var i = 0; i < links.length; i++) {
    var link = links[i];
    var promote = function () {
      link.media = 'all';
    };
    if (link.sheet) promote();
    else link.addEventListener('load', promote, { once: true });
  }
})();
