# Join requests visual review

New-version presentation updated; classic UI, join rules, limits and member privacy are unchanged.

- Preview: white top section; gray days/streak chips; Members title inside its white card; 40px avatars with first names only; join/request/full buttons below the privacy card with the requested helper text.
- Requests: normal full-width gray intro, yellow full-state replacement with bold opening sentence, edge-to-edge white list, gray disabled Approve.
- Switcher: pending rows follow crews without a section label; plain Pending text.
- Join goal: 52px single-line field, counter underneath, text-only Skip for now.

## Verified

All six captures are 390×844 at `?v=new`, stored as base64 in `public/qa/join-requests-2.json`. Requested capture was taken after the toast disappeared. QA Tester asked, opened the pending preview from the switcher, and cancelled; the full preview then read back correctly. Gray Requested button measured background `#F4F2EF`, text `#A8A29E`, height 52px, radius 26px. Full Approve measured the requested gray colors. Goal input/counter and Skip worked. No runtime errors in the final check; 578 tests passed; preview build OK.

QA Open Crew 2, its requests, and all seven filler accounts were removed after capture; all three cleanup counts are zero. Temporary example rows were not retained in the project. QA Crew, QA Crew 2, QA Open Crew and QA End Test remain. The existing approved request's goal-prompt timestamp was restored after capture.

## Files changed

- `src/components/redesign/NewCrewPreview.tsx`
- `src/components/redesign/NewCrewJoinRequests.tsx`
- `src/components/redesign/NewCrewControls.tsx`
- `src/components/redesign/NewCrewScreen.tsx`
- `src/styles.css` — two new-version-only warning colors.
- `roadmap.md`
- `public/qa/join-requests-2.json`
- `public/qa/join-requests-2-review.md`

No backend or classic code changes; no temporary capacity override. Not published.