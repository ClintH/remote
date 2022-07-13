import {Remote} from "../dist/index.mjs";

const r = new Remote({
  websocket: `ws://127.0.0.1:8080/ws`,
  allowNetwork: true
});

const perfTest = () => {
  const count = 1000;
  setTimeout(() => {
    for (let i = 0; i < count; i++) {
      r.broadcast({
        what: `this is a broadcast`,
        timestamp: new Date().toLocaleString()
      });
    }
  }, 2000);

}
perfTest();
