import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Pactara" },
      { name: "description", content: "The rules that govern your use of Pactara." },
      { property: "og:title", content: "Terms of Use — Pactara" },
      { property: "og:description", content: "The rules that govern your use of Pactara." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="July 20, 2026">
      <p>
        Welcome to Pactara. These Terms of Use ("Terms") govern your access to and use of
        the Pactara mobile app and website (the "Service"), operated by Pactara ("we", "us",
        "our"). By using the Service you agree to these Terms. If you do not agree, do not
        use the Service.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 13 years old to use Pactara. By using the Service you represent
        that you meet this requirement and that you have the legal capacity to enter into
        these Terms.
      </p>

      <h2>2. Your account</h2>
      <p>
        You are responsible for keeping your login credentials secure and for all activity
        under your account. Notify us at <a href="mailto:support@pactara.app">support@pactara.app</a>
        of any unauthorized use.
      </p>

      <h2>3. Subscriptions, billing, and refunds</h2>
      <ul>
        <li>Pactara offers a 7-day free trial. After the trial, a paid subscription begins unless canceled.</li>
        <li>Subscriptions are billed through your Apple ID and managed via RevenueCat.</li>
        <li>Subscriptions auto-renew until canceled at least 24 hours before the end of the current period. Manage or cancel in your Apple ID subscription settings.</li>
        <li><strong>All sales are final. We do not offer refunds.</strong> Refund requests are handled solely by Apple under its policies.</li>
      </ul>

      <h2>4. User content</h2>
      <p>
        You retain ownership of the content you post (videos, notes, messages). By posting
        content you grant Pactara a worldwide, non-exclusive, royalty-free license to host,
        store, reproduce, and display it as needed to operate the Service. You are
        responsible for your content and represent that you have the rights to share it.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Post content that is illegal, harmful, harassing, hateful, sexually explicit, or infringing.</li>
        <li>Impersonate anyone or misrepresent your affiliation.</li>
        <li>Attempt to hack, disrupt, or reverse-engineer the Service.</li>
        <li>Use the Service to spam or send unsolicited messages.</li>
        <li>Violate any applicable law.</li>
      </ul>
      <p>
        We may remove content or suspend accounts that violate these Terms, at our sole
        discretion.
      </p>

      <h2>6. Groups and shared content</h2>
      <p>
        Pactara is built around small accountability groups. Content you post in a group is
        visible to other members. Do not share sensitive information you would not want
        those members to see.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        Pactara and its logos, designs, and software are owned by us and protected by
        intellectual property laws. Nothing in these Terms grants you rights to our marks or
        proprietary materials.
      </p>

      <h2>8. Third-party services</h2>
      <p>
        The Service uses third-party services (Apple, RevenueCat, Mixpanel, Lovable Cloud).
        Your use of those services is subject to their terms.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may stop using the Service at any time and delete your account from in-app
        Settings. We may suspend or terminate your access if you violate these Terms or if
        we discontinue the Service.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        The Service is provided "as is" and "as available" without warranties of any kind,
        express or implied, including merchantability, fitness for a particular purpose, and
        non-infringement. We do not guarantee that the Service will be uninterrupted,
        secure, or error-free.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Pactara will not be liable for any indirect,
        incidental, special, consequential, or punitive damages, or any loss of profits,
        data, or goodwill, arising from your use of the Service. Our aggregate liability for
        any claim relating to the Service will not exceed the amount you paid us in the 12
        months before the claim.
      </p>

      <h2>12. Indemnification</h2>
      <p>
        You agree to indemnify and hold Pactara harmless from any claims, damages, or
        expenses arising from your use of the Service, your content, or your violation of
        these Terms.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of Texas, without regard to its
        conflict of law rules. Any disputes will be resolved in the state or federal courts
        located in Harris County, Texas.
      </p>

      <h2>14. Changes</h2>
      <p>
        We may update these Terms from time to time. Material changes will be announced in
        the app or by email. Continued use after changes means you accept the updated Terms.
      </p>

      <h2>15. Contact</h2>
      <p>
        Pactara<br />
        2727 Travis St, Apt 321<br />
        Houston, TX 77006<br />
        <a href="mailto:support@pactara.app">support@pactara.app</a>
      </p>
    </LegalPage>
  );
}
