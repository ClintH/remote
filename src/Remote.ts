import ReconnectingWebsocket from "./ReconnectingWebsocket.js";

interface Options {
  remote: boolean,
  ourId?: string,
  url?: string,
  useSockets?: boolean,
  minMessageIntervalMs?: number,
  useBroadcastChannel?: boolean
}

export default class Remote {
  bc: BroadcastChannel | null = null;
  remote: boolean;
  connected: boolean = false;
  useSockets: boolean = false;
  useBroadcastChannel: boolean = false;
  ourId?: string;
  url?: string;
  minMessageIntervalMs: number;

  lastDataEl: HTMLElement | null = null;
  logEl: HTMLElement | null = null;
  lastSend: number = 0;
  socket?: ReconnectingWebsocket;

  constructor(opts: Options = {remote: false}) {
    if (!opts.minMessageIntervalMs) opts.minMessageIntervalMs = 15;
    this.remote = opts.remote;

    // If sketch is hosted on Glitch, enable sockets, otherwise not
    if (opts.useSockets === undefined)
      this.useSockets = location.host.endsWith('glitch.me') || false;
    else
      this.useSockets = opts.useSockets;

    // Use bcast if we're not using sockets
    if (opts.useBroadcastChannel === undefined) {
      if (opts.useSockets) this.useBroadcastChannel = false;
      else this.useBroadcastChannel = true;
    } else {
      this.useBroadcastChannel = opts.useBroadcastChannel;
    }

    this.ourId = opts.ourId;
    this.lastSend = 0;
    this.url = opts.url;
    this.minMessageIntervalMs = opts.minMessageIntervalMs;
    this.init();

    if (this.useSockets) this.initSockets();
    if (this.useBroadcastChannel) this.initBroadcastChannel();
  }

  send(data: any) {
    // Throttle sending
    const interval = Date.now() - this.lastSend;
    if (interval < this.minMessageIntervalMs) return;

    const str = JSON.stringify({
      from: this.ourId,
      ...data
    });

    // Send out over sockets if ready
    if (this.socket && this.useSockets && this.socket.isReady()) this.socket.send(str);

    // Send out over broadcast channel if available
    if (this.useBroadcastChannel && this.bc) {
      //console.log('bcast post: ' + str);
      this.bc.postMessage(str);
    }

    if (this.lastDataEl) this.lastDataEl.innerText = str;
    this.lastSend = Date.now();
  }

  initBroadcastChannel() {
    try {
      const bc = new BroadcastChannel('remote');
      bc.onmessage = (evt) => {
        try {
          const o = JSON.parse(evt.data);
          o.source = 'bc';
          this.onData(o);
        } catch (err) {
          this.error(err);
          this.log('Data: ' + JSON.stringify(evt.data));
        }
      }
      this.bc = bc;
      console.log('Broadcast channel created');
    } catch (ex) {
      console.error(ex);
    }
  }

  init() {
    this.logEl = document.getElementById('log');
    this.lastDataEl = document.getElementById('lastData');

    // On mobile, won't see console, so add it to HTML
    if (this.remote) {
      // @ts-ignore
      console.log2 = console.log;
      // @ts-ignore
      console.error2 = console.error;
      console.log = this.log.bind(this);
      console.error = this.error.bind(this);

      // Log any uncaught errors
      window.onerror = (message, source, lineno, colno, error) => this.error(message, error);
    }

    if (this.ourId === undefined) {
      // No manual id? Try using the last
      const v = window.localStorage.getItem('remoteId');
      if (v !== null) this.ourId = v;
    }

    if (this.ourId === undefined) {
      // Still no id? Make a random one
      this.ourId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    window.localStorage.setItem('remoteId', this.ourId);

    // Wire up some elements if they are present
    const txtSourceName = document.getElementById('txtSourceName') as HTMLInputElement;
    if (txtSourceName) {
      txtSourceName.value = this.ourId;
      txtSourceName.addEventListener('change', () => {
        const id = txtSourceName.value.trim();
        if (id.length == 0) return;
        this.ourId = id;
        this.log(`Source name changed to: ${this.ourId}`);
        window.localStorage.setItem('remoteId', this.ourId);
      });
    }
    document.getElementById('logTitle')?.addEventListener('click', () => this.clearLog());

  }

  initSockets() {
    if (!this.url)
      this.url = (location.protocol === 'http:' ? 'ws://' : 'wss://') + location.host + '/ws';

    const s = new ReconnectingWebsocket(this.url);
    const setConnected = (isConnected: boolean) => {
      this.connected = isConnected;
      if (isConnected) {
        this.log('Web sockets connected to: ' + this.url);
      } else this.log('Disconnected 😒');
    }
    s.onopen = (e) => {
      setConnected(true);
    };
    s.onclose = (e) => {
      setConnected(false)
    }
    s.onerror = (e) => {
      setConnected(false);
    }
    s.onmessage = (evt) => {
      try {
        const o = JSON.parse(evt.data);
        if (o.from === this.ourId) return; // data is from ourself, ignore
        o.source = 'ws';
        this.onData(o);
      } catch (err) {
        this.error(err);
        this.log('Data: ' + JSON.stringify(evt.data));
      }
    };
    this.socket = s;
  }

  onData(d: any) {
    // noop
  }

  getId() {
    return this.ourId;
  }

  clearLog() {
    if (this.logEl)
      this.logEl.innerHTML = '';
  }

  log(msg: any) {
    if (typeof msg === 'object') msg = JSON.stringify(msg);
    // @ts-ignore
    if (this.remote && console.log2) console.log2(msg);
    else console.log(msg);

    const html = `<div>${msg}</div>`;
    this.logEl?.insertAdjacentHTML('afterbegin', html);
  }

  error(msg: string | Event, exception?: Error) {
    // @ts-ignore
    if (this.remote && console.error2) console.error2(msg);
    else console.error(msg);
    let html = `<div class="error">${msg}</div>`;
    if (exception?.stack)
      html += `<div class="error">${exception.stack}</div>`
    this.logEl?.insertAdjacentHTML('afterbegin', html);
  }
}
