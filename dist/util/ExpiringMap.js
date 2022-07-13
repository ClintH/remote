export class ExpiringMultiMap {
    constructor(expiryMs) {
        this.expiryMs = expiryMs;
        this._store = new Map();
        setTimeout(() => {
            this.maintain();
        }, Math.min(expiryMs, 30 * 1000));
    }
    get lengthKeys() {
        const keys = [...this._store.keys()];
        return keys.length;
    }
    maintain() {
        const entries = [...this._store.entries()];
        const now = Date.now();
        entries.forEach(([k, arr]) => {
            arr = arr.filter(v => v.expiresAt > now);
            if (arr.length == 0) {
                this._store.delete(k);
            }
            else {
                this._store.set(k, arr);
            }
        });
    }
    get(key) {
        const a = this._store.get(key);
        if (a === undefined)
            return [];
        return a.map(v => v.data);
    }
    *valuesForKey(key) {
        const a = this._store.get(key);
        if (a === undefined)
            return;
        for (let i = 0; i < a.length; i++) {
            yield a[i];
        }
    }
    *keys() {
        yield* this._store.keys();
    }
    *entriesRaw() {
        yield* this._store.entries();
    }
    *entries() {
        for (const e of this._store.entries()) {
            for (let i = 0; i < e[1].length; i++) {
                yield [e[0], e[1][i].data];
            }
        }
    }
    dump() {
        const now = Date.now();
        const until = (v) => {
            let e = v - now;
            if (e < 1000)
                return `${e}ms`;
            e /= 1000;
            if (e < 1000)
                return `${Math.round(e)}s`;
            e /= 60;
            return `${Math.round(e)}mins`;
        };
        let t = ``;
        for (const [k, v] of this._store.entries()) {
            t += `${k} = `;
            for (let i = 0; i < v.length; i++) {
                t += v[i].data + ' (expires in ' + until(v[i].expiresAt) + ') ';
            }
        }
        if (t.length === 0)
            return `(empty)`;
        else
            return t;
    }
    add(key, value) {
        let a = this._store.get(key);
        if (a === undefined) {
            a = [];
            this._store.set(key, a);
        }
        const existing = a.find(v => v.data === value);
        if (existing === undefined) {
            a.push({ data: value, expiresAt: Date.now() + this.expiryMs });
        }
        else {
            existing.expiresAt = Date.now() + this.expiryMs;
        }
    }
}
export class ExpiringMap {
    constructor(expiryMs) {
        this.expiryMs = expiryMs;
        this._store = new Map();
        setTimeout(() => {
            this.maintain();
        }, Math.min(expiryMs, 30 * 1000));
    }
    maintain() {
        const entries = [...this._store.entries()];
        const now = Date.now();
        entries.forEach(([k, v]) => {
            if (v.expiresAt <= now) {
                this._store.delete(k);
            }
        });
    }
    has(key) {
        return this._store.has(key);
    }
    clear() {
        this._store.clear();
    }
    *entries() {
        for (const e of this._store.entries()) {
            yield [e[0], e[1].data];
        }
    }
    *values() {
        for (const v of this._store.values()) {
            yield v.data;
        }
    }
    *keys() {
        yield* this._store.keys();
    }
    set(key, value) {
        const wrapped = {
            data: value,
            expiresAt: Date.now() + this.expiryMs
        };
        this._store.set(key, wrapped);
    }
    get(key) {
        const wrapped = this._store.get(key);
        if (wrapped === undefined)
            return;
        return wrapped.data;
    }
}
//# sourceMappingURL=ExpiringMap.js.map