import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Pactara" },
      { name: "description", content: "How Pactara collects, uses, and protects your information." },
      { property: "og:title", content: "Privacy Policy — Pactara" },
      { property: "og:description", content: "How Pactara collects, uses, and protects your information." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="July 20, 2026">
      <p>
        Pactara ("we", "us", or "our") operates the Pactara mobile app and website (the
        "Service"). This Privacy Policy explains what information we collect, how we use it,
        and the choices you have. By using the Service you agree to this policy.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Pactara<br />
        2727 Travis St, Apt 321<br />
        Houston, TX 77006<br />
        Contact: <a href="mailto:support@pactara.app">support@pactara.app</a>
      </p>

      <h2>2. Information we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li>Account details: name, email, password, and profile photo.</li>
        <li>Group content: group names, memberships, invites, and messages.</li>
        <li>Check-ins: short videos recorded in-app, mood selections, and notes.</li>
        <li>Contacts you choose to invite (names and phone numbers you tap to add).</li>
        <li>Support messages you send us.</li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li>Device information (model, OS version, language, timezone).</li>
        <li>Push notification tokens so we can send group and reminder notifications.</li>
        <li>Usage and diagnostic events via Mixpanel (screens viewed, actions taken).</li>
      </ul>
      <h3>Payment information</h3>
      <p>
        Subscriptions are processed by Apple through the App Store and managed via
        RevenueCat. We do not receive or store your payment card details. We receive
        subscription status (active, trial, expired) from RevenueCat.
      </p>

      <h2>3. How we use your information</h2>
      <ul>
        <li>To provide, maintain, and improve the Service.</li>
        <li>To deliver check-ins, group messages, streaks, and reminders.</li>
        <li>To send transactional emails and push notifications.</li>
        <li>To measure usage and improve features (Mixpanel analytics).</li>
        <li>To detect, prevent, and address abuse, fraud, and security issues.</li>
        <li>To comply with legal obligations.</li>
      </ul>

      <h2>4. How we share information</h2>
      <ul>
        <li><strong>Group members.</strong> Your name, avatar, check-ins, and messages are visible to members of the groups you join.</li>
        <li><strong>Service providers.</strong> We share limited data with vendors who help us run Pactara: Lovable Cloud (hosting and database), RevenueCat (subscriptions), Apple (billing and push), and Mixpanel (analytics).</li>
        <li><strong>Legal.</strong> We may disclose information if required by law or to protect the rights, safety, or property of Pactara or others.</li>
        <li><strong>Business transfers.</strong> If Pactara is involved in a merger, acquisition, or asset sale, your information may be transferred.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>5. Data retention</h2>
      <p>
        We keep your information for as long as your account is active or as needed to
        provide the Service. You can delete your account at any time from in-app Settings or
        by emailing <a href="mailto:support@pactara.app">support@pactara.app</a>. We may
        retain limited data as required by law or for legitimate business purposes such as
        fraud prevention.
      </p>

      <h2>6. Security</h2>
      <p>
        We use industry-standard safeguards to protect your information, including
        encryption in transit. No method of transmission or storage is 100% secure, so we
        cannot guarantee absolute security.
      </p>

      <h2>7. Children</h2>
      <p>
        Pactara is not directed to children under 13. We do not knowingly collect personal
        information from children under 13. If you believe a child has provided us with
        personal information, contact us and we will delete it.
      </p>

      <h2>8. Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete, or
        export your personal information, and to object to or restrict certain processing.
        To exercise these rights, email <a href="mailto:support@pactara.app">support@pactara.app</a>.
      </p>

      <h2>9. International users</h2>
      <p>
        Pactara is operated from the United States. By using the Service you consent to the
        transfer and processing of your information in the United States.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be
        announced in the app or by email. Continued use of the Service after changes take
        effect constitutes acceptance of the updated policy.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions? Email <a href="mailto:support@pactara.app">support@pactara.app</a>.
      </p>
    </LegalPage>
  );
}
