import ReconnectingWebsocket from "./ReconnectingWebsocket.js";
import Intervals from './Intervals.js';
interface Options {
    disableRemote: boolean;
    ourId?: string;
    url?: string;
    useSockets?: boolean;
    minMessageIntervalMs?: number;
    useBroadcastChannel?: boolean;
    serialise?: boolean;
    matchIds?: boolean;
}
export default class Remote {
    bc: BroadcastChannel | null;
    disableRemote: boolean;
    connected: boolean;
    useSockets: boolean;
    useBroadcastChannel: boolean;
    ourId?: string;
    url?: string;
    minMessageIntervalMs: number;
    matchIds: boolean;
    consoleRedirected: boolean;
    receiveSerials: Map<string, number>;
    serial: number;
    lastDataEl: HTMLElement | null;
    logEl: HTMLElement | null;
    activityEl: HTMLElement | null;
    socket?: ReconnectingWebsocket;
    serialise: boolean;
    lastSend: number;
    sendInterval: Intervals;
    receiveInterval: Intervals;
    constructor(opts?: Options);
    send(data: any): void;
    seenMessage(o: any): boolean | undefined;
    initBroadcastChannel(): void;
    init(): void;
    updateActivityLoop(): void;
    updateActivity(): void;
    setId(id: string): void;
    initSockets(): void;
    onData(d: any): void;
    getId(): string | undefined;
    clearLog(): void;
    log(msg: any): void;
    error(msg: string | Event, exception?: Error): void;
}
export {};
