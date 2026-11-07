/**
 * EIDOS Live Suggest & Autocomplete Widget (Vanilla JS, Zero Dependencies)
 * Calls the exact same hybrid ranker pipeline via /v1/suggest or WP/Bitrix proxy.
 * Strictly uses `eidos-` CSS prefix and `eidos:` custom DOM events.
 * Never embeds or exposes ADMIN_KEY.
 */
(function (window, document) {
  'use strict';

  var DEBOUNCE_MS = 180;
  var MIN_CHARS = 2;

  function injectStyles() {
    if (document.getElementById('eidos-suggest-styles')) return;
    var style = document.createElement('style');
    style.id = 'eidos-suggest-styles';
    style.textContent = [
      '.eidos-suggest-wrap { position: relative; }',
      '.eidos-suggest-listbox { position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 9999; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.12); max-height: 420px; overflow-y: auto; font-family: system-ui, -apple-system, sans-serif; }',
      '.eidos-suggest-rewrite { padding: 6px 12px; font-size: 12px; color: #047857; background: #ecfdf5; border-bottom: 1px solid #d1fae5; }',
      '.eidos-suggest-option { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; cursor: pointer; text-decoration: none; color: #0f172a; border-bottom: 1px solid #f1f5f9; transition: background 0.12s ease; }',
      '.eidos-suggest-option:hover, .eidos-suggest-option.eidos-is-active { background: #f8fafc; }',
      '.eidos-suggest-title { font-size: 13px; font-weight: 600; color: #0f172a; line-height: 1.3; }',
      '.eidos-suggest-cat { font-size: 11px; color: #64748b; margin-top: 2px; }',
      '.eidos-suggest-price { font-size: 13px; font-weight: 600; color: #0f172a; white-space: nowrap; font-variant-numeric: tabular-nums; }',
      '.eidos-suggest-empty { padding: 14px 12px; font-size: 13px; color: #64748b; text-align: center; }',
      '.eidos-suggest-footer { display: block; padding: 9px 12px; font-size: 12px; font-weight: 600; color: #0f172a; text-align: center; background: #f8fafc; text-decoration: none; border-top: 1px solid #e2e8f0; }',
      '.eidos-suggest-footer:hover { background: #f1f5f9; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function emitEvent(el, name, detail) {
    try {
      el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail }));
    } catch (_e) {
      // Ignore in legacy browsers
    }
  }

  function attachSuggest(input, config) {
    if (!input || input.dataset.eidosBound === '1') return;
    input.dataset.eidosBound = '1';

    var endpoint = config.proxyUrl || (config.apiUrl ? config.apiUrl.replace(/\/$/, '') + '/v1/suggest' : '/wp-json/eidos/v1/search');
    var eventsEndpoint = config.apiUrl ? config.apiUrl.replace(/\/$/, '') + '/v1/events' : null;
    var searchKey = config.searchKey || '';
    var limit = Math.min(config.limit || 6, 8);

    var parent = input.parentElement;
    if (parent && getComputedStyle(parent).position === 'static') {
      parent.classList.add('eidos-suggest-wrap');
    }

    var listboxId = 'eidos-listbox-' + Math.random().toString(36).slice(2, 8);
    var listbox = document.createElement('div');
    listbox.id = listboxId;
    listbox.className = 'eidos-suggest-listbox';
    listbox.setAttribute('role', 'listbox');
    listbox.hidden = true;
    parent.appendChild(listbox);

    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', listboxId);

    var timer = null;
    var abortCtrl = null;
    var activeIndex = -1;
    var currentItems = [];

    function closeDropdown() {
      listbox.hidden = true;
      listbox.innerHTML = '';
      activeIndex = -1;
      currentItems = [];
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }

    function updateActiveOption() {
      var options = listbox.querySelectorAll('.eidos-suggest-option');
      for (var i = 0; i < options.length; i++) {
        if (i === activeIndex) {
          options[i].classList.add('eidos-is-active');
          options[i].setAttribute('aria-selected', 'true');
          input.setAttribute('aria-activedescendant', options[i].id);
        } else {
          options[i].classList.remove('eidos-is-active');
          options[i].setAttribute('aria-selected', 'false');
        }
      }
    }

    function trackClick(productId, queryText) {
      if (!eventsEndpoint || !searchKey) return;
      try {
        fetch(eventsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': searchKey
          },
          body: JSON.stringify({
            type: 'click',
            query: queryText,
            productId: String(productId)
          }),
          keepalive: true
        }).catch(function () {});
      } catch (_e) {}
    }

    function renderDropdown(data, rawQuery) {
      listbox.innerHTML = '';
      currentItems = Array.isArray(data.results) ? data.results : [];
      activeIndex = -1;

      var rewrites = (data.meta && Array.isArray(data.meta.rewrites)) ? data.meta.rewrites : [];
      if ((data.rewriteApplied || rewrites.length > 0) && data.normalizedQuery && data.normalizedQuery !== rawQuery.toLowerCase()) {
        var rwBanner = document.createElement('div');
        rwBanner.className = 'eidos-suggest-rewrite';
        rwBanner.textContent = 'Показаны результаты для: «' + data.normalizedQuery + '»';
        listbox.appendChild(rwBanner);
      }

      if (currentItems.length === 0) {
        var emptyEl = document.createElement('div');
        emptyEl.className = 'eidos-suggest-empty';
        emptyEl.textContent = 'Ничего не найдено по запросу «' + rawQuery + '»';
        listbox.appendChild(emptyEl);
      } else {
        currentItems.forEach(function (item, idx) {
          var opt = document.createElement('a');
          opt.id = listboxId + '-opt-' + idx;
          opt.className = 'eidos-suggest-option';
          opt.setAttribute('role', 'option');
          opt.setAttribute('aria-selected', 'false');
          opt.href = item.url || ('/?s=' + encodeURIComponent(item.title));

          var left = document.createElement('div');
          var title = document.createElement('div');
          title.className = 'eidos-suggest-title';
          title.textContent = item.title || '';
          var cat = document.createElement('div');
          cat.className = 'eidos-suggest-cat';
          cat.textContent = item.category || '';
          left.appendChild(title);
          left.appendChild(cat);

          var right = document.createElement('div');
          right.className = 'eidos-suggest-price';
          if (typeof item.price === 'number') {
            right.textContent = item.price.toLocaleString('ru-RU') + ' ₽';
          }

          opt.appendChild(left);
          opt.appendChild(right);
          opt.addEventListener('click', function () {
            trackClick(item.id, rawQuery);
            emitEvent(input, 'eidos:suggest:select', { item: item, query: rawQuery });
          });

          listbox.appendChild(opt);
        });
      }

      var footer = document.createElement('a');
      footer.className = 'eidos-suggest-footer';
      footer.href = (config.searchPageUrl || '/?s=') + encodeURIComponent(rawQuery);
      footer.textContent = 'Все результаты (' + (data.total || currentItems.length) + ') →';
      listbox.appendChild(footer);

      listbox.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      emitEvent(input, 'eidos:suggest:open', { query: rawQuery, count: currentItems.length });
    }

    function runSuggest(rawQuery) {
      if (abortCtrl) abortCtrl.abort();
      abortCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;

      var headers = { 'Content-Type': 'application/json' };
      if (searchKey) headers['X-API-Key'] = searchKey;

      fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ query: rawQuery, limit: limit, mode: 'suggest' }),
        signal: abortCtrl ? abortCtrl.signal : undefined
      })
        .then(function (res) {
          if (res.status === 429) {
            return res.json().catch(function () { return {}; }).then(function (rlBody) {
              emitEvent(input, 'eidos:suggest:ratelimit', {
                query: rawQuery,
                retryAfterMs: (rlBody && rlBody.retryAfterMs) || 12000
              });
              return null;
            });
          }
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          if (!data) return;
          if (data.fallback === true || data.code === 'INDEX_EMPTY' || data.code === 'RATE_LIMIT') {
            closeDropdown();
            emitEvent(input, 'eidos:suggest:fallback', { query: rawQuery });
            return;
          }
          renderDropdown(data, rawQuery);
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          // Silent fail-safe fallback: close dropdown and allow native CMS form submission
          closeDropdown();
          emitEvent(input, 'eidos:suggest:fallback', { query: rawQuery });
        });
    }

    input.addEventListener('input', function () {
      var val = (input.value || '').trim();
      if (timer) clearTimeout(timer);
      if (Array.from(val).length < MIN_CHARS) {
        if (abortCtrl) abortCtrl.abort();
        closeDropdown();
        return;
      }
      timer = setTimeout(function () {
        runSuggest(val);
      }, DEBOUNCE_MS);
    });

    input.addEventListener('keydown', function (e) {
      if (listbox.hidden) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentItems.length > 0) {
          activeIndex = (activeIndex + 1) % currentItems.length;
          updateActiveOption();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentItems.length > 0) {
          activeIndex = (activeIndex - 1 + currentItems.length) % currentItems.length;
          updateActiveOption();
        }
      } else if (e.key === 'Enter' && activeIndex >= 0 && currentItems[activeIndex]) {
        e.preventDefault();
        var chosen = currentItems[activeIndex];
        trackClick(chosen.id, input.value);
        window.location.href = chosen.url || ('/?s=' + encodeURIComponent(chosen.title));
      } else if (e.key === 'Escape') {
        closeDropdown();
      }
    });

    document.addEventListener('click', function (e) {
      if (!parent.contains(e.target)) {
        closeDropdown();
      }
    });
  }

  function init() {
    injectStyles();
    var cfg = window.EIDOS_SEARCH_CONFIG || {};
    var selector = cfg.selector || 'input[name="s"], input[name="q"], input[type="search"].eidos-search-input';
    var inputs = document.querySelectorAll(selector);
    for (var i = 0; i < inputs.length; i++) {
      attachSuggest(inputs[i], cfg);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.EidosSuggest = { init: init, attach: attachSuggest };
})(window, document);
