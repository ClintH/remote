import ReconnectingWebsocket from "./ReconnectingWebsocket.js";
interface Options {
    remote: boolean;
    ourId?: string;
    url?: string;
    useSockets?: boolean;
    minMessageIntervalMs?: number;
    useBroadcastChannel?: boolean;
}
export default class Remote {
    bc: BroadcastChannel | null;
    remote: boolean;
    connected: boolean;
    useSockets: boolean;
    useBroadcastChannel: boolean;
    ourId?: string;
    url?: string;
    minMessageIntervalMs: number;
    receiveSerials: Map<string, number>;
    serial: number;
    lastDataEl: HTMLElement | null;
    logEl: HTMLElement | null;
    lastSend: number;
    socket?: ReconnectingWebsocket;
    constructor(opts?: Options);
    send(data: any): void;
    seenMessage(o: any): boolean | undefined;
    initBroadcastChannel(): void;
    init(): void;
    setId(id: string): void;
    initSockets(): void;
    onData(d: any): void;
    getId(): string | undefined;
    clearLog(): void;
    log(msg: any): void;
    error(msg: string | Event, exception?: Error): void;
}
export {};
