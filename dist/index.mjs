class BroadcasterBase {
    constructor(_name, _broadcast, _log) {
        this._name = _name;
        this._broadcast = _broadcast;
        this._log = _log;
        this._state = `idle`;
    }
    setState(newState) {
        if (newState == this._state)
            return;
        const priorState = this._state;
        this._state = newState;
        this._log.verbose(priorState + ' -> ' + newState);
        this._broadcast.onBroadcasterState(priorState, newState, this);
    }
    get state() {
        return this._state;
    }
    get name() {
        return this._name;
    }
}

class Log {
    constructor(_prefix, _level = `error`) {
        this._prefix = _prefix;
        this._level = _level;
    }
    static fromConfig(opts, category, prefix) {
        let l = opts[category];
        if (l === undefined) {
            const log = opts.log;
            if (log !== undefined)
                l = log[category];
        }
        if (l === `silent` || l === `verbose` || `error`)
            return new Log(prefix, l);
        return new Log(prefix);
    }
    warn(msg) {
        if (this._level !== `verbose`)
            return;
        console.warn(this._prefix, msg);
    }
    verbose(msg) {
        if (this._level !== `verbose`)
            return;
        console.log(this._prefix, msg);
    }
    error(msg) {
        if (this._level === `silent`)
            return;
        console.error(this._prefix, msg);
    }
}

class BcBroadcast extends BroadcasterBase {
    constructor(_broadcast) {
        super(`bc`, _broadcast, Log.fromConfig(_broadcast._manager.opts, `bc`, `BcBroadcast`));
        this._bc = new BroadcastChannel(`remote`);
        this._bc.addEventListener(`message`, evt => {
            try {
                const msg = JSON.parse(evt.data);
                this._log.verbose(msg);
                this._broadcast.onMessage(msg, this);
            }
            catch (e) {
                console.error(e);
            }
        });
        setTimeout(() => {
            this.setState(`open`);
        }, 500);
    }
    static isSupported() {
        return (`BroadcastChannel` in self);
    }
    toString() {
        return `BcBroadcast`;
    }
    maintain() {
    }
    send(payload) {
        if (typeof payload === `string`) {
            payload = { data: payload };
        }
        this._broadcast.ensureId(payload);
        payload._channel = `bc-bc`;
        this._bc.postMessage(JSON.stringify(payload));
        return true;
    }
}

const shortUuid = () => {
    const firstPart = (Math.random() * 46656) | 0;
    const secondPart = (Math.random() * 46656) | 0;
    return ("000" + firstPart.toString(36)).slice(-3) + ("000" + secondPart.toString(36)).slice(-3);
};
const elapsed = (from) => {
    let e = Date.now() - from;
    if (e < 1000)
        return `${e}ms`;
    e /= 1000;
    if (e < 1000)
        return `${e}s`;
    e /= 60;
    if (e < 60)
        return `${e}mins`;
    e /= 60;
    return `${e}hrs`;
};

