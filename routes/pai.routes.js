const express = require('express');
const multer = require('multer');
const router = express.Router();

const { getSkusCentralizados } = require('../services/oracle.service');
const { getProductoPorSku,getProductosPorSku } = require('../services/pos.service');

const fs = require('fs');
const path = require('path');

// ajusta esta ruta a tu server real
const RUTA_ETIQUETAS = 'E:\\fasapos\\correo\\recibe';


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
        precioOferta: p.precioOferta,		
		ean13: p.ean13,
		unidadMedida: p.unidadMedida,
		vigenciaFin: p.vigenciaFin
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

router.get('/api/pai/leer-etiquetarf', async (req, res) => {
  try {

    // =====================================
    // 1. BUSCAR ÚLTIMO ARCHIVO
    // =====================================
    const files = fs.readdirSync(RUTA_ETIQUETAS)
      .filter(f => f.toLowerCase().startsWith('etiquerf'));

    if (files.length === 0) {
      return res.status(404).json({ message: 'No hay archivos ETIQUERF' });
    }

    const latestFile = files.sort().reverse()[0];
    const fullPath = path.join(RUTA_ETIQUETAS, latestFile);

    // =====================================
    // 2. LEER ARCHIVO
    // =====================================
    const raw = fs.readFileSync(fullPath, 'utf-8');

    const skus = [...new Set(
      raw
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
    )];

    // =====================================
    // 3. BUSCAR PRODUCTOS
    // =====================================
    const resultados = await getProductosPorSku(skus);

    const productos = resultados
      .filter(r => r.producto)
      .map(r => r.producto);

    // =====================================
    // 4. CLASIFICAR SIN DUPLICADOS 🔥
    // =====================================
    const conOferta = [];
    const sinOferta = [];

    const seen = new Set(); // 👈 CONTROL GLOBAL

    for (const p of productos) {

      const sku = String(p.sku);

      if (seen.has(sku)) continue; // 🔥 evita duplicados
      seen.add(sku);

      if (p.precioOferta && p.precioOferta > 0) {
        conOferta.push(p);
      } else {
        sinOferta.push(p);
      }
    }

    // =====================================
    // 5. NO ENCONTRADOS
    // =====================================
    const encontrados = new Set(productos.map(p => String(p.sku)));

    const noEncontrados = skus.filter(
      sku => !encontrados.has(String(sku))
    );

    console.log("SKUS ARCHIVO:", skus.length);
    console.log("PRODUCTOS ÚNICOS:", seen.size);
    console.log("CON OFERTA:", conOferta.length);
    console.log("SIN OFERTA:", sinOferta.length);

    // =====================================
    // 6. RESPUESTA
    // =====================================
    res.json({
      total: skus.length,
      archivo: latestFile,
      raw,

      conOferta: {
        count: conOferta.length,
        items: conOferta
      },

      sinOferta: {
        count: sinOferta.length,
        items: sinOferta
      },

      noEncontrados: {
        count: noEncontrados.length,
        items: noEncontrados
      }
    });

  } catch (err) {
    console.error("❌ ERROR ETIQUERF:", err);

    res.status(500).json({
      message: 'Error leyendo ETIQUERF',
      error: err.message
    });
  }
});

module.exports = router;