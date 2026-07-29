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
  if (cache) return { status: "ok", contacts: cache };
  if (!isNative()) return { status: "web" };
  if (loadPromise) {
    try {
      const contacts = await loadPromise;
      return { status: "ok", contacts };
    } catch (e) {
      return { status: "error", message: e instanceof Error ? e.message : "Failed" };
    }
  }
  try {
    const { Contacts } = await import("@capacitor-community/contacts");
    const perm = await Contacts.requestPermissions();
    if (perm.contacts !== "granted") return { status: "denied" };
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
