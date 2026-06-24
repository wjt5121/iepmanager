# IEP Implementation Workspace — High-Fidelity Wireframes

This package contains a working React/Vite MVP plus the original self-contained HTML concept prototype for the Pennsylvania school-age IEP Implementation Workspace.

## Run the React MVP

Install dependencies and start the local app:

```bash
npm install
npm run dev
```

Run the FDS smoke tests:

```bash
npm run test:fds
```

Run the local API:

```bash
npm run api
```

The API listens on `http://127.0.0.1:8787` by default and stores local demo state in `data/`.

The React app automatically hydrates from the API when it is available. If the API is not running, the app remains usable with browser-local fallback state. To point the frontend at a different API URL, set `VITE_IEP_API_URL`.

The local API uses demo session authentication. The frontend signs in automatically as `case-manager` with password `demo`, and the role selector switches between demo accounts. Additional demo users are `general-ed`, `related-service`, `parent`, `student`, `administrator`, `school-admin`, `district-admin`, `system-admin`, and `read-only-reviewer`, all with password `demo`. API requests use bearer sessions rather than trusting role headers.

API-backed intake accepts pasted text and selected `.txt`, `.docx`, and `.pdf` files. It preserves uploaded source bytes under `data/documents/`, records file size and SHA-256 metadata, extracts plain text and DOCX Word XML, performs page-aware embedded-text PDF extraction with OCR warnings for scanned PDFs, and lets authorized reviewers record OCR/source-quality status, source-anchor page/segment/bounding-box metadata, reviewed excerpts, notes, and digests.

Authorized API-backed exports generate server-side artifacts under `data/exports/`. Structured records export as normalized FDS-section JSON and PDF packets, district-system import-review packages export as JSON with FDS section coverage, source-registry metadata, package digests, and not-official-submission guardrails, audit packets export as JSON, and report-style packets such as teacher checklists, meeting prep, and service/progress/review reports export as DOCX with recorded file metadata and download URLs. District export-template reviews can link a generated district-system package to target-system, template-version, mapping, validation, package hash, and production-submission boundary evidence without sending data to a live district system.

Administrator audit workflows can create verified local audit anchors, record external timestamp receipt evidence, seal local write-once retention manifests under `data/retention/`, record local retention policy reviews for schedule, legal-hold, archive, and purge-boundary decisions, and record identity lifecycle readiness reviews for district IdP, MFA, tenant-boundary, account lifecycle, and role-provisioning status. These manifests and review records bind digest evidence, actor metadata, and audit-chain entries for review. Production deployments still need district-approved WORM storage, enforceable retention policy automation, live third-party notarization or timestamping, district SSO, enforceable MFA, tenant isolation, and automated provisioning/deprovisioning.

Run backend API tests:

```bash
npm run test:api
```

`npm run test:fds` starts an isolated test API and the Vite app, then runs browser coverage against API-backed workspace persistence, selected-file intake, and generated export downloads.

The app implements the FDS workflows with fictional local data: student profile intake, active caseload selection, active-student scoping with no cross-student leakage across implementation/services/progress/meetings/summaries/review/assistant surfaces, source-aware Student profile workflow map statuses for every FDS profile section, upload/paste intake, dashboard IEP review queue visibility for source-review follow-up, Pennsylvania source-registry alignment, review tracking, multilingual source availability metadata, language-verification notes, and administrator source-entry activation, annotated-source field help and validation prompts, structured extraction review with student-scoped sections, page-aware PDF source mapping, OCR/source-quality review metadata, field-level source-anchor review metadata, edit metadata, and reject/regenerate controls, approved extracted text merged into the normalized structured record, downstream goal/service/accommodation/progress/task obligations derived from approved extraction with explicit audit rows for task creation and AI-generated summaries, refreshed role summaries generated from approved obligations with copy/export/meeting handout controls, dashboard recent parent-summary visibility, source-traced previous/current IEP version-comparison manual intake, automated text-diff candidate generation, and human review with amendment-boundary notes, dashboard reminders and deadline review, simulated notification delivery/outbox tracking, implementation tasks with completion notes, classroom observations, evidence references, staff handoff acknowledgments, role-aware team collaboration comments, threaded replies, moderation review, collaboration moderation queue review with notification/retention boundaries, and staff-only portal access review records plus scoped invitation packages with parent/student evidence suppression, related-service provider service logging and recovery planning, service/accommodation implementation windows with evidence/logging requirements, assistive-technology and transportation access-support reviews, educational-placement and LRE implementation review, progress entry with measurement schedules, evidence references, and per-goal draft progress report packet language, meeting prep with teacher feedback, simulated calendar holds, recording/transcript source-readiness reviews, meeting transcript recap summaries, pre-read packet acknowledgments, scoped parent e-signature attestations with signature hashes, family questions, parent/team meeting preparation notes, companion Pennsylvania document readiness, visible draft-to-final changes, student voice and self-advocacy prep, language access with glossary clarification requests and staff explanations, and a concern/decision ledger, advisory quality review with formal human compliance-review escalation, administrator outcome records, district counsel routing, and counsel-response metadata that remains explicitly not legal certification, leadership continuity-risk tracking for vacancies and coverage plans, district implementation-readiness tracking for identity/SIS/notification/calendar/e-signature/WORM/OCR/source-lifecycle integrations plus data-protection readiness controls for encryption, backups, migrations, concurrency, and deployment hardening, separated school/district/system administrator role lenses for implementation review, district governance, and platform security/audit governance, drafting/training with guided questions, annotated sample cues, expanded FDS draft sections, versioned revisions, regenerated sections, and approval-gated export, JSON/DOCX/PDF exports plus district-system import-review JSON packages and export-template mapping reviews, source traceability, role-aware access, AI governance guardrail and citation/source-match evaluation with model profile metadata and digests, administrator session governance with demo revocation and identity lifecycle readiness review, audit anchor creation, external timestamp receipt recording, retention manifest sealing, retention policy review, accessibility review checks, accessibility remediation evidence with VPAT-style WCAG/Section 508 findings, audit logging, and a context-aware assistant drawer.

