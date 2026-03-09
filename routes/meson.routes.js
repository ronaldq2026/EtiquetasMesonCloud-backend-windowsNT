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
	console.log("Registros POSDPOFE:", cacheDPOFE?.length);
	console.log("SKU buscado:", skuNum);
    
	// Si hay varios con mismo sku, filtra menor precio
	const matches = cacheDPOFE.filter(
	  (r) => r && r.sku && String(r.sku) === String(skuNum)
	);

	let chosen = null;

	if (matches.length > 0) {
	  chosen = matches.reduce((best, current) => {

		// precio válido del registro actual
		const precioActual =
		  Number(current.precioOferta) ||
		  Number(current.precioNormal) ||
		  Number(current.precioUnitario) ||
		  Infinity;

		// precio válido del mejor hasta ahora
		const precioBest =
		  Number(best?.precioOferta) ||
		  Number(best?.precioNormal) ||
		  Number(best?.precioUnitario) ||
		  Infinity;

		return precioActual < precioBest ? current : best;

	  }, matches[0]);
	}

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
 * - En PROD (server_760): forzamos impresión directa aunque pidan return-zpl
 */
router.post('/api/print/export-html', async (req, res) => {
  try {
    const { product, config } = req.body || {};

    if (!product || !config) {
      return res.status(400).json({ ok: false, message: 'Faltan product/config' });
    }

    const { buildZplEtiqueta, sendEtiqueta } = require('../services/zebra.service');

    const payload = {
      precioAntes: product?.precioNormal ?? '',
      precioAhora: product?.precioOferta ?? '',
      producto: product?.nombre ?? product?.producto ?? '',
      subtitulo: product?.descripcion ?? '',
      sku: product?.sku ?? product?.codigo ?? '',
      codigoBarras: product?.codigoBarras ?? '',
      cantidad: config?.cantidad ?? 1,

      precioNormal: product?.precioNormal,
      precioOferta: product?.precioOferta,
      descuentoPct: product?.descuentoPct,

      pr: config?.pr ?? 2,
      md: config?.md ?? 5,
      barcodeHeight: config?.barcodeHeight ?? 70,
    };

    const zpl = buildZplEtiqueta(payload);

    const result = await sendEtiqueta(zpl);

    return res.json({
      ok: true,
      printed: true,
      result
    });

  } catch (err) {
    console.error('[print/export-html] error:', err?.stack ?? err);
    return res.status(500).json({
      ok: false,
      message: 'Error exportando/imprimiendo etiqueta',
      error: err.message
    });
  }
});

module.exports = router;
