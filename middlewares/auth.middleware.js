// middlewares/auth.middleware.js
const { validateToken } = require("../secure/auth.service");

function authMiddleware(req, res, next) {
  const header = req.headers["authorization"] || "";
  if (!validateToken(header)) {
    return res.status(401).json({ error: "Token inválido o ausente" });
  }
  next();
}

module.exports = authMiddleware;
``