import { IChannelFactory } from "./IChannel";
import { IBroadcaster } from "./Broadcast";
import { LogicalNode, LogicalNodeState } from "./LogicalNode";
import { Manager } from "./Manager";
import { PeeringSession } from "./PeeringSession";
export declare type PeeringAdvert = {
    peerId: string;
    channels: string;
};
export declare type PeeringReply = {
    payload: string;
    peeringSessionId: string;
    sub: string;
};
export declare type PeeringInvite = {
    peeringSessionId: string;
    invitee: string;
    inviter: string;
    payload: string;
    channel: string;
};
export declare type PeeringSessionState = `idle` | `started` | `closed` | `open` | `timeout`;
export declare type LogicalNodeChange = {
    node: LogicalNode;
    type: string;
};
export declare type LogicalNodeStateChange = {
    priorState: LogicalNodeState;
    newState: LogicalNodeState;
    node: LogicalNode;
};
export declare class Peering extends EventTarget {
    readonly manager: Manager;
    private _nodes;
    private _inProgress;
    private _ephemeral;
    private _log;
    constructor(manager: Manager);
    getEphemeral(peerId: string): (PeeringSession | IBroadcaster)[];
    getLogicalNode(peerId: string): LogicalNode | undefined;
    onLogicalNodeState(priorState: LogicalNodeState, newState: LogicalNodeState, node: LogicalNode): void;
    hasChannel(channelName: string): true | undefined;
    dumpToConsole(): void;
    onSessionEstablished(s: PeeringSession): void;
    maintain(): void;
    getOrCreate(id: string): LogicalNode;
    findPeeringSession(peerId: string, channel: IChannelFactory): PeeringSession | undefined;
    findPeeringSessionById(session: string): PeeringSession | undefined;
    findPeeringSessionByRemote(remote: string): PeeringSession | undefined;
    onInviteReceived(i: PeeringInvite, bc: IBroadcaster): void;
    onReply(r: PeeringReply, bc: IBroadcaster): void;
    onAllowInvite(i: PeeringInvite, bc: IBroadcaster): void;
    warn(msg: any): void;
    notifySeenPeer(peer: string, bc: IBroadcaster | PeeringSession): void;
    onAdvertReceived(pa: PeeringAdvert, bc: IBroadcaster): void;
    getLogicalNodes(): LogicalNode[];
}
