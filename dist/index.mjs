class Event {
    constructor(type, target) {
        this.target = target;
        this.type = type;
    }
}
class ErrorEvent extends Event {
    constructor(error, target) {
        super('error', target);
        this.message = error.message;
        this.error = error;
    }
}
class CloseEvent extends Event {
    constructor(code = 1000, reason = '', target) {
        super('close', target);
        this.wasClean = true;
        this.code = code;
        this.reason = reason;
    }
}

/*!
 * Reconnecting WebSocket
 * by Pedro Ladaria <pedro.ladaria@gmail.com>
 * https://github.com/pladaria/reconnecting-websocket
 * License MIT
 */
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
class ReconnectingWebSocket {
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
        this._handleError(new ErrorEvent(Error('TIMEOUT'), this));
    }
    _disconnect(code = 1000, reason) {
        this._clearTimeouts();
        if (!this._ws) {
            return;
        }
        this._removeListeners();
        try {
            this._ws.close(code, reason);
            this._handleClose(new CloseEvent(code, reason, this));
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

class Remote {
    constructor(opts = { remote: false }) {
        this.bc = null;
        this.connected = false;
        this.useSockets = false;
        this.useBroadcastChannel = false;
        this.receiveSerials = new Map();
        this.serial = 0;
        this.lastDataEl = null;
        this.logEl = null;
        this.lastSend = 0;
        if (!opts.minMessageIntervalMs)
            opts.minMessageIntervalMs = 15;
        this.remote = opts.remote;
        if (opts.useSockets === undefined)
            this.useSockets = location.host.endsWith('glitch.me') || false;
        else
            this.useSockets = opts.useSockets;
        if (opts.useBroadcastChannel === undefined) {
            if (opts.useSockets)
                this.useBroadcastChannel = false;
            else
                this.useBroadcastChannel = true;
        }
        else {
            this.useBroadcastChannel = opts.useBroadcastChannel;
        }
        this.ourId = opts.ourId;
        this.lastSend = 0;
        this.url = opts.url;
        this.minMessageIntervalMs = opts.minMessageIntervalMs;
        this.init();
        if (this.useSockets)
            this.initSockets();
        if (this.useBroadcastChannel)
            this.initBroadcastChannel();
    }
    send(data) {
        const interval = Date.now() - this.lastSend;
        if (interval < this.minMessageIntervalMs)
            return;
        const str = JSON.stringify({
            from: this.ourId,
            serial: this.serial++,
            ...data
        });
        if (this.socket && this.useSockets && this.socket.isReady())
            this.socket.send(str);
        if (this.useBroadcastChannel && this.bc) {
            this.bc.postMessage(str);
        }
        if (this.lastDataEl)
            this.lastDataEl.innerText = str;
        this.lastSend = Date.now();
    }
    seenMessage(o) {
        if (!o.serial)
            return;
        if (!o.from)
            return;
        const lastSerial = this.receiveSerials.get(o.from);
        if (lastSerial) {
            if (lastSerial >= o.serial)
                return true;
        }
        this.receiveSerials.set(o.from, o.serial);
        return false;
    }
    initBroadcastChannel() {
        try {
            const bc = new BroadcastChannel('remote');
            bc.onmessage = (evt) => {
                try {
                    const o = JSON.parse(evt.data);
                    o.source = 'bc';
                    if (!this.seenMessage(o))
                        this.onData(o);
                }
                catch (err) {
                    this.error(err);
                    this.log('Data: ' + JSON.stringify(evt.data));
                }
            };
            this.bc = bc;
            console.log('Broadcast channel created');
        }
        catch (ex) {
            console.error(ex);
        }
    }
    init() {
        this.logEl = document.getElementById('log');
        this.lastDataEl = document.getElementById('lastData');
        if (this.remote) {
            console.log2 = console.log;
            console.error2 = console.error;
            console.log = this.log.bind(this);
            console.error = this.error.bind(this);
            window.onerror = (message, source, lineno, colno, error) => this.error(message, error);
        }
        if (this.ourId === undefined) {
            const v = window.localStorage.getItem('remoteId');
            if (v !== null)
                this.ourId = v;
        }
        if (this.ourId === undefined) {
            this.setId(Date.now().toString(36) + Math.random().toString(36).substr(2));
        }
        const txtSourceName = document.getElementById('txtSourceName');
        if (txtSourceName) {
            if (this.ourId)
                txtSourceName.value = this.ourId;
            txtSourceName.addEventListener('change', () => {
                const id = txtSourceName.value.trim();
                if (id.length == 0)
                    return;
                this.setId(id);
            });
        }
        document.getElementById('logTitle')?.addEventListener('click', () => this.clearLog());
    }
    setId(id) {
        window.localStorage.setItem('remoteId', id);
        this.ourId = id;
        this.serial = 0;
        this.log(`Source name changed to: ${id}`);
    }
    initSockets() {
        if (!this.url)
            this.url = (location.protocol === 'http:' ? 'ws://' : 'wss://') + location.host + '/ws';
        const s = new ReconnectingWebSocket(this.url);
        const setConnected = (isConnected) => {
            this.connected = isConnected;
            if (isConnected) {
                this.log('Web sockets connected to: ' + this.url);
            }
            else
                this.log('Disconnected 😒');
        };
        s.onopen = (e) => {
            setConnected(true);
        };
        s.onclose = (e) => {
            setConnected(false);
        };
        s.onerror = (e) => {
            setConnected(false);
        };
        s.onmessage = (evt) => {
            try {
                const o = JSON.parse(evt.data);
                if (o.from === this.ourId)
                    return;
                o.source = 'ws';
                if (!this.seenMessage(o))
                    this.onData(o);
            }
            catch (err) {
                this.error(err);
                this.log('Data: ' + JSON.stringify(evt.data));
            }
        };
        this.socket = s;
    }
    onData(d) {
    }
    getId() {
        return this.ourId;
    }
    clearLog() {
        if (this.logEl)
            this.logEl.innerHTML = '';
    }
    log(msg) {
        if (typeof msg === 'object')
            msg = JSON.stringify(msg);
        if (this.remote && console.log2)
            console.log2(msg);
        else
            console.log(msg);
        const html = `<div>${msg}</div>`;
        this.logEl?.insertAdjacentHTML('afterbegin', html);
    }
    error(msg, exception) {
        if (this.remote && console.error2)
            console.error2(msg);
        else
            console.error(msg);
        let html = `<div class="error">${msg}</div>`;
        if (exception?.stack)
            html += `<div class="error">${exception.stack}</div>`;
        this.logEl?.insertAdjacentHTML('afterbegin', html);
    }
}

export { Remote };
