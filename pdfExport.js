/**
 * pdfExport.js
 * ميزة "تصدير PDF" — تعمل بالكامل من المتصفح (html2canvas + jsPDF)، بدون أي سيرفر.
 *
 * الفكرة العامة:
 * 1) نلتقط شاشة "جدول" (#flatTableWrap) بالكامل بصورة واحدة عالية الدقة (canvas واحد كبير).
 * 2) قبل الالتقاط، نقيس مواقع كل قسم مادة (.item-table-wrap) وكل صف جدول (tr) بداخله
 *    (بوحدة بكسل منطقي CSS px، نسبةً لأعلى الحاوية).
 * 3) بناءً على هذه القياسات نحسب أين يجب أن تقع فواصل الصفحات (بدون تقطيع أي قسم مادة
 *    إن أمكن، وبدون تقطيع أي صف جدول مطلقاً، مع تكرار ترويسة الجدول إذا امتدت المادة
 *    لأكثر من صفحة).
 * 4) نقصّ الصورة الكبيرة (canvas) حسب هذه الفواصل ونركّب كل صفحة PDF من القصاصات الصحيحة.
 */

// ── تحويلات الوحدات ──────────────────────────────────────────────────────────
const PX_PER_PT = 96 / 72; // نقطة PDF واحدة = 96/72 بكسل CSS منطقي (بافتراض 96dpi قياسي)

function ptToPx(pt) { return pt * PX_PER_PT; }
function pxToPt(px) { return px / PX_PER_PT; }

// ── انتظار تحميل الصور والخطوط قبل القياس/الالتقاط ───────────────────────────
function waitForImagesAndFonts(root) {
  const imgs = Array.from(root.querySelectorAll('img'));
  const imgPromises = imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  });
  const fontsPromise = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  return Promise.all([...imgPromises, fontsPromise]);
}

// ── قياس بنية قسم مادة واحد (.item-table-wrap) ───────────────────────────────
// نُرجع: حدود القسم كاملاً، حدود الترويسة (لإعادة رسمها عند التقسيم)،
// وقائمة "الكتل الذرية" بالترتيب (سطر ملاحظة علوي، ترويسة، كل صف جدول، سطر ملاحظة سفلي)
// — هذه الكتل هي وحدة التقسيم الأصغر التي لا يجوز تقطيعها.
function buildItemLayout(itemWrap, containerTop) {
  const table = itemWrap.querySelector('table.flat-table');
  const thead = table.querySelector('thead');
  const noteTop = itemWrap.querySelector('.note-top');
  const noteBottom = itemWrap.querySelector('.note-bottom');
  const bodyRows = Array.from(table.querySelectorAll('tbody tr'));

  const rel = (el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top - containerTop, bottom: r.bottom - containerTop };
  };

  const wrapRect = rel(itemWrap);
  const theadRect = rel(thead);

  const blocks = [];
  if (noteTop) blocks.push({ type: 'note-top', ...rel(noteTop) });
  blocks.push({ type: 'thead', ...theadRect });
  bodyRows.forEach(tr => blocks.push({ type: 'row', ...rel(tr) }));
  if (noteBottom) blocks.push({ type: 'note-bottom', ...rel(noteBottom) });

  return {
    top: wrapRect.top,
    bottom: wrapRect.bottom,
    height: wrapRect.bottom - wrapRect.top,
    theadRect,
    theadHeight: theadRect.bottom - theadRect.top,
    blocks,
  };
}

