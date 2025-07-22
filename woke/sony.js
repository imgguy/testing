const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;

puppeteer.use(StealthPlugin());

const EMAIL_LIST = 'emails.txt';
const REGISTERED_OUTPUT = 'registered_emails.txt';
const PASSWORD = 'QWer12435@';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function humanType(page, selector, text) {
  for (const char of text) {
    await page.type(selector, char);
    await delay(50 + Math.random() * 100);
  }
}

async function readEmails() {
  const data = await fs.readFile(EMAIL_LIST, 'utf-8');
  return data.split('\n').map(e => e.trim()).filter(e => e.length > 0);
}

async function saveRegisteredEmail(email) {
  await fs.appendFile(REGISTERED_OUTPUT, email + '\n');
}

async function waitForCaptchaSolve(page) {
  while (true) {
    const isPuzzleVisible = await page.evaluate(() => {
      const el = document.querySelector('h2.heading.text');
      return el?.innerText.includes("Protecting your account") || false;
    });

    if (!isPuzzleVisible) break;
    console.log('⚠️ CAPTCHA DETECTED! Please solve it manually...');
    await delay(5000);
  }
}

async function safeClick(page, selector) {
  try {
    const el = await page.$(selector);
    if (!el) {
      console.log(`⚠️ Element not found for selector: ${selector}`);
      return false;
    }
    const box = await el.boundingBox();
    if (!box) {
      console.log(`⚠️ Element bounding box not found for selector: ${selector}`);
      return false;
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
    await delay(200 + Math.random() * 300);
    await el.click();
    return true;
  } catch (err) {
    console.log(`⚠️ Error in safeClick on ${selector}: ${err.message}`);
    return false;
  }
}

async function checkEmail(page, email) {
  try {
    await page.evaluate(() => {
      const emailInput = document.querySelector('input[name="email"]');
      if (emailInput) emailInput.value = '';
      const pwInputs = document.querySelectorAll('input[name="new-password"]');
      pwInputs.forEach(input => input.value = '');
    });

    const emailBox = await page.$('input[name="email"]');
    if (!emailBox) {
      console.log('⚠️ Email input box not found!');
      return false;
    }
    await emailBox.focus();
    await delay(200 + Math.random() * 300);
    await humanType(page, 'input[name="email"]', email);

    const pwInputs = await page.$$('input[name="new-password"]');
    if (pwInputs.length > 0) {
      await pwInputs[0].focus();
      await page.keyboard.type(PASSWORD, { delay: 100 });
    }
    if (pwInputs.length > 1) {
      await pwInputs[1].focus();
      await page.keyboard.type(PASSWORD, { delay: 100 });
    }

    await delay(500 + Math.random() * 800);

    const clickedNext = await safeClick(page, 'button.next-button.text-button');
    if (!clickedNext) {
      console.log('⚠️ Failed to click Next button.');
      return false;
    }

    console.log(`🔍 Checking email: ${email}`);
    await waitForCaptchaSolve(page);
    await delay(3000);

    const errorText = await page.evaluate(() => {
      const el = document.querySelector('div.separator-notice.text-notice.text-margin.theme-noticeerror-font');
      return el?.innerText || '';
    });

    if (errorText.includes("The connection to the server timed out.")) {
      console.log('⏳ SERVER TIMEOUT DETECTED — Waiting 30 minutes...');
      await delay(30 * 60 * 1000); // 30 minutes
      return false;
    }

    if (errorText.includes("This email address is already associated with an account on a Sony group service")) {
      console.log(`✅ ${email} IS REGISTERED — saving`);
      await saveRegisteredEmail(email);
      return true;
    }

    const postalCodeExists = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('label, span, div'))
        .some(el => el.innerText?.includes("Postal Code (required)"));
    });

    if (postalCodeExists) {
      console.log(`❌ ${email} NOT registered — clicking back`);
      const clickedBack = await safeClick(page, 'button.secondary-button.row-button.text-button[data-dqa-button="back"]');
      if (!clickedBack) {
        console.log('⚠️ Failed to click Back button.');
      }
      await delay(2000 + Math.random() * 1000);
      return false;
    }

    console.log(`❌ ${email} NOT registered — but no error message or postal code found.`);
    const clickedBack = await safeClick(page, 'button.secondary-button.row-button.text-button[data-dqa-button="back"]');
    if (!clickedBack) {
      console.log('⚠️ Failed to click Back button.');
    }
    await delay(2000 + Math.random() * 1000);
    return false;

  } catch (err) {
    console.error(`⚠️ Error checking ${email}:`, err.message);
    return false;
  }
}

(async () => {
  const emails = await readEmails();
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
  await page.goto('https://www.playstation.com/en-us/playstation-network/', { waitUntil: 'domcontentloaded' });

  await page.waitForSelector('button[data-qa="web-toolbar#signin-button"]');
  await page.click('button[data-qa="web-toolbar#signin-button"]');
  await page.waitForNavigation({ waitUntil: 'domcontentloaded' });

  await page.waitForSelector('button[data-qa="button-secondary"]');
  await page.click('button[data-qa="button-secondary"]');

  await page.waitForSelector('button.primary-button.row-button.text-button');
  await page.click('button.primary-button.row-button.text-button');

  await page.waitForSelector('button.next-button.text-button');
  await page.click('button.next-button.text-button');

  await page.waitForSelector('select[name="bday-month"]');
  await delay(500 + Math.random() * 500);
  await page.select('select[name="bday-month"]', '1');
  await delay(300 + Math.random() * 400);
  await page.select('select[name="bday-day"]', '15');
  await delay(300 + Math.random() * 400);
  await page.select('select[name="bday-year"]', '1990');
  await delay(500 + Math.random() * 700);
  await page.click('button.next-button.text-button');

  for (const email of emails) {
    await checkEmail(page, email);
    await delay(1000 + Math.random() * 1500);
  }

  await browser.close();
})();
