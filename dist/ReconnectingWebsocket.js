/*!
 * Reconnecting WebSocket
 * by Pedro Ladaria <pedro.ladaria@gmail.com>
 * https://github.com/pladaria/reconnecting-websocket
 * License MIT
 */
import * as Events from './util/Events.js';
const getGlobalWebSocket = () => {
    if (typeof WebSocket !== 'undefined') {
        return WebSocket;
    }
};
const isWebSocket = (w) => typeof w !== 'undefined' && !!w && w.CLOSING === 2;
const DEFAULT = {
    maxReconnectionDelay: 10000,
    minReconnectionDelay: 1000 + Math.random() * 4000,
    minUptime: 5000,
    reconnectionDelayGrowFactor: 1.3,
    connectionTimeout: 4000,
    maxRetries: Infinity,
    maxEnqueuedMessages: Infinity,
    startClosed: false,
    debug: false,
};
export default class ReconnectingWebSocket {
    constructor(url, protocols, options = {}) {
        this._listeners = {
            error: [],
            message: [],
            open: [],
            close: [],
        };
        this._retryCount = -1;
        this._shouldReconnect = true;
        this._connectLock = false;
        this._binaryType = 'blob';
        this._closeCalled = false;
        this._messageQueue = [];
        this.onclose = null;
        this.onerror = null;
        this.onmessage = null;
        this.onopen = null;
        this._handleOpen = (event) => {
            this._debug('open event');
            const { minUptime = DEFAULT.minUptime } = this._options;
            clearTimeout(this._connectTimeout);
            this._uptimeTimeout = setTimeout(() => this._acceptOpen(), minUptime);
            this._ws.binaryType = this._binaryType;
            this._messageQueue.forEach(message => this._ws?.send(message));
            this._messageQueue = [];
            if (this.onopen) {
                this.onopen(event);
            }
            this._listeners.open.forEach(listener => this._callEventListener(event, listener));
        };
        this._handleMessage = (event) => {
            this._debug('message event');
            if (this.onmessage) {
                this.onmessage(event);
            }
            this._listeners.message.forEach(listener => this._callEventListener(event, listener));
        };
        this._handleError = (event) => {
            this._debug('error event', event.message);
            this._disconnect(undefined, event.message === 'TIMEOUT' ? 'timeout' : undefined);
            if (this.onerror) {
                this.onerror(event);
            }
            this._debug('exec error listeners');
            this._listeners.error.forEach(listener => this._callEventListener(event, listener));
            this._connect();
        };
        this._handleClose = (event) => {
            this._debug('close event');
            this._clearTimeouts();
            if (this._shouldReconnect) {
                this._connect();
            }
            if (this.onclose) {
                this.onclose(event);
            }
            this._listeners.close.forEach(listener => this._callEventListener(event, listener));
        };
        this._url = url;
        this._protocols = protocols;
        this._options = options;
        if (this._options.startClosed) {
            this._shouldReconnect = false;
        }
        this._connect();
    }
    static get CONNECTING() {
        return 0;
    }
    static get OPEN() {
        return 1;
    }
    static get CLOSING() {
        return 2;
    }
    static get CLOSED() {
        return 3;
    }
    get CONNECTING() {
        return ReconnectingWebSocket.CONNECTING;
    }
    get OPEN() {
        return ReconnectingWebSocket.OPEN;
    }
    get CLOSING() {
        return ReconnectingWebSocket.CLOSING;
    }
    get CLOSED() {
        return ReconnectingWebSocket.CLOSED;
    }
    get binaryType() {
        return this._ws ? this._ws.binaryType : this._binaryType;
    }
    set binaryType(value) {
        this._binaryType = value;
        if (this._ws) {
            this._ws.binaryType = value;
        }
    }
    get retryCount() {
        return Math.max(this._retryCount, 0);
    }
    get bufferedAmount() {
        const bytes = this._messageQueue.reduce((acc, message) => {
            if (typeof message === 'string') {
                acc += message.length;
            }
            else if (message instanceof Blob) {
                acc += message.size;
            }
            else {
                acc += message.byteLength;
            }
            return acc;
        }, 0);
        return bytes + (this._ws ? this._ws.bufferedAmount : 0);
    }
    get extensions() {
        return this._ws ? this._ws.extensions : '';
    }
    get protocol() {
        return this._ws ? this._ws.protocol : '';
    }
    get readyState() {
        if (this._ws) {
            return this._ws.readyState;
        }
        return this._options.startClosed
            ? ReconnectingWebSocket.CLOSED
            : ReconnectingWebSocket.CONNECTING;
    }
    get url() {
        return this._ws ? this._ws.url : '';
    }
    close(code = 1000, reason) {
        this._closeCalled = true;
        this._shouldReconnect = false;
        this._clearTimeouts();
        if (!this._ws) {
            this._debug('close enqueued: no ws instance');
            return;
        }
        if (this._ws.readyState === this.CLOSED) {
            this._debug('close: already closed');
            return;
        }
        this._ws.close(code, reason);
    }
    reconnect(code, reason) {
        this._shouldReconnect = true;
        this._closeCalled = false;
        this._retryCount = -1;
        if (!this._ws || this._ws.readyState === this.CLOSED) {
            this._connect();
        }
        else {
            this._disconnect(code, reason);
            this._connect();
        }
    }
    isReady() {
        if (this._ws && this._ws.readyState === this.OPEN)
            return true;
        return false;
    }
    send(data) {
        if (this._ws && this._ws.readyState === this.OPEN) {
            this._debug('send', data);
            this._ws.send(data);
        }
        else {
            const { maxEnqueuedMessages = DEFAULT.maxEnqueuedMessages } = this._options;
            if (this._messageQueue.length < maxEnqueuedMessages) {
                this._debug('enqueue', data);
                this._messageQueue.push(data);
            }
        }
    }
    addEventListener(type, listener) {
        if (this._listeners[type]) {
            this._listeners[type].push(listener);
        }
    }
    dispatchEvent(event) {
        const listeners = this._listeners[event.type];
        if (listeners) {
            for (const listener of listeners) {
                this._callEventListener(event, listener);
            }
        }
        return true;
    }
    removeEventListener(type, listener) {
        if (this._listeners[type]) {
            this._listeners[type] = this._listeners[type].filter(l => l !== listener);
        }
    }
    _debug(...args) {
        if (this._options.debug) {
            console.log.apply(console, ['RWS>', ...args]);
        }
    }
    _getNextDelay() {
        const { reconnectionDelayGrowFactor = DEFAULT.reconnectionDelayGrowFactor, minReconnectionDelay = DEFAULT.minReconnectionDelay, maxReconnectionDelay = DEFAULT.maxReconnectionDelay, } = this._options;
        let delay = 0;
        if (this._retryCount > 0) {
            delay =
                minReconnectionDelay * Math.pow(reconnectionDelayGrowFactor, this._retryCount - 1);
            if (delay > maxReconnectionDelay) {
                delay = maxReconnectionDelay;
            }
        }
        this._debug('next delay', delay);
        return delay;
    }
    _wait() {
        return new Promise(resolve => {
            setTimeout(resolve, this._getNextDelay());
        });
    }
    _getNextUrl(urlProvider) {
        if (typeof urlProvider === 'string') {
            return Promise.resolve(urlProvider);
        }
        if (typeof urlProvider === 'function') {
            const url = urlProvider();
            if (typeof url === 'string') {
                return Promise.resolve(url);
            }
            if (url.then) {
                return url;
            }
        }
        throw Error('Invalid URL');
    }
    _connect() {
        if (this._connectLock || !this._shouldReconnect) {
            return;
        }
        this._connectLock = true;
        const { maxRetries = DEFAULT.maxRetries, connectionTimeout = DEFAULT.connectionTimeout, WebSocket = getGlobalWebSocket(), } = this._options;
        if (this._retryCount >= maxRetries) {
            this._debug('max retries reached', this._retryCount, '>=', maxRetries);
            return;
        }
        this._retryCount++;
        this._debug('connect', this._retryCount);
        this._removeListeners();
        if (!isWebSocket(WebSocket)) {
            throw Error('No valid WebSocket class provided');
        }
        this._wait()
            .then(() => this._getNextUrl(this._url))
            .then(url => {
            if (this._closeCalled) {
                return;
            }
            this._debug('connect', { url, protocols: this._protocols });
            this._ws = this._protocols
                ? new WebSocket(url, this._protocols)
                : new WebSocket(url);
            this._ws.binaryType = this._binaryType;
            this._connectLock = false;
            this._addListeners();
            this._connectTimeout = setTimeout(() => this._handleTimeout(), connectionTimeout);
        });
    }
    _handleTimeout() {
        this._debug('timeout event');
        this._handleError(new Events.ErrorEvent(Error('TIMEOUT'), this));
    }
    _disconnect(code = 1000, reason) {
        this._clearTimeouts();
        if (!this._ws) {
            return;
        }
        this._removeListeners();
        try {
            this._ws.close(code, reason);
            this._handleClose(new Events.CloseEvent(code, reason, this));
        }
        catch (error) {
        }
    }
    _acceptOpen() {
        this._debug('accept open');
        this._retryCount = 0;
    }
    _callEventListener(event, listener) {
        if ('handleEvent' in listener) {
            listener.handleEvent(event);
        }
        else {
            listener(event);
        }
    }
    _removeListeners() {
        if (!this._ws) {
            return;
        }
        this._debug('removeListeners');
        this._ws.removeEventListener('open', this._handleOpen);
        this._ws.removeEventListener('close', this._handleClose);
        this._ws.removeEventListener('message', this._handleMessage);
        this._ws.removeEventListener('error', this._handleError);
    }
    _addListeners() {
        if (!this._ws) {
            return;
        }
        this._debug('addListeners');
        this._ws.addEventListener('open', this._handleOpen);
        this._ws.addEventListener('close', this._handleClose);
        this._ws.addEventListener('message', this._handleMessage);
        this._ws.addEventListener('error', this._handleError);
    }
    _clearTimeouts() {
        clearTimeout(this._connectTimeout);
        clearTimeout(this._uptimeTimeout);
    }
}
//# sourceMappingURL=ReconnectingWebsocket.js.map