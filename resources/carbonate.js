(function() {
    window.__dom_updating = true;
    window.__active_xhr = false;

    function debounce(func, delay) {
        let debounceTimer;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(context, args), delay);
        };
    }

    const markDomNotReady = () => { console.log('DOM not ready'); window.__dom_updating = true; };
    const markXhrNotReady = () => { console.log('XHRs in progress'); window.__active_xhr = true; };

    const markDomReady = debounce(() => { console.log('DOM ready'); window.__dom_updating = false; }, 500);
    const markXhrReady = debounce(() => { console.log('XHRs done'); window.__active_xhr = false; }, 500);

    function spyOnDom() {
        // Initial render
        requestIdleCallback(markDomReady);

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
        spyOnDom();
    }

    let urlWhitelist = [];

    // Allow XHR/Fetch whitelisting
    window.__set_xhr_whitelist = (whitelist) => {
        urlWhitelist = whitelist.map(url => new RegExp(globToRegex(url)));
    }

    // Wrap fetches and wait until they're complete

    if (window.fetch) {
        window.fetch = (function(fetch) {
            return function (...args) {
                if (urlWhitelist.find(regex => regex.test(args[0]))) {
                    console.log('Whitelisted fetch', args[0]);
                    return fetch(...args);
                }

                markXhrNotReady();
                return fetch(...args)
                    .then(res => { markXhrReady(); return res; })
                    .catch(res => { markXhrReady(); return res; });
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

    const activeXhr = [];
    window.XMLHttpRequest.prototype.open = (function(open) {
        return function(...args) {
            const intercept = () => {
                switch (this.readyState) {
                    case 1:
                        activeXhr.push(this);
                        markXhrNotReady();
                        break;

                    case 4:
                        const i = activeXhr.indexOf(this);

                        if (i > -1) {
                            activeXhr.splice(i, 1);
                        }

                        if (activeXhr.length === 0) {
                            markXhrReady();
                        }

                        break;
                }
            }


            if (urlWhitelist.find(regex => regex.test(args[1]))) {
                console.log('Whitelisted XHR', args[1]);
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

    window.__getAllHiddenElements = function (el) {
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
