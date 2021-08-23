
import {Remote} from "../lib/index.js";

const r = new Remote({
  remote: true // true because this is the sender
});

r.onData = (d) => {
  console.log(d);
}