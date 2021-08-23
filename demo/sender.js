import {Remote} from "../dist/index.mjs";

const r = new Remote({
  remote: true
});

setInterval(() => {
  r.send({
    timestamp: Date.now()
  });
}, 2000);

