const shelljs = require('shelljs');
const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const ss = require('socket.io-stream');
const debug = require('debug')('talking-stock:debug');
const info = require('debug')('talking-stock:info');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const Fetch = require('./fetch');
// const Cli = require('./cli');

const defaultSymbols = [
  'NASDAQ:AMD',
  'NASDAQ:AMBA',
  'NASDAQ:ETRM',
  'NYSEMKT:MSTX',
  'NASDAQ:NVDA',
  'NASDAQ:SPHS',
  'NASDAQ:STX',
  'NASDAQ:XGTI',
];

const fetch = new Fetch({ defaultSymbols });

const STATIC = {
  welcomeMessage: 'Welcome to the talking stock! Please stay tuned bro!',
  port: 4567,
  fetchTimeout: 15000,
  fetchErrorTimeout: 60000,
  cacheFolder: `${__dirname}/_cache`,
  sayIsAvailable: shelljs.which('say'),
};

app.use(express.static(path.join(__dirname, '/public')));

const clients = [];
let oldData = null;

// This could be async but meh, for what it's worth.
if (!fs.existsSync(STATIC.cacheFolder)) {
  fs.mkdirSync(STATIC.cacheFolder);
}

const transmitAudio = (message = 'Undefined message', rate = 200, recipient = false) => {
  if (!STATIC.sayIsAvailable) return;
  const filename = `${STATIC.cacheFolder}/${parseInt(Math.random() * 99999999, 10).toString(16)}.wav`;
  debug('Writing audio...');
  shelljs.exec(`say --data-format=LEF32@8000 -r ${rate} -o ${filename} "${message}"`, { async: true }, () => {
    debug('Completed writing audio');
    const readStream = fs.createReadStream(filename);
    readStream.resume();
    (recipient ? [recipient] : clients).forEach((client) => {
      const stream = ss.createStream();
      ss(client).emit('audio-stream', stream, { name: filename });
      readStream.pipe(stream);
    });
  });
};

let dataTimeout = false;

setTimeout(() => info(`Clients connected: ${clients.length}`), 500);

const fetchData = (useOld = false) => {
  clearTimeout(dataTimeout);
  debug('Fetching data...');
  if (!clients.length) {
    return debug('No clients are connected!');
  }
  const error = (err) => {
    transmitAudio(err);
    setTimeout(fetchData, STATIC.fetchErrorTimeout);
  };
  fetch.request((err, data) => {
    if (err) return error(err);
    if (!data) return error('Weird error!');
    let updated = false;
    const phrases = [];
    data.forEach((ticker, index) => {
      if (!oldData || !oldData[index]) {
        updated = true;
      }
      else if (parseFloat(oldData[index].l) !== parseFloat(ticker.l)) {
        updated = true;
        const diff = Math.round(parseFloat(oldData[index].l) * 100) - (parseFloat(ticker.l) * 100);
        const direction = diff < 0 ? 'up' : 'down';
        const unit = Math.abs(diff) > 1 ? 'cents' : 'cent';
        info(`${ticker.t}: ${oldData[index].l} > ${ticker.l}`);
        phrases.push(`${ticker.t} is ${direction} ${Math.abs(diff) >= 1 ? Math.abs(diff) : 'less than one'} ${unit} to ${ticker.l}`);
      }
    });
    if (updated || useOld) {
      io.emit('tick', (useOld && oldData ? oldData : data));
    }
    if (updated) {
      transmitAudio(phrases.join(', '), 220);
    }
    oldData = data;
    dataTimeout = setTimeout(fetchData, STATIC.fetchTimeout);
    return this;
  });
  return this;
};

io.on('connection', (client) => {
  clients.push(client);
  client.on('disconnect', () => {
    debug(`Client ${client.id} has disconnected`);
    clients.splice(clients.indexOf(client), 1);
  });
  client.on('audio:received', () => debug(`Client ${client.id} recieved audio`));
  client.on('audio:playing', () => debug(`Client ${client.id} is playing audio`));
  // transmitAudio(STATIC.welcomeMessage, 180, client);
  debug(`Clients connected: ${clients.length}`);
  // First one here; start the data fetching process.
  if (clients.length < 2) {
    fetchData(true);
  }
});

server.listen(STATIC.port, () => {
  info(`Started the Talking Stock on port ${STATIC.port}`);
  // new Cli(fetch)).init();
});
