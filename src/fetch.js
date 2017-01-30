const request = require('request');
const qs = require('querystring');

const url = 'http://finance.google.com/finance/info?';

module.exports = class Fetch {
  constructor (opts = { defaultSymbols: [] }) {
    this.symbols = opts.defaultSymbols;
  }
  request (callback = (() => {})) {
    this.query = qs.stringify({ client: 'ig', q: this.symbols.join(',') });
    request(`${url}${this.query}`, (err, res, body) => {
      if (err || res.statusCode !== 200) return callback('Could not get data');
      return callback(null, JSON.parse(body.trim().replace('//', '')), { keysColor: 'yellow' });
    });
  }
  addSymbol (symbol) {
    this.symbols.push(symbol);
  }
};
