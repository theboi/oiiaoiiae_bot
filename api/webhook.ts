import TelegramBot from "node-telegram-bot-api";
import fs from "node:fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import dotenv from "dotenv";
import https from "https";

dotenv.config();

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async (request, response) => {
  const browser = await puppeteer.launch({
    args: !!process.env.CHROME_EXECUTABLE_PATH
      ? puppeteer.defaultArgs()
      : chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath:
      process.env.CHROME_EXECUTABLE_PATH ||
      (await chromium.executablePath(
        "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar"
      )),
    headless: chromium.headless,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  let isInitial = true;
  // await page.setRequestInterception(true);

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

    await page.goto(userURL);
    await timeout(1000);
    await page.screenshot({ path: "./userURL.png" });
    console.log("Loaded userURL");

    const element = await page.waitForSelector(
      "div.tiktok-web-player > video > source:last-child"
    );
    if (!element) throw new Error("No video element found");
    const sourceURL = await element.evaluate(
      (el) => el.attributes["src"]["value"]
    );
    console.log(sourceURL);

  //   page.on('request', (request) => {
  //     // cancel any navigation requests after the initial page.goto
  //     console.log("Request made");
  //     if (request.isNavigationRequest() && request.headers()["content-type"] !== "video/mp4") {
  //       console.log("Cancelling request");
  //         return request.abort();
  //     }
  //     request.continue();
  // });


    page.on("response", async (response) => {
      const contentType = response.headers()["content-type"]; // MIME Type
      const contentLength = response.headers()["content-length"];

      if (contentType !== "video/mp4" || !isInitial) return
      console.log("Is video");
      isInitial = false

      console.log("Content-Type:", contentType);
      console.log("Content-Length:", contentLength);
      console.log("------------------------");

      const buffer = await response.buffer();
      
      console.log("Writing file");
      await fs.writeFile("./temp.mp4", buffer, (err) => {
        if (err) throw err;
      });
      bot.sendVideo(chatID, "temp.mp4");
    });

    await page.goto(sourceURL);
    await timeout(100000);
    await page.screenshot({ path: "./sourceURL.png" });
    console.log("Loaded sourceURL");
    

    await bot.sendMessage(chatID, sourceURL);
  } catch (error) {
    console.error("Error sending message");
    console.log(error.toString());
  }
  console.log("Closing browser");
  browser.close();
  response.send("OK");
};

// fs.writeFile('/Users/ryanthe/Dev/htmlContent2.txt', htmlContent, err => {
//   if (err) {
//     console.error(err);
//   } else {
//     // file written successfully
//   }
// });
