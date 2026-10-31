/**
 * EIDOS v3.4.0 — Storefront Hybrid Search Widget (Zero-Dependency Vanilla JS)
 *
 * Drop-in storefront & 1C-Bitrix search widget:
 * <div id="eidos-search-root"></div>
 * <script
 *   src="https://EIDOS_HOST/widget.js"
 *   defer
 *   data-api="https://EIDOS_HOST"
 *   data-key="EIDOS_SEARCH_KEY"
 *   data-input="#eidos-search, #title-search-input, input[name='q'], .search-input"
 *   data-product-url-template="/catalog/#ID#/"
 *   data-limit="8"
 *   data-lang="ru"
 *   data-theme="light"
 * ></script>
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined') {
    root.EidosSearchWidget = api;
    if (root.document && root.document.readyState !== 'loading') {
      api.autoInit();
    } else if (root.document && root.document.addEventListener) {
      root.document.addEventListener('DOMContentLoaded', function () {
        api.autoInit();
      });
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var DEFAULT_SELECTORS = "#eidos-search, #title-search-input, input[name='q'], .search-input";

  function isSafeStorefrontKey(key) {
    if (!key || typeof key !== 'string') return false;
    var trimmed = key.trim();
    if (!trimmed) return false;
    if (/^(eidos_mk_|eidos_master_|eidos_ak_|eidos_admin_)/i.test(trimmed)) {
      return false;
    }
    return true;
  }

  function resolveProductUrl(hit, urlTemplate) {
    if (hit && typeof hit.url === 'string' && hit.url.trim().length > 0) {
      return hit.url.trim();
    }
    var id = hit && hit.id != null ? String(hit.id) : '';
    var sku = hit && hit.sku != null ? String(hit.sku) : id;
    var tpl = (urlTemplate && String(urlTemplate).trim()) || '/catalog/#ID#/';
    return tpl
      .replace(/#ID#/g, encodeURIComponent(id))
      .replace(/#ELEMENT_ID#/g, encodeURIComponent(id))
      .replace(/#SKU#/g, encodeURIComponent(sku))
      .replace(/\{id\}/gi, encodeURIComponent(id));
  }

  function formatScorePercent(hit) {
    if (!hit) return null;
    if (typeof hit.scorePercent === 'number' && !isNaN(hit.scorePercent)) {
      return Math.max(1, Math.min(100, Math.round(hit.scorePercent)));
    }
    if (typeof hit.score === 'number' && !isNaN(hit.score)) {
      if (hit.score <= 0.05) {
        return Math.min(99, Math.max(40, Math.round(hit.score * 2800)));
      }
      return Math.max(1, Math.min(100, Math.round(hit.score * 100)));
    }
    return null;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function injectStyles(doc) {
    if (!doc || doc.getElementById('eidos-widget-styles')) return;
    var style = doc.createElement('style');
    style.id = 'eidos-widget-styles';
    style.textContent = [
      '.eidos-w-wrap{position:relative;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;width:100%;max-width:560px;}',
      '.eidos-w-input{width:100%;box-sizing:border-box;padding:10px 14px;border-radius:8px;border:1px solid #cbd5e1;font-size:14px;outline:none;}',
      '.eidos-w-dropdown{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:99999;border-radius:10px;border:1px solid #e2e8f0;background:#ffffff;color:#0f172a;box-shadow:0 12px 28px rgba(15,23,42,0.14);max-height:420px;overflow-y:auto;padding:6px;}',
      '.eidos-w-dropdown[data-theme="dark"]{background:#0f172a;color:#f8fafc;border-color:#334155;}',
      '.eidos-w-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 11px;border-radius:7px;text-decoration:none;color:inherit;cursor:pointer;transition:background 0.12s;}',
      '.eidos-w-item:hover,.eidos-w-item.eidos-w-active{background:rgba(16,185,129,0.12);}',
      '.eidos-w-title{font-size:14px;font-weight:600;line-height:1.3;margin:0;}',
      '.eidos-w-meta{font-size:12px;opacity:0.75;margin-top:2px;}',
      '.eidos-w-right{text-align:right;white-space:nowrap;flex-shrink:0;}',
      '.eidos-w-price{font-size:13px;font-weight:700;}',
      '.eidos-w-badge{display:inline-block;font-size:11px;font-weight:600;padding:1px 6px;border-radius:4px;background:rgba(16,185,129,0.15);color:#059669;margin-top:2px;}',
      '.eidos-w-state{padding:14px 12px;font-size:13px;text-align:center;opacity:0.85;}',
      '.eidos-w-retry{margin-left:8px;padding:4px 10px;border-radius:6px;border:1px solid #cbd5e1;background:transparent;color:inherit;cursor:pointer;font-size:12px;}',
    ].join('');
    doc.head.appendChild(style);
  }

  function createWidgetInstance(options) {
    var doc = options.document || (typeof document !== 'undefined' ? document : null);
    var fetchImpl = options.fetch || (typeof fetch !== 'undefined' ? fetch : null);
    var apiBase = String(options.api || '').replace(/\/+$/, '');
    var customEndpoint = options.endpoint ? String(options.endpoint).trim() : '';
    var searchKey = String(options.key || '').trim();
    var limit = Math.max(1, Math.min(25, parseInt(String(options.limit || '8'), 10) || 8));
    var lang = String(options.lang || 'ru').toLowerCase() === 'en' ? 'en' : 'ru';
    var theme = String(options.theme || 'light').toLowerCase() === 'dark' ? 'dark' : 'light';
    var urlTemplate = options.productUrlTemplate || '/catalog/#ID#/';
    var debounceMs = typeof options.debounceMs === 'number' ? options.debounceMs : 220;

    var texts =
      lang === 'en'
        ? {
            placeholder: 'Search catalog...',
            loading: 'Searching...',
            empty: 'No results found',
            error: 'Search temporarily unavailable',
            retry: 'Retry',
          }
        : {
            placeholder: 'Умный поиск по каталогу...',
            loading: 'Ищем подходящие товары...',
            empty: 'Ничего не найдено',
            error: 'Поиск временно недоступен',
            retry: 'Повторить',
          };

    if (doc) injectStyles(doc);

    var inputEl = options.inputElement || null;
    var rootEl = options.rootElement || (doc ? doc.getElementById('eidos-search-root') : null);
    var selectorList = options.inputSelector || DEFAULT_SELECTORS;

    if (!inputEl && doc) {
      try {
        inputEl = doc.querySelector(selectorList);
      } catch (_e) {
        inputEl = null;
      }
    }

    if (!inputEl && rootEl && doc) {
      var wrap = doc.createElement('div');
      wrap.className = 'eidos-w-wrap';
      inputEl = doc.createElement('input');
      inputEl.type = 'search';
      inputEl.id = 'eidos-search';
      inputEl.className = 'eidos-w-input';
      inputEl.placeholder = texts.placeholder;
      inputEl.setAttribute('autocomplete', 'off');
      wrap.appendChild(inputEl);
      rootEl.appendChild(wrap);
    }

    var dropdownEl = null;
    if (doc && inputEl) {
      dropdownEl = doc.createElement('div');
      dropdownEl.className = 'eidos-w-dropdown';
      dropdownEl.setAttribute('data-testid', 'eidos-widget-dropdown');
      dropdownEl.setAttribute('data-theme', theme);
      dropdownEl.style.display = 'none';
      var hostParent = inputEl.parentElement || doc.body;
      if (hostParent && hostParent.style && !hostParent.style.position) {
        hostParent.style.position = 'relative';
      }
      hostParent.appendChild(dropdownEl);
    }

    var currentAbort = null;
    var debounceTimer = null;
    var currentResults = [];
    var activeIndex = -1;
    var lastQuery = '';

    function hideDropdown() {
      if (dropdownEl) {
        dropdownEl.style.display = 'none';
        dropdownEl.innerHTML = '';
      }
      activeIndex = -1;
    }

    function renderLoading() {
      if (!dropdownEl) return;
      dropdownEl.style.display = 'block';
      dropdownEl.innerHTML =
        '<div class="eidos-w-state" data-state="loading">' + escapeHtml(texts.loading) + '</div>';
    }

    function renderEmpty() {
      if (!dropdownEl) return;
      dropdownEl.style.display = 'block';
      dropdownEl.innerHTML =
        '<div class="eidos-w-state" data-state="empty">' + escapeHtml(texts.empty) + '</div>';
    }

    function renderError() {
      if (!dropdownEl) return;
      dropdownEl.style.display = 'block';
      dropdownEl.innerHTML =
        '<div class="eidos-w-state" data-state="error">' +
        '<span>' +
        escapeHtml(texts.error) +
        '</span>' +
        '<button type="button" class="eidos-w-retry" data-action="retry">' +
        escapeHtml(texts.retry) +
        '</button>' +
        '</div>';
      var retryBtn = dropdownEl.querySelector('[data-action="retry"]');
      if (retryBtn) {
        retryBtn.addEventListener('click', function () {
          executeSearch(lastQuery);
        });
      }
    }

    function renderResults(items) {
      currentResults = Array.isArray(items) ? items : [];
      activeIndex = -1;
      if (!dropdownEl) return;
      if (currentResults.length === 0) {
        renderEmpty();
        return;
      }

      dropdownEl.style.display = 'block';
      var html = currentResults
        .map(function (hit, idx) {
          var href = resolveProductUrl(hit, urlTemplate);
          var pct = formatScorePercent(hit);
          var priceStr =
            hit.price != null && hit.price !== ''
              ? typeof hit.price === 'number'
                ? hit.price.toLocaleString('ru-RU') + ' ₽'
                : String(hit.price)
              : '';
          var categoryStr = hit.category ? String(hit.category) : '';

          return (
            '<a class="eidos-w-item" data-idx="' +
            idx +
            '" href="' +
            escapeHtml(href) +
            '">' +
            '<div class="eidos-w-left">' +
            '<div class="eidos-w-title">' +
            escapeHtml(hit.title || hit.id) +
            '</div>' +
            (categoryStr ? '<div class="eidos-w-meta">' + escapeHtml(categoryStr) + '</div>' : '') +
            '</div>' +
            '<div class="eidos-w-right">' +
            (priceStr ? '<div class="eidos-w-price">' + escapeHtml(priceStr) + '</div>' : '') +
            (pct != null ? '<div class="eidos-w-badge">' + pct + '%</div>' : '') +
            '</div>' +
            '</a>'
          );
        })
        .join('');

      dropdownEl.innerHTML = html;
    }

    function updateActiveHighlight() {
      if (!dropdownEl) return;
      var nodes = dropdownEl.querySelectorAll('.eidos-w-item');
      for (var i = 0; i < nodes.length; i++) {
        if (i === activeIndex) {
          nodes[i].classList.add('eidos-w-active');
        } else {
          nodes[i].classList.remove('eidos-w-active');
        }
      }
    }

    function executeSearch(rawQuery) {
      var q = String(rawQuery || '').trim().replace(/\s+/g, ' ');
      lastQuery = q;
      if (q.length < 2) {
        if (currentAbort) {
          currentAbort.abort();
          currentAbort = null;
        }
        hideDropdown();
        return Promise.resolve({ results: [] });
      }

      if (!customEndpoint && !isSafeStorefrontKey(searchKey)) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            '[EIDOS Widget] Refusing to use missing or privileged MASTER/ADMIN key in storefront widget. Use a read-only EIDOS_SEARCH_KEY.'
          );
        }
        hideDropdown();
        return Promise.resolve({ error: 'Unsafe or missing key', results: [] });
      }

      if (currentAbort) {
        currentAbort.abort();
      }
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      currentAbort = controller;

      renderLoading();

      var targetUrl = customEndpoint || (apiBase || '') + '/v1/search';
      var headers = {
        'Content-Type': 'application/json',
      };
      if (searchKey) {
        headers['X-API-Key'] = searchKey;
      }

      if (!fetchImpl) {
        renderError();
        return Promise.resolve({ error: 'fetch unavailable', results: [] });
      }

      return fetchImpl(targetUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          query: q,
          mode: 'hybrid',
          limit: limit,
        }),
        signal: controller ? controller.signal : undefined,
      })
        .then(function (res) {
          if (!res || !res.ok) {
            throw new Error('HTTP ' + (res ? res.status : 'error'));
          }
          return res.json();
        })
        .then(function (data) {
          if (controller && controller.signal && controller.signal.aborted) {
            return { aborted: true, results: [] };
          }
          var hits = data && Array.isArray(data.results) ? data.results : [];
          renderResults(hits);
          return { results: hits };
        })
        .catch(function (err) {
          if (err && (err.name === 'AbortError' || (controller && controller.signal && controller.signal.aborted))) {
            return { aborted: true, results: [] };
          }
          renderError();
          return { error: String(err && err.message ? err.message : err), results: [] };
        });
    }

    function onInput(val) {
      if (debounceTimer) clearTimeout(debounceTimer);
      var trimmed = String(val || '').trim();
      if (trimmed.length < 2) {
        if (currentAbort) {
          currentAbort.abort();
          currentAbort = null;
        }
        hideDropdown();
        return;
      }
      debounceTimer = setTimeout(function () {
        executeSearch(trimmed);
      }, debounceMs);
    }

    if (inputEl) {
      inputEl.addEventListener('input', function (e) {
        onInput(e.target.value);
      });
      inputEl.addEventListener('focus', function (e) {
        if (String(e.target.value || '').trim().length >= 2) {
          onInput(e.target.value);
        }
      });
      inputEl.addEventListener('keydown', function (e) {
        if (!dropdownEl || dropdownEl.style.display === 'none') return;
        if (e.key === 'Escape') {
          hideDropdown();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (currentResults.length > 0) {
            activeIndex = (activeIndex + 1) % currentResults.length;
            updateActiveHighlight();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (currentResults.length > 0) {
            activeIndex = (activeIndex - 1 + currentResults.length) % currentResults.length;
            updateActiveHighlight();
          }
        } else if (e.key === 'Enter' && activeIndex >= 0 && currentResults[activeIndex]) {
          e.preventDefault();
          var targetHref = resolveProductUrl(currentResults[activeIndex], urlTemplate);
          if (typeof window !== 'undefined' && window.location) {
            window.location.href = targetHref;
          }
        }
      });
    }

    return {
      inputElement: inputEl,
      dropdownElement: dropdownEl,
      executeSearch: executeSearch,
      onInput: onInput,
      hideDropdown: hideDropdown,
      getResults: function () {
        return currentResults;
      },
    };
  }

  function autoInit(docOverride) {
    var doc = docOverride || (typeof document !== 'undefined' ? document : null);
    if (!doc) return null;
    var scriptEl =
      doc.querySelector('script[src*="widget.js"]') ||
      doc.querySelector('script[data-key]') ||
      doc.querySelector('script[data-api]');
    if (!scriptEl) return null;

    return createWidgetInstance({
      document: doc,
      api: scriptEl.getAttribute('data-api') || '',
      endpoint: scriptEl.getAttribute('data-endpoint') || '',
      key: scriptEl.getAttribute('data-key') || '',
      inputSelector: scriptEl.getAttribute('data-input') || DEFAULT_SELECTORS,
      productUrlTemplate: scriptEl.getAttribute('data-product-url-template') || '/catalog/#ID#/',
      limit: scriptEl.getAttribute('data-limit') || '8',
      lang: scriptEl.getAttribute('data-lang') || 'ru',
      theme: scriptEl.getAttribute('data-theme') || 'light',
    });
  }

  return {
    createWidgetInstance: createWidgetInstance,
    autoInit: autoInit,
    isSafeStorefrontKey: isSafeStorefrontKey,
    resolveProductUrl: resolveProductUrl,
    formatScorePercent: formatScorePercent,
  };
});
