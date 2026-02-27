// index.js
const express = require('express');
const cors = require('cors');
const { port, apiToken } = require('./config/env');
const { getFirstProducto } = require('./services/pos.service');
const zebraSvc = require('./services/zebra.service');

const app = express();

app.use(cors());
app.use(express.json());

// Auth por token (opcional)
app.use((req, res, next) => {
  const token = req.headers['x-api-token'];
  if (!apiToken) return next(); // sin API_TOKEN, no valida
  if (token !== apiToken) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
});

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// 1) Demo: obtener primer producto del DBF
app.get('/api/pos/producto-demo', async (req, res) => {
  try {
    const producto = await getFirstProducto();

    if (!producto) {
      return res.status(404).json({ message: "No se encontraron productos" });
    }

    res.json({ producto });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error leyendo DBF" });
  }
});

// 2) Demo: imprimir etiqueta de oferta para el primer producto
app.post('/api/pos/print-demo', async (_req, res) => {
  try {
    const producto = await getFirstProducto();
    if (!producto) {
      return res.status(404).json({ message: 'No se encontraron productos' });
    }

    // Validación defensiva para evitar TypeError si el export falla
    if (!zebraSvc || typeof zebraSvc.printEtiquetaOferta !== 'function') {
      console.error('Servicio de impresión no disponible. Export recibido:', zebraSvc);
      return res.status(500).json({
        message: 'Servicio de impresión no disponible (printEtiquetaOferta no exportada)',
      });
    }

    const result = await zebraSvc.printEtiquetaOferta(producto);
    res.status(201).json({ status: 'printed', result, producto });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error imprimiendo etiqueta' });
  }
});

app.listen(port, () => {
  console.log(`Backend POS escuchando en puerto ${port}`);
});
