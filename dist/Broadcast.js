export class Broadcast extends EventTarget {
    constructor(_manager) {
        super();
        this._manager = _manager;
        this._broadcast = [];
        this._peerId = _manager.peerId;
    }
    dumpToConsole() {
        console.group(`Broadcasters`);
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
        payload = this._manager.validateOutgoing(payload);
        this._broadcast.forEach(b => b.send(payload));
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
            this.warn(`Session message received without an id. Dropping. ${JSON.stringify(data)}`);
            return;
        }
        if (!this._manager.validateIncoming(data))
            return;
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
        if (!this._manager.validateIncoming(data))
            return;
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
    }
    log(msg) {
        console.log(`BroadcastMessageHandler`, msg);
    }
}
//# sourceMappingURL=Broadcast.js.map