// ── خوارزمية توزيع الأقسام/الصفوف على صفحات PDF ──────────────────────────────
// تُرجع مصفوفة صفحات، كل صفحة = مصفوفة "أوامر قصّ" { sy, sh, repeatHeaderRect }
// بوحدة بكسل منطقي نسبةً لأعلى الحاوية.
function computePages(items, usableHeightPx) {
  const pages = [];
  let current = [];
  let cursor = 0; // المساحة المستخدمة من الصفحة الحالية (px منطقي)

  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
    cursor = 0;
  };

  for (const item of items) {
    // الحالة ١: القسم يدخل كاملاً ضمن صفحة واحدة
    if (item.height <= usableHeightPx) {
      if (cursor > 0 && item.height > usableHeightPx - cursor) flush();
      current.push({ sy: item.top, sh: item.height, repeatHeaderRect: null });
      cursor += item.height;
      continue;
    }

    // الحالة ٢: القسم أطول من صفحة كاملة → يمتد لعدة صفحات
    // بدون تقطيع أي صف جدول، مع تكرار الترويسة أعلى كل صفحة تكميلية
    if (cursor > 0) flush(); // نبدأ القسم الكبير في صفحة جديدة نظيفة

    const blocks = item.blocks;
    let idx = 0;
    let firstSlice = true;

    while (idx < blocks.length) {
      if (!firstSlice) flush(); // كل جزء تالٍ من نفس القسم يبدأ صفحة جديدة

      const repeatHeaderRect = firstSlice ? null : item.theadRect;
      const headerH = repeatHeaderRect ? item.theadHeight : 0;
      const budget = usableHeightPx - headerH;

      let sliceStart = blocks[idx].top;
      let sliceEnd = sliceStart;
      let used = 0;
      let j = idx;

      while (j < blocks.length) {
        const bh = blocks[j].bottom - blocks[j].top;
        if (used > 0 && used + bh > budget) break;
        sliceEnd = blocks[j].bottom;
        used += bh;
        j++;
      }

      // حالة نادرة: صف واحد أطول من صفحة كاملة بمفرده — نعرضه كاملاً بدل تقطيعه
      if (j === idx) {
        sliceEnd = blocks[idx].bottom;
        used = blocks[idx].bottom - blocks[idx].top;
        j = idx + 1;
      }

      current.push({ sy: sliceStart, sh: sliceEnd - sliceStart, repeatHeaderRect });
      cursor = used + headerH;
      idx = j;
      firstSlice = false;
    }
  }

  flush();
  return pages;
}

// ── بناء صفحات jsPDF من الصورة الكبيرة (bigCanvas) حسب خطة التقسيم ───────────
function buildPdfFromPages(bigCanvas, pages, scale, contentWidthPx, contentWidthPt, marginPt, pageWidthPt, pageHeightPt) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    unit: 'pt',
    format: [pageWidthPt, pageHeightPt],
    orientation: pageWidthPt > pageHeightPt ? 'landscape' : 'portrait',
  });

  pages.forEach((pageSlices, pageIndex) => {
    if (pageIndex > 0) doc.addPage();

    let totalLogicalH = 0;
    pageSlices.forEach(s => {
      const headerH = s.repeatHeaderRect ? (s.repeatHeaderRect.bottom - s.repeatHeaderRect.top) : 0;
      totalLogicalH += headerH + s.sh;
    });

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = Math.ceil(contentWidthPx * scale);
    pageCanvas.height = Math.max(1, Math.ceil(totalLogicalH * scale));
    const ctx = pageCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    let destY = 0;
    pageSlices.forEach(s => {
      if (s.repeatHeaderRect) {
        const hh = s.repeatHeaderRect.bottom - s.repeatHeaderRect.top;
        ctx.drawImage(
          bigCanvas,
          0, Math.round(s.repeatHeaderRect.top * scale), pageCanvas.width, Math.round(hh * scale),
          0, Math.round(destY * scale), pageCanvas.width, Math.round(hh * scale)
        );
        destY += hh;
      }
      ctx.drawImage(
        bigCanvas,
        0, Math.round(s.sy * scale), pageCanvas.width, Math.round(s.sh * scale),
        0, Math.round(destY * scale), pageCanvas.width, Math.round(s.sh * scale)
      );
      destY += s.sh;
    });

    const imgData = pageCanvas.toDataURL('image/png');
    const imgHeightPt = pxToPt(totalLogicalH);
    doc.addImage(imgData, 'PNG', marginPt, marginPt, contentWidthPt, imgHeightPt);
  });

  return doc;
}

