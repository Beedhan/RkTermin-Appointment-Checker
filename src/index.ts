import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import extractValue from "./extractValue";
import fs from "fs";
import path from "path";
import { Browser } from "puppeteer";
import { botToken, delay } from "./utils";
import { Bot } from "grammy";
import cron from "node-cron";
const bot = new Bot(botToken);

puppeteer.use(StealthPlugin());
let browser: Browser | null = null;
async function runPuppeteer() {
  try {
    console.log("Started puppeteer");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36"
    );
    await Promise.all([
      await page.waitForNavigation(),
      await page.goto(
        "https://service2.diplo.de/rktermin/extern/appointment_showMonth.do?locationCode=kath&realmId=321&categoryId=3142"
      ),
    ]);
    await page.setDefaultTimeout(2000);
    await page.setDefaultNavigationTimeout(0);

    console.log("Waiting for captcha");
    await delay(500);
    await page.waitForSelector("captcha");
    const base64Captcha = await page.$eval(
      "captcha>div",
      (div) => div.style.background
    );
    saveBase64ToFile(base64Captcha);
    const extractedText = await extractValue();
    //if not text extracted reload page and check if length of text is less than 5
    if (
      !extractedText ||
      extractedText.length <= 5 ||
      extractedText.includes(" ")
    ) {
      console.log(extractedText);
      throw new Error("Extraction error");
    }
    await page.focus("#appointment_captcha_month_captchaText");
    await page.keyboard.type(extractedText);
    await delay(4000);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load" }),
      page.click("#appointment_captcha_month_appointment_showMonth"),
    ]);
    await page.evaluate(() => {
      console.log("evaluating");
      const errorContainer = document.querySelector(".global-error");
      console.log(errorContainer);
      if (errorContainer) {
        throw new Error("Captcha error");
      }
      return null;
    });
    const found = await page.evaluate(() =>
      window.find(
        "Unfortunately, there are no appointments available at this time. New appointments will be made available for booking at regular intervals."
      )
    );
    if (found) {
      await bot.api.sendMessage(
        "-1002242509001",
        "No appointment at this time"
      );
      await browser.close();
      process.exit(1);
    } else {
      await bot.api.sendMessage(
        "-1002242509001",
        "Appointment available be quickkkkkkkkkkkkkkkkkkkkkkkkkkkkkk"
      );
      await browser.close();
      process.exit(1);
    }
  } catch (error: any) {
    if (browser) {
      browser.close();
    }
    if (
      error.message !== "Extraction error" &&
      error.message !== "Captcha error"
    ) {
      await bot.api.sendMessage("-1002242509001", error.message);
    }
    console.log(error.message, "err");
    runPuppeteer();
  }
}
function saveBase64ToFile(base64String: string) {
  // Split the base64 string to get the actual data
  const base64Data = extractBase64FromBackground(base64String);
  if (!base64Data) {
    return;
  }
  // Decode the base64 string
  const buffer = Buffer.from(base64Data, "base64");

  // Write the buffer to a file
  fs.writeFile(path.join(__dirname, "image.jpg"), buffer, (err) => {
    if (err) {
      console.error("Error writing file:", err);
    } else {
      console.log("File saved successfully");
    }
  });
}

function extractBase64FromBackground(style: string) {
  // Regular expression to match data URL in the background property
  const regex = /url\(['"]data:image\/[a-zA-Z]+;base64,([a-zA-Z0-9+/=]+)['"]\)/;
  const match = style.match(regex);

  if (match && match[1]) {
    return match[1]; // Return the base64 string
  }

  return null; // Return null if no match is found
}

async function runWithTimeout(timeout: number) {
  return Promise.race([
    runPuppeteer(),
    new Promise<void>((_, reject) =>
      setTimeout(() => {
        reject(new Error("Process timed out"));
      }, timeout)
    ),
  ]);
}

console.log("Started app");
// Schedule to run every 5 minutes at 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55 minutes
cron.schedule("* * * * *", async () => {
  try {
    console.log("Started job");
    await runWithTimeout(300000); // Set timeout to 5 minutes (300000 ms)
  } catch (error: any) {
    console.error(error.message);
    if (browser) {
      await browser.close();
    }
    console.log("End of 5 minutes timer");
    process.exit(1); // Exit the process if timeout occurs
  }
});
