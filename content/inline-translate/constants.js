(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = ext.inlineTranslate = ext.inlineTranslate || {};

    inlineTranslate.JUNK = /[\s\d\p{P}\p{S}\p{M}\p{C}\u200B-\u200D\uFEFF]/gu;
    inlineTranslate.TRANSLATION_PENDING = Symbol('translation-pending');
    inlineTranslate.IS_REDDIT = window.location.hostname.includes('reddit.com');
    inlineTranslate.REDDIT_SELECTORS = Object.freeze([
        'div[id$="-post-rtjson-content"]',
        '.md',
        '[data-post-click-location="text-body"] > div',
        '[slot="text-body"] div',
        '[slot="text-body"]'
    ]);
    inlineTranslate.REDDIT_TITLE_SELECTORS = Object.freeze([
        '[slot="title"]',
        'a[slot="title"]',
        'h1',
        'h2',
        'h3'
    ]);
    inlineTranslate.VALID_TAGS = /^(P|LI|H[1-6]|BLOCKQUOTE|TD|TH|PRE|FIGCAPTION|DIV|SPAN|A|ARTICLE|LABEL|SECTION|ASIDE|FIGURE|DETAILS|SUMMARY|CODE|NAV|HEADER|FOOTER|MAIN|MARK)$/;
    inlineTranslate.PARAGRAPH_TAGS = /^(P|LI|BLOCKQUOTE|TD|TH|PRE|FIGCAPTION|SUMMARY)$/;
    inlineTranslate.HEADING_TAGS = /^(H[1-6])$/;
    inlineTranslate.CONTAINER_FALLBACK_TAGS = /^(DIV|ARTICLE|SECTION|ASIDE|FIGURE|DETAILS|MAIN)$/;
})();
