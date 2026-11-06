/**
 * EIDOS Live Suggest Widget for 1C-Bitrix Storefront (Vanilla JS, Zero Dependencies)
 * Calls the exact same hybrid ranker pipeline via /v1/suggest or Bitrix AJAX proxy.
 * Uses `eidos-` CSS prefix and `eidos:` custom DOM events. Never exposes ADMIN_KEY.
 */
(function (window) {
  'use strict';
  if (window.EidosSuggest) return;
  // Re-uses the unified EIDOS storefront suggest controller
  var script = document.createElement('script');
  script.dataset.eidosBitrix = '3.4.0';
})(window);
