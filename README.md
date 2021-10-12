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

# Web Socket server

A naïve web socket server implementation is provided in the `server` folder. This can run on Glitch, or locally.

To run it locally, you need to have Nodejs installed. After that, run `npm install` in the folder to install dependencies. After that, it can be started with `node server.js`.

# Security & privacy

## Broadcast channel

The broadcast channel means of communication can be considered safe. Messages received are only from your own code, and the data you send won't leave your machine.

## Web sockets

Sending and receiving data via web sockets has some inherent risk because it travels via the internet. Using a `wss://` URL means that messages are encrypted between sender/receiver and the server, but this doesn't necessarily give much protection.

In principle, any web socket client can connect to your web socket server and receive or send data. It is up to your server implementation to control which clients are allowed to connect, which messages are accepted for distribution, and which clients receive which messages.

In naïve implementations, the web socket server simply distributes received messages to all connected clients, and all connected clients are permitted to send messages. Turning off your server when not in use and using a random name for your server can reduce risk of misuse. 

Running your web socket server on your own machine will also provide protection, because your operating system and network will not allow random traffic from the internet to reach your server (unless you have specifically configured it differently).

In short, be mindful of what you are sending when using a publicly-available server. When listening for data, in some cases you need to be mindful that the data may be coming from an untrusted source.

# Options

When creating a new instance, options can be set to customise behaviour:

`matchIds` (boolean)
* When true, receiver only processes messages from a sender with same id.
* Default: false

`serialise` (boolean)
* When true, outgoing messages are given a serial number. Incoming messages are discarded if they are below the last serial number received from a given source. This avoids processing the same message from the same source delivered by both web sockets and broadcast channel.
* It is safe to set this to false if you are explicitly only using one channel of communication
* Serials reset after 10,000
* Default: true

`disableRemote` (boolean)
* When true, the library does not activate its 'remote helper' feature, see below for more details
* Default: false
  
`ourId` (string)
* Each sketch has an id, allowing you to distinguish where data is coming from.
* Default: it creates a random id, or previously used random id.

`url` (string, default: same hostname)
* Url for websocket server, if used. Eg: `wss://localhost:8080/ws`. Make sure you use `wss://` for secure data.
* Default: it will try to connect to `wss:// ... /ws` on the same hostname where the sketch is loaded from.

`useSockets` (boolean)
* If true, it will attempt to connect to the websockets server specified by the `url` option
* Default: Enables websockets if sketch is loaded from Glitch, otherwise defaults to false

`useBroadcastChannel` (boolean)
* If true, broadcast channel will be used for inter-window communication
* Default: Off if useSockets is true

`minMessageIntervalMs` (number)
* To prevent message backlogging, the library will silently drop messages if they arrive quicker than this rate. Eg, if the value is 100, messages will only be broadcast after 100ms elapses since the last message.
* Keep in mind messages are not cached/queued, they are thrown away
* Default: 15

Eg:

```js
const r = new Remote({
  ourId: 'visualisation',
  useSockets: false,
  minMessageIntervalMs: 10
});
```

# Ids

Each sent message is stamped with a sender id. This can be useful to distinguish between different message sources. For example:

```js
r.onData = (d) => {
  if (d.from === 'a') {
    // handle message from source a
  } else if (d.from === 'b' || d.from === 'c') {
    // handle messages from b or c
  } else {
    // handle messages from any other source
  }
}
```

If you set `matchId` to true in the receiving Remote's initialiser, it will automatically discard messages that don't match its own id. That is, both sender and receiver must use the same id. 

Ids can be set in code using the initialiser of the Remote instance, or using `setId`:

```js
const r = new Remote({
  ourId: 'a',
});

// Or:
r.setId('b');
```

Since you may want to use the same remote code for multiple sources, Remote makes it simple to offer interactive control of the id. If there is a HTML text box with id 'txtSourceName', it will automatically be wired up to control the id.

If no prior id was found, a random id is generated. If a previous random id was generated in this browser, it is used instead.

# Diagnostics

If an element with id 'activity' is on the page, it will be used to display connection status and send/receive rates.

```html
<div id="activity"></div>
```

Suggested styling:

```css
#activity {
  opacity: 0.1;
  display: flex;
  position: fixed;
  font-size: xx-small;
  right:0;
  bottom: 0;
  background-color: darkgray;
  user-select: none;
}

#activity:hover {
  opacity: 1.0;
}

#activity>div {
  padding: 0.2em;
  border: 1px solid white;
}
```

# Remote helper

The remote helper is useful if your sketch is running on a mobile device when you do not have easy access to DevTools. Features of the remote helper are automatically enabled if elements with the necessary ids are present on the page.

Disable the remote helper by setting `disableRemote` to true in the options.

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

By default the in-page logging will be truncated at 150 items, with older entries being discarded. This prevents the DOM from being choked with a huge amount of items if logging frequency is high. The limit can be changed by setting `r.logLimit` to something else. Zero or below disables truncation entirely.

# Credits

Bundles:
* Pedro Ladaria's [Reconnecting-Websocket](https://github.com/pladaria/reconnecting-websocket)
* [BroadcastChannel polyfill](https://gist.github.com/sechel/e6aff22d9e56df02c5bd09c4afc516e6)
