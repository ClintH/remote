
import {Remote} from "../lib/index.js";

const r = new Remote({
  remote: true // true because this is the sender
});

setInterval(() => {
  r.send({
    timestamp: Date.now()
  });
}, 2000);

