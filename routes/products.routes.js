//products.routes.js
const express = require('express');
const router = express.Router();
const posService = require('../services/pos.service');

// GET /api/products - lista todos los productos
router.get('/', async (req, res) => {
  try {
    const productos = await posService.getAllMAPRE();
    res.json(productos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/products/:sku - obtiene un producto por SKU
router.get('/:sku', async (req, res) => {
  try {
    const resultado = await posService.getProductoPorSku(req.params.sku);
    if (!resultado.producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(resultado.producto);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;