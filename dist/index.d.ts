import { Manager, Options } from './Manager.js';
export type { Options };
export declare class Remote {
    _manager: Manager;
    constructor(opts: Options);
    get id(): string;
    send(data: any, to?: string): void;
    broadcast(data: any): void;
    onData(msg: any): void;
}
export { Manager };
