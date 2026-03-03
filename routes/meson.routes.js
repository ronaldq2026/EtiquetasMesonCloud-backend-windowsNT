// routes/meson.routes.js
const express = require('express');
const multer = require('multer');
const { getAllDPOFE } = require('../services/pos.service');
const {
  parseAndBuildAllowlist,
  getSummary,
  searchExcelItems,
  getExcelItemBySku,
} = require('../services/meson-excel.service');

const router = express.Router();

// ===== util: SKU numérico (sin ceros) =====
function toNumericSku(value) {
  if (value == null) return '';
  let s = String(value).trim().replace(/\D+/g, ''); // sólo dígitos
  s = s.replace(/^0+/, ''); // quita ceros a la izquierda
  return s; // string numérica
}

// ===== cache DPOFE =====
let cacheDPOFE = null;
async function ensureCache() {
  if (!cacheDPOFE) {
    console.log('[MESON] Cargando POSDPOFE...');
    cacheDPOFE = await getAllDPOFE(); // sku ya mapeado a numérico en pos.service
    console.log('[MESON] Registros cargados:', cacheDPOFE.length);
  }
}

// ===== upload Excel =====
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/api/meson/excel/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'Falta archivo "file"' });
    const user = String(req.headers['x-user'] ?? 'unknown');
    const summary = await parseAndBuildAllowlist(req.file.buffer, req.file.originalname, user);
    return res.json({ ok: true, summary });
  } catch (err) {
    console.error('[MESON] excel/upload error:', err?.stack ?? err);
    return res.status(500).json({ ok: false, message: 'Error procesando Excel' });
  }
});

router.get('/api/meson/excel/status', (_req, res) => {
  try {
    const summary = getSummary();
    return res.json({ ok: true, summary });
  } catch (err) {
    console.error('[MESON] excel/status error:', err?.stack ?? err);
    return res.status(500).json({ ok: false, message: 'Error obteniendo estado' });
  }
});

// ===== buscar SOLO en Excel =====
router.get('/api/meson/excel/search', (req, res) => {
  try {
    const term = String(req.query.term ?? '').trim();
    if (!term) return res.json({ ok: true, items: [] });
    const items = searchExcelItems(term);
    return res.json({ ok: true, items });
  } catch (err) {
    console.error('[MESON] excel/search error:', err?.stack ?? err);
    return res.status(500).json({ ok: false, message: 'Error buscando en Excel cargado' });
  }
});

// ===== enriquecer: tomar el PRIMER match en POSDPOFE =====
router.get('/api/meson/excel/enrich/:sku', async (req, res) => {
  try {
    const skuParam = String(req.params.sku ?? '').trim();
    const skuNum = toNumericSku(skuParam); // normaliza a numérico
    if (!skuNum) {
      return res.status(400).json({ ok: false, message: 'SKU requerido' });
    }

    // 1) validar que el SKU venga del Excel (ahí ya guardamos numérico)
    const item = getExcelItemBySku(skuNum);
    if (!item) {
      return res.json({
        ok: true,
        foundInExcel: false,
        foundInDPOFE: false,
        message: 'El SKU no está en el Excel cargado',
      });
    }

    // 2) cruzar contra POSDPOFE y ELEGIR EL PRIMERO
    await ensureCache();
    // Si hay varios con mismo sku, filtra y elige el primero (orden natural POSDPOFE)
    const matches = cacheDPOFE.filter((r) => r.sku === skuNum);
    const chosen = matches.length > 0 ? matches[0] : null; // 👈 PRIMERO

    if (!chosen) {
      return res.json({
        ok: true,
        foundInExcel: true,
        foundInDPOFE: false,
        message: 'El SKU no existe en POSDPOFE (no hay precios/ofertas)',
      });
    }

    return res.json({
      ok: true,
      foundInExcel: true,
      foundInDPOFE: true,
      producto: chosen,
      // opcional: para debug
      // duplicates: matches.length,
    });
  } catch (err) {
    console.error('[MESON] excel/enrich error:', err?.stack ?? err);
    return res.status(500).json({ ok: false, message: 'Error enriqueciendo SKU' });
  }
});

/**
 * ===== Export HTML / Imprimir directo =====
 * POST /api/print/export-html
 * body: { product, config, mode?: 'return-zpl' | 'print-direct' }
 *
 * - En DEV (laptop): si mode === 'return-zpl' -> devuelve archivo .epl
 * - En PROD (server_760): forzamos impresión directa aunque pidan return-zpl
 */
router.post('/api/print/export-html', async (req, res) => {
  try {
    const { product, config, mode } = req.body || {};
    if (!product || !config) {
      return res.status(400).json({ ok: false, message: 'Faltan product/config' });
    }

    const { buildEplEtiqueta, sendEtiqueta } = require('../services/zebra.service');

    // Mapeo mínimo; ajusta a tu payload real
    const epl = buildEplEtiqueta({
      descripIzq: product?.nombre ?? '',
      descripDer: product?.descripcion ?? '',
      precio: String(product?.precioOferta ?? product?.precioNormal ?? ''),
      barra: product?.codigoBarras ?? '',
      fechaTermino: product?.oferta?.vigenciaFin ?? '',
      codigo: product?.codigo ?? '',
      comision: '',
    });

    // 🔒 Hardening: en producción, NUNCA devolvemos archivo .epl
    const isProd = process.env.NODE_ENV === 'production';
    if (mode === 'return-zpl' && isProd) {
      const result = await sendEtiqueta(epl);
      return res.json({ ok: true, result });
    }

    // DEV: devolver archivo si así lo piden
    if (mode === 'return-zpl') {
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="etiqueta-${Date.now()}.epl"`);
      return res.status(200).send(epl);
    }

    // default / print-direct: imprimir
    const result = await sendEtiqueta(epl);
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('[print/export-html] error:', err?.stack ?? err);
    return res.status(500).json({ ok: false, message: 'Error exportando/imprimiendo etiqueta' });
  }
});

module.exports = router;
