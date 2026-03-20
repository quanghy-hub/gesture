(() => {
    const ext = globalThis.GestureExtension;

    ext.features.forumStyles = {
        css: `
html.fs-wide .p-body-inner,html.fs-wide .p-pageWrapper,html.fs-wide .pageWidth,
html.fs-wide #content,html.fs-wide .container,html.fs-wide .wrap,html.fs-wide main{max-width:100%!important;width:100%!important;margin-inline:auto!important}
html.fs-active .p-body-sidebar,html.fs-active aside.p-body-sidebar,html.fs-active .block--category-boxes{display:none!important}
html.fs-active{zoom:0.9!important;font-size:111%!important;overflow-x:hidden!important}
html.fs-active .p-body-inner{max-width:100%!important;width:100%!important;padding:0!important}
html.fs-active .p-body-main,html.fs-active .p-body-main--withSidebar{display:block!important}
html.fs-active .p-body-content{width:100%!important;max-width:100%!important}
.fs-wrapper{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--fs-gap,1px);align-items:flex-start;max-width:calc(100% - var(--fs-overflow-fix,0px) - 4px)!important;width:calc(100% - var(--fs-overflow-fix,0px) - 4px)!important;margin-inline:auto!important;overflow-x:hidden;overflow-y:hidden;box-sizing:border-box}
.fs-column{min-width:0;display:flex;flex-direction:column;gap:var(--fs-gap,1px);overflow:hidden;word-break:break-word;box-sizing:border-box}
.fs-column>*{margin:0!important;width:100%!important;max-width:100%!important;overflow:hidden;box-sizing:border-box}
.fs-wrapper *{min-width:0!important;overflow-wrap:break-word!important}
.fs-wrapper img,.fs-wrapper video,.fs-wrapper iframe{display:block;max-width:100%!important;width:auto!important;zoom:1!important}
.fs-wrapper img,.fs-wrapper video{height:auto!important}
.fs-wrapper pre,.fs-wrapper code{white-space:pre-wrap!important;word-break:break-all!important;overflow:auto!important}
.fs-wrapper table,.fs-wrapper blockquote{overflow:auto!important}
.fs-original-hidden{display:none!important}`
    };
})();