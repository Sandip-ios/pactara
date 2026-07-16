## Goal
Replace the placeholder paywall with real RevenueCat in-app purchases inside the Capacitor iOS shell.

## What we'll build

1. **Install the SDK**
   - Add `@revenuecat/purchases-capacitor` and run `npx cap sync`.

2. **Add the public API key**
   - Store `VITE_REVENUECAT_PUBLIC_KEY` in `.env` (publishable key is safe in code).

3. **Create a RevenueCat service**
   - `src/lib/revenuecat.ts`:
     - `configureRevenueCat(userId)` — initializes SDK with the Supabase user ID.
     - `getOfferings()` — fetches the default offering and monthly/annual packages.
     - `purchasePackage(pkg)` — triggers the native purchase flow.
     - `restorePurchases()` — restores previous purchases.
     - `checkSubscription()` — checks `CustomerInfo` for active entitlements.
     - All methods are no-ops on web, guarded by `isNative()`.

4. **Initialize on app start**
   - In `NativeBootstrap.tsx`, configure RevenueCat after the user is signed in and log the user into RevenueCat with their Supabase `user.id`.

5. **Replace placeholder paywall logic**
   - In `TrialEndedPaywall.tsx`:
     - Fetch offerings and display real prices from RevenueCat.
     - Call `purchasePackage()` on the selected plan.
     - Show loading/error states.
   - In `src/routes/_authenticated/route.tsx`:
     - Replace the `localStorage` subscription check with `checkSubscription()`.
     - Only show the paywall when RevenueCat reports no active entitlement.

6. **Update the Plan page**
   - In `src/routes/_authenticated/plan.tsx`:
     - Show actual subscription status from RevenueCat.
     - Add "Restore purchases" and "Manage subscription" actions.
     - Keep the plan selection UI but drive purchases through RevenueCat.

7. **Verify build and preview**
   - Run typecheck/build and check the web preview still renders.
   - Note: actual iOS purchases can only be tested on a real device or sandbox in Xcode.

## What I need from you
- Your **RevenueCat public API key** (from RevenueCat dashboard → Project settings → API keys → Public SDK key).
- The **entitlement identifier** you created in RevenueCat (e.g., `premium`).
- Confirm the offering identifier is `default` and the products attached are `pactara_monthly` and `pactara_annual` as we discussed earlier.

Once you confirm and share the key, I'll implement it.