class Broadcast extends EventTarget {
    constructor(_manager) {
        super();
        this._manager = _manager;
        this._broadcast = [];
        this._peerId = _manager.peerId;
        this._seenIds = new Set();
    }
    dumpToConsole() {
        console.group(`Broadcasters`);
        console.log(`# seen msg ids: ${[...this._seenIds.values()].length}`);
        for (const b of this._broadcast) {
            console.log(b.name + ' (' + b.state + ')');
        }
        console.groupEnd();
    }
    onBroadcasterState(priorState, newState, source) {
        this.dispatchEvent(new CustomEvent(`change`, {
            detail: { priorState, newState, source }
        }));
    }
    add(b) {
        this._broadcast.push(b);
    }
    send(payload) {
        this.ensureId(payload);
        this._broadcast.forEach(b => b.send(payload));
    }
    ensureId(payload) {
        if (payload._id === undefined) {
            const id = shortUuid();
            payload._id = id;
            this._seenIds.add(id);
        }
        payload._from = this._peerId;
    }
    warn(msg) {
        console.log(`Broadcast`, msg);
    }
    onSessionMessageReceived(data, via, session) {
        if (typeof data === `string`)
            throw new Error(`Expected object`);
        const { _id, _kind, _from } = data;
        if (_from !== undefined)
            this._manager.peering.notifySeenPeer(_from, session);
        if (_id === undefined) {
            this.warn(`Message received without an id. Dropping. ${JSON.stringify(data)}`);
            return;
        }
        if (!this._seenIds.has(_id)) {
            this._seenIds.add(_id);
        }
        this._manager.onMessageReceived(data, via);
    }
    onMessage(data, via) {
        const { _id, _kind, _from } = data;
        if (_from !== undefined) {
            this._manager.peering.notifySeenPeer(_from, via);
        }
        if (_id === undefined) {
            this.warn(`Message received without an id. Dropping. ${JSON.stringify(data)}`);
            return;
        }
        if (this._seenIds.has(_id)) {
            return;
        }
        else {
            this._seenIds.add(_id);
        }
        if (_kind === undefined) {
            this._manager.onBroadcastReceived(data, via);
            return;
        }
        switch (_kind) {
            case `peering-ad`:
                this._manager.peering.onAdvertReceived(data, via);
                break;
            case `peering-invite`:
                this._manager.peering.onInviteReceived(data, via);
                break;
            case `peering-reply`:
                this._manager.peering.onReply(data, via);
                break;
            default:
                this.log(`Unknown message kind: ${_kind}`);
        }
    }
    maintain() {
        const bcs = [...this._broadcast];
        bcs.forEach(b => b.maintain());
        const seen = [...this._seenIds.values()];
        this._seenIds = new Set(seen.slice(seen.length / 2));
    }
    log(msg) {
        console.log(`BroadcastMessageHandler`, msg);
    }
}

class LogicalNode {
    constructor(_id, _peering) {
        this._id = _id;
        this._peering = _peering;
        this._deadAfterIdleMs = 60 * 1000;
        this._sessions = [];
        this._state = `idle`;
        this._idleSince = Date.now();
        this._log = new Log(`LogicalNode[${_id}]`, _peering.manager.opts.defaultLog ?? `error`);
    }
    send(data) {
        if (this.isDead)
            throw new Error(`Cannot send while node is dead`);
        for (const s of this._sessions) {
            if (s.state === `open`) {
                console.log(`Send via ${s.channel.name}`);
                s.send(data);
                return true;
            }
        }
        return false;
    }
    setState(newState) {
        if (newState == this._state)
            return;
        if (this.isDead)
            throw new Error(`Node is marked dead, cannot change state`);
        const priorState = this._state;
        this._state = newState;
        if (newState === `idle`)
            this._idleSince = Date.now();
        this._peering.onLogicalNodeState(priorState, newState, this);
    }
    hasChannel(channelName) {
        return (this._sessions.some(c => (c.channel.name === channelName)));
    }
    onSessionEstablished(s) {
        if (this.isDead)
            throw new Error(`Node is marked dead, cannot establish session`);
        this._sessions.push(s);
        this._log.verbose(`Session established. ch: ${s.channel.name} id: ${s.id}. ${this._sessions.length} sesion(s)`);
        this.setState(`open`);
    }
    dump() {
        let t = [`LogicalNode[${this._id}]`];
        this._sessions.forEach(s => {
            t.push(` - ` + s.statusString());
        });
        return t.join('\n');
    }
    dumpSessions() {
        let t = '';
        this._sessions.forEach(s => {
            t += ` - ` + s.state + ' ' + s.channel.name + ' elapsed: ' + s.elapsedString() + '\n';
        });
        return t.trim();
    }
    maintain() {
        if (this.isDead)
            return;
        const sessions = [...this._sessions];
        for (const s of sessions) {
            s.maintain();
        }
        const length = this._sessions.length;
        this._sessions = this._sessions.filter(s => s.state === `open`);
        if (this._sessions.length !== length) {
            this._log.verbose(`Removed ${length - this._sessions.length} session(s).`);
        }
        if (this.sessions.length === 0)
            this.setState(`idle`);
        if (this._state === `idle`) {
            const elapsed = Date.now() - this._idleSince;
            if (elapsed > this._deadAfterIdleMs)
                this.setState(`dead`);
        }
    }
    get id() {
        return this._id;
    }
    get sessions() {
        return [...this._sessions];
    }
    get isDead() {
        return this._state === `dead`;
    }
    get state() {
        return this._state;
    }
}

