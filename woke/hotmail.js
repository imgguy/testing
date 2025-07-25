const puppeteer = require('puppeteer-extra'); 
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;

puppeteer.use(StealthPlugin());

const EMAIL_LIST = 'emails.txt';
const REGISTERED_OUTPUT = 'registered_hotemails.txt';
const NOT_REGISTERED_OUTPUT = 'not_registered_hotemails.txt';
const RESULTS_OUTPUT = 'results.txt';

const HOTMAIL_URL = 'https://signup.live.com/signup?sru=https%3a%2f%2flogin.live.com%2foauth20_authorize.srf%3flc%3d1033%26client_id%3dd7b530a4-7680-4c23-a8bf-c52c121d2e87%26mkt%3dEN-US%26opid%3dB8126E4470133315%26opidt%3d1752859724%26uaid%3d759729461e9545a9ba4ca66481c46267%26contextid%3dF9D083932C3BA84E%26opignore%3d1&mkt=EN-US&uiflavor=web&lw=1&fl=easi2&client_id=d7b530a4-7680-4c23-a8bf-c52c121d2e87&uaid=759729461e9545a9ba4ca66481c46267&suc=d7b530a4-7680-4c23-a8bf-c52c121d2e87&fluent=2&lic=1';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const emails = (await fs.readFile(EMAIL_LIST, 'utf-8'))
    .split('\n')
    .map(e => e.trim())
    .filter(Boolean);

  for (const email of emails) {
    try {
      console.log(Checking: ${email});
      await page.goto(HOTMAIL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

      await page.waitForSelector('#floatingLabelInput5', { timeout: 15000 });
      await page.evaluate(() => {
        const input = document.querySelector('#floatingLabelInput5');
        if (input) input.value = '';
      });

      await page.type('#floatingLabelInput5', email, { delay: 50 });

      await page.waitForSelector('button[data-testid="primaryButton"]', { timeout: 15000 });
      await page.click('button[data-testid="primaryButton"]');

      await delay(3000);

      const errorText = await page.evaluate(() => {
        const errorElem = document.querySelector('[id*="validationMessage"]');
        return errorElem ? errorElem.innerText.toLowerCase() : '';
      });

      let status = '';

      if (errorText.includes('already') || errorText.includes('exists')) {
        console.log(✅ Registered: ${email});
        status = 'REGISTERED';
        await fs.appendFile(REGISTERED_OUTPUT, email + '\n');
      } else {
        console.log(❌ Not registered: ${email});
        status = 'NOT REGISTERED';
        await fs.appendFile(NOT_REGISTERED_OUTPUT, email + '\n');
      }

      await fs.appendFile(RESULTS_OUTPUT, ${email} - ${status}\n);

    } catch (err) {
      console.error(⚠️ Error checking ${email}: ${err.message});
      await fs.appendFile(RESULTS_OUTPUT, ${email} - ERROR: ${err.message}\n);
    }
  }

  await browser.close();
})();
