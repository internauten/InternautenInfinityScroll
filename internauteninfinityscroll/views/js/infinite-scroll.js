(function () {
    'use strict';

    var config = window.internautenInfinityScrollConfig || {};
    var batchSize = Number(config.batchSize || 20);
    var productListSelectors = config.productListSelectors || ['#js-product-list .products', '.products'];
    var itemSelector = config.productItemSelector || '.js-product-miniature';
    var nextLinkSelectors = config.nextLinkSelectors || ['.pagination .next a', 'a[rel="next"]'];
    var paginationSelectors = config.paginationSelectors || ['.pagination'];
    var loadingText = config.loadingText || 'Loading more products...';
    var errorText = config.errorText || 'Could not load more products.';
    var debugEnabled = Boolean(config.debug);
    var responseMode = String(config.responseMode || 'json').toLowerCase();
    if (responseMode !== 'auto' && responseMode !== 'json' && responseMode !== 'html') {
        responseMode = 'json';
    }

    var state = {
        loading: false,
        nextUrl: null,
        stopped: false,
        observer: null,
        productContainer: null,
        statusNode: null,
        sentinelNode: null,
        scrollFallbackInstalled: false,
        reinitHooksBound: false,
        reinitTimer: null,
        listRootObserver: null,
        seenProductIds: {},
        consecutiveEmptyLoads: 0,
        internalDomUpdate: false,
        loadingStatusTimer: null,
    };

    var debugColors = {
        'boot': '#6c757d', // grey
        'init-ready': '#198754', // green
        'init-skip': '#fd7e14', // orange
        'load-start': '#0d6efd', // blue
        'load-source': '#6610f2', // purple
        'load-success': '#198754', // green
        'load-empty': '#ffc107', // yellow
        'load-error': '#dc3545', // red
        'stop': '#dc3545', // red
    };

    function debugLog(eventName, payload) {
        if (!debugEnabled || !window.console || typeof window.console.log !== 'function') {
            return;
        }

        var color = debugColors[eventName] || '#6c757d';
        var badge =
            'background:' + color + ';color:#fff;padding:1px 5px;border-radius:3px;font-weight:bold';
        var label = 'color:' + color + ';font-weight:bold';

        window.console.log(
            '%c IIS %c ' + eventName,
            badge,
            label,
            payload || {}
        );
    }

    function findFirst(selectors, root) {
        var scope = root || document;
        for (var i = 0; i < selectors.length; i += 1) {
            var node = scope.querySelector(selectors[i]);
            if (node) {
                return node;
            }
        }
        return null;
    }

    function findProductContainer(root) {
        var node = findFirst(productListSelectors, root);
        if (!node) {
            return null;
        }

        if (node.querySelector(itemSelector)) {
            return node;
        }

        for (var i = 0; i < productListSelectors.length; i += 1) {
            var candidates = root.querySelectorAll(productListSelectors[i]);
            for (var j = 0; j < candidates.length; j += 1) {
                if (candidates[j].querySelector(itemSelector)) {
                    return candidates[j];
                }
            }
        }

        return node;
    }

    function getNextUrl(root) {
        var nextLink = findFirst(nextLinkSelectors, root || document);
        if (!nextLink) {
            return null;
        }
        return nextLink.getAttribute('href');
    }

    function normalizeListingUrl(url) {
        if (!url) {
            return null;
        }

        try {
            var parsed = new URL(url, window.location.href);
            parsed.searchParams.delete('action');
            parsed.searchParams.delete('ajax');
            parsed.searchParams.delete('from-xhr');
            return parsed;
        } catch (e) {
            return null;
        }
    }

    function withBatchSize(url) {
        if (!url) {
            return null;
        }

        try {
            var parsed = normalizeListingUrl(url);
            if (!parsed) {
                return url;
            }
            parsed.searchParams.set('n', String(batchSize));
            return parsed.toString();
        } catch (e) {
            return url;
        }
    }

    function withAjaxHints(url) {
        if (!url) {
            return null;
        }

        try {
            var parsed = normalizeListingUrl(url);
            if (!parsed) {
                return url;
            }
            parsed.searchParams.set('action', 'updateProductList');
            parsed.searchParams.set('ajax', '1');
            parsed.searchParams.set('from-xhr', '1');
            return parsed.toString();
        } catch (e) {
            return url;
        }
    }

    function getRequestPlan(nextUrl) {
        if (responseMode === 'html') {
            return {
                url: withBatchSize(nextUrl),
                forceType: 'html',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
            };
        }

        return {
            url: withAjaxHints(nextUrl),
            forceType: responseMode === 'json' ? 'json' : null,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
            },
        };
    }

    function hidePagination() {
        for (var i = 0; i < paginationSelectors.length; i += 1) {
            var nodes = document.querySelectorAll(paginationSelectors[i]);
            for (var j = 0; j < nodes.length; j += 1) {
                nodes[j].style.display = 'none';
            }
        }
    }

    function removeNode(node) {
        if (node && node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }

    function resetRuntimeState() {
        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
        }

        removeNode(state.statusNode);
        removeNode(state.sentinelNode);

        state.loading = false;
        state.nextUrl = null;
        state.stopped = false;
        state.productContainer = null;
        state.statusNode = null;
        state.sentinelNode = null;
        state.seenProductIds = {};
        state.consecutiveEmptyLoads = 0;
        state.internalDomUpdate = false;

        if (state.loadingStatusTimer) {
            window.clearTimeout(state.loadingStatusTimer);
            state.loadingStatusTimer = null;
        }
    }

    function getProductIdentifier(productNode) {
        if (!productNode) {
            return null;
        }

        var dataId = productNode.getAttribute('data-product-id');
        if (dataId) {
            return 'product-' + dataId;
        }

        var dataEntityId = productNode.getAttribute('data-entity-id');
        if (dataEntityId) {
            return 'entity-' + dataEntityId;
        }

        var id = productNode.getAttribute('id');
        if (id) {
            return 'id-' + id;
        }

        var href = productNode.querySelector('a');
        if (href && href.href) {
            return 'href-' + href.href;
        }

        return null;
    }

    function markProductAsSeen(productNode) {
        var identifier = getProductIdentifier(productNode);
        if (identifier) {
            state.seenProductIds[identifier] = true;
        }
    }

    function hasSeenProduct(productNode) {
        var identifier = getProductIdentifier(productNode);
        if (!identifier) {
            return false;
        }
        return state.seenProductIds[identifier] === true;
    }

    function ensureStatusNode() {
        if (state.statusNode) {
            return state.statusNode;
        }

        if (!state.productContainer || !state.sentinelNode || !state.productContainer.parentNode) {
            return null;
        }

        var node = document.createElement('div');
        node.className = 'internauten-infinityscroll-status';
        node.style.textAlign = 'center';
        node.style.padding = '12px 0';
        node.style.fontSize = '14px';
        node.style.color = '#555';
        node.style.display = 'none';

        state.statusNode = node;
        state.productContainer.parentNode.insertBefore(node, state.sentinelNode);
        return node;
    }

    function setStatus(message, show) {
        var node = ensureStatusNode();
        if (!node) {
            return;
        }
        node.textContent = message || '';
        node.style.display = show ? 'block' : 'none';
    }

    function showLoadingStatusDelayed() {
        if (state.loadingStatusTimer) {
            window.clearTimeout(state.loadingStatusTimer);
        }

        state.loadingStatusTimer = window.setTimeout(function () {
            if (state.loading && !state.stopped) {
                setStatus(loadingText, true);
            }
        }, 150);
    }

    function clearLoadingStatusTimer() {
        if (state.loadingStatusTimer) {
            window.clearTimeout(state.loadingStatusTimer);
            state.loadingStatusTimer = null;
        }
    }

    function appendProductItems(items) {
        var addedCount = 0;
        for (var i = 0; i < items.length; i += 1) {
            if (!hasSeenProduct(items[i])) {
                markProductAsSeen(items[i]);
                state.productContainer.appendChild(items[i]);
                addedCount += 1;
            }
        }
        return addedCount;
    }

    function appendProductsFromJson(data) {
        var parser = new DOMParser();
        var addedCount = 0;
        var nextUrl = null;

        var productsHtml = data.rendered_products || '';
        if (productsHtml) {
            var productsDoc = parser.parseFromString(productsHtml, 'text/html');
            var items = productsDoc.querySelectorAll(itemSelector);
            addedCount = appendProductItems(items);
        }

        var footerHtml = data.rendered_products_footer || data.rendered_pagination || '';
        if (footerHtml) {
            var footerDoc = parser.parseFromString(footerHtml, 'text/html');
            nextUrl = getNextUrl(footerDoc);
        }

        return {
            count: addedCount,
            nextUrl: nextUrl,
            source: 'json',
        };
    }

    function appendProductsFromHtml(html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var sourceContainer = findProductContainer(doc);

        if (!sourceContainer) {
            return { count: 0, nextUrl: null };
        }

        var items = sourceContainer.querySelectorAll(itemSelector);
        if (!items.length) {
            return { count: 0, nextUrl: getNextUrl(doc), source: 'html' };
        }

        return {
            count: appendProductItems(items),
            nextUrl: getNextUrl(doc),
            source: 'html',
        };
    }

    function stopInfiniteScroll(reason) {
        state.stopped = true;
        if (state.observer) {
            state.observer.disconnect();
        }
        clearLoadingStatusTimer();
        if (state.sentinelNode) {
            state.sentinelNode.style.display = 'none';
        }
        setStatus('', false);

        debugLog('stop', {
            reason: reason || 'unknown',
            nextUrl: state.nextUrl,
            consecutiveEmptyLoads: state.consecutiveEmptyLoads,
        });
    }

    function loadNextPage() {
        if (state.loading || state.stopped || !state.nextUrl || !state.productContainer) {
            return;
        }

        state.loading = true;
        var requestPlan = getRequestPlan(state.nextUrl);
        debugLog('load-start', {
            nextUrl: requestPlan.url,
            consecutiveEmptyLoads: state.consecutiveEmptyLoads,
            responseMode: responseMode,
        });
        showLoadingStatusDelayed();

        fetch(requestPlan.url, {
            credentials: 'same-origin',
            headers: requestPlan.headers,
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Request failed with status ' + response.status);
                }
                var contentType = response.headers.get('content-type') || '';
                return response.text().then(function (raw) {
                    var body = raw || '';
                    var trimmed = body.trim();
                    var isJsonContentType = contentType.indexOf('application/json') !== -1;
                    var looksLikeJson = trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[';
                    var shouldParseJson = isJsonContentType || looksLikeJson;

                    if (shouldParseJson) {
                        try {
                            return { type: 'json', data: JSON.parse(trimmed) };
                        } catch (e) {
                            debugLog('load-source', {
                                type: 'json-parse-failed-fallback-html',
                                responseMode: responseMode,
                                contentType: contentType,
                            });
                        }
                    }

                    if (requestPlan.forceType === 'json') {
                        debugLog('load-source', {
                            type: 'forced-json-but-got-html',
                            responseMode: responseMode,
                            contentType: contentType,
                        });
                    }

                    return { type: 'html', data: body };
                });
            })
            .then(function (wrapped) {
                state.internalDomUpdate = true;
                var result = wrapped.type === 'json'
                    ? appendProductsFromJson(wrapped.data)
                    : appendProductsFromHtml(wrapped.data);
                state.internalDomUpdate = false;

                debugLog('load-source', { type: wrapped.type, source: result.source || null });

                if (!result.count) {
                    state.consecutiveEmptyLoads += 1;
                    debugLog('load-empty', {
                        nextUrl: result.nextUrl,
                        consecutiveEmptyLoads: state.consecutiveEmptyLoads,
                    });
                    if (state.consecutiveEmptyLoads >= 2) {
                        stopInfiniteScroll('consecutive-empty-loads');
                        return;
                    }
                    state.nextUrl = result.nextUrl ? withBatchSize(result.nextUrl) : null;
                    if (!state.nextUrl) {
                        stopInfiniteScroll('no-next-url-after-empty-load');
                        return;
                    }
                    setStatus('', false);
                    return;
                }

                state.consecutiveEmptyLoads = 0;
                state.nextUrl = result.nextUrl ? withBatchSize(result.nextUrl) : null;
                debugLog('load-success', {
                    addedCount: result.count,
                    nextUrl: state.nextUrl,
                });
                if (!state.nextUrl) {
                    stopInfiniteScroll('no-next-url-after-success');
                    return;
                }

                setStatus('', false);
            })
            .catch(function () {
                state.internalDomUpdate = false;
                debugLog('load-error', {
                    nextUrl: state.nextUrl,
                });
                setStatus(errorText, true);
            })
            .finally(function () {
                clearLoadingStatusTimer();
                state.loading = false;
            });
    }

    function installFallbackScrollListener() {
        if (state.scrollFallbackInstalled) {
            return;
        }

        state.scrollFallbackInstalled = true;
        window.addEventListener('scroll', function () {
            if (state.loading || state.stopped || !state.sentinelNode) {
                return;
            }

            var rect = state.sentinelNode.getBoundingClientRect();
            if (rect.top <= window.innerHeight + 250) {
                loadNextPage();
            }
        });
    }

    function installIntersectionObserver() {
        if (!('IntersectionObserver' in window)) {
            installFallbackScrollListener();
            return;
        }

        state.observer = new IntersectionObserver(
            function (entries) {
                for (var i = 0; i < entries.length; i += 1) {
                    if (entries[i].isIntersecting) {
                        loadNextPage();
                    }
                }
            },
            {
                root: null,
                rootMargin: '0px 0px 350px 0px',
                threshold: 0,
            }
        );

        state.observer.observe(state.sentinelNode);
    }

    function scheduleReinit() {
        if (state.reinitTimer) {
            window.clearTimeout(state.reinitTimer);
        }

        state.reinitTimer = window.setTimeout(function () {
            init();
        }, 100);
    }

    function installListRootObserver() {
        if (state.listRootObserver) {
            state.listRootObserver.disconnect();
            state.listRootObserver = null;
        }

        if (!('MutationObserver' in window)) {
            return;
        }

        var listRoot = document.querySelector('#js-product-list');
        if (!listRoot) {
            return;
        }

        state.listRootObserver = new MutationObserver(function (mutations) {
            if (state.loading || state.internalDomUpdate) {
                return;
            }

            for (var i = 0; i < mutations.length; i += 1) {
                if (mutations[i].addedNodes.length || mutations[i].removedNodes.length) {
                    scheduleReinit();
                    return;
                }
            }
        });

        state.listRootObserver.observe(listRoot, { childList: true, subtree: true });
    }

    function bindReinitHooks() {
        if (state.reinitHooksBound) {
            return;
        }

        state.reinitHooksBound = true;

        if (window.prestashop && typeof window.prestashop.on === 'function') {
            window.prestashop.on('updateProductList', scheduleReinit);
            window.prestashop.on('updatedProductList', scheduleReinit);
            window.prestashop.on('updateFacets', scheduleReinit);
        }

        document.addEventListener('change', function (event) {
            var target = event.target;
            if (!target || typeof target.matches !== 'function') {
                return;
            }

            if (
                target.matches('.products-sort-order select') ||
                target.matches('select[name="order"]') ||
                target.matches('.js-search-filters select')
            ) {
                scheduleReinit();
            }
        });

        if (window.Stimulus !== undefined || window.stimulus !== undefined) {
            var debounceReinit = function () {
                if (state.reinitTimer) {
                    window.clearTimeout(state.reinitTimer);
                }
                state.reinitTimer = window.setTimeout(scheduleReinit, 150);
            };
            document.addEventListener('click', debounceReinit);
        }
    }

    function init() {
        resetRuntimeState();

        state.productContainer = findProductContainer(document);
        if (!state.productContainer) {
            debugLog('init-skip', { reason: 'no-product-container' });
            installListRootObserver();
            return;
        }

        var existingItems = state.productContainer.querySelectorAll(itemSelector);
        for (var i = 0; i < existingItems.length; i += 1) {
            markProductAsSeen(existingItems[i]);
        }

        state.nextUrl = withBatchSize(getNextUrl(document));
        if (!state.nextUrl) {
            debugLog('init-skip', { reason: 'no-next-url' });
            installListRootObserver();
            return;
        }

        hidePagination();

        state.sentinelNode = document.createElement('div');
        state.sentinelNode.className = 'internauten-infinityscroll-sentinel';
        state.sentinelNode.style.width = '100%';
        state.sentinelNode.style.height = '1px';

        if (state.productContainer.parentNode) {
            state.productContainer.parentNode.appendChild(state.sentinelNode);
            installIntersectionObserver();
        }

        debugLog('init-ready', {
            initialProducts: existingItems.length,
            nextUrl: state.nextUrl,
        });

        installListRootObserver();
    }

    function boot() {
        debugLog('boot', { debugEnabled: debugEnabled });
        bindReinitHooks();
        init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
