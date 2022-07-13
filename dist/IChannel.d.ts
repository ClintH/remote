import { IBroadcaster } from "./Broadcast";
import { PeeringInvite } from "./Peering";
import { PeeringSession } from "./PeeringSession";
export declare enum ChannelStates {
}
export declare type IChannel = {
    maintain(): void;
    name: string;
};
export interface IChannelFactory {
    name: string;
    initiatePeering(remoteId: string, session: PeeringSession): void;
    acceptInvitation(i: PeeringInvite, session: PeeringSession, bc: IBroadcaster): void;
    maintain(): void;
}
