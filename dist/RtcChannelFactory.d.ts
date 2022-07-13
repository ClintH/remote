import { IChannel, IChannelFactory } from "./IChannel";
import { IBroadcaster } from "./Broadcast";
import { PeeringInvite } from "./Peering";
import { PeeringSession } from "./PeeringSession";
export declare class RtcChannelFactory implements IChannelFactory {
    constructor();
    get name(): string;
    maintain(): void;
    acceptInvitation(i: PeeringInvite, session: PeeringSession, bc: IBroadcaster): void;
    initiatePeering(remoteId: string, session: PeeringSession): void;
}
export declare class RtcChannel implements IChannel {
    constructor();
    get name(): string;
    maintain(): void;
}
