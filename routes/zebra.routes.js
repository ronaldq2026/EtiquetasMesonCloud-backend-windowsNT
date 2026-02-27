// routes/zebra.routes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/auth.middleware");
const { getFirstProducto } = require("../services/pos.service");
const { printEtiquetaOferta } = require("../services/zebra.service");

router.use(authMiddleware);

// prueba básica: imprime usando el primer registro de posmapre
router.get("/print/oferta/test", async (req, res, next) => {
  try {
    const prod = await getFirstProducto();
    if (!prod) {
      return res.status(404).json({ error: "No hay productos en posmapre" });
    }

    await printEtiquetaOferta(prod);

    res.json({
      ok: true,
      message: "Etiqueta oferta (EPL) enviada a Zebra",
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
``