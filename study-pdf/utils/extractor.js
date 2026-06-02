const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const axios = require('axios');
const { USER_AGENT } = require('./scraper');

const MAX_IMAGES = 30;
const MAX_TEXT_LENGTH = 50000;

async function extractContent(html, sourceUrl) {
  // Readability용 DOM (파싱 중 수정되므로 별도 인스턴스 사용)
  const readerDom = new JSDOM(html, { url: sourceUrl });
  const reader = new Readability(readerDom.window.document);
  const article = reader.parse();

  // 메타 정보 추출용 DOM
  const metaDom = new JSDOM(html, { url: sourceUrl });
  const doc = metaDom.window.document;

  let title = '';
  let author = '';
  let publishedDate = '';
  let contentHtml = '';

  title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')
    || doc.querySelector('meta[name="title"]')?.getAttribute('content')
    || doc.title
    || '';

  author = doc.querySelector('meta[name="author"]')?.getAttribute('content')
    || doc.querySelector('meta[property="article:author"]')?.getAttribute('content')
    || '';

  publishedDate = doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content')
    || doc.querySelector('meta[name="date"]')?.getAttribute('content')
    || doc.querySelector('time[datetime]')?.getAttribute('datetime')
    || '';

  if (article && article.textContent && article.textContent.trim().length > 200) {
    title = article.title || title;
    author = article.byline || author;
    contentHtml = article.content;
  } else {
    // 폴백: article → main → 가장 긴 텍스트 블록
    const fallbackSelectors = [
      'article', 'main', '[role="main"]',
      '.post-content', '.entry-content', '.article-content',
      '.content', '#content', '#main',
    ];

    for (const selector of fallbackSelectors) {
      const el = doc.querySelector(selector);
      if (el && el.textContent.trim().length > 200) {
        contentHtml = el.innerHTML;
        break;
      }
    }

    if (!contentHtml) {
      const paragraphs = Array.from(doc.querySelectorAll('p'));
      const totalText = paragraphs.reduce((s, p) => s + p.textContent, '');
      if (totalText.trim().length > 200) {
        contentHtml = paragraphs.map(p => p.outerHTML).join('\n');
      }
    }

    if (!contentHtml) {
      throw new Error('읽을 수 있는 본문을 찾지 못했습니다.');
    }
  }

  // 글자 수 제한
  const textOnly = contentHtml.replace(/<[^>]+>/g, '');
  if (textOnly.length > MAX_TEXT_LENGTH) {
    throw new Error('본문이 너무 깁니다. 더 짧은 페이지를 시도해 주세요.');
  }

  // 이미지 처리: 다운로드 후 base64 임베드
  const tempDom = new JSDOM(contentHtml, { url: sourceUrl });
  const imgTags = Array.from(tempDom.window.document.querySelectorAll('img')).slice(0, MAX_IMAGES);

  await Promise.allSettled(
    imgTags.map(async (img) => {
      let src = img.getAttribute('src')
        || img.getAttribute('data-src')
        || img.getAttribute('data-lazy-src')
        || (img.getAttribute('srcset') || '').split(/[\s,]+/)[0]
        || '';

      if (!src || src.startsWith('data:')) return;

      try {
        src = new URL(src, sourceUrl).href;
        const res = await axios.get(src, {
          responseType: 'arraybuffer',
          timeout: 8000,
          maxContentLength: 5 * 1024 * 1024,
          headers: { 'Referer': sourceUrl, 'User-Agent': USER_AGENT },
        });

        const ct = (res.headers['content-type'] || 'image/jpeg').split(';')[0];
        const b64 = Buffer.from(res.data).toString('base64');
        img.setAttribute('src', `data:${ct};base64,${b64}`);
        img.removeAttribute('srcset');
        img.removeAttribute('data-src');
      } catch {
        img.remove();
      }
    })
  );

  contentHtml = tempDom.window.document.body.innerHTML;
  const previewText = tempDom.window.document.body.textContent.trim().slice(0, 500);

  return {
    title: cleanText(title),
    author: cleanText(author),
    publishedDate,
    sourceUrl,
    contentHtml,
    previewText,
  };
}

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

module.exports = { extractContent };
