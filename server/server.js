// ----
// You shouldn't need to modify this file. Work in the 'public' folder instead.
// ----
// Config
const port = process.env.PORT || 8080;
const quiet = process.env.QUIET || false;
// ---

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const expressWs = require('express-ws');
const readline = require('readline');

const ews = expressWs(express());
const app = ews.app;

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on(`keypress`, (chunk, key) => {
  if (!key) return;
  if (key.name ===`c` && key.ctrl) {
    console.log(`Ctrl+C pressed, exiting`);
    process.exit();
    return;
  }
  if (key.name === `q`) {
    console.log(`Q pressed, exiting`);
    process.exit();
    return;
  }
});

// Set up the '/ws' resource to handle web socket connections
app.ws('/ws', function (ws, req) {
  // A message has been received from a client
  ws.on('message', function (msg) {
    var clients = ews.getWss('/ws').clients;
    // Debug print it
    if (!quiet)
      console.log(new Date().toLocaleTimeString() + '> ' + msg);

    // Broadcast it to all other clients
    clients.forEach(c => {
      if (c === ws) return;
      try {
        c.send(msg);
      } catch (e) {
        // can happen when client disconnects
        // console.error(e);
      }
    });
  });
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, './public')));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
  if (err.status)
    res.sendStatus(err.status);
  else
    res.sendStatus(500);
});


app.listen(port);
console.log('Server started on port ' + port);
module.exports = app;