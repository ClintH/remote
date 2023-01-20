type ExpiringValue<V> = {
    data: V;
    expiresAt: number;
};
export declare class ExpiringMultiMap<K, V> {
    readonly expiryMs: number;
    private _store;
    constructor(expiryMs: number);
    get lengthKeys(): number;
    maintain(): void;
    get(key: K): V[];
    valuesForKey(key: K): Generator<ExpiringValue<V>, void, unknown>;
    keys(): Generator<K, void, undefined>;
    entriesRaw(): Generator<[K, ExpiringValue<V>[]], void, undefined>;
    entries(): Generator<(K | V)[], void, unknown>;
    dump(): string;
    add(key: K, value: V): void;
}
export declare class ExpiringMap<K, V> {
    readonly expiryMs: number;
    private _store;
    constructor(expiryMs: number);
    maintain(): void;
    has(key: K): boolean;
    clear(): void;
    entries(): Generator<(K | V)[], void, unknown>;
    values(): Generator<V, void, unknown>;
    keys(): Generator<K, void, undefined>;
    set(key: K, value: V): void;
    get(key: K): V | undefined;
}
export {};
