# IEP Manager native teacher client design specification

Status: implementation handoff, version 1.0  
Date: November 3, 2026  
Target: a separate SwiftUI iPhone client in this repository  
First delivery: internal TestFlight pilot using fictional student records

## Product intent

Build a focused teacher companion for three classroom questions: What needs my attention today? What support does this student need? What did I observe during instruction?

A teacher opens Today, scans priorities, opens a student from Classroom, checks an accommodation, and records an observation against an implementation task. The existing web application continues to serve intake, administrative review, governance, reporting, and complex record management.

This specification authorizes implementation planning and describes the desired build. Shipping to TestFlight still requires a configured Apple team, signing, bundle identifier, and App Store Connect app record. Production use with actual student records is a separate release gate.

## Scope and decisions

| Decision | Requirement |
| --- | --- |
| Client | Native SwiftUI screens; retain the existing React web application |
| Deployment target | iOS 17 or later; use APIs available on that baseline |
| Primary role | General education teacher; case manager can use the same focused experience within server permissions |
| Primary device | iPhone portrait; support landscape and larger text without clipping |
| Navigation | Today, Classroom, Account tabs, each with its own navigation stack |
| Writes | Task observations only in the first release |
| Accommodations | Read approved source language and relevant warnings; no edit or completion checkbox |
| Connectivity | Online writes; in-memory last-loaded data and unsaved drafts only; no offline write queue |
| Pilot data | Fictional records only; clearly marked demo environment |
| Web handoff | Open configured HTTPS web application in the system browser |

Defer service logging, progress scoring, task completion, roster review submission, document intake/OCR, meetings, messaging, parent/student portals, push notifications, biometrics, attachments, signatures, AI generation, and offline synchronization. Do not build placeholder tabs for these features.

## Core user journey

1. Sign in to the configured environment.
2. See Today with the date, last successful refresh, and actionable assigned tasks.
3. Open Classroom and select a class period.
4. Select a linked student and inspect their accommodations and implementation tasks.
5. Tap Record observation, confirm the implementation task, enter context and an objective note, and save.
6. See the saved observation with server-authenticated author and timestamps. Returning to the student after refresh shows the same entry.

Target usability: find a student's accommodations within three taps from Classroom; save a short observation within one minute after opening a student. These are design targets to evaluate with pilot teachers.

## Screen specifications

### Sign in

Show app name, environment label, username, secure password field, Sign in, and a concise error area. Disable repeated submissions while authenticating. Keep credentials out of logs and analytics. Do not ship a role switcher or embed demo credentials in the client. Document the fictional pilot account separately in developer setup instructions.

Successful authentication loads the authorized workspace before entering Today. A role other than generalEducation or caseManager receives an unsupported-role screen with Sign out; authorization must also be enforced by the API. Distinguish invalid credentials, unavailable server, and session expiration.

### Today

Use a large Today navigation title, date, greeting using the authenticated teacher's name, and a last-updated label. Provide pull to refresh. The main content is a grouped native list:

1. Overdue: actionable tasks with a due date before today.
2. Due today: actionable tasks dated today.
3. Upcoming: actionable tasks in the next seven calendar days.

Only include tasks within authorized student scope, tied to a resolvable student, and assigned to the current teacher. Existing data includes display-name assignment strings, so the coding agent must establish an explicit assignment mapping or add a stable assignee user ID; never assume every visible task belongs to the teacher. Keep ambiguous assignments in the student's task list with an ownership label, outside the assigned Today queue.

Each row shows task title, student name, due date, and status text. Tapping opens student detail with the relevant task selected. Within a group, sort due date ascending, then student name and stable task ID. Use the existing task status semantics after inspecting the fixtures and web implementation; document the actionable-status mapping. Never infer a legal compliance finding from an overdue date.

Use the configured school time zone for calendar-day grouping. Store date-only due dates as calendar dates, not UTC instants. Inject a clock and time zone for deterministic previews and tests. Old fictional fixtures may yield many overdue tasks; label their original dates faithfully. Demo previews may use separate documented relative-date fixtures.

