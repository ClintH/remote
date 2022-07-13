import {IChannelFactory} from "./IChannel";
import {IBroadcaster} from "./Broadcast";
import {LogicalNode, LogicalNodeState} from "./LogicalNode";
import { Manager} from "./Manager";
import {PeeringSession} from "./PeeringSession";
import {ExpiringMap, ExpiringMultiMap} from "./util/ExpiringMap";
import {Log, LogLevel} from "./util/Log";

export type PeeringAdvert = {
  peerId:string
  channels:string
}

export type PeeringReply = {
  payload:string
  peeringSessionId:string
  sub:string
}

export type PeeringInvite = {
  peeringSessionId:string
  invitee:string
  inviter:string
  payload:string
  channel:string
}

export type PeeringSessionState = `idle` | `started` | `closed` |`open`|`timeout`;

export type LogicalNodeChange = {
  node:LogicalNode
  type:string
};

export type LogicalNodeStateChange = {
  priorState: LogicalNodeState;
  newState: LogicalNodeState;
  node:LogicalNode;
}

export class Peering extends EventTarget {
  private _nodes:Map<string,LogicalNode>;
  private _inProgress:PeeringSession[];
  private _ephemeral:ExpiringMultiMap<string, IBroadcaster|PeeringSession>;
  private _log:Log;
  
  constructor(readonly manager:Manager) {
    super();
    this._log = new Log(`Peering`, manager.opts.defaultLog as LogLevel ?? `silent`);
    this._nodes = new Map();
    this._inProgress = [];
    this._ephemeral = new ExpiringMultiMap(30*1000);
  }

  getEphemeral(peerId:string) {
    return this._ephemeral.get(peerId);
  }

  getLogicalNode(peerId:string) {
    return this._nodes.get(peerId);
  }

  onLogicalNodeState(priorState:LogicalNodeState, newState:LogicalNodeState, node:LogicalNode) {
    this.dispatchEvent(new CustomEvent<LogicalNodeStateChange>(`logicalNodeState`, {
      detail: {
        newState, priorState, node
      }
    }));
  }

  hasChannel(channelName:string) {
    for (const n of this._nodes.values()) {
      if (n.hasChannel(channelName)) return true;
    }
  }

  dumpToConsole() {
    console.group(`Peering`);
    console.group(`LogicalNodes`);
    for (const n of this._nodes.values()) {
      let ln = n.id + ` (${n.state})\n`;
      const sessions = n.sessions;
      for (const s of sessions) {
        ln += ' - ' +  s.channel.name + ' (' + s.state +') ' + s.id + '\n'; 
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
    // for (const [k,v] of this._ephemeral.entries()) {
    //   ep += '   ' + k + ' - ' + v.
    // }
    console.groupEnd();
  }

  onSessionEstablished(s:PeeringSession) {
    //this.log(`onSessionEstablished ${s.id}`);
    const n = this.getOrCreate(s.remotePeer);
    n.onSessionEstablished(s);
    this._inProgress = this._inProgress.filter(p=>p.id !== s.id);
  }

  maintain() {
    const ip = [...this._inProgress];
    ip.forEach(i => {
      i.maintain();
    });

    this._inProgress = this._inProgress.filter(i => 
      i.state === `idle` || 
      i.state == `open` || 
      i.state === `started`);

    const nodes = [...this._nodes.values()];
    nodes.forEach(n => {
      n.maintain();

      if (this.manager._debugMaintain) console.log(n.dump());
    });

    const dead = nodes.filter(n => n.isDead);
    for (const d of dead) {
      this._log.verbose(`Removing dead node: ${d.id}`);
      this.dispatchEvent(new CustomEvent<LogicalNodeChange>(`logicalNodeRemoved`, {
        detail: {
          node: d,
          type: `removed`
        }
      }));
      this._nodes.delete(d.id);
    }

    if (this.manager._debugMaintain) console.log(this._ephemeral.dump());
 }

  getOrCreate(id:string):LogicalNode {
    let n = this._nodes.get(id);
    if (n === undefined) {
      n = new LogicalNode(id, this);
      this._nodes.set(id, n);
      this.dispatchEvent(new CustomEvent<LogicalNodeChange>(`logicalNodeAdded`, {
        detail: {
          node: n,
          type: `added`
        }
      }))
    }
    return n;
  }

  findPeeringSession(peerId:string, channel:IChannelFactory):PeeringSession|undefined {
    return this._inProgress.find(p => p.remotePeer === peerId && p.channel === channel);
  }

  findPeeringSessionById(session:string):PeeringSession|undefined {
    return this._inProgress.find(p => p.id === session);
  }


  findPeeringSessionByRemote(remote:string):PeeringSession|undefined {
    return this._inProgress.find(p => p.remotePeer === remote);
  }

  onInviteReceived(i:PeeringInvite, bc:IBroadcaster) {
    try {
      const invitee = i.invitee;

      // Not for us
      if (invitee !== this.manager.peerId) return;

      if (this.findPeeringSessionByRemote(i.inviter)) {
        this.warn(`Dropping invitation from a peer we have already invited: ${i.inviter}. Our id: ${this.manager.peerId}`);
        return;
      }

      // TODO: Logic for whether we should blindly accept invitation
      this.onAllowInvite(i, bc);
    } catch (ex) {
      this.warn(ex);
    }
  }

  onReply(r:PeeringReply, bc:IBroadcaster) {
    const s = this.findPeeringSessionById(r.peeringSessionId);
    if (s === undefined) {
      this._log.warn(`Received peering reply for unknown session  ${r.peeringSessionId}`);
      this._log.warn(r);
      this._log.warn(`Sessions: ` + this._inProgress.map(p => p.id).join(', '));
      return;
    }

    s.onReply(r, bc);
  }

  onAllowInvite(i:PeeringInvite, bc:IBroadcaster) {
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

  warn(msg:any) {
    console.warn(`PeeringHandler`, msg);
  }

  notifySeenPeer(peer:string, bc:IBroadcaster|PeeringSession) {
    this._ephemeral.add(peer, bc);
  }

  onAdvertReceived(pa:PeeringAdvert, bc:IBroadcaster) {
    const n = this.getOrCreate(pa.peerId);
    const channels = pa.channels.split(', ');

    // Remember peer was heard from on a channel
    this.notifySeenPeer(pa.peerId, bc);

    channels.forEach(c => {
      if (c.length === 0 || c === undefined) return;

      // Do we support channel?
      const ch = this.manager.getChannelFactory(c);
      if (ch === undefined) {
        //this.warn(`Channel not supported: ${c}`);
        return;
      }

      if (!n.hasChannel(c)) {
        // Is there a peering session in progress?
        const inProgress = this.findPeeringSession(pa.peerId, ch);
        if (inProgress) {
          //this.log(`Received advert for peer-channel combo that is in-progress ${pa.peerId} - ${c}`);
        } else {
          //this.log(`Received advert for peer-channel combo we aren't using: ${pa.peerId} - ${c}`);
          const start = PeeringSession.initiate( pa.peerId, ch, bc, this.manager);
          this._inProgress.push(start);
          start.start();
        }
      } 
      //else {
      // this.log(`Already got a connection to ${pa.peerId} - ${c}`);
      // }
    }); 
  }

  getLogicalNodes():LogicalNode[] {
    return [...this._nodes.values()];
  }
}