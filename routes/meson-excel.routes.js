// routes/meson-excel.routes.js
const express = require('express');
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
const { parseAndBuildAllowlist, getSummary } = require('../services/meson-excel.service');

const router = express.Router();

/**
 * POST /api/meson/excel/upload
 * multipart/form-data; campo: file
 * header opcional: x-user (para logging)
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Falta archivo "file"' });
    }
    const uploadedBy = String(req.headers['x-user'] || 'unknown');
    const summary = await parseAndBuildAllowlist(req.file.buffer, req.file.originalname, uploadedBy);
    return res.json({ ok: true, summary });
  } catch (err) {
    console.error('[meson/excel/upload]', err);
    return res.status(500).json({ ok: false, message: 'Error procesando Excel' });
  }
});

/**
 * GET /api/meson/excel/status
 * Retorna resumen del allowlist vigente
 */
router.get('/status', (req, res) => {
  try {
    const summary = getSummary();
    return res.json({ ok: true, summary });
  } catch (err) {
    console.error('[meson/excel/status]', err);
    return res.status(500).json({ ok: false, message: 'Error obteniendo estado' });
  }
});

module.exports = router;