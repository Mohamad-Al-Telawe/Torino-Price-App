/**
 * Converts copied Excel table text (tab-separated) into an array of objects.
 * @param {string} text - Text copied from Excel
 * @returns {Array<Object>} Array of objects, each representing a table row
 */
function parseExcelText(text) {
  const COLUMNS = [
    // 'billNumber',
    'billType',
    'billDate',
    'branch',
    // 'toBranch',
    'code',
    // 'color',
    // 'size',
    'billDescription',
    'inputQuantity',
    'outputQuantity',
    // 'balance',
    // 'inputPrice',
    'outputPrice',
    // 'price',
    // 'value',
  ];

  const NUMERIC_COLUMNS = new Set([
    'billNumber',
    'size',
    'inputQuantity',
    'outputQuantity',
    'balance',
    'inputPrice',
    'outputPrice',
    'price',
    'value',
  ]);

  return text
    .split('\n')
    .map(line => line.replace(/\r$/, ''))
    .filter(line => line.trim() !== '')
    .map(line => {
      const cells = line.split('\t');

      if (cells.length !== COLUMNS.length) {
        console.warn(
          `Unexpected column count (${cells.length} instead of ${COLUMNS.length}):`,
          line
        );
      }

      const row = {};
      COLUMNS.forEach((col, i) => {
        const raw = (cells[i] ?? '').trim();

        if (NUMERIC_COLUMNS.has(col)) {
          const num = Number(raw.replace(',', '.'));
          row[col] = raw === '' || isNaN(num) ? null : num;
        } else {
          row[col] = raw === '' ? null : raw;
        }
      });

      return row;
    });
}
/**
 * يجمّع مصفوفة الكائنات حسب حقل code
 * مع الحفاظ على تسلسل ظهور كل code في البيانات الأصلية
 * @param {Array<Object>} rows - خرج دالة parseExcelText
 * @returns {Array<Array<Object>>} مصفوفة مصفوفات، كل مصفوفة داخلية تمثل code واحد
 */
function groupByCode(rows) {
  const indexMap = new Map(); // code -> index في النتيجة
  const result = [];

  for (const row of rows) {
    const code = row.code;

    if (!indexMap.has(code)) {
      indexMap.set(code, result.length);
      result.push([]);
    }

    result[indexMap.get(code)].push(row);
  }

  return result;
}