class PeeringSession extends EventTarget {
    constructor(id, weInitiated, remotePeer, channel, bc, manager) {
        super();
        this.id = id;
        this.weInitiated = weInitiated;
        this.remotePeer = remotePeer;
        this.channel = channel;
        this.bc = bc;
        this.manager = manager;
        this._state = `idle`;
        this._createdAt = Date.now();
    }
    onMessageReceived(data, via) {
        this.manager.broadcast.onSessionMessageReceived(data, via, this);
    }
    send(data) {
        this.dispatchEvent(new CustomEvent(`send`, { detail: { ...data } }));
        return true;
    }
    get name() {
        return `peering-session`;
    }
    statusString() {
        return `${this.state} ${this.channel.name} id: ${this.id} ${this.weInitiated ? `local` : `remote`} elapsed: ${elapsed(this._createdAt)}`;
    }
    elapsedString() {
        return elapsed(this._createdAt);
    }
    setState(newState) {
        if (this._state === newState)
            return;
        const priorState = this._state;
        this._state = newState;
        this.dispatchEvent(new CustomEvent(`change`, { detail: { priorState, newState } }));
    }
    maintain() {
        if (this._state == `started` || this._state == `idle`) {
            if (Date.now() - this._createdAt > 10 * 1000) {
                this.setState(`timeout`);
            }
        }
    }
    get state() {
        return this._state;
    }
    onClosed(reason) {
        this.dispose();
    }
    onOpened() {
        this.setState(`open`);
        this.manager.peering.onSessionEstablished(this);
    }
    dispose() {
        this.log(`dispose`);
        this.setState(`closed`);
        this.dispatchEvent(new Event(`disposing`));
    }
    static initiate(remotePeer, channel, bc, manager) {
        const id = shortUuid();
        return new PeeringSession(id, true, remotePeer, channel, bc, manager);
    }
    ;
    static accept(sessionId, remotePeer, channel, bc, manager) {
        return new PeeringSession(sessionId, false, remotePeer, channel, bc, manager);
    }
    start() {
        if (this.state !== `idle`)
            throw new Error(`Can only start while idle`);
        this.channel.initiatePeering(this.remotePeer, this);
    }
    log(msg) {
        console.log(`PeeringSession`, msg);
    }
    onReply(r, bc) {
        this.dispatchEvent(new CustomEvent(`reply`, { detail: { reply: r, bc } }));
    }
    broadcastReply(kind, data) {
        data = {
            ...data,
            _kind: kind
        };
        this.bc.send(data);
    }
}

class ExpiringMultiMap {
    constructor(expiryMs) {
        this.expiryMs = expiryMs;
        this._store = new Map();
        setTimeout(() => {
            this.maintain();
        }, Math.min(expiryMs, 30 * 1000));
    }
    get lengthKeys() {
        const keys = [...this._store.keys()];
        return keys.length;
    }
    maintain() {
        const entries = [...this._store.entries()];
        const now = Date.now();
        entries.forEach(([k, arr]) => {
            arr = arr.filter(v => v.expiresAt > now);
            if (arr.length == 0) {
                this._store.delete(k);
            }
            else {
                this._store.set(k, arr);
            }
        });
    }
    get(key) {
        const a = this._store.get(key);
        if (a === undefined)
            return [];
        return a.map(v => v.data);
    }
    *valuesForKey(key) {
        const a = this._store.get(key);
        if (a === undefined)
            return;
        for (let i = 0; i < a.length; i++) {
            yield a[i];
        }
    }
    *keys() {
        yield* this._store.keys();
    }
    *entriesRaw() {
        yield* this._store.entries();
    }
    *entries() {
        for (const e of this._store.entries()) {
            for (let i = 0; i < e[1].length; i++) {
                yield [e[0], e[1][i].data];
            }
        }
    }
    dump() {
        const now = Date.now();
        const until = (v) => {
            let e = v - now;
            if (e < 1000)
                return `${e}ms`;
            e /= 1000;
            if (e < 1000)
                return `${Math.round(e)}s`;
            e /= 60;
            return `${Math.round(e)}mins`;
        };
        let t = ``;
        for (const [k, v] of this._store.entries()) {
            t += `${k} = `;
            for (let i = 0; i < v.length; i++) {
                t += v[i].data + ' (expires in ' + until(v[i].expiresAt) + ') ';
            }
        }
        if (t.length === 0)
            return `(empty)`;
        else
            return t;
    }
    add(key, value) {
        let a = this._store.get(key);
        if (a === undefined) {
            a = [];
            this._store.set(key, a);
        }
        const existing = a.find(v => v.data === value);
        if (existing === undefined) {
            a.push({ data: value, expiresAt: Date.now() + this.expiryMs });
        }
        else {
            existing.expiresAt = Date.now() + this.expiryMs;
        }
    }
}

