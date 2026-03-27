(() => {
    const ext = globalThis.GestureExtension;
    const { createMemoryCache, translate: coreTranslate } = ext.shared.translateCore;
    const touch = ext.shared.touchCore;

    const cache = createMemoryCache({ maxSize: 200 });
    const JUNK = /[\s\d\p{P}\p{S}\p{M}\p{C}\u200B-\u200D\uFEFF]/gu;
    const TRANSLATION_PENDING = Symbol('translation-pending');
    const IS_REDDIT = window.location.hostname.includes('reddit.com');
    const REDDIT_SELECTORS = [
        'div[id$="-post-rtjson-content"]',
        '.md',
        '[data-post-click-location="text-body"] > div',
        '[slot="text-body"] div',
        '[slot="text-body"]'
    ];
    const REDDIT_TITLE_SELECTORS = [
        '[slot="title"]',
        'a[slot="title"]',
        'h1',
        'h2',
        'h3'
    ];
    const VALID_TAGS = /^(P|LI|H[1-6]|BLOCKQUOTE|TD|TH|PRE|FIGCAPTION|DIV|SPAN|A|ARTICLE|LABEL|SECTION|ASIDE|FIGURE|DETAILS|SUMMARY|CODE|NAV|HEADER|FOOTER|MAIN|MARK)$/;
    const PARAGRAPH_TAGS = /^(P|LI|BLOCKQUOTE|TD|TH|PRE|FIGCAPTION|SUMMARY)$/;
    const HEADING_TAGS = /^(H[1-6])$/;
    const CONTAINER_FALLBACK_TAGS = /^(DIV|ARTICLE|SECTION|ASIDE|FIGURE|DETAILS|MAIN)$/;

    let settings;
    let lastPointer = { x: 0, y: 0 };
    let bound = false;

    const hasMeaningfulText = (text) => text.replace(JUNK, '').length > 0;

    const normalizeBlockText = (text) => String(text || '')
        .replace(/\s+/g, ' ')
        .trim();

    const getTextKey = (text) => normalizeBlockText(text).slice(0, 240);

    const getElementText = (element) => normalizeBlockText(element?.innerText || '');
    const pointInElement = (element, x, y) => {
        if (!(element instanceof Element)) return false;
        const rect = element.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };

    const getMeaningfulChildBlocks = (element) => [...(element?.children || [])].filter((child) => {
        if (!(child instanceof HTMLElement) || child.classList.contains('gesture-inline-translate-box')) {
            return false;
        }
        const text = getElementText(child);
        return hasMeaningfulText(text) && text.length >= 24;
    });

    const isParagraphLikeCandidate = (element, text) => {
        if (!(element instanceof HTMLElement) || !VALID_TAGS.test(element.tagName)) return false;
        if (!hasMeaningfulText(text) || text.length > 2200) return false;
        if (PARAGRAPH_TAGS.test(element.tagName)) return text.length >= 20;
        if (HEADING_TAGS.test(element.tagName)) return text.length >= 60;
        if (!CONTAINER_FALLBACK_TAGS.test(element.tagName)) return false;

        const childBlocks = getMeaningfulChildBlocks(element);
        const childCount = childBlocks.length;
        const textNodes = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && normalizeBlockText(node.textContent || '').length >= 20);
        const ownParagraphChildren = childBlocks.filter((child) => PARAGRAPH_TAGS.test(child.tagName) || HEADING_TAGS.test(child.tagName));

        if (childCount === 0) return text.length >= 30;
        if (childCount === 1) return getElementText(childBlocks[0]) === text;
        if (textNodes.length > 0 && childCount <= 2) return text.length >= 40;
        if (ownParagraphChildren.length === 1 && childCount <= 2 && text.length <= 700) return true;
        return false;
    };

    const pickBetterBlock = (currentBest, candidate, candidateText, depth) => {
        const normalizedText = candidateText.slice(0, 2000);
        if (!currentBest) {
            return { text: normalizedText, node: candidate, depth };
        }

        const bestIsParagraph = PARAGRAPH_TAGS.test(currentBest.node.tagName) || HEADING_TAGS.test(currentBest.node.tagName);
        const nextIsParagraph = PARAGRAPH_TAGS.test(candidate.tagName) || HEADING_TAGS.test(candidate.tagName);

        if (nextIsParagraph && !bestIsParagraph) {
            return { text: normalizedText, node: candidate, depth };
        }

        if (nextIsParagraph === bestIsParagraph) {
            const depthDelta = currentBest.depth - depth;
            if (Math.abs(depthDelta) <= 1) {
                if (Math.abs(normalizedText.length - 280) < Math.abs(currentBest.text.length - 280)) {
                    return { text: normalizedText, node: candidate, depth };
                }
            } else if (depth < currentBest.depth) {
                return { text: normalizedText, node: candidate, depth };
            }
        }

        return currentBest;
    };

    const applyInlineTranslateCssVars = (nextSettings) => {
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty('--gesture-ilt-fs', `${nextSettings.fontScale}em`);
        rootStyle.setProperty('--gesture-ilt-fg', nextSettings.mutedColor);
    };

    const createTranslationBox = (text = '', targetNode = null) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'gesture-inline-translate-box';
        wrapper.dataset.textKey = text ? getTextKey(text) : '';

        if (IS_REDDIT) {
            const slot = targetNode?.getAttribute('slot') || 'text-body';
            wrapper.setAttribute('slot', slot);
        }

        const content = document.createElement('div');
        content.className = 'gesture-inline-translate-text';
        if (text) {
            content.textContent = text;
        } else {
            const meta = document.createElement('span');
            meta.className = 'gesture-inline-translate-meta';
            meta.textContent = 'đang dịch…';
            content.appendChild(meta);
        }

        wrapper.appendChild(content);
        return wrapper;
    };

    const isClippedContainer = (element) => {
        for (let current = element, depth = 0; current && current !== document.body && depth < 3; current = current.parentElement, depth += 1) {
            const style = window.getComputedStyle(current);
            if (/hidden|scroll|auto|clip/.test(`${style.overflow}${style.overflowY}`)) {
                return true;
            }
            if (style.maxHeight && style.maxHeight !== 'none') {
                return true;
            }
        }
        return false;
    };

    const getSafeTranslationAnchor = (node) => {
        if (!node?.parentElement) {
            return { host: node, mode: 'append' };
        }

        if (IS_REDDIT) {
            if (node.closest('h1, h2, h3, h4, [slot="title"]')) {
                return { host: node, mode: 'append' };
            }
            return { host: node, mode: 'afterend' };
        }

        if (isClippedContainer(node)) {
            return { host: node, mode: 'afterend' };
        }

        const nodeStyle = window.getComputedStyle(node);
        const parent = node.parentElement;
        const parentStyle = window.getComputedStyle(parent);
        const hasMultiElementContent = node.children.length > 1;
        const isInlineLike = /^(inline|contents)$/i.test(nodeStyle.display);
        const isFlexRow = parentStyle.display === 'flex' && !/^column/i.test(parentStyle.flexDirection || 'row');
        const isGridParent = parentStyle.display === 'grid' || parentStyle.display === 'inline-grid';

        if (isInlineLike || isFlexRow || isGridParent || hasMultiElementContent) {
            return { host: node, mode: 'afterend' };
        }

        return { host: node, mode: 'append' };
    };

    const insertTranslationBox = (node, box) => {
        const anchor = getSafeTranslationAnchor(node);
        box.__gestureSourceNode = node;
        if (anchor.mode === 'afterend') {
            anchor.host.insertAdjacentElement('afterend', box);
            return;
        }
        anchor.host.appendChild(box);
    };

    const findTranslationBox = (node) => node.querySelector(':scope > .gesture-inline-translate-box')
        || (node.nextElementSibling?.classList.contains('gesture-inline-translate-box') ? node.nextElementSibling : null);

    const findRelatedTranslationBox = (node, textKey) => {
        const direct = findTranslationBox(node);
        if (direct) return direct;
        if (!textKey) return null;

        for (const box of document.querySelectorAll(`.gesture-inline-translate-box[data-text-key="${CSS.escape(textKey)}"]`)) {
            const sourceNode = box.__gestureSourceNode;
            if (!(sourceNode instanceof Node) || !(node instanceof Node)) continue;
            if (sourceNode === node || sourceNode.contains(node) || node.contains(sourceNode)) {
                return box;
            }
        }

        return null;
    };

    const getTextBlock = (element, x = 0, y = 0) => {
        if (!element || element === document.body) {
            return null;
        }

        if (IS_REDDIT) {
            const post = element.closest('shreddit-post');
            if (post) {
                for (const selector of REDDIT_TITLE_SELECTORS) {
                    for (const candidate of post.querySelectorAll(selector)) {
                        if (!pointInElement(candidate, x, y)) continue;
                        const titleText = candidate.innerText?.trim() || '';
                        if (hasMeaningfulText(titleText)) {
                            return { text: titleText, node: candidate };
                        }
                    }
                }
            }

            const comment = element.closest('shreddit-comment');
            if (comment) {
                const candidate = comment.querySelector('.md, [slot="comment"], [id$="-rtjson-content"], [id$="-post-rtjson-content"]');
                if (candidate?.innerText.trim()) {
                    return { text: candidate.innerText.trim(), node: candidate };
                }
            }
            if (post) {
                const body = post.querySelector('shreddit-post-text-body');
                if (body) {
                    for (const selector of REDDIT_SELECTORS) {
                        const candidate = body.querySelector(selector);
                        if (candidate?.innerText.trim()) {
                            return { text: candidate.innerText.trim(), node: candidate };
                        }
                    }
                }
            }
        }

        let current = element;
        let best = null;
        let depth = 0;
        while (current && current !== document.body) {
            if (window.getComputedStyle(current).display === 'none') {
                current = current.parentElement;
                continue;
            }

            const text = getElementText(current);
            if (isParagraphLikeCandidate(current, text)) {
                best = pickBetterBlock(best, current, text, depth);
                if (PARAGRAPH_TAGS.test(current.tagName)) {
                    break;
                }
            }

            depth += 1;
            current = current.parentElement;
        }

        return best ? { text: best.text, node: best.node } : null;
    };

    const hitTestTextBlock = (x, y) => {
        for (const element of document.elementsFromPoint(x, y)) {
            if (element.closest('.gesture-inline-translate-box')) {
                continue;
            }
            const block = getTextBlock(element, x, y);
            if (block) {
                return block;
            }
        }
        return null;
    };

    const isInVideoZone = (x, y) => {
        const inRect = (element) => {
            const rect = element.getBoundingClientRect();
            return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        };

        return (
            [...document.querySelectorAll('video')].some((video) => video.offsetWidth && inRect(video)) ||
            [...document.querySelectorAll('iframe')].some((frame) => frame.offsetWidth && inRect(frame) && /youtube|vimeo|dailymotion|twitch|facebook.*video|tiktok/i.test(frame.src)) ||
            document.elementsFromPoint(x, y).some((element) => element.closest?.('video, .html5-video-player, .jwplayer, .vjs-tech, .plyr, .flowplayer'))
        );
    };

    const ensureStyles = () => {
        if (document.getElementById('gesture-inline-translate-style')) {
            return;
        }
        const style = document.createElement('style');
        style.id = 'gesture-inline-translate-style';
        style.textContent = `
            :root {
                --gesture-ilt-fs: 0.95em;
                --gesture-ilt-fg: #00bfff;
            }
            .gesture-inline-translate-box {
                display: block;
                width: 100%;
                clear: both;
                margin: 8px 0 0;
                padding-top: 6px;
                box-sizing: border-box;
                animation: gesture-inline-translate-fade-in 0.2s ease;
            }
            .gesture-inline-translate-text {
                color: var(--gesture-ilt-fg);
                white-space: pre-wrap;
                font: italic var(--gesture-ilt-fs)/1.6 system-ui;
                padding: 6px 12px;
            }
            .gesture-inline-translate-meta {
                opacity: 0.6;
                font-size: 0.75em;
                animation: gesture-inline-translate-pulse 1s infinite;
            }
            @keyframes gesture-inline-translate-fade-in {
                from { opacity: 0; transform: translateY(-5px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes gesture-inline-translate-pulse {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 0.2; }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    };

    const translateText = async (text) => {
        const cached = cache.get(text);
        const now = Date.now();

        if (cached?.result) {
            if (now - cached.ts < settings.dedupeSeconds * 1000) {
                return cached.result;
            }
            cache.set(text, { result: cached.result, ts: now });
            return cached.result;
        }

        if (cached && now - cached.ts < settings.dedupeSeconds * 1000) {
            return TRANSLATION_PENDING;
        }

        cache.set(text, { result: null, ts: now });

        const translatedText = await coreTranslate(text, {
            cache: null,
            provider: settings.provider,
            cleanResult: true
        });

        if (!translatedText) {
            throw new Error('Không có nội dung dịch trả về');
        }

        cache.set(text, { result: translatedText, ts: Date.now() });

        return translatedText;
    };

    const toggleTranslationAtPoint = async (x, y) => {
        const hit = hitTestTextBlock(x, y);
        if (!hit || !hasMeaningfulText(hit.text)) {
            return;
        }

        const textKey = getTextKey(hit.text);
        const existing = findRelatedTranslationBox(hit.node, textKey);
        if (existing) {
            existing.remove();
            return;
        }

        const box = createTranslationBox(hit.text, hit.node);
        insertTranslationBox(hit.node, box);

        try {
            const translatedText = await translateText(hit.text);
            if (translatedText === TRANSLATION_PENDING) {
                box.firstElementChild.textContent = '⏳ Đang dịch, thử lại sau';
                box.firstElementChild.style.color = '#ffd166';
                box.firstElementChild.style.fontStyle = 'normal';
                box.firstElementChild.style.fontSize = '0.8em';
                window.setTimeout(() => box.remove(), 1500);
                return;
            }

            if (!translatedText) {
                box.firstElementChild.textContent = '⚠ Không có nội dung dịch';
                box.firstElementChild.style.color = '#ff6b6b';
                box.firstElementChild.style.fontStyle = 'normal';
                box.firstElementChild.style.fontSize = '0.8em';
                window.setTimeout(() => box.remove(), 3000);
                return;
            }

            box.firstElementChild.textContent = translatedText;
        } catch (error) {
            box.firstElementChild.textContent = `⚠ ${String(error.message || 'Unknown error').slice(0, 80)}`;
            box.firstElementChild.style.color = '#ff6b6b';
            box.firstElementChild.style.fontStyle = 'normal';
            box.firstElementChild.style.fontSize = '0.8em';
            window.setTimeout(() => box.remove(), 5000);
        }
    };

    ext.features.inlineTranslate = {
        shouldRun: ({ getConfig, runtime }) => runtime.isHttpPage() && !!getConfig()?.inlineTranslate?.enabled,
        init: ({ getConfig }) => {
            const body = document.body;
            if (window.top !== window || body?.dataset?.gestureInlineTranslateMounted === 'true') {
                return {
                    onConfigChange() { },
                    destroy() { }
                };
            }

            settings = getConfig().inlineTranslate;
            ensureStyles();
            applyInlineTranslateCssVars(settings);
            if (body?.dataset) {
                body.dataset.gestureInlineTranslateMounted = 'true';
            }

            const onMouseMove = (event) => {
                lastPointer = touch.getPrimaryPoint(event);
            };

            const onKeyDown = (event) => {
                const activeElement = document.activeElement;
                if (
                    activeElement instanceof HTMLElement &&
                    (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)
                ) {
                    return;
                }

                const hotkey = settings.hotkey;
                const matches =
                    (hotkey === 'f2' && event.code === 'F2') ||
                    (hotkey === 'f4' && event.code === 'F4') ||
                    (hotkey === 'f8' && event.code === 'F8');

                if (!matches) {
                    return;
                }

                event.preventDefault();
                toggleTranslationAtPoint(lastPointer.x, lastPointer.y);
            };

            let startX = 0;
            let startY = 0;
            let startTime = 0;
            let startedInVideo = false;

            const onTouchStart = (event) => {
                if (!settings.swipeEnabled || event.touches.length !== 1) {
                    return;
                }
                const point = touch.getPrimaryPoint(event);
                startX = point.x;
                startY = point.y;
                startTime = Date.now();
                startedInVideo = isInVideoZone(startX, startY);
            };

            const onTouchEnd = (event) => {
                if (!settings.swipeEnabled || !startX || Date.now() - startTime > 500) {
                    startX = 0;
                    return;
                }

                const point = touch.getPrimaryPoint(event);
                const endX = point.x;
                const endY = point.y;

                if (startedInVideo || isInVideoZone(endX, endY)) {
                    startX = 0;
                    return;
                }

                const deltaX = endX - startX;
                const deltaY = endY - startY;
                startX = 0;

                const validDirection =
                    settings.swipeDir === 'both' ||
                    (settings.swipeDir === 'right' && deltaX > 0) ||
                    (settings.swipeDir === 'left' && deltaX < 0);

                if (
                    Math.abs(deltaX) > settings.swipePx &&
                    Math.abs(deltaY) < Math.abs(deltaX) * settings.swipeSlopeMax &&
                    validDirection
                ) {
                    toggleTranslationAtPoint(endX - deltaX / 2, endY - deltaY / 2);
                }
            };

            if (!bound) {
                document.addEventListener('mousemove', onMouseMove, { passive: true });
                document.addEventListener('keydown', onKeyDown, true);
                document.addEventListener('touchstart', onTouchStart, { passive: true });
                document.addEventListener('touchend', onTouchEnd, { passive: true });
                bound = true;
            }

            return {
                onConfigChange(nextConfig) {
                    settings = nextConfig.inlineTranslate;
                    applyInlineTranslateCssVars(settings);
                },
                destroy() {
                    document.removeEventListener('mousemove', onMouseMove, { passive: true });
                    document.removeEventListener('keydown', onKeyDown, true);
                    document.removeEventListener('touchstart', onTouchStart, { passive: true });
                    document.removeEventListener('touchend', onTouchEnd, { passive: true });
                    bound = false;
                }
            };
        }
    };
})();
