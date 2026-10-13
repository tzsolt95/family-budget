// Turns a PDF into text rows: one row per visual line, items sorted left to right.
// The pdf.js library is passed in so the same code runs in the browser and in Node.

export async function extractRows(pdfjsLib, data) {
  const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const byY = new Map();
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push({ x: Math.round(item.transform[4]), s: item.str.trim() });
    }
    const rows = [...byY.keys()]
      .sort((a, b) => b - a) // PDF y grows upwards, so top of the page first
      .map((y) => ({ y, items: byY.get(y).sort((a, b) => a.x - b.x) }));
    pages.push(rows);
  }
  await doc.destroy();
  return pages;
}
