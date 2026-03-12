// routes/zebra.routes.js

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");

const { printEtiquetaOferta } = require("../services/zebra.service");

router.use(authMiddleware);


// imprimir etiqueta desde frontend
router.post("/print/oferta", async (req, res, next) => {

  try {

    const payload = req.body;

    if (!payload) {
      return res.status(400).json({
        ok: false,
        error: "Body vacío"
      });
    }

    await printEtiquetaOferta(payload);

    res.json({
      ok: true,
      message: "Etiqueta enviada a Zebra"
    });

  } catch (err) {
    next(err);
  }

});


// endpoint de prueba
router.get("/print/oferta/test", async (req, res, next) => {

  try {

    const prod = {
      precioAntes: 1990,
      precioAhora: 1750,
      producto: "TEST ZEBRA",
      subtitulo: "PRUEBA",
      sku: "12345",
      codigoBarras: "123456789012",
      cantidad: 1
    };

    await printEtiquetaOferta(prod);

    res.json({
      ok: true,
      message: "Etiqueta test enviada a Zebra"
    });

  } catch (err) {
    next(err);
  }

});

module.exports = router;