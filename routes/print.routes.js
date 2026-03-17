// routes/print.routes.js
const express = require('express');
const router = express.Router();
const { buildZplEtiqueta, sendEtiqueta } = require('../services/zebra.service');
const axios = require("axios");

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  return out;
}

// Imprimir directo 
router.post('/api/labels/print', async (req, res) => {
  try {
    const payload = req.body;
    const zpl = buildZplEtiqueta(payload);
    const result = await sendEtiqueta(zpl);	
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('[labels/print] error:', err);
    return res.status(500).json({ ok: false, message: 'Error imprimiendo etiqueta' });
  }
});

//preview
router.post('/api/labels/preview', async (req, res) => {
  try {
    const payload = req.body;
    const zpl = buildZplEtiqueta(payload);
    const response = await axios.post(
      "http://api.labelary.com/v1/printers/8dpmm/labels/2x1.5/0/",
      zpl,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        responseType: "arraybuffer"
      }
    );
    res.set("Content-Type", "image/png");
    return res.send(response.data);
  } catch (err) {
    console.error("preview error", err);
    res.status(500).json({ ok:false });
  }
});

// Exportar ZPL o imprimir según "mode"
router.post('/api/print/export-html', async (req, res) => {
  try {
    const { product, config, mode } = req.body || {};
    const payload = {
      precioAntes: product?.precioAntes ?? product?.precioNormal ?? '',
      precioAhora: product?.precioAhora ?? product?.precioOferta ?? '',
      producto: product?.producto ?? product?.nombre ?? '',
      subtitulo: product?.subtitulo ?? product?.descripcion ?? '',
      sku: product?.sku ?? product?.codigo ?? '',
      codigoBarras: product?.codigoBarras ?? '', // ← MAPBARRA de POSMAPRE
      cantidad: config?.cantidad ?? product?.cantidad ?? 1,
      precioNormal: product?.precioNormal,
      precioOferta: product?.precioOferta,
      descuentoPct: product?.descuentoPct,
      showResumenOferta: !!config?.showResumenOferta,
      pr: config?.pr ?? 2,
      md: config?.md ?? 5,
      barcodeHeight: config?.barcodeHeight ?? 70,
    };
    const zpl = buildZplEtiqueta(payload);

    if (mode === 'print') {
      const result = await sendEtiqueta(zpl);
      return res.json({ ok: true, mode, result });
    }

    res.setHeader('Content-Type', 'application/zpl');
    res.setHeader('Content-Disposition', 'attachment; filename="etiqueta.zpl"');
    return res.send(zpl);
  } catch (err) {
    console.error('[print/export-html] error:', err);
	return res.status(500).json({
	  ok:false,
	  error: err.message,
	  stack: err.stack
	});
  }
});

module.exports = router;
