(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = ext.inlineTranslate = ext.inlineTranslate || {};
    const { IS_REDDIT } = inlineTranslate;
    const detector = inlineTranslate.textBlockDetector;
    const selectionPanel = inlineTranslate.editableSelectionPanel;

    const { normalizeBlockText, getTextKey, isClippedContainer } = detector;

    const collectTextTypography = (element, bucket) => {
        if (!(element instanceof Element)) {
            return;
        }

        const style = window.getComputedStyle(element);
        const fontSize = parseFloat(style.fontSize);
        const lineHeight = parseFloat(style.lineHeight);
        const text = normalizeBlockText(element.textContent || '');

        if (text) {
            bucket.push({
                element,
                textLength: text.length,
                fontSize: Number.isFinite(fontSize) ? fontSize : null,
                lineHeight: Number.isFinite(lineHeight) ? lineHeight : null
            });
        }

        for (const child of element.children) {
            collectTextTypography(child, bucket);
        }
    };

    const getSourceTypography = (element) => {
        if (!(element instanceof Element)) {
            return null;
        }

        const preferred = element.matches?.(
            '#content-text, yt-formatted-string, [id="content-text"], [class*="comment"], [class*="content"]'
        )
            ? element
            : element.querySelector?.('#content-text, yt-formatted-string');

        const candidates = [];
        collectTextTypography(preferred || element, candidates);

        if (candidates.length === 0) {
            const style = window.getComputedStyle(element);
            const fontSize = parseFloat(style.fontSize);
            const lineHeight = parseFloat(style.lineHeight);
            return {
                fontSize: Number.isFinite(fontSize) ? fontSize : null,
                lineHeight: Number.isFinite(lineHeight) ? lineHeight : null
            };
        }

        candidates.sort((left, right) => {
            if ((right.fontSize || 0) !== (left.fontSize || 0)) {
                return (right.fontSize || 0) - (left.fontSize || 0);
            }
            return right.textLength - left.textLength;
        });

        const best = candidates[0];
        return {
            fontSize: best.fontSize,
            lineHeight: best.lineHeight
        };
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

    inlineTranslate.dom = {
        hasMeaningfulText: detector.hasMeaningfulText,
        normalizeBlockText: detector.normalizeBlockText,
        getTextKey: detector.getTextKey,
        applyInlineTranslateCssVars(nextSettings) {
            const rootStyle = document.documentElement.style;
            rootStyle.setProperty('--gesture-ilt-fs', `${nextSettings.fontScale}em`);
            rootStyle.setProperty('--gesture-ilt-fg', nextSettings.mutedColor);
        },
        ensureStyles() {
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
                .gesture-inline-translate-selection-panel {
                    position: fixed;
                    display: none;
                    min-width: 180px;
                    max-width: min(360px, calc(100vw - 16px));
                    padding: 10px 12px;
                    border-radius: 12px;
                    background: rgba(15, 23, 42, 0.98);
                    color: #f8fafc;
                    box-shadow: 0 14px 36px rgba(2, 6, 23, 0.35);
                    z-index: 2147483647;
                    pointer-events: auto;
                    user-select: none;
                    animation: gesture-inline-translate-fade-in 0.16s ease;
                }
                .gesture-inline-translate-selection-panel[data-mode="result"] {
                    cursor: pointer;
                }
                .gesture-inline-translate-selection-meta {
                    margin-bottom: 6px;
                    font: 600 11px/1.25 system-ui;
                    letter-spacing: 0.02em;
                    color: rgba(148, 163, 184, 0.95);
                }
                .gesture-inline-translate-selection-panel[data-mode="result"] .gesture-inline-translate-selection-meta {
                    color: rgba(125, 211, 252, 0.95);
                }
                .gesture-inline-translate-selection-panel[data-mode="loading"] .gesture-inline-translate-selection-meta {
                    color: #facc15;
                }
                .gesture-inline-translate-selection-panel[data-mode="error"] .gesture-inline-translate-selection-meta {
                    color: #fca5a5;
                }
                .gesture-inline-translate-selection-text {
                    white-space: pre-wrap;
                    font: 500 13px/1.45 system-ui;
                    color: #f8fafc;
                    word-break: break-word;
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
        },
        createTranslationBox(text = '', targetNode = null) {
            const wrapper = document.createElement('div');
            wrapper.className = 'gesture-inline-translate-box';
            wrapper.dataset.textKey = text ? getTextKey(text) : '';
            if (IS_REDDIT) {
                const slot = targetNode?.getAttribute('slot') || 'text-body';
                wrapper.setAttribute('slot', slot);
            }
            const content = document.createElement('div');
            content.className = 'gesture-inline-translate-text';
            const typography = getSourceTypography(targetNode);
            if (typography?.fontSize) {
                content.style.fontSize = `${Math.max(typography.fontSize * 0.95, 12)}px`;
            }
            if (typography?.lineHeight) {
                content.style.lineHeight = `${Math.max(typography.lineHeight * 0.98, typography.fontSize || 0)}px`;
            }
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
        },
        insertTranslationBox(node, box) {
            const anchor = getSafeTranslationAnchor(node);
            box.__gestureSourceNode = node;
            if (anchor.mode === 'afterend') {
                anchor.host.insertAdjacentElement('afterend', box);
            } else {
                anchor.host.appendChild(box);
            }
        },
        findTranslationBox(node) {
            return node.querySelector(':scope > .gesture-inline-translate-box')
                || (node.nextElementSibling?.classList.contains('gesture-inline-translate-box') ? node.nextElementSibling : null);
        },
        findRelatedTranslationBox(node, textKey) {
            const direct = this.findTranslationBox(node);
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
        },
        showEditableSelectionLoading: selectionPanel.showEditableSelectionLoading.bind(selectionPanel),
        showEditableSelectionResult: selectionPanel.showEditableSelectionResult.bind(selectionPanel),
        showEditableSelectionError: selectionPanel.showEditableSelectionError.bind(selectionPanel),
        repositionEditableSelectionPanel: selectionPanel.repositionEditableSelectionPanel.bind(selectionPanel),
        hideEditableSelectionPanel: selectionPanel.hideEditableSelectionPanel.bind(selectionPanel),
        isEventInsideEditableSelectionPanel: selectionPanel.isEventInsideEditableSelectionPanel.bind(selectionPanel),
        getTextBlock: detector.getTextBlock,
        hitTestTextBlock: detector.hitTestTextBlock,
        isInVideoZone: detector.isInVideoZone
    };
})();
