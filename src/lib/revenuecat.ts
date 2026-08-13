import { isNative } from "@/lib/native";
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from "@revenuecat/purchases-capacitor";

export const REVENUECAT_ENTITLEMENT_ID = "premium";

const PUBLIC_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;

let configured = false;
let configurePromise: Promise<void> | null = null;

/** Errors log as `{}` in the Xcode console unless we flatten them by hand. */
export function describeError(error: unknown): string {
  if (!error) return "unknown error";
  if (typeof error === "string") return error;
  const e = error as { message?: string; code?: string; name?: string };
  return [e.name, e.code, e.message].filter(Boolean).join(" | ") || String(error);
}

async function loadPurchases() {
  if (!isNative()) throw new Error("RevenueCat is only available in the native app");
  try {
    const mod = await import("@revenuecat/purchases-capacitor");
    const Purchases = mod?.Purchases;
    if (Purchases) return Purchases;
    console.warn("[revenuecat] module loaded without Purchases export; using bridge fallback");
  } catch (err) {
    console.warn("[revenuecat] module import failed; using bridge fallback:", describeError(err));
  }

  // Fallback: talk to the native plugin straight through the Capacitor bridge.
  // The plugin is registered natively (Package.swift build), so this works even
  // when the npm wrapper chunk fails to load in the web layer.
  const { registerPlugin } = await import("@capacitor/core");
  const Purchases = registerPlugin<any>("Purchases");
  if (!Purchases) throw new Error("RevenueCat native plugin is not available in this build");
  return Purchases as typeof import("@revenuecat/purchases-capacitor").Purchases;
}



