(function() {
    window.carbonate_dom_updating = true;
    window.carbonate_active_xhr = false;
    window.carbonate_assertion_result = false;
    const activeXhr = [];

    function log(message) {
        console.log('[' + new Date().toISOString().slice(11) + '] ' + message);
    }

    function warn(message) {
        console.warn('[' + new Date().toISOString().slice(11) + '] ' + message);
    }

    function debounce(func, delay) {
        let debounceTimer;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(context, args), delay);
        };
    }

    const markDomNotReady = () => {
        log('DOM not ready');
        window.carbonate_dom_updating = true;
    };
    const markXhrNotReady = () => {
        log('XHRs in progress');
        window.carbonate_active_xhr = true;
    };

    const markDomReady = debounce(() => {
        log('DOM ready');
        window.carbonate_dom_updating = false;
    }, 500);
    const markXhrReady = debounce(() => {
        if (activeXhr.length === 0) {
            log('XHRs done');
            window.carbonate_active_xhr = false;
        }
    }, 500);

    const removeFromXhrQueue = (url) => {
        let index = activeXhr.indexOf(url);

        if (index > -1) {
            activeXhr.splice(index, 1);
        }
        else {
            warn('XHR not found in queue', url);
        }

        markXhrReady();
    }

    const addToXhrQueue = (url) => {
        if (urlWhitelist.find(regex => regex.test(url))) {
            log('Skipping whitelisted URL', url);
        }
        else {
            activeXhr.push(url);
        }

        markXhrNotReady();
    }

    function spyOnDom() {
        log('Requesting idle callback');
        // Initial render
        requestIdleCallback(markDomReady, {
            timeout: 100,
        });

        // Observe any changes to the DOM
        const observer = new MutationObserver(() => {
            markDomNotReady();
            markDomReady();
        });
        observer.observe(document.body, {childList: true, subtree: true});
    }

    if (!window.document.body) {
        window.addEventListener('DOMContentLoaded', spyOnDom);
    }
    else {
        log('DOM already ready');
        spyOnDom();
    }

    let urlWhitelist = [];

    // Allow XHR/Fetch whitelisting
    window.carbonate_set_xhr_whitelist = (whitelist) => {
        urlWhitelist = whitelist.map(url => new RegExp(globToRegex(url)));

        for (let url of urlWhitelist) {
            let matching = activeXhr.filter(activeUrl => url.test(activeUrl));
            if (matching.length > 0) {
                warn('Whitelisted URL already in queue', url);

                for (let match of matching) {
                    removeFromXhrQueue(match);
                }
            }
        }
    }

    window.carbonate_reset_assertion_result = () => {
        window.carbonate_assertion_result = true;
    }

    window.carbonate_assert = (assertion) => {
        if (assertion === false) {
            window.carbonate_assertion_result = false;
        }
    }

    // Wrap fetches and wait until they're complete

    if (window.fetch) {
        window.fetch = (function(fetch) {
            return function (...args) {
                if (urlWhitelist.find(regex => regex.test(args[0]))) {
                    log('Whitelisted fetch', args[0]);
                    return fetch(...args);
                }

                addToXhrQueue(args[0]);
                return fetch(...args)
                    .finally(res => { removeFromXhrQueue(args[0]); return res; })
            };
        })(window.fetch);
    }

    // Wrap XHRs and wait until they're complete

    function wrapReadyStateChange(xhr, callback) {
        const wrapped = xhr.onreadystatechange;
        if (wrapped) {
            xhr.onreadystatechange = function() {
                callback(xhr);
                wrapped();
            };
        }
    }

    window.XMLHttpRequest.prototype.open = (function(open) {
        return function(...args) {
            const intercept = () => {
                switch (this.readyState) {
                    case 1:
                        addToXhrQueue(args[1]);
                        break;

                    case 4:
                        removeFromXhrQueue(args[1]);
                        break;
                }
            }


            if (urlWhitelist.find(regex => regex.test(args[1]))) {
                log('Whitelisted XHR', args[1]);
            }
            else {
                if (this.addEventListener) {
                    this.addEventListener("readystatechange", intercept, false);
                } else {
                    wrapReadyStateChange(this, intercept);
                }
            }

            open.apply(this, args);
        }
    })(window.XMLHttpRequest.prototype.open);

    // Let Carbonate query for hidden elements

    window.carbonate_getAllHiddenElements = function (el) {
        const all = el.getElementsByTagName("*");
        let hidden = [];

        for (let i = 0, max = all.length; i < max; i++) {
            if (all[i].offsetWidth === 0 && all[i].offsetHeight === 0) {
                hidden.push(getXPathForElement(all[i]));
            }
        }

        return hidden;
    }

    // Based off: https://stackoverflow.com/a/46781845/6662
    function getXPathForElement(element) {
        if (!element) return null

        if (element.tagName === 'BODY') {
            return '/html/body'
        } else {
            const sameTagSiblings = Array.from(element.parentNode.childNodes)
                .filter(e => e.nodeName === element.nodeName)
            const idx = sameTagSiblings.indexOf(element)

            return getXPathForElement(element.parentNode) +
                '/' +
                element.tagName.toLowerCase() +
                (sameTagSiblings.length > 1 ? `[${idx + 1}]` : '')
        }
    }

    window.carbonate_getElementByXpath = function(path) {
        return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }

    // The following was adapted from https://github.com/brianloveswords/urlglob
    // Copyright (c) 2013 Brian J. Brennan (MIT License)

    function globToRegex(pattern) {
        const safeLimitedGlob = '%LIMITED%' + Date.now() + '%'
        const safeGlob = '%GLOB%' + Date.now() + '%'
        const catchAll = '.*?'

        const regexp = '^' + pattern

                // we want to store all "limited globs" so we don't escape
                // them with the rest of the regexp characters
                .replace(/\*\?/g, safeLimitedGlob)

                // excape all of the rest of the regexp chars
                .replace(/([()[{+.$^\\|?])/g, '\\$1')

                .replace(/\\[*]/g, safeGlob)
                .replace(/\*/, catchAll)
                .replace(RegExp(safeGlob, 'g'), '*')
                .replace(RegExp(safeLimitedGlob, 'g'), '[^/]+')
            + '\\/?$'

        return new RegExp(regexp)
    }
})()