class Peering extends EventTarget {
    constructor(manager) {
        super();
        this.manager = manager;
        this._log = new Log(`Peering`, manager.opts.defaultLog ?? `silent`);
        this._nodes = new Map();
        this._inProgress = [];
        this._ephemeral = new ExpiringMultiMap(30 * 1000);
    }
    getEphemeral(peerId) {
        return this._ephemeral.get(peerId);
    }
    getLogicalNode(peerId) {
        return this._nodes.get(peerId);
    }
    onLogicalNodeState(priorState, newState, node) {
        this.dispatchEvent(new CustomEvent(`logicalNodeState`, {
            detail: {
                newState, priorState, node
            }
        }));
    }
    hasChannel(channelName) {
        for (const n of this._nodes.values()) {
            if (n.hasChannel(channelName))
                return true;
        }
    }
    dumpToConsole() {
        console.group(`Peering`);
        console.group(`LogicalNodes`);
        for (const n of this._nodes.values()) {
            let ln = n.id + ` (${n.state})\n`;
            const sessions = n.sessions;
            for (const s of sessions) {
                ln += ' - ' + s.channel.name + ' (' + s.state + ') ' + s.id + '\n';
            }
            console.log(ln);
        }
        console.groupEnd();
        if (this._inProgress.length > 0) {
            console.group('In progress');
            for (const s of this._inProgress) {
                console.log(s.state + ' ' + s.channel.name + ' ' + s.id + ' ' + s.elapsedString());
            }
            console.groupEnd();
        }
        if (this._ephemeral.lengthKeys > 0) {
            console.group('Ephemeral');
            console.log(this._ephemeral.dump());
            console.groupEnd();
        }
        console.groupEnd();
    }
    onSessionEstablished(s) {
        const n = this.getOrCreate(s.remotePeer);
        n.onSessionEstablished(s);
        this._inProgress = this._inProgress.filter(p => p.id !== s.id);
    }
    maintain() {
        const ip = [...this._inProgress];
        ip.forEach(i => {
            i.maintain();
        });
        this._inProgress = this._inProgress.filter(i => i.state === `idle` ||
            i.state == `open` ||
            i.state === `started`);
        const nodes = [...this._nodes.values()];
        nodes.forEach(n => {
            n.maintain();
            if (this.manager._debugMaintain)
                console.log(n.dump());
        });
        const dead = nodes.filter(n => n.isDead);
        for (const d of dead) {
            this._log.verbose(`Removing dead node: ${d.id}`);
            this.dispatchEvent(new CustomEvent(`logicalNodeRemoved`, {
                detail: {
                    node: d,
                    type: `removed`
                }
            }));
            this._nodes.delete(d.id);
        }
        if (this.manager._debugMaintain)
            console.log(this._ephemeral.dump());
    }
    getOrCreate(id) {
        let n = this._nodes.get(id);
        if (n === undefined) {
            n = new LogicalNode(id, this);
            this._nodes.set(id, n);
            this.dispatchEvent(new CustomEvent(`logicalNodeAdded`, {
                detail: {
                    node: n,
                    type: `added`
                }
            }));
        }
        return n;
    }
    findPeeringSession(peerId, channel) {
        return this._inProgress.find(p => p.remotePeer === peerId && p.channel === channel);
    }
    findPeeringSessionById(session) {
        return this._inProgress.find(p => p.id === session);
    }
    findPeeringSessionByRemote(remote) {
        return this._inProgress.find(p => p.remotePeer === remote);
    }
    onInviteReceived(i, bc) {
        try {
            const invitee = i.invitee;
            if (invitee !== this.manager.peerId)
                return;
            if (this.findPeeringSessionByRemote(i.inviter)) {
                this.warn(`Dropping invitation from a peer we have already invited: ${i.inviter}. Our id: ${this.manager.peerId}`);
                return;
            }
            this.onAllowInvite(i, bc);
        }
        catch (ex) {
            this.warn(ex);
        }
    }
    onReply(r, bc) {
        const s = this.findPeeringSessionById(r.peeringSessionId);
        if (s === undefined) {
            this._log.warn(`Received peering reply for unknown session  ${r.peeringSessionId}`);
            this._log.warn(r);
            this._log.warn(`Sessions: ` + this._inProgress.map(p => p.id).join(', '));
            return;
        }
        s.onReply(r, bc);
    }
    onAllowInvite(i, bc) {
        JSON.parse(i.payload);
        const ch = this.manager.getChannelFactory(i.channel);
        if (ch === undefined) {
            this.warn(`Received invitation for channel ${i.channel}, but we do not support it`);
            return;
        }
        const s = PeeringSession.accept(i.peeringSessionId, i.inviter, ch, bc, this.manager);
        this._inProgress.push(s);
        ch.acceptInvitation(i, s, bc);
    }
    warn(msg) {
        console.warn(`PeeringHandler`, msg);
    }
    notifySeenPeer(peer, bc) {
        this._ephemeral.add(peer, bc);
    }
    onAdvertReceived(pa, bc) {
        const n = this.getOrCreate(pa.peerId);
        const channels = pa.channels.split(', ');
        this.notifySeenPeer(pa.peerId, bc);
        channels.forEach(c => {
            if (c.length === 0 || c === undefined)
                return;
            const ch = this.manager.getChannelFactory(c);
            if (ch === undefined) {
                return;
            }
            if (!n.hasChannel(c)) {
                const inProgress = this.findPeeringSession(pa.peerId, ch);
                if (inProgress) ;
                else {
                    const start = PeeringSession.initiate(pa.peerId, ch, bc, this.manager);
                    this._inProgress.push(start);
                    start.start();
                }
            }
        });
    }
    getLogicalNodes() {
        return [...this._nodes.values()];
    }
}