// ── الدالة الرئيسية: تُستدعى عند الضغط على زر "تصدير PDF" ────────────────────
async function exportReportToPdf() {
  const btn = document.getElementById('btnPdf');
  const container = document.getElementById('flatTableWrap');

  if (!container || !container.children.length) {
    alert('لا يوجد تقرير لتصديره. شغّل التحليل أولاً من شاشة الإدخال.');
    return;
  }
  if (btn.disabled) return;

  const originalLabel = btn.textContent;

  btn.disabled = true;
  btn.textContent = '... جارٍ التصدير';

  const MARGIN_PT = 36; // هامش الصفحة (≈ 1.27 سم من كل جهة)
  const PAGE_HEIGHT_PT = 841.89; // ارتفاع صفحة A4 القياسي — العرض يُحسب تلقائياً حسب عرض التقرير الفعلي
  const MAX_CANVAS_DIM_PX = 14000; // حد أمان لتفادي تجاوز أقصى حجم Canvas في المتصفح

  try {
    // نتأكد أن شاشة "جدول" هي المعروضة فعلياً (هي مصدر التقرير)
    if (activeView !== 'table') {
      document.querySelector('.view-btn[data-view="table"]')?.click();
    }

    // يفعّل هذا الصنف قواعد CSS التي تُلغي أي تمرير/تحديد عرض على الجدول
    // (انظر index.html) بحيث يظهر التقرير بعرضه الطبيعي الكامل بدل أن يُقتَطع
    document.body.classList.add('pdf-export-mode');

    await waitForImagesAndFonts(container);
    void container.offsetHeight; // إجبار إعادة التخطيط بعد إلغاء قيود العرض

    // العرض الطبيعي الكامل للتقرير بعد إلغاء أي تمرير أفقي
    const actualWidthPx = Math.max(container.scrollWidth, container.getBoundingClientRect().width);
    const contentWidthPt = pxToPt(actualWidthPx);
    const pageWidthPt = contentWidthPt + MARGIN_PT * 2;

    const contentHeightPt = PAGE_HEIGHT_PT - MARGIN_PT * 2;
    const usableHeightPx = ptToPx(contentHeightPt);

    const containerTop = container.getBoundingClientRect().top;
    const itemWraps = Array.from(container.querySelectorAll(':scope > .item-table-wrap'));
    if (!itemWraps.length) {
      throw new Error('لم يتم العثور على أي قسم مادة (.item-table-wrap) للتصدير');
    }

    const items = itemWraps.map(w => buildItemLayout(w, containerTop));
    const pages = computePages(items, usableHeightPx);

    // تقليل جودة الالتقاط تلقائياً إذا كان التقرير طويلاً/عريضاً جداً، لتفادي تعطّل المتصفح
    let scale = 2;
    const projectedHeightPx = container.scrollHeight * scale;
    const projectedWidthPx = actualWidthPx * scale;
    if (projectedHeightPx > MAX_CANVAS_DIM_PX || projectedWidthPx > MAX_CANVAS_DIM_PX) {
      const limitByHeight = MAX_CANVAS_DIM_PX / container.scrollHeight;
      const limitByWidth = MAX_CANVAS_DIM_PX / actualWidthPx;
      scale = Math.max(1, Math.floor(Math.min(limitByHeight, limitByWidth)));
      console.warn(`تصدير PDF: تم تقليل الدقة إلى scale=${scale} بسبب حجم التقرير.`);
    }

    const bigCanvas = await html2canvas(container, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });

    const pdf = buildPdfFromPages(
      bigCanvas, pages, scale, actualWidthPx, contentWidthPt, MARGIN_PT, pageWidthPt, PAGE_HEIGHT_PT
    );
    pdf.save('تقرير_المبيعات.pdf');

  } catch (err) {
    console.error('PDF export failed:', err);
    alert('حدث خطأ أثناء تصدير PDF:\n' + err.message);
  } finally {
    document.body.classList.remove('pdf-export-mode');
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

document.getElementById('btnPdf').addEventListener('click', exportReportToPdf);