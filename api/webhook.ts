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
  // await page.setRequestInterception(true);

  try {
    const bot = new TelegramBot(process.env.TELEGRAM_TOKEN ?? "MISSING_TOKEN");

    const { body } = wsRequest;
    const {
      chat: { id: chatID },
      text: userUrl,
    } = body.message;

    if (!body.message) throw new Error("No message");
    if (!userUrl.startsWith("https://vt.tiktok.com"))
      throw new Error("Not a TikTok URL");

    const userUrlId = userUrl.split("/")[3];
    const downloadPath = isProduction
      ? `/tmp/${userUrlId}.mp4`
      : `./tmp/${userUrlId}.mp4`;

    // Ensure the directory exists
    fs.mkdirSync(path.dirname(downloadPath), { recursive: true });

    page.on("response", async (pupResponse) => {
      const contentType = pupResponse.headers()["content-type"]; // MIME Type
      const contentLength = pupResponse.headers()["content-length"];
      const url = pupResponse.url();

      if (!(contentType === "video/mp4" && url.includes("webapp-prime.tiktok.com"))) return;
      //

      console.log("Content-Type:", contentType);
      console.log("Content-Length:", contentLength);
      console.log("URL:", url);
      console.log("------------------------");

      const headers = pupResponse.request().headers();
      const cookies = await page.cookies();
      headers["Cookie"] = cookies
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");

      try {
        console.log("Downloading video");
        console.log("tmp path:", downloadPath);
        await downloadVideo(url, downloadPath, headers);
        console.log("Video downloaded");

        // const captionElement = await page.waitForSelector(`span[data-e2e="new-desc-span"]`)
        // const caption = await page.evaluate(el => el?.textContent, captionElement)
        // console.log("Caption:", caption);

        console.log("Sending video");
        await bot.sendVideo(chatID, downloadPath, {
          width: 1080,
          height: 1920,
          // caption: caption ?? undefined,
          reply_to_message_id: body.message.message_id,
        });
        console.log("Video sent");
        wsResponse.send("OK"); //TODO: Fix "navigating frame was detached error", need to refactor async code
      } catch (err) {
        console.error("Error downloading video:", err);
      }
    });
    
    await page.goto(userUrl, { waitUntil: "networkidle0", timeout: 7_000 });
    if (!isProduction) await page.screenshot({ path: "./userUrl.png" });
    console.log("Loaded userUrl");

  } catch (err) {
    console.error("Error sending message: ", err);
  }
  console.log("Closing browser");
  browser.close();
};
