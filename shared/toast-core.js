(() => {
    const ext = globalThis.GestureExtension;
    
    let toastContainer = null;
    let toastTimer = null;

    ext.shared.toastCore = {
        ensureToastStyle: () => {
            if (document.getElementById('gesture-toast-style')) return;
            const style = document.createElement('style');
            style.id = 'gesture-toast-style';
            style.textContent = `
                .gesture-shared-toast {
                    position: fixed;
                    z-index: 2147483647;
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
                    transition: opacity 0.2s ease, transform 0.2s ease;
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        },
        createToast: (message, x, y, duration = 2400) => {
            ext.shared.toastCore.ensureToastStyle();
            
            if (toastContainer) {
                toastContainer.remove();
                clearTimeout(toastTimer);
                toastContainer = null;
            }
            if (!message) return;

            const toast = document.createElement('div');
            toast.className = 'gesture-shared-toast';
            toast.textContent = message;
            document.documentElement.appendChild(toast);

            const rect = toast.getBoundingClientRect();
            toast.style.left = `${Math.min(Math.max(8, x - rect.width / 2), window.innerWidth - rect.width - 8)}px`;
            toast.style.top = `${Math.min(Math.max(8, y - rect.height - 12), window.innerHeight - rect.height - 8)}px`;

            toastContainer = toast;

            toastTimer = window.setTimeout(() => {
                if (toastContainer === toast) {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateY(10px)';
                    setTimeout(() => toast.remove(), 300);
                    toastContainer = null;
                } else {
                    toast.remove();
                }
            }, duration);
        }
    };
})();
