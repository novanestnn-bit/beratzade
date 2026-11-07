# BERATZADE restaurant operations

The customer menu, staff POS, kitchen, and administration use the same tenant data.
Product identity is `(source, id)` across legacy and catalogue-backed products.
The customer site uses actual published product images and neutral placeholders;
empty category templates and unrelated stock photos are not presented as dishes.
Modal product views retain identity across reload and browser Back.

The public menu opens with all published dishes visible. Sticky category navigation
and accent-insensitive, word-order-independent search work on phones and desktops.
Search reveals matching dishes inside collapsed sections and clearing it restores
the guest's previous section state. Empty subcategories are omitted. Existing
user-supplied photographs decorate the restaurant header and category navigation;
product cards continue to use only that product's own API image. A failed refresh
preserves the last catalogue with a connection notice. A closed table QR links to
the restaurant's read-only public menu without opening the table or enabling orders.

Restaurant operations are the primary staff navigation. POS categories preserve
their real hierarchy without duplicating subcategory dishes. Background polling
does not replace the product grid or overwrite a cashier's entered cash amount.
Unpaid counter sales remain recoverable after reload and must be settled before
starting another counter sale. Existing durable calls, drafts, and retry keys remain.

The POS includes manual cash-register opening and closing with entered opening
float/counted cash and a variance summary. No register action runs automatically.
An ambiguous response blocks resubmission and survives reload until server state
confirms the outcome. Delayed order responses cannot replace another selected
table's account. Unconfirmed order batches keep their immutable content/key and
cannot be edited into a second submission. These batches and unresolved payments
remain recoverable beyond the ordinary eight-hour draft expiry.

Administration separates daily restaurant settings from optional advanced tools.
New products created through the management form start as drafts. Publication is
an explicit operator action; existing publication states are not changed by deploy.
Kitchen, table, product, staff, report and settings permissions remain server-enforced.

Table administration controls require `table:write`; staff retain permitted service
actions. The table list polls visible tabs without replacing open edits. Reports
retain their applied date range and disable export when filters have changed.
Settings save only edited fields/module switches and warn before discarding edits.
Failed staff-account deletion remains in the confirmation dialog for review/retry.

QR submissions validate the entire batch before writing: quantity is 1-99, source
is explicit when ids collide, and hidden/inactive/out-of-date products cannot be
ordered by guessing an id. Linked product name, price and visibility are consistent
between public menu, QR, POS and order creation. Payment reconciliation locks the
order row so concurrent cashiers cannot both collect the same remaining balance.

## Public image durability

Render's default filesystem is ephemeral; files outside a persistent disk are lost
on deployment or restart. See [Render persistent disk documentation](https://render.com/docs/disks).
The `20261103230000` migration adds only `uploaded_media`, holding verified public
image bytes. Upload endpoints persist image and metadata in the same transaction;
startup restores the local public-image cache. Contracts and arbitrary private paths
are rejected. Restore validates content, size, hash, path and symlink boundaries.

Before production: verify the target database backup by restoring it, encrypt and
verify the existing images, obtain explicit approval for the media-table/backfill,
copy only the approved existing files without modifying product references, and
then deploy the backend. Never deploy an ephemeral backend while its only copy of
an uploaded restaurant image remains on that instance.

## Verification

- Backend: 580 passed, 8 skipped; explicit isolated-database concurrency tests included.
- Angular: 68 passed; production compiler/build succeeded.
- Public menu: four viewport sizes, source collisions, image fallback, modal focus,
  Escape, browser Back and reload checked without production writes.
- Restaurant administration: draft, explicit publication, price and advanced settings.
- Three panels: password login/roles, product changes, QR ordering, kitchen statuses,
  split payment, table closure and reports in a disposable database.
- Durability: drafts, lost responses, concurrent submissions, calls and payment retries.
- Workspace: 7 browser scenarios cover table permissions, report/export dates,
  failed deletion/retry, concurrent settings edits, cash-register opening/closing,
  double clicks and ambiguous-response recovery, using only disposable records.

Relevant browser scripts are `test-public-menu-restaurant.mjs`,
`test-restaurant-admin-ui.mjs`, `test-three-panel-operations.mjs`, and
`test-durable-operations.mjs`, plus `test-restaurant-workspace.mjs`, under `front/scripts`.
Mutating scripts refuse public
hosts. Real menu contents, prices, users and table activation are operator decisions.

Product dialog behavior follows the [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
