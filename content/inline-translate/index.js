(() => {
    const ext = globalThis.GestureExtension;
    const { createMemoryCache, translate: coreTranslate } = ext.shared.translateCore;

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
    const VALID_TAGS = /^(P|LI|H[1-6]|BLOCKQUOTE|TD|TH|PRE|FIGCAPTION|DIV|SPAN|A|ARTICLE|LABEL|SECTION|ASIDE|FIGURE|DETAILS|SUMMARY|CODE|NAV|HEADER|FOOTER|MAIN|MARK)$/;

    let settings;
    let lastPointer = { x: 0, y: 0 };
    let bound = false;

    const hasMeaningfulText = (text) => text.replace(JUNK, '').length > 0;

    const cleanTranslatedText = (text) => String(text || '')
        .replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gmu, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();



    const applyInlineTranslateCssVars = (nextSettings) => {
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty('--gesture-ilt-fs', `${nextSettings.fontScale}em`);
        rootStyle.setProperty('--gesture-ilt-fg', nextSettings.mutedColor);
    };

    const createTranslationBox = (text = '', targetNode = null) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'gesture-inline-translate-box';

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
        if (anchor.mode === 'afterend') {
            anchor.host.insertAdjacentElement('afterend', box);
            return;
        }
        anchor.host.appendChild(box);
    };

    const findTranslationBox = (node) => node.querySelector(':scope > .gesture-inline-translate-box')
        || (node.nextElementSibling?.classList.contains('gesture-inline-translate-box') ? node.nextElementSibling : null);

    const getTextBlock = (element) => {
        if (!element || element === document.body) {
            return null;
        }

        if (IS_REDDIT) {
            const comment = element.closest('shreddit-comment');
            if (comment) {
                const candidate = comment.querySelector('.md, [slot="comment"], [id$="-rtjson-content"], [id$="-post-rtjson-content"]');
                if (candidate?.innerText.trim()) {
                    return { text: candidate.innerText.trim(), node: candidate };
                }
            }

            const post = element.closest('shreddit-post');
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
        while (current && current !== document.body) {
            if (window.getComputedStyle(current).display === 'none') {
                current = current.parentElement;
                continue;
            }

            const text = current.innerText?.trim() || '';
            if (VALID_TAGS.test(current.tagName) && text.length > 0 && text.length < 5000) {
                if (current.tagName === 'DIV' && text.length > 500 && current.children.length > 5) {
                    const child = [...current.children].find((candidate) => {
                        const childText = candidate.innerText?.trim() || '';
                        return VALID_TAGS.test(candidate.tagName) && childText.length > 0 && childText.length < 500;
                    });

                    if (child) {
                        return {
                            text: child.innerText.trim(),
                            node: child
                        };
                    }
                }

                return {
                    text: text.slice(0, 2000),
                    node: current
                };
            }

            current = current.parentElement;
        }

        return null;
    };

    const hitTestTextBlock = (x, y) => {
        for (const element of document.elementsFromPoint(x, y)) {
            if (element.closest('.gesture-inline-translate-box')) {
                continue;
            }
            const block = getTextBlock(element);
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

        const existing = findTranslationBox(hit.node);
        if (existing) {
            existing.remove();
            return;
        }

        const box = createTranslationBox('', hit.node);
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
                lastPointer = { x: event.clientX, y: event.clientY };
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
                startX = event.touches[0].clientX;
                startY = event.touches[0].clientY;
                startTime = Date.now();
                startedInVideo = isInVideoZone(startX, startY);
            };

            const onTouchEnd = (event) => {
                if (!settings.swipeEnabled || !startX || Date.now() - startTime > 500) {
                    startX = 0;
                    return;
                }

                const endX = event.changedTouches[0].clientX;
                const endY = event.changedTouches[0].clientY;

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