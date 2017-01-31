const shelljs = require('shelljs');
const path = require('path');
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const debug = require('debug')('talking-stock:debug');
const info = require('debug')('talking-stock:info');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const Clients = require('./src/clients');
const Fetch = require('./src/fetch');
const Audio = require('./src/audio');
// const Cli = require('./src/cli');

const defaultSymbols = [
  'NASDAQ:AMD',
  'NASDAQ:AMBA',
  'NASDAQ:ETRM',
  'NYSEMKT:MSTX',
  'NASDAQ:NVDA',
  'NASDAQ:SPHS',
  // 'NASDAQ:STX',
  'NASDAQ:XGTI',
];

const clients = new Clients();
const fetch = new Fetch({ defaultSymbols });
const audio = new Audio({ clients });

global.static = {
  welcomeMessage: 'Welcome to the talking stock! Please stay tuned bro!',
  port: 4567,
  fetchTimeout: 15000,
  fetchErrorTimeout: 60000,
  speechSpeed: 220,
  cacheFolder: `${__dirname}/_cache`,
  sayIsAvailable: shelljs.which('say'),
  phraseOpts: {
    priceDiffs: false,
    dayDiff: false,
  },
};

app.use(express.static(path.join(__dirname, '/public')));

let oldData = null;
let dataTimeout = false;

const fetchData = (useOld = false) => {
  clearTimeout(dataTimeout);
  debug('Fetching data...');
  if (!clients.length()) {
    return debug('No clients are connected!');
  }
  const error = (err) => {
    audio.transmit(err);
    setTimeout(fetchData, global.static.fetchErrorTimeout);
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
        if (global.static.phraseOpts.priceDiffs) {
          phrases.push(`${ticker.t} is ${direction} ${Math.abs(diff) >= 1 ? Math.abs(diff) : 'less than one'} ${unit} to ${ticker.l}`);
        }
      }
    });
    const dayDifference = `Day difference: ${Math.round(data.reduce((a, m) => (a + parseFloat(m.cp)), 0) * 100) / 100}%`;
    if (global.static.phraseOpts.dayDiff) {
      phrases.push(dayDifference);
    }
    info(dayDifference);
    if (updated || useOld) {
      io.emit('tick', (useOld && oldData ? oldData : data));
    }
    if (updated && phrases.length) {
      audio.transmit(phrases.join(', '), global.static.speechSpeed);
    }
    oldData = data;
    dataTimeout = setTimeout(fetchData, global.static.fetchTimeout);
    return this;
  });
  return this;
};

io.on('connection', (client) => {
  clients.addClient(client);
  client.on('disconnect', () => {
    debug(`Client ${client.id} has disconnected`);
    clients.removeClient(client);
  });
  client.on('audio:received', () => debug(`Client ${client.id} recieved audio`));
  client.on('audio:playing', () => debug(`Client ${client.id} is playing audio`));
  // audio.transmit(global.static.welcomeMessage, 180);
  debug(`Clients connected: ${clients.length()}`);
  // First one here; start the data fetching process.
  if (clients.length() < 2) {
    fetchData(true);
  }
});

server.listen(global.static.port, () => {
  info(`Started the Talking Stock on port ${global.static.port}`);
  // new Cli(fetch)).init();
});
