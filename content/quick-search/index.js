(() => {
    const ext = globalThis.GestureExtension;

    const CONFIG = {
        maxProviders: 8,
        columns: 5,
        selectionDelay: 300,
        textBubbleOffsetY: 36,
        imageBubbleOffsetY: 8,
        hoverDelay: 120,
        hideDelay: 220
    };

    const DEFAULT_SETTINGS = {
        providers: [
            {
                name: 'Google',
                url: 'https://www.google.com/search?q={{q}}',
                icon: 'https://www.google.com/favicon.ico'
            },
            {
                name: 'YouTube',
                url: 'https://www.youtube.com/results?search_query={{q}}',
                icon: 'https://www.youtube.com/favicon.ico'
            },
            {
                name: 'DuckDuckGo',
                url: 'https://duckduckgo.com/?q={{q}}',
                icon: 'https://duckduckgo.com/favicon.ico'
            },
            {
                name: 'Bing',
                url: 'https://www.bing.com/search?q={{q}}',
                icon: 'https://www.bing.com/favicon.ico'
            },
            {
                name: 'Ảnh Google',
                url: 'https://www.google.com/search?tbm=isch&q={{q}}',
                icon: 'https://www.google.com/favicon.ico'
            },
            {
                name: 'Perplexity',
                url: 'https://www.perplexity.ai/?q={{q}}',
                icon: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=32'
            }
        ],
        imageProviders: [
            {
                name: 'Google Lens',
                url: 'https://lens.google.com/uploadbyurl?url={{img}}',
                icon: 'https://www.google.com/favicon.ico'
            },
            {
                name: 'Bing Visual',
                url: 'https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIIDP&q=imgurl:{{img}}',
                icon: 'https://www.bing.com/favicon.ico'
            },
            {
                name: 'Yandex Images',
                url: 'https://yandex.com/images/search?rpt=imageview&url={{img}}',
                icon: 'https://yandex.com/favicon.ico'
            }
        ]
    };

    let uiHost;
    let uiShadow;
    let uiLayer;

    const createFallbackIcon = (label) => {
        const fallback = document.createElement('span');
        fallback.className = 'gesture-quick-search-glyph';
        fallback.textContent = label?.trim()?.[0] || '🔗';
        return fallback;
    };

    const createIconElement = (item) => {
        if (item.glyph) {
            return createFallbackIcon(item.glyph);
        }

        if (item.icon) {
            const image = document.createElement('img');
            image.src = item.icon;
            image.alt = '';
            image.addEventListener('error', () => {
                image.replaceWith(createFallbackIcon(item.label));
            }, { once: true });
            return image;
        }

        return createFallbackIcon(item.label);
    };

    const ensureUiRoot = () => {
        if (uiLayer?.isConnected) {
            return uiLayer;
        }

        uiHost = document.createElement('div');
        uiHost.id = 'gesture-quick-search-ui-host';
        uiShadow = uiHost.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            :host { all: initial; }
            .gesture-quick-search-ui-root {
                position: fixed;
                inset: 0;
                z-index: 2147483646;
                pointer-events: none;
                font-family: Inter, Arial, sans-serif;
                color: #eee;
                line-height: 1;
                text-transform: none;
                letter-spacing: normal;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
            .gesture-quick-search-ui-root,
            .gesture-quick-search-ui-root *,
            .gesture-quick-search-ui-root *::before,
            .gesture-quick-search-ui-root *::after {
                box-sizing: border-box;
            }
            .gesture-quick-search-bubble {
                position: fixed;
                z-index: 1;
                display: none;
                padding: 1px;
                border-radius: 8px;
                background: #1a1a1a;
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
                pointer-events: auto;
            }
            .gesture-quick-search-grid {
                display: grid;
                gap: 1px;
            }
            .gesture-quick-search-item {
                appearance: none;
                -webkit-appearance: none;
                width: 28px;
                height: 28px;
                min-width: 28px;
                min-height: 28px;
                margin: 0;
                padding: 0;
                border: none;
                border-radius: 5px;
                background: transparent;
                color: #eee;
                display: flex;
                align-items: center;
                justify-content: center;
                font: inherit;
                line-height: 1;
                text-align: center;
                vertical-align: middle;
                cursor: pointer;
                transition: background 0.15s ease;
            }
            .gesture-quick-search-item:hover {
                background: rgba(255, 255, 255, 0.15);
            }
            .gesture-quick-search-item img {
                width: 18px;
                height: 18px;
                display: block;
                flex: 0 0 auto;
                object-fit: contain;
                margin: 0;
                padding: 0;
                border: 0;
                vertical-align: middle;
            }
            .gesture-quick-search-glyph {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 18px;
                height: 18px;
                flex: 0 0 auto;
                color: #eee;
                font-family: 'Segoe UI Symbol', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
                font-size: 18px;
                font-weight: 400;
                line-height: 1;
                text-align: center;
                letter-spacing: 0;
            }
            .gesture-quick-search-toast {
                position: fixed;
                z-index: 2;
                padding: 6px 12px;
                border-radius: 6px;
                background: #222;
                color: #fff;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                font-size: 12px;
                line-height: 1.4;
                pointer-events: none;
                max-width: 320px;
                word-break: break-word;
                white-space: pre-wrap;
            }
            .gesture-quick-search-clipboard-panel {
                position: fixed;
                z-index: 3;
                display: none;
                width: min(340px, calc(100vw - 16px));
                max-height: min(360px, calc(100vh - 16px));
                overflow: auto;
                padding: 8px;
                border-radius: 12px;
                background: rgba(17, 24, 39, 0.98);
                box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
                pointer-events: auto;
            }
            .gesture-quick-search-clipboard-title {
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                opacity: 0.72;
                margin: 2px 4px 8px;
            }
            .gesture-quick-search-clipboard-item {
                width: 100%;
                margin: 0 0 6px;
                padding: 8px 10px;
                border: none;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.08);
                color: #f3f4f6;
                text-align: left;
                font: inherit;
                line-height: 1.35;
                cursor: pointer;
                white-space: pre-wrap;
                word-break: break-word;
            }
            .gesture-quick-search-clipboard-item:hover {
                background: rgba(255, 255, 255, 0.14);
            }
            .gesture-quick-search-clipboard-empty {
                padding: 8px 10px;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.05);
                font-size: 12px;
                line-height: 1.4;
                opacity: 0.75;
            }
        `;

        uiLayer = document.createElement('div');
        uiLayer.className = 'gesture-quick-search-ui-root';
        uiShadow.append(style, uiLayer);
        document.documentElement.appendChild(uiHost);
        return uiLayer;
    };

    const applyBubblePosition = (bubble, x, y) => {
        const width = bubble.offsetWidth;
        const height = bubble.offsetHeight;
        const centeredLeft = x - (width / 2);
        const clampedLeft = Math.max(6, Math.min(centeredLeft, window.innerWidth - width - 6));
        const clampedTop = Math.max(6, Math.min(y, window.innerHeight - height - 6));
        bubble.style.left = `${clampedLeft}px`;
        bubble.style.top = `${clampedTop}px`;
    };

    const createBubble = (type) => {
        const root = ensureUiRoot();
        const bubble = document.createElement('div');
        bubble.className = `gesture-quick-search-bubble gesture-quick-search-bubble-${type}`;
        const grid = document.createElement('div');
        grid.className = 'gesture-quick-search-grid';
        bubble.appendChild(grid);
        root.appendChild(bubble);

        return {
            bubble,
            show(items, x, y, columns = 4) {
                grid.replaceChildren();
                const columnCount = Math.max(1, Math.min(columns, Math.ceil(items.length / 2)));
                grid.style.gridTemplateColumns = `repeat(${columnCount}, 28px)`;
                items.forEach((item) => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'gesture-quick-search-item';
                    button.title = item.title || '';
                    button.appendChild(createIconElement(item));

                    let handledPointerDown = false;
                    let handledTouchStart = false;
                    const runAction = (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        item.onClick();
                    };

                    button.addEventListener('pointerdown', (event) => {
                        handledPointerDown = true;
                        runAction(event);
                    });
                    button.addEventListener('touchstart', (event) => {
                        handledTouchStart = true;
                        runAction(event);
                    }, { passive: false });
                    button.addEventListener('click', (event) => {
                        if (handledPointerDown) {
                            handledPointerDown = false;
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                        if (handledTouchStart) {
                            handledTouchStart = false;
                            event.preventDefault();
                            event.stopPropagation();
                            return;
                        }
                        runAction(event);
                    });
                    grid.appendChild(button);
                });
                bubble.style.display = 'block';
                applyBubblePosition(bubble, x, y);
            },
            reposition(x, y) {
                if (bubble.style.display !== 'block') {
                    return;
                }
                applyBubblePosition(bubble, x, y);
            },
            hide() {
                bubble.style.display = 'none';
            }
        };
    };

    const encodeQuery = (value) => encodeURIComponent(String(value || '').trim().replace(/\s+/g, ' '));
    const buildProviderUrl = (template, { text, imageUrl }) => String(template || '')
        .replaceAll('{{q}}', encodeQuery(text || ''))
        .replaceAll('{{img}}', encodeURIComponent(imageUrl || ''));

    ext.features.quickSearch = {
        shouldRun: ({ runtime }) => runtime.isHttpPage(),
        init: ({ tabActions }) => {
            const settings = DEFAULT_SETTINGS;
            let textBubble;
            let imageBubble;
            let clipboardPanel;
            let textContext = null;
            let imageContext = null;
            let hoverImage = null;
            let lastEditableTarget = null;

            const timers = {
                selection: 0,
                hover: 0,
                hide: 0,
                longPress: 0
            };

            const hideTextBubble = () => {
                textBubble?.hide();
                textContext = null;
            };

            const hideImageBubble = () => {
                imageBubble?.hide();
                imageContext = null;
            };

            const hideClipboardPanel = () => {
                if (clipboardPanel) {
                    clipboardPanel.style.display = 'none';
                }
            };

            const hideAllBubbles = () => {
                hideTextBubble();
                hideImageBubble();
                hideClipboardPanel();
            };

            const isEventInsideBubble = (event, bubbleInstance) => {
                if (!bubbleInstance?.bubble) {
                    return false;
                }
                const path = event.composedPath?.();
                if (Array.isArray(path) && path.includes(bubbleInstance.bubble)) {
                    return true;
                }
                return bubbleInstance.bubble.contains(event.target);
            };

            const getSelectionText = () => String(window.getSelection?.() || '').trim();

            const getSelectionAnchor = (selection) => {
                const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
                if (!range) {
                    return null;
                }
                const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
                const anchorRect = rects.length
                    ? rects.reduce((lowest, rect) => (rect.bottom > lowest.bottom ? rect : lowest), rects[0])
                    : range.getBoundingClientRect();
                if (!anchorRect || (anchorRect.width <= 0 && anchorRect.height <= 0)) {
                    return null;
                }
                return {
                    x: anchorRect.left + ((anchorRect.width || 0) / 2),
                    y: anchorRect.bottom + CONFIG.textBubbleOffsetY
                };
            };

            const getImageElement = (target) => {
                if (!(target instanceof Element) || target.closest('.gesture-quick-search-bubble')) {
                    return null;
                }
                if (target instanceof HTMLImageElement) {
                    return target;
                }
                return target.closest('picture')?.querySelector('img') ?? null;
            };

            const getImageAnchor = (image, event = null) => {
                if (!(image instanceof HTMLImageElement)) {
                    return null;
                }
                const rect = image.getBoundingClientRect();
                if (!rect || (rect.width <= 0 && rect.height <= 0)) {
                    return event ? { x: event.clientX + 6, y: event.clientY + 6 } : null;
                }
                const fallbackX = rect.left + (rect.width / 2);
                const fallbackY = rect.bottom + CONFIG.imageBubbleOffsetY;
                return {
                    x: fallbackX,
                    y: fallbackY
                };
            };

            const selectAllPageText = () => {
                const activeElement = document.activeElement;
                if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
                    activeElement.focus();
                    activeElement.select();
                    return;
                }
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(document.body);
                selection?.removeAllRanges();
                selection?.addRange(range);
            };

            const openTab = async (url) => {
                if (!url) {
                    return;
                }
                const result = await tabActions.openTab(url, 'fg');
                if (!result?.ok) {
                    window.open(url, '_blank', 'noopener');
                }
            };

            const downloadImage = async (url, x, y) => {
                try {
                    const a = document.createElement('a');
                    a.href = url;
                    a.target = '_blank';
                    a.rel = 'noopener';
                    a.download = `image_${Date.now()}.jpg`;
                    a.click();
                    ext.shared.toastCore.createToast('Đang tải ảnh...', x, y, 1200);
                } catch {
                    await openTab(url);
                    ext.shared.toastCore.createToast('Mở tab mới để lưu', x, y, 1200);
                }
            };

            const getEditableTarget = () => {
                if (lastEditableTarget?.isConnected && ext.shared.selectionCore.isEditableTarget(lastEditableTarget)) {
                    return lastEditableTarget;
                }
                const active = document.activeElement;
                if (ext.shared.selectionCore.isEditableTarget(active)) {
                    lastEditableTarget = active;
                    return active;
                }
                return null;
            };

            const rememberEditableTarget = (node) => {
                const target = ext.shared.selectionCore.getEditableTarget(node instanceof Element ? node : null);
                if (target) {
                    lastEditableTarget = target;
                }
                return target;
            };

            const getClipboardEntries = async () => {
                const cfg = await ext.shared.storage.getConfig();
                const clipboard = cfg?.clipboard || {};
                const pinned = Array.isArray(clipboard.pinned) ? clipboard.pinned.slice(0, 5) : [];
                const history = Array.isArray(clipboard.history) ? clipboard.history : [];
                const recent = history.filter((item) => !pinned.includes(item)).slice(0, 8);
                return [...pinned, ...recent].filter((item, index, list) => item && list.indexOf(item) === index);
            };

            const pasteClipboardEntry = (text, x, y) => {
                const target = getEditableTarget();
                if (!text) {
                    ext.shared.toastCore.createToast('Chưa có nội dung nhớ tạm', x, y, 1400);
                    return;
                }
                if (target) {
                    try { target.focus({ preventScroll: true }); } catch { target.focus?.(); }
                    ext.shared.selectionCore.insertTextAtCaret(target, text);
                    ext.shared.toastCore.createToast('Đã dán', x, y, 1200);
                } else {
                    ext.shared.domUtils.copyText(text).then(() => {
                        ext.shared.toastCore.createToast('Đã chép để dán thủ công', x, y, 1500);
                    });
                }
            };

            const ensureClipboardPanel = () => {
                if (clipboardPanel?.isConnected) {
                    return clipboardPanel;
                }
                const root = ensureUiRoot();
                clipboardPanel = document.createElement('div');
                clipboardPanel.className = 'gesture-quick-search-clipboard-panel';
                clipboardPanel.addEventListener('pointerdown', (event) => {
                    event.stopPropagation();
                });
                clipboardPanel.addEventListener('touchstart', (event) => {
                    event.stopPropagation();
                }, { passive: true });
                clipboardPanel.addEventListener('click', (event) => {
                    event.stopPropagation();
                });
                root.appendChild(clipboardPanel);
                return clipboardPanel;
            };

            const showClipboardPanel = async (x, y) => {
                const panel = ensureClipboardPanel();
                const entries = await getClipboardEntries();
                panel.replaceChildren();

                const title = document.createElement('div');
                title.className = 'gesture-quick-search-clipboard-title';
                title.textContent = 'Clipboard nhớ tạm';
                panel.appendChild(title);

                if (!entries.length) {
                    const empty = document.createElement('div');
                    empty.className = 'gesture-quick-search-clipboard-empty';
                    empty.textContent = 'Chưa có nội dung được lưu từ copy hoặc OCR.';
                    panel.appendChild(empty);
                } else {
                    entries.forEach((text) => {
                        const item = document.createElement('button');
                        item.type = 'button';
                        item.className = 'gesture-quick-search-clipboard-item';
                        item.textContent = text;
                        const handlePick = (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            pasteClipboardEntry(text, x, y);
                            hideClipboardPanel();
                            hideTextBubble();
                        };
                        item.addEventListener('pointerdown', handlePick);
                        item.addEventListener('touchstart', handlePick, { passive: false });
                        item.addEventListener('click', handlePick);
                        panel.appendChild(item);
                    });
                }

                panel.style.display = 'block';
                applyBubblePosition(panel, x, y);
            };

            const ensureTextBubble = () => {
                if (!textBubble) {
                    textBubble = createBubble('text');
                }
                return textBubble;
            };

            const ensureImageBubble = () => {
                if (!imageBubble) {
                    imageBubble = createBubble('image');
                    imageBubble.bubble.addEventListener('mouseenter', () => {
                        window.clearTimeout(timers.hide);
                    });
                    imageBubble.bubble.addEventListener('mouseleave', () => {
                        timers.hide = window.setTimeout(() => {
                            if (!hoverImage?.matches(':hover')) {
                                hideImageBubble();
                            }
                        }, CONFIG.hideDelay);
                    });
                }
                return imageBubble;
            };

            const translateSelectedText = async (context) => {
                const { translate } = ext.shared.translateCore;
                const text = context.text;
                if (!text) return;

                const selection = window.getSelection();
                const anchorNode = selection?.anchorNode;
                const targetNode = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
                if (!targetNode) return;

                try {
                    const result = await translate(text, { provider: 'google', cleanResult: true });
                    if (!result || result === text) return;

                    const existing = targetNode.querySelector('.gesture-inline-translate-box')
                        || (targetNode.nextElementSibling?.classList.contains('gesture-inline-translate-box') ? targetNode.nextElementSibling : null);
                    if (existing) existing.remove();

                    const box = document.createElement('div');
                    box.className = 'gesture-inline-translate-box';
                    const content = document.createElement('div');
                    content.className = 'gesture-inline-translate-text';
                    content.textContent = result;
                    box.appendChild(content);
                    targetNode.insertAdjacentElement('afterend', box);
                } catch { }
            };

            const showTextActions = (context) => {
                const providers = settings.providers.slice(0, CONFIG.maxProviders);
                const items = [
                    {
                        label: 'Copy',
                        title: 'Copy',
                        glyph: '⧉',
                        onClick: () => {
                            ext.shared.domUtils.copyText(context.text).then(async () => {
                                if (ext.shared.storage?.saveClipboardHistory) {
                                    await ext.shared.storage.saveClipboardHistory(context.text);
                                }
                                ext.shared.toastCore.createToast('Đã chép', context.x, context.y, 1200);
                            });
                            hideTextBubble();
                        }
                    },
                    {
                        label: 'Paste',
                        title: 'Mở nội dung clipboard đã lưu',
                        glyph: '📋',
                        onClick: () => {
                            showClipboardPanel(context.x, context.y).catch(() => {
                                ext.shared.toastCore.createToast('Không mở được nhớ tạm', context.x, context.y, 1200);
                            });
                        }
                    },
                    {
                        label: 'Select All',
                        title: 'Select All',
                        glyph: '⤢',
                        onClick: () => {
                            selectAllPageText();
                            ext.shared.toastCore.createToast('Đã chọn hết', context.x, context.y, 1200);
                        }
                    },
                    ...providers.map((provider) => ({
                        label: provider.name,
                        title: provider.name,
                        icon: provider.icon,
                        onClick: () => {
                            openTab(buildProviderUrl(provider.url, { text: context.text }));
                            hideTextBubble();
                        }
                    })),
                    {
                        label: 'Dịch',
                        title: 'Dịch văn bản đã chọn',
                        glyph: '🌐',
                        onClick: () => {
                            translateSelectedText(context);
                            hideTextBubble();
                        }
                    }
                ];
                ensureTextBubble().show(items, context.x, context.y, CONFIG.columns);
            };

            const syncTextBubbleToSelection = () => {
                if (!textContext) {
                    return;
                }
                const selection = window.getSelection();
                const text = getSelectionText();
                if (!selection || selection.isCollapsed || !text || text !== textContext.text) {
                    hideTextBubble();
                    return;
                }
                const anchor = getSelectionAnchor(selection);
                if (!anchor) {
                    hideTextBubble();
                    return;
                }
                textContext = { ...textContext, ...anchor };
                textBubble?.reposition(anchor.x, anchor.y);
            };

            const showImageActions = (context) => {
                const providers = settings.imageProviders.slice(0, CONFIG.maxProviders);
                const items = [
                    {
                        label: 'Save',
                        title: 'Save image',
                        glyph: '︾',
                        onClick: () => {
                            downloadImage(context.url, context.x, context.y);
                            hideImageBubble();
                        }
                    },
                    {
                        label: 'OCR',
                        title: 'Trích xuất văn bản từ ảnh',
                        glyph: '[T]',
                        onClick: () => {
                            ext.shared.ocrCore.extractText(context.url, context.x, context.y);
                            hideImageBubble();
                        }
                    },
                    {
                        label: 'Copy',
                        title: 'Copy image URL',
                        glyph: '⧉',
                        onClick: () => {
                            ext.shared.domUtils.copyText(context.url).then(() => ext.shared.toastCore.createToast('Đã chép URL', context.x, context.y, 1200));
                            hideImageBubble();
                        }
                    },
                    ...providers.map((provider) => ({
                        label: provider.name,
                        title: provider.name,
                        icon: provider.icon,
                        onClick: () => {
                            openTab(buildProviderUrl(provider.url, { imageUrl: context.url }));
                            hideImageBubble();
                        }
                    }))
                ];
                ensureImageBubble().show(items, context.x, context.y, CONFIG.columns);
            };

            const scheduleSelectionBubble = () => {
                window.clearTimeout(timers.selection);
                timers.selection = window.setTimeout(() => {
                    const selection = window.getSelection();
                    const text = getSelectionText();
                    if (!selection || selection.isCollapsed || !text) {
                        hideTextBubble();
                        return;
                    }
                    const anchor = getSelectionAnchor(selection);
                    if (!anchor) {
                        hideTextBubble();
                        return;
                    }
                    textContext = {
                        text,
                        x: anchor.x,
                        y: anchor.y
                    };
                    showTextActions(textContext);
                }, CONFIG.selectionDelay);
            };

            const scheduleImageBubble = (image, event) => {
                window.clearTimeout(timers.hover);
                timers.hover = window.setTimeout(() => {
                    const anchor = getImageAnchor(image, event);
                    if (!anchor) {
                        return;
                    }
                    // Ưu tiên URL HTTP thật, bỏ qua data: URLs từ lazy-loading
                    const resolvedUrl = (() => {
                        const candidates = [
                            image.currentSrc,
                            image.src,
                            image.getAttribute('data-src'),
                            image.getAttribute('data-lazy-src'),
                            image.getAttribute('data-original'),
                        ];
                        return candidates.find(u => u && !u.startsWith('data:') && !u.startsWith('blob:')) || image.currentSrc || image.src;
                    })();
                    imageContext = {
                        image,
                        url: resolvedUrl,
                        x: anchor.x,
                        y: anchor.y
                    };
                    showImageActions(imageContext);
                }, CONFIG.hoverDelay);
            };

            const onPointerUp = () => {
                if (ext.shared.selectionCore.isEditableTarget(document.activeElement)) {
                    rememberEditableTarget(document.activeElement);
                    hideTextBubble();
                    return;
                }
                scheduleSelectionBubble();
            };

            const onTouchEnd = () => {
                if (ext.shared.selectionCore.isEditableTarget(document.activeElement)) {
                    rememberEditableTarget(document.activeElement);
                    hideTextBubble();
                    return;
                }
                scheduleSelectionBubble();
            };

            const onPointerMove = (event) => {
                const image = getImageElement(event.target);
                if (image !== hoverImage) {
                    hoverImage = image;
                    window.clearTimeout(timers.hover);
                }
                if (!image) {
                    return;
                }
                scheduleImageBubble(image, event);
            };

            const onPointerDown = (event) => {
                rememberEditableTarget(event.target);
                const insideText = isEventInsideBubble(event, textBubble);
                const insideImage = isEventInsideBubble(event, imageBubble);
                const insideClipboard = clipboardPanel?.contains(event.target);
                if (!insideText && !insideClipboard) {
                    hideTextBubble();
                }
                if (!insideImage) {
                    hideImageBubble();
                }
                if (!insideClipboard) {
                    hideClipboardPanel();
                }
            };

            const onScrollOrResize = () => {
                syncTextBubbleToSelection();
                hideClipboardPanel();
                if (imageContext && imageBubble) {
                    const anchor = getImageAnchor(imageContext.image);
                    if (!anchor) {
                        hideImageBubble();
                        return;
                    }
                    imageContext = { ...imageContext, ...anchor };
                    imageBubble.reposition(anchor.x, anchor.y);
                }
            };

            const onKeyDown = (event) => {
                if (event.key === 'Escape') {
                    hideAllBubbles();
                }
            };

            document.addEventListener('pointerup', onPointerUp, true);
            document.addEventListener('touchend', onTouchEnd, true);
            document.addEventListener('pointermove', onPointerMove, true);
            document.addEventListener('pointerdown', onPointerDown, true);
            document.addEventListener('focusin', (event) => rememberEditableTarget(event.target), true);
            document.addEventListener('keydown', onKeyDown, true);
            window.addEventListener('scroll', onScrollOrResize, true);
            window.addEventListener('resize', onScrollOrResize, true);

            return {
                onConfigChange() { },
                destroy() {
                    window.clearTimeout(timers.selection);
                    window.clearTimeout(timers.hover);
                    window.clearTimeout(timers.hide);
                    window.clearTimeout(timers.longPress);
                    document.removeEventListener('pointerup', onPointerUp, true);
                    document.removeEventListener('touchend', onTouchEnd, true);
                    document.removeEventListener('pointermove', onPointerMove, true);
                    document.removeEventListener('pointerdown', onPointerDown, true);
                    document.removeEventListener('keydown', onKeyDown, true);
                    window.removeEventListener('scroll', onScrollOrResize, true);
                    window.removeEventListener('resize', onScrollOrResize, true);
                    uiHost?.remove();
                }
            };
        }
    };
})();