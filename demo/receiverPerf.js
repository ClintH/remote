import {Remote} from "../dist/index.mjs";

const r = new Remote({
  websocket: `ws://127.0.0.1:8080/ws`,
  allowNetwork: true
});


// Assumses perfTest() runs in sender too
const perfTest = () => {
  let received = 0;
  const count = 1000;
  let started = 0;
  r.onData = (msg) => {
    if (received === 0) started = performance.now();
    received++;
    if (received === count) {
      const elapsed = performance.now() - started;
      console.log(`Elapsed: ${Math.round(elapsed)}: ${Math.round((count / elapsed) * 1000)} msg/s`);
    }
  };
}

perfTest();