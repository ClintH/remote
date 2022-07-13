import {Log, LogLevel} from "./util/Log.js";
import {Peering} from "./Peering.js";
import {PeeringSession} from "./PeeringSession.js";

export type LogicalNodeState = `idle`|`open`|`dead`;

export class LogicalNode {
  private _sessions:PeeringSession[];
  private _state:LogicalNodeState;
  private _idleSince:number;
  private _deadAfterIdleMs= 60*1000;
  private _log:Log;

  constructor(private _id:string, private _peering:Peering) {
    this._sessions = [];
    this._state = `idle`;
    this._idleSince = Date.now();
    this._log = new Log(`LogicalNode[${_id}]`, _peering.manager.opts.defaultLog as LogLevel ?? `error`);
  }

  /**
   * Attempts to send `data` to node as efficiently as possible.
   * @param data 
   */
  send(data:object):boolean {
    if (this.isDead) throw new Error(`Cannot send while node is dead`);
    for (const s of this._sessions) {
      if (s.state === `open`) {
        console.log(`Send via ${s.channel.name}`);
        s.send(data);
        return true;
      }
    }
    return false;
  }

  setState(newState:LogicalNodeState) {
    if (newState == this._state) return;
    if (this.isDead) throw new Error(`Node is marked dead, cannot change state`);
    const priorState = this._state;
    this._state = newState;
    if (newState === `idle`) this._idleSince = Date.now();
    this._peering.onLogicalNodeState(priorState, newState, this);
  }

  hasChannel(channelName:string):boolean {
    return (this._sessions.some(c => (c.channel.name === channelName)))
  }

  onSessionEstablished(s:PeeringSession) {
    if (this.isDead) throw new Error(`Node is marked dead, cannot establish session`);
    this._sessions.push(s);
    this._log.verbose(`Session established. ch: ${s.channel.name} id: ${s.id}. ${this._sessions.length} sesion(s)`);
    this.setState(`open`);
  }

  dump() {
    let t = [`LogicalNode[${this._id}]`];
    this._sessions.forEach(s => {
      t.push(` - ` + s.statusString())
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
    if (this.isDead) return;
    const sessions = [...this._sessions];
    for (const s of sessions) {
      s.maintain();
    }

    const length = this._sessions.length;
    this._sessions = this._sessions.filter(s => s.state === `open`);
    if (this._sessions.length !== length) {
      this._log.verbose(`Removed ${length - this._sessions.length} session(s).`);
    }
    if (this.sessions.length === 0) this.setState(`idle`);

    if (this._state === `idle`) {
      const elapsed = Date.now() - this._idleSince;
      if (elapsed > this._deadAfterIdleMs) this.setState(`dead`);
    }
  }

  get id() {
    return this._id;
  }

  get sessions():PeeringSession[] {
    return [...this._sessions];
  }

  get isDead() {
    return this._state === `dead`;
  }

  get state() {
    return this._state;
  }
}