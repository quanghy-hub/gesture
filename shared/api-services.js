(() => {
    const ext = globalThis.GestureExtension;
    const apiServices = ext.shared.apiServices = ext.shared.apiServices || {};

    const TRANSLATE_PROVIDER_OPTIONS = Object.freeze([
        { id: 'google', label: 'Google Translate' },
        { id: 'mymemory', label: 'MyMemory' },
        { id: 'deepl', label: 'DeepL' }
    ]);

    const OCR_PROVIDER_OPTIONS = Object.freeze([
        { id: 'ocrspace', label: 'OCR.Space' },
        { id: 'ocrspace-alt', label: 'OCR.Space Alt' }
    ]);

    const DEFAULT_API_SERVICES = Object.freeze({
        translate: {
            activeProvider: 'google',
            fallbackEnabled: true,
            fallbackProvider: 'mymemory',
            providers: {
                google: {
                    enabled: true,
                    apiKey: '',
                    endpoint: ''
                },
                mymemory: {
                    enabled: true,
                    apiKey: '',
                    endpoint: ''
                },
                deepl: {
                    enabled: false,
                    apiKey: '',
                    endpoint: ''
                }
            }
        },
        ocr: {
            activeProvider: 'ocrspace',
            fallbackEnabled: false,
            fallbackProvider: 'ocrspace-alt',
            providers: {
                ocrspace: {
                    enabled: true,
                    apiKey: 'helloworld',
                    endpoint: ''
                },
                'ocrspace-alt': {
                    enabled: false,
                    apiKey: '',
                    endpoint: ''
                }
            }
        }
    });

    const getDefaultProviderId = (serviceType) => serviceType === 'ocr' ? 'ocrspace' : 'google';

    const getDefaultFallbackProviderId = (serviceType) => {
        if (serviceType === 'translate') return 'mymemory';
        if (serviceType === 'ocr') return 'ocrspace-alt';
        return '';
    };

    apiServices.TRANSLATE_PROVIDER_OPTIONS = TRANSLATE_PROVIDER_OPTIONS;
    apiServices.OCR_PROVIDER_OPTIONS = OCR_PROVIDER_OPTIONS;
    apiServices.DEFAULT_API_SERVICES = DEFAULT_API_SERVICES;
    apiServices.getDefaultProviderId = getDefaultProviderId;
    apiServices.getDefaultFallbackProviderId = getDefaultFallbackProviderId;
})();
