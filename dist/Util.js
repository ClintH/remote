export const shortUuid = () => {
    const firstPart = (Math.random() * 46656) | 0;
    const secondPart = (Math.random() * 46656) | 0;
    return ("000" + firstPart.toString(36)).slice(-3) + ("000" + secondPart.toString(36)).slice(-3);
};
export const elapsed = (from) => {
    let e = Date.now() - from;
    if (e < 1000)
        return `${e}ms`;
    e /= 1000;
    if (e < 1000)
        return `${e}s`;
    e /= 60;
    if (e < 60)
        return `${e}mins`;
    e /= 60;
    return `${e}hrs`;
};
export const mapToObjTransform = (m, valueTransform) => Array.from(m).reduce((obj, [key, value]) => {
    const t = valueTransform(value);
    obj[key] = t;
    return obj;
}, {});
//# sourceMappingURL=Util.js.map