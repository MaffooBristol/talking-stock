const inquirer = require('inquirer');

module.exports = class Cli {
  constructor (fetch) {
    this.fetch = fetch;
  }
  init () {
    inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Please choose an action',
        choices: [{ value: 'add', name: 'Add equity' }, { value: 'remove', name: 'Remove equity' }],
      },
    ]).then(({ action }) => {
      inquirer.prompt([
        {
          type: 'input',
          name: 'symbol',
          message: 'Please enter a stock symbol',
        },
      ]).then(({ symbol }) => {
        switch (action) {
          case 'add':
            this.fetch.addSymbol(symbol);
            break;
          case 'remove':
            break;
          default:
            break;
        }
        this.init();
      });
    });
  }
};
