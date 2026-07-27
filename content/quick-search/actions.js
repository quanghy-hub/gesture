(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});

    quickSearch.createActions = ({
        tabActions,
        hideAllBubbles,
        clearActiveSelection,
        suppressSelectionFor,
        getSelectionSnapshot,
        getCurrentSelectionKey
    }) => ({
        async openSearchTab(url) {
            if (!url) {
                return;
            }
            const selectionSnapshot = getSelectionSnapshot();
            suppressSelectionFor(selectionSnapshot?.key || getCurrentSelectionKey() || '');
            clearActiveSelection();
            hideAllBubbles();
            const result = await tabActions.openTab(url, 'fg');
            if (!result?.ok) {
                window.open(url, '_blank', 'noopener');
            }
        },
        async downloadImage(url, x, y) {
            try {
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener';
                a.download = `image_${Date.now()}.jpg`;
                a.click();
                ext.shared.toastCore.createToast('Đang tải ảnh...', x, y, 1200);
            } catch {
                await this.openSearchTab(url);
                ext.shared.toastCore.createToast('Mở tab mới để lưu', x, y, 1200);
            }
        },
        async translateSelectedText(session) {
            const { translate } = ext.shared.translateCore;
            const text = session.text;
            if (!text) {
                return;
            }

            const selection = window.getSelection();
            const anchorNode = selection?.anchorNode;
            const targetNode = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
            if (!targetNode) {
                return;
            }

            try {
                const result = await translate(text, { cleanResult: true });
                if (!result || result === text) {
                    return;
                }

                const existing =
                    targetNode.querySelector('.gesture-inline-translate-box') ||
                    (targetNode.nextElementSibling?.classList.contains('gesture-inline-translate-box')
                        ? targetNode.nextElementSibling
                        : null);
                existing?.remove();

                const box = document.createElement('div');
                box.className = 'gesture-inline-translate-box';
                const content = document.createElement('div');
                content.className = 'gesture-inline-translate-text';
                content.textContent = result;
                box.appendChild(content);
                targetNode.insertAdjacentElement('afterend', box);
            } catch {
                // Ignore translation failures and keep the selection flow uninterrupted.
            }
        },
        async copyText(value) {
            await ext.shared.domUtils.copyText(value);
            if (ext.shared.storage?.saveClipboardHistory) {
                await ext.shared.storage.saveClipboardHistory(value);
            }
        },
        async copyImage(image, url) {
            const copyBlob = async (blob) => {
                if (!blob?.type?.startsWith('image/')) {
                    throw new Error('Clipboard item is not an image');
                }
                if (!navigator.clipboard?.write || typeof ClipboardItem !== 'function') {
                    throw new Error('Image clipboard is not supported');
                }
                const pngBlob = blob.type === 'image/png' ? blob : await convertBlobToPng(blob);
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
            };

            const convertBlobToPng = async (blob) => {
                const bitmap = await createImageBitmap(blob);
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = bitmap.width;
                    canvas.height = bitmap.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(bitmap, 0, 0);
                    return await new Promise((resolve, reject) => {
                        canvas.toBlob((nextBlob) => {
                            if (nextBlob) resolve(nextBlob);
                            else reject(new Error('Unable to convert image to PNG'));
                        }, 'image/png');
                    });
                } finally {
                    bitmap.close?.();
                }
            };

            const copyFromUrl = async (imageUrl) => {
                const isDataUrl = String(imageUrl || '').startsWith('data:');
                const response = await fetch(imageUrl, isDataUrl ? undefined : { credentials: 'include', cache: 'force-cache' });
                if (!response.ok) {
                    throw new Error(`Image request failed: ${response.status}`);
                }
                await copyBlob(await response.blob());
            };

            const copyFromBackground = async () => {
                const response = await ext.shared.messaging.sendRuntimeMessage(
                    'gesture-ext/fetch-image-data-url',
                    { url },
                    { alwaysResolve: true }
                );
                if (!response?.ok || !response.dataUrl) {
                    throw new Error(response?.error || 'Unable to fetch image');
                }
                await copyFromUrl(response.dataUrl);
            };

            const copyFromCanvas = async () => {
                if (!(image instanceof HTMLImageElement)) {
                    throw new Error('No image element');
                }
                const canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth || image.width;
                canvas.height = image.naturalHeight || image.height;
                if (!canvas.width || !canvas.height) {
                    throw new Error('Image has no size');
                }
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
                await copyBlob(blob);
            };

            try {
                await copyFromUrl(url);
                return;
            } catch {
                try {
                    await copyFromBackground();
                } catch {
                    await copyFromCanvas();
                }
            }
        },
        runOcr(url, x, y) {
            ext.shared.ocrCore.extractText(url, x, y);
        }
    });
})();
