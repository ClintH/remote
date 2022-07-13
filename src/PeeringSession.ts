import {IBroadcaster} from "./Broadcast";
import {IChannelFactory} from "./IChannel";
import {Manager} from "./Manager";
import {PeeringSessionState, PeeringReply} from "./Peering";
import * as Util from './Util';

export interface IPeeringSessionImpl {
  get session():PeeringSession;
}

export class PeeringSession extends EventTarget {
  private _state:PeeringSessionState;
  readonly _createdAt:number;

  private constructor(readonly id:string, readonly weInitiated:boolean, readonly remotePeer:string, readonly channel:IChannelFactory, readonly bc:IBroadcaster, readonly manager:Manager) {
    super();
    this._state = `idle`;
    this._createdAt = Date.now();
  }

  onMessageReceived(data:object, via:IPeeringSessionImpl) {
    this.manager.broadcast.onSessionMessageReceived(data, via, this);
  }

  send(data:object) {
    this.dispatchEvent(new CustomEvent(`send`, {detail:{ ...data}}));
    return true;
  }

  get name() {
    return `peering-session`;
  }
  
  statusString():string {
    return `${this.state} ${this.channel.name} id: ${this.id} ${this.weInitiated ? `local` : `remote`} elapsed: ${Util.elapsed(this._createdAt)}` 
  }

  elapsedString():string {
    return Util.elapsed(this._createdAt);
  }

  private setState(newState:PeeringSessionState) {
    if (this._state === newState) return;
    const priorState = this._state;
    this._state = newState;
    this.dispatchEvent(new CustomEvent(`change`, {detail:{priorState, newState}}));
  }

  maintain() {
    if (this._state == `started` || this._state == `idle`) {
      if (Date.now() - this._createdAt > 10*1000) {
        this.setState(`timeout`);
      }
    }
  }

  get state() {
    return this._state;
  }

  // Notified when session is closing
  onClosed(reason:string) {
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

  static initiate(remotePeer:string, channel:IChannelFactory, bc:IBroadcaster, manager:Manager):PeeringSession {
    const id = Util.shortUuid();
    return new PeeringSession(id, true, remotePeer, channel, bc, manager);
  };

  static accept(sessionId:string, remotePeer:string, channel:IChannelFactory, bc:IBroadcaster, manager:Manager):PeeringSession {
    return new PeeringSession(sessionId, false, remotePeer, channel, bc, manager);
  }

  start() {
    if (this.state !== `idle`) throw new Error(`Can only start while idle`);
    this.channel.initiatePeering(this.remotePeer, this);
  }

  log(msg:any) {
    console.log(`PeeringSession`, msg);
  }

  onReply(r:PeeringReply, bc:IBroadcaster) {
    //if (this.replyHandler) this.replyHandler(r, bc);
    this.dispatchEvent(new CustomEvent(`reply`, {detail:{reply:r, bc}}));
  }

  broadcastReply(kind:string, data:any) {
    data = {
      ...data,
      _kind: kind
    };
    this.bc.send(data);
  }
}