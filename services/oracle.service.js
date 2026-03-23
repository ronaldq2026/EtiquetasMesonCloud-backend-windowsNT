const oracledb = require('oracledb');

// 🔥 SOLO en servidor (modo real)
if (process.env.ORACLE_MODE === 'real') {
  oracledb.initOracleClient({
    libDir: process.env.ORACLE_LIB_DIR
  });
}

async function getConnection() {
  return await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECTION_STRING
  });
}

// 🔥 INSERT BATCH
async function insertarSkuBatch(skus = []) {
  const conn = await getConnection();
  let count = 0;

  try {
    for (const sku of skus) {

      if (!sku) continue; // 🛡️ evita nulls

      await conn.execute(
        `BEGIN INTERPRETECORP_OWN.PKG_PAI_SKU.insertar_sku(:sku); END;`,
        { sku: Number(sku) }
      );

      count++;
      console.log("Insertando SKU:", sku);
    }

    await conn.commit();
    console.log("✅ Commit ejecutado");

    return count;

  } catch (err) {
    console.error("❌ Error en batch:", err);
    await conn.rollback();
    throw err;

  } finally {
    await conn.close();
  }
}

// 🔥 SIMPLE SELECT
async function getCentralizado() {
  const conn = await getConnection();

  try {
    const result = await conn.execute(
      `select sku, fecha_carga, usuario_carga from pai_sku`
    );

    return result.rows.map(r => ({
      sku: String(r[0]).trim(),
      fecha: r[1],
      usuario: r[2]
    }));

  } finally {
    await conn.close();
  }
}

// 🔥 CURSOR (PROCEDURE)
async function getSkusCentralizados() {
  const conn = await getConnection();

  try {
    const result = await conn.execute(
      `BEGIN INTERPRETECORP_OWN.PKG_PAI_SKU.cursor_skus(:cursor); END;`,
      {
        cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR }
      }
    );

    const rs = result.outBinds.cursor;

    const rows = await rs.getRows(10000);

    await rs.close();

    return rows.map(r => String(r[0]).trim());

  } finally {
    await conn.close();
  }
}

// 🔥 EXPORT CORRECTO
module.exports = {
  getCentralizado,
  insertarSkuBatch,
  getSkusCentralizados
};