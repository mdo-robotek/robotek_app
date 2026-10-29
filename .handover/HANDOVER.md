# Sarthi ERP — handover for a fresh session (29 Oct 2026)

## Where the code is
- Repo: `mdo-robotek/robotek_app`. Pushing from the old session failed (403) because the repo was not added to the session sources. **Add the repo to the new session's sources first.**
- The newest code is on branch `work-merged` (commit after f16e1da). It is NOT on GitHub. Ways to get it into the new session:
  1. After 23B is live, run `GITHUB-SYNC.txt` on the server. It pushes the live code to branch `live-sync` (only if the server has a GitHub login), or
  2. Use `robotek_erp_work.bundle` from the old session's outputs: `git clone robotek_erp_work.bundle`.
- Server: srv1934622.hstgr.cloud, app in `~/robotek_app`, service `robotek` (systemd), port 3000.

## How to deploy (Sahil pastes ONE block in the Hostinger browser console)
- `make_oneshot.py` (in this folder) builds `NN-LIVE.txt`. It contains:
  - a base64 tgz holding `expect.txt` + `head/<files>`
  - for every file: md5 checks against the old/new versions, otherwise it prints RUKO and changes nothing
  - a backup, a build, a restart, and an automatic rollback if the build fails
- `expect.txt` lines look like `WANT_MD5|ALT_MD5 HEAD_MD5 path`, where `NEW` = a file that does not exist yet.
- Keep each block under ~90 KB. The serial console drops very large pastes.
- Before shipping, test on a fake server: a temporary HOME with `robotek_app` from `git archive <base>`, plus fake `npm`, `systemctl`, `sudo`, `curl` that print "Compiled successfully" or "active".
- Talk to Sahil in Hinglish; all UI text is in English. Rules are in the project instructions.

## Live status
- **LIVE:** packages up to 21 (21 confirmed by Sahil's screenshot: Files 6/6, Naya code 1).
- **Waiting to be pasted, in this order:** 22 → 23A → 23B (files are in the old session's outputs).
  - **22:** automatic SO check for O2D Step 2 (`src/lib/so-check.ts`, `/api/o2d/so-check`, `O2DSoCheck.tsx`, "SO Party Names" tab, `SO_Check` column).
  - **23A:** shared ProcessScreen (`src/components/process/`), applied to Packing Purchase (i2r-packing), Item Receive (Packing), Replace.
  - **23B:** the same for I2R, GRN, and the HR screens (`hrms/[module]`: recruitment, candidate, sales, onboard, offboard).

## What ProcessScreen is
- It is the same idea as the new O2D screen. One row per record (title, ref, qty, current step, who, due/late). Chips: Open / Late / Due today / Done / Cancelled / All, plus search.
- Tapping a row opens a window: the next step with "Update step", all steps with done time and saved facts, then Details (filled in automatically from the sheet columns).
- It reuses each page's existing modals:
  - `openBulkModal([id])` for the step update
  - `openEditModal`, `openRemoveFollowUpModal`, cancel/restore, delete
- The old left-side step list and the "Standard / Smart View" toggle were removed.

## Next tasks (agreed with Sahil)
1. Check 22/23A/23B live; fix whatever Sahil reports.
2. Still old style: O2D KB (copy the new O2D screen), New Launch, Payment Vendor Approval, Delegations + Checklists ("My Tasks"), Attendance / Field Tracking, Sales screens. Mockups of all of these were sent as PNGs (00–05 in screen-proposals).
3. **Customer WhatsApp updates** (thank-you + SO, packed, dispatched, PI/invoice, bilty later).
   - Hindi by default. English for Sky Mobile Tirur, Abbas Bhai Cochin, and Odisha parties.
   - First send a sample series from one real order to Sahil's and Shivani's phones for approval.
4. **Metrix:** recommended removing it and making a "Sales Analysis" page from Busy sales (waiting for Sahil).
