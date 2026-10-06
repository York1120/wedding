const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({
    viewport: { width: 2200, height: 2000 },
    deviceScaleFactor: 1,
  });
  await page.goto('file://' + path.resolve(__dirname, 'poster.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: process.argv[2] || 'poster.png' });
  await browser.close();
  console.log('rendered:', process.argv[2] || 'poster.png');
})();
