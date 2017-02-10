const request = require('request');
const qs = require('querystring');

const url = 'http://finance.google.com/finance/info?';

module.exports = class Fetch {
  constructor (opts = { defaultSymbols: [] }) {
    this.portfolio = opts.defaultSymbols;
    this.symbols = opts.defaultSymbols.map((symbol) => {
      if (typeof symbol === 'string') {
        return symbol;
      }
      else if (symbol[0] !== undefined) {
        return symbol[0];
      }
      else {
        return null;
      }
    });
  }
  request (callback = (() => {})) {
    this.query = qs.stringify({ client: 'ig', q: this.symbols.join(',') });
    request(`${url}${this.query}`, (err, res, body) => {
      if (err || res.statusCode !== 200) return callback('Could not get data');
      const data = JSON.parse(body.trim().replace('//', '')).map((datum) => {
        const datumNew = datum;
        this.portfolio.forEach((symbol) => {
          if (symbol[0] === datumNew.t) {
            datumNew.n = symbol[1];
            datumNew.v = datumNew.n * datumNew.l;
            datumNew.pcls_v = datumNew.n * datumNew.pcls_fix;
            datumNew.pcls_c = ((datumNew.v / datumNew.pcls_v) - 1) * 100;
          }
        });
        return datumNew;
      });
      const total = data.reduce((i, p) => i + p.v, 0);
      const total_pcls = data.reduce((i, p) => i + p.pcls_v, 0);
      const total_c = ((total / total_pcls) - 1) * 100;
      return callback(null, { data, total, total_pcls, total_c });
    });
  }
  addSymbol (symbol) {
    this.symbols.push(symbol);
  }
  getSymbols () {
    return this.symbols;
  }
  getPortfolio () {
    return this.portfolio;
  }
};
