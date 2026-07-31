import { isNative } from "./native";

export type DeviceContact = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  photo?: string;
};

let cache: DeviceContact[] | null = null;
let loadPromise: Promise<DeviceContact[]> | null = null;

export type ContactsResult =
  | { status: "ok"; contacts: DeviceContact[] }
  | { status: "denied" }
  | { status: "web" }
  | { status: "error"; message: string };

function normalizeContact(c: {
  contactId?: string;
  name?: { display?: string; given?: string; family?: string } | null;
  phones?: Array<{ number?: string | null }> | null;
  emails?: Array<{ address?: string | null }> | null;
  image?: { base64String?: string | null } | null;
}): DeviceContact | null {
  const display =
    c.name?.display ||
    [c.name?.given, c.name?.family].filter(Boolean).join(" ").trim();
  if (!display) return null;
  const phone = c.phones?.find((p) => p?.number)?.number ?? undefined;
  const email = c.emails?.find((e) => e?.address)?.address ?? undefined;
  const photo = c.image?.base64String
    ? `data:image/jpeg;base64,${c.image.base64String}`
    : undefined;
  return {
    id: c.contactId ?? `${display}-${phone ?? email ?? Math.random()}`,
    name: display,
    phone: phone ?? undefined,
    email: email ?? undefined,
    photo,
  };
}

export async function loadContacts(): Promise<ContactsResult> {
  if (cache && cache.length > 0) return { status: "ok", contacts: cache };
  if (!isNative()) return { status: "web" };
  if (loadPromise) {
    try {
      const contacts = await loadPromise;
      if (contacts.length > 0) return { status: "ok", contacts };
      loadPromise = null;
      cache = null;
      return { status: "denied" };
    } catch (e) {
      loadPromise = null;
      return { status: "error", message: e instanceof Error ? e.message : "Failed" };
    }
  }
  try {
    const { Contacts } = await import("@capacitor-community/contacts");
    // iOS 18 introduces "limited" access: the OS contact picker returns only the
    // contacts the user allowed. That is a perfectly usable state, so never gate
    // on an exact "granted" string — just try to read and judge by the result.
    let status = "prompt";
    try {
      const perm = await Contacts.checkPermissions();
      status = String(perm.contacts ?? "prompt");
      if (status === "prompt" || status === "prompt-with-rationale") {
        const req = await Contacts.requestPermissions();
        status = String(req.contacts ?? "denied");
      }
    } catch {
      // permission API unavailable — fall through and attempt the read
    }
    if (status === "denied") return { status: "denied" };

    loadPromise = (async () => {
      const res = await Contacts.getContacts({
        projection: { name: true, phones: true, emails: true, image: false },
      });
      const list = ((res.contacts ?? []) as Parameters<typeof normalizeContact>[0][])
        .map(normalizeContact)
        .filter((c): c is DeviceContact => c !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
      cache = list;
      return list;
    })();
    const contacts = await loadPromise;
    if (contacts.length === 0) {
      loadPromise = null;
      cache = null;
      return { status: "denied" };
    }
    return { status: "ok", contacts };
  } catch (e) {
    loadPromise = null;
    console.error("[contacts] load failed", e);
    const raw = e instanceof Error ? e.message : "";
    const notImplemented = /not implemented/i.test(raw);
    return {
      status: "error",
      message: notImplemented
        ? "Contacts aren't available yet — you can add friends manually below."
        : raw || "Contacts unavailable",
    };
  }
}

export function getCachedContacts(): DeviceContact[] | null {
  return cache;
}

export function clearContactsCache() {
  cache = null;
  loadPromise = null;
}

/**
 * Fire an SMS or email invite using OS URL schemes. Resolves true when the
 * compose sheet was launched. Does not (and can't) confirm the user actually
 * hit send in Messages/Mail.
 */
export async function sendInvite(
  contact: { phone?: string; email?: string; name: string },
  message: string,
): Promise<{ ok: true; via: "sms" | "email" } | { ok: false; reason: string }> {
  const useSms = Boolean(contact.phone);
  const useEmail = !useSms && Boolean(contact.email);
  if (!useSms && !useEmail) {
    return { ok: false, reason: "No phone number or email on file for this contact." };
  }
  try {
    if (useSms) {
      const phone = (contact.phone ?? "").replace(/[^\d+]/g, "");
      const sep = isNative() ? "&" : "?"; // iOS Messages uses `&body=`; web varies
      const url = `sms:${phone}${sep}body=${encodeURIComponent(message)}`;
      window.location.href = url;
      return { ok: true, via: "sms" };
    }
    const subject = encodeURIComponent("Join me on Pactara");
    const body = encodeURIComponent(message);
    window.location.href = `mailto:${contact.email}?subject=${subject}&body=${body}`;
    return { ok: true, via: "email" };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Could not open your messages app." };
  }
}
