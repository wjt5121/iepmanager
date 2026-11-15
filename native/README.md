# IEP Manager native local candidate

This is a separate SwiftUI iPhone/iPad app, not a web wrapper. It implements the November 15 local-native request; the earlier online companion design documents do not describe this candidate's architecture. The existing web app and its repairs are retained.

## Build and test

Open `IEPManager/IEPManager.xcodeproj`, scheme `IEPManager`. No package dependencies or model downloads are performed by the app. Project generation is reproducible with `python3 IEPManager/generate_project.py` if new Swift files are added. Use installed Apple SDKs; the project targets iOS 17+, with Foundation Models gated at iOS 26+. Deployment target is not proof of testing on every OS/device.

```sh
xcodebuild -project native/IEPManager/IEPManager.xcodeproj -scheme IEPManager \
  -destination 'platform=iOS Simulator,id=YOUR_SIMULATOR_UUID' \
  -derivedDataPath /tmp/iep-native-build -parallel-testing-enabled NO test
```

Signing is local ad-hoc for the simulator. Physical installation needs an owner-approved signing configuration and an available device; no account/team/provisioning changes or distribution are performed here. Debug builds alone support `-test-vault UUID` for isolated synthetic UI-test state and `-inject-save-failure` for an injected pre-publication failure. Release builds omit both hooks.

## Implemented scope

- One local working student/plan workspace; no school integration, shared server, remote identity, or production role system.
- Native file picker for local PDF/image/TXT, camera authorization/cancel path, original bytes and SHA-256 preserved inside the encrypted vault.
- Real Vision accurate OCR, including raster-only PDFs; page/line provenance and confidence are visible. Human corrections are stored separately from original OCR and source bytes. English OCR configuration; document limit 20 MB / 30 PDF pages, total source archive limit 50 MB. No blank-image extraction or image-to-heuristic substitution.
- Real `SystemLanguageModel.default` inference when available. No `PrivateCloudComputeLanguageModel`, remote provider, HTTP backend, tools, telemetry SDK, or heuristic model substitute. A model-selected quotation must match exactly within one unique original line; the complete original line becomes the draft. Model extraction is deliberately bounded to explicitly written numeric percentage/four-of-five goals. Unsupported/missing criteria or generation failure abstain. Human criterion confirmation and explicit approval are required. Manual review remains available when a model is unavailable.
- Goals, prompted/independent trial observations, source-linked drafts, report text, encrypted saves, and reopen. A single 8/10 trial is insufficient. Five prompted 4/5 trials do not satisfy independence. Duplicate normalized trial IDs and duplicate original source bytes are rejected. Trial IDs are human-entered: the app cannot independently prove that a claimed real-world trial occurred.
- Report text stays in memory; records and original sources are exportable together in the encrypted recovery archive. No automatic plaintext report/temp export is written.
- Password-encrypted export through the native document picker, and a local encrypted recovery copy with authenticated restore confirmation. A recovery copy inside the app sandbox is not protection against app removal: export it to a separate local destination. Choose an On My iPhone/iPad or separately attached local destination; no remote backup is configured.

## Storage and recovery boundary

CryptoKit AES-256-GCM encrypts the complete workspace (original document bytes, OCR, metadata, goals and progress) before atomic file replacement. AAD binds the vault format/version and workspace identity. Device keys use the Keychain with `WhenUnlockedThisDeviceOnly`, no synchronization. Missing/inaccessible keys with an existing vault fail closed; there is no reset, replacement-key fallback or plaintext fallback. Restore authenticates and validates the complete archive before replacing the vault; failed password/authentication/schema/write leaves prior bytes usable.

Backups use an independent user-held password, random 32-byte salt, PBKDF2-HMAC-SHA256 with 600,000 iterations, and AES-GCM. Backup format, KDF parameters and salt are authenticated. The device-only key is absent from the archive, enabling recovery with a new device key. Store the recovery password separately; there is no password recovery service. App-private storage and local recovery directories are excluded from automatic backup and use complete file protection. No app source/OCR/prompt/output logging is implemented. UI is covered while inactive.

These are implementation boundaries, not a security certification. Tests cover synthetic application-owned files, not all OS/file-provider caches, physical device-lock timing, hardware attacks, or power-loss durability. The plaintext input file chosen by a person already exists outside this app's encrypted vault. The system file picker can expose user-configured providers; this app does not configure them. Do not select a cloud provider for this local-only workflow.

## Model and hardware dependencies

Apple documents the Foundation Models framework as accessing an on-device model and requiring runtime availability checks: https://developer.apple.com/documentation/FoundationModels/generating-content-and-performing-tasks-with-foundation-models . The built-in model is hardware/OS/region/settings dependent; a base iPhone 15 is not equivalent to an eligible Pro device. This app does not change Apple Intelligence settings or initiate a model download. Simulator availability can report ready while generation fails; that is recorded as an incomplete simulator model check, never as a model pass. Physical acceptance requires a compatible connected iPhone/iPad, owner-established offline state, actual camera capture, device lock/unlock, and repeated measured generation.

A broader-device alternative was assessed, not installed or claimed to work: official llama.cpp iOS XCFramework releases (MIT, https://github.com/ggml-org/llama.cpp/releases) with official Qwen3-0.6B GGUF (Apache-2.0, 639 MB Q8_0 asset, https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/tree/main). Shipping that path requires a separately pinned runtime and model revision, checksummed assets/license notices, an in-process wrapper with downloads disabled, and actual memory/latency/quality testing on the intended device range. No such assets are bundled in this candidate; an unavailable Apple model remains explicitly unavailable.

## Acceptance evidence

Synthetic XCTest cases cover actual Vision PNG/PDF OCR, unsupported/blank inputs, real Keychain round trip, missing/inaccessible keys, vault tamper/wrong key/AAD identity, encrypted canaries, password/corrupt/authenticated-invalid backup preservation, new-key recovery, injected write failure, duplicate source/evidence, report values, and source-criteria validation. UI tests cover camera permission denial or unavailability, raster import, draft review, approval, progress/report, local encrypted recovery, process termination/relaunch and failed-save restart. The real-model test is only a pass when generation succeeds; simulator framework failures are explicitly skipped and reported.

See [CHECKPOINT.md](CHECKPOINT.md) for exact completed, failed, skipped and interrupted checks. Test coverage listed above describes the cases, not a claim that final UI acceptance passed. No actual student records, app distribution, school integrations, paid service, or OS/security configuration changes are part of this candidate.
