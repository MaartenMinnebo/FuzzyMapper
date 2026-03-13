import Papa from 'papaparse';

export function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: h => h.trim().toLowerCase(),
      complete: results => {
        const fields = results.meta.fields || [];
        const uuidHeader = fields.find(f =>
          ['uuid', 'id', 'unieke id', 'nr', 'nummer'].includes(f)
        ) || '';
        const descHeader = fields.find(f =>
          ['omschrijving', 'description', 'omschrijf', 'tekst', 'naam', 'item'].includes(f)
        ) || '';

        const data = results.data.map(row => {
          const uuid = (uuidHeader ? row[uuidHeader] : row.uuid || row.id || '').toString().trim();
          let omschrijving = (descHeader ? row[descHeader] : row.omschrijving || row.description || '').toString().trim();
          if (!omschrijving) {
            const fallback = Object.keys(row).find(k => k !== uuidHeader && row[k]);
            if (fallback) omschrijving = row[fallback].toString().trim();
          }
          return { uuid, omschrijving };
        }).filter(r => r.uuid || r.omschrijving);

        resolve(data);
      },
      error: reject,
    });
  });
}
