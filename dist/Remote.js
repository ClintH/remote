import ReconnectingWebsocket from "./ReconnectingWebsocket.js";
import Intervals from './Intervals.js';
export default class Remote {
    constructor(opts = { disableRemote: false }) {
        this.bc = null;
        this.connected = false;
        this.useSockets = false;
        this.useBroadcastChannel = false;
        this.matchIds = false;
        this.consoleRedirected = false;
        this.receiveSerials = new Map();
        this.serial = 0;
        this.lastDataEl = null;
        this.logEl = null;
        this.activityEl = null;
        this.lastSend = 0;
        this.sendInterval = new Intervals(5);
        this.receiveInterval = new Intervals(5);
        if (!opts.minMessageIntervalMs)
            opts.minMessageIntervalMs = 15;
        if (!opts.serialise)
            opts.serialise = true;
        if (opts.matchIds)
            this.matchIds = true;
        this.disableRemote = opts.disableRemote;
        this.serialise = opts.serialise;
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
        const d = {
            from: this.ourId,
            ...data
        };
        if (this.serialise)
            d.serial = this.serial++;
        let str = JSON.stringify(d);
        if (this.socket && this.useSockets && this.socket.isReady())
            this.socket.send(str);
        if (this.useBroadcastChannel && this.bc) {
            this.bc.postMessage(str);
        }
        if (this.lastDataEl && !this.disableRemote) {
            if (str.length > 500)
                str = str.substring(0, 500) + '...';
            this.lastDataEl.innerText = str;
        }
        this.lastSend = Date.now();
        this.sendInterval.ping();
        if (this.serial > 1000)
            this.serial = 0;
    }
    seenMessage(o) {
        if (!this.serialise)
            return false;
        if (!o.serial)
            return;
        if (!o.from)
            return;
        const lastSerial = this.receiveSerials.get(o.from);
        if (lastSerial) {
            if (lastSerial === o.serial) {
                return true;
            }
            if (lastSerial > o.serial) {
                if (o.serial < 10) {
                }
                else
                    return true;
            }
        }
        this.receiveSerials.set(o.from, o.serial);
        return false;
    }
    initBroadcastChannel() {
        try {
            const bc = new BroadcastChannel('remote');
            bc.onmessage = (evt) => {
                this.receiveInterval.ping();
                try {
                    const o = JSON.parse(evt.data);
                    o.source = 'bc';
                    if (this.matchIds && o.from !== this.ourId)
                        return;
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
        const hasLogEl = document.getElementById('log') !== null;
        if (!this.disableRemote && hasLogEl) {
            this.consoleRedirected = true;
            console.log2 = console.log;
            console.error2 = console.error;
            console.log = this.log.bind(this);
            console.error = this.error.bind(this);
            window.onerror = (message, source, lineno, colno, error) => this.error(message, error);
            document.getElementById('logTitle')?.addEventListener('click', () => this.clearLog());
        }
        if (this.ourId === undefined) {
            try {
                let id = window.localStorage.getItem('id');
                if (id)
                    this.setId(id);
            }
            catch (e) { }
        }
        if (this.ourId === undefined) {
            this.setId(Date.now().toString(36) + Math.random().toString(36).substr(2));
            if (this.ourId) {
                try {
                    window.localStorage.setItem('id', this.ourId);
                }
                catch (e) { }
            }
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
        const activityEl = document.getElementById('activity');
        if (activityEl) {
            this.activityEl = activityEl;
            this.updateActivityLoop();
        }
    }
    updateActivityLoop() {
        this.updateActivity();
        setTimeout(() => this.updateActivityLoop(), 500);
    }
    updateActivity() {
        if (!this.activityEl)
            return;
        let ws = '';
        if (this.connected) {
            ws = `<div style="background-color: green" title="WebSocket connected">WS</div>`;
        }
        else if (this.useSockets) {
            ws = `<div style="background-color: red" title="WebSocket not connected">WS</div>`;
        }
        else {
            ws = `<div style="background-color: gray" title="WebSocket disabled">WS</div>`;
        }
        let bc = '';
        if (this.bc) {
            bc = `<div style="background-color: green" title="BroadcastChannel enabled">BC</div>`;
        }
        else if (this.useBroadcastChannel) {
            bc = `<div style="background-color: red" title="BroadcastChannel not connected">BC</div>`;
        }
        else {
            bc = `<div style="background-color: gray" title="BroadcastChannel disabled">BC</div>`;
        }
        const elapsedReceiveMs = this.receiveInterval.average();
        const elapsedReceiveHtml = isNaN(elapsedReceiveMs) ? '' : `<div title="Average receive interval in ms">R: ${Math.floor(elapsedReceiveMs)}</div>`;
        const elapsedSendMs = this.sendInterval.average();
        const elapsedSendHtml = isNaN(elapsedSendMs) ? '' : `<div title="Average send interval in ms">S: ${Math.floor(elapsedSendMs)}</div>`;
        this.activityEl.innerHTML = ws + bc + elapsedReceiveHtml + elapsedSendHtml;
    }
    setId(id) {
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
            this.receiveInterval.ping();
            if (evt.data === 'connected')
                return;
            try {
                const o = JSON.parse(evt.data);
                o.source = 'ws';
                if (this.matchIds && o.from !== this.ourId)
                    return;
                if (!this.seenMessage(o))
                    this.onData(o);
            }
            catch (err) {
                this.error(err);
                this.log('Ws Data: ' + JSON.stringify(evt.data));
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
        if (this.consoleRedirected && console.log2)
            console.log2(msg);
        else
            console.log(msg);
        const html = `<div>${msg}</div>`;
        this.logEl?.insertAdjacentHTML('afterbegin', html);
    }
    error(msg, exception) {
        if (this.consoleRedirected && console.error2)
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