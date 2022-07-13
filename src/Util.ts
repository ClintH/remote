// export const uuidv4 = () => {
//   return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
//     (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
//   );
// }

export const  shortUuid = () => {
  const firstPart = (Math.random() * 46656) | 0;
  const secondPart = (Math.random() * 46656) | 0;
  return ("000" + firstPart.toString(36)).slice(-3) + ("000" + secondPart.toString(36)).slice(-3);
}

export const elapsed = (from:number):string => {
  let e = Date.now() - from;
  if (e < 1000) return `${e}ms`;
  e /= 1000;
  if (e < 1000) return `${e}s`;
  e /= 60;
  if (e < 60) return `${e}mins`;
  e /= 60;
  return `${e}hrs`;
};

export const mapToObjTransform = <T, K>(m: ReadonlyMap<string, T>, valueTransform: (value: T) => K): {readonly [key: string]: K} => Array.from(m).reduce((obj: any, [key, value]) => {
  const t = valueTransform(value);
  /* eslint-disable-next-line functional/immutable-data */
  obj[key] = t;
  return obj;
}, {});