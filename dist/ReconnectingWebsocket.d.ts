/*!
 * Reconnecting WebSocket
 * by Pedro Ladaria <pedro.ladaria@gmail.com>
 * https://github.com/pladaria/reconnecting-websocket
 * License MIT
 */
import * as Events from './util/Events.js';
export type Event = Events.Event;
export type ErrorEvent = Events.ErrorEvent;
export type CloseEvent = Events.CloseEvent;
export type Options = {
    WebSocket?: any;
    maxReconnectionDelay?: number;
    minReconnectionDelay?: number;
    reconnectionDelayGrowFactor?: number;
    minUptime?: number;
    connectionTimeout?: number;
    maxRetries?: number;
    maxEnqueuedMessages?: number;
    startClosed?: boolean;
    debug?: boolean;
};
export type UrlProvider = string | (() => string) | (() => Promise<string>);
export type Message = string | ArrayBuffer | Blob | ArrayBufferView;
export type ListenersMap = {
    error: Array<Events.WebSocketEventListenerMap['error']>;
    message: Array<Events.WebSocketEventListenerMap['message']>;
    open: Array<Events.WebSocketEventListenerMap['open']>;
    close: Array<Events.WebSocketEventListenerMap['close']>;
};
export default class ReconnectingWebSocket {
    private _ws?;
    private _listeners;
    private _retryCount;
    private _uptimeTimeout;
    private _connectTimeout;
    private _shouldReconnect;
    private _connectLock;
    private _binaryType;
    private _closeCalled;
    private _messageQueue;
    private readonly _url;
    private readonly _protocols?;
    private readonly _options;
    constructor(url: UrlProvider, protocols?: string | string[], options?: Options);
    static get CONNECTING(): number;
    static get OPEN(): number;
    static get CLOSING(): number;
    static get CLOSED(): number;
    get CONNECTING(): number;
    get OPEN(): number;
    get CLOSING(): number;
    get CLOSED(): number;
    get binaryType(): BinaryType;
    set binaryType(value: BinaryType);
    get retryCount(): number;
    get bufferedAmount(): number;
    get extensions(): string;
    get protocol(): string;
    get readyState(): number;
    get url(): string;
    onclose: ((event: Events.CloseEvent) => void) | null;
    onerror: ((event: Events.ErrorEvent) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onopen: ((event: Event) => void) | null;
    close(code?: number, reason?: string): void;
    reconnect(code?: number, reason?: string): void;
    isReady(): boolean;
    send(data: Message): void;
    addEventListener<T extends keyof Events.WebSocketEventListenerMap>(type: T, listener: Events.WebSocketEventListenerMap[T]): void;
    dispatchEvent(event: Event): boolean;
    removeEventListener<T extends keyof Events.WebSocketEventListenerMap>(type: T, listener: Events.WebSocketEventListenerMap[T]): void;
    private _debug;
    private _getNextDelay;
    private _wait;
    private _getNextUrl;
    private _connect;
    private _handleTimeout;
    private _disconnect;
    private _acceptOpen;
    private _callEventListener;
    private _handleOpen;
    private _handleMessage;
    private _handleError;
    private _handleClose;
    private _removeListeners;
    private _addListeners;
    private _clearTimeouts;
}
