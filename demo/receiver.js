import { Remote } from "../dist/index.mjs";

const logEl = document.getElementById(`log`);
const r = new Remote({
  websocket: `ws://127.0.0.1:8080/ws`,
  allowNetwork: false,
  defaultLog: `verbose`
});

document.getElementById(`txtPeerId`).value = r.id;

r.onData = (msg) => {
  // Print to console and screen
  log(msg);
};

const log = (msg) => {
  console.log(msg);
  logEl.insertAdjacentHTML(`afterbegin`, '<p>' + JSON.stringify(msg) + '</p>');
}