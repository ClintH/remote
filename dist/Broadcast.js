import * as Util from './Util';
export class Broadcast extends EventTarget {
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
            const id = Util.shortUuid();
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
//# sourceMappingURL=Broadcast.js.map