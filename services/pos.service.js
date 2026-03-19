//pos.service.js
const { DBFFile } = require("dbffile");
const path = require("path");

// =============================
// Rutas DBF
// =============================
const rutaMAPRE = path.join("E:", "fasapos", "data", "posmapre.dbf");
const rutaDPOFE = path.join("E:", "fasapos", "data", "posdpofe.dbf");

// =============================
// CACHE GLOBAL
// =============================

let mapProductos = new Map();
let mapOfertas = new Map();
let cacheCargando = false;

// =============================
// Helpers
// =============================

function cleanStr(s) {
  return (s ?? "").toString().trim();
}

function cleanNum(n) {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function normalizeSku(value) {

  if (value == null) return null;

  let s = String(value).trim();

  s = s.replace(/\D+/g, "");
  s = s.replace(/^0+/, "");

  return s || null;
}

// =============================
// Mapear MAPRE
// =============================

function mapMAPRE(row) {

  const sku = normalizeSku(row.MAPCODIN);
  if (!sku) return null;

  return {
    sku,
    descripcion: cleanStr(row.MAPDESCL),
    marca: cleanStr(row.MAPLAB),
    contenido: cleanStr(row.MAPCONCENT),
    ean13: cleanStr(row.MAPBARRA),
	unidadMedida: cleanStr(row.MAPUDESC), 
    // ?? NUEVO ORDEN CORRECTO
    precioNormal: cleanNum(row.MAPPREVT),   // antes precioUnitario
    precioUnitario: cleanNum(row.MAPREUNI)  // nuevo campo real
  };
}

// =============================
// Mapear DPOFE
// =============================

function mapDPOFE(row) {

  const sku = normalizeSku(row.DP_DATO);
  if (!sku) return null;

  return {
    sku,
    precioOferta: cleanNum(row.DP_VALOFER),
    vigenciaInicio: cleanStr(row.DP_FINICIO),
    vigenciaFin: cleanStr(row.DP_FFIN)
  };
}

// =============================
// Cargar DBF en memoria
// =============================

async function cargarCache() {

  if (cacheCargando) return;

  cacheCargando = true;

  console.log("[POS] Cargando DBF...");

  const start = Date.now();

  mapProductos.clear();
  mapOfertas.clear();

  // MAPRE
  const dbfMAPRE = await DBFFile.open(rutaMAPRE, { encoding: "cp1252" });

  let records = await dbfMAPRE.readRecords(1000);

  while (records.length > 0) {

    for (const row of records) {

      const p = mapMAPRE(row);

      if (p) mapProductos.set(p.sku, p);
    }

    records = await dbfMAPRE.readRecords(1000);
  }

  // DPOFE
  const dbfDPOFE = await DBFFile.open(rutaDPOFE, { encoding: "cp1252" });

  records = await dbfDPOFE.readRecords(1000);

  while (records.length > 0) {

    for (const row of records) {

      const o = mapDPOFE(row);

	  if (o) {
		  if (!mapOfertas.has(o.sku)) {
			mapOfertas.set(o.sku, []);
		  }
		  mapOfertas.get(o.sku).push(o);
		}
    }

    records = await dbfDPOFE.readRecords(1000);
  }

  const end = Date.now();

  console.log("[POS] MAPRE:", mapProductos.size);
  console.log("[POS] DPOFE:", mapOfertas.size);
  console.log("[POS] Cache cargado en", (end - start), "ms");

  cacheCargando = false;
}

function elegirMejorOferta(ofertas = []) {

  if (!ofertas.length) return null;

  const hoy = new Date();

  // opcional: filtrar vigentes
  const vigentes = ofertas.filter(o => {
    if (!o.vigenciaFin) return true;
    return new Date(o.vigenciaFin) >= hoy;
  });

  const lista = vigentes.length ? vigentes : ofertas;

  return lista.reduce((mejor, actual) => {
    if (!mejor) return actual;

    const a = cleanNum(actual.precioOferta);
    const b = cleanNum(mejor.precioOferta);

    return a < b ? actual : mejor;
  }, null);
}

// =============================
// Obtener producto
// =============================

async function getProductoPorSku(skuRaw) {

  if (mapProductos.size === 0) {
    await cargarCache();
  }

  const sku = normalizeSku(skuRaw);

  if (!sku) {
    return {
      ok: false,
      foundInExcel: false,
      foundInDPOFE: false,
      producto: null
    };
  }
	const base = mapProductos.get(sku) || null;

	const ofertas = mapOfertas.get(sku) || [];
	const mejorOferta = elegirMejorOferta(ofertas);

	if (!base && ofertas.length === 0) {
	  return {
		ok: true,
		foundInExcel: false,
		foundInDPOFE: false,
		producto: null
	  };
	}

	return {
	  ok: true,
	  foundInExcel: !!base,
	  foundInDPOFE: ofertas.length > 0,
	  producto: {
		sku,
		descripcion: base?.descripcion ?? "",
		marca: base?.marca ?? "",
		contenido: base?.contenido ?? "",
		ean13: base?.ean13 ?? "",
		imagenUrl: null,
		unidadMedida: base?.unidadMedida ?? "", 
		precioNormal: cleanNum(base?.precioNormal),
		precioUnitario: cleanNum(base?.precioUnitario),

		precioOferta: mejorOferta ? cleanNum(mejorOferta.precioOferta) : null,

		vigenciaInicio: mejorOferta?.vigenciaInicio ?? null,
		vigenciaFin: mejorOferta?.vigenciaFin ?? null
	  }
	};
}

// =============================
// Obtener varios
// =============================

async function getProductosPorSku(listaSku = []) {

  if (mapProductos.size === 0) {
    await cargarCache();
  }

  return listaSku
    .map(normalizeSku)
    .filter(Boolean)
    .map(sku => {

      const base = mapProductos.get(sku) || null;

		const ofertas = mapOfertas.get(sku) || [];
		const mejorOferta = elegirMejorOferta(ofertas);

		if (!base && ofertas.length === 0) {
		  return {
			ok: true,
			foundInExcel: false,
			foundInDPOFE: false,
			producto: null
		  };
		}

		return {
		  ok: true,
		  foundInExcel: !!base,
		  foundInDPOFE: ofertas.length > 0,
		  producto: {
			sku,
			descripcion: base?.descripcion ?? "",
			marca: base?.marca ?? "",
			contenido: base?.contenido ?? "",
			ean13: base?.ean13 ?? "",
			imagenUrl: null,
			unidadMedida: base?.unidadMedida ?? "", 
			precioNormal: cleanNum(base?.precioNormal),
			precioUnitario: cleanNum(base?.precioUnitario),

			precioOferta: mejorOferta ? cleanNum(mejorOferta.precioOferta) : null,

			vigenciaInicio: mejorOferta?.vigenciaInicio ?? null,
			vigenciaFin: mejorOferta?.vigenciaFin ?? null
		  }
		};
    })
    .filter(Boolean);
}

// =============================
// Recarga automática
// =============================

setInterval(() => {

  console.log("[POS] Refrescando cache DBF...");

  cargarCache();

}, 5 * 60 * 1000); // cada 5 minutos

// =============================
// Exports
// =============================

module.exports = {
  getProductoPorSku,
  getProductosPorSku,
  cargarCache
};