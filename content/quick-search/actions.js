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
            const toast = (message, duration) => ext.shared.toastCore.createToast(message, x, y, duration);
            const filenameBase = `image_${Date.now()}`;

            // Chuẩn: lấy dataUrl qua service worker rồi tải bằng chrome.downloads.
            // Đường này không bị CORS và tôn trọng đúng tên/đuôi file.
            try {
                const response = await ext.shared.messaging.sendRuntimeMessage(
                    'gesture-ext/fetch-image-data-url',
                    { url },
                    { alwaysResolve: true }
                );
                if (!response?.ok || !response.dataUrl) {
                    throw new Error(response?.error || 'Unable to fetch image');
                }
                // dataUrl có dạng "data:<mime>;base64,..." — tách mime từ đó.
                const mime = String(response.dataUrl).slice(5).split(';')[0];
                const extension = quickSearch.resolveImageExtension({ mime, url });
                const result = await tabActions.downloadDataUrl(response.dataUrl, `${filenameBase}.${extension}`);
                if (!result?.ok) {
                    throw new Error(result?.error || 'Download failed');
                }
                toast('Đã tải ảnh', 1200);
                return;
            } catch {
                // Rơi xuống phương án dự phòng của trang.
            }

            // Dự phòng 1: fetch blob ngay trên trang rồi tạo object URL —
            // blob: là same-origin nên attribute `download` được tôn trọng,
            // khác với URL gốc cross-origin mà Chromium bỏ qua.
            try {
                const response = await fetch(url, { credentials: 'include', cache: 'force-cache' });
                if (!response.ok) {
                    throw new Error(`Image request failed: ${response.status}`);
                }
                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = `${filenameBase}.${quickSearch.resolveImageExtension({ mime: blob.type, url })}`;
                a.rel = 'noopener';
                a.click();
                window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
                toast('Đang tải ảnh...', 1200);
                return;
            } catch {
                // Rơi xuống phương án cuối cùng.
            }

            await this.openSearchTab(url);
            toast('Không tải được, đã mở ảnh trong tab mới', 1500);
        },
        async translateSelectedText(session) {
            const { translate } = ext.shared.translateCore;
            const text = session.text;
            if (!text) {
                return;
            }

            // Box dùng chung class với Inline Translate, nhưng không phụ thuộc
            // feature đó có bật hay không — tự inject styles khi cần.
            ext.inlineTranslate?.dom?.ensureStyles?.();

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
                box.title = 'Nhấn để đóng';
                box.addEventListener('click', () => box.remove(), { once: true });
                // Đánh dấu node nguồn để orphan observer của Inline Translate
                // (nếu đang chạy) dọn box khi node gốc bị SPA remove.
                box.__gestureSourceNode = targetNode;

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
