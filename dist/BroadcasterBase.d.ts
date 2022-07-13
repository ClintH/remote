import { BroadcasterState, Broadcast, IBroadcaster } from "./Broadcast";
import { Log } from "./util/Log";
export declare abstract class BroadcasterBase implements IBroadcaster {
    readonly _name: string;
    readonly _broadcast: Broadcast;
    readonly _log: Log;
    private _state;
    constructor(_name: string, _broadcast: Broadcast, _log: Log);
    setState(newState: BroadcasterState): void;
    get state(): BroadcasterState;
    abstract maintain(): void;
    abstract send(payload: any): boolean;
    get name(): string;
}
