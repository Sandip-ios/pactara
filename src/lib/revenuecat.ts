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

async function loadPurchases() {
  if (!isNative()) throw new Error("RevenueCat is only available in the native app");
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  return Purchases;
}

async function ensureRevenueCatConfigured(userId?: string | null) {
  if (!isNative()) throw new Error("Subscriptions are only available in the iOS app");
  if (configured) return;
  if (!PUBLIC_KEY) throw new Error("The App Store connection is not configured");

  if (!configurePromise) {
    configurePromise = (async () => {
      const Purchases = await loadPurchases();
      const status = await Purchases.isConfigured();
      if (!status.isConfigured) {
        await Purchases.configure({
          apiKey: PUBLIC_KEY,
          appUserID: userId ?? undefined,
        });
      }
      configured = true;
    })().catch((error) => {
      configurePromise = null;
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
    console.error("[revenuecat] configure failed", err);
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
    console.error("[revenuecat] logIn failed", err);
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
    console.error("[revenuecat] logOut failed", err);
  }
}

export type PactaraOfferings = {
  offering: PurchasesOffering;
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
};

/** Fetch the current offering and the monthly/annual packages. */
export async function getOfferings(): Promise<PactaraOfferings | null> {
  if (!isNative()) return null;
  await ensureRevenueCatConfigured();
  const Purchases = await loadPurchases();
  const offerings = await Purchases.getOfferings();
  const offering = offerings.current;
  if (!offering) {
    console.error("[revenuecat] no current offering", {
      availableOfferingIds: Object.keys(offerings.all),
    });
    return null;
  }
  return {
    offering,
    monthly: offering.monthly ?? null,
    annual: offering.annual ?? null,
  };
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
    console.error("[revenuecat] purchasePackage failed", err);
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
    console.error("[revenuecat] restorePurchases failed", err);
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
    console.error("[revenuecat] getCustomerInfo failed", err);
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
