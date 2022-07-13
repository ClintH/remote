export declare type LogLevel = `silent` | `verbose` | `error`;
export declare class Log {
    readonly _prefix: string;
    readonly _level: LogLevel;
    constructor(_prefix: string, _level?: LogLevel);
    static fromConfig(opts: any, category: string, prefix: string): Log;
    warn(msg: any): void;
    verbose(msg: any): void;
    error(msg: any): void;
}
