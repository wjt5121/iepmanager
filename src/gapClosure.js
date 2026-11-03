const GAP_CLOSURE_VERSION = "FDS-gap-closure-1.0";

const defaults = {
  gapClosure: {
    version: GAP_CLOSURE_VERSION,
    status: "In readiness review",
    scope: "Functional design, local MVP controls, and district production readiness",
    owner: "District special education leadership",
    lastReviewedBy: "D. Nguyen",
    lastReviewedAt: "2026-06-22T11:30:00",
    reviewHistory: [],
    workflowAcceptance: [
      {
        id: "morning-priorities",
        name: "Morning priority review",
        entryPoint: "Overview",
        expectedOutcome: "Teacher can identify urgent deadlines, missing evidence, service gaps, and open follow-up work in under five minutes.",
        evidence: "Prioritized reminders, attention queue, deadline metrics, and student-scoped navigation",
        status: "Covered in local MVP"
      },
      {
        id: "before-instruction",
        name: "Before-instruction review",
        entryPoint: "Student workspace",
        expectedOutcome: "Teacher can review current goals, accommodations, services, and recent implementation evidence before instruction.",
        evidence: "Student profile, normalized IEP record, implementation tasks, services, and progress views",
        status: "Covered in local MVP"
      },
      {
        id: "in-flow-capture",
        name: "In-flow documentation",
        entryPoint: "Implementation, Services, and Progress",
        expectedOutcome: "Teacher can record progress, service delivery, observations, and completion evidence in short interactions.",
        evidence: "Quick progress entry, service log, task observation, and completion-evidence actions",
        status: "Covered in local MVP"
      },
      {
        id: "meeting-preparation",
        name: "Meeting preparation",
        entryPoint: "Meetings",
        expectedOutcome: "Team can identify missing preparation, collect family and student input, and review source-grounded summaries before a meeting.",
        evidence: "Meeting readiness, questions, pre-read packet, language access, participant, and summary workflows",
        status: "Covered in local MVP"
      },
      {
        id: "post-meeting-follow-up",
        name: "Post-meeting follow-up",
        entryPoint: "Meetings and Implementation",
        expectedOutcome: "Human-reviewed decisions and follow-up work remain linked to the meeting and student without changing the official IEP automatically.",
        evidence: "Draft-to-final decisions, transcript recap, concerns, follow-up tasks, and official-record labels",
        status: "Covered in local MVP"
      },
      {
        id: "end-of-day-review",
        name: "End-of-day continuity review",
        entryPoint: "Overview",
        expectedOutcome: "Teacher can confirm completed documentation and see remaining or upcoming work without rebuilding a separate list.",
        evidence: "Reviewed reminders, task status, recent activity, notifications, and upcoming deadline queue",
        status: "Covered in local MVP"
      }
    ],
    complianceChecklist: [
      {
        id: "ferpa-access",
        requirement: "Role and student-scope access",
        status: "Design control implemented",
        evidence: "Server-enforced role permissions, student assignment checks, and response filtering",
        owner: "Privacy officer",
        nextReviewDate: "2026-08-15"
      },
      {
        id: "audit-accountability",
        requirement: "Sensitive-action accountability",
        status: "Local control implemented",
        evidence: "Actor, role, timestamp, subject, and hash-linked audit events",
        owner: "Records officer",
        nextReviewDate: "2026-08-29"
      },
      {
        id: "draft-boundary",
        requirement: "Draft and official-record separation",
        status: "Design control implemented",
        evidence: "Lifecycle labels, approval-gated draft exports, and non-submission district packages",
        owner: "Special education compliance lead",
        nextReviewDate: "2026-08-22"
      },
      {
        id: "district-policy",
        requirement: "District and state policy validation",
        status: "District validation required",
        evidence: "Local controls are not legal certification; district retention, notice, approval, and records rules remain controlling",
        owner: "District counsel / compliance lead",
        nextReviewDate: "2026-09-12"
      },
      {
        id: "security-production",
        requirement: "Production security and data protection",
        status: "Production blocked",
        evidence: "Identity provider, tenant isolation, encryption, backups, monitoring, and incident response require production implementation",
        owner: "Technology director",
        nextReviewDate: "2026-09-30"
      }
    ]
  },
  rolePolicyMatrix: [
    rolePolicy("caseManager", "Special education teacher / case manager", "Assigned caseload", "Create and review student workflow records", "Student records and implementation evidence"),
    rolePolicy("generalEducation", "General education teacher", "Assigned classes and students", "Implement supports and contribute evidence", "Instructional obligations and relevant summaries"),
    rolePolicy("relatedServiceProvider", "Related service provider", "Assigned service caseload", "Document service delivery and progress", "Relevant goals, services, and meeting preparation"),
    rolePolicy("parent", "Parent / guardian", "Own student", "Contribute input and review family-visible information", "Family summary, meeting preparation, and shared records"),
    rolePolicy("student", "Student", "Own record", "Contribute voice and self-advocacy input", "Student summary, goals, supports, and shared meeting preparation"),
    rolePolicy("administrator", "Administrator / compliance reviewer", "Authorized district caseload", "Review quality, compliance, security, and governance", "Operational indicators and authorized student review records"),
    rolePolicy("schoolAdministrator", "School administrator", "Authorized school caseload", "Review school-level risk and continuity", "School operational indicators and authorized student records"),
    rolePolicy("districtAdministrator", "District administrator", "Authorized district caseload", "Manage district readiness and governance", "District configuration, readiness evidence, and authorized student records"),
    rolePolicy("systemAdministrator", "System administrator", "No student scope by default", "Manage technical security and system governance", "Security posture and configuration without student records"),
    rolePolicy("readOnlyReviewer", "Read-only reviewer", "Explicitly authorized review scope", "Inspect records without mutation", "Authorized review evidence only")
  ],
  recordLifecycleRules: [
    lifecycleRule("official-iep-source", "Official IEP source document", "Official source", "District-controlled", true, true, "Authorized district process", "The district-approved IEP remains the controlling record."),
    lifecycleRule("structured-extraction", "Structured extraction", "Needs review", "Human approved", false, true, "Case manager", "Extracted fields support implementation and do not replace the source IEP."),
    lifecycleRule("ai-assisted-content", "AI-assisted draft or summary", "Draft - human review required", "Human reviewed", false, false, "Qualified educator", "AI-assisted text must remain labeled, cited, editable, and unshared until reviewed."),
    lifecycleRule("daily-documentation", "Progress, service, and implementation documentation", "Working record", "Submitted by authorized staff", false, true, "Assigned staff", "Daily documentation is evidence for review and is not an automatic IEP amendment."),
    lifecycleRule("meeting-communication", "Meeting and communication record", "Preparation / follow-up", "Human reviewed", false, true, "IEP team member", "Meeting notes and communication history do not finalize team decisions by themselves."),
    lifecycleRule("district-import-package", "District-system import package", "Review package", "District template reviewed", false, true, "District administrator", "Packages are import-review artifacts with officialSubmission false until handled by the district system.")
  ],
  integrationSources: [
    integrationSource("official-iep-system", "Official district IEP system", "Official IEP and eligibility records", "Outbound review package", "No live integration", "Special education data lead", "Production blocked", "2026-09-15"),
    integrationSource("student-information-system", "Student information system", "Roster, enrollment, school, and guardian relationships", "Inbound roster sync", "Manual demo roster", "Data services lead", "Readiness review", "2026-08-30"),
    integrationSource("identity-provider-source", "District identity provider", "Identity, role, and account lifecycle", "Inbound authentication and provisioning", "Demo Auth", "Technology director", "Production blocked", "2026-08-15"),
    integrationSource("calendar-source", "District calendar", "Meeting holds and participant scheduling", "Two-way scheduling", "Simulated calendar", "Special education operations", "Readiness review", "2026-09-12"),
    integrationSource("notification-source", "District communication provider", "Approved delivery status and contact channels", "Outbound delivery with receipts", "Simulated outbox", "Family engagement coordinator", "Production blocked", "2026-09-05"),
    integrationSource("document-source", "District document repository", "Preserved source documents and approved artifacts", "Two-way document exchange", "Local development storage", "Records officer", "Production blocked", "2026-09-30")
  ],
  alertRules: [
    alertRule("annual-review-deadline", "Annual review deadline", "Compliance timeline", 30, "Critical", "Case manager and administrator"),
    alertRule("reevaluation-deadline", "Reevaluation deadline", "Compliance timeline", 60, "Critical", "Case manager and administrator"),
    alertRule("missing-progress", "Missing progress evidence", "Progress monitoring", 7, "High", "Case manager"),
    alertRule("service-gap", "Service documentation gap", "Service delivery", 1, "Critical", "Provider and case manager"),
    alertRule("meeting-preparation", "Incomplete meeting preparation", "Meeting readiness", 7, "High", "Case manager"),
    alertRule("communication-follow-up", "Communication follow-up due", "Communication", 3, "Normal", "Assigned staff")
  ],
  successMetrics: [
    successMetric("daily-orientation-time", "Daily orientation time", "Median time from sign-in to first priority action", "minutes", "Not measured", "<= 5", "Lower", "Monthly", "Product owner"),
    successMetric("documentation-completion", "Documentation completion", "Required daily documentation completed by due date", "percent", "Not measured", ">= 95", "Higher", "Weekly", "Special education operations"),
    successMetric("progress-adherence", "Progress-monitoring adherence", "Active goals with evidence collected at the specified frequency", "percent", "Not measured", ">= 90", "Higher", "Reporting period", "Case management lead"),
    successMetric("meeting-prep-lead", "Meeting preparation lead time", "Meetings with required preparation complete seven days before the meeting", "percent", "Not measured", ">= 90", "Higher", "Monthly", "Compliance coordinator"),
    successMetric("overdue-follow-up", "Overdue follow-up rate", "Open meeting, communication, and compliance tasks past due", "percent", "Not measured", "<= 5", "Lower", "Weekly", "Special education operations"),
    successMetric("service-gap-resolution", "Service gap resolution", "Documented service gaps with owner, plan, and family communication", "percent", "Not measured", ">= 95", "Higher", "Monthly", "Related services lead"),
    successMetric("search-reduction", "Cross-system search reduction", "Teacher-reported reduction in time spent locating current student information", "percent", "Not measured", ">= 40", "Higher", "Quarterly", "Product owner"),
    successMetric("teacher-burden", "Administrative burden", "Teacher-reported weekly administrative effort for included workflows", "hours", "Not measured", "20% reduction", "Lower", "Quarterly", "District special education leadership")
  ],
  officialRecordBoundary: {
    label: "Working workspace - not the official IEP record",
    officialSubmission: false,
    controllingSource: "The district-approved IEP and district systems remain controlling.",
    draftLabelRequired: true,
    sourceReferencesRequiredForGeneratedContent: true,
    generationMetadataRequired: true,
    humanReviewRequired: true,
    officialReadyDefinition: "Human-reviewed district import package or artifact handled through the district-approved records process.",
    prohibitedActions: [
      "Automatically amend or finalize an IEP",
      "Automatically communicate generated content to families",
      "Make eligibility, placement, diagnosis, or legal decisions",
      "Mark a local export as an official submission"
    ]
  }
};

