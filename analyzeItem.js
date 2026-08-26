/**
 * analyzeItem.js
 * تُحلّل صفوف مادة واحدة وتُعيد كائن التحليل الكامل
 *
 * تعتمد على:
 *   - groupByBranch   (groupByBranch.js)
 *   - getFirstInput, getCurrentBalance, getSalesAnalysis  (branchAnalyzers.js)
 */

/**
 * @param {Array<Object>} itemRows  - صفوف مادة واحدة (خرج groupByCode[i])
 * @param {number} [taxRate=1.05]   - معامل الضريبة يُمرَّر إلى getSalesAnalysis
 * @returns {Object} كائن التحليل { code, bran  ches }
 */
function analyzeItem(itemRows, taxRate = 1.05) {
  if (!itemRows.length) return null;

  const code = itemRows[0].code;
  const branchMap = groupByBranch(itemRows);
  const branches = [];

  for (const [nameBranch, branchRows] of branchMap) {
    const firstInput = getFirstInput(branchRows);
    const balance = getCurrentBalance(branchRows);
    const { totalSales, sales } = getSalesAnalysis(branchRows, taxRate);

    branches.push({
      nameBranch,
      firstInput,
      balance,
      totalSales,
      sales,
      inputRows: branchRows.filter(isRealInput),
      notes: getBranchNotes(branchRows),
    });
  }

  return { code, branches };
}