## Open the prototype

Open `iep-workspace-high-fidelity-wireframes.html` in a modern desktop browser to view the static high-fidelity wireframe reference. No installation, server, login, or internet connection is required for that file.

## Included views

- Caseload dashboard
- IEP review queue dashboard card with recent source upload status and extraction review navigation
- Recent parent summaries dashboard card with family-ready handouts and Family summary navigation
- Reminder center with task, progress, service, meeting, review, and draft-approval deadline prompts
- Notification outbox with simulated audience/channel delivery records for reminder and packet follow-up
- Read-only reviewer role lens with cross-caseload review visibility and mutation/export controls disabled
- School, district, and system administrator role lenses with separated student-review, district-governance, and platform-security boundaries
- Fictional student workspace with profile tabs, per-section workflow map statuses, source-aware team collaboration comments, threaded replies, moderation review, collaboration moderation queue review, staff-only portal access review and scoped invitation packages, preserved documents, and student activity
- Student profile intake, active caseload selection, and IEP source/structured-extraction review with student-scoped source-to-field mapping highlights, page-aware PDF anchors, OCR/source-quality review records, field-level source-anchor reviews, rejection, and regeneration controls
- Pennsylvania source registry, form-version metadata, multilingual source availability tracking, language-verification notes, administrator source-review tracking, source-entry administration/activation for future alignment, and annotated-source field guidance
- Role-specific teacher, family, student, and reviewer summaries with FDS audience-coverage checks, generated meeting handouts, source-aligned family/student understanding checks, prior/current IEP comparison intake and review with amendment-boundary notes, and selected-student pending states before source approval
- Implementation task center with completion evidence, classroom observations, staff handoff acknowledgments, and teacher checklist export
- Service-delivery tracking, implementation windows, evidence/logging requirements, missed-service recovery planning, assistive-technology and transportation access-support review, assessment accommodations, educational-placement rationale, and special-consideration visibility
- Goals, evidence, measurement schedules, progress monitoring, and per-goal draft progress report packets
- Meeting preparation, required-participant readiness, teacher feedback, simulated calendar holds, recording/transcript source-readiness reviews, transcript recap summaries, companion document readiness, family resource-guide tracking for rights/options and meeting questions, glossary clarification tracking for confusing IEP terms, pre-read packet acknowledgments, scoped parent e-signature attestations, family question submission, parent/team preparation notes, visible draft-to-final changes, student voice and self-advocacy updates, language-access coordination, concern decision records, and source-aware meeting-prep packet exports with review boundaries
- Advisory quality review with generated completeness findings, normalized structured-record section coverage, reviewer disposition notes, formal compliance-review escalation records, and district counsel routing records that are explicitly not legal certification
- Drafting and fictional training with FDS draft sections for present levels, special considerations, goals/objectives, services/supports, supplementary aids, assessment accommodations, behavior support, transition services, and placement rationale
- Source, source-review, export-template review, AI governance, formal compliance-review, district counsel routing, session-governance, identity lifecycle review, audit anchoring, external timestamp receipts, retention manifest, retention policy review, activity, and access audit trail
- Accessibility review checks for keyboard navigation, screen-reader labels, live status, language-access support, VPAT-style WCAG/Section 508 findings, and remediation evidence
- Leadership oversight dashboard with due-soon IEPs, overdue progress, service-log gaps, draft review, school flag rollups, staff continuity risks, vacancy coverage updates, district implementation-readiness and data-protection readiness tracking, and caseload overview
- Context-aware IEP assistant drawer scoped to the selected student, with explain, extraction-support, audience-aware parent/student/teacher summary generation, checklist, goal-measurability review, progress-monitoring support, draft IEP section generation, compare, meeting-prep, and fictional-training modes plus diagnosis/legal/final-decision refusals, missing-information prompts for sensitive drafting, and content labels for extracted content, user notes, AI suggestions, and human-review warnings

## Prototype interactions

Use the left navigation and student tabs to change views. Filters, task completion, upload/data-entry dialogs, recovery planning, role previews, search routing, meeting packet sharing, review actions, and the assistant are simulated.

All names and records are fictional. AI outputs and quality findings are labeled as advisory and subject to qualified human review.
