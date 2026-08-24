/**
 * Ambient declarations cho namespace `GestureExtension` và các typedef
 * cấu hình dùng chung. Các type này là global, sẵn sàng cho mọi file JS
 * có `// @ts-check` mà không cần import.
 */

/// <reference path="./chrome.d.ts" />

declare global {
    interface ProviderSettings {
        enabled?: boolean;
        apiKey?: string;
        endpoint?: string;
    }

    interface TranslateServiceConfig {
        activeProvider?: string;
        fallbackEnabled?: boolean;
        fallbackProvider?: string;
        providers?: {
            google?: ProviderSettings;
            mymemory?: ProviderSettings;
            deepl?: ProviderSettings;
            [providerId: string]: ProviderSettings | undefined;
        };
    }

    interface OcrServiceConfig {
        activeProvider?: string;
        fallbackEnabled?: boolean;
        fallbackProvider?: string;
        providers?: {
            ocrspace?: ProviderSettings;
            'ocrspace-alt'?: ProviderSettings;
            [providerId: string]: ProviderSettings | undefined;
        };
    }

    interface ApiServicesConfig {
        translate?: TranslateServiceConfig;
        ocr?: OcrServiceConfig;
    }

    interface ForumDefaultsConfig {
        enabled?: boolean;
        wide?: boolean;
        minWidth?: number;
        gap?: number;
        fadeTime?: number;
        initDelay?: number;
    }

    interface ForumHostConfig {
        enabled?: boolean;
        wide?: boolean;
        minWidth?: number;
        gap?: number;
        fadeTime?: number;
        initDelay?: number;
    }

    interface VideoFloatingLayout {
        top?: number | string;
        left?: number | string;
        width?: number | string;
        height?: number | string;
        borderRadius?: number | string;
    }

    interface GesturePressConfig {
        enabled?: boolean;
        mode?: 'fg' | 'bg' | string;
        ms?: number;
    }

    interface GestureDesktopConfig {
        enabled?: boolean;
        lpress?: GesturePressConfig;
        rclick?: { enabled?: boolean; mode?: string };
        closeTab?: { enabled?: boolean; ms?: number };
        pager?: { enabled?: boolean; hops?: number };
        /** Legacy fields — bị xóa khi applyGestureSettings chạy. */
        dblRight?: unknown;
        fastScroll?: unknown;
    }

    interface GestureMobileConfig {
        enabled?: boolean;
        lpress?: GesturePressConfig;
        closeTab?: { enabled?: boolean; ms?: number };
        edge?: { enabled?: boolean; width?: number; speed?: number; side?: 'left' | 'right' | 'both' | string };
        /** Legacy fields — bị xóa khi applyGestureSettings chạy. */
        dblTap?: unknown;
        fastScroll?: unknown;
    }

    interface GestureConfig {
        version?: number;
        /** Đánh dấu config đã qua normalize — không lưu xuống storage. */
        _isNormalized?: boolean;
        unblockCopy?: {
            enabled?: boolean;
        };
        googleSearch?: {
            enabled?: boolean;
        };
        videoFloating?: {
            enabled?: boolean;
            swipeLong?: number;
            swipeShort?: number;
            shortThreshold?: number;
            minSwipeDistance?: number;
            verticalTolerance?: number;
            diagonalThreshold?: number;
            realtimePreview?: boolean;
            throttle?: number;
            forwardStep?: number;
            hotkeys?: boolean;
            noticeFontSize?: number;
            backgroundSeekExcludedHosts?: string[];
            layout?: VideoFloatingLayout | null;
        };
        videoScreenshot?: {
            enabled?: boolean;
        };
        quickSearch?: {
            enabled?: boolean;
            enabledProviderIds?: string[];
            columns?: number;
            imageSearchEnabled?: boolean;
            selectionDelay?: number;
            imageLongPressMs?: number;
        };
        inlineTranslate?: {
            enabled?: boolean;
            provider?: string;
            selectionTranslateEnabled?: boolean;
            hotkeyEnabled?: boolean;
            hotkey?: string;
            swipeEnabled?: boolean;
            swipeDir?: string;
            swipePx?: number;
            swipeMaxDurationMs?: number;
            swipeSlopeMax?: number;
            fontScale?: number;
            mutedColor?: string;
            dedupeSeconds?: number;
        };
        youtubeSubtitles?: {
            targetLang?: string;
            fontSize?: number;
            translatedFontSize?: number;
            originalColor?: string;
            translatedColor?: string;
            showOriginal?: boolean;
            containerPosition?: { x?: string; y?: string };
            containerAlignment?: string;
            enabled?: boolean;
        };
        apiServices?: ApiServicesConfig;
        forum?: {
            defaults?: ForumDefaultsConfig;
            hosts?: Record<string, ForumHostConfig>;
        };
        runtime?: {
            excludedHosts?: string[];
            popupPanelOrder?: readonly string[];
        };
        gestures?: {
            excludedHosts?: string[];
            desktop?: GestureDesktopConfig;
            mobile?: GestureMobileConfig;
        };
    }

    interface GestureExtensionShared {
        config?: {
            STORAGE_KEY: string;
            DEFAULT_CONFIG: GestureConfig;
            DEFAULT_POPUP_PANEL_ORDER: readonly string[];
            deepClone<T>(value: T): T;
            normalizeConfig(config?: unknown): GestureConfig;
            normalizeHost(host: unknown): string;
            normalizeExcludedHosts(value: unknown): string[];
            isHostExcluded(configOrHosts: unknown, host: string): boolean;
            setHostExcluded(config: GestureConfig, host: string, excluded: boolean): GestureConfig;
            getVideoFloatingBackgroundSeekExcludedHosts(config: unknown): string[];
            isVideoFloatingBackgroundSeekExcluded(config: unknown, host: string): boolean;
            setVideoFloatingBackgroundSeekExcluded(config: GestureConfig, host: string, excluded: boolean): GestureConfig;
            getGestureExcludedHosts?(config: unknown): string[];
            isGestureHostExcluded(config: unknown, host: string): boolean;
            setGestureHostExcluded(config: GestureConfig, host: string, excluded: boolean): GestureConfig;
            getExcludedMatchPatterns(excludedHosts: unknown): string[];
            getForumConfig(config: unknown, host?: string): ForumDefaultsConfig;
            updateForumHostConfig(config: GestureConfig, host: string, patch: ForumHostConfig): GestureConfig;
            getGestureSettings(config: unknown): Record<string, unknown>;
            applyGestureSettings(config: GestureConfig, patch: Record<string, unknown>): GestureConfig;
        };
        configUtils?: {
            deepClone<T>(value: T): T;
            mergeObjects<T>(defaults: T, incoming: unknown): T;
            clampNumber(value: unknown, fallback: number, min: number, max: number): number;
            normalizeMode(value: unknown, fallback: string): string;
            normalizeSide(value: unknown): 'left' | 'right' | 'both';
            normalizeHost(host: unknown): string;
            normalizeExcludedHosts(value: unknown): string[];
            normalizeProviderSettings(value: unknown, fallback?: ProviderSettings): ProviderSettings;
        };
        configSchema?: {
            STORAGE_KEY: string;
            DEFAULT_POPUP_PANEL_ORDER: readonly string[];
            DEFAULT_CONFIG: GestureConfig;
        };
        configNormalize?: {
            normalizeConfig(config?: unknown): GestureConfig;
        };
        storage?: {
            getLocal(keys: string | string[]): Promise<Record<string, unknown>>;
            setLocal(payload: Record<string, unknown>): Promise<void>;
            getConfig(): Promise<GestureConfig>;
            saveConfig(config: GestureConfig): Promise<GestureConfig>;
            updateConfig(updater: (draft: GestureConfig) => GestureConfig | unknown): Promise<GestureConfig>;
            saveVideoLayout(layout: VideoFloatingLayout): Promise<unknown>;
        };
        messaging?: {
            sendRuntimeMessage(
                type: string,
                payload?: unknown,
                options?: { alwaysResolve?: boolean; unwrapResult?: boolean }
            ): Promise<unknown>;
        };
        apiServices?: {
            TRANSLATE_PROVIDER_OPTIONS: readonly { id: string; label: string }[];
            OCR_PROVIDER_OPTIONS: readonly { id: string; label: string }[];
            DEFAULT_API_SERVICES: ApiServicesConfig;
            getDefaultProviderId(serviceType: string): string;
            getDefaultFallbackProviderId(serviceType: string): string;
        };
    }

    interface GestureExtensionNs {
        /** Optional vì các module tự khởi tạo từng phần của namespace. */
        shared?: GestureExtensionShared;
        background?: {
            SW_IMPORT_PATHS?: readonly string[];
            messageHandlers?: Record<string, (...args: unknown[]) => Promise<unknown>>;
            ocrApi?: Record<string, unknown>;
            translateApi?: Record<string, unknown>;
            apiServiceRegistry?: Record<string, unknown>;
        };
        features?: Record<string, unknown>;
        ui?: Record<string, unknown>;
        videoFloating?: Record<string, unknown>;
    }

    var GestureExtension: GestureExtensionNs;
}

export {};
