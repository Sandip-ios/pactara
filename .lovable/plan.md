# Restore social push notifications

## What I found
- Check-ins, reactions, comments, and pact activity are reaching the notification sender, and recipients have current device registrations with group notifications enabled.
- The app intentionally discards foreground notifications whenever their destination matches the open page. Since social activity usually points to Home or the current group, those alerts disappear during normal use; reminders point elsewhere and still appear.
- On the web, only the commitment-reminder switch actually registers the device. The main push switch and group-activity switch can appear enabled without creating a usable subscription.
- Delivery errors are also under-reported, making failed sends difficult to distinguish from successful ones.

## Changes
- Show social notifications while the app is open, even when they link to the current page.
- Make the main push switch register or unregister the browser correctly, while activity switches remain preference controls.
- Keep tapping each alert routed to the exact check-in, comment thread, or group.
- Improve delivery-result logging and only remove a device registration when Firebase explicitly identifies that registration as invalid.
- Add focused tests for foreground social alerts and Firebase failure classification.

## Verification
- Run the notification tests and confirm a clean preview build.
- Verify recent check-in, reaction, comment, and pact events all take the visible foreground-alert path.
