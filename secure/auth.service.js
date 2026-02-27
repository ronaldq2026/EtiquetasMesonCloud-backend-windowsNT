// secure/auth.service.js
const { apiToken } = require("../config/env");

function validateToken(header) {
  if (!header) return false;

  const parts = header.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    return parts[1] === apiToken;
  }

  // también aceptamos token plano para pruebas
  return header === apiToken;
}

module.exports = { validateToken };