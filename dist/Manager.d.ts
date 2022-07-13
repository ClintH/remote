import { Broadcast, IBroadcaster } from "./Broadcast";
import { IChannelFactory } from "./IChannel";
import { LogLevel } from "./util/Log";
import { Peering } from "./Peering";
import { IPeeringSessionImpl } from "./PeeringSession";
export declare type Options = {
    websocket?: string;
    peerId?: string;
    maintainLoopMs?: number;
    allowNetwork?: boolean;
    debugMaintain?: boolean;
    defaultLog?: string;
    log?: {
        ws?: LogLevel;
        rtc?: LogLevel;
        bc?: LogLevel;
    };
};
export declare class Manager extends EventTarget {
    readonly opts: Options;
    private readonly _channelFactories;
    readonly broadcast: Broadcast;
    readonly peering: Peering;
    private _allowNetwork;
    _debugMaintain: boolean;
    private _defaultLog;
    private _statusDisplay;
    readonly peerId: string;
    constructor(opts?: Options);
    getChannelFactory(name: string): IChannelFactory | undefined;
    addChannelFactory(c: IChannelFactory): void;
    onBroadcastReceived(data: any, via: IBroadcaster): void;
    onMessageReceived(data: object, via: IPeeringSessionImpl): void;
    send(data: any, to?: string): void;
    advertise(): void;
    private maintain;
    dump(): void;
    log(msg: string): void;
}
