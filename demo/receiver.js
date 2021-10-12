import {Remote} from "../dist/index.mjs";

// Create a Remote instance
const r = new Remote({
  // no options needed by default
  // see README for examples  
});

// When data is received, log it.
r.onData = (d) => {
  console.log(d);
}