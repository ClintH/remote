import {Remote} from "../dist/index.mjs";

const r = new Remote({
  websocket: `ws://127.0.0.1:8080/ws`,
  allowNetwork: true
});

document.getElementById(`txtPeerId`).value = r.id;


setInterval(() => {
  r.broadcast({
    what: `this is a broadcast`,
    timestamp: new Date().toLocaleString()
  });
  r.broadcast(false);
  r.broadcast(10);
  r.broadcast(['hello', 'there']);
  r.broadcast('a string');
}, 10 * 1000);

document.getElementById(`btnSend`).addEventListener(`click`, () => {
  const toEl = document.getElementById(`txtTo`);
  const dataEl = document.getElementById(`txtData`);

  const toTxt = toEl.value ?? ``;
  const dataTxt = dataEl.value ?? ``;

  console.log(`Send! ${toTxt}`);

  r.send(dataTxt, toTxt);
});