We'll rebuild the desktop view at `/` into a full marketing landing page that drives App Store downloads, using https://calai.app/ as the page-structure reference and Pactara's existing purple/yellow brand as the visual identity.

### What we will build

**1. Header**
- Sticky top nav with Pactara wordmark on the left.
- Center links: How it works, Features, Pricing, FAQ.
- Right side: Log in + App Store badge (primary CTA).
- Mobile: keep the existing mobile slide flow unchanged.

**2. Hero**
- Social-proof badge at the top of the section (e.g., "Loved by X users with ★ 4.9 rating" or a real stat if available).
- Large, bold headline + subheadline.
- Two CTAs: App Store badge + "Join the waitlist" / secondary link.
- Right side: a rendered iPhone mockup showing the Pactara group list / check-in UI.
- Background: subtle Pactara-purple radial glow on white.

**3. Testimonials / influencer row**
- A section titled "Used by people who hate restarting" (or similar) with horizontal cards or an image grid of real users / accountability partners.
- Each card: photo/avatar, name, short quote.
- If no real photos are available, we'll use avatar circles + initials with placeholder copy the user can replace.

**4. What Pactara includes**
- Feature list similar to Cal AI's "What does Cal AI include?" section.
- Items: small group accountability, daily check-in, streaks, morning ritual, goal tracking.
- Each item pairs a short headline with an app screenshot / visual card.

**5. Why choose Pactara**
- 3 value-proposition cards (like Cal AI's "Why choose Cal AI?"):
  - Built on social pressure, not self-discipline.
  - 10-second daily check-in.
  - Real streaks with real people.

**6. Pricing / trial callout**
- A clean section stating the trial terms: e.g., "7-day free trial. No credit card required." plus monthly/annual pricing if available.
- If pricing is not finalized yet, we'll use a "Start free — pricing inside the app" CTA.

**7. FAQ**
- Accordion or simple list of 4-6 questions covering groups, privacy, subscription, cancellation, and how accountability works.

**8. Final CTA + footer**
- A large purple-gradient CTA section with the headline "Stop restarting. Start showing up." and an App Store badge.
- Footer with copyright, links, and social icons.

### Visual direction
- Keep the existing Pactara purple/yellow palette and the Inter + Plus Jakarta Sans typography.
- Cal AI-inspired layout: clean white background, generous spacing, bold black type, phone mockups, and app-store badges as the primary action.
- No dark mode section; Pactara's app is already dark, so the landing page stays light for contrast.

### Content defaults (since real assets are a mix)
- I'll use the best existing copy from the current `DesktopLanding` component and draft placeholders for anything missing (testimonial names, influencer copy, FAQ answers).
- The user will provide the App Store / TestFlight link, and any real testimonials or pricing details they want swapped in before we publish.

### Technical notes
- The current `DesktopLanding` is not rendering on desktop because `Index.tsx` has a React hooks-order bug (it conditionally returns early after some hooks are declared). We'll fix that as part of this redesign.
- The mobile `/` route stays the same; only viewports ≥1024px get the new marketing page.
- All metadata (title, description, og tags) will be updated to match the new marketing copy.

### Deliverables
- Updated `src/routes/index.tsx` (fix hooks bug + keep mobile flow).
- Updated `src/components/DesktopLanding.tsx` with the new Cal AI-inspired structure.
- New generated phone mockup visuals uploaded to project assets.
- Updated SEO meta tags for the desktop route.

### Not in scope for this pass
- Native app store product pages (we only link to the existing store URL).
- Blog, Jobs, or Press pages (nav links can point to `#` or be removed if not needed).
- A waitlist backend/email collection form (the hero can link to App Store or /signup instead).

I won't build until you approve this plan or tell me what to change.