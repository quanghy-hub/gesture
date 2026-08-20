(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});
    const { JUNK, IS_REDDIT, REDDIT_SELECTORS, REDDIT_TITLE_SELECTORS, VALID_TAGS, PARAGRAPH_TAGS, HEADING_TAGS, CONTAINER_FALLBACK_TAGS } =
        inlineTranslate;

    const hasMeaningfulText = (text) => text.replace(JUNK, '').length > 0;
    const normalizeBlockText = (text) =>
        String(text || '')
            .replace(/\s+/g, ' ')
            .trim();
    const getTextKey = (text) => normalizeBlockText(text).slice(0, 240);
    const getElementText = (element) => normalizeBlockText(element?.innerText || '');

    const getMeaningfulChildBlocks = (element) =>
        [...(element?.children || [])].filter((child) => {
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
        const textNodes = [...element.childNodes].filter(
            (node) => node.nodeType === Node.TEXT_NODE && normalizeBlockText(node.textContent || '').length >= 20
        );
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

    const isClippedContainer = (element) => {
        for (
            let current = element, depth = 0;
            current && current !== document.body && depth < 3;
            current = current.parentElement, depth += 1
        ) {
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

    const pointInElement = (element, x, y) => {
        if (!(element instanceof Element)) {
            return false;
        }
        const rect = element.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };

    const FLAIR_SELECTOR = '[slot="flair"], [data-testid*="flair" i], .flair, [id*="flair" i], faceplate-hovercard';

    const isFlairElement = (element) => {
        if (!(element instanceof Element)) return false;
        return !!element.matches?.(FLAIR_SELECTOR) || !!element.closest?.(FLAIR_SELECTOR);
    };

    const getRedditCommentBlock = (comment, originElement, x, y) => {
        if (!(comment instanceof Element)) return null;
        const selectors = [
            '[slot="comment"]',
            'div[id$="-comment-rtjson-content"]',
            'div[id$="-rtjson-content"]',
            '.md',
            '[data-click-id="text"]',
            'p'
        ];
        const seen = new Set();
        const candidates = [];
        for (const selector of selectors) {
            for (const el of comment.querySelectorAll(selector)) {
                if (seen.has(el)) continue;
                seen.add(el);
                if (isFlairElement(el)) continue;
                const raw = el.innerText || el.textContent || '';
                const text = normalizeBlockText(raw);
                if (!text || !hasMeaningfulText(text)) continue;
                if (text.length < 24) continue;
                if (el.closest?.('header, [slot="commentMeta"], [slot="authorName"], faceplate-tracker')) {
                    if (text.length < 50) continue;
                }
                candidates.push({ el, text });
            }
        }
        if (candidates.length) {
            for (const candidate of candidates) {
                if (pointInElement(candidate.el, x, y)) {
                    return { text: candidate.text, node: candidate.el };
                }
            }
            candidates.sort((a, b) => b.text.length - a.text.length);
            return { text: candidates[0].text, node: candidates[0].el };
        }
        let current = originElement;
        while (current && current !== comment) {
            if (current instanceof HTMLElement && !isFlairElement(current)) {
                const t = normalizeBlockText(current.innerText || current.textContent || '');
                if (hasMeaningfulText(t) && t.length >= 30 && isParagraphLikeCandidate(current, t)) {
                    return { text: t, node: current };
                }
            }
            current = current.parentElement;
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
                        if (isFlairElement(candidate)) continue;
                        if (!pointInElement(candidate, x, y)) continue;
                        const titleText = normalizeBlockText(candidate.innerText || candidate.textContent || '');
                        if (hasMeaningfulText(titleText)) {
                            return { text: titleText, node: candidate };
                        }
                    }
                }
            }
            const comment = element.closest('shreddit-comment');
            if (comment) {
                const redditCommentBlock = getRedditCommentBlock(comment, element, x, y);
                if (redditCommentBlock) {
                    return redditCommentBlock;
                }
            }
            if (post) {
                const body = post.querySelector('shreddit-post-text-body');
                if (body) {
                    for (const selector of REDDIT_SELECTORS) {
                        const candidate = body.querySelector(selector);
                        if (!candidate || isFlairElement(candidate)) continue;
                        const bodyText = normalizeBlockText(candidate.innerText || candidate.textContent || '');
                        if (hasMeaningfulText(bodyText)) {
                            return { text: bodyText, node: candidate };
                        }
                    }
                }
            }
        }

        let current = element;
        let best = null;
        let depth = 0;
        while (current && current !== document.body) {
            if (IS_REDDIT && isFlairElement(current)) {
                current = current.parentElement;
                depth += 1;
                continue;
            }
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
            [...document.querySelectorAll('iframe')].some(
                (frame) => frame.offsetWidth && inRect(frame) && /youtube|vimeo|dailymotion|twitch|facebook.*video|tiktok/i.test(frame.src)
            ) ||
            document
                .elementsFromPoint(x, y)
                .some((element) => element.closest?.('video, .html5-video-player, .jwplayer, .vjs-tech, .plyr, .flowplayer'))
        );
    };

    inlineTranslate.textBlockDetector = {
        hasMeaningfulText,
        normalizeBlockText,
        getTextKey,
        getElementText,
        getMeaningfulChildBlocks,
        isParagraphLikeCandidate,
        pickBetterBlock,
        isClippedContainer,
        pointInElement,
        getTextBlock,
        hitTestTextBlock,
        isInVideoZone,
        isFlairElement,
        getRedditCommentBlock
    };
})();
