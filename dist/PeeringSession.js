import * as Util from './Util';
export class PeeringSession extends EventTarget {
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
        return `${this.state} ${this.channel.name} id: ${this.id} ${this.weInitiated ? `local` : `remote`} elapsed: ${Util.elapsed(this._createdAt)}`;
    }
    elapsedString() {
        return Util.elapsed(this._createdAt);
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
        const id = Util.shortUuid();
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
//# sourceMappingURL=PeeringSession.js.map