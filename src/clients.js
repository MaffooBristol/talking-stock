module.exports = class Clients {
  constructor () {
    this.clients = [];
  }
  addClient (client) {
    this.clients.push(client);
  }
  removeClient (client) {
    this.clients.splice(this.clients.indexOf(client, 1));
  }
  length () {
    return this.clients.length;
  }
  list () {
    return this.clients;
  }
};
