import TelegramBot from "node-telegram-bot-api";
import fs from "node:fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import dotenv from "dotenv";

dotenv.config();

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async (request, response) => {
  try {
    const bot = new TelegramBot(process.env.TELEGRAM_TOKEN ?? "");

    const { body } = request;

    if (!body.message) throw new Error("No message");
    if (!body.message.text.startsWith("https://vt.tiktok.com"))
      throw new Error("Not a TikTok URL");

    const {
      chat: { id: chatID },
      text: userURL,
    } = body.message;

    const browser = await puppeteer.launch({
      args: !!process.env.CHROME_EXECUTABLE_PATH ? puppeteer.defaultArgs() : chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath:
        process.env.CHROME_EXECUTABLE_PATH ||
        (await chromium.executablePath(
          "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar"
        )),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.goto(userURL);
    await page.setViewport({ width: 1280, height: 720 });
    await timeout(1000);
    await page.screenshot({
      path: "./screenshot.jpg",
    });
    const element = await page.waitForSelector("video > source:last-child");
    if (!element) throw new Error("No video element found");
    const sourceURL = await element.evaluate((el) => el.attributes["src"]["value"]);

    await bot.sendMessage(chatID, sourceURL);
    // console.log(sourceURL)
    // await bot.sendVideo(chatID, sourceURL);
  } catch (error) {
    console.error("Error sending message");
    console.log(error.toString());
  }
  response.send("OK");
};

// fs.writeFile('/Users/ryanthe/Dev/htmlContent2.txt', htmlContent, err => {
//   if (err) {
//     console.error(err);
//   } else {
//     // file written successfully
//   }
// });
