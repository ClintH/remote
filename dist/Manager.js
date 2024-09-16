import * as Util from './Util';
import { BcBroadcast } from "./BcBroadcast";
import { Broadcast } from "./Broadcast";
import { Peering } from "./Peering";
import { RtcChannelFactory } from "./RtcChannelFactory";
import { StatusDisplay } from "./util/StatusDisplay";
import { WebsocketBroadcast } from "./WebsocketBroadcast";
export class Manager extends EventTarget {
    constructor(opts = {}) {
        super();
        this.opts = opts;
        this._seenIds = new Set();
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
        data = this.validateOutgoing(data);
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
    validateOutgoing(payload) {
        const t = typeof payload;
        if (t === `string` || t === `number` || t === `boolean`) {
            payload = { data: payload };
        }
        else if (Array.isArray(payload)) {
            payload = { data: payload };
        }
        else if (t === `bigint` || t === `function`) {
            throw new Error(`cannot send type ${t}`);
        }
        if (payload._id === undefined) {
            const id = Util.shortUuid();
            payload._id = id;
            this._seenIds.add(id);
        }
        payload._from = this.peerId;
        return payload;
    }
    validateIncoming(msg) {
        if (this._seenIds.has(msg._id)) {
            return false;
        }
        this._seenIds.add(msg._id);
        return true;
    }
    maintain() {
        const seen = [...this._seenIds.values()];
        this._seenIds = new Set(seen.slice(seen.length / 2));
        this.peering.maintain();
        this.broadcast.maintain();
        const cf = [...this._channelFactories];
        cf.forEach(c => c.maintain());
        this.advertise();
    }
    dump() {
        console.group(`remote`);
        console.log(`# seen msg ids: ${[...this._seenIds.values()].length}`);
        this.peering.dumpToConsole();
        this.broadcast.dumpToConsole();
        console.groupEnd();
    }
    log(msg) {
        console.log(`Remote`, msg);
    }
}
//# sourceMappingURL=Manager.js.map