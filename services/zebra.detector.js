const { exec } = require('child_process');

function detectZebraPrinter() {
  return new Promise((resolve, reject) => {
    exec(
      'powershell -Command "Get-Printer | ' +
      'Where-Object { $_.PortName -like \'USB*\' -and $_.DriverName -match \'ZDesigner|Zebra\' } | ' +
      'Select-Object Name, DriverName | ConvertTo-Json"',
      { windowsHide: true },
      (err, stdout) => {
        if (err) return reject(err);

        if (!stdout || !stdout.trim()) {
          return resolve({ type: 'NONE', name: null });
        }

        let data;
        try {
          data = JSON.parse(stdout);
        } catch (e) {
          return reject(e);
        }

        // 🔥 NORMALIZAMOS A ARRAY
        const printers = Array.isArray(data) ? data : [data];

        if (printers.length === 0) {
          return resolve({ type: 'NONE', name: null });
        }

        // Tomamos la primera Zebra válida
        const printer = printers[0];

        if (!printer.DriverName || !printer.Name) {
          return resolve({ type: 'NONE', name: null });
        }

        const driver = printer.DriverName.toUpperCase();

        let type = 'UNKNOWN';
        if (driver.includes('ZD220')) type = 'ZD220T';
        else if (driver.includes('GC420')) type = 'GC420T';

        resolve({
          type,
          name: printer.Name,       // ej: "flejes"
          driver: printer.DriverName
        });
      }
    );
  });
}

module.exports = { detectZebraPrinter };
