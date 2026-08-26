    /**
 * groupByBranch.js
 * الدالة رقم 1 — تجمّع صفوف مادة واحدة حسب الفرع (branch)
 *
 * @param {Array<Object>} itemRows - صفوف مادة واحدة (خرج groupByCode[i])
 * @returns {Map<string, Array<Object>>} خريطة: اسم الفرع → مصفوفة صفوفه
 */
function groupByBranch(itemRows) {
  const map = new Map();

  for (const row of itemRows) {
    const branch = row.branch;
    if (!map.has(branch)) map.set(branch, []);
    map.get(branch).push(row);
  }

  return map;
}