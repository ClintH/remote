export declare const shortUuid: () => string;
export declare const elapsed: (from: number) => string;
export declare const mapToObjTransform: <T, K>(m: ReadonlyMap<string, T>, valueTransform: (value: T) => K) => {
    readonly [key: string]: K;
};
