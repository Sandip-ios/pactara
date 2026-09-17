# Composer refinement

## What will change
- Rework both group chat and comment composers into one rounded, light-gray input bar.
- Keep photo and GIF controls inside the bar while the input is empty.
- As soon as text or media is ready, replace the trailing media controls with a purple circular send button.
- Preserve the current photo upload, GIF picker, reply, loading, and error behavior.

## Interaction details
- The transition between tools and send will be quick and subtle, without shifting the text field.
- Sending remains disabled while an upload or send is in progress, with a spinner in the send control.
- The layout will respect the iPhone safe area and keep touch targets comfortably sized.

## Technical details
- Update only the existing group-chat and comment composer presentation/state composition.
- Reuse the existing buttons and semantic Pactara color tokens.
- Verify both empty and ready-to-send states in the mobile preview, then confirm the preview build is clean.
