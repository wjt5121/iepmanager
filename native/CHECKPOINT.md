# Native checkpoint — 2026-11-15

Work stopped at the owner's request to free the development Mac. This is a runnable development candidate, not completed physical-device acceptance. Preserve the accompanying web repairs. No student records, vaults, backups, models, binaries, screenshots or runtime logs are included in this checkpoint.

## Verified before stopping

- Toolchain: Xcode 27.2 (27B52), iOS SDK 27.2, Swift 6.4.2, Apple silicon host macOS 27.2.
- Native simulator app built and launched with local ad-hoc signing. Compact device: iPhone SE (3rd generation), iOS 26.5 (23F77).
- Latest complete unit run: 12 passed, 1 explicitly skipped (13 cases). Real PNG and image-only PDF Vision OCR, actual simulator Keychain, authenticated encryption/recovery failure cases and human-review/evidence constraints passed.
- The skipped real-model test encountered Apple's safety prompt-template runtime error despite availability reporting ready. It is not an inference pass.
- The actual candidate Foundation Models implementation ran successfully on the Mac host three times: grounded unapproved drafts, approximately 5.25 seconds cold and 0.92/0.89 seconds warm. Host results do not establish iOS physical inference or offline acceptance.
- An earlier native UI iteration passed OCR, source-linked draft, approval, prompted 8/10 observation, report, restart and injected failed-save restart. After adding explicit criterion confirmation and local recovery UI, the latest complete UI run failed: the test did not activate the confirmation switch, and restore confirmation could clear pending bytes. The latter implementation has been repaired with separate presentation state; the UI test now targets the switch control and asserts confirmation. The rerun was interrupted on owner instruction. These latest changes remain unverified.
- Earlier web acceptance: 55 API/parser/storage tests passed; audit-fixed browser smoke 6 passed / 4 viewport skips; web build passed. Earlier broader browser suite: 48 passed / 46 intentional viewport skips. No additional web regression was run after native work.
- App-process socket sampling during one synthetic simulator journey observed zero network sockets. Source contains no remote inference/client/telemetry integration. This is not proof about every OS service or a physical offline run.

## Resume next

1. Run the single native UI journey on the compact simulator. Confirm the criterion switch is actually on and approval enabled, then verify local encrypted backup restore and failed-save restart. Fix any remaining interaction failure without weakening review.
2. Run all 13 native unit cases and the UI journey on an iPad simulator with iOS 27.2. A dedicated iPad was created but acceptance has not run. Serialize simulator/build work.
3. Exercise native Files import/export interactions beyond the tested local file-URL importer and in-app encrypted recovery copy. Perform accessibility/keyboard and larger-screen review.
4. Rerun web API/browser/build regressions.
5. Physical acceptance remains blocked by no available connected test device: owner-approved signing/install, actual camera, lock/unlock Keychain/protection, cold launch in owner-established offline state, repeated real on-device model runs with latency/memory measurements. Do not equate the unavailable listed physical device with a tested device. Broader-device alternative runtime/model assets were assessed only, not installed.

## Local evidence (not versioned)

Native complete run: `iep-native-compact-acceptance.log` / `.xcresult` in the temporary evidence directory. Earlier passing UI: `iep-native-ui4.log` / `.xcresult`. Interrupted last rerun: `iep-native-ui5.log` / `.xcresult`. Host model: `iep-host-model-final.log`. Web: `iep-neo-qa-summary.md`, `iep-neo-atomic-api-final.log`, `iep-neo-atomic-ui.log`, `iep-neo-atomic-build.log`. These are ephemeral local artifacts, not portable acceptance deliverables.

The web store remains plaintext and has no cross-process edit guarantee. Native encrypted storage is a separate implementation; no compliance/security certification or native production readiness is claimed. No distribution, deploy, remote processing, school integration, or account/security-setting changes were performed.