Show count labels as task counts, not student counts. Undated tasks remain available in student detail. An empty state reads No assigned tasks due in the next seven days, with a Browse classroom action. Do not imply every student is fully supported or compliant.

### Classroom

Place a class-period menu below the title, followed by search and an optional High priority filter. Remember the selected class period in local preferences; validate it against each refreshed authorized roster. Derive options from visible roster entries; do not hardcode Period 2.

Default sort is High, Medium, Low, unknown, then student name and roster ID. Search matches student name within the selected period, case insensitively. Rows contain name, grade, explicit priority text, a short support summary, and linked-record or summary-only status. Secondary counts may show accommodations and open tasks where provided; distinguish roster summary counts from live record counts.

The current seed contains 15 roster rows and some rows have no linkedStudentId. Preserve those rows as summary-only entries. Tapping one opens a summary screen containing only the returned roster fields, sourceTrace, officialRecordStatus, and lastReviewedAt. Show Full student record unavailable and disable observation entry. Never fabricate student details or convert a roster ID into a student ID.

For linked rows, resolve the referenced student against the authorized response. If missing or denied, show Record unavailable, retain the safe returned roster summary, and offer Refresh. Do not request other student records to bypass the missing link.

### Student detail

Use the student's name as the title with grade and class-period context. Never rely on color to identify the student. Sections, in order:

1. Support overview: approved summary if available, explicit source status, and any missing or unapproved source warning.
2. Accommodations: exact descriptions with setting, frequency, responsible role, source reference, effective dates, and ambiguity where supplied.
3. Implementation tasks: title, responsibility, due date, status, source reference/alignment, and Record observation action for eligible tasks.
4. Recent observations: newest enteredAt first, with task, observation date, context, note, support used, and server author.
5. Open full workspace on web.

Resolve accommodations through the student's applicable IEP IDs; do not use the workspace's current-student selection or collect all workspace accommodations. Establish the applicable/current IEP relationship from the existing model. Show draft/unapproved, expired, and future-effective records with their actual status; do not present them as current approved instructions. Empty and unknown are different states.

Keep accommodation text verbatim. For example, extended time with an unspecified amount must retain the ambiguity; the client must not invent a multiplier. A source row opens native source metadata, not a fabricated page viewer. Document preview is outside this release.

Record observation opens an editor with the selected task. A student-level Record observation action first requires choosing an eligible task; if none exists, show No implementation task available for an observation. Do not silently create a generic task or free-standing note.

### Observation editor

Present a native sheet with Cancel and Save in the toolbar. Display the student's name and selected task at the top throughout editing.

| Field | Behavior |
| --- | --- |
| Implementation task | Required authorized task; selected from the student's eligible tasks |
| Observation date | Required calendar date, defaults to today in school time zone; future dates blocked |
| Context | Required trimmed text, such as Independent reading |
| Observation | Required multiline text; prompt Describe what you saw and the student's response |
| Support used | Optional text; example Visual checklist |

Validate required fields inline. Keep Save disabled until valid and while saving. Client limits: context 200 characters, note 4,000, support 500. Add matching API validation as an explicit backend change; reject overlength submissions without silently truncating them. Allow earlier observation dates. Do not include an author picker or allow the client to override enteredBy.

Cancel or swipe dismissal with changes asks Keep editing or Discard. After an acknowledged successful response, update from returned server data, dismiss, show Observation saved, and expose the new row in recent observations. Do not show success before server acknowledgment.

On validation failure, retain text and focus the invalid field. On network failure, retain the draft in memory and show an actionable message. If the server may have committed before a timeout, reconcile with idempotency before retry; do not append a second observation. A 403 or removed task blocks saving and explains that access or task availability changed. A 401 requires sign-in; preserve the draft in memory only for the same authenticated user and recheck access before restoring it. Clear drafts when changing accounts or signing out. Process termination loses unsaved drafts; state that in the editor when connectivity fails.

### Account

Display authenticated name, role, district, environment, app version/build, last refresh, privacy/support links when configured, Open web workspace, and Sign out. Sign out clears the token, workspace, drafts, navigation paths, and user-specific preferences. Local logout must work without network access; use server revocation only if a supported self-session endpoint exists.

