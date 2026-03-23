const express = require('express');
const multer = require('multer');
const router = express.Router();

const { getSkusCentralizados } = require('../services/oracle.service');
const { getProductoPorSku } = require('../services/pos.service');


const upload = multer({
  storage: multer.memoryStorage()
});

// 🔥 NUEVO ENDPOINT REAL
router.post('/api/pai/cargar-excel', upload.single('file'), async (req, res) => {
  try {
    const { parseAndBuildAllowlist, getAllExcelItems } = require('../services/meson-excel.service');
    const { insertarSkuBatch } = require('../services/oracle.service');

    // ✅ VALIDAR ARCHIVO
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: 'Debes subir un archivo Excel'
      });
    }

    const user = String(req.headers['x-user'] ?? 'oracle-loader');

    console.log("📂 Archivo recibido:", req.file.originalname);

    // 🔥 1. PARSEAR EXCEL DIRECTAMENTE DESDE EL REQUEST
    await parseAndBuildAllowlist(
      req.file.buffer,
      req.file.originalname,
      user
    );

    // 🔥 2. OBTENER SKUS (AHORA SÍ EXISTEN)
    const items = getAllExcelItems();

    console.log("📊 Items leídos:", items.length);

    if (!items || items.length === 0) {
      return res.status(400).json({
        ok: false,
        message: 'Excel sin datos válidos'
      });
    }

    // 🔥 3. INSERTAR EN ORACLE
    const skus = items.map(i => i.sku);

    const insertados = await insertarSkuBatch(skus);

    console.log("✅ Insertados:", insertados);

    return res.json({
      ok: true,
      insertados
    });

  } catch (err) {
    console.error('❌ Error cargar-excel:', err);

    return res.status(500).json({
      ok: false,
      message: err.message
    });
  }
});

router.get('/api/pai/leer-centralizado', async (req, res) => {

  try {

    const skus = await getSkusCentralizados();

    const conOferta = [];
    const sinOferta = [];

    for (const sku of skus) {

      const result = await getProductoPorSku(sku);

      if (!result.ok || !result.producto) continue;

      const p = result.producto;

      const item = {
        sku: p.sku,
        descripcion: p.descripcion,
        marca: p.marca,
        precioNormal: p.precioNormal,
        precioUnitario: p.precioUnitario,
        precioOferta: p.precioOferta
      };

      if (p.precioOferta) {
        conOferta.push(item);
      } else {
        sinOferta.push(item);
      }
    }

    return res.json({
      total: skus.length,
      conOferta: {
        total: conOferta.length,
        items: conOferta
      },
      sinOferta: {
        total: sinOferta.length,
        items: sinOferta
      }
    });

  } catch (err) {

    console.error('? Error centralizado:', err);

    return res.status(500).json({
      ok: false,
      message: 'Error leyendo centralizado'
    });
  }
});

module.exports = router;