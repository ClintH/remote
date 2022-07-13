import { IBroadcaster } from "./Broadcast";
import { IChannelFactory } from "./IChannel";
import { Manager } from "./Manager";
import { PeeringSessionState, PeeringReply } from "./Peering";
export interface IPeeringSessionImpl {
    get session(): PeeringSession;
}
export declare class PeeringSession extends EventTarget {
    readonly id: string;
    readonly weInitiated: boolean;
    readonly remotePeer: string;
    readonly channel: IChannelFactory;
    readonly bc: IBroadcaster;
    readonly manager: Manager;
    private _state;
    readonly _createdAt: number;
    private constructor();
    onMessageReceived(data: object, via: IPeeringSessionImpl): void;
    send(data: object): boolean;
    get name(): string;
    statusString(): string;
    elapsedString(): string;
    private setState;
    maintain(): void;
    get state(): PeeringSessionState;
    onClosed(reason: string): void;
    onOpened(): void;
    dispose(): void;
    static initiate(remotePeer: string, channel: IChannelFactory, bc: IBroadcaster, manager: Manager): PeeringSession;
    static accept(sessionId: string, remotePeer: string, channel: IChannelFactory, bc: IBroadcaster, manager: Manager): PeeringSession;
    start(): void;
    log(msg: any): void;
    onReply(r: PeeringReply, bc: IBroadcaster): void;
    broadcastReply(kind: string, data: any): void;
}
