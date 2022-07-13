import * as Util from './Util';
import {Manager} from "./Manager";
import {PeeringAdvert, PeeringInvite} from "./Peering";
import {IPeeringSessionImpl, PeeringSession} from './PeeringSession';

export type BroadcasterState = `idle`|`open`|`closed`|`error`;

export interface IBroadcaster {
  maintain():void;
  send(payload:any):boolean;
  get state():BroadcasterState;
  get name():string;
}

export type BroadcastStateChange = {
  priorState: BroadcasterState
  newState: BroadcasterState
  source:IBroadcaster
}

export class Broadcast extends EventTarget {
  private _broadcast:IBroadcaster[];
  private _seenIds:Set<string>;
  private _peerId:string;

  constructor(readonly _manager:Manager) {
    super();
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

  onBroadcasterState(priorState:BroadcasterState, newState:BroadcasterState, source:IBroadcaster) {
    this.dispatchEvent(new CustomEvent<BroadcastStateChange>(`change`, {
      detail: { priorState, newState, source }
    }));
  }

  add(b:IBroadcaster) {
    this._broadcast.push(b);
  }

  send(payload:any) {
    this.ensureId(payload);
    this._broadcast.forEach(b => b.send(payload));
  }

  ensureId(payload:any) {
    if (payload._id === undefined) {
      const id = Util.shortUuid();
      payload._id = id;
      this._seenIds.add(id);
    }
    payload._from = this._peerId;
  }

  warn(msg:any) {
    console.log(`Broadcast`, msg);
  }

  onSessionMessageReceived(data:any, via:IPeeringSessionImpl, session:PeeringSession) {
    if (typeof data === `string`) throw new Error(`Expected object`);
    const {_id, _kind, _from} = data;
    if (_from !== undefined) this._manager.peering.notifySeenPeer(_from, session);
    if (_id === undefined) {
      this.warn(`Message received without an id. Dropping. ${JSON.stringify(data)}`);
      return;
    }

    if (!this._seenIds.has(_id)) {
      this._seenIds.add(_id);
    }

    this._manager.onMessageReceived(data, via);
  }

  onMessage(data:any, via:IBroadcaster) {
    const {_id, _kind, _from} = data;

    if (_from !== undefined) {
      this._manager.peering.notifySeenPeer(_from, via);
    }
    
    if (_id === undefined) {
      this.warn(`Message received without an id. Dropping. ${JSON.stringify(data)}`);
      return;
    }

    if (this._seenIds.has(_id)) {
      //this.warn(`Duplicate message received ${_id} (via ${via.name})`);
      return;
    } else {
      this._seenIds.add(_id);
    }

    if (_kind === undefined) {
      this._manager.onBroadcastReceived(data, via);
      return;
    }

    switch (_kind) {
      case `peering-ad`:
        this._manager.peering.onAdvertReceived(data as PeeringAdvert, via);
        break;
      case `peering-invite`:
        this._manager.peering.onInviteReceived(data as PeeringInvite, via);
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
    this._seenIds = new Set(seen.slice(seen.length/2));
  }

  log(msg:string) {
    console.log(`BroadcastMessageHandler`, msg);
  }
}