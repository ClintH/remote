import { Manager } from "./Manager";
import { IPeeringSessionImpl, PeeringSession } from './PeeringSession';
export declare type BroadcasterState = `idle` | `open` | `closed` | `error`;
export interface IBroadcaster {
    maintain(): void;
    send(payload: any): boolean;
    get state(): BroadcasterState;
    get name(): string;
}
export declare type BroadcastStateChange = {
    priorState: BroadcasterState;
    newState: BroadcasterState;
    source: IBroadcaster;
};
export declare class Broadcast extends EventTarget {
    readonly _manager: Manager;
    private _broadcast;
    private _peerId;
    constructor(_manager: Manager);
    dumpToConsole(): void;
    onBroadcasterState(priorState: BroadcasterState, newState: BroadcasterState, source: IBroadcaster): void;
    add(b: IBroadcaster): void;
    send(payload: any): void;
    warn(msg: any): void;
    onSessionMessageReceived(data: any, via: IPeeringSessionImpl, session: PeeringSession): void;
    onMessage(data: any, via: IBroadcaster): void;
    maintain(): void;
    log(msg: string): void;
}
