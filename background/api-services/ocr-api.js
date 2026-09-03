(() => {
    const ext = globalThis.GestureExtension;

    const OCR_IMAGE_FETCH_TIMEOUT_MS = 15000;
    const OCR_API_TIMEOUT_MS = 45000;

    const getFriendlyOcrError = (primaryError, fallbackError) =>
        String(fallbackError?.message || primaryError?.message || fallbackError || primaryError || 'Lỗi OCR tạm thời. Thử lại sau.');

    const getStoredConfig = () => ext.shared.storage.getConfig();

    const getProviderSettings = (config, serviceType, providerId) => {
        return config?.apiServices?.[serviceType]?.providers?.[providerId] || {};
    };

    const buildOcrEndpoint = (endpoint) => endpoint || 'https://api.ocr.space/parse/image';

    const fetchImageBlob = async (imageUrl) => {
        const translateApi = ext.background.translateApi;
        const res = await translateApi.fetchWithTimeout(
            imageUrl,
            {
                credentials: 'omit',
                cache: 'no-store',
                redirect: 'follow',
                referrerPolicy: 'no-referrer'
            },
            OCR_IMAGE_FETCH_TIMEOUT_MS,
            'OCR image fetch timed out'
        );
        if (!res.ok) {
            throw new Error(`Image fetch HTTP ${res.status}`);
        }
        const blob = await res.blob();
        if (!blob || !blob.size) {
            throw new Error('Ảnh OCR tải về rỗng');
        }
        return blob;
    };

    const executeOcrWithProvider = async (providerId, blob, config) => {
        const ocrSettings = getProviderSettings(config, 'ocr', providerId);
        if (ocrSettings.enabled === false) {
            throw new Error(`${providerId} provider disabled`);
        }

        const apiKey = String(ocrSettings.apiKey || '').trim();
        if (!apiKey) {
            throw new Error('Thiếu API key OCR. Vào popup → API Services → OCR để nhập key của bạn.');
        }

        const translateApi = ext.background.translateApi;
        const formData = new FormData();
        formData.append('file', blob, 'image.jpg');
        formData.append('language', 'auto');
        formData.append('OCREngine', '3');
        formData.append('apikey', apiKey);

        const ocrRes = await translateApi.fetchWithTimeout(
            buildOcrEndpoint(ocrSettings.endpoint),
            {
                method: 'POST',
                body: formData
            },
            OCR_API_TIMEOUT_MS,
            'OCR service request timed out'
        );
        if (!ocrRes.ok) {
            throw new Error(`OCR HTTP ${ocrRes.status}`);
        }

        const data = await ocrRes.json();
        if (data.IsErroredOnProcessing) {
            throw new Error(data.ErrorMessage?.[0] || 'Lỗi OCR (E201/Máy chủ)');
        }
        return {
            provider: providerId,
            text: data.ParsedResults?.[0]?.ParsedText?.trim() || ''
        };
    };

    const executeOcr = async ({ imageUrl }) => {
        const config = await getStoredConfig();
        const ocrConfig = config.apiServices.ocr;
        const requestedProvider = ocrConfig.activeProvider;
        const blob = await fetchImageBlob(imageUrl);

        try {
            return await executeOcrWithProvider(requestedProvider, blob, config);
        } catch (primaryError) {
            const fallbackProvider = ocrConfig.fallbackEnabled ? ocrConfig.fallbackProvider : '';
            if (!fallbackProvider || fallbackProvider === requestedProvider) {
                throw primaryError;
            }
            try {
                const result = await executeOcrWithProvider(fallbackProvider, blob, config);
                return {
                    ...result,
                    fallbackReason: primaryError?.message || String(primaryError)
                };
            } catch (fallbackError) {
                throw new Error(getFriendlyOcrError(primaryError, fallbackError), { cause: fallbackError });
            }
        }
    };

    ext.background = ext.background || {};
    ext.background.ocrApi = {
        executeOcr
    };
})();