class RtcPeeringSession {
    constructor(session) {
        this.session = session;
        this._pc = new RTCPeerConnection({
            iceServers: [
                { urls: ['stun:stun.services.mozilla.com'] },
                { urls: ['stun:stun.l.google.com:19302'] }
            ]
        });
        this._log = Log.fromConfig(session.manager.opts, `rtc`, `RtcPeeringSession`);
        this._onDisposingH = this.onDisposing.bind(this);
        this._onReplyH = this.onReply.bind(this);
        this._onSendH = this.onSend.bind(this);
        session.addEventListener(`reply`, this._onReplyH);
        session.addEventListener(`disposing`, this._onDisposingH);
        session.addEventListener(`send`, this._onSendH);
    }
    onSend(evt) {
        const data = evt.detail;
        if (this._dc) {
            console.log(`RTC Sending`, data);
            this._dc.send(JSON.stringify(data));
        }
        else {
            this.warn(`Cannot send without data channel`);
        }
    }
    onDisposing() {
        this._log.verbose(`onDisposing`);
        this.session.removeEventListener(`reply`, this._onReplyH);
        this.session.removeEventListener(`disposing`, this._onDisposingH);
    }
    onReply(evt) {
        const { reply, bc } = evt.detail;
        const subKind = reply.sub;
        switch (subKind) {
            case `rtc-accept`:
                try {
                    const descr = JSON.parse(reply.payload);
                    this._pc.setRemoteDescription(descr);
                }
                catch (ex) {
                    this.warn(ex);
                }
                break;
            case `rtc-ice`:
                try {
                    const c = new RTCIceCandidate({
                        sdpMLineIndex: reply.label,
                        candidate: reply.candidate
                    });
                    this._pc.addIceCandidate(c);
                }
                catch (ex) {
                    this.warn(ex);
                    this.warn(reply);
                }
                break;
            default:
                this._log.verbose(`Cannot handle reply ${subKind}`);
        }
    }
    warn(msg) {
        console.warn(`RtcPeeringSession`, msg);
    }
    async start() {
        const p = this._pc;
        const dc = this._pc.createDataChannel(`${this.session.remotePeer}`);
        this.setupDataChannel(dc);
        p.addEventListener(`icecandidate`, evt => {
            const c = evt.candidate;
            if (c === null)
                return;
            this.session.broadcastReply(`peering-reply`, {
                sub: `rtc-ice`,
                peeringSessionId: this.session.id,
                label: c.sdpMLineIndex,
                id: c.sdpMid,
                candidate: c.candidate
            });
        });
        p.addEventListener(`close`, evt => {
            this._log.verbose(`channel close`);
        });
        p.addEventListener(`error`, evt => {
            this._log.verbose(`channel error`);
        });
        p.addEventListener(`open`, evt => {
            this._log.verbose(`channel open`);
        });
        p.addEventListener(`message`, evt => {
            this._log.verbose(`channel message: ${JSON.stringify(evt)}`);
        });
        this._pc = p;
        const o = await p.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
        await p.setLocalDescription(o);
        const invite = {
            invitee: this.session.remotePeer,
            inviter: this.session.manager.peerId,
            channel: `rtc`,
            peeringSessionId: this.session.id,
            payload: JSON.stringify(o)
        };
        this.session.broadcastReply(`peering-invite`, invite);
    }
    setupDataChannel(dc) {
        this._dc = dc;
        dc.addEventListener(`close`, evt => {
            this._log.verbose(`dc close`);
            this.session.onClosed(`data channel closed`);
        });
        dc.addEventListener(`closing`, evt => {
            this._log.verbose(`dc closing`);
        });
        dc.addEventListener(`error`, evt => {
            this._log.verbose(`dc error`);
        });
        dc.addEventListener(`message`, evt => {
            try {
                const o = JSON.parse(evt.data);
                this.session.onMessageReceived(o, this);
            }
            catch (e) {
                this._log.warn(`Could not parse: ${evt.data}`);
            }
        });
        dc.addEventListener(`open`, evt => {
            this._log.verbose(`dc open`);
            this.session.onOpened();
        });
    }
    acceptInvitation(i) {
        this._log.verbose(`Accept invitation from ${i.inviter}`);
        try {
            const payload = JSON.parse(i.payload);
            const p = this._pc;
            p.addEventListener(`datachannel`, evt => {
                this._log.verbose(`Data channel created!`);
                this.setupDataChannel(evt.channel);
            });
            p.setRemoteDescription(payload);
            p.createAnswer().then(descr => {
                p.setLocalDescription(descr);
                this.session.broadcastReply(`peering-reply`, {
                    invitee: i.invitee,
                    sub: `rtc-accept`,
                    peeringSessionId: this.session.id,
                    inviter: i.inviter,
                    payload: JSON.stringify(descr)
                });
            });
        }
        catch (ex) {
            console.warn(ex);
        }
    }
}
class RtcChannelFactory {
    constructor() {
    }
    get name() {
        return `rtc`;
    }
    maintain() {
    }
    acceptInvitation(i, session, bc) {
        const s = new RtcPeeringSession(session);
        s.acceptInvitation(i);
    }
    initiatePeering(remoteId, session) {
        const s = new RtcPeeringSession(session);
        s.start();
    }
}

