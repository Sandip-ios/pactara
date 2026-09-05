// FCM HTTP v1 sender. Server-only. Loads the service-account JSON from the
// FIREBASE_SERVICE_ACCOUNT_JSON secret, mints a short-lived OAuth access
// token, and POSTs a message to the FCM v1 endpoint.

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type CachedToken = { token: string; expiresAt: number };
let cached: CachedToken | null = null;

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(cleaned);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

function b64urlEncode(bytes: Uint8Array | string): string {
  const b = typeof bytes === "string" ? btoa(bytes) : btoa(String.fromCharCode(...bytes));
  return b.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");
  const parsed = JSON.parse(raw) as ServiceAccount;
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields");
  }
  // Handle escaped newlines when the JSON was pasted as a single-line string.
  parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - 60 > now) return cached.token;

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64urlEncode(JSON.stringify(header))}.${b64urlEncode(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );
  const jwt = `${unsigned}.${b64urlEncode(sig)}`;

  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`FCM token exchange failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, expiresAt: now + body.expires_in };
  return body.access_token;
}

export type FcmPayload = { title: string; body: string; url?: string };

export type FcmSendResult = { sent: number; expired: string[] };

/**
 * Send one notification to a list of FCM device tokens.
 * Returns count sent and the list of tokens the server reported as invalid
 * (UNREGISTERED / NOT_FOUND / INVALID_ARGUMENT) so the caller can prune them.
 */
export async function sendFcm(
  tokens: string[],
  payload: FcmPayload,
  badgeByToken?: Record<string, number>,
): Promise<FcmSendResult> {
  if (tokens.length === 0) return { sent: 0, expired: [] };
  const sa = loadServiceAccount();
  const accessToken = await getAccessToken(sa);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  const dataUrl = payload.url ?? "/";
  const expired: string[] = [];
  let sent = 0;

  await Promise.all(
    tokens.map(async (token) => {
      const badge = badgeByToken?.[token];
      const message = {
        message: {
          token,
          notification: { title: payload.title, body: payload.body },
          data: { url: dataUrl },
          apns: {
            payload: {
              aps: {
                sound: "default",
                "content-available": 1,
                ...(typeof badge === "number" ? { badge } : {}),
              },
            },
          },
          android: {
            priority: "HIGH",
            notification: {
              click_action: "FLUTTER_NOTIFICATION_CLICK",
              ...(typeof badge === "number" ? { notification_count: badge } : {}),
            },
          },
        },
      };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
      if (res.ok) {
        sent++;
        return;
      }
      const text = await res.text();
      // UNREGISTERED (410) or NOT_FOUND (404) mean the token is dead; INVALID_ARGUMENT (400)
      // with an "invalid registration token" body also means prune.
      if (
        res.status === 404 ||
        res.status === 410 ||
        /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/i.test(text)
      ) {
        expired.push(token);
      } else {
        console.warn("[fcm] send failed", res.status, text.slice(0, 200));
      }
    }),
  );

  return { sent, expired };
}

/**
 * Silent push used to update the iOS app-icon badge (usually to clear it).
 * Carries no alert, so nothing is shown to the user.
 */
export async function sendBadgeUpdate(tokens: string[], badge: number): Promise<void> {
  if (tokens.length === 0) return;
  const sa = loadServiceAccount();
  const accessToken = await getAccessToken(sa);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  await Promise.all(
    tokens.map(async (token) => {
      try {
        await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              apns: {
                headers: { "apns-push-type": "background", "apns-priority": "5" },
                payload: { aps: { badge, "content-available": 1 } },
              },
            },
          }),
        });
      } catch {
        // badge updates are best-effort
      }
    }),
  );
}
