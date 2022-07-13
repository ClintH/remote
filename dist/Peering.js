import { LogicalNode } from "./LogicalNode";
import { PeeringSession } from "./PeeringSession";
import { ExpiringMultiMap } from "./util/ExpiringMap";
import { Log } from "./util/Log";
export class Peering extends EventTarget {
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
        const payload = JSON.parse(i.payload);
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
                if (inProgress) {
                }
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
//# sourceMappingURL=Peering.js.map