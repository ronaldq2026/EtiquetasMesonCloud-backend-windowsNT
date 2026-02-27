// config/env.js
require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3000,
  apiToken: process.env.API_TOKEN || "CAMBIA_ESTE_TOKEN",
  printMode: process.env.PRINT_MODE || "windows-raw",
};