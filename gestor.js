import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  executablePath: process.env.CHROME_PATH || undefined,
});

const page = await browser.newPage();
await page.goto('https://example.com');
console.log('✅ Página cargada con éxito');
await browser.close();
