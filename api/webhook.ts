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

function downloadVideo(url: string, filePath: string, headers: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https.get(url, { headers }, (response) => {
      response.pipe(file);
      file.on("finish", () => {
        file.close(() => { resolve(); });
      });
    }).on("error", (err) => {
      fs.unlink(filePath, () => reject(err));
    });
  });
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

    page.on("response", async (response) => {
      const contentType = response.headers()["content-type"]; // MIME Type
      const contentLength = response.headers()["content-length"];
      const url = response.url();

      if (!(contentType === "video/mp4" && url.includes("webapp-prime.tiktok.com"))) return;

      console.log("Content-Type:", contentType);
      console.log("Content-Length:", contentLength);
      console.log("URL:", url);
      console.log("------------------------");
      
      const headers = response.request().headers();
      const cookies = await page.cookies();
      headers["Cookie"] = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ");

      try {
        await downloadVideo(url, "./temp.mp4", headers);
        console.log("Video downloaded");
        await bot.sendVideo(chatID, "temp.mp4", { width: 1080, height: 1920 });
      } catch (err) {
        console.error("Error downloading video:", err);
      }
    });

    await page.goto(userURL);
    await timeout(1000);
    await page.screenshot({ path: "./userURL.png" });
    console.log("Loaded userURL");
  } catch (error) {
    console.error("Error sending message");
    console.log(error.toString());
  }
  console.log("Closing browser");
  browser.close();
  response.send("OK");
};