(() => {
    const ext = globalThis.GestureExtension;
    const sendRuntimeMessage = (type, payload = {}) => new Promise((resolve, reject) => {
        try {
            chrome.runtime.sendMessage({ type, payload }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (response?.ok === false) {
                    reject(new Error(response.error || 'Unknown runtime messaging error'));
                    return;
                }
                resolve(response);
            });
        } catch (error) {
            reject(error);
        }
    });

    ext.shared.ocrCore = {
        /**
         * Chích xuất chữ từ ảnh và chép vào clipboard
         * @param {string} imageUrl URL của ảnh
         * @param {number} x Tọa độ X để hiển thị toast
         * @param {number} y Tọa độ Y để hiển thị toast
         */
        extractText: async (imageUrl, x, y) => {
            const toast = ext.shared.toastCore;
            toast.createToast('Đang nhận diện chữ...', x, y, 3000);

            try {
                const response = await sendRuntimeMessage('gesture-ext/perform-ocr', { imageUrl });

                if (response && response.ok) {
                    const text = response.text.trim();
                    if (text) {
                        await ext.shared.domUtils.copyText(text);
                        // Lưu vào lịch sử clipboard của extension
                        if (ext.shared.storage?.saveClipboardHistory) {
                            await ext.shared.storage.saveClipboardHistory(text);
                        }
                        toast.createToast('Đã chép văn bản vào clipboard', x, y, 2000);
                    } else {
                        toast.createToast('Không nhận diện được chữ', x, y, 1800);
                    }
                }
            } catch {
                toast.createToast('OCR không khả dụng cho ảnh này', x, y, 1800);
            }
        }
    };
})();
