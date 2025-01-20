import TelegramBot from "node-telegram-bot-api";
import fs from "node:fs";
import puppeteer, { Page } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import dotenv from "dotenv";
import https from "https";
import path from "path";
import { VercelRequest, VercelResponse } from "@vercel/node";
import { handleParsingMessage } from "./handleParsingMessage";
import { Message } from "./message";

dotenv.config();
const isProduction = process.env.VERCEL_ENV === "production";

const cwdPath = isProduction ? `/tmp` : `./tmp`;
fs.mkdirSync(path.dirname(cwdPath), { recursive: true }); // ensures the `tmp` directory exists for Vercel deployment

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

function handleVideo(
  bot: TelegramBot,
  page: Page,
  resolve: () => void,
  message: Message
) {
  const videoPath = `${cwdPath}/${message.tiktokID}.mp4`;
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
    console.log("tmp path:", videoPath);
    await downloadVideo(sourceURL, videoPath, headers);
    console.log("Video downloaded");

    // const captionElement = await page.waitForSelector(`span[data-e2e="new-desc-span"]`)
    // const caption = await page.evaluate(el => el?.textContent, captionElement)
    // console.log("Caption:", caption);

    console.log("Sending video");
    await bot.sendVideo(message.chatID, videoPath, {
      width: 1080,
      height: 1920,
      // caption: caption ?? undefined,
      reply_to_message_id: message.messageID,
    });
    console.log("Video sent");

    resolve();
  });
}

export default async (wsRequest, wsResponse) => {
  console.log("Starting browser");

  let message: Message;
  try {
    message = await handleParsingMessage(wsRequest);
  } catch (err) {
    console.log(err);
    wsRequest.send("NA");
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

    const interceptVideoPromise = new Promise<void>(async (resolve, reject) => {
      handleVideo(bot, page, resolve, message);
      await page.goto(message.tiktokURL, { waitUntil: "load" });
      await timeout(10_000);
      reject("timeout");
    });

    try {
      await interceptVideoPromise;
    } catch (err) {
      if (err === "timeout") {
        console.log("No media found/timeout occurred");
        wsResponse.send("No media/timeout");
        return;
      }
    }

    if (!isProduction)
      await page.screenshot({ path: `${cwdPath}/screenshot.png` });
    console.log("Loaded page on puppeteer");

    wsResponse.send("OK");
  } catch (err) {
    console.error("Error sending message: ", err);
    wsResponse.send("Error occurred");
  } finally {
    console.log("Closing browser");
    browser.close();
  }
};
