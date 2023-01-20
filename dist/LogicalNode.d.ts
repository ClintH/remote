import { Peering } from "./Peering.js";
import { PeeringSession } from "./PeeringSession.js";
export type LogicalNodeState = `idle` | `open` | `dead`;
export declare class LogicalNode {
    private _id;
    private _peering;
    private _sessions;
    private _state;
    private _idleSince;
    private _deadAfterIdleMs;
    private _log;
    constructor(_id: string, _peering: Peering);
    send(data: object): boolean;
    setState(newState: LogicalNodeState): void;
    hasChannel(channelName: string): boolean;
    onSessionEstablished(s: PeeringSession): void;
    dump(): string;
    dumpSessions(): string;
    maintain(): void;
    get id(): string;
    get sessions(): PeeringSession[];
    get isDead(): boolean;
    get state(): LogicalNodeState;
}
