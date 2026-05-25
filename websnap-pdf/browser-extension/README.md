# WebSnap PDF — Chrome Extension

## 설치 방법

1. `browser-extension/` 폴더를 로컬에 다운로드
2. Chrome 주소창에 `chrome://extensions` 입력
3. 우상단 **개발자 모드** 활성화
4. **"압축해제된 확장 프로그램을 로드합니다"** 클릭 → `browser-extension/` 폴더 선택

## 사용 방법

1. 대시보드(`/dashboard`)에서 API 키 발급
2. 확장 팝업에 API 키 입력 (자동 저장)
3. 원하는 웹 페이지에서 확장 아이콘 클릭 → **PDF로 저장**

## 배포 전 수정 사항

`popup.js` 상단의 `API_BASE` 값을 실제 도메인으로 변경하세요:

```js
const API_BASE = 'https://your-domain.com'  // ← 실제 도메인으로 변경
```
