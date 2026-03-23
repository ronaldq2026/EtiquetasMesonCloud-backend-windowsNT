const oracledb = require('oracledb');
require('dotenv').config();

// 🔥 MODO THICK
oracledb.initOracleClient({
  libDir: 'C:\\oracle\\instantclient_19_30'
});

async function test() {
  try {
    const conn = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECTION_STRING
    });

    console.log('✅ Conectado a Oracle');

    const result = await conn.execute(`SELECT 1 FROM dual`);
    console.log('Resultado:', result.rows);

    await conn.close();
  } catch (err) {
    console.error('❌ Error Oracle:', err);
  }
}

test();