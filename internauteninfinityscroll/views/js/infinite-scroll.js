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

    var state = {
        loading: false,
        nextUrl: null,
        stopped: false,
        observer: null,
        productContainer: null,
        statusNode: null,
        sentinelNode: null,
    };

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

    function withBatchSize(url) {
        if (!url) {
            return null;
        }

        try {
            var parsed = new URL(url, window.location.href);
            parsed.searchParams.set('n', String(batchSize));
            return parsed.toString();
        } catch (e) {
            return url;
        }
    }

    function hidePagination() {
        for (var i = 0; i < paginationSelectors.length; i += 1) {
            var nodes = document.querySelectorAll(paginationSelectors[i]);
            for (var j = 0; j < nodes.length; j += 1) {
                nodes[j].style.display = 'none';
            }
        }
    }

    function ensureStatusNode() {
        if (state.statusNode) {
            return state.statusNode;
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
        node.textContent = message || '';
        node.style.display = show ? 'block' : 'none';
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
            return { count: 0, nextUrl: getNextUrl(doc) };
        }

        for (var i = 0; i < items.length; i += 1) {
            state.productContainer.appendChild(items[i]);
        }

        return {
            count: items.length,
            nextUrl: getNextUrl(doc),
        };
    }

    function stopInfiniteScroll() {
        state.stopped = true;
        if (state.observer) {
            state.observer.disconnect();
        }
        if (state.sentinelNode) {
            state.sentinelNode.style.display = 'none';
        }
        setStatus('', false);
    }

    function loadNextPage() {
        if (state.loading || state.stopped || !state.nextUrl) {
            return;
        }

        state.loading = true;
        setStatus(loadingText, true);

        fetch(withBatchSize(state.nextUrl), {
            credentials: 'same-origin',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            },
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Request failed with status ' + response.status);
                }
                return response.text();
            })
            .then(function (html) {
                var result = appendProductsFromHtml(html);
                if (!result.count) {
                    stopInfiniteScroll();
                    return;
                }

                state.nextUrl = result.nextUrl ? withBatchSize(result.nextUrl) : null;
                if (!state.nextUrl) {
                    stopInfiniteScroll();
                    return;
                }

                setStatus('', false);
            })
            .catch(function () {
                setStatus(errorText, true);
            })
            .finally(function () {
                state.loading = false;
            });
    }

    function installIntersectionObserver() {
        if (!('IntersectionObserver' in window)) {
            window.addEventListener('scroll', function () {
                if (state.loading || state.stopped || !state.sentinelNode) {
                    return;
                }

                var rect = state.sentinelNode.getBoundingClientRect();
                if (rect.top <= window.innerHeight + 250) {
                    loadNextPage();
                }
            });
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

    function init() {
        state.productContainer = findProductContainer(document);
        if (!state.productContainer) {
            return;
        }

        state.nextUrl = withBatchSize(getNextUrl(document));
        if (!state.nextUrl) {
            return;
        }

        hidePagination();

        state.sentinelNode = document.createElement('div');
        state.sentinelNode.className = 'internauten-infinityscroll-sentinel';
        state.sentinelNode.style.width = '100%';
        state.sentinelNode.style.height = '1px';

        state.productContainer.parentNode.appendChild(state.sentinelNode);
        installIntersectionObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
