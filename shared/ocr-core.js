(() => {
    const ext = globalThis.GestureExtension;

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
                const response = await chrome.runtime.sendMessage({
                    type: 'gesture-ext/perform-ocr',
                    payload: { imageUrl }
                });

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
                        toast.createToast('Không tìm thấy chữ trong ảnh', x, y, 2000);
                    }
                } else {
                    throw new Error(response?.error || 'Lỗi OCR');
                }
            } catch (error) {
                console.error('OCR Error:', error);
                toast.createToast('Lỗi: ' + error.message, x, y, 2000);
            }
        }
    };
})();
