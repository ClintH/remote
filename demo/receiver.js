import {Remote} from "../dist/index.mjs";

const r = new Remote({
  remote: true // true because this is the sender
});

r.onData = (d) => {
  console.log(d);
}