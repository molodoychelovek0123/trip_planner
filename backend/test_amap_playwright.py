import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        # Beijing Railway Station to Tiananmen
        await page.goto("https://amap.com/dir?from[name]=北京站&from[lnglat]=116.427287,39.903697&to[name]=天安门&to[lnglat]=116.397451,39.909187&type=bus", wait_until="networkidle")
        
        # Wait for the routes to load
        await page.wait_for_selector('.planTitle', timeout=10000)
        
        # Extract the first route summary
        routes = await page.query_selector_all('.planTitle')
        for route in routes:
            text = await route.inner_text()
            print("Found route:", text.replace('\n', ' '))
            
        await browser.close()

asyncio.run(main())
