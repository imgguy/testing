const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const readline = require('readline');
const path = require('path');
const { program } = require('commander');

puppeteer.use(StealthPlugin());

program
  .requiredOption('-i, --input <file>', 'Input file with email list')
  .option('-s, --suffix <suffix>', 'Optional suffix for output files', '')
  .parse(process.argv);

const options = program.opts();
const INPUT_FILE = options.input;
const SUFFIX = options.suffix.toLowerCase() === 'off' ? '' : options.suffix || '';

const REGISTERED_FILE = `registered_hotemails${SUFFIX}.txt`;
const NOT_REGISTERED_FILE = `not_registered_hotemails${SUFFIX}.txt`;

async function loadEmails(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const all = raw
    .split('\n')
    .map(line => line.trim().toLowerCase())
    .filter(email =>
      email.length > 5 &&
      email.includes('@') &&
      (email.includes('hotmail') || email.includes('outlook') || email.includes('live') || email.includes('msn'))
    );

  return [...new Set(all)];
}

async function saveResult(email, isRegistered) {
  const target = isRegistered ? REGISTERED_FILE : NOT_REGISTERED_FILE;
  await fs.appendFile(target, email + '\n');
}

async function checkEmail(email, browser) {
  const page = await browser.newPage();
  try {
    await page.goto('https://signup.live.com/signup', { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('#iSigninName');
    await page.type('#iSigninName', email, { delay: 50 });

    await page.click('button[type="submit"][data-testid="primaryButton"]');

    await page.waitForTimeout(2000);

    const errorBox = await page.$('div[data-dqa-message="error"]');
    if (errorBox) {
      const text = await page.evaluate(el => el.textContent, errorBox);
      if (text.includes('already associated with an account')) {
        await saveResult(email, true);
        console.log(`✅ Registered: ${email}`);
      } else {
        await saveResult(email, false);
        console.log(`❌ Not Registered (Error Msg): ${email}`);
      }
    } else {
      await saveResult(email, false);
      console.log(`❌ Not Registered: ${email}`);
    }
  } catch (err) {
    console.log(`⚠️ Error checking ${email}: ${err.message}`);
  } finally {
    await page.close();
  }
}

(async () => {
  const emails = await loadEmails(INPUT_FILE);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const email of emails) {
    await checkEmail(email, browser);
  }

  await browser.close();
  console.log('✅ All done!');
})();
