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
        if (el.offsetWidth === 0 && el.offsetHeight === 0) {
            return [el];
        }

        let children = Array.from(el.children);
        let hiddenChildren = children.map(window.carbonate_getAllHiddenElements).flat();

        return hiddenChildren;
    }

    /**
     @license
     Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
     This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
     The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
     The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
     Code distributed by Google as part of the polymer project is also
     subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
     */
    // https://github.com/webcomponents/polyfills/blob/90cb97f847ce918289dac0978c50dcda0a0afd72/packages/shadydom/src/innerHTML.js (with modifications)

    // http://www.whatwg.org/specs/web-apps/current-work/multipage/the-end.html#escapingString
    let escapeAttrRegExp = /[&\u00A0"]/g;
    let escapeDataRegExp = /[&\u00A0<>]/g;

    function escapeReplace(c) {
        switch (c) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case '\u00A0':
                return '&nbsp;';
        }
    }

    function escapeAttr(s) {
        return s.replace(escapeAttrRegExp, escapeReplace);
    }

    function escapeData(s) {
        return s.replace(escapeDataRegExp, escapeReplace);
    }

    function makeSet(arr) {
        let set = {};
        for (let i = 0; i < arr.length; i++) {
            set[arr[i]] = true;
        }
        return set;
    }

    // http://www.whatwg.org/specs/web-apps/current-work/#void-elements
    let voidElements = makeSet([
        'area',
        'base',
        'br',
        'col',
        'command',
        'embed',
        'hr',
        'img',
        'input',
        'keygen',
        'link',
        'meta',
        'param',
        'source',
        'track',
        'wbr',
    ]);

    let plaintextParents = makeSet([
        'xmp',
        'iframe',
        'noembed',
        'noframes',
        'plaintext',
        'noscript',
    ]);

    const tagBlacklist = {
        '!doctype': true,
        '!--': true,
        'base': true,
        'style': true,
        'rel': true,
        'link': true,
        'script': true,
        'noscript': true,
        'title': true,
        'head': true,
        'form': [
            'accept-charset',
            'enctype',
            'novalidate',
        ],
        'iframe': [
            'allow',
        ],
        'a': [
            'target',
        ],
        'meter': [
            'high',
            'low',
            'max',
            'min',
            'optimum',
        ],
        'audio': [
            'autoplay',
            'controls',
            'loop',
            'muted',
            'preload',
            'buffered',
        ],
        'video': [
            'autoplay',
            'controls',
            'loop',
            'muted',
            'preload',
            'buffered',
            'playsinline',
        ],
        'applet': [
            'code',
        ],
        'table': [
            'colspan',
            'rowspan',
        ],
        'meta': true,
        'area': true,
        'svg': [
            'xmlns',
            'xmlns:xlink',
            'version',
            'baseprofile',
            'viewbox',
            'preserveaspectratio',
            'x',
            'y',
            'fill',
            'stroke',
            'stroke-width',
            'stroke-linecap',
            'stroke-linejoin',
            'stroke-miterlimit',
            'stroke-dasharray',
            'stroke-dashoffset',
            'stroke-opacity',
            'fill-rule',
            'clip-rule',
            'opacity',
            'enable-background',
            'transform',
            'color',
            'color-interpolation',
            'color-interpolation-filters',
            'color-profile',
            'color-rendering',
            'cursor',
            'direction',
            'display',
            'dominant-baseline',
            'image-rendering',
            'letter-spacing',
            'pointer-events',
            'shape-rendering',
            'text-anchor',
            'text-decoration',
            'text-rendering',
            'unicode-bidi',
            'visibility',
            'word-spacing',
            'writing-mode',
            'externalresourcesrequired',
        ],
        'path': true,
        'object': true,
        'img': [
            'decoding',
            'ismap',
        ],
        'textarea': [
            'rows',
            'cols',
            'wrap',
        ],
        'track': true,
        '*': [
            'align',
            'autocapitalize',
            'autocomplete',
            'autocorrect',
            'autofocus',
            'background',
            'bgcolor',
            'border',
            'dir',
            'cite',
            'crossorigin',
            'csp',
            'height',
            'spellcheck',
            'style',
            'shape',
            'lang',
            'language',
            'loading',
            'maxlength',
            'minlength',
            'referrerpolicy',
            'rel',
            'slot',
            'translate',
            'valign',
            'width',
        ],
    }

    const childBlacklist = makeSet([
        'svg',
    ]);

    /**
     * @param {Node} node
     * @param {Node} parentNode
     * @param {Function=} callback
     */
    window.carbonate_getOuterHTML = function(node, parentNode, callback) {
        if (node.offsetWidth === 0 && node.offsetHeight === 0) {
            return '';
        }

        switch (node.nodeType) {
            case Node.ELEMENT_NODE: {
                let tagName = node.localName;

                if (tagBlacklist[tagName] === true) {
                    console.debug('Skipping tag', tagName);
                    return '';
                }

                let s = '<' + tagName;
                let attrs = node.attributes;
                for (let i = 0, attr; (attr = attrs[i]); i++) {
                    let isData = attr.value.indexOf('data:') === 0;
                    let isBlacklist = tagBlacklist[tagName] && tagBlacklist[tagName].indexOf(attr.name) !== -1;
                    let isGlobalBlacklist = tagBlacklist['*'] && tagBlacklist['*'].indexOf(attr.name) !== -1;
                    if (isGlobalBlacklist || isBlacklist || isData) {
                        console.debug('Skipping attribute', attr.name, 'on', tagName);
                        continue;
                    }
                    s += ' ' + attr.name + '="' + escapeAttr(attr.value) + '"';
                }
                s += '>';
                if (voidElements[tagName]) {
                    return s;
                }
                if (childBlacklist[tagName]) {
                    console.debug('Skipping children of', tagName);
                    return s + '</' + tagName + '>';
                }
                return s + window.carbonate_getInnerHTML(node, callback) + '</' + tagName + '>';
            }
            case Node.TEXT_NODE: {
                let data = /** @type {Text} */ (node).data;
                if (parentNode && plaintextParents[parentNode.localName]) {
                    return data;
                }
                return escapeData(data);
            }
            case Node.COMMENT_NODE: {
                return '<!--' + /** @type {Comment} */ (node).data + '-->';
            }
            default: {
                window.console.error(node);
                throw new Error('not implemented');
            }
        }
    }

    /**
     * @param {Node} node
     * @param {Function=} callback
     */
    window.carbonate_getInnerHTML = function(node, callback) {
        let shadowRoot = node.shadowRoot;

        if (shadowRoot) {
            node = shadowRoot
        }

        if (node.localName === 'template') {
            node = /** @type {HTMLTemplateElement} */ (node).content;
        }
        let s = '';
        let c$ = callback ? callback(node) : node.childNodes;
        for (let i = 0, l = c$.length, child; i < l && (child = c$[i]); i++) {
            s += window.carbonate_getOuterHTML(child, node, callback);
        }
        return shadowRoot ? `<template shadowroot="${shadowRoot.mode}">${s}</template>` : s;
    }
    window.carbonate_getOuterHTML(window.document.body);

    // END OF SHADYDOM CODE

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
