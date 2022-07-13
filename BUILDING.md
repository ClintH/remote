# Building

One-time setup:

```
npm install
```

And then:

1. Get sources building automatically
2. Serve root directory with a HTTP server
3. Run local websocket server

## 1. Get sources building automatically

Continually rebuild source to `dist/index.mjs`:

```
npm run dev
```

## 2. Serve root directory

Start a live-server or similar to serve the root directory.

The sender/receiver sketch might need to have options set when creating the `Remote` instance. This is it tries to connect to the local Node server (step 3) instead of the live server.

```
const r = new Remote({
  websocket: `ws://127.0.0.1:8080/ws`,
  allowNetwork: true
});
```

## 3. Run local websocket server

One-time setup:

```
cd server
npm install
```

To start server:

```
cd server
node server.js
```

