/**
 * Ambient declarations cho Chrome Extension APIs dùng trong dự án.
 * Chỉ khai báo phần API thực tế được sử dụng; bổ sung dần khi cần.
 * File này là global script (không import/export) nên namespace `chrome`
 * tồn tại toàn cục cho mọi file có `// @ts-check`.
 */

declare namespace chrome {
    namespace runtime {
        interface MessageSender {
            id?: string;
            url?: string;
            origin?: string;
            tab?: chrome.tabs.Tab;
            frameId?: number;
            documentId?: number;
        }

        interface MessageResponse {
            ok?: boolean;
            error?: string;
            result?: unknown;
            [key: string]: unknown;
        }

        interface LastError {
            message: string;
        }

        var lastError: LastError | undefined;

        function sendMessage(message: unknown, callback?: (response: MessageResponse | undefined) => void): void;
        function getURL(path: string): string;

        const onMessage: {
            addListener(
                listener: (message: unknown, sender: MessageSender, sendResponse: (response?: unknown) => void) => boolean | void
            ): void;
        };

        const onInstalled: {
            addListener(listener: (details: { reason: string; previousVersion?: string }) => void): void;
        };

        const onStartup: {
            addListener(listener: () => void): void;
        };
    }

    namespace storage {
        interface StorageChange {
            oldValue?: unknown;
            newValue?: unknown;
        }

        interface StorageArea {
            get(keys: string | string[] | null | Record<string, unknown>, callback: (items: Record<string, unknown>) => void): void;
            set(items: Record<string, unknown>, callback?: () => void): void;
            remove(keys: string | string[], callback?: () => void): void;
            clear(callback?: () => void): void;
        }

        var local: StorageArea;
        var session: StorageArea;

        const onChanged: {
            addListener(listener: (changes: Record<string, StorageChange>, areaName: string) => void): void;
        };
    }

    namespace tabs {
        interface Tab {
            id?: number;
            index: number;
            windowId: number;
            active: boolean;
            url?: string;
            title?: string;
            favIconUrl?: string;
            pendingUrl?: string;
            status?: string;
            pinned?: boolean;
            openerTabId?: number;
        }

        interface CreateProperties {
            url?: string;
            active?: boolean;
            index?: number;
            openerTabId?: number;
            pinned?: boolean;
            windowId?: number;
        }

        interface QueryInfo {
            active?: boolean;
            currentWindow?: boolean;
            lastFocusedWindow?: boolean;
            windowId?: number;
            windowType?: string;
            status?: string;
            url?: string | string[];
            title?: string;
            pinned?: boolean;
        }

        function create(createProperties: CreateProperties): Promise<Tab>;
        function remove(tabIds: number | number[]): Promise<void>;
        function query(queryInfo: QueryInfo): Promise<Tab[]>;
        function captureVisibleTab(windowId?: number, options?: { format?: string; quality?: number }): Promise<string>;
        function get(tabId: number): Promise<Tab>;
        function update(tabId: number, updateProperties: Record<string, unknown>): Promise<Tab>;
    }

    namespace downloads {
        interface DownloadOptions {
            url: string;
            filename?: string;
            saveAs?: boolean;
            conflictAction?: string;
        }

        function download(options: DownloadOptions): Promise<number>;
    }

    namespace scripting {
        interface RegisteredContentScript {
            id: string;
            matches?: string[];
            js?: string[];
            css?: string[];
            allFrames?: boolean;
            runAt?: string;
            world?: string;
        }

        function getRegisteredContentScripts(filter: { ids?: string[] }): Promise<RegisteredContentScript[]>;
        function unregisterContentScripts(filter: { ids?: string[] }): Promise<void>;
        function registerContentScripts(scripts: RegisteredContentScript[]): Promise<void>;
        function executeScript(details: {
            target: { tabId: number; frameIds?: number[] };
            files?: string[];
            func?: (...args: unknown[]) => unknown;
        }): Promise<unknown[]>;
    }

    namespace commands {
        interface Command {
            name?: string;
            description?: string;
            shortcut?: string;
        }

        function getAll(): Promise<Command[]>;
    }
}
