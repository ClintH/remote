export declare enum RtcPeerStates {
    Invited = 0,
    Answering = 1,
    Connected = 2,
    Disposed = 3
}
export declare class RtcPeer {
    peerId: string;
    ourId: string;
    lastReceive: number;
    state: RtcPeerStates;
    peer: RTCPeerConnection | undefined;
    channel: RTCDataChannel | undefined;
    invite: string | undefined;
    answer: string | undefined;
    createdAt: number;
    constructor(peerId: string, ourId: string);
    dispose(): void;
    private init;
    log(m: any): void;
    createInvite(): Promise<string>;
    onNotify(p: any): void;
    accept(invite: RTCSessionDescription): Promise<void>;
}
