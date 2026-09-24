# Comments browser fixture

This source overlay contains study content and fixture-only endpoints for selection, capture, geometry and delivery browser tests. The comments runner copies it into a disposable source snapshot and builds that fixture separately. It is not compiled into Surface releases.

Mounted-page tests use the untouched production build. Fixture screenshots establish shared component behavior only; they do not prove the production host's route, authorization or packaging contract. The runner records both source inventories and removes disposable builds on exit.
