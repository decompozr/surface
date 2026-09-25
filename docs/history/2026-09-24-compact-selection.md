# Compact selection toolbar — September 24, 2026

Phone feedback on preview c74555f reported an oversized green selection bar and crowded target/content/action ordering. An isolated mounted-page regression against that installed build reproduced its solid accent background. Selection now uses a short tag/ID followed by actions, a neutral content-sized surface, 16px icons and a 1px outline. Desktop controls are 32px; touch hit areas remain 44px with a 32px visible surface. Target text and selector remain in the durable comment metadata.

Provider main dfe319f5cb581245da9f71673c7223891275e6cc was exported and rebuilt with frozen npm dependencies. Its package digest still matches the existing Surface pin b7fbf1b89a9a2294bf7d94c618d7d88c5f9242d53b36421c62bd1bde7aaef743; the development link was preserved.

Verification: 105 tests passed; root types and snapshot Svelte/server checks passed. The full isolated comments matrix passed fixture/mounted, idle/active and Chromium/WebKit flows, plus desktop/touch toolbar, scrolling and keyboard/viewport checks. Desktop and phone selection screenshots were inspected. Two obsolete action-order assertions were updated to the adopted label-first layout. The runner now copies shared fixtures needed by colocated source tests; the missing fixture was caught by the snapshot type check.

A real phone comment and screenshot reached the original task and a reply was published to its exact callback. This proves receipt and publication, not that the physical phone displayed the reply. The redesigned toolbar still requires physical-device acceptance; browser emulation does not establish native keyboard/compositor behavior. Disposable verification exports and traces are retired after preview verification.
