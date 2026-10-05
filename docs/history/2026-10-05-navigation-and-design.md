# Navigation animation and Design source repair

The deployed October 5 release used responsive AppShell navigation despite the adopted width-preserving push contract in `docs/design/accessibility.md`. A browser regression against the actual HTTPS service measured 279 px of navigation width change during opening; desktop Escape also left the pane open. This was current application behavior, not an old installed runtime.

Surface now selects the existing design-system `push` API. No provider implementation or internal CSS override is needed. Chromium and WebKit at 1280 px and 390 px pass frame-sampled opening/closing width checks, navigation text geometry, Escape and focus restoration. The test is exercised against mounted Design routes by the comments acceptance runner.

Design mounting separately failed its frozen-lock integrity check. Its committed archive and lock disagreed, and its provider pin was older than the shell. The vendor archive, identity and lock now select the same published provider main `c0863d99015cfd6b039755f2f2fb94ce5ee47aa7` as Surface. The isolated provider package was rebuilt from that commit and checked; package identity remains `7027dcee051e89272c40bbd935cc6dd99add12a2165886f5d288023ffcee668f`. Unrelated transitive dependency versions were preserved.

The repaired Design source installs with its frozen lock. All five routes render in desktop Chromium and phone-sized WebKit without page errors; rendered navigation and page states were inspected. Source type/Svelte checks and 126 tests / 1,135 assertions passed. Full immutable release acceptance and local deployment remain pending. Physical devices and real conversation delivery are not claimed.
