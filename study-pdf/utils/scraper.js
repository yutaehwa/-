const axios = require('axios');
const puppeteer = require('puppeteer');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchHtml(url) {
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' },
      maxContentLength: 10 * 1024 * 1024,
    });

    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('text/html')) {
      throw new Error('HTML 페이지가 아닙니다.');
    }

    return response.data;
  } catch (err) {
    if (err.message === 'HTML 페이지가 아닙니다.') throw err;
    if (err.response?.status === 404) throw new Error('해당 페이지를 찾을 수 없습니다.');
    if (err.response?.status === 403 || err.response?.status === 401) {
      throw new Error('해당 사이트에서 접근을 차단하고 있습니다.');
    }

    // 동적 렌더링 폴백
    console.log('[scraper] 정적 요청 실패, 동적 렌더링 시도:', err.message);
    return await fetchWithPuppeteer(url);
  }
}

async function fetchWithPuppeteer(url) {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ko-KR,ko;q=0.9' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    return await page.content();
  } catch (err) {
    throw new Error('해당 사이트에 접속할 수 없습니다.');
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { fetchHtml, USER_AGENT };
