import { Broadcast, IBroadcaster } from "./Broadcast";
import { BroadcasterBase } from "./BroadcasterBase";
export declare class BcBroadcast extends BroadcasterBase implements IBroadcaster {
    private _bc;
    constructor(_broadcast: Broadcast);
    static isSupported(): boolean;
    toString(): string;
    maintain(): void;
    send(payload: any): boolean;
}
