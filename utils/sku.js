// utils/sku.js (o define esta función en cada archivo donde la uses)
function toNumericSku(value) {
  if (value == null) return '';
  // 1) a string y solo dígitos
  let s = String(value).trim().replace(/\D+/g, '');
  // 2) quita ceros a la izquierda: "0000094397" -> "94397"
  s = s.replace(/^0+/, '');
  return s; // si todo eran ceros -> '', lo manejamos más arriba
}

module.exports = { toNumericSku };
``