function rolePolicy(roleId, roleLabel, studentScope, defaultAccess, visibleInformation) {
  return {
    roleId,
    roleLabel,
    studentScope,
    defaultAccess,
    visibleInformation,
    status: "Policy documented",
    owner: "Privacy officer",
    nextReviewDate: "2026-09-01",
    note: "Runtime permissions remain server-enforced and require district validation before production."
  };
}

function lifecycleRule(id, name, draftStatus, reviewedStatus, officialReady, exportable, requiredReviewRole, boundaryLabel) {
  return {
    id,
    name,
    draftStatus,
    reviewedStatus,
    officialReady,
    exportable,
    requiredReviewRole,
    boundaryLabel,
    status: officialReady ? "District controlled" : "Workspace boundary enforced",
    reviewNote: "Review transitions and district policy before production use."
  };
}

function integrationSource(id, name, sourceOfTruth, direction, provider, owner, status, nextReviewDate) {
  return {
    id,
    name,
    sourceOfTruth,
    direction,
    provider,
    owner,
    status,
    nextReviewDate,
    boundary: "Readiness record only; no live exchange or automatic official-record update is enabled.",
    reviewNote: "Confirm identifiers, field mapping, error handling, access scope, retention, and reconciliation before pilot use."
  };
}

function alertRule(id, name, category, triggerDays, priority, escalationRole) {
  return {
    id,
    name,
    category,
    triggerDays,
    priority,
    escalationRole,
    enabled: true,
    status: "Active in local rules",
    reviewNote: "District must validate trigger windows, escalation ownership, and notification policy."
  };
}

function successMetric(id, name, definition, unit, baseline, target, direction, reviewCadence, owner) {
  return {
    id,
    name,
    definition,
    unit,
    baseline,
    target,
    direction,
    reviewCadence,
    owner,
    status: "Measurement design ready",
    evidenceSource: "Pilot analytics and teacher workflow study required",
    reviewNote: "Capture baseline before interpreting target progress."
  };
}

export function createDefaultGapClosureWorkspace() {
  return clone(defaults);
}

export function normalizeGapClosureWorkspace(workspace = {}) {
  const fallback = createDefaultGapClosureWorkspace();
  return {
    ...workspace,
    gapClosure: {
      ...fallback.gapClosure,
      ...(workspace.gapClosure || {}),
      workflowAcceptance: arrayOrFallback(workspace.gapClosure?.workflowAcceptance, fallback.gapClosure.workflowAcceptance),
      complianceChecklist: arrayOrFallback(workspace.gapClosure?.complianceChecklist, fallback.gapClosure.complianceChecklist),
      reviewHistory: Array.isArray(workspace.gapClosure?.reviewHistory) ? workspace.gapClosure.reviewHistory : []
    },
    rolePolicyMatrix: arrayOrFallback(workspace.rolePolicyMatrix, fallback.rolePolicyMatrix),
    recordLifecycleRules: arrayOrFallback(workspace.recordLifecycleRules, fallback.recordLifecycleRules),
    integrationSources: arrayOrFallback(workspace.integrationSources, fallback.integrationSources),
    alertRules: arrayOrFallback(workspace.alertRules, fallback.alertRules),
    successMetrics: arrayOrFallback(workspace.successMetrics, fallback.successMetrics),
    officialRecordBoundary: {
      ...fallback.officialRecordBoundary,
      ...(workspace.officialRecordBoundary || {}),
      prohibitedActions: arrayOrFallback(
        workspace.officialRecordBoundary?.prohibitedActions,
        fallback.officialRecordBoundary.prohibitedActions
      )
    }
  };
}

function arrayOrFallback(value, fallback) {
  return Array.isArray(value) ? value : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
