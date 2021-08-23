
import {Remote} from "https://unpkg.com/@clinth/remote@1.0.3/dist/index.mjs";

const r = new Remote({
  remote: true // true because this is the sender
});

setInterval(() => {
  r.send({
    timestamp: Date.now()
  });
}, 2000);

