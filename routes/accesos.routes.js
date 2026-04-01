const express = require("express");
const router = express.Router();
const accesosService = require("../services/accesos.service");

router.post("/login", async (req, res) => {
  const { username, password, codAplicacion } = req.body;

  try {
    const result = await accesosService.loginConAplicacion(
      username,
      password,
      codAplicacion
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