class StatusDisplay {
    constructor(manager, opts = {}) {
        this.manager = manager;
        const defaultOpacity = opts.defaultOpacity ?? 0.1;
        const updateRateMs = opts.updateRateMs ?? 5000;
        this.hue = opts.hue ?? 90;
        const e = this._el = document.getElementById(`remote-status`);
        if (e === null)
            return;
        const styleIndicators = (el) => {
            el.style.display = `flex`;
            el.style.alignItems = `center`;
        };
        const bcIndicators = document.createElement(`DIV`);
        bcIndicators.append(this.createIndicator(`ws`, `WebSockets`), this.createIndicator(`bc`, `BroadcastChannel`));
        styleIndicators(bcIndicators);
        e.append(bcIndicators);
        const nodeIndicators = document.createElement(`DIV`);
        styleIndicators(nodeIndicators);
        e.append(nodeIndicators);
        e.style.background = `hsla(${this.hue}, 20%, 50%, 50%)`;
        e.style.color = `hsl(${this.hue}, 50%, 10%)`;
        e.style.border = `1px solid hsla(${this.hue}, 20%, 10%, 50%)`;
        e.style.fontSize = `0.7em`;
        e.style.position = `fixed`;
        e.style.bottom = `0`;
        e.style.right = `0`;
        e.style.padding = `0.3em`;
        e.style.opacity = defaultOpacity.toString();
        e.addEventListener(`pointerover`, () => {
            e.style.opacity = `1.0`;
        });
        e.addEventListener(`pointerout`, () => {
            e.style.opacity = defaultOpacity.toString();
        });
        e.addEventListener(`click`, () => {
            manager.dump();
        });
        manager.broadcast.addEventListener(`change`, evt => {
            const { priorState, newState, source } = evt.detail;
            this.setIndicator(bcIndicators, source.name, newState === `open`, newState);
        });
        manager.peering.addEventListener(`logicalNodeState`, evt => {
            const { priorState, newState, node } = evt.detail;
            this.setIndicator(nodeIndicators, node.id, node.state === `open`, node.dumpSessions());
        });
        manager.peering.addEventListener(`logicalNodeAdded`, evt => {
            const { type, node } = evt.detail;
            nodeIndicators.append(this.createIndicator(node.id, `Node`));
        });
        manager.peering.addEventListener(`logicalNodeRemoved`, evt => {
            const { type, node } = evt.detail;
            const i = this.getIndicator(nodeIndicators, node.id);
            if (i !== null)
                i.remove();
        });
        setInterval(() => {
            const nodes = this.manager.peering.getLogicalNodes();
            const seen = new Set();
            for (const n of nodes) {
                seen.add(n.id);
                let sessions = n.dumpSessions();
                const eph = this.manager.peering.getEphemeral(n.id);
                for (const e of eph) {
                    sessions += '\nSeen on: ' + e.name + ' (' + e.state + ')';
                }
                this.setIndicator(nodeIndicators, n.id, n.state === `open`, sessions);
            }
            const indicators = this.getIndicators(nodeIndicators);
            for (const i of indicators) {
                if (!seen.has(i.getAttribute(`data-for`))) {
                    i.remove();
                }
            }
        }, updateRateMs);
    }
    getIndicators(parent) {
        return Array.from(parent.querySelectorAll(`.remote-indicator`));
    }
    getIndicator(parent, label) {
        return parent.querySelector(`[data-for="${label}"]`);
    }
    setIndicator(parent, label, state, titleAddition = ``) {
        let el = this.getIndicator(parent, label);
        if (el === null) {
            el = this.createIndicator(label, titleAddition);
            parent.append(el);
            return;
        }
        const title = el.getAttribute(`data-title`) + ` ` + titleAddition;
        el.title = title;
        if (state) {
            el.style.border = `1px solid hsla(${this.hue}, 30%, 10%, 50%)`;
        }
        else {
            el.style.border = ``;
        }
    }
    createIndicator(label, title = ``) {
        const ind = document.createElement(`div`);
        ind.innerText = label;
        ind.title = title;
        ind.classList.add(`remote-indicator`);
        ind.setAttribute(`data-for`, label);
        ind.style.padding = `0.3em`;
        ind.setAttribute(`data-title`, title);
        return ind;
    }
}

