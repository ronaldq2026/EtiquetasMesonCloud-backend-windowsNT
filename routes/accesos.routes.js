const express = require("express");
const router = express.Router();
const accesosService = require("../services/accesos.service");

router.post("/login", async (req, res) => {
  const { username, password, newPassword, codAplicacion } = req.body;
  console.log("[ACCESOS] POST /api/accesos/login body recibido:", {
    username,
    passwordLength: String(password ?? "").length,
    newPasswordLength: String(newPassword ?? "").length,
    codAplicacion
  });

  try {
    const result = await accesosService.loginConAplicacion(
      username,
      password,
      codAplicacion,
      newPassword
    );

    res.json(result);
  } catch (err) {
    res.status(401).json({
      ok: false,
      mensaje: err.message
    });
  }
});

module.exports = router;
