(() => {
    const ext = globalThis.GestureExtension;

    ext.shared.domUtils = {
        escapeHtml: (text) => text
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;'),
        encodeAttribute: (text) => encodeURIComponent(text),
        decodeAttribute: (text) => {
            try { return decodeURIComponent(text || ''); } 
            catch { return text || ''; }
        },
        previewText: (text, max = 140) => (text.length > max ? `${text.slice(0, max - 3)}...` : text),
        sanitizeFilename: (input) => input.replace(/[<>:"/\\|?*]+/g, '_').replace(/\s+/g, ' ').trim(),
        copyText: async (value) => {
            try {
                await navigator.clipboard.writeText(value);
                return true;
            } catch {
                const textarea = document.createElement('textarea');
                textarea.value = value;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                document.execCommand('copy');
                textarea.remove();
                return true;
            }
        }
    };
})();
