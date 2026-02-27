// config/printer.js
const { printMode } = require("./env");

module.exports = {
  mode: 'windows-raw', // o 'tcp'
  sharePath: '\\\\localhost\\flejes', // sin comillas extras ni barra final
  zebraHost: '192.168.x.x', // si usas TCP
  zebraPort: 9100
};
