import {Remote} from "../dist/index.mjs";

// Create a Remote instance
const r = new Remote({
  // no options needed by default
  // see README for examples  
});

// Every 2 seconds send a timestamp
setInterval(() => {
  r.send({
    timestamp: new Date().toLocaleString()
  });
}, 2000);

