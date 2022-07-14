import * as Util from './Util';
import {BcBroadcast} from "./BcBroadcast";
import {Broadcast,IBroadcaster} from "./Broadcast";
import {IChannelFactory} from "./IChannel";
import {LogLevel} from "./util/Log";
import {Peering} from "./Peering";
import {IPeeringSessionImpl} from "./PeeringSession";
import {RtcChannelFactory} from "./RtcChannelFactory";
import {StatusDisplay} from "./util/StatusDisplay";
import {WebsocketBroadcast} from "./WebsocketBroadcast";

export type Options = {
  websocket?: string
  peerId?:string
  maintainLoopMs?:number
  allowNetwork?:boolean
  debugMaintain?:boolean
  defaultLog?:string
  log?: {
    ws?:LogLevel,
    rtc?:LogLevel,
    bc?:LogLevel
  }
}

export class Manager extends EventTarget {
  private readonly _channelFactories:IChannelFactory[];
  readonly broadcast:Broadcast;
  readonly peering:Peering;
  private _allowNetwork:boolean;
  _debugMaintain:boolean;
  private _defaultLog:string;
  private _statusDisplay:StatusDisplay;
  private _seenIds:Set<string>;

  readonly peerId:string;

  constructor(readonly opts:Options = {}) {
    super();
    this._seenIds = new Set();
    
    this.peerId = opts.peerId ?? new Date().getMilliseconds() + `-` + Math.floor(Math.random()*100);
    this._allowNetwork = opts.allowNetwork ?? false;
    this._debugMaintain = opts.debugMaintain ?? false;
    this._defaultLog = opts.defaultLog ?? `error`;
    if (!opts.log) opts.log = { };
    if (!opts.log.rtc) opts.log.rtc = this._defaultLog as LogLevel;
    if (!opts.log.bc) opts.log.bc = this._defaultLog as LogLevel;
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
    } else {
      this.log(`BroadcastChannel not supported by this browser`);
    }

    const loopMs = opts.maintainLoopMs ?? 60*1000 + (20*1000*Math.random());
    setInterval(() => {
      this.maintain();
    }, loopMs);

    setTimeout(() => {
      this.advertise();
    }, 5000*Math.random());
  }

  getChannelFactory(name:string):IChannelFactory|undefined {
    return this._channelFactories.find(c => c.name === name);
  }

  addChannelFactory(c:IChannelFactory) {
    this._channelFactories.push(c);
  }

  onBroadcastReceived(data:any, via:IBroadcaster) {
    this.dispatchEvent(new CustomEvent(`message`, {
      detail: data
    }));
  }

  onMessageReceived(data:object, via:IPeeringSessionImpl) {
    this.dispatchEvent(new CustomEvent(`message`, {
      detail: data
    }));
  }

  send(data:any, to?:string) {
    data = this.validateOutgoing(data);

    if (to !== undefined && to.length > 0) {
      data._to = to;
      const n = this.peering.getLogicalNode(to);
      if (n !== undefined) {
        //console.log(`Have a logical node to send to`);
        if (n.send(data)) {
          //console.log(` ... and it seems to have been sent`);
          return;
        }
      }

      // Is it ephemeral?
      const channels = this.peering.getEphemeral(to);
      for (const ch of channels) {
        if (ch.send(data)) {
          console.log(`Sent on channel ${ch.name}`);
          return;
        }
      }
    }

    // TODO: If all known peers are on same broadcast channels, just pick one
    console.log(`Broadcast fallback`);
    this.broadcast.send(data);
  }

  advertise() {
    // Get all the channels we're on
    let f = this._channelFactories.map(f => f.name);

    const ad = {
      _kind: `peering-ad`,
      peerId:this.peerId,
      channels:f.join(', ')
    }

    // Send a copy so that each gets its own _id
    this.broadcast.send({...ad});
  }

  
  validateOutgoing(payload:any) {
    const t= typeof payload;
    if (t === `string` || t ===`number` || t === `boolean` ) {
      payload = {data:payload};
    } else if (Array.isArray(payload)) {
      payload = {data:payload};
    } else if (t === `bigint` || t ===`function`) {
      throw new Error(`cannot send type ${t}`);
    }
  
    if (payload._id === undefined) {
      const id = Util.shortUuid();
      payload._id = id;
      this._seenIds.add(id);
    }
    payload._from = this.peerId;
    return payload
  }

  validateIncoming(msg:any) {
    if (this._seenIds.has(msg._id)) {
      return false;
    }
    this._seenIds.add(msg._id);
    return true;
  }

  private maintain() {
    const seen = [...this._seenIds.values()];
    this._seenIds = new Set(seen.slice(seen.length/2));

    this.peering.maintain();
    this.broadcast.maintain();

    const cf = [...this._channelFactories];
    cf.forEach(c => c.maintain());

    this.advertise();
  }

  dump() {
    console.group(`remote`);
    console.log(`# seen msg ids: ${[...this._seenIds.values()].length}`);
    this.peering.dumpToConsole()
    this.broadcast.dumpToConsole();
    console.groupEnd();
  }

  log(msg:string) {
    console.log(`Remote`, msg);
  }
}