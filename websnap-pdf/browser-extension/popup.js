const API_BASE = 'https://your-domain.com'
const STORAGE_KEY = 'websnap_api_key'

const urlEl = document.getElementById('current-url')
const convertBtn = document.getElementById('convert-btn')
const statusEl = document.getElementById('status')
const apiKeyInput = document.getElementById('api-key')
const formatSelect = document.getElementById('format')
const orientationSelect = document.getElementById('orientation')

let currentUrl = ''

// Load saved API key
chrome.storage.local.get([STORAGE_KEY], (result) => {
  if (result[STORAGE_KEY]) {
    apiKeyInput.value = result[STORAGE_KEY]
  }
})

// Get current tab URL
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0]
  if (tab?.url) {
    currentUrl = tab.url
    urlEl.textContent = currentUrl
  } else {
    urlEl.textContent = 'URL을 가져올 수 없습니다.'
    convertBtn.disabled = true
  }
})

apiKeyInput.addEventListener('change', () => {
  chrome.storage.local.set({ [STORAGE_KEY]: apiKeyInput.value.trim() })
})

convertBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim()
  if (!apiKey) {
    showStatus('error', 'API 키를 입력해 주세요. 대시보드에서 발급할 수 있습니다.')
    return
  }
  if (!currentUrl) {
    showStatus('error', '현재 탭의 URL을 가져올 수 없습니다.')
    return
  }

  setLoading(true)
  clearStatus()

  try {
    const res = await fetch(`${API_BASE}/api/v1/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: currentUrl,
        options: {
          format: formatSelect.value,
          orientation: orientationSelect.value,
        },
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `오류 (HTTP ${res.status})`)
    }

    const blob = await res.blob()
    const fileName = decodeURIComponent(
      res.headers.get('X-Title') || 'websnap-page'
    ) + '.pdf'

    // Trigger download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)

    showStatus('success', `PDF 저장 완료: ${fileName}`)
  } catch (err) {
    showStatus('error', err.message || '변환 중 오류가 발생했습니다.')
  } finally {
    setLoading(false)
  }
})

function setLoading(on) {
  convertBtn.disabled = on
  convertBtn.innerHTML = on
    ? '<div class="spinner"></div> 변환 중...'
    : `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg> PDF로 저장`
}

function showStatus(type, msg) {
  statusEl.className = `status ${type}`
  statusEl.textContent = msg
}

function clearStatus() {
  statusEl.className = 'status'
  statusEl.textContent = ''
}
