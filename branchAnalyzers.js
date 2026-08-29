/**
 * branchAnalyzers.js
 * دوال التحليل — تُطبَّق على صفوف فرع واحد
 */

// ── توحيد كتابة الألف ────────────────────────────────────────────────────────
// بيانات المصدر غير متسقة أحياناً في كتابة الهمزة (مثال: "ادخال" بدل "إدخال")
// هذه الدالة توحّد كل أشكال الألف (إ / أ / آ) إلى ألف عادية (ا) قبل المقارنة.

function normalizeAlef(str) {
  return (str ?? '').replace(/[إأآ]/g, 'ا');
}

function typeEquals(billType, constant) {
  return normalizeAlef(billType) === normalizeAlef(constant);
}

function typeIn(billType, list) {
  return list.some(t => typeEquals(billType, t));
}

// ══════════════════════════════════════════════════════════════════════════
// مصفوفات أسماء الفواتير — عدّل/أضف هنا فقط، بدون لمس أي دالة تحت
// ══════════════════════════════════════════════════════════════════════════

/** فواتير تُحتسب ككمية إدخال حقيقية — تدخل في عمود "كمية الإدخال" وتاريخ "أول إدخال" */
const REAL_INPUT_TYPES = [
  'فاتورة الإدخال',
  'فاتورة بضاعة أول المدة',
  'ادخال مواد متجر الكتروني',
  'ادخال مواد الى مستودع أحذية و شنط',
  'فاتورة مشتريات داخل دولة الامارات',
  'فاتورة مشتريات خارج دولة الامارات',
  'ادخال الى الإدارة',
  'ادخال مواد الى مستودع الشنط',
  // عمان
  'ادخال مواد',
  'فاتورة مشتريات عمان',
  'ادخال مواد الى ادارة عمان',
  'فاتورة ادخال بضاعة تالفة',
  'ادخال مواد الى متجر الكتروني',
  'ادخال مواد الى مستودع',

];

/** فواتير المبيعات — تدخل في عمود المبيعات وحساب الأسعار */
const SALE_TYPES = [
  'فاتورة مبيعات سعر المبيع',
  'فاتورة مبيعات سعر التوزيع',
  'فاتورة مبيعات سعر نصف الجمله',
  'فاتورة مبيعات سعر الجمله',
  'مبيعات متجر الكتروني',
  'فاتورة مبيعات انستغرام',
  // عمان
  'فاتورة مبيعات سعر نصف الجملة',
  'فاتورة مبيعات سعر الجملة',
  'فاتورة مبيعات انستغرام عمان',
  'فاتورة مبيعات متجر إلكتروني',
];

/** فواتير مرتجع المبيعات — تظهر في الملاحظة "مرتجع N" فقط، ليست إدخال حقيقي ولا مبيعات
 *  ⚠️ مؤكّد عندي فقط النوع الأول (ظاهر في بياناتك). إذا عندك مرتجع بأسعار توزيع/نصف
 *  جملة/جملة أضف أسماءها هنا بالضبط كما تظهر في بياناتك. */
const SALE_RETURN_TYPES = [
  'فاتورة مرتجع مبيعات سعر المبيع',
  'فاتورة مرتجع مبيعات سعر التوزيع',
  'فاتورة مرتجع مبيعات سعر نصف الجمله',
  'فاتورة مرتجع مبيعات سعر الجمله',
  'مرتجع مبيعات انستغرام',
  'مرتجع مبيعات متجر الكتروني',
  // عمان
  'مرتجع مبيعات انستغرام',

];

/** فاتورة بضاعة تالفة — تظهر في الملاحظة "إتلاف N" */
const DAMAGED_TYPES = ['فاتورة بضاعة تالفة'];

/** بيان يستثني فاتورة إدخال من "كمية الإدخال" حتى لو نوعها ضمن REAL_INPUT_TYPES */
const DAMAGED_DESC = 'بضاعة تالفة غير قابلة للإصلاح';

/** فاتورة الإخراج العادية — تظهر في الملاحظة "تخريج N" (ما عدا حالة IGNORED_COMBOS أدناه) */
const TRANSFER_TYPES = ['فاتورة الإخراج',
  'فاتورة تحويل الى المستودع',
  'فاتورة تحويل الى الفروع',
  'فاتورة مبيعات مستودع أحذية',
  'فاتورة مبيعات مستودع الشنط',
  'اخراج مواد من مستودع أحذية',
  'اخراج مواد من مستودع الشنط',
  'فاتورة مرتجع مشتريات',
  // عمان
  'إخراج مواد',
  'فاتورة تحويل من ادارة عمان',
  'فاتورة مرتجع مشتريات عمان',
  'اخراج مواد من المتجر الالكتروني',
  'اخراج مواد من مستودع',
];

/** فواتير تُتجاهل كلياً — تحتاج تطابق النوع والبيان معاً */
const IGNORED_COMBOS = [
  { billType: 'فاتورة الإخراج', billDescription: 'خربان تم الارسال الى المستودع' },
];

/** فواتير تُعامَل تماماً مثل تسوية موجبة (تُقرأ من inputQuantity) */
const ADJUSTMENT_POSITIVE_TYPES = [
  'فاتورة تسوية موجبة',
  'فاتورة إدخال مواد مستودعية',
];

/** فواتير تُعامَل تماماً مثل تسوية سالبة (تُقرأ من outputQuantity) */
const ADJUSTMENT_NEGATIVE_TYPES = [
  'فاتورة تسوية سالبة',
  'فاتورة إخراج مواد مستودعية',
];

