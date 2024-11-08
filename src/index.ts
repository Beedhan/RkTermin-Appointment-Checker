import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import extractValue from "./extractValue";
import fs from "fs";
import path from "path";
import { Browser } from "puppeteer";
import { botToken, delay } from "./utils";
import { Bot, InputFile } from "grammy";
import cron from "node-cron";

const bot = new Bot(botToken);

puppeteer.use(StealthPlugin());
let browser: Browser | null = null;

async function runPuppeteer() {
  try {
    console.log("Started task");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36"
    );
    await page.setDefaultTimeout(2000);
    await page.setDefaultNavigationTimeout(0);

    console.log("Going to the page");
    await page.goto(
     process.env.APPOINTMENT_URL,
      { waitUntil: "networkidle2" }
    );

    console.log("Waiting for captcha");
    const base64Captcha = await page.$eval(
      "captcha>div",
      (div) => div.style.background
    );
    saveBase64ToFile(base64Captcha);

    const extractedText = await extractValue();
    if (
      !extractedText ||
      extractedText.length <= 5 ||
      extractedText.includes(" ")
    ) {
      console.log(extractedText);
      throw new Error("Extraction error");
    }

    console.log("Typing captcha");
    await page.focus("#appointment_captcha_month_captchaText");
    await page.keyboard.type(extractedText);
    await delay(4000);

    console.log("Clicking submit");
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load" }),
        page.click("#appointment_captcha_month_appointment_showMonth"),
      ]);
    } catch (error) {
      console.error("Error during navigation:", error.message);
      if (error.message.includes("detached")) {
        console.log("Frame was detached, retrying...");
        await page.reload();
        return;
      } else {
        throw error;
      }
    }

    console.log("Checking for captcha error");
    const captchaError = await page.evaluate(() => {
      const errorContainer = document.querySelector(".global-error");
      return errorContainer ? true : false;
    });

    if (captchaError) {
      throw new Error("Captcha error");
    }

    console.log("Checking for availability");
    const found = await page.evaluate(() => {
      return document.body.textContent.includes(
        "Unfortunately, there are no appointments available at this time."
      );
    });

    if (found) {
      console.log("Not available");
      await bot.api.sendPhoto(
        process.env.CHANNEL_ID,
        new InputFile(path.join(__dirname, "image.jpg"))
      );
      await bot.api.sendMessage(
        process.env.CHANNEL_ID,
        `No appointment at this time. \nCaptcha was <b>${extractedText}</b>`,
        { parse_mode: "HTML" }
      );
    } else {
      console.log("Appointment available");
      for (let index = 0; index < 25; index++) {
        await bot.api.sendMessage(
          process.env.CHANNEL_ID,
          "<b>Appointment available be quickkkkkkkkkkkkkkkkkkkkkkkkkkkkkk</b>",
          { parse_mode: "HTML" }
        );
      }
      await bot.api.sendMessage(
        process.env.CHANNEL_ID,
        "<b>Appointment available be quickkkkkkkkkkkkkkkkkkkkkkkkkkkkkk</b>",
        { parse_mode: "HTML" }
      );
    }

    await browser.close();
    process.exit(1);

  } catch (error: any) {
    if (browser) {
      await browser.close();
      browser = null;
    }

    if (
      error.message !== "Extraction error" &&
      error.message !== "Captcha error" &&
      error.message !== "detached"
    ) {
      await bot.api.sendMessage("-1002242509001", `Unexpected error: ${error.message}`);
    } else {
      console.log("Known error occurred, retrying...");
      setTimeout(runPuppeteer, 5000);
    }

    console.error("Error occurred:", error.message);
  }
}

function saveBase64ToFile(base64String: string) {
  const base64Data = extractBase64FromBackground(base64String);
  if (!base64Data) {
    return;
  }

  const buffer = Buffer.from(base64Data, "base64");

  fs.writeFile(path.join(__dirname, "image.jpg"), buffer, (err) => {
    if (err) {
      console.error("Error writing file:", err);
    } else {
      console.log("File saved successfully");
    }
  });
}

function extractBase64FromBackground(style: string) {
  const regex = /url\(['"]data:image\/[a-zA-Z]+;base64,([a-zA-Z0-9+/=]+)['"]\)/;
  const match = style.match(regex);

  if (match && match[1]) {
    return match[1];
  }

  return null;
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
cron.schedule("*/5 * * * *", async () => {
  try {
    console.log("Started job");
    await runWithTimeout(290000);
  } catch (error: any) {
    console.error(error.message);
    console.log("End of 5 minutes timer");
    if (browser) {
      console.log("Browser closed");
      await browser.close();
    }
    process.exit(1);
  }
});
