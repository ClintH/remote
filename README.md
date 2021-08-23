# remote

Remote tries to simplify sending data to and from running sketches. It allows you to decouple sketches, thus making it easy to run components on different devices or simply in different windows.

It uses [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications) for inter-device communication. The easiest way to make this work is to use a Glitch-based websocket server. [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API) is used for inter-window communication. Both websockets and broadcast channel can be used at the same time, when data is received, a 'source' field will be either 'ws' or 'bc'.

## Example usage

Send a timestamp every 2 seconds.

```js
import {Remote} from "https://unpkg.com/@clinth/remote@latest/dist/index.mjs";

const r = new Remote({
  remote: true
});

setInterval(() => {
  r.send({
    timestamp: Date.now()
  });
}, 2000);
```

Receive data and print to the console

```js
import {Remote} from "https://unpkg.com/@clinth/remote@latest/dist/index.mjs";

const r = new Remote();

r.onData = (d) => {
  console.log(d);
}
```



## Options

When creating a new instance, options can be set to customise behaviour:

serialise (boolean)
* When true, outgoing messages are given a serial number. Incoming messages are discarded if they are below the last serial number received from a given source
* Serials reset after 10,000
* Default: true

remote (boolean)
* When true, the library actives its 'remote helper' feature, see below for more details
* Default: false
  
ourId (string)
* Each sketch has an id, allowing you to distinguish where data is coming from.
* Ids are saved to `localStorage`, so reopening a sketch means it will maintain the same id
* Default: it creates a random id

url (string, default: same hostname)
* Url for websocket server, if used. Eg: `wss://localhost:8080/ws`. Make sure you use `wss://` for secure data.
* Default: it will try to connect to `wss:// ... /ws` on the same hostname where the sketch is loaded from.

useSockets (boolean)
* If true, it will attempt to connect to the websockets server specified by the `url` option
* Default: Enables websockets if sketch is loaded from Glitch, otherwise defaults to false

useBroadcastChannel (boolean)
* If true, broadcast channel will be used for inter-window communication
* Default: Off if useSockets is true

minMessageIntervalMs (number)
* To prevent message backlogging, the library will silently drop messages if they arrive quicker than this rate. Eg, if the value is 100, messages will only be broadcast after 100ms elapses from the last message.
* Keep in mind messages are not cached/queued
* Default: 15

Eg:

```js
const r = new Remote({
  ourId: 'visualisation',
  useSockets: false,
  minMessageIntervalMs: 10
});
```

## Remote helper

The remote helper is useful if your sketch is running on a mobile device when you do not have easy access to DevTools. Enable it by setting `remote` to true in the options.

To use this, make sure your HTML page contains:

```html
<div id="lastData"></div>
<h2 id="logTitle">Log</h2>
<div id="log"></div>
```

When enabled:
* All console.log and console.error messages are appended to #log element (if this element is present)
* If #logTitle is clicked, #log will be cleared (if this element is present)
* The last sent data is displayed in #lastData (if this element is present)


# Credits

Bundles Pedro Ladaria's [Reconnecting-Websocket](https://github.com/pladaria/reconnecting-websocket)

