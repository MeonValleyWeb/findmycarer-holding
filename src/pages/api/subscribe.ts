import type { APIRoute } from "astro";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAILJET_API_BASE = "https://api.mailjet.com/v3/REST";

type MailjetErrorPayload = {
  ErrorInfo?: string;
  ErrorMessage?: string;
  ErrorRelatedTo?: string[];
};

const jsonHeaders = {
  "Content-Type": "application/json"
};

const makeAuthHeader = (apiKey: string, apiSecret: string): string => {
  const token = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  return `Basic ${token}`;
};

const readMailjetError = async (response: Response): Promise<string> => {
  const fallback = `Mailjet request failed with status ${response.status}.`;

  try {
    const payload = (await response.json()) as MailjetErrorPayload;
    return payload.ErrorInfo || payload.ErrorMessage || fallback;
  } catch {
    return fallback;
  }
};

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.MAILJET_API_KEY;
  const apiSecret = import.meta.env.MAILJET_API_SECRET;
  const listId = Number(import.meta.env.LIST_ID);

  if (!apiKey || !apiSecret || !Number.isFinite(listId)) {
    return new Response(JSON.stringify({ error: "Server is missing Mailjet configuration." }), {
      status: 500,
      headers: jsonHeaders
    });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body." }), {
      status: 400,
      headers: jsonHeaders
    });
  }

  const email =
    typeof payload === "object" && payload !== null && "email" in payload
      ? String((payload as { email: unknown }).email).trim()
      : "";

  if (!EMAIL_REGEX.test(email)) {
    return new Response(JSON.stringify({ error: "Please provide a valid email address." }), {
      status: 400,
      headers: jsonHeaders
    });
  }

  const authHeader = makeAuthHeader(apiKey, apiSecret);

  // Create the contact (idempotent: existing contact is still OK for this flow).
  const createContactResponse = await fetch(`${MAILJET_API_BASE}/contact`, {
    method: "POST",
    headers: {
      ...jsonHeaders,
      Authorization: authHeader
    },
    body: JSON.stringify({
      Email: email
    })
  });

  if (!createContactResponse.ok && createContactResponse.status !== 400) {
    const message = await readMailjetError(createContactResponse);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: jsonHeaders
    });
  }

  // Add contact to the configured list; treat duplicate membership as success.
  const addToListResponse = await fetch(`${MAILJET_API_BASE}/listrecipient`, {
    method: "POST",
    headers: {
      ...jsonHeaders,
      Authorization: authHeader
    },
    body: JSON.stringify({
      ContactAlt: email,
      ListID: listId
    })
  });

  if (!addToListResponse.ok) {
    const message = await readMailjetError(addToListResponse);
    const alreadySubscribed = message.toLowerCase().includes("already");

    if (!alreadySubscribed) {
      return new Response(JSON.stringify({ error: message }), {
        status: 502,
        headers: jsonHeaders
      });
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
};