class Event$1 {
    constructor(type, target) {
        this.target = target;
        this.type = type;
    }
}
class ErrorEvent extends Event$1 {
    constructor(error, target) {
        super('error', target);
        this.message = error.message;
        this.error = error;
    }
}
class CloseEvent extends Event$1 {
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

class WebsocketBroadcast extends BroadcasterBase {
    constructor(broadcast, serverUrl) {
        super(`ws`, broadcast, Log.fromConfig(broadcast._manager.opts, `ws`, `WebsocketBroadcast`));
        const url = serverUrl ?? (location.protocol === 'http:' ? 'ws://' : 'wss://') + location.host + '/ws';
        this._ws = new ReconnectingWebSocket(url);
        let alrightSeenErrorThankYou = false;
        this._ws.addEventListener(`close`, evt => {
            this._log.verbose(`close`);
            this.setState(`closed`);
        });
        this._ws.addEventListener(`error`, evt => {
            if (evt.message === `TIMEOUT` || alrightSeenErrorThankYou)
                return;
            this._log.warn(`error: ${evt}`);
            alrightSeenErrorThankYou = true;
            this.setState(`error`);
        });
        this._ws.addEventListener(`message`, evt => {
            try {
                const m = JSON.parse(evt.data);
                this._broadcast.onMessage(m, this);
            }
            catch (e) {
                this._log.warn(e);
            }
        });
        this._ws.addEventListener(`open`, evt => {
            alrightSeenErrorThankYou = false;
            this.setState(`open`);
            this._log.verbose(`Connected to ${url}`);
        });
    }
    toString() {
        return `WebsocketBroadcast`;
    }
    maintain() {
    }
    send(payload) {
        if (typeof payload === `string`) {
            payload = { data: payload };
        }
        this._broadcast.ensureId(payload);
        payload._channel = `ws-bc`;
        this._ws.send(JSON.stringify(payload));
        return true;
    }
}

class Manager extends EventTarget {
    constructor(opts = {}) {
        super();
        this.opts = opts;
        this.peerId = opts.peerId ?? new Date().getMilliseconds() + `-` + Math.floor(Math.random() * 100);
        this._allowNetwork = opts.allowNetwork ?? false;
        this._debugMaintain = opts.debugMaintain ?? false;
        this._defaultLog = opts.defaultLog ?? `error`;
        if (!opts.log)
            opts.log = {};
        if (!opts.log.rtc)
            opts.log.rtc = this._defaultLog;
        if (!opts.log.bc)
            opts.log.bc = this._defaultLog;
        this.log(`Id: ${this.peerId}. network allowed: ${this._allowNetwork}`);
        this.peering = new Peering(this);
        this.broadcast = new Broadcast(this);
        this._channelFactories = [];
        this._statusDisplay = new StatusDisplay(this);
        if (this._allowNetwork) {
            this.broadcast.add(new WebsocketBroadcast(this.broadcast, opts.websocket));
            this.addChannelFactory(new RtcChannelFactory());
        }
        if (BcBroadcast.isSupported()) {
            this.broadcast.add(new BcBroadcast(this.broadcast));
        }
        else {
            this.log(`BroadcastChannel not supported by this browser`);
        }
        const loopMs = opts.maintainLoopMs ?? 60 * 1000 + (20 * 1000 * Math.random());
        setInterval(() => {
            this.maintain();
        }, loopMs);
        setTimeout(() => {
            this.advertise();
        }, 5000 * Math.random());
    }
    getChannelFactory(name) {
        return this._channelFactories.find(c => c.name === name);
    }
    addChannelFactory(c) {
        this._channelFactories.push(c);
    }
    onBroadcastReceived(data, via) {
        this.dispatchEvent(new CustomEvent(`message`, {
            detail: data
        }));
    }
    onMessageReceived(data, via) {
        this.dispatchEvent(new CustomEvent(`message`, {
            detail: data
        }));
    }
    send(data, to) {
        if (typeof data === `string`)
            data = { msg: data };
        this.broadcast.ensureId(data);
        if (to !== undefined && to.length > 0) {
            data._to = to;
            const n = this.peering.getLogicalNode(to);
            if (n !== undefined) {
                if (n.send(data)) {
                    return;
                }
            }
            const channels = this.peering.getEphemeral(to);
            for (const ch of channels) {
                if (ch.send(data)) {
                    console.log(`Sent on channel ${ch.name}`);
                    return;
                }
            }
        }
        console.log(`Broadcast fallback`);
        this.broadcast.send(data);
    }
    advertise() {
        let f = this._channelFactories.map(f => f.name);
        const ad = {
            _kind: `peering-ad`,
            peerId: this.peerId,
            channels: f.join(', ')
        };
        this.broadcast.send({ ...ad });
    }
    maintain() {
        this.peering.maintain();
        this.broadcast.maintain();
        const cf = [...this._channelFactories];
        cf.forEach(c => c.maintain());
        this.advertise();
    }
    dump() {
        console.group(`remote`);
        this.peering.dumpToConsole();
        this.broadcast.dumpToConsole();
        console.groupEnd();
    }
    log(msg) {
        console.log(`Remote`, msg);
    }
}

class Remote {
    constructor(opts) {
        this._manager = new Manager(opts);
        this._manager.addEventListener(`message`, evt => {
            const d = evt.detail;
            delete d._id;
            delete d._channel;
            this.onData(d);
        });
    }
    get id() {
        return this._manager.peerId;
    }
    send(data, to) {
        this._manager.send(data, to);
    }
    broadcast(data) {
        this._manager.broadcast.send(data);
    }
    onData(msg) {
    }
}

export { Manager, Remote };
