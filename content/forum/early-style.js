(() => {
    const ext = globalThis.GestureExtension;
    const forumEarlyStyle = ext.forumEarlyStyle = ext.forumEarlyStyle || {};
    const { isHttpPage } = ext.shared.runtime;

    forumEarlyStyle.EARLY_STYLE_ID = 'gesture-ext-forum-early-style';

    forumEarlyStyle.inject = (fadeTime) => {
        if (document.getElementById(forumEarlyStyle.EARLY_STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = forumEarlyStyle.EARLY_STYLE_ID;
        style.textContent = `html.fs-loading body{opacity:0!important}html.fs-ready body{opacity:1;transition:opacity ${fadeTime}ms ease-out}`;
        (document.head || document.documentElement).appendChild(style);
    };

    forumEarlyStyle.remove = () => {
        document.getElementById(forumEarlyStyle.EARLY_STYLE_ID)?.remove();
    };

    forumEarlyStyle.getCachedConfig = () => {
        if (!isHttpPage()) {
            return null;
        }
        return ext.forumCache.read(location.host);
    };

    const cachedForumConfig = forumEarlyStyle.getCachedConfig();
    if (cachedForumConfig?.enabled) {
        forumEarlyStyle.inject(cachedForumConfig.fadeTime || 150);
        document.documentElement.classList.add('fs-loading');
    }
})();
