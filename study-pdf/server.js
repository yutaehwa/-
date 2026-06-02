const express = require('express');
const path = require('path');
const fs = require('fs');
const { validateUrl } = require('./utils/urlValidator');
const { fetchHtml } = require('./utils/scraper');
const { extractContent } = require('./utils/extractor');
const { generatePdf } = require('./utils/pdfGenerator');

const app = express();
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'temp');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 간단한 IP 기반 일일 횟수 제한
const rateLimits = new Map();
const DAILY_LIMIT = 5;

function checkRateLimit(ip) {
  const key = `${ip}:${new Date().toDateString()}`;
  const count = (rateLimits.get(key) || 0) + 1;
  rateLimits.set(key, count);
  return count <= DAILY_LIMIT;
}

// 오래된 항목 정리 (1시간마다)
setInterval(() => {
  const today = new Date().toDateString();
  for (const key of rateLimits.keys()) {
    if (!key.endsWith(today)) rateLimits.delete(key);
  }
}, 3_600_000);

// 1시간 후 임시 파일 삭제
function scheduleCleanup(filepath) {
  setTimeout(() => fs.unlink(filepath, () => {}), 3_600_000);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// POST /api/convert
app.post('/api/convert', async (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || '0.0.0.0';

  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: '오늘 무료 변환 횟수(5회)를 모두 사용하셨습니다. 내일 다시 시도해 주세요.',
    });
  }

  const { url: rawUrl } = req.body;
  const validation = validateUrl(rawUrl);

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const url = validation.url;

  // 30초 타임아웃
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: '처리 시간이 초과되었습니다. 다시 시도해 주세요.' });
    }
  }, 30_000);

  try {
    const html = await fetchHtml(url);
    const content = await extractContent(html, url);
    const { pdfBuffer, filename } = await generatePdf(content);

    const fileId = generateId();
    const filepath = path.join(TEMP_DIR, `${fileId}.pdf`);
    fs.writeFileSync(filepath, pdfBuffer);
    scheduleCleanup(filepath);

    clearTimeout(timeout);

    if (!res.headersSent) {
      res.json({
        success: true,
        fileId,
        filename,
        title: content.title,
        preview: content.previewText,
      });
    }
  } catch (err) {
    clearTimeout(timeout);
    if (res.headersSent) return;

    console.error('[convert error]', err.message);

    let error = 'PDF 생성 중 문제가 발생했습니다. 다시 시도해 주세요.';
    if (/ENOTFOUND|ECONNREFUSED|접속할 수 없/.test(err.message)) {
      error = '해당 사이트에 접속할 수 없습니다.';
    } else if (/본문|읽을 수 없/.test(err.message)) {
      error = err.message;
    } else if (/차단|forbidden|403/i.test(err.message)) {
      error = '해당 사이트에서 접근을 차단하고 있습니다.';
    } else if (/찾을 수 없|404/.test(err.message)) {
      error = '해당 페이지를 찾을 수 없습니다.';
    } else if (/너무 깁니다/.test(err.message)) {
      error = err.message;
    }

    res.status(500).json({ error });
  }
});

// GET /api/download/:fileId
app.get('/api/download/:fileId', (req, res) => {
  const { fileId } = req.params;

  if (!/^[a-z0-9]+$/i.test(fileId)) {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  const filepath = path.join(TEMP_DIR, `${fileId}.pdf`);

  if (!filepath.startsWith(TEMP_DIR)) {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: '파일을 찾을 수 없습니다. 다시 변환해 주세요.' });
  }

  res.download(filepath);
});

app.listen(PORT, () => {
  console.log(`\n웹페이지 PDF 변환기 실행 중`);
  console.log(`→ http://localhost:${PORT}\n`);
});
