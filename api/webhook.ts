import TelegramBot from "node-telegram-bot-api";
import fs from "node:fs";
import puppeteer, { Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import dotenv from "dotenv";
import https from "https";
import path from "path";

dotenv.config();

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadVideo(
  url: string,
  filePath: string,
  headers: any
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https
      .get(url, { headers }, (response) => {
        response.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            resolve();
          });
        });
      })
      .on("error", (err) => {
        fs.unlink(filePath, () => reject(err));
      });
  });
}

export default async (wsRequest, wsResponse) => {
  console.log("Starting browser");
  const isProduction = process.env.VERCEL_ENV === "production";
  const {
    chat: { id: chatID },
    text: tiktokURL,
    message_id: messageID,
  } = wsRequest.body.message;

  console.log(tiktokURL);
  if (!tiktokURL.startsWith("https://vt.tiktok.com")) {
    console.log("Not a TikTok URL");
    wsResponse.send("NA");
    return;
  }

  const browser = await puppeteer.launch({
    args: isProduction ? chromium.args : puppeteer.defaultArgs(),
    defaultViewport: chromium.defaultViewport,
    executablePath: isProduction
      ? await chromium.executablePath()
      : process.env.CHROME_EXECUTABLE_PATH,
    headless: chromium.headless,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  try {
    const bot = new TelegramBot(process.env.TELEGRAM_TOKEN ?? "MISSING_TOKEN");

    const tiktokID = tiktokURL.split("/")[3];
    const downloadPath = isProduction
      ? `/tmp/${tiktokID}.mp4`
      : `./tmp/${tiktokID}.mp4`;
    fs.mkdirSync(path.dirname(downloadPath), { recursive: true }); // ensures the directory exists for Vercel deployment

    const pageResponsePromise = new Promise<void>(async (resolve, reject) => {
      page.on("response", async (pupResponse) => {
        const contentType = pupResponse.headers()["content-type"];
        const contentLength = pupResponse.headers()["content-length"];
        const sourceURL = pupResponse.url();

        if (
          !(
            contentType === "video/mp4" &&
            sourceURL.includes("webapp-prime.tiktok.com")
          )
        )
          return;

        console.log("Content-Type:", contentType);
        console.log("Content-Length:", contentLength);
        console.log("URL:", sourceURL);
        console.log("------------------------");

        const headers = pupResponse.request().headers();
        const cookies = await page.cookies();
        headers["Cookie"] = cookies
          .map((cookie) => `${cookie.name}=${cookie.value}`)
          .join("; ");

        console.log("Downloading video");
        console.log("tmp path:", downloadPath);
        await downloadVideo(sourceURL, downloadPath, headers);
        console.log("Video downloaded");

        // const captionElement = await page.waitForSelector(`span[data-e2e="new-desc-span"]`)
        // const caption = await page.evaluate(el => el?.textContent, captionElement)
        // console.log("Caption:", caption);

        console.log("Sending video");
        await bot.sendVideo(chatID, downloadPath, {
          width: 1080,
          height: 1920,
          // caption: caption ?? undefined,
          reply_to_message_id: messageID,
        });
        console.log("Video sent");

        resolve();
      });

      await page.goto(tiktokURL, { waitUntil: "load" });
      await timeout(10_000);
      reject("timeout");
    });

    try {
      await pageResponsePromise;
    } catch (err) {
      if (err === "timeout") {
        console.log("Timeout occurred");
        wsResponse.send("No video found/timeout occurred");
        return;
      }
    }

    if (!isProduction) await page.screenshot({ path: "./userUrl.png" });
    console.log("Loaded userUrl");

    wsResponse.send("OK");
  } catch (err) {
    console.error("Error sending message: ", err);
    wsResponse.send("Error occurred");
  } finally {
    console.log("Closing browser");
    browser.close();
  }
};
