import { handlers } from "@/lib/auth";
import type { NextApiRequest, NextApiResponse } from "next";

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const baseUrl = `${process.env.NODE_ENV === "production" ? "https" : "http"}://${req.headers.host}`;
  const url = new URL(req.url!, baseUrl);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
      else headers.set(key, value);
    }
  }

  // Read raw body stream
  const chunks: Buffer[] = [];
  for await (const chunk of req as unknown as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks);

  const request = new Request(url.toString(), {
    method: req.method!,
    headers,
    body: rawBody.length > 0 ? rawBody : undefined,
  });

  const response =
    req.method === "POST"
      ? await handlers.POST(request as any)
      : await handlers.GET(request as any);

  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await response.text());
}