/** Rejects instead of hanging forever when a native bridge call never answers. */
function withTimeout<T>(promise: Promise<T>, ms: number, stage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[revenuecat] ${stage} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function ensureRevenueCatConfigured(userId?: string | null) {
  if (!isNative()) throw new Error("Subscriptions are only available in the iOS app");
  if (configured) return;
  if (!PUBLIC_KEY) {
    console.error("[revenuecat] missing VITE_REVENUECAT_PUBLIC_KEY in this build");
    throw new Error("The App Store connection is not configured");
  }

  if (!configurePromise) {
    configurePromise = (async () => {
      console.info("[revenuecat] step 1: loading plugin", {
        keyPrefix: String(PUBLIC_KEY).slice(0, 4),
      });
      const Purchases = await withTimeout(loadPurchases(), 10000, "plugin import");

      console.info("[revenuecat] step 2: isConfigured");
      const status = await withTimeout(Purchases.isConfigured(), 10000, "isConfigured");

      if (!status.isConfigured) {
        console.info("[revenuecat] step 3: configure");
        await withTimeout(
          Purchases.configure({
            apiKey: PUBLIC_KEY,
            appUserID: userId ?? undefined,
          }),
          10000,
          "configure",
        );
      }
      configured = true;
      console.info("[revenuecat] step 4: ready");
    })().catch((error) => {
      configurePromise = null;
      console.error("[revenuecat] configuration failed:", describeError(error));
      throw error;
    });
  }

  await configurePromise;
}


/** Initialize RevenueCat and identify the user with their Supabase ID. */
export async function configureRevenueCat(userId?: string | null) {
  if (!isNative()) return;

  try {
    await ensureRevenueCatConfigured(userId);
    console.info("[revenuecat] configured for user", userId);
  } catch (err) {
    console.error("[revenuecat] configure failed:", describeError(err));
    throw err;
  }
}

/** Identify a signed-in user after the SDK has already been configured. */
export async function logInRevenueCat(userId: string) {
  if (!isNative()) return;
  try {
    await ensureRevenueCatConfigured();
    const Purchases = await loadPurchases();
    await Purchases.logIn({ appUserID: userId });
    console.info("[revenuecat] logged in", userId);
  } catch (err) {
    console.error("[revenuecat] logIn failed:", describeError(err));
  }
}

/** Reset RevenueCat to an anonymous user on sign-out. */
export async function logOutRevenueCat() {
  if (!isNative() || !configured) return;
  try {
    const Purchases = await loadPurchases();
    await Purchases.logOut();
    console.info("[revenuecat] logged out");
  } catch (err) {
    console.error("[revenuecat] logOut failed:", describeError(err));
  }
}

export type PactaraOfferings = {
  offering: PurchasesOffering;
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
};

function pick(
  offering: PurchasesOffering,
  kind: "MONTHLY" | "ANNUAL",
): PurchasesPackage | null {
  const direct = kind === "MONTHLY" ? offering.monthly : offering.annual;
  if (direct) return direct;
  const all = offering.availablePackages ?? [];
  const byType = all.find((p) => (p.packageType as string) === kind);
  if (byType) return byType;
  const needle = kind === "MONTHLY" ? "month" : ("annual" as string);
  const alt = kind === "MONTHLY" ? "monthly" : "year";
  return (
    all.find((p) => {
      const hay = `${p.identifier} ${p.product?.identifier ?? ""}`.toLowerCase();
      return hay.includes(needle) || hay.includes(alt);
    }) ?? null
  );
}

/** Fetch the current offering and the monthly/annual packages. */
export async function getOfferings(): Promise<PactaraOfferings | null> {
  if (!isNative()) return null;
  await ensureRevenueCatConfigured();
  const Purchases = await loadPurchases();
  const offerings = await Purchases.getOfferings();
  // Fall back to any offering that actually has packages if none is marked "current".
  const offering =
    offerings.current ??
    Object.values(offerings.all).find((o) => (o.availablePackages ?? []).length > 0) ??
    null;
  if (!offering) {
    console.error("[revenuecat] no offering with packages", {
      availableOfferingIds: Object.keys(offerings.all),
    });
    return null;
  }
  const monthly = pick(offering, "MONTHLY");
  const annual = pick(offering, "ANNUAL");
  console.info("[revenuecat] offerings loaded", {
    offeringId: offering.identifier,
    packages: (offering.availablePackages ?? []).map((p) => ({
      id: p.identifier,
      type: p.packageType,
      product: p.product?.identifier,
    })),
    monthly: monthly?.identifier ?? null,
    annual: annual?.identifier ?? null,
  });
  return { offering, monthly, annual };
}


/** Trigger the native purchase flow for a package. */
export async function purchasePackage(aPackage: PurchasesPackage): Promise<CustomerInfo | null> {
  if (!isNative()) return null;
  try {
    await ensureRevenueCatConfigured();
    const Purchases = await loadPurchases();
    const { customerInfo } = await Purchases.purchasePackage({ aPackage });
    return customerInfo;
  } catch (err: any) {
    // User cancelling the purchase is expected; don't throw.
    if (err?.userCancelled) {
      console.info("[revenuecat] purchase cancelled by user");
      return null;
    }
    console.error("[revenuecat] purchasePackage failed:", describeError(err));
    throw err;
  }
}

/** Restore previous purchases from the App Store. */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!isNative()) return null;
  try {
    await ensureRevenueCatConfigured();
    const Purchases = await loadPurchases();
    const { customerInfo } = await Purchases.restorePurchases();
    return customerInfo;
  } catch (err) {
    console.error("[revenuecat] restorePurchases failed:", describeError(err));
    throw err;
  }
}

/** Get the latest customer info (subscription status). */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isNative()) return null;
  try {
    await ensureRevenueCatConfigured();
    const Purchases = await loadPurchases();
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (err) {
    console.error("[revenuecat] getCustomerInfo failed:", describeError(err));
    return null;
  }
}

/** Returns true if the user has an active entitlement for the premium plan. */
export function isSubscriptionActive(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  const entitlement = customerInfo.entitlements.all[REVENUECAT_ENTITLEMENT_ID];
  return entitlement?.isActive === true;
}

export { type CustomerInfo, type PurchasesPackage, type PurchasesOffering };
