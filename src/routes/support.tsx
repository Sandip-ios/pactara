import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support — Pactara" },
      { name: "description", content: "Get help with Pactara. Contact support and browse common questions." },
      { property: "og:title", content: "Support — Pactara" },
      { property: "og:description", content: "Get help with Pactara. Contact support and browse common questions." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <LegalPage title="Support">
      <p>
        Need help? We're here. Email us at{" "}
        <a href="mailto:support@pactara.app">support@pactara.app</a> and we'll get back to
        you as soon as we can — usually within 1–2 business days.
      </p>

      <h2>Common questions</h2>

      <h3>How do I cancel my subscription?</h3>
      <p>
        Subscriptions are managed by Apple. Open the Settings app on your iPhone, tap your
        name, then <em>Subscriptions</em>, choose Pactara, and tap Cancel Subscription. Your
        access continues until the end of the current billing period.
      </p>

      <h3>Can I get a refund?</h3>
      <p>
        Pactara does not issue refunds directly. Refund requests are handled by Apple. You
        can request a refund at{" "}
        <a href="https://reportaproblem.apple.com" target="_blank" rel="noreferrer">
          reportaproblem.apple.com
        </a>
        .
      </p>

      <h3>How does the free trial work?</h3>
      <p>
        New users get a 7-day free trial. If you don't cancel before the trial ends, your
        subscription starts automatically.
      </p>

      <h3>How do I leave or delete a group?</h3>
      <p>
        Open the group, tap the settings icon, then Leave Group. Group admins can remove
        members or archive the group from the same screen.
      </p>

      <h3>How do I delete my account?</h3>
      <p>
        Open Pactara and go to Settings → Account → Delete Account. If you can't access the
        app, email <a href="mailto:support@pactara.app">support@pactara.app</a> from the
        address on your account and we'll delete it for you.
      </p>

      <h3>I'm not receiving notifications.</h3>
      <p>
        Check that notifications are enabled for Pactara in the iOS Settings app. In
        Pactara, go to Settings → Notifications to confirm your preferences.
      </p>

      <h3>I found a bug or have feedback.</h3>
      <p>
        We'd love to hear it. Email{" "}
        <a href="mailto:support@pactara.app">support@pactara.app</a> with a description and,
        if possible, a screenshot or short screen recording.
      </p>

      <h2>Contact</h2>
      <p>
        Pactara<br />
        2727 Travis St, Apt 321<br />
        Houston, TX 77006<br />
        <a href="mailto:support@pactara.app">support@pactara.app</a>
      </p>
    </LegalPage>
  );
}
