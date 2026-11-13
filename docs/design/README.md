# docs/design — multi-address subscriptions (draft)
Design draft for several addresses with separate notification toggles ("Мої адреси"). Example: all alerts for address A, only emergency for address B.

- `MULTI_ADDRESS.md` — logic: data model, toggle mapping, worked example, alarm and notification design, emergency polling, widgets, migration, edge cases, iOS notes, open questions.
- `multi-address-mockup.html` — static mockup (inline CSS, no scripts, no network): Settings, Main, add-address picker, notifications. Toggles in the mockup really switch.
- `multi-address-mockup.png` — screenshot of the mockup (headless Edge, 1800 px wide).

**Status: draft, not implemented.** Release 1.4.0 builds only the foundations (address id in alert keys, alarm request-code registry, separate planned/emergency channels, pure `OutageEngine`).
**Open the mockup:** double-click `multi-address-mockup.html` (any modern browser; keep the window at least 360 px wide).
**Plan decisions:** see sections 4, 5.1, 5.3, 5.4 and 3.3/3.4 of the approved plan (`i-want-you-to-concurrent-graham.md` in the owner's Claude plans folder); open questions for the owner are in section 14 of `MULTI_ADDRESS.md`.
