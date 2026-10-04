"""
Browser tool implementations using Playwright.
Each tool is called by the agent via Gemini function calling.
"""
import asyncio
import json
from playwright.async_api import async_playwright, Page, Browser


_browser: Browser | None = None
_page: Page | None = None
_playwright = None


async def get_page() -> Page:
    """Get or create a shared browser page."""
    global _browser, _page, _playwright
    if _page is None or _page.is_closed():
        _playwright = await async_playwright().start()
        _browser = await _playwright.chromium.launch(headless=True)
        _page = await _browser.new_page()
    return _page


async def close_browser():
    """Cleanup browser resources."""
    global _browser, _page, _playwright
    if _page and not _page.is_closed():
        await _page.close()
    if _browser:
        await _browser.close()
    if _playwright:
        await _playwright.stop()
    _page = None
    _browser = None
    _playwright = None


async def navigate_to(url: str) -> dict:
    """Navigate to a URL and return page title."""
    page = await get_page()
    try:
        await page.goto(url, wait_until="networkidle", timeout=15000)
        title = await page.title()
        return {"success": True, "url": url, "title": title}
    except Exception as e:
        return {"success": False, "error": str(e), "url": url}


async def get_page_content(selector: str = "body") -> dict:
    """Extract text content from the page or a specific element."""
    page = await get_page()
    try:
        element = page.locator(selector).first
        text = await element.inner_text()
        return {"success": True, "content": text.strip()}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def click_element(selector: str) -> dict:
    """Click an element on the page."""
    page = await get_page()
    try:
        await page.locator(selector).first.click(timeout=5000)
        await page.wait_for_load_state("networkidle", timeout=5000)
        return {"success": True, "clicked": selector}
    except Exception as e:
        return {"success": False, "error": str(e), "selector": selector}


async def fill_field(selector: str, value: str) -> dict:
    """Fill an input field with a value."""
    page = await get_page()
    try:
        locator = page.locator(selector).first
        await locator.clear()
        await locator.fill(value)
        return {"success": True, "selector": selector, "value": value}
    except Exception as e:
        return {"success": False, "error": str(e), "selector": selector}


async def get_table_data(selector: str = "table") -> dict:
    """Extract data from an HTML table."""
    page = await get_page()
    try:
        table = page.locator(selector).first
        rows = await table.locator("tr").all()
        data = []
        for row in rows:
            cells = await row.locator("th, td").all_inner_texts()
            if cells:
                data.append(cells)
        return {"success": True, "rows": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def get_element_text(selector: str) -> dict:
    """Get text of a specific element."""
    page = await get_page()
    try:
        text = await page.locator(selector).first.inner_text(timeout=5000)
        return {"success": True, "text": text.strip()}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def screenshot(path: str = "screenshot.png") -> dict:
    """Take a screenshot of the current page."""
    page = await get_page()
    try:
        await page.screenshot(path=path)
        return {"success": True, "path": path}
    except Exception as e:
        return {"success": False, "error": str(e)}
