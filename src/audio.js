const fs = require('fs');
const shelljs = require('shelljs');
const ss = require('socket.io-stream');

const debug = require('debug')('talking-stock:debug');

module.exports = class Audio {
  constructor (opts = {}) {
    this.clients = opts.clients;
  }
  transmit (message = 'Undefined message', rate = 200, _client = false) {
    if (!global.static.sayIsAvailable || !this.clients.length()) return;
    const recipients = (_client && typeof _client === 'object' && _client.id) ? [_client] : this.clients.list();
    const filename = `${global.static.cacheFolder}/${parseInt(Math.random() * 99999999, 10).toString(16)}.wav`;
    debug('Writing audio...');
    shelljs.exec(`say --data-format=LEF32@8000 -r ${rate} -o ${filename} "${message}"`, { async: true }, () => {
      debug('Completed writing audio');
      const readStream = fs.createReadStream(filename);
      readStream.resume();
      recipients.forEach((client) => {
        const stream = ss.createStream();
        ss(client).emit('audio-stream', stream, { name: filename });
        readStream.pipe(stream);
      });
    });
  }
};
