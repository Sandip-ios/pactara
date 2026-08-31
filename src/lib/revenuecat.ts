import { isNative } from "@/lib/native";
import { Capacitor } from "@capacitor/core";
import {
  Purchases,
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesStoreProduct,
} from "@revenuecat/purchases-capacitor";

export const REVENUECAT_ENTITLEMENT_ID = "premium";

export const REVENUECAT_PRODUCT_IDS = {
  monthly: "pactara_monthly",
  annual: "pactara_annual",
} as const;

const PUBLIC_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;

let configured = false;
let configurePromise: Promise<void> | null = null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(error: unknown): unknown {
  return typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : null;
}

function wasPurchaseCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "userCancelled" in error &&
    (error as { userCancelled?: unknown }).userCancelled === true
  );
}

function loadPurchases() {
  if (!isNative()) throw new Error("RevenueCat is only available in the native app");
  if (!Capacitor.isPluginAvailable("Purchases")) {
    throw new Error("The Purchases native plugin is not registered in this iOS build");
  }
  return Purchases;
}

async function ensureRevenueCatConfigured(userId?: string | null) {
  if (!isNative()) throw new Error("Subscriptions are only available in the iOS app");
  if (configured) return;
  if (!PUBLIC_KEY) throw new Error("The App Store connection is not configured");

  if (!configurePromise) {
    configurePromise = (async () => {
      const Purchases = loadPurchases();
      // Do not call Purchases.isConfigured() here. The web bundle is served
      // remotely and can be newer than the native shell installed from the
      // App Store. Older RevenueCat Capacitor bridges do not expose that
      // method and leave its promise pending forever. `configure` has existed
      // across the supported plugin versions and is synchronous on iOS; the
      // module-level promise prevents duplicate calls during this web session.
      await Purchases.configure({
        apiKey: PUBLIC_KEY,
        appUserID: userId ?? undefined,
      });
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
    const Purchases = loadPurchases();
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
    const Purchases = loadPurchases();
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
  monthlyProduct: PurchasesStoreProduct | null;
  annualProduct: PurchasesStoreProduct | null;
};

function pick(offering: PurchasesOffering, kind: "MONTHLY" | "ANNUAL"): PurchasesPackage | null {
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
  const Purchases = loadPurchases();
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
  let monthlyProduct = monthly?.product ?? null;
  let annualProduct = annual?.product ?? null;

  // An offering can be returned before StoreKit has attached its products.
  // Query the exact App Store identifiers as a second path so a valid product
  // remains purchasable even if the RevenueCat package mapping is unavailable.
  if (!monthlyProduct || !annualProduct) {
    const { products } = await Purchases.getProducts({
      productIdentifiers: [REVENUECAT_PRODUCT_IDS.monthly, REVENUECAT_PRODUCT_IDS.annual],
    });
    monthlyProduct ??=
      products.find((product) => product.identifier === REVENUECAT_PRODUCT_IDS.monthly) ?? null;
    annualProduct ??=
      products.find((product) => product.identifier === REVENUECAT_PRODUCT_IDS.annual) ?? null;
  }
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
  return { offering, monthly, annual, monthlyProduct, annualProduct };
}

/** Trigger the native purchase flow for a package. */
export async function purchasePackage(aPackage: PurchasesPackage): Promise<CustomerInfo | null> {
  if (!isNative()) return null;
  try {
    await ensureRevenueCatConfigured();
    const Purchases = loadPurchases();
    const { customerInfo } = await Purchases.purchasePackage({ aPackage });
    return customerInfo;
  } catch (err: unknown) {
    // User cancelling the purchase is expected; don't throw.
    if (wasPurchaseCancelled(err)) {
      console.info("[revenuecat] purchase cancelled by user");
      return null;
    }
    console.error("[revenuecat] purchasePackage failed", err);
    throw err;
  }
}

/** Trigger the native purchase flow for a product fetched directly from StoreKit. */
export async function purchaseProduct(
  product: PurchasesStoreProduct | null | undefined,
): Promise<CustomerInfo | null> {
  if (!isNative() || !product) return null;
  try {
    await ensureRevenueCatConfigured();
    const Purchases = loadPurchases();
    const { customerInfo } = await Purchases.purchaseStoreProduct({ product });
    return customerInfo;
  } catch (err: unknown) {
    if (wasPurchaseCancelled(err)) {
      console.info("[revenuecat] purchase cancelled by user");
      return null;
    }
    console.error("[revenuecat] purchaseStoreProduct failed", err);
    throw err;
  }
}

/** Restore previous purchases from the App Store. */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!isNative()) return null;
  try {
    await ensureRevenueCatConfigured();
    const Purchases = loadPurchases();
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
    const Purchases = loadPurchases();
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

export {
  type CustomerInfo,
  type PurchasesPackage,
  type PurchasesOffering,
  type PurchasesStoreProduct,
};

