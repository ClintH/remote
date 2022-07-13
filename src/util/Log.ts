export  type LogLevel = `silent` | `verbose` | `error`;

export class Log {

  constructor(readonly _prefix:string, readonly _level:LogLevel = `error`) {

  }

  static fromConfig(opts:any, category:string, prefix:string) {
    let l = opts[category];
    if (l === undefined) {
      const log = opts.log;
      if (log !== undefined) l = log[category];
    }

    if (l === `silent` || l === `verbose` || `error`) return new Log(prefix, l);
    return new Log(prefix);
  }

  warn(msg:any) {
    if (this._level !== `verbose`) return;
    console.warn(this._prefix, msg);
  }

  verbose(msg:any) {
    if (this._level !== `verbose`) return;
    console.log(this._prefix, msg);
  }

  error(msg:any) {
    if (this._level === `silent`) return;
    console.error(this._prefix, msg);
  }
}