/** فواتير تُتجاهل كلياً بمجرد تطابق النوع — بلا حاجة لتطابق البيان */
const FULLY_IGNORED_TYPES = [
  'مناقلة',
  // عمان
  'مناقلة أحذية',
];

// ── دوال التصنيف ─────────────────────────────────────────────────────────────

/** صف يُتجاهل كلياً */
function isIgnored(row) {
  return (
    typeIn(row.billType, FULLY_IGNORED_TYPES) ||
    IGNORED_COMBOS.some(c =>
      typeEquals(row.billType, c.billType) && row.billDescription === c.billDescription
    )
  );
}

function isInput(row) {
  return row.inputQuantity > 0 && typeIn(row.billType, REAL_INPUT_TYPES);
}

function isSale(row) {
  return typeIn(row.billType, SALE_TYPES) && row.outputQuantity > 0;
}

/** إدخال حقيقي — النوع ضمن REAL_INPUT_TYPES، ويستثني بيان البضاعة التالفة */
function isRealInput(row) {
  return (
    row.inputQuantity > 0 &&
    typeIn(row.billType, REAL_INPUT_TYPES) &&
    row.billDescription !== DAMAGED_DESC
  );
}

// ── دالة التحليل 1 — أول إدخال ───────────────────────────────────────────────

function getFirstInput(branchRows) {
  const inputDates = branchRows
    .filter(isInput)
    .map(r => r.billDate);

  if (!inputDates.length) return null;

  return inputDates.reduce((earliest, date) =>
    date < earliest ? date : earliest
  );
}

// ── دالة التحليل 2 — الرصيد الحالي ──────────────────────────────────────────

function getCurrentBalance(branchRows) {
  // const lastPerVariant = new Map();
  // for (const row of branchRows) {
  //   lastPerVariant.set(row.color + '|' + row.size, row);
  // }

  // let total = 0;
  // for (const row of lastPerVariant.values()) {
  //   total += (row.balance ?? 0);
  // }
  let total = 0;
  for (const row of branchRows) {
    total += (row.inputQuantity ?? 0) - (row.outputQuantity ?? 0);
  }
  return total;
}

// ── دالة الضريبة ─────────────────────────────────────────────────────────────

function addTax(price, taxRate) {
  const result = (price * taxRate).toFixed(1);
  return result.endsWith(".0") ? result.slice(0, -2) : result;
}

// return Math.round(price * taxRate);

// ── دالة التحليل 3 — المبيعات ────────────────────────────────────────────────

function getSalesAnalysis(branchRows, taxRate = 1.05) {
  const saleRows = branchRows.filter(isSale);

  const priceMap = new Map();

  for (const row of saleRows) {
    const price = row.outputPrice;
    const qty = row.outputQuantity;
    const date = row.billDate;

    if (!priceMap.has(price)) {
      priceMap.set(price, { numSales: 0, dateLastSale: date });
    }

    const entry = priceMap.get(price);
    entry.numSales += qty;
    if (date > entry.dateLastSale) entry.dateLastSale = date;
  }

  const sales = [...priceMap.entries()].map(([price, data]) => ({
    price,
    priceWithTax: addTax(price, taxRate),
    numSales: data.numSales,
    dateLastSale: data.dateLastSale,
  }));

  const totalSales = sales.reduce((sum, s) => sum + s.numSales, 0);

  return { totalSales, sales };
}

// ── دالة التحليل 4 — الملاحظات ───────────────────────────────────────────────

function getBranchNotes(branchRows) {
  let returns = 0;
  let damaged = 0;
  let transfer = 0;
  let adjustmentPositive = 0;
  let adjustmentNegative = 0;

  for (const row of branchRows) {
    if (isIgnored(row)) {
      console.log('IGNORED:', row.billType, row.billDescription);
      continue;
    }

    if (typeIn(row.billType, SALE_RETURN_TYPES) && row.inputQuantity > 0) {
      console.log('RETURN +', row.inputQuantity, row.billType);
      returns += row.inputQuantity;
    } else if (typeIn(row.billType, DAMAGED_TYPES) && row.outputQuantity > 0) {
      console.log('DAMAGED +', row.outputQuantity, row.billType);
      damaged += row.outputQuantity;
    } else if (typeIn(row.billType, TRANSFER_TYPES) && row.outputQuantity > 0) {
      console.log('TRANSFER +', row.outputQuantity, row.billType);
      transfer += row.outputQuantity;
    } else if (typeIn(row.billType, ADJUSTMENT_POSITIVE_TYPES) && row.inputQuantity > 0) {
      console.log('ADJUSTMENT + (positive/warehouse-in) +', row.inputQuantity, row.billType);
      adjustmentPositive += row.inputQuantity;
    } else if (typeIn(row.billType, ADJUSTMENT_NEGATIVE_TYPES) && row.outputQuantity > 0) {
      console.log('ADJUSTMENT - (negative/warehouse-out) +', row.outputQuantity, row.billType);
      adjustmentNegative += row.outputQuantity;
    }
  }

  const adjustmentNet = adjustmentPositive - adjustmentNegative;

  console.log(
    'NOTES RESULT → returns:', returns,
    '| damaged:', damaged,
    '| transfer:', transfer,
    '| adjustmentNet:', adjustmentNet
  );

  const parts = [];
  if (returns > 0) parts.push(`مرتجع ${returns}`);
  if (damaged > 0) parts.push(`إتلاف ${damaged}`);
  if (transfer > 0) parts.push(`تخريج ${transfer}`);
  if (adjustmentNet > 0) parts.push(`تسوية +${adjustmentNet}`);
  else if (adjustmentNet < 0) parts.push(`تسوية ${adjustmentNet}`);

  return parts.length ? `(${parts.join(' + ')})` : '';
}