## Visual and accessibility design

Use native typography, system background/grouped surfaces, SF Symbols, standard back navigation, and one restrained blue accent. Use semantic system red and orange for labeled overdue and attention states. Avoid desktop tables, dashboard grids, custom tab bars, or dense badge clusters. Use consistent 16-point horizontal content spacing and at least 44 by 44 point interactive targets.

Support light/dark mode, Dynamic Type including accessibility sizes, VoiceOver, reduced motion, and increased contrast. Stack secondary row content at large sizes. Read names, due dates, and priority text in a useful VoiceOver order. Never communicate severity only through red/green. Keep Save and validation messages reachable while the keyboard is visible. Do not require haptics or animation to understand results.

## API integration and required backend work

Existing implementation references: `src/api.js`, `src/data.js`, `src/App.jsx`, `server/api.js`, `server/auth.js`, and `server/permissions.js`. Verify contracts against code at implementation time. The repository uses demo authentication and local JSON persistence today.

| Existing endpoint | Current behavior and native use |
| --- | --- |
| POST /api/auth/login | Username/password login; inspect the actual session response and decode its token/user fields |
| GET /api/workspace | Returns workspace, role, user; bootstrap authorized roster, students, IEPs, accommodations, tasks |
| POST /api/tasks/{taskId}/observations | Creates a task observation; requires recordObservation and student access |
| PATCH /api/workspace/current-student | Mutates shared workspace selection; avoid for native navigation |

Use Authorization: Bearer with the session token for protected calls. Keep selected student and tab local to the native client. Native navigation must not alter shared currentStudentId. Mutation responses currently include the created object's fields, latestAuditEvent, and filtered workspace. Decode the actual envelope instead of assuming a generic result wrapper.

Observation body example:

```json
{
  "observedAt": "2026-11-03",
  "context": "Independent reading",
  "note": "Used the organizer to identify two supporting details after one verbal prompt.",
  "supportUsed": "Graphic organizer"
}
```

The existing endpoint has no demonstrated idempotency support. Before enabling retryable native writes, extend it to accept an Idempotency-Key UUID. Scope keys to authenticated user, endpoint, and task; same key plus same payload returns the original result, and same key with a different payload returns conflict. Store the key and write result atomically with the observation so restart/retry cannot duplicate observations or audit events. Set a documented retention window of at least 24 hours. Keep one key for all attempts of the same submission; generate a new key only for a distinct observation. Add real calendar-date validation and reject future observedAt dates using the configured school time zone.

Reuse server permission and student-scope enforcement. UI hiding supplements those checks. Add authoritative stable assignee identity for Today if the current model cannot reliably establish ownership. Preserve the web app's existing contracts with additive fields and regression coverage.

For the fictional internal pilot, the existing filtered workspace endpoint is acceptable after confirming its scoped data. Before real records, provide a minimized teacher response and demonstrate teacher, class, student, and district isolation server-side. Roster summaries themselves contain student information and need authorization even when their student link is empty.

## Native architecture

Place the client under `ios/IEPManager/` with a checked-in Xcode project, shared scheme, and setup README. Use SwiftUI, Foundation URLSession, Codable DTOs, and async/await. Avoid a third-party networking dependency unless needed for a documented requirement.

Suggested boundaries: App/session and environment configuration; Networking/APIClient and errors; Models/DTOs and domain adapters; Features/Today, Classroom, Student, Observation, Account; Shared components; Fixtures; Tests. Keep view state local where practical; use an app-owned observable session and workspace store. Inject an API protocol, clock, and time zone for previews and tests. Use typed routes containing stable IDs and item-driven sheets. Cancel obsolete loads and prevent older responses from overwriting newer state or a different signed-in user's data.

Decode only required fields and tolerate unrelated additive JSON fields. Unknown enum values must show a safe unknown state rather than crash. Keep domain filtering and date rules outside view rendering. Native views must not run JavaScript or import the React UI.

Use Keychain for session tokens, with device-only, unlocked-device access. Keep passwords ephemeral and clinical/student text out of logs, crash breadcrumbs, and analytics. Keep workspace/drafts in memory for this release, disable disk URL caching of protected responses, and cover content in the app-switcher snapshot. Revalidate sessions when returning to foreground; hide student content during authentication failures. Automatic device screenshots cannot be treated as prevented by the app.

Use separately configured API and web HTTPS base URLs for staging. Debug simulator builds may use the Mac's loopback API with a narrow development exception. A physical device needs a reachable server; 127.0.0.1 on the phone is the phone. TestFlight must not depend on a developer's running Mac or contain a broad transport-security exception. Do not silently fall back to fictional data when staging fails; provide a separate explicitly labeled fixture mode for previews and development.

Web handoff uses a configured HTTPS origin without bearer tokens or student names in URLs. Verify whether the web app supports student-specific links before adding them; otherwise open its root with normal web sign-in. Explain that web authentication may be separate.

## State and error requirements

Every data screen needs initial loading, loaded, empty, refresh failure with last-loaded content, and unavailable states. Refresh failure must display the actual last successful update time and a Retry action. Read-only retained content may remain in memory during a temporary network interruption; disable Save until an authenticated request can be attempted. Refresh after a successful write and on foreground return, while protecting unsaved edits from replacement.

Prevent cross-account stale content, wrong-student writes during rapid navigation, and duplicate save taps. A source unavailable state must not read No accommodations. A denied student must not reveal details through search, errors, previews, or cached navigation.

## Acceptance criteria and implementation sequence

1. Create the native project and fixtures. Build on simulator with Today, Classroom, Account, typed navigation, and accessible loading/empty/error states.
2. Implement authentication, configurable environments, token handling, and authorized workspace decoding. Verify account switching clears all prior data.
3. Implement roster periods/search/priority sorting and both linked and summary-only student routes. The 15-row fictional classroom remains intact; summary-only rows cannot record observations.
4. Implement Student detail and exact source-bound accommodation rendering. Test unapproved, expired, missing-source, ambiguous, and inaccessible records.
5. Add backend validation, stable task assignment where required, and atomic idempotency; implement editor and saved-observation history. Verify save persists after reload and retry does not duplicate records or audit events.
6. Verify Today date grouping across midnight/time zones and assignment scope. Test with an injected clock rather than changing source dates.
7. Exercise the full path on an iPhone simulator and physical device, including keyboard, Dynamic Type, VoiceOver, dark mode, denied access, revoked session, failed save, timed-out acknowledgment, and multiple-account scenarios.
8. Produce a signed internal TestFlight candidate when Apple configuration is available. Report the archive/upload/build identifier and processing result separately; a simulator build does not count as TestFlight delivery.

Automated coverage must include DTO decoding from real sanitized response fixtures, student/IEP association, assignment/date rules, forbidden access, editor validation, and idempotency across server restart. Add native UI smoke coverage for login → roster → linked student → observation → confirmed saved row. Run existing relevant API/web regression checks when changing shared endpoints.

Definition of done: native app builds; this journey works against the staging API with fictional records; required checks pass; no server bypasses or fake-success writes exist; setup instructions explain API hosting, sample accounts, scheme, minimum OS, signing inputs, and known limitations. Real-record use additionally requires production identity, hosting, storage, privacy/security, and district operational readiness; internal fictional-data completion does not establish those controls.

## Coding agent starting instruction

Implement this specification in the existing repository. Inspect applicable AGENTS.md instructions and current API contracts first. Preserve web workflows, use native SwiftUI screens, and start with the fictional-data pilot. Work through the acceptance sequence, documenting any contract changes and running the relevant checks. Ask only for missing external configuration such as Apple team identity or staging hosting access when it becomes necessary; do not substitute insecure defaults. Deliver the implementation, setup README, validation results, and explicit remaining release blockers.

## Platform references

- [Apple NavigationStack](https://developer.apple.com/documentation/swiftui/navigationstack): native stack navigation.
- [Apple Keychain services](https://developer.apple.com/documentation/security/keychain-services/): protected storage for session secrets.
- [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/): beta distribution and tester setup.
