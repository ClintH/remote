import ReconnectingWebsocket from "./ReconnectingWebsocket.js";
export default class Remote {
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
        const s = new ReconnectingWebsocket(this.url);
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
//# sourceMappingURL=Remote.js.map