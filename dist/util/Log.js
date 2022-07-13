export class Log {
    constructor(_prefix, _level = `error`) {
        this._prefix = _prefix;
        this._level = _level;
    }
    static fromConfig(opts, category, prefix) {
        let l = opts[category];
        if (l === undefined) {
            const log = opts.log;
            if (log !== undefined)
                l = log[category];
        }
        if (l === `silent` || l === `verbose` || `error`)
            return new Log(prefix, l);
        return new Log(prefix);
    }
    warn(msg) {
        if (this._level !== `verbose`)
            return;
        console.warn(this._prefix, msg);
    }
    verbose(msg) {
        if (this._level !== `verbose`)
            return;
        console.log(this._prefix, msg);
    }
    error(msg) {
        if (this._level === `silent`)
            return;
        console.error(this._prefix, msg);
    }
}
//# sourceMappingURL=Log.js.map