/**
 * Normaliza SKU: quita ceros a la izquierda y solo deja dígitos
 * "0000094397" -> "94397"
 * "89096" -> "89096"
 */
function toNumericSku(value) {
  if (value == null) return '';
  let s = String(value).trim().replace(/\D+/g, '');
  s = s.replace(/^0+/, '');
  return s || '';
}

/**
 * Dada una lista de productos, filtra por SKU normalizado
 * y retorna el de MENOR PRECIO
 */
function findProductBySkuLowestPrice(products, skuInput) {
  if (!products || !Array.isArray(products) || products.length === 0) {
    return null;
  }

  const normalizedInput = toNumericSku(skuInput);
  if (!normalizedInput) return null;

  // Filtra todos los productos con SKU normalizado igual
  const matches = products.filter(p => {
    const normalizedPSku = toNumericSku(p.sku || p.DP_DATO || p.codigo);
    return normalizedPSku === normalizedInput;
  });

  if (matches.length === 0) return null;

  // Si hay varios, retorna el de MENOR PRECIO
  if (matches.length > 1) {
    return matches.reduce((best, current) => {
      const precioActual = Number(current.precioOferta) ||
        Number(current.precioNormal) ||
        Number(current.precioUnitario) ||
        Infinity;

      const precioBest = Number(best.precioOferta) ||
        Number(best.precioNormal) ||
        Number(best.precioUnitario) ||
        Infinity;

      return precioActual < precioBest ? current : best;
    });
  }

  // Si hay solo uno, retorna ese
  return matches[0];
}

module.exports = { toNumericSku, findProductBySkuLowestPrice };
