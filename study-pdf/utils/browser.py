import os

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Users\user\AppData\Local\Google\Chrome\Application\chrome.exe",
    r"C:\Users\user\AppData\Local\Chromium\Application\chrome.exe",
]


def get_chrome_executable() -> str | None:
    for path in CHROME_PATHS:
        if os.path.exists(path):
            return path
    return None


CHROME_EXE = get_chrome_executable()

LAUNCH_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--font-render-hinting=none",
    "--ignore-certificate-errors",
    "--ignore-ssl-errors",
]
