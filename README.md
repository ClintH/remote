# remote

Remote tries to simplify sending data to and from running sketches. It allows you to decouple sketches, thus making it easy to run components on different devices or simply in different windows.

It uses [WebRTC](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel, [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications) and [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API).

## Example usage

By default, it does not use WebSockets or WebRTC, only BroadcastChannel for fast inter-window/inter-tab communication. This means messaging can only happen within the same computer.

Broadcast a timestamp every 2 seconds to other sketches running locally:

```js
import {Remote} from "https://unpkg.com/@clinth/remote@latest/dist/index.mjs";

const r = new Remote();
setInterval(() => {
  r.broadcast({
    timestamp: Date.now()
  });
}, 2000);
```

Or to send to a peer with the id '123-45':

```js
r.send({timestamp: Date.now()}, `123-45`);
```

Receive data and print to the console

```js
import {Remote} from "https://unpkg.com/@clinth/remote@latest/dist/index.mjs";

const r = new Remote();

r.onData = (d) => {
  console.log(d);
}
```

## Connecting further afield

To allow network connectivity, pass in the `allowNetwork` option when creating. This will allow you to send messages between different devices.

You may also want to specify the websocket URL via `websocket`. If you're running the provided server (see below), the address is `ws://127.0.0.1:8080/ws`. If you're running on Glitch, your address might be something like: `wss://MY-ZANY-PROJECT.glitch.me/ws`. Note the use of `wss` rather than `ws` when connecting over the wild internet.

```js
import {Remote} from "https://unpkg.com/@clinth/remote@latest/dist/index.mjs";

const r = new Remote({
  websocket: `ws://127.0.0.1:8080/ws`,
  allowNetwork: true
});
```

Remote will try to establish a WebRTC connection, advertised via the web socket server. Messages
which are sent directly to a peer will use this means of transport. WebRTC can avoid a lot of the latency issues
encountered if you're messaging via a publicly-hosted websocket server such as on Glitch.

## Peer ids

When starting, each instance creates a random id. You can get this with the id property:
```js
const r = new Remote();
r.id; // `1234-45`
```

Ids are needed to direct a message to a specific peer, or if you want to do some kind of logic to process messages differently depending on what peer sent it. Each incoming message is marked with `_from`:

```js
r.onData = (d) => {
  if (d._from === `123-45`) {
    // got it from a special friend
  } else {
    // got it from somewhere else
  }
}
```

You can also assign an id at startup with the `id` parameter:

```js
const r = new Remote({
  peerId: `echo-six`,
  websocket: `ws://127.0.0.1:8080/ws`,
  allowNetwork: true
});
```

## Web Socket server

A naïve web socket server implementation is provided in the `server` folder. This can run on Glitch, or locally.

To run it locally:

1. Have Node.js installed. 
2. Run `npm install` in the folder to install dependencies. 

Once those steps are complete, it's just a matter of starting:

```
node server.js
```

In all:

```
cd server
npm install
node server.js
```

## Security & privacy

### Broadcast channel

The broadcast channel means of communication can be considered safe. Messages received are only from your own code, and the data you send won't leave your machine if `allowNetwork` is off (default).

### Web sockets

Sending and receiving data via web sockets has some inherent risk because it travels via the internet. Using a `wss://` URL means that messages are encrypted between sender/receiver and the server, but this doesn't necessarily give much protection.

In principle, any web socket client can connect to your web socket server and receive or send data if they know its address. It is up to your server implementation to control which clients are allowed to connect, which messages are accepted for distribution, and which clients receive which messages.

In naïve implementations, the web socket server simply distributes received messages to all connected clients, and all connected clients are permitted to send messages. Turning off your server when not in use and using a random name for your server can reduce risk of misuse. 

Running your web socket server on your own machine will also provide protection, because your operating system and network will not allow random traffic from the internet to reach your server (unless you have specifically configured it differently).

In short, be mindful of what you are sending when using a publicly-available server. When listening for data, in some cases you need to be mindful that the data may be coming from an untrusted source.

### WebRTC

WebRTC connections are facilitated by the web socket connection. This allows peers to exchange the handshake information required. Thus the possibility for peers to connect via WebRTC is contingent on their ability to connect to the websocket server.

## Options

When creating a new instance, options can be set to customise behaviour. All can be omitted by default.

* websocket: string URL for websocket server
* peerId: string Peer id
* maintainLoopMs: number How often to do housekeeping in ms
* allowNetwork: boolean If true, WebRTC & websockets will be attempted
* debugMaintain:boolean If true, spits out logging everytime a housekeeping loop runs
* defaultLog: silent|verbose|error: Default logging level
* log.ws / log.rtc / log.bc: Logging level for given sub-system

## Diagnostics

If the following HTML element is in your page, it will be used to show some diagnostics info:

```html
<div id="remote-status"></div>
```

Clicking on it will dump out some information to the console for debugging connectivity.

## Acknowledgements

Bundles:
* Pedro Ladaria's [Reconnecting-Websocket](https://github.com/pladaria/reconnecting-websocket)
