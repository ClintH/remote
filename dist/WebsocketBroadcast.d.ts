import { Broadcast, IBroadcaster } from "./Broadcast";
import { BroadcasterBase } from "./BroadcasterBase";
export declare class WebsocketBroadcast extends BroadcasterBase implements IBroadcaster {
    private _ws;
    constructor(broadcast: Broadcast, serverUrl?: string);
    toString(): string;
    maintain(): void;
    send(payload: any): boolean;
}
