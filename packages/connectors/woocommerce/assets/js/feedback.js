/**
 * EIDOS WooCommerce Frontend Click & Conversion Telemetry
 *
 * Uses navigator.sendBeacon (with fetch keepalive fallback) to send non-blocking
 * click feedback to /wp-json/eidos/v1/feedback without delaying page navigation.
 */
(function () {
  'use strict';

  var config = window.EidosWCConfig || {
    endpoint: '/wp-json/eidos/v1/feedback',
    query: '',
    userId: ''
  };

  function resolveSearchQuery() {
    if (config.query && String(config.query).trim() !== '') {
      return String(config.query).trim();
    }
    try {
      var params = new URLSearchParams(window.location.search);
      return (params.get('s') || params.get('q') || '').trim();
    } catch (_e) {
      return '';
    }
  }

  function sendFeedbackEvent(payload) {
    if (!payload || !payload.itemId) {
      return false;
    }

    var endpoint = config.endpoint || '/wp-json/eidos/v1/feedback';
    var body = JSON.stringify({
      itemId: String(payload.itemId),
      eventType: payload.eventType || 'click',
      query: payload.query || resolveSearchQuery() || 'catalog',
      userId: payload.userId || config.userId || undefined,
      position: typeof payload.position === 'number' ? payload.position : undefined
    });

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        var blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(endpoint, blob)) {
          return true;
        }
      } catch (_err) {
        // Fallback to fetch keepalive below
      }
    }

    if (typeof window.fetch === 'function') {
      try {
        window.fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true
        }).catch(function () {});
        return true;
      } catch (_err2) {
        return false;
      }
    }

    return false;
  }

  function findProductIdFromElement(el) {
    if (!el || typeof el.closest !== 'function') {
      return null;
    }

    var explicitAttrEl = el.closest('[data-eidos-item-id], [data-product_id], [data-product-id]');
    if (explicitAttrEl) {
      var attrId =
        explicitAttrEl.getAttribute('data-eidos-item-id') ||
        explicitAttrEl.getAttribute('data-product_id') ||
        explicitAttrEl.getAttribute('data-product-id');
      if (attrId) {
        return attrId;
      }
    }

    var postItem = el.closest('.product, li.type-product, [class*="post-"]');
    if (postItem && postItem.className) {
      var match = String(postItem.className).match(/\bpost-(\d+)\b/);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  document.addEventListener(
    'click',
    function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') {
        return;
      }

      var link = target.closest(
        'a.woocommerce-LoopProduct-link, .product a, a[data-eidos-item-id], button.add_to_cart_button'
      );
      if (!link) {
        return;
      }

      var itemId = findProductIdFromElement(link);
      if (!itemId) {
        return;
      }

      var isAddToCart = link.classList && link.classList.contains('add_to_cart_button');
      sendFeedbackEvent({
        itemId: itemId,
        eventType: isAddToCart ? 'conversion' : 'click',
        query: resolveSearchQuery()
      });
    },
    { capture: true, passive: true }
  );

  window.EidosWCFeedback = {
    track: sendFeedbackEvent
  };
})();
