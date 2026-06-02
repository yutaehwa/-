const puppeteer = require('puppeteer');

function buildHtmlTemplate({ title, author, publishedDate, sourceUrl, contentHtml }) {
  const savedDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const safeTitle = escHtml(title || '제목 없음');
  const safeAuthor = escHtml(author || '');
  const safeDate = escHtml(formatDate(publishedDate));
  const safeUrl = escHtml(sourceUrl || '');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: "Noto Sans KR", "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif;
      font-size: 11pt;
      line-height: 1.8;
      color: #222;
      background: #fff;
    }

    .cover {
      padding-bottom: 24px;
      border-bottom: 2px solid #333;
      margin-bottom: 28px;
    }

    .cover-title {
      font-size: 22pt;
      font-weight: 700;
      line-height: 1.4;
      margin-bottom: 14px;
      color: #111;
      word-break: keep-all;
    }

    .cover-meta {
      font-size: 9pt;
      color: #666;
      line-height: 2;
    }

    .cover-meta a {
      color: #2563eb;
      text-decoration: none;
      word-break: break-all;
    }

    .content h1, .content h2, .content h3, .content h4, .content h5 {
      margin-top: 22px;
      margin-bottom: 10px;
      font-weight: 700;
      line-height: 1.4;
      word-break: keep-all;
    }

    .content h1 { font-size: 18pt; }
    .content h2 { font-size: 15pt; }
    .content h3 { font-size: 13pt; }
    .content h4, .content h5 { font-size: 11pt; }

    .content p {
      margin-bottom: 12px;
      word-break: keep-all;
      overflow-wrap: break-word;
    }

    .content img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 16px auto;
      page-break-inside: avoid;
    }

    .content figure {
      margin: 16px 0;
      page-break-inside: avoid;
    }

    .content figcaption {
      font-size: 9pt;
      color: #666;
      text-align: center;
      margin-top: 4px;
    }

    .content ul, .content ol {
      margin: 10px 0 10px 24px;
    }

    .content li {
      margin-bottom: 6px;
    }

    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }

    .content th, .content td {
      border: 1px solid #ccc;
      padding: 8px 10px;
      text-align: left;
      word-break: keep-all;
    }

    .content th {
      background: #f0f0f0;
      font-weight: 700;
    }

    .content blockquote {
      border-left: 3px solid #aaa;
      padding: 8px 14px;
      margin: 14px 0;
      color: #555;
    }

    .content pre {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 9pt;
      margin: 12px 0;
      page-break-inside: avoid;
    }

    .content code {
      background: #f5f5f5;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 9pt;
      font-family: "Courier New", monospace;
    }

    .content a {
      color: #2563eb;
    }

    .footer {
      border-top: 1px solid #ddd;
      padding-top: 14px;
      margin-top: 40px;
      font-size: 8pt;
      color: #999;
      line-height: 1.8;
    }

    @page {
      size: A4;
      margin: 20mm;
      @bottom-center {
        content: counter(page);
        font-size: 9pt;
        color: #999;
      }
    }

    @media print {
      h1, h2, h3 { page-break-after: avoid; }
      img, figure, table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <div class="cover-title">${safeTitle}</div>
    <div class="cover-meta">
      ${safeAuthor ? `<div>작성자: ${safeAuthor}</div>` : ''}
      ${safeDate ? `<div>작성일: ${safeDate}</div>` : ''}
      <div>출처: <a href="${safeUrl}">${safeUrl}</a></div>
    </div>
  </div>

  <div class="content">
    ${contentHtml}
  </div>

  <div class="footer">
    <div>저장일: ${savedDate} · 개인 학습 및 보관 목적으로 저장된 문서입니다.</div>
  </div>
</body>
</html>`;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function sanitizeFilename(title) {
  const today = new Date().toISOString().slice(0, 10);
  const safe = (title || '문서')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
  return `${safe || '문서'}_${today}.pdf`;
}

async function generatePdf(content) {
  const html = buildHtmlTemplate(content);
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="font-size:9pt;color:#999;width:100%;text-align:center;padding:0 20mm;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>`,
      margin: { top: '20mm', right: '20mm', bottom: '25mm', left: '20mm' },
    });

    const filename = sanitizeFilename(content.title);
    return { pdfBuffer, filename };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { generatePdf };
