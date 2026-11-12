/**
 * EIDOS Storefront Search Widget — v4.0.0 (Production Hardened)
 * Drop-in hybrid search & autocomplete for Bitrix, WooCommerce, Shopify, or custom storefronts.
 *
 * Security invariants:
 *  - Rejects privileged keys (eidos_mk_*, eidos_ak_*, eidos_sk_*, eidos_merch_*, eidos_master_*, eidos_admin_*, eidos_dev_*).
 *  - Accepts ONLY public search keys (eidos_pk_* or eidos_search_*).
 *  - Strict URL protocol allowlist (http:, https:, relative /) to prevent javascript:/data: XSS.
 *  - DOM-based highlight renderer allowing ONLY <em> tags; all other markup is escaped as text.
 *  - Full WAI-ARIA 1.2 combobox + listbox keyboard & screen-reader semantics.
 */
(function (window, document) {
  'use strict';

  var FORBIDDEN_KEY_PREFIXES = [
    'eidos_mk_',
    'eidos_ak_',
    'eidos_merch_',
    'eidos_master_',
    'eidos_admin_',
    'eidos_dev_',
    'test-key',
  ];

  var ALLOWED_PUBLIC_PREFIXES = ['eidos_pk_', 'eidos_search_', 'eidos_sk_'];

  function isForbiddenKey(key) {
    if (!key || typeof key !== 'string') return true;
    var trimmed = key.trim();
    if (!trimmed) return true;
    var lower = trimmed.toLowerCase();
    for (var i = 0; i < FORBIDDEN_KEY_PREFIXES.length; i++) {
      if (lower.indexOf(FORBIDDEN_KEY_PREFIXES[i]) === 0) return true;
    }
    for (var j = 0; j < ALLOWED_PUBLIC_PREFIXES.length; j++) {
      if (lower.indexOf(ALLOWED_PUBLIC_PREFIXES[j]) === 0) return false;
    }
    // Reject any key that does not carry an explicit public search prefix
    return true;
  }

  function isSafeStorefrontKey(key) {
    return !isForbiddenKey(key);
  }

  function safeUrl(rawUrl, fallbackId) {
    var fallback = '/product/' + encodeURIComponent(String(fallbackId || 'item'));
    if (!rawUrl || typeof rawUrl !== 'string') return fallback;
    var trimmed = rawUrl.trim();
    if (!trimmed) return fallback;
    if (trimmed.charAt(0) === '/') {
      return trimmed.charAt(1) === '/' ? fallback : trimmed;
    }
    try {
      var parsed = new URL(trimmed, window.location.origin);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.href;
      }
    } catch (_e) {
      return fallback;
    }
    return fallback;
  }

  function resolveProductUrl(item, urlTemplate) {
    if (!item || typeof item !== 'object') return safeUrl('', 'item');
    if (item.url && typeof item.url === 'string' && item.url.trim()) {
      return safeUrl(item.url, item.id || item.sku || 'item');
    }
    if (urlTemplate && typeof urlTemplate === 'string' && urlTemplate.trim()) {
      var idVal = encodeURIComponent(String(item.id || 'item'));
      var skuVal = encodeURIComponent(String(item.sku || item.id || 'item'));
      var resolved = urlTemplate
        .replace(/#ID#/g, idVal)
        .replace(/#SKU#/g, skuVal)
        .replace(/\{id\}/gi, idVal)
        .replace(/\{sku\}/gi, skuVal);
      return safeUrl(resolved, item.id || item.sku || 'item');
    }
    return safeUrl('', item.id || item.sku || 'item');
  }

  function escapeHtmlText(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Appends text with safe `<em>...</em>` highlight segments into `targetEl`
   * without using innerHTML on untrusted strings.
   */
  function appendSafeHighlightedText(targetEl, rawString) {
    while (targetEl.firstChild) {
      targetEl.removeChild(targetEl.firstChild);
    }
    var str = String(rawString || '');
    var parts = str.split(/(<em>[\s\S]*?<\/em>)/gi);
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) continue;
      if (/^<em>[\s\S]*<\/em>$/i.test(part)) {
        var em = document.createElement('em');
        em.className = 'eidos-hl eidos-w-em';
        em.textContent = part.slice(4, -5);
        targetEl.appendChild(em);
      } else {
        targetEl.appendChild(document.createTextNode(part));
      }
    }
  }

  function renderHighlightedTitle(containerOrTitle, rawTitleOrHighlight, optionalHighlight) {
    if (containerOrTitle && typeof containerOrTitle === 'object' && typeof containerOrTitle.appendChild === 'function') {
      appendSafeHighlightedText(containerOrTitle, optionalHighlight || rawTitleOrHighlight || '');
      return containerOrTitle;
    }
    var source = String(rawTitleOrHighlight || containerOrTitle || '');
    var segments = source.split(/(<em>[\s\S]*?<\/em>)/gi);
    var out = '';
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      if (!seg) continue;
      if (/^<em>[\s\S]*<\/em>$/i.test(seg)) {
        out += '<em class="eidos-w-em">' + escapeHtmlText(seg.slice(4, -5)) + '</em>';
      } else {
        out += escapeHtmlText(seg);
      }
    }
    return out;
  }

  function injectStyles() {
    if (document.getElementById('eidos-widget-styles-v4')) return;
    var style = document.createElement('style');
    style.id = 'eidos-widget-styles-v4';
    style.textContent = [
      '.eidos-widget-dropdown{position:fixed;z-index:2147483000;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 20px 25px -5px rgba(15,23,42,0.12),0 8px 10px -6px rgba(15,23,42,0.08);max-height:420px;overflow-y:auto;font-family:system-ui,-apple-system,sans-serif;color:#0f172a;box-sizing:border-box;}',
      '.eidos-widget-dropdown[hidden]{display:none !important;}',
      '.eidos-widget-header{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;font-size:11px;color:#64748b;border-bottom:1px solid #f1f5f9;background:#f8fafc;border-radius:12px 12px 0 0;}',
      '.eidos-widget-item{display:flex;align-items:center;gap:12px;padding:10px 12px;text-decoration:none;color:inherit;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:background 0.12s ease;}',
      '.eidos-widget-item:last-child{border-bottom:none;}',
      '.eidos-widget-item:hover,.eidos-widget-item[aria-selected="true"]{background:#eff6ff;}',
      '.eidos-widget-thumb{width:44px;height:44px;border-radius:8px;object-fit:cover;background:#f1f5f9;flex-shrink:0;}',
      '.eidos-widget-meta{flex:1;min-width:0;}',
      '.eidos-widget-title{font-size:14px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.eidos-widget-sub{font-size:12px;color:#64748b;display:flex;gap:8px;align-items:center;margin-top:2px;}',
      '.eidos-widget-price{font-size:14px;font-weight:700;color:#0f172a;white-space:nowrap;}',
      '.eidos-hl{background:#fef08a;color:#854d0e;font-style:normal;padding:0 2px;border-radius:3px;}',
      '.eidos-widget-empty{padding:16px 12px;font-size:13px;color:#64748b;text-align:center;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function mountWidget(config) {
    var apiUrl = String(config.apiUrl || window.location.origin).replace(/\/+$/, '');
    var apiKey = String(config.apiKey || '').trim();
    var tenantId = String(config.tenantId || '').trim();
    var indexName = String(config.indexName || '').trim();
    var selector = config.inputSelector || 'input[type="search"], input[name="q"], input[name="s"]';
    var minChars = Math.max(1, Number(config.minChars) || 2);
    var limit = Math.min(20, Math.max(1, Number(config.limit) || 6));

    if (isForbiddenKey(apiKey)) {
      console.error(
        '[EIDOS Widget] Blocked initialization: Provide a valid public search key (eidos_pk_...). Privileged or missing keys are forbidden in browser code.'
      );
      return null;
    }

    injectStyles();

    var input = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!input) return null;

    var listboxId = 'eidos-listbox-' + Math.random().toString(36).slice(2, 9);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', listboxId);
    input.setAttribute('autocomplete', 'off');

    var dropdown = document.createElement('div');
    dropdown.id = listboxId;
    dropdown.className = 'eidos-widget-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.hidden = true;
    document.body.appendChild(dropdown);

    var activeIndex = -1;
    var currentItems = [];
    var debounceTimer = null;
    var abortCtrl = null;

    function positionDropdown() {
      if (dropdown.hidden) return;
      var rect = input.getBoundingClientRect();
      var width = Math.max(rect.width, 320);
      var left = Math.min(rect.left, window.innerWidth - width - 12);
      dropdown.style.top = Math.round(rect.bottom + 6) + 'px';
      dropdown.style.left = Math.max(8, Math.round(left)) + 'px';
      dropdown.style.width = Math.round(width) + 'px';
    }

    function closeDropdown() {
      dropdown.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      activeIndex = -1;
    }

    function openDropdown() {
      dropdown.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      positionDropdown();
    }

    function updateActiveHighlight() {
      var options = dropdown.querySelectorAll('[role="option"]');
      for (var i = 0; i < options.length; i++) {
        var isSelected = i === activeIndex;
        options[i].setAttribute('aria-selected', isSelected ? 'true' : 'false');
        if (isSelected) {
          input.setAttribute('aria-activedescendant', options[i].id);
          options[i].scrollIntoView({ block: 'nearest' });
        }
      }
      if (activeIndex < 0) {
        input.removeAttribute('aria-activedescendant');
      }
    }

    function sendEvent(eventType, item, queryText) {
      try {
        var headers = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        };
        if (tenantId) headers['x-tenant-id'] = tenantId;
        fetch(apiUrl + '/v1/events', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            type: eventType,
            productId: String(item.id || item.sku || ''),
            query: String(queryText || ''),
          }),
          keepalive: true,
        }).catch(function () {});
      } catch (_e) {}
    }

    function renderResults(data, queryText) {
      while (dropdown.firstChild) {
        dropdown.removeChild(dropdown.firstChild);
      }

      var results = (data && Array.isArray(data.results)) ? data.results : [];
      currentItems = results;
      activeIndex = -1;

      var header = document.createElement('div');
      header.className = 'eidos-widget-header';
      var leftSpan = document.createElement('span');
      leftSpan.textContent = results.length > 0 ? ('Найдено: ' + results.length) : 'Нет совпадений';
      var rightSpan = document.createElement('span');
      var lat = data && data.meta && typeof data.meta.latencyMs === 'number' ? data.meta.latencyMs : data.latencyMs;
      rightSpan.textContent = typeof lat === 'number' ? (lat.toFixed(1) + ' мс · EIDOS') : 'EIDOS Hybrid';
      header.appendChild(leftSpan);
      header.appendChild(rightSpan);
      dropdown.appendChild(header);

      if (results.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'eidos-widget-empty';
        empty.textContent = 'По запросу «' + queryText + '» ничего не найдено';
        dropdown.appendChild(empty);
        openDropdown();
        return;
      }

      for (var i = 0; i < results.length; i++) {
        (function (idx, item) {
          var optId = listboxId + '-opt-' + idx;
          var a = document.createElement('a');
          a.id = optId;
          a.className = 'eidos-widget-item';
          a.setAttribute('role', 'option');
          a.setAttribute('aria-selected', 'false');
          a.href = safeUrl(item.url, item.id);

          if (item.imageUrl) {
            var imgSrc = safeUrl(item.imageUrl, '');
            if (imgSrc && imgSrc.indexOf('/product/') !== 0) {
              var img = document.createElement('img');
              img.className = 'eidos-widget-thumb';
              img.src = imgSrc;
              img.alt = String(item.title || '');
              img.loading = 'lazy';
              a.appendChild(img);
            }
          }

          var meta = document.createElement('div');
          meta.className = 'eidos-widget-meta';

          var titleEl = document.createElement('div');
          titleEl.className = 'eidos-widget-title';
          var rawTitle = (item.highlights && item.highlights.title) ? item.highlights.title : item.title;
          appendSafeHighlightedText(titleEl, rawTitle);
          meta.appendChild(titleEl);

          var sub = document.createElement('div');
          sub.className = 'eidos-widget-sub';
          if (item.category) {
            var catSpan = document.createElement('span');
            catSpan.textContent = String(item.category);
            sub.appendChild(catSpan);
          }
          if (item.brand) {
            var brandSpan = document.createElement('span');
            brandSpan.textContent = '· ' + String(item.brand);
            sub.appendChild(brandSpan);
          }
          meta.appendChild(sub);
          a.appendChild(meta);

          if (typeof item.price === 'number' && item.price > 0) {
            var priceEl = document.createElement('div');
            priceEl.className = 'eidos-widget-price';
            priceEl.textContent = item.price.toLocaleString('ru-RU') + ' ₽';
            a.appendChild(priceEl);
          }

          a.addEventListener('click', function () {
            sendEvent('click', item, queryText);
          });

          dropdown.appendChild(a);
        })(i, results[i]);
      }

      openDropdown();
    }

    function runSuggest(queryText) {
      if (abortCtrl) {
        abortCtrl.abort();
      }
      if (typeof AbortController !== 'undefined') {
        abortCtrl = new AbortController();
      }

      var headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      };
      if (tenantId) headers['x-tenant-id'] = tenantId;
      if (indexName) headers['x-index-name'] = indexName;

      fetch(apiUrl + '/v1/suggest', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          query: queryText,
          limit: limit,
          indexName: indexName || undefined,
        }),
        signal: abortCtrl ? abortCtrl.signal : undefined,
      })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          renderResults(data, queryText);
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          closeDropdown();
        });
    }

    input.addEventListener('input', function () {
      var q = String(input.value || '').trim();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (q.length < minChars) {
        closeDropdown();
        return;
      }
      debounceTimer = setTimeout(function () {
        runSuggest(q);
      }, 160);
    });

    input.addEventListener('keydown', function (e) {
      if (dropdown.hidden) return;
      var count = currentItems.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (count > 0) {
          activeIndex = (activeIndex + 1) % count;
          updateActiveHighlight();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (count > 0) {
          activeIndex = (activeIndex - 1 + count) % count;
          updateActiveHighlight();
        }
      } else if (e.key === 'Enter' && activeIndex >= 0 && currentItems[activeIndex]) {
        e.preventDefault();
        var chosen = currentItems[activeIndex];
        sendEvent('click', chosen, input.value);
        window.location.assign(safeUrl(chosen.url, chosen.id));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown();
      }
    });

    document.addEventListener('click', function (e) {
      if (e.target !== input && !dropdown.contains(e.target)) {
        closeDropdown();
      }
    });

    window.addEventListener('scroll', positionDropdown, true);
    window.addEventListener('resize', positionDropdown);

    return {
      close: closeDropdown,
      destroy: function () {
        if (dropdown.parentNode) dropdown.parentNode.removeChild(dropdown);
      },
    };
  }

  // Auto-init from <script src=".../widget.js" data-api-key="eidos_pk_..." data-api-url="...">
  function autoInitFromScriptTag() {
    var scripts = document.querySelectorAll('script[data-api-key], script[data-key]');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      if (s.getAttribute('data-eidos-mounted') === 'true') continue;
      s.setAttribute('data-eidos-mounted', 'true');
      var apiKey = s.getAttribute('data-api-key') || s.getAttribute('data-key');
      var apiUrl =
        s.getAttribute('data-api-url') ||
        s.getAttribute('data-api') ||
        s.src.replace(/\/widget\.js(\?.*)?$/, '');
      var inputSel = s.getAttribute('data-input-selector') || s.getAttribute('data-input') || undefined;
      var limit = parseInt(s.getAttribute('data-limit') || '8', 10);
      mountWidget({
        apiUrl: apiUrl,
        apiKey: apiKey,
        tenantId: s.getAttribute('data-tenant-id') || '',
        indexName: s.getAttribute('data-index-name') || '',
        inputSelector: inputSel,
        limit: limit,
      });
    }
  }

  window.EidosSearchWidget = {
    version: '4.0.0',
    init: mountWidget,
    isForbiddenKey: isForbiddenKey,
    isSafeStorefrontKey: isSafeStorefrontKey,
    safeUrl: safeUrl,
    resolveProductUrl: resolveProductUrl,
    renderHighlightedTitle: renderHighlightedTitle,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.EidosSearchWidget;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInitFromScriptTag);
  } else {
    autoInitFromScriptTag();
  }
})(typeof window !== 'undefined' ? window : {}, typeof document !== 'undefined' ? document : { getElementById: function () { return null; }, querySelectorAll: function () { return []; }, readyState: 'complete' });
