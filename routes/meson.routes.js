// routes/meson.routes.js

const express = require('express');
const multer = require('multer');

const { getProductoPorSku } = require('../services/pos.service');
const { toNumericSku } = require('../utils/sku');

const {
  parseAndBuildAllowlist,
  getSummary,
  searchExcelItems,
  getExcelItemBySku
} = require('../services/meson-excel.service');

const router = express.Router();

// =========================================
// Helper: Formatear fecha
// =========================================
function formatDate(dateStr) {
  if (!dateStr) return '';

  const d = new Date(dateStr);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

// =========================================
// Upload Excel
// =========================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/api/meson/excel/upload', upload.single('file'), async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({ ok:false, message:'Falta archivo "file"' });
    }

    const user = String(req.headers['x-user'] ?? 'unknown');

    const summary = await parseAndBuildAllowlist(
      req.file.buffer,
      req.file.originalname,
      user
    );

    return res.json({ ok:true, summary });

  } catch (err) {

    console.error('[MESON] excel/upload error:', err);

    return res.status(500).json({
      ok:false,
      message:'Error procesando Excel'
    });

  }

});


// =========================================
// Status Excel
// =========================================

router.get('/api/meson/excel/status', (_req, res) => {

  try {

    const summary = getSummary();

    return res.json({ ok:true, summary });

  } catch (err) {

    console.error('[MESON] excel/status error:', err);

    return res.status(500).json({
      ok:false,
      message:'Error obteniendo estado'
    });

  }

});


// =========================================
// Buscar en Excel
// =========================================

router.get('/api/meson/excel/search', (req, res) => {

  try {

    const term = String(req.query.term ?? '').trim();

    if (!term) {
      return res.json({ ok:true, items:[] });
    }

    const items = searchExcelItems(term);

    return res.json({ ok:true, items });

  } catch (err) {

    console.error('[MESON] excel/search error:', err);

    return res.status(500).json({
      ok:false,
      message:'Error buscando en Excel'
    });

  }

});


// =========================================
// Enrich SKU (Excel + POS)
// =========================================

router.get('/api/meson/excel/enrich/:sku', async (req, res) => {

  try {

    const skuParam = String(req.params.sku ?? '').trim();

    const skuNum = toNumericSku(skuParam);

    if (!skuNum) {
      return res.status(400).json({
        ok:false,
        message:'SKU requerido'
      });
    }

    // validar que el SKU venga del Excel
    const excelItem = getExcelItemBySku(skuNum);

    if (!excelItem) {

      return res.json({
        ok:true,
        foundInExcel:false,
        foundInDPOFE:false,
        message:'El SKU no está en el Excel cargado'
      });

    }

    // consultar POS
    const result = await getProductoPorSku(skuNum);

    if (!result.ok || !result.producto) {

      return res.json({
        ok:true,
        foundInExcel:true,
        foundInDPOFE:false,
        message:'El SKU no existe en POS'
      });

    }

    console.log('[ENRICH]');
    console.log('SKU:', skuNum);
    console.log('Producto:', result.producto);
	
	const p = result.producto;

	return res.json({
	  ok: true,
	  foundInExcel: result.foundInExcel,
	  foundInDPOFE: result.foundInDPOFE,
		producto: {
		  sku: p.sku,
		  descripcion: p.descripcion,
		  marca: p.marca,
		  contenido: p.contenido,
		  ean13: p.ean13,
		  
		  precioNormal: p.precioNormal,
		  precioUnitario: p.precioUnitario,
		  precioOferta: p.precioOferta,

		  vigenciaInicio: p.vigenciaInicio,
		  vigenciaFin: p.vigenciaFin,
		  validoHasta: formatDate(p.vigenciaFin)
		}
	});

  } catch (err) {

    console.error('[MESON] excel/enrich error:', err);

    return res.status(500).json({
      ok:false,
      message:'Error enriqueciendo SKU'
    });

  }

});


// =========================================
// Imprimir etiqueta Zebra
// =========================================

router.post('/api/print/export-html', async (req, res) => {

  try {

    const { product, config } = req.body || {};

    if (!product || !config) {
      return res.status(400).json({
        ok:false,
        message:'Faltan product/config'
      });
    }

    const { buildZplEtiqueta, sendEtiqueta } = require('../services/zebra.service');

    const payload = {
	  precioAntes: product?.precioNormal ?? '',
	  precioAhora: product?.precioOferta ?? product?.precioNormal ?? '',
	  producto: product?.descripcion ?? '',
      subtitulo: product?.marca ?? '',

      sku: product?.sku ?? '',
      codigoBarras: product?.ean13 ?? '',

      cantidad: config?.cantidad ?? 1,

      pr: config?.pr ?? 2,
      md: config?.md ?? 5,
      barcodeHeight: config?.barcodeHeight ?? 70
    };

    const zpl = buildZplEtiqueta(payload);

    const result = await sendEtiqueta(zpl);

    return res.json({
      ok:true,
      printed:true,
      result
    });

  } catch (err) {

    console.error('[print/export-html] error:', err);

    return res.status(500).json({
      ok:false,
      message:'Error imprimiendo etiqueta',
      error: err.message
    });

  }

});


module.exports = router;