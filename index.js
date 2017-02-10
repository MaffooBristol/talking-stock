const shelljs = require('shelljs');
const os = require('os');
const path = require('path');
const merge = require('merge');
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

// const defaultSymbols = [
//   'NASDAQ:AMD',
//   'NASDAQ:AMBA',
//   'NASDAQ:DRYS',
//   'NASDAQ:ETRM',
//   'NYSEMKT:MSTX',
//   'NASDAQ:NVDA',
//   'NASDAQ:SPHS',
//   'NASDAQ:XGTI',
// ];

const symbolString = 'ETRM*100+XGTI*410+NVDA*8+AMD*70+AMBA*8+MSTX*800+SPHS*100+DRYS*100';
const defaultSymbols = symbolString.split('+').map(symbol => symbol.split('*'));

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
    priceDiffs: true,
    dayDiff: true,
  },
};

try {
  const rcfile = require(path.resolve(os.homedir(), '.talkingstockrc.json'));
  if (rcfile) {
    global.static = merge(global.static, rcfile);
  }
}
catch (e) {
  debug('Couldn\'t find rcfile');
}

app.use(express.static(path.join(__dirname, '/public')));

let resOld = null;
let dataTimeout = false;

const fetchData = (useOld = false) => {
  clearTimeout(dataTimeout);
  debug('Fetching data...');
  if (!clients.length()) {
    return debug('No clients are connected!');
  }
  const error = (err) => {
    audio.transmit(err);
    info(err);
    setTimeout(fetchData, global.static.fetchErrorTimeout);
  };
  fetch.request((err, res) => {
    if (err) return error(err);
    if (!res) return error('Weird error!');
    let updated = false;
    const phrases = [];
    res.data.forEach((ticker, index) => {
      if (!resOld || !resOld.data || !resOld.data[index]) {
        updated = true;
      }
      else if (parseFloat(resOld.data[index].l) !== parseFloat(ticker.l)) {
        updated = true;
        const diff = Math.round(parseFloat(resOld.data[index].l) * 100) - (parseFloat(ticker.l) * 100);
        const direction = diff < 0 ? 'up' : 'down';
        const unit = Math.abs(diff) > 1 ? 'cents' : 'cent';
        info(`${ticker.t}: ${resOld.data[index].l} > ${ticker.l}`);
        if (global.static.phraseOpts.priceDiffs) {
          phrases.push(`${ticker.t} is ${direction} ${Math.abs(diff) >= 1 ? Math.abs(diff) : 'less than one'} ${unit} to ${ticker.l}`);
        }
      }
    });
    const dayDifference = `Day difference: ${Math.round(res.data.reduce((a, m) => (a + parseFloat(m.cp)), 0) * 100) / 100}%`;
    if (global.static.phraseOpts.dayDiff) {
      phrases.push(dayDifference);
    }
    info(dayDifference);
    if (updated || useOld) {
      io.emit('tick', (useOld && resOld ? resOld : res));
    }
    if (updated && phrases.length) {
      audio.transmit(phrases.join(', '), global.static.speechSpeed);
    }
    resOld = res;
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
