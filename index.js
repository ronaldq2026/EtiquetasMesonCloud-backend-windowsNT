// index.js
const express = require("express");
const cors = require("cors");
const { port, apiToken } = require("./config/env");

const { getFirstProducto } = require("./services/pos.service");
// OJO: ya no importo printEtiquetaOferta aquí; lo manejamos por rutas
const mesonRoutes = require("./routes/meson.routes");
const printRoutes = require("./routes/print.routes"); // ← nuevo

const app = express(); // ← DECLARAR UNA SOLA VEZ
const paiRoutes = require("./routes/pai.routes");
const posService = require("./services/pos.service");

const productsRoutes = require('./routes/products.routes');

app.use(cors());
app.use(express.json());

const accesosRoutes = require('./routes/accesos.routes');
app.use('/api/accesos', accesosRoutes);

// 🔐 middleware auth
app.use((req, res, next) => {
  const token = req.headers["x-api-token"];
  if (!apiToken) return next();
  if (token !== apiToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
});

app.use('/api/products', productsRoutes);

// --- Rutas del mesón (Excel/POSDPOFE) — una sola vez
app.use(mesonRoutes);

// --- Rutas de impresión/export ZPL — una sola vez
app.use(printRoutes);

//para insertar a pai_sku
app.use(paiRoutes);

// --- Healthcheck
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// --- Demos existentes (opcional)
app.get("/api/pos/producto-demo", async (_req, res) => {
  try {
    const producto = await getFirstProducto();
    if (!producto) return res.status(404).json({ message: "No se encontraron productos" });
    res.json({ producto });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error leyendo DBF" });
  }
});

app.get("/producto/:sku", async (req, res) => {

  try {

    const { sku } = req.params;

    const result = await posService.getProductoPorSku(sku);

    res.json(result);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Error obteniendo producto"
    });

  }

});

app.post("/api/pos/print-demo", async (_req, res) => {
  try {
    // Si quieres mantener esta demo, ahora deberías construir el payload ZPL
    // o simplemente dejarla como NOOP o redirigir a /api/labels/print
    res.status(200).json({ status: "ok", message: "Usa /api/labels/print para imprimir ZPL." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error en print-demo" });
  }
});

app.listen(port, () => {
  console.log(`Backend POS escuchando en puerto ${port}`);
});