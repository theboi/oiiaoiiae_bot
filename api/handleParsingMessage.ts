import { Message } from "./message";

export async function handleParsingMessage(req): Promise<Message> {
  const unparsedMessage = req.body.message;
  const tiktokURL = unparsedMessage.text.match(
    /https:\/\/vt\.tiktok\.com\/\S*/m
  )?.[0];
  if (tiktokURL === undefined) {
    throw new Error("Error: No valid TikTok URL found.");
  }

  let message: Message = {
    chatID: unparsedMessage.chat.id,
    messageText: unparsedMessage.text,
    messageID: unparsedMessage.message_id,
    tiktokID: tiktokURL.split("/")[3],
    tiktokURL: tiktokURL,
  };
  return message;
}
