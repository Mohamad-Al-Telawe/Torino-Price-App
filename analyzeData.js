/**
 * analyzeData.js
 * الدالة الرئيسية — تُطبّق analyzeItem على كل مادة
 *
 * تعتمد على:
 *   - analyzeItem  (analyzeItem.js)
 *
 * @param {Array<Array<Object>>} groups - خرج groupByCode
 * @param {number} [taxRate=1.05]       - معامل الضريبة يُمرَّر لكل مادة
 * @returns {Array<Object>} مصفوفة كائنات التحليل، واحد لكل مادة
 */
function analyzeData(groups, taxRate = 1.05) {
  return groups
    .map(itemRows => analyzeItem(itemRows, taxRate))
    .filter(result => result !== null);
}