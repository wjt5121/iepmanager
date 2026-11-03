import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  GraduationCap,
  HelpCircle,
  Home,
  ListChecks,
  Lock,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X
} from "lucide-react";
import {
  applyApprovedExtractionObligations,
  createAuditEvent,
  createDemoExtraction,
  defaultSourceAlignment,
  generateCompletenessReviewFlags,
  initialWorkspace,
  mergeExtractionSectionsIntoStructuredRecord,
  normalizeGapClosureWorkspace,
  normalizeStructuredIepRecord,
  refreshRoleSummariesFromWorkspace,
  roles,
  schemaSections,
  summaryCoverageItemsForWorkspace
} from "./data.js";
import { ApiError, downloadExportArtifact, downloadRetentionPackage, loadWorkspace, loginAsRole, mutateWorkspace } from "./api.js";
import { GapClosurePanel } from "./GapClosurePanel.jsx";

const LOCAL_WORKSPACE_KEY = "iep-workspace-state-v2";
const LOCAL_PREFS_KEY = "iep-workspace-prefs-v1";

const views = [
  { id: "dashboard", label: "Overview", icon: Home },
  { id: "student", label: "Student workspace", icon: Users },
  { id: "intake", label: "IEP intake", icon: FileText },
  { id: "summary", label: "Plan summary", icon: BookOpen },
  { id: "implementation", label: "Implementation", icon: ListChecks },
  { id: "services", label: "Services", icon: Clock3 },
  { id: "progress", label: "Progress", icon: BarChart3 },
  { id: "meetings", label: "Meetings", icon: CalendarDays },
  { id: "review", label: "Quality review", icon: ShieldCheck },
  { id: "drafting", label: "Drafting & training", icon: GraduationCap },
  { id: "audit", label: "Audit trail", icon: Lock },
  { id: "admin", label: "Leadership", icon: Building2 }
];

const assistantModes = [
  "Explain",
  "Extract",
  "Summarize",
  "Checklist",
  "Review",
  "Progress",
  "Draft",
  "Compare",
  "Prepare for meeting",
  "Generate fictional training example"
];

const notificationAudienceOptions = [
  ["family", "Family"],
  ["student", "Student"],
  ["staff", "Assigned staff"],
  ["team", "IEP team"]
];

const teamCommentVisibilityOptions = ["IEP team", "Staff only", "Family visible", "Student visible"];
const teamCommentModerationStatusOptions = [
  "Pending review",
  "Approved for IEP team",
  "Visibility limited",
  "Needs follow-up",
  "Archived from family view"
];
const teamCommentQueueStatusOptions = [
  "Queue reviewed",
  "Needs moderation",
  "Family follow-up needed",
  "Retention hold",
  "Ready for archive"
];
const teamCommentRetentionDecisionOptions = [
  "Retain in audit trail",
  "Retain with staff-only visibility",
  "Prepare for archive",
  "Legal hold recommended"
];
const retentionPolicyScopeOptions = [
  "IEP implementation workspace",
  "Audit trail and retention manifests",
  "Source documents and extracted records",
  "Exports and district-system packages",
  "Collaboration and notification records"
];
const retentionPolicyDispositionOptions = [
  "Policy reviewed",
  "District schedule needed",
  "Legal hold active",
  "Archive blocked",
  "Ready for district approval"
];
const retentionLegalHoldOptions = ["No hold", "Potential hold", "Legal hold active", "Counsel review needed"];
const retentionArchiveDecisionOptions = ["Retain", "Retain with hold", "Archive eligible", "Archive blocked", "Purge prohibited"];
const exportTemplateValidationStatusOptions = [
  "Template review needed",
  "Mapping validated locally",
  "District import review ready",
  "Blocked - district system needed",
  "Production submission prohibited"
];
const exportTemplateMappingStatusOptions = [
  "Mapping draft",
  "Required sections mapped",
  "Field-level review needed",
  "District schema mismatch",
  "Pilot mapping approved"
];
const exportTemplateSubmissionModeOptions = [
  "Local review package only",
  "District import review",
  "Pilot import queued",
  "Production submission blocked",
  "No live integration"
];
const identityLifecycleStatusOptions = [
  "Needs production identity provider",
  "Lifecycle review scheduled",
  "SSO mapping in review",
  "MFA policy ready",
  "Production blocked"
];
const identityMfaStatusOptions = [
  "Demo password only",
  "MFA policy required",
  "MFA mapping in review",
  "MFA ready for pilot",
  "MFA exception review needed"
];
const tenantBoundaryStatusOptions = [
  "Single-district demo tenant",
  "Tenant boundary review needed",
  "Cross-tenant access blocked locally",
  "Multi-district isolation design pending",
  "Pilot boundary approved"
];
const roleProvisioningStatusOptions = [
  "Manual demo roles",
  "Role mapping review needed",
  "SIS/IdP mapping drafted",
  "Deprovisioning workflow needed",
  "Pilot provisioning approved"
];
const notificationChannelOptions = ["In-app", "Email", "SMS", "Printed packet"];
const calendarProviderOptions = ["District calendar (simulated)", "Google Calendar (simulated)", "Outlook (simulated)", "Manual hold"];
const calendarAttendanceModeOptions = ["In person", "Video option", "Phone", "In person with video option"];
const accessSupportStatusOptions = ["Active", "Needs review", "Implementation pending", "Not required", "Resolved"];
const placementReviewStatusOptions = ["Source aligned", "Needs review", "Implementation follow-up", "Team clarification needed", "Resolved"];
const portalAccessStatusOptions = [
  "Access verified",
  "Needs guardian verification",
  "Student access limited",
  "Portal access suspended",
  "Language/support follow-up needed"
];
const portalVerificationMethodOptions = [
  "District portal check",
  "In-person review",
  "Phone confirmation",
  "Student conference",
  "Signed packet review"
];
const portalAccessSubjectRoleOptions = ["Parent/Guardian", "Student"];
const portalInvitationDeliveryOptions = ["District portal invite", "Secure email", "Printed activation packet", "In-person activation"];
const portalInvitationStatusOptions = ["Prepared for review", "Ready to send", "Provider queued", "On hold - verification needed"];
const complianceReviewStatusOptions = ["Requested", "In review", "Returned for revision", "Closed - reviewed"];
const districtIntegrationStatusOptions = [
  "Demo only",
  "Readiness review",
  "Pilot approved",
  "Production blocked",
  "Production approved"
];
const accessibilityFindingStatusOptions = [
  "Open",
  "Remediation planned",
  "In remediation",
  "Ready for retest",
  "Verified",
  "Accepted with exception"
];
const accessibilityFindingSeverityOptions = ["Low", "Medium", "High"];
const iepComparisonStatusOptions = [
  "Needs team review",
  "Reviewed for meeting",
  "Needs source follow-up",
  "Shared in family summary"
];
const iepAmendmentReviewStatusOptions = [
  "No amendment indicated",
  "Amendment review needed",
  "Amendment routed to team",
  "Documented outside workspace"
];
const iepAutoDiffSectionConfigs = [
  {
    section: "Present levels",
    keywords: ["present level", "strength", "need", "baseline", "performance"],
    changeType: "Automated present-level change",
    title: "Auto-diff found changed present-level language",
    implementationImpact:
      "The team should confirm whether the changed present-level language affects goals, supports, or service decisions.",
    familySummary:
      "The description of current performance changed, so the team should explain what is different and why it matters."
  },
  {
    section: "Goals and progress monitoring",
    keywords: ["goal", "objective", "progress", "probe", "accuracy", "mastery", "measure"],
    changeType: "Automated goal/progress change",
    title: "Auto-diff found changed goal or progress language",
    implementationImpact:
      "Staff should confirm whether the changed goal or progress-monitoring language changes data collection, measurement, or reporting responsibilities.",
    familySummary:
      "A goal or progress-monitoring statement changed, so the team should explain what skill is measured and how progress will be checked."
  },
  {
    section: "Services",
    keywords: ["service", "speech", "language", "reading support", "minutes", "frequency", "duration", "location", "small group"],
    changeType: "Automated service-delivery change",
    title: "Auto-diff found changed service-delivery language",
    implementationImpact:
      "The case manager and provider should confirm whether service frequency, duration, location, or responsible staff changed.",
    familySummary:
      "Service language changed, so the team should explain what support will be delivered, how often, where, and by whom."
  },
  {
    section: "Accommodations",
    keywords: ["accommodation", "extended time", "directions", "organizer", "assessment", "test", "assignment"],
    changeType: "Automated accommodation change",
    title: "Auto-diff found changed accommodation language",
    implementationImpact:
      "General education staff should confirm whether the accommodation trigger, setting, amount, or implementation routine changed.",
    familySummary:
      "Accommodation language changed, so the team should explain what support is available and when it should be used."
  },
  {
    section: "Behavior support",
    keywords: ["behavior", "positive behavior", "support plan", "fba", "de-escalation"],
    changeType: "Automated behavior-support change",
    title: "Auto-diff found changed behavior-support language",
    implementationImpact:
      "Staff should confirm whether behavior-support responsibilities or prevention strategies changed.",
    familySummary:
      "Behavior-support language changed, so the team should explain any updated supports or follow-up."
  },
  {
    section: "Transition services",
    keywords: ["transition", "postsecondary", "career", "employment", "independent living"],
    changeType: "Automated transition-planning change",
    title: "Auto-diff found changed transition-planning language",
    implementationImpact:
      "The team should confirm whether transition activities, responsible roles, or timelines changed.",
    familySummary:
      "Transition-planning language changed, so the student and family should review what is different before the meeting."
  },
  {
    section: "Educational placement",
    keywords: ["placement", "least restrictive", "lre", "general education", "supplemental support"],
    changeType: "Automated placement/LRE change",
    title: "Auto-diff found changed placement or LRE language",
    implementationImpact:
      "Administrators and the IEP team should confirm whether placement/LRE language changed and whether district procedures are required.",
    familySummary:
      "Placement or LRE language changed, so the team should explain what setting is being described and what process is required."
  }
];
const meetingTranscriptStatusOptions = [
  "Draft recap for review",
  "Reviewed for packet",
  "Needs team clarification",
  "Family-ready recap"
];
const meetingRecordingStatusOptions = [
  "Source readiness reviewed",
  "Consent pending",
  "Recording not permitted",
  "Transcript source only",
  "Needs district review"
];
const meetingRecordingSourceOptions = [
  "Case-manager recap notes",
  "Manual transcript paste",
  "Video platform transcript (simulated)",
  "Audio recording reference (simulated)",
  "District recording provider (simulated)"
];
const summaryUnderstandingStatusOptions = [
  "Understood",
  "Needs explanation",
  "Interpreter review requested",
  "Follow-up requested"
];
const summaryComprehensionReviewStatusOptions = [
  "Awaiting team response",
  "Team response recorded",
  "Interpreter follow-up scheduled",
  "Closed"
];
const legalReviewStatusOptions = [
  "Routed to counsel",
  "Counsel response recorded",
  "Returned for district action",
  "Closed - counsel reviewed"
];
const eSignatureScopeOptions = [
  "Meeting packet receipt",
  "Draft-to-final change review",
  "Companion document review",
  "Procedural safeguards receipt"
];
const familyResourceStatusOptions = ["Needed", "Available", "Sent", "Reviewed with family", "Not needed"];
const familyResourceResponseStatusOptions = ["Not reviewed", "Reviewed", "Needs explanation", "Request copy", "Interpreter support needed"];
const glossaryClarityStatusOptions = ["Not reviewed", "Clear", "Needs explanation", "Interpreter explanation requested"];
const glossaryResponseStatusOptions = ["Not started", "Explanation planned", "Explained by staff", "Needs team follow-up"];
const ocrReviewStatusOptions = ["Embedded text accepted", "OCR needed", "OCR text reviewed", "Source quality blocked"];
const sourceAnchorPrecisionOptions = ["Page", "Segment", "Bounding box", "Needs remediation"];

const viewMeta = {
  dashboard: ["Overview", "Case manager workspace"],
  student: ["Student workspace", "Active IEP implementation record"],
  intake: ["IEP intake", "Source document and structured extraction"],
  summary: ["Plan summary", "Role-specific explanation"],
  implementation: ["Implementation", "Role-based tasks and handoffs"],
  services: ["Services", "Delivery and recovery tracking"],
  progress: ["Progress", "Goals, evidence, and report language"],
  meetings: ["Meetings", "Preparation, family questions, student voice"],
  review: ["Quality review", "Advisory flags requiring human judgment"],
  drafting: ["Drafting & training", "Guided draft sections and fictional examples"],
  audit: ["Audit trail", "Source, activity, access, and exports"],
  admin: ["Leadership", "Aggregate implementation risk"]
};

const gapClosurePermissions = {
  manageGapClosure: true,
  manageRolePolicy: true,
  manageRecordLifecycle: true,
  manageAlertRules: true,
  manageSuccessMetrics: true
};

const permissionMatrix = {
  caseManager: {
    createStudent: true,
    upload: true,
    editExtraction: true,
    approveExtraction: true,
    completeTask: true,
    acknowledgeTask: true,
    recordObservation: true,
    reviewClassroomRoster: true,
    addTeamComment: true,
    moderateTeamComment: true,
    addProgress: true,
    logService: true,
    planRecovery: true,
    generateReview: true,
    resolveFlag: true,
    requestComplianceReview: true,
    completeComplianceReview: false,
    manageLegalReview: false,
    reviewIepComparison: true,
    submitComprehensionCheck: true,
    reviewComprehensionCheck: true,
    summarizeMeetingTranscript: true,
    answerQuestion: true,
    submitQuestion: true,
    addMeetingPrepNote: true,
    acknowledgeMeetingPacket: false,
    requestSignature: true,
    signMeetingPacket: false,
    updateStudentVoice: true,
    updateSelfAdvocacy: true,
    finalizeDraftDiff: true,
    coordinateParticipants: true,
    coordinateCompanionDocuments: true,
    coordinateFamilyResources: true,
    acknowledgeFamilyResource: false,
    updateAccessSupport: true,
    reviewPlacement: true,
    reviewPortalAccess: true,
    syncCalendar: true,
    reviewSourceRegistry: false,
    manageSourceRegistry: false,
    manageAiGovernance: false,
    manageDistrictConfiguration: false,
    manageAccessibility: false,
    manageSecurity: false,
    manageAuditAnchors: false,
    reviewRetentionPolicy: false,
    reviewExportTemplates: false,
    updateStaffContinuity: false,
    requestLanguageAccess: true,
    coordinateLanguageAccess: true,
    submitConcern: true,
    resolveConcern: true,
    reviewReminder: true,
    sendNotification: true,
    generateDraft: true,
    reviseDraft: true,
    approveDraft: true,
    shareSummary: true,
    export: true
  },
  generalEducation: {
    createStudent: false,
    upload: false,
    editExtraction: false,
    approveExtraction: false,
    completeTask: true,
    acknowledgeTask: true,
    recordObservation: true,
    reviewClassroomRoster: true,
    addTeamComment: true,
    addProgress: true,
    logService: false,
    planRecovery: false,
    generateReview: false,
    resolveFlag: false,
    requestComplianceReview: false,
    completeComplianceReview: false,
    manageLegalReview: false,
    reviewIepComparison: false,
    submitComprehensionCheck: false,
    reviewComprehensionCheck: false,
    summarizeMeetingTranscript: false,
    answerQuestion: false,
    submitQuestion: false,
    addMeetingPrepNote: true,
    acknowledgeMeetingPacket: false,
    requestSignature: false,
    signMeetingPacket: false,
    updateStudentVoice: false,
    updateSelfAdvocacy: false,
    finalizeDraftDiff: false,
    coordinateParticipants: false,
    coordinateCompanionDocuments: false,
    coordinateFamilyResources: false,
    acknowledgeFamilyResource: false,
    updateAccessSupport: false,
    reviewPlacement: false,
    reviewPortalAccess: false,
    syncCalendar: false,
    reviewSourceRegistry: false,
    manageSourceRegistry: false,
    manageAiGovernance: false,
    manageDistrictConfiguration: false,
    manageAccessibility: false,
    manageSecurity: false,
    manageAuditAnchors: false,
    reviewRetentionPolicy: false,
    reviewExportTemplates: false,
    updateStaffContinuity: false,
    requestLanguageAccess: false,
    coordinateLanguageAccess: false,
    submitConcern: false,
    resolveConcern: false,
    reviewReminder: true,
    sendNotification: false,
    generateDraft: false,
    reviseDraft: false,
    approveDraft: false,
    shareSummary: true,
    export: false
  },
  relatedServiceProvider: {
    createStudent: false,
    upload: false,
    editExtraction: false,
    approveExtraction: false,
    completeTask: true,
    acknowledgeTask: true,
    recordObservation: true,
    reviewClassroomRoster: false,
    addTeamComment: true,
    addProgress: true,
    logService: true,
    planRecovery: true,
    generateReview: false,
    resolveFlag: false,
    requestComplianceReview: false,
    completeComplianceReview: false,
    manageLegalReview: false,
    reviewIepComparison: false,
    submitComprehensionCheck: false,
    reviewComprehensionCheck: false,
    summarizeMeetingTranscript: false,
    answerQuestion: false,
    submitQuestion: false,
    addMeetingPrepNote: true,
    acknowledgeMeetingPacket: false,
    requestSignature: false,
    signMeetingPacket: false,
    updateStudentVoice: false,
    updateSelfAdvocacy: false,
    finalizeDraftDiff: false,
    coordinateParticipants: false,
    coordinateCompanionDocuments: false,
    coordinateFamilyResources: false,
    acknowledgeFamilyResource: false,
    updateAccessSupport: false,
    reviewPlacement: false,
    reviewPortalAccess: false,
    syncCalendar: false,
    reviewSourceRegistry: false,
    manageSourceRegistry: false,
    manageAiGovernance: false,
    manageDistrictConfiguration: false,
    manageAccessibility: false,
    manageSecurity: false,
    manageAuditAnchors: false,
    reviewRetentionPolicy: false,
    reviewExportTemplates: false,
    updateStaffContinuity: false,
    requestLanguageAccess: false,
    coordinateLanguageAccess: false,
    submitConcern: false,
    resolveConcern: false,
    reviewReminder: true,
    sendNotification: false,
    generateDraft: false,
    reviseDraft: false,
    approveDraft: false,
    shareSummary: true,
    export: false
  },
  parent: {
    createStudent: false,
    upload: false,
    editExtraction: false,
    approveExtraction: false,
    completeTask: false,
    acknowledgeTask: false,
    recordObservation: false,
    reviewClassroomRoster: false,
    addTeamComment: true,
    addProgress: false,
    logService: false,
    planRecovery: false,
    generateReview: false,
    resolveFlag: false,
    requestComplianceReview: false,
    completeComplianceReview: false,
    manageLegalReview: false,
    reviewIepComparison: false,
    submitComprehensionCheck: true,
    reviewComprehensionCheck: false,
    summarizeMeetingTranscript: false,
    answerQuestion: false,
    submitQuestion: true,
    addMeetingPrepNote: true,
    acknowledgeMeetingPacket: true,
    requestSignature: false,
    signMeetingPacket: true,
    updateStudentVoice: false,
    updateSelfAdvocacy: false,
    finalizeDraftDiff: false,
    coordinateParticipants: false,
    coordinateCompanionDocuments: false,
    coordinateFamilyResources: false,
    acknowledgeFamilyResource: true,
    updateAccessSupport: false,
    reviewPlacement: false,
    reviewPortalAccess: false,
    syncCalendar: false,
    reviewSourceRegistry: false,
    manageSourceRegistry: false,
    manageAiGovernance: false,
    manageDistrictConfiguration: false,
    manageAccessibility: false,
    manageSecurity: false,
    manageAuditAnchors: false,
    reviewRetentionPolicy: false,
    reviewExportTemplates: false,
    updateStaffContinuity: false,
    requestLanguageAccess: true,
    coordinateLanguageAccess: false,
    submitConcern: true,
    resolveConcern: false,
    reviewReminder: true,
    sendNotification: false,
    generateDraft: false,
    reviseDraft: false,
    approveDraft: false,
    shareSummary: true,
    export: false
  },
  student: {
    createStudent: false,
    upload: false,
    editExtraction: false,
    approveExtraction: false,
    completeTask: false,
    acknowledgeTask: false,
    recordObservation: false,
    reviewClassroomRoster: false,
    addTeamComment: true,
    addProgress: false,
    logService: false,
    planRecovery: false,
    generateReview: false,
    resolveFlag: false,
    requestComplianceReview: false,
    completeComplianceReview: false,
    manageLegalReview: false,
    reviewIepComparison: false,
    submitComprehensionCheck: true,
    reviewComprehensionCheck: false,
    summarizeMeetingTranscript: false,
    answerQuestion: false,
    submitQuestion: true,
    addMeetingPrepNote: true,
    acknowledgeMeetingPacket: true,
    requestSignature: false,
    signMeetingPacket: false,
    updateStudentVoice: true,
    updateSelfAdvocacy: true,
    finalizeDraftDiff: false,
    coordinateParticipants: false,
    coordinateCompanionDocuments: false,
    coordinateFamilyResources: false,
    acknowledgeFamilyResource: true,
    updateAccessSupport: false,
    reviewPlacement: false,
    reviewPortalAccess: false,
    syncCalendar: false,
    reviewSourceRegistry: false,
    manageSourceRegistry: false,
    manageAiGovernance: false,
    manageDistrictConfiguration: false,
    manageAccessibility: false,
    manageSecurity: false,
    manageAuditAnchors: false,
    reviewRetentionPolicy: false,
    reviewExportTemplates: false,
    updateStaffContinuity: false,
    requestLanguageAccess: true,
    coordinateLanguageAccess: false,
    submitConcern: true,
    resolveConcern: false,
    reviewReminder: true,
    sendNotification: false,
    generateDraft: false,
    reviseDraft: false,
    approveDraft: false,
    shareSummary: true,
    export: false
  },
  administrator: {
    createStudent: true,
    upload: false,
    editExtraction: false,
    approveExtraction: false,
    completeTask: false,
    acknowledgeTask: false,
    recordObservation: false,
    reviewClassroomRoster: true,
    addTeamComment: true,
    moderateTeamComment: true,
    addProgress: false,
    logService: false,
    planRecovery: false,
    generateReview: true,
    resolveFlag: true,
    requestComplianceReview: true,
    completeComplianceReview: true,
    manageLegalReview: true,
    reviewIepComparison: true,
    submitComprehensionCheck: false,
    reviewComprehensionCheck: true,
    summarizeMeetingTranscript: true,
    answerQuestion: false,
    submitQuestion: false,
    addMeetingPrepNote: true,
    acknowledgeMeetingPacket: false,
    requestSignature: true,
    signMeetingPacket: false,
    updateStudentVoice: false,
    updateSelfAdvocacy: false,
    finalizeDraftDiff: true,
    coordinateParticipants: true,
    coordinateCompanionDocuments: true,
    coordinateFamilyResources: true,
    acknowledgeFamilyResource: false,
    updateAccessSupport: true,
    reviewPlacement: true,
    reviewPortalAccess: true,
    syncCalendar: true,
    reviewSourceRegistry: true,
    manageSourceRegistry: true,
    manageAiGovernance: true,
    manageDistrictConfiguration: true,
    ...gapClosurePermissions,
    manageAccessibility: true,
    manageSecurity: true,
    manageAuditAnchors: true,
    reviewRetentionPolicy: true,
    reviewExportTemplates: true,
    updateStaffContinuity: true,
    requestLanguageAccess: false,
    coordinateLanguageAccess: true,
    submitConcern: false,
    resolveConcern: true,
    reviewReminder: true,
    sendNotification: true,
    generateDraft: true,
    reviseDraft: true,
    approveDraft: true,
    shareSummary: true,
    export: true
  },
  schoolAdministrator: {
    createStudent: true,
    upload: false,
    editExtraction: false,
    approveExtraction: false,
    completeTask: false,
    acknowledgeTask: false,
    recordObservation: false,
    reviewClassroomRoster: true,
    addTeamComment: true,
    moderateTeamComment: true,
    addProgress: false,
    logService: false,
    planRecovery: false,
    generateReview: true,
    resolveFlag: true,
    requestComplianceReview: true,
    completeComplianceReview: true,
    manageLegalReview: false,
    reviewIepComparison: true,
    submitComprehensionCheck: false,
    reviewComprehensionCheck: true,
    summarizeMeetingTranscript: true,
    answerQuestion: false,
    submitQuestion: false,
    addMeetingPrepNote: true,
    acknowledgeMeetingPacket: false,
    requestSignature: true,
    signMeetingPacket: false,
    updateStudentVoice: false,
    updateSelfAdvocacy: false,
    finalizeDraftDiff: true,
    coordinateParticipants: true,
    coordinateCompanionDocuments: true,
    coordinateFamilyResources: true,
    acknowledgeFamilyResource: false,
    updateAccessSupport: true,
    reviewPlacement: true,
    reviewPortalAccess: true,
    syncCalendar: true,
    reviewSourceRegistry: false,
    manageSourceRegistry: false,
    manageAiGovernance: false,
    manageDistrictConfiguration: false,
    manageAccessibility: false,
    manageSecurity: false,
    manageAuditAnchors: false,
    reviewRetentionPolicy: false,
    reviewExportTemplates: false,
    updateStaffContinuity: true,
    requestLanguageAccess: false,
    coordinateLanguageAccess: true,
    submitConcern: false,
    resolveConcern: true,
    reviewReminder: true,
    sendNotification: true,
    generateDraft: false,
    reviseDraft: false,
    approveDraft: false,
    shareSummary: true,
    export: true
  },
  districtAdministrator: {
    createStudent: true,
    upload: false,
    editExtraction: false,
    approveExtraction: false,
    completeTask: false,
    acknowledgeTask: false,
    recordObservation: false,
    reviewClassroomRoster: true,
    addTeamComment: true,
    moderateTeamComment: true,
    addProgress: false,
    logService: false,
    planRecovery: false,
    generateReview: true,
    resolveFlag: true,
    requestComplianceReview: true,
    completeComplianceReview: true,
    manageLegalReview: true,
    reviewIepComparison: true,
    submitComprehensionCheck: false,
    reviewComprehensionCheck: true,
    summarizeMeetingTranscript: true,
    answerQuestion: false,
    submitQuestion: false,
    addMeetingPrepNote: true,
    acknowledgeMeetingPacket: false,
    requestSignature: true,
    signMeetingPacket: false,
    updateStudentVoice: false,
    updateSelfAdvocacy: false,
    finalizeDraftDiff: true,
    coordinateParticipants: true,
    coordinateCompanionDocuments: true,
    coordinateFamilyResources: true,
    acknowledgeFamilyResource: false,
    updateAccessSupport: true,
    reviewPlacement: true,
    reviewPortalAccess: true,
    syncCalendar: true,
    reviewSourceRegistry: true,
    manageSourceRegistry: true,
    manageAiGovernance: true,
    manageDistrictConfiguration: true,
    ...gapClosurePermissions,
    manageAccessibility: true,
    manageSecurity: false,
    manageAuditAnchors: false,
    reviewRetentionPolicy: true,
    reviewExportTemplates: true,
    updateStaffContinuity: true,
    requestLanguageAccess: false,
    coordinateLanguageAccess: true,
    submitConcern: false,
    resolveConcern: true,
    reviewReminder: true,
    sendNotification: true,
    generateDraft: true,
    reviseDraft: true,
    approveDraft: true,
    shareSummary: true,
    export: true
  },
  systemAdministrator: {
    createStudent: false,
    upload: false,
    editExtraction: false,
    approveExtraction: false,
    completeTask: false,
    acknowledgeTask: false,
    recordObservation: false,
    reviewClassroomRoster: false,
    addTeamComment: false,
    addProgress: false,
    logService: false,
    planRecovery: false,
    generateReview: false,
    resolveFlag: false,
    requestComplianceReview: false,
    completeComplianceReview: false,
    manageLegalReview: false,
    reviewIepComparison: false,
    submitComprehensionCheck: false,
    reviewComprehensionCheck: false,
    summarizeMeetingTranscript: false,
    answerQuestion: false,
    submitQuestion: false,
    addMeetingPrepNote: false,
    acknowledgeMeetingPacket: false,
    requestSignature: false,
    signMeetingPacket: false,
    updateStudentVoice: false,
    updateSelfAdvocacy: false,
    finalizeDraftDiff: false,
    coordinateParticipants: false,
    coordinateCompanionDocuments: false,
    coordinateFamilyResources: false,
    acknowledgeFamilyResource: false,
    updateAccessSupport: false,
    reviewPlacement: false,
    reviewPortalAccess: false,
    syncCalendar: false,
    reviewSourceRegistry: true,
    manageSourceRegistry: false,
    manageAiGovernance: true,
    manageDistrictConfiguration: true,
    ...gapClosurePermissions,
    manageAccessibility: true,
    manageSecurity: true,
    manageAuditAnchors: true,
    reviewRetentionPolicy: true,
    reviewExportTemplates: true,
    updateStaffContinuity: false,
    requestLanguageAccess: false,
    coordinateLanguageAccess: false,
    submitConcern: false,
    resolveConcern: false,
    reviewReminder: false,
    sendNotification: false,
    generateDraft: false,
    reviseDraft: false,
    approveDraft: false,
    shareSummary: false,
    export: true
  },
  readOnlyReviewer: {
    createStudent: false,
    upload: false,
    editExtraction: false,
    approveExtraction: false,
    completeTask: false,
    acknowledgeTask: false,
    recordObservation: false,
    reviewClassroomRoster: false,
    addTeamComment: false,
    addProgress: false,
    logService: false,
    planRecovery: false,
    generateReview: false,
    resolveFlag: false,
    requestComplianceReview: false,
    completeComplianceReview: false,
    manageLegalReview: false,
    reviewIepComparison: false,
    submitComprehensionCheck: false,
    reviewComprehensionCheck: false,
    summarizeMeetingTranscript: false,
    answerQuestion: false,
    submitQuestion: false,
    addMeetingPrepNote: false,
    acknowledgeMeetingPacket: false,
    requestSignature: false,
    signMeetingPacket: false,
    updateStudentVoice: false,
    updateSelfAdvocacy: false,
    finalizeDraftDiff: false,
    coordinateParticipants: false,
    coordinateCompanionDocuments: false,
    coordinateFamilyResources: false,
    acknowledgeFamilyResource: false,
    updateAccessSupport: false,
    reviewPlacement: false,
    reviewPortalAccess: false,
    syncCalendar: false,
    reviewSourceRegistry: false,
    manageSourceRegistry: false,
    manageAiGovernance: false,
    manageDistrictConfiguration: false,
    manageAccessibility: false,
    manageSecurity: false,
    manageAuditAnchors: false,
    reviewRetentionPolicy: false,
    reviewExportTemplates: false,
    updateStaffContinuity: false,
    requestLanguageAccess: false,
    coordinateLanguageAccess: false,
    submitConcern: false,
    resolveConcern: false,
    reviewReminder: false,
    sendNotification: false,
    generateDraft: false,
    reviseDraft: false,
    approveDraft: false,
    shareSummary: false,
    export: false
  }
};

function can(state, permission) {
  return Boolean(permissionMatrix[state.user.role]?.[permission]);
}

function reducer(state, action) {
  switch (action.type) {
    case "replaceWorkspace":
      return {
        ...action.workspace,
        user: {
          ...action.workspace.user,
          role: action.preserveRole === false ? action.workspace.user.role : state.user.role
        }
      };
    case "selectStudent":
      return { ...state, currentStudentId: action.studentId };
    case "createStudentProfile": {
      const createdAt = new Date().toISOString();
      const student = createStudentProfileRecord(action, state, createdAt);
      const iep = createDraftIepForStudent(student, state, createdAt);
      return withAudit(
        {
          ...state,
          currentStudentId: student.id,
          students: [student, ...(state.students || [])],
          ieps: [iep, ...(state.ieps || [])],
          extractionSections: (state.extractionSections || []).filter((section) => section.studentId === student.id)
        },
        "Student intake",
        "Student profile created",
        `${student.firstName} ${student.lastName} was created with a draft IEP intake scaffold.`
      );
    }
    case "switchRole":
      return withAudit(
        {
          ...state,
          user: { ...state.user, role: action.role }
        },
        "Access change",
        "Role lens changed",
        `Workspace role lens changed to ${roles[action.role].label}.`
      );
    case "confirmExtraction":
      return withAudit(
        {
          ...state,
          extractionSections: state.extractionSections.map((section) =>
            section.id === action.sectionId ? { ...section, status: "Confirmed" } : section
          )
        },
        "Human review",
        "Extraction section confirmed",
        "A structured field was confirmed by a qualified user."
      );
    case "editExtraction":
      return withAudit(
        {
          ...state,
          extractionSections: state.extractionSections.map((section) =>
            section.id === action.sectionId
              ? {
                  ...section,
                  content: action.content,
                  status: "Needs review",
                  priorContent: section.priorContent || section.content,
                  editedBy: state.user.name,
                  editedByRole: state.user.role,
                  editedAt: new Date().toISOString()
                }
              : section
          )
        },
        "User edit",
        "Extracted field edited",
        "A reviewed field was edited without changing the preserved source document."
      );
    case "updateOcrReview": {
      const reviewedAt = new Date().toISOString();
      const status = normalizeOcrReviewStatus(action.status);
      return withAudit(
        {
          ...state,
          documents: state.documents.map((document) =>
            document.id === action.documentId
              ? {
                  ...document,
                  ocrReview: {
                    status,
                    confidence: clampPercent(action.confidence),
                    reviewedTextExcerpt: action.reviewedTextExcerpt || "",
                    reviewerNote: action.reviewerNote || "",
                    reviewedBy: state.user.name,
                    reviewedByRole: state.user.role,
                    reviewedAt,
                    sourceAlignment: document.sourceAlignment || sourceAlignmentForState(state),
                    officialRecordImpact:
                      "OCR/source-quality review supports extraction fidelity only; it does not change the official IEP or replace the preserved source.",
                    ocrDigest: localOcrReviewDigest(document, action, state, reviewedAt)
                  }
                }
              : document
          )
        },
        "Source quality review",
        "OCR/source review recorded",
        "A reviewer recorded OCR or source-quality status for a preserved document."
      );
    }
    case "updateSourceAnchorReview": {
      const reviewedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          extractionSections: state.extractionSections.map((section) =>
            section.id === action.sectionId
              ? {
                  ...section,
                  sourceAnchorReview: createLocalSourceAnchorReview(section, action, state, reviewedAt)
                }
              : section
          )
        },
        "Source anchor review",
        "Source anchor review recorded",
        "A reviewer recorded field-level page, segment, and bounding-box source anchoring."
      );
    }
    case "rejectExtraction":
      return withAudit(
        {
          ...state,
          extractionSections: state.extractionSections.map((section) =>
            section.id === action.sectionId
              ? rejectExtractionSection(section, action, state.user)
              : section
          )
        },
        "Human review",
        "Extraction section rejected",
        "A reviewer flagged extracted content as not ready for the structured record."
      );
    case "regenerateExtraction": {
      const activeDocument = documentForCurrentStudent(state);
      return withAudit(
        {
          ...state,
          extractionSections: state.extractionSections.map((section) =>
            section.id === action.sectionId
              ? regenerateExtractionSection(section, activeDocument, state, action)
              : section
          )
        },
        "AI-assisted extraction",
        "Extraction section regenerated",
        "A reviewer requested a regenerated extraction while preserving the prior section text."
      );
    }
    case "approveExtraction":
      const approvedSourceAlignment = sourceAlignmentForState(state);
      const reviewedExtractionSections = state.extractionSections.map((section) => ({
        ...section,
        status: section.status === "Rejected" ? "Rejected" : "Confirmed",
        sourceAlignment: section.sourceAlignment || approvedSourceAlignment
      }));
      const reviewedState = { ...state, extractionSections: reviewedExtractionSections };
      const approvedState = {
        ...state,
        ieps: state.ieps.map((iep) =>
          iep.studentId === state.currentStudentId
            ? normalizeApprovedIep(reviewedState, iep, approvedSourceAlignment)
            : iep
        ),
        extractionSections: reviewedExtractionSections
      };
      return withAuditEvents(
        refreshRoleSummariesFromWorkspace(
          applyApprovedExtractionObligations(approvedState, { sourceAlignment: approvedSourceAlignment }),
          { sourceAlignment: approvedSourceAlignment }
        ),
        [
          {
            type: "Human review",
            title: "Structured extraction approved",
            detail: "The reviewed structured record is available to downstream workflows."
          },
          {
            type: "Tasks created",
            title: "Implementation tasks created",
            detail: "Implementation obligations were derived from the approved structured IEP record."
          },
          {
            type: "AI-generated summaries",
            title: "Role-specific summaries refreshed",
            detail: "Teacher, family, student, and reviewer summaries were refreshed from the approved structured IEP record with source alignment."
          }
        ]
      );
    case "recordSummaryCopy": {
      const summary = state.summaries[action.audience];
      if (!summary || !canShareSummary(state, action.audience)) return state;
      return withAudit(
        state,
        "Summary shared",
        "Summary copied",
        `${summary.label} summary was copied for approved meeting preparation.`
      );
    }
    case "generateSummaryHandout": {
      const summary = state.summaries[action.audience];
      if (!summary || !canShareSummary(state, action.audience)) return state;
      const coverageItems = summaryCoverageItemsForWorkspace(state, action.audience);
      const handout = createSummaryHandout({
        id: `handout-${Date.now()}`,
        studentId: state.currentStudentId,
        audience: action.audience,
        summary,
        coverageItems,
        actor: state.user.name,
        role: state.user.role
      });
      return withAudit(
        {
          ...state,
          summaryHandouts: [handout, ...(state.summaryHandouts || [])]
        },
        "Meeting preparation",
        "Meeting handout generated",
        `${summary.label} handout prepared from the role-specific summary.`
      );
    }
    case "submitSummaryComprehensionCheck": {
      if (!canSubmitSummaryComprehension(state, action.audience)) return state;
      const check = createSummaryComprehensionCheck(state, action);
      if (!check.sectionHeading || !check.questionOrNote) return state;
      return withAudit(
        {
          ...state,
          summaryComprehensionChecks: [check, ...(state.summaryComprehensionChecks || [])]
        },
        "Family comprehension",
        "Understanding check submitted",
        "A source-grounded summary understanding check was recorded for team follow-up."
      );
    }
    case "reviewSummaryComprehensionCheck": {
      if (!can(state, "reviewComprehensionCheck")) return state;
      let updated = null;
      const reviewedAt = new Date().toISOString();
      const checks = (state.summaryComprehensionChecks || []).map((check) => {
        if (check.id !== action.checkId) return check;
        updated = {
          ...check,
          reviewStatus: normalizeSummaryComprehensionReviewStatus(action.reviewStatus || "Team response recorded"),
          staffResponse: String(action.response || "").trim(),
          nextStep: String(action.nextStep || "").trim(),
          reviewedBy: state.user.name,
          reviewedByRole: state.user.role,
          reviewedAt
        };
        return updated;
      });
      if (!updated || !updated.staffResponse || !updated.nextStep) return state;
      return withAudit(
        {
          ...state,
          summaryComprehensionChecks: checks
        },
        "Family comprehension",
        "Understanding response recorded",
        "A staff response and next step were recorded for a family summary understanding check."
      );
    }
    case "reviewClassroomRoster": {
      if (!can(state, "reviewClassroomRoster")) return state;
      const reviewedAt = new Date().toISOString();
      const review = createLocalClassroomRosterReview(state, action, reviewedAt);
      if (!review) return state;
      const reviewedIds = new Set(review.reviewedRosterIds);
      return withAudit(
        {
          ...state,
          teacherClassroomRoster: (state.teacherClassroomRoster || []).map((entry) =>
            reviewedIds.has(entry.id) ? { ...entry, lastReviewedAt: reviewedAt } : entry
          ),
          teacherClassroomReviews: [review, ...(state.teacherClassroomReviews || [])]
        },
        "Classroom roster review",
        "Classroom roster reviewed",
        `${review.classPeriod} roster reviewed for ${review.reviewFocus}.`
      );
    }
    case "addSourceDocument": {
      const fallbackSourceText =
        action.sourceText ||
        action.previewText ||
        `File selected: ${action.name}. Run the local API to parse the preserved source document.`;
      const document = {
        id: `doc-${Date.now()}`,
        studentId: state.currentStudentId,
        name: action.name,
        type: action.documentType,
        mimeType: action.mimeType || null,
        uploadedAt: new Date().toISOString(),
        uploadedBy: state.user.name,
        preserved: true,
        sourceAlignment: sourceAlignmentForState(state),
        sourceText: fallbackSourceText
      };
      return withAudit(
        {
          ...state,
          documents: [document, ...state.documents],
          ieps: state.ieps.map((iep) =>
            iep.studentId === state.currentStudentId
              ? { ...iep, documentId: document.id, sourceAlignment: document.sourceAlignment }
              : iep
          ),
          extractionSections: createDemoExtraction(fallbackSourceText, action.name).map((section) => ({
            ...section,
            studentId: state.currentStudentId,
            documentId: document.id,
            sourceAlignment: document.sourceAlignment
          }))
        },
        "Document upload",
        "Source document preserved",
        `${action.name} was added and routed to human extraction review.`
      );
    }
    case "toggleTask":
      return withAudit(
        {
          ...state,
          tasks: state.tasks.map((task) =>
            task.id === action.taskId
              ? nextTaskStatus(task, action, state.user)
              : task
          )
        },
        "Task update",
        "Implementation task updated",
        "A role-specific IEP implementation task changed status."
      );
    case "acknowledgeTask": {
      const acknowledgment = {
        acknowledgedBy: state.user.name,
        acknowledgedByRole: state.user.role,
        acknowledgedAt: new Date().toISOString(),
        note: action.note || "Reviewed assigned IEP responsibility."
      };
      return withAudit(
        {
          ...state,
          tasks: state.tasks.map((task) =>
            task.id === action.taskId
              ? {
                  ...task,
                  acknowledgments: [
                    acknowledgment,
                    ...(task.acknowledgments || []).filter((item) => item.acknowledgedBy !== state.user.name)
                  ]
                }
              : task
          )
        },
        "Task acknowledgment",
        "Implementation handoff acknowledged",
        "A responsible staff member acknowledged an assigned IEP implementation responsibility."
      );
    }
    case "recordTaskObservation": {
      const observation = {
        id: `observation-${Date.now()}`,
        observedAt: action.observedAt || isoDate(new Date()),
        context: action.context?.trim() || "Classroom implementation observation",
        note: action.note?.trim() || "Observation recorded for implementation follow-up.",
        supportUsed: action.supportUsed?.trim() || "Not specified",
        enteredBy: state.user.name,
        enteredByRole: state.user.role,
        enteredAt: new Date().toISOString()
      };
      return withAudit(
        {
          ...state,
          tasks: state.tasks.map((task) =>
            task.id === action.taskId
              ? {
                  ...task,
                  observations: [observation, ...(task.observations || [])]
                }
              : task
          )
        },
        "Task observation",
        "Classroom observation recorded",
        "A staff observation was attached to an implementation responsibility."
      );
    }
    case "addTeamComment": {
      const comment = createTeamComment(state, action);
      if (!comment) return state;
      return withAudit(
        {
          ...state,
          teamComments: [comment, ...(state.teamComments || [])]
        },
        "Team collaboration",
        "Team comment added",
        `${state.user.name} added a ${comment.visibility.toLowerCase()} comment for ${comment.targetTitle}.`
      );
    }
    case "replyTeamComment": {
      const reply = createTeamCommentReply(state, action);
      if (!reply) return state;
      return withAudit(
        {
          ...state,
          teamComments: (state.teamComments || []).map((comment) =>
            comment.id === action.commentId
              ? {
                  ...comment,
                  replies: [reply, ...(comment.replies || [])]
                }
              : comment
          )
        },
        "Team collaboration",
        "Team comment reply added",
        `${state.user.name} added a threaded reply for source-traced collaboration.`
      );
    }
    case "moderateTeamComment": {
      const moderatedAt = new Date().toISOString();
      const existing = (state.teamComments || []).find((comment) => comment.id === action.commentId);
      if (!existing) return state;
      const status = normalizeTeamCommentModerationStatus(action.moderationStatus);
      const visibility = normalizeTeamCommentVisibility(action.visibility || existing.visibility, state.user.role);
      const updated = {
        ...existing,
        visibility,
        moderationStatus: status,
        moderationNote: String(action.moderationNote || "").trim(),
        moderatedBy: state.user.name,
        moderatedByRole: state.user.role,
        moderatedAt,
        moderationDigest: localTeamCommentModerationDigest(existing, action, state, moderatedAt)
      };
      return withAudit(
        {
          ...state,
          teamComments: (state.teamComments || []).map((comment) => (comment.id === updated.id ? updated : comment))
        },
        "Team collaboration moderation",
        "Team comment moderated",
        `${updated.targetTitle} thread marked ${status}; official IEP obligations unchanged.`
      );
    }
    case "recordTeamCommentQueueReview": {
      const queueReview = createTeamCommentQueueReview(state, action);
      if (!queueReview) return state;
      return withAudit(
        {
          ...state,
          teamCommentQueueReviews: [queueReview, ...(state.teamCommentQueueReviews || [])]
        },
        "Team collaboration queue",
        "Collaboration queue reviewed",
        `${queueReview.queueStatus} for ${queueReview.commentsReviewed.length} source-traced collaboration items.`
      );
    }
    case "recordPortalAccessReview": {
      const review = createPortalAccessReview(state, action);
      if (!review) return state;
      return withAudit(
        {
          ...state,
          portalAccessReviews: [review, ...(state.portalAccessReviews || [])]
        },
        "Portal access review",
        "Portal access reviewed",
        `${review.subjectRole} portal access marked ${review.accessStatus}; official IEP obligations unchanged.`
      );
    }
    case "preparePortalInvitationPackage": {
      const invitation = createPortalInvitationPackage(state, action);
      if (!invitation) return state;
      return withAudit(
        {
          ...state,
          portalInvitationPackages: [invitation, ...(state.portalInvitationPackages || [])]
        },
        "Portal invitation",
        "Portal invitation package prepared",
        `${invitation.subjectRole} portal invitation package prepared for ${invitation.subjectName}; official IEP obligations unchanged.`
      );
    }
    case "addProgress": {
      const entry = {
        id: `progress-${Date.now()}`,
        date: action.date,
        value: Number(action.value),
        notes: action.notes,
        enteredBy: state.user.name,
        evidenceDocumentId: action.evidenceDocumentId || null,
        evidenceLabel: action.evidenceLabel,
        evidenceType: action.evidenceType
      };
      return withAudit(
        {
          ...state,
          goals: state.goals.map((goal) =>
            goal.id === action.goalId
              ? {
                  ...goal,
                  status: Number(action.value) >= targetForGoal(goal) ? "On track" : goal.status,
                  progressSchedule: nextProgressSchedule(goal, action.date),
                  progressEntries: [...goal.progressEntries, entry]
                }
              : goal
          )
        },
        "Progress data entered",
        "Progress evidence entered",
        "A progress data point was saved against the approved measurement method."
      );
    }
    case "logService":
      return withAudit(
        {
          ...state,
          services: state.services.map((service) =>
            service.id === action.serviceId
              ? {
                  ...service,
                  deliveredMinutes: service.deliveredMinutes + Number(action.minutes),
                  recoveryStatus:
                    service.deliveredMinutes + Number(action.minutes) >= service.scheduledMinutes
                      ? "On schedule"
                      : service.recoveryStatus
                }
              : service
          )
        },
        "Service log",
        "Service delivery documented",
        "Delivered minutes were recorded against the IEP service requirement."
      );
    case "assignRecovery":
      return withAudit(
        {
          ...state,
          services: state.services.map((service) =>
            service.id === action.serviceId
              ? {
                  ...service,
                  recoveryStatus: "Recovery planned",
                  recoveryPlan: {
                    status: "Recovery planned",
                    missedMinutes: Math.max(Number(service.scheduledMinutes || 0) - Number(service.deliveredMinutes || 0), 0),
                    recoveryDate: action.recoveryDate,
                    provider: action.provider,
                    familyCommunication: action.familyCommunication,
                    plannedBy: state.user.name,
                    plannedAt: new Date().toISOString()
                  }
                }
              : service
          )
        },
        "Service recovery",
        "Service recovery planned",
        "A missed-service recovery date, provider, and family communication note were recorded."
      );
    case "updateAccessSupport": {
      const reviewedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          accessSupportPlans: (state.accessSupportPlans || []).map((support) =>
            support.id === action.supportId
              ? {
                  ...support,
                  status: normalizeAccessSupportStatus(action.status),
                  implementationPlan: String(action.implementationPlan || "").trim(),
                  responsibleRole: String(action.responsibleRole || "").trim(),
                  reviewNote: String(action.reviewNote || "").trim(),
                  reviewedBy: state.user.name,
                  reviewedByRole: state.user.role,
                  reviewedAt,
                  supportDigest: localAccessSupportDigest(support, action, state, reviewedAt),
                  sourceAlignment: support.sourceAlignment || sourceAlignmentForState(state),
                  officialRecordImpact:
                    support.officialRecordImpact ||
                    "Access-support review note only; official IEP access-support decisions remain controlled by the reviewed source document and IEP team."
                }
              : support
          )
        },
        "Access supports",
        "Access support review updated",
        "A human reviewer updated assistive-technology or transportation implementation support without changing official IEP requirements."
      );
    }
    case "updatePlacementReview": {
      const reviewedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          placementReviews: (state.placementReviews || []).map((review) =>
            review.id === action.reviewId
              ? {
                  ...review,
                  status: normalizePlacementReviewStatus(action.status),
                  lreConsideration: String(action.lreConsideration || "").trim(),
                  implementationImpact: String(action.implementationImpact || "").trim(),
                  followUpOwner: String(action.followUpOwner || "").trim(),
                  nextReviewDate: action.nextReviewDate || "",
                  reviewerNote: String(action.reviewerNote || "").trim(),
                  reviewedBy: state.user.name,
                  reviewedByRole: state.user.role,
                  reviewedAt,
                  placementDigest: localPlacementReviewDigest(review, action, state, reviewedAt),
                  sourceAlignment: review.sourceAlignment || sourceAlignmentForState(state),
                  officialRecordImpact:
                    review.officialRecordImpact ||
                    "Placement review note only; official placement and LRE decisions remain controlled by the reviewed source document and IEP team."
                }
              : review
          )
        },
        "Placement review",
        "Placement rationale review updated",
        "A human reviewer updated educational placement and LRE implementation review without making an official placement decision."
      );
    }
    case "generateReview": {
      const generatedAt = new Date().toISOString();
      const generatedFlags = generateCompletenessReviewFlags(state, {
        studentId: state.currentStudentId,
        actor: state.user.name,
        role: state.user.role,
        generatedAt
      });
      return withAudit(
        {
          ...state,
          reviewFlags: mergeGeneratedReviewFlags(state.reviewFlags, generatedFlags)
        },
        "AI-assisted review",
        "Completeness review generated",
        `${generatedFlags.length} advisory completeness finding${generatedFlags.length === 1 ? "" : "s"} generated from the structured record.`
      );
    }
    case "resolveFlag":
      return withAudit(
        {
          ...state,
          reviewFlags: state.reviewFlags.map((flag) =>
            flag.id === action.flagId
              ? {
                  ...flag,
                  status: "Resolved",
                  resolvedBy: state.user.name,
                  resolvedAt: new Date().toISOString(),
                  resolution: {
                    decision: action.decision,
                    rationale: action.rationale,
                    nextAction: action.nextAction,
                    reviewerRole: state.user.role
                  }
                }
              : flag
          )
        },
        "Compliance flag resolved",
        "Advisory finding resolved",
        `A human reviewer recorded a disposition for ${action.flagId}: ${action.decision}.`
      );
    case "requestComplianceReview": {
      const review = createComplianceReviewRequest(state, action);
      if (!review) return state;
      return withAudit(
        {
          ...state,
          complianceReviews: [review, ...(state.complianceReviews || [])]
        },
        "Compliance review",
        "Compliance review requested",
        `${review.issue} was escalated to ${review.assignedReviewer}.`
      );
    }
    case "completeComplianceReview": {
      const reviewedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          complianceReviews: (state.complianceReviews || []).map((review) =>
            review.id === action.reviewId
              ? {
                  ...review,
                  status: action.status,
                  outcome: action.outcome,
                  reviewerNote: action.reviewerNote,
                  nextAction: action.nextAction,
                  reviewedBy: state.user.name,
                  reviewedByRole: state.user.role,
                  reviewedAt
                }
              : review
          )
        },
        "Compliance review",
        "Compliance review outcome recorded",
        `${action.status} recorded for ${action.reviewId}.`
      );
    }
    case "requestLegalReviewRoute": {
      const route = createLegalReviewRoute(state, action);
      if (!route) return state;
      return withAudit(
        {
          ...state,
          legalReviewRoutes: [route, ...(state.legalReviewRoutes || [])],
          complianceReviews: (state.complianceReviews || []).map((review) =>
            review.id === route.complianceReviewId
              ? {
                  ...review,
                  legalRouteStatus: "Routed to counsel",
                  legalRouteId: route.id
                }
              : review
          )
        },
        "Legal review routing",
        "District counsel review routed",
        `${route.issue} routed to ${route.counselName}.`
      );
    }
    case "recordLegalReviewOutcome": {
      const selectedRoute = (state.legalReviewRoutes || []).find((route) => route.id === action.routeId);
      if (!selectedRoute) return state;
      const reviewedAt = new Date().toISOString();
      const status = legalReviewStatusOptions.includes(action.status) ? action.status : "Counsel response recorded";
      const updatedRoute = {
        ...selectedRoute,
        status,
        counselSummary: String(action.counselSummary || "").trim(),
        recommendedAction: String(action.recommendedAction || "").trim(),
        reviewerNote: String(action.reviewerNote || "").trim(),
        reviewedBy: state.user.name,
        reviewedByRole: state.user.role,
        reviewedAt,
        outcomeDigest: localLegalReviewOutcomeDigest(selectedRoute, action, state, reviewedAt)
      };
      return withAudit(
        {
          ...state,
          legalReviewRoutes: (state.legalReviewRoutes || []).map((route) =>
            route.id === action.routeId ? updatedRoute : route
          ),
          complianceReviews: (state.complianceReviews || []).map((review) =>
            review.id === selectedRoute.complianceReviewId
              ? {
                  ...review,
                  legalRouteStatus: status,
                  legalRouteId: selectedRoute.id,
                  nextAction: updatedRoute.recommendedAction
                }
              : review
          )
        },
        "Legal review routing",
        "District counsel response recorded",
        `${status} recorded for ${action.routeId}; not legal certification by the workspace.`
      );
    }
    case "createIepComparison": {
      const createdAt = new Date().toISOString();
      const comparison = createLocalIepComparison(action, state, createdAt);
      return withAudit(
        {
          ...state,
          iepComparisons: [comparison, ...(state.iepComparisons || [])]
        },
        "IEP version comparison",
        "IEP comparison added",
        `${comparison.title} captured for prior/current IEP review; it does not amend the official IEP.`
      );
    }
    case "autoGenerateIepComparisons": {
      const createdAt = new Date().toISOString();
      const comparisons = createLocalAutoIepComparisons(action, state, createdAt);
      if (!comparisons.length) return state;
      return withAudit(
        {
          ...state,
          iepComparisons: [...comparisons, ...(state.iepComparisons || [])]
        },
        "IEP version comparison",
        "IEP auto-diff candidates generated",
        `${comparisons.length} prior/current IEP comparison candidates generated for human review.`
      );
    }
    case "reviewIepComparison": {
      const reviewedAt = new Date().toISOString();
      const existing = (state.iepComparisons || []).find((comparison) => comparison.id === action.comparisonId);
      if (!existing) return state;
      const status = normalizeIepComparisonStatus(action.status);
      const updated = {
        ...existing,
        status,
        reviewNote: String(action.reviewNote || "").trim(),
        familyVisible: Boolean(action.familyVisible),
        studentVisible: Boolean(action.studentVisible),
        reviewedBy: state.user.name,
        reviewedByRole: state.user.role,
        reviewedAt,
        comparisonDigest: localIepComparisonDigest(existing, action, state, reviewedAt)
      };
      return withAudit(
        {
          ...state,
          iepComparisons: (state.iepComparisons || []).map((comparison) =>
            comparison.id === updated.id ? updated : comparison
          )
        },
        "IEP version comparison",
        "IEP comparison reviewed",
        `${updated.title} marked ${status}; explanation only, not an official IEP change.`
      );
    }
    case "runAiEvaluation": {
      const runAt = new Date().toISOString();
      const run = createLocalAiGovernanceEvaluationRun(state, action, runAt);
      const governance = aiGovernanceForState(state);
      return withAudit(
        {
          ...state,
          aiGovernance: {
            ...governance,
            modelProfile: {
              ...governance.modelProfile,
              reviewStatus: run.status,
              lastEvaluationScore: run.score,
              lastEvaluationStatus: run.status,
              lastEvaluatedAt: runAt,
              lastReviewedBy: state.user.name,
              lastReviewedAt: runAt
            },
            evaluationRuns: [run, ...(governance.evaluationRuns || [])]
          }
        },
        "AI governance",
        "AI guardrail evaluation completed",
        `${run.evaluationScope} scored ${run.score}% (${run.status}) with ${run.passedChecks}/${run.totalChecks} checks passing.`
      );
    }
    case "runAiCitationEvaluation": {
      const evaluatedAt = new Date().toISOString();
      const evaluation = createLocalAiCitationEvaluation(state, action, evaluatedAt);
      const governance = aiGovernanceForState(state);
      return withAudit(
        {
          ...state,
          aiGovernance: {
            ...governance,
            modelProfile: {
              ...governance.modelProfile,
              lastCitationEvaluationScore: evaluation.score,
              lastCitationEvaluationStatus: evaluation.status,
              lastCitationEvaluatedAt: evaluatedAt,
              lastReviewedBy: state.user.name,
              lastReviewedAt: evaluatedAt
            },
            citationEvaluations: [evaluation, ...(governance.citationEvaluations || [])]
          }
        },
        "AI citation evaluation",
        "AI citation evaluation completed",
        `${evaluation.outputLabel} citation evaluation scored ${evaluation.score}% (${evaluation.status}).`
      );
    }
    case "updateDistrictIntegration": {
      const reviewedAt = new Date().toISOString();
      const configuration = districtConfigurationForState(state);
      const existing = (configuration.integrationReadiness || []).find((integration) => integration.id === action.integrationId);
      if (!existing) return state;
      const status = normalizeDistrictIntegrationStatus(action.status);
      const updated = {
        ...existing,
        status,
        provider: String(action.provider || "").trim(),
        owner: String(action.owner || "").trim(),
        nextReviewDate: action.nextReviewDate || "",
        note: String(action.note || "").trim(),
        reviewedBy: state.user.name,
        reviewedByRole: state.user.role,
        reviewedAt
      };
      const review = {
        id: `district-config-review-${Date.now()}`,
        integrationId: updated.id,
        integrationName: updated.name,
        status,
        provider: updated.provider,
        owner: updated.owner,
        nextReviewDate: updated.nextReviewDate,
        note: updated.note,
        reviewedBy: state.user.name,
        reviewedByRole: state.user.role,
        reviewedAt,
        configurationDigest: localDistrictIntegrationDigest(configuration, updated, state, reviewedAt)
      };
      return withAudit(
        {
          ...state,
          districtConfiguration: {
            ...configuration,
            integrationReadiness: (configuration.integrationReadiness || []).map((integration) =>
              integration.id === updated.id ? updated : integration
            ),
            lastReviewedBy: state.user.name,
            lastReviewedAt: reviewedAt,
            configurationReviews: [review, ...(configuration.configurationReviews || [])]
          }
        },
        "District configuration",
        "District integration readiness updated",
        `${updated.name} marked ${status} for district implementation readiness.`
      );
    }
    case "updateDataProtectionControl": {
      const reviewedAt = new Date().toISOString();
      const configuration = districtConfigurationForState(state);
      const existing = (configuration.dataProtectionReadiness || []).find((control) => control.id === action.controlId);
      if (!existing) return state;
      const status = normalizeDistrictIntegrationStatus(action.status);
      const updated = {
        ...existing,
        status,
        control: String(action.control || "").trim(),
        owner: String(action.owner || "").trim(),
        nextReviewDate: action.nextReviewDate || "",
        evidenceNote: String(action.evidenceNote || "").trim(),
        productionBoundary: String(action.productionBoundary || existing.productionBoundary || "").trim(),
        reviewedBy: state.user.name,
        reviewedByRole: state.user.role,
        reviewedAt
      };
      const review = {
        id: `data-protection-review-${Date.now()}`,
        reviewType: "Data protection readiness",
        controlId: updated.id,
        controlName: updated.name,
        status,
        owner: updated.owner,
        nextReviewDate: updated.nextReviewDate,
        note: updated.evidenceNote,
        productionBoundary: updated.productionBoundary,
        reviewedBy: state.user.name,
        reviewedByRole: state.user.role,
        reviewedAt,
        configurationDigest: localDataProtectionDigest(configuration, updated, state, reviewedAt)
      };
      return withAudit(
        {
          ...state,
          districtConfiguration: {
            ...configuration,
            dataProtectionReadiness: (configuration.dataProtectionReadiness || []).map((control) =>
              control.id === updated.id ? updated : control
            ),
            lastReviewedBy: state.user.name,
            lastReviewedAt: reviewedAt,
            configurationReviews: [review, ...(configuration.configurationReviews || [])]
          }
        },
        "District configuration",
        "Data protection readiness updated",
        `${updated.name} marked ${status} for district deployment readiness.`
      );
    }
    case "updateRolePolicy":
      return updateLocalGapClosureRecord(state, action, {
        collectionKey: "rolePolicyMatrix",
        idKey: "roleId",
        actionIdKey: "roleId",
        reviewType: "Role policy",
        title: "Role policy reviewed",
        fields: ["studentScope", "defaultAccess", "visibleInformation", "status", "owner", "nextReviewDate", "note"]
      });
    case "updateRecordLifecycle":
      return updateLocalGapClosureRecord(state, action, {
        collectionKey: "recordLifecycleRules",
        idKey: "id",
        actionIdKey: "ruleId",
        reviewType: "Record lifecycle",
        title: "Record lifecycle rule reviewed",
        fields: ["draftStatus", "reviewedStatus", "officialReady", "exportable", "requiredReviewRole", "boundaryLabel", "status", "reviewNote"]
      });
    case "updateAlertRule":
      return updateLocalGapClosureRecord(state, action, {
        collectionKey: "alertRules",
        idKey: "id",
        actionIdKey: "ruleId",
        reviewType: "Alert prioritization",
        title: "Alert prioritization rule reviewed",
        fields: ["enabled", "triggerDays", "priority", "escalationRole", "status", "reviewNote"]
      });
    case "updateSuccessMetric":
      return updateLocalGapClosureRecord(state, action, {
        collectionKey: "successMetrics",
        idKey: "id",
        actionIdKey: "metricId",
        reviewType: "Success metric",
        title: "Success metric reviewed",
        fields: ["baseline", "target", "reviewCadence", "owner", "status", "evidenceSource", "reviewNote"]
      });
    case "updateIntegrationSource":
      return updateLocalGapClosureRecord(state, action, {
        collectionKey: "integrationSources",
        idKey: "id",
        actionIdKey: "integrationId",
        reviewType: "Integration source",
        title: "Integration source reviewed",
        fields: ["sourceOfTruth", "direction", "provider", "owner", "status", "nextReviewDate", "boundary", "reviewNote"]
      });
    case "updateGapDistrictConfiguration":
      return updateLocalGapDistrictConfiguration(state, action);
    case "updateAccessibilityFinding": {
      const reviewedAt = new Date().toISOString();
      const certification = accessibilityCertificationForState(state);
      const existing = (certification.findings || []).find((finding) => finding.id === action.findingId);
      if (!existing) return state;
      const status = normalizeAccessibilityFindingStatus(action.status);
      const severity = normalizeAccessibilityFindingSeverity(action.severity);
      const updated = {
        ...existing,
        status,
        severity,
        owner: String(action.owner || "").trim(),
        dueDate: action.dueDate || "",
        assistiveTechnology: String(action.assistiveTechnology || "").trim(),
        remediationPlan: String(action.remediationPlan || "").trim(),
        verificationNote: String(action.verificationNote || "").trim(),
        reviewedBy: state.user.name,
        reviewedByRole: state.user.role,
        reviewedAt
      };
      const review = {
        id: `accessibility-review-${Date.now()}`,
        findingId: updated.id,
        findingTitle: updated.title,
        criterion: updated.criterion,
        status,
        severity,
        owner: updated.owner,
        dueDate: updated.dueDate,
        assistiveTechnology: updated.assistiveTechnology,
        remediationPlan: updated.remediationPlan,
        verificationNote: updated.verificationNote,
        reviewedBy: state.user.name,
        reviewedByRole: state.user.role,
        reviewedAt,
        accessibilityDigest: localAccessibilityReviewDigest(certification, updated, state, reviewedAt)
      };
      return withAudit(
        {
          ...state,
          accessibilityCertification: {
            ...certification,
            findings: (certification.findings || []).map((finding) =>
              finding.id === updated.id ? updated : finding
            ),
            lastReviewedBy: state.user.name,
            lastReviewedAt: reviewedAt,
            reviews: [review, ...(certification.reviews || [])]
          }
        },
        "Accessibility remediation",
        "Accessibility finding updated",
        `${updated.title} marked ${status} for ${severity.toLowerCase()} accessibility remediation.`
      );
    }
    case "answerQuestion":
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) => ({
            ...meeting,
            familyQuestions: meeting.familyQuestions.map((question) =>
              question.id === action.questionId ? { ...question, status: "Answered" } : question
            )
          }))
        },
        "Meeting preparation",
        "Family question answered",
        "A pre-meeting family question was answered and retained in the meeting record."
      );
    case "submitQuestion": {
      const question = {
        id: `question-${Date.now()}`,
        text: action.text,
        status: "Open",
        assignedTo: "IEP team",
        submittedBy: state.user.name,
        submittedByRole: state.user.role,
        submittedAt: new Date().toISOString()
      };
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) =>
            meeting.id === action.meetingId
              ? { ...meeting, familyQuestions: [question, ...meeting.familyQuestions] }
              : meeting
          )
        },
        "Meeting preparation",
        "Family question submitted",
        "A parent, guardian, or student submitted a pre-meeting question for team response."
      );
    }
    case "addMeetingPrepNote": {
      const submittedAt = new Date().toISOString();
      const topic = String(action.topic || "Meeting prep note").trim() || "Meeting prep note";
      const note = {
        id: `prep-note-${Date.now()}`,
        topic,
        body: String(action.body || "").trim(),
        audience: action.audience || "IEP team",
        submittedBy: state.user.name,
        submittedByRole: state.user.role,
        submittedAt,
        sourceReference: "Meeting prep notes area",
        sourceAlignment: sourceAlignmentForState(state),
        officialRecordImpact:
          "Meeting preparation note only; does not change official IEP obligations or final team decisions."
      };
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) =>
            meeting.id === action.meetingId
              ? { ...meeting, meetingPrepNotes: [note, ...(meeting.meetingPrepNotes || [])] }
              : meeting
          )
        },
        "Meeting preparation",
        "Meeting prep note added",
        `${note.topic} was added to the pre-meeting notes area for team review.`
      );
    }
    case "acknowledgeMeetingPacket": {
      const acknowledgedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) =>
            meeting.id === action.meetingId
              ? {
                  ...meeting,
                  packetAcknowledgments: (meeting.packetAcknowledgments || []).map((acknowledgment) =>
                    acknowledgment.id === action.acknowledgmentId
                      ? {
                          ...acknowledgment,
                          status: action.status,
                          responseNote: action.note,
                          acknowledgedBy: state.user.name,
                          acknowledgedByRole: state.user.role,
                          acknowledgedAt
                        }
                      : acknowledgment
                  )
                }
              : meeting
          )
        },
        "Meeting preparation",
        "Meeting packet acknowledged",
        "A parent, guardian, or student recorded pre-read packet status before the meeting."
      );
    }
    case "requestMeetingSignature": {
      const requestedAt = new Date().toISOString();
      const signatureRequest = {
        id: `signature-${Date.now()}`,
        meetingId: action.meetingId,
        studentId: state.currentStudentId,
        packetTitle: action.packetTitle,
        signatureScope: action.signatureScope,
        requestedForRole: action.requestedForRole || "parent",
        requestedForName: action.requestedForName || "Parent/guardian",
        status: "Requested",
        requestNote: action.requestNote,
        notConsentNote:
          "Typed signature confirms receipt and review for the scoped packet only; it does not replace IEP team decisions, consent requirements, or legal certification.",
        requestedBy: state.user.name,
        requestedByRole: state.user.role,
        requestedAt,
        sourceReference: "Meeting packet, draft-to-final change log, and e-signature request",
        sourceAlignment: sourceAlignmentForState(state)
      };
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) =>
            meeting.id === action.meetingId
              ? { ...meeting, eSignatureRequests: [signatureRequest, ...(meeting.eSignatureRequests || [])] }
              : meeting
          )
        },
        "Meeting preparation",
        "E-signature requested",
        "A scoped parent e-signature request was created for meeting preparation."
      );
    }
    case "signMeetingPacket": {
      const signedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) =>
            meeting.id === action.meetingId
              ? {
                  ...meeting,
                  eSignatureRequests: (meeting.eSignatureRequests || []).map((signatureRequest) =>
                    signatureRequest.id === action.signatureId
                      ? {
                          ...signatureRequest,
                          status: "Signed",
                          signerName: action.signerName,
                          signedBy: state.user.name,
                          signedByRole: state.user.role,
                          signedAt,
                          attestation: action.attestation,
                          signatureHash: localMeetingSignatureHash(signatureRequest, action, state, signedAt)
                        }
                      : signatureRequest
                  )
                }
              : meeting
          )
        },
        "Meeting preparation",
        "Meeting packet e-signed",
        "A parent or guardian signed a scoped meeting packet attestation."
      );
    }
    case "updateStudentVoice":
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) =>
            meeting.id === action.meetingId
              ? {
                  ...meeting,
                  studentVoice: action.studentVoice,
                  studentVoiceUpdatedBy: state.user.name,
                  studentVoiceUpdatedAt: new Date().toISOString()
                }
              : meeting
          )
        },
        "Meeting preparation",
        "Student voice updated",
        "A student-facing pre-meeting reflection was updated for team review."
      );
    case "updateSelfAdvocacy": {
      const updatedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) =>
            meeting.id === action.meetingId
              ? {
                  ...meeting,
                  selfAdvocacyPlan: {
                    ...(meeting.selfAdvocacyPlan || {}),
                    preferredSupport: action.preferredSupport,
                    participationGoal: action.participationGoal,
                    requestScript: action.requestScript,
                    confidence: Number(action.confidence),
                    barrier: action.barrier,
                    nextStep: action.nextStep,
                    sourceReference: meeting.selfAdvocacyPlan?.sourceReference || "Student strengths and self-advocacy agenda item",
                    sourceAlignment: meeting.selfAdvocacyPlan?.sourceAlignment || sourceAlignmentForState(state),
                    updatedBy: state.user.name,
                    updatedByRole: state.user.role,
                    updatedAt
                  }
                }
              : meeting
          )
        },
        "Meeting preparation",
        "Self-advocacy plan updated",
        "A student-facing self-advocacy preparation plan was updated for team review."
      );
    }
    case "updateParticipantReadiness":
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) =>
            meeting.id === action.meetingId
              ? {
                  ...meeting,
                  requiredParticipants: (meeting.requiredParticipants || []).map((participant) =>
                    participant.id === action.participantId
                      ? {
                          ...participant,
                          status: action.status,
                          mode: action.mode,
                          note: action.note,
                          confirmedBy: state.user.name,
                          confirmedAt: new Date().toISOString()
                        }
                      : participant
                  )
                }
              : meeting
          )
        },
        "Meeting preparation",
        "Participant readiness updated",
        "A required-participant attendance status was recorded for meeting preparation."
      );
    case "updateLanguageAccess": {
      const languageAccess = nextLanguageAccess(
        state.meetings.find((meeting) => meeting.id === action.meetingId)?.languageAccess,
        action,
        state
      );
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) =>
            meeting.id === action.meetingId ? { ...meeting, languageAccess } : meeting
          )
        },
        "Language access",
        action.coordinate ? "Language access coordinated" : "Language access requested",
        action.coordinate
          ? "A staff member updated translation or interpreter coordination status."
          : "A family or student language support request was recorded for the meeting."
      );
    }
    case "updateGlossaryTerm": {
      const updatedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) => {
            if (meeting.id !== action.meetingId) return meeting;
            const languageAccess = meeting.languageAccess || defaultLanguageAccess();
            return {
              ...meeting,
              languageAccess: {
                ...languageAccess,
                glossary: normalizeGlossaryItems(languageAccess.glossary).map((item) => {
                  if (item.id !== action.termId) return item;
                  if (action.coordinate) {
                    return {
                      ...item,
                      staffResponseStatus: normalizeGlossaryResponseStatus(action.responseStatus),
                      staffResponse: action.response,
                      staffRespondedBy: state.user.name,
                      staffRespondedByRole: state.user.role,
                      staffRespondedAt: updatedAt,
                      sourceAlignment: item.sourceAlignment || defaultSourceAlignment
                    };
                  }
                  return {
                    ...item,
                    clarityStatus: normalizeGlossaryClarityStatus(action.status),
                    clarityNote: action.note,
                    clarityRequestedBy: state.user.name,
                    clarityRequestedByRole: state.user.role,
                    clarityRequestedAt: updatedAt,
                    sourceAlignment: item.sourceAlignment || defaultSourceAlignment
                  };
                })
              }
            };
          })
        },
        "Language access",
        action.coordinate ? "Glossary explanation recorded" : "Glossary clarification requested",
        action.coordinate
          ? "A staff response was recorded for a plain-language glossary term."
          : "A family or student glossary clarification request was recorded."
      );
    }
    case "updateCompanionDocument": {
      const reviewedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) =>
            meeting.id === action.meetingId
              ? {
                  ...meeting,
                  companionDocuments: (meeting.companionDocuments || []).map((document) =>
                    document.id === action.documentId
                      ? {
                          ...document,
                          status: action.status,
                          owner: action.owner,
                          dueDate: action.dueDate,
                          note: action.note,
                          reviewedBy: state.user.name,
                          reviewedByRole: state.user.role,
                          reviewedAt
                        }
                      : document
                  )
                }
              : meeting
          )
        },
        "Meeting preparation",
        "Companion document readiness updated",
        "A staff member reviewed a related Pennsylvania special education document for meeting readiness."
      );
    }
    case "updateFamilyResource": {
      const reviewedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) =>
            meeting.id === action.meetingId
              ? {
                  ...meeting,
                  familyResources: (meeting.familyResources || []).map((resource) =>
                    resource.id === action.resourceId
                      ? {
                          ...resource,
                          status: normalizeFamilyResourceStatus(action.status),
                          owner: action.owner,
                          dueDate: action.dueDate,
                          note: action.note,
                          sourceAlignment: resource.sourceAlignment || sourceAlignmentForState(state),
                          reviewedBy: state.user.name,
                          reviewedByRole: state.user.role,
                          reviewedAt
                        }
                      : resource
                  )
                }
              : meeting
          )
        },
        "Meeting preparation",
        "Family resource guide updated",
        "A staff member reviewed a family or student resource-guide item for meeting readiness."
      );
    }
    case "acknowledgeFamilyResource": {
      const acknowledgedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) =>
            meeting.id === action.meetingId
              ? {
                  ...meeting,
                  familyResources: (meeting.familyResources || []).map((resource) =>
                    resource.id === action.resourceId && familyResourceMatchesRole(state.user.role, resource)
                      ? {
                          ...resource,
                          familyStatus: normalizeFamilyResourceResponseStatus(action.status),
                          familyNote: action.note,
                          sourceAlignment: resource.sourceAlignment || sourceAlignmentForState(state),
                          acknowledgedBy: state.user.name,
                          acknowledgedByRole: state.user.role,
                          acknowledgedAt
                        }
                      : resource
                  )
                }
              : meeting
          )
        },
        "Meeting preparation",
        "Family resource response recorded",
        "A parent, guardian, or student recorded resource-guide review status before the meeting."
      );
    }
    case "syncCalendarHold": {
      const calendarEvent = createCalendarHold(state, action);
      if (!calendarEvent) return state;
      return withAudit(
        {
          ...state,
          calendarEvents: [calendarEvent, ...(state.calendarEvents || [])]
        },
        "Meeting preparation",
        "Calendar hold created",
        `${calendarEvent.title} was recorded as a simulated calendar hold.`
      );
    }
    case "recordMeetingTranscriptSummary": {
      const transcriptSummary = createMeetingTranscriptSummary(state, action);
      if (!transcriptSummary) return state;
      return withAudit(
        {
          ...state,
          meetingTranscriptSummaries: [transcriptSummary, ...(state.meetingTranscriptSummaries || [])]
        },
        "Meeting recap",
        "Meeting transcript summary recorded",
        "A human-reviewed meeting transcript recap was saved with source traceability and official-record guardrails."
      );
    }
    case "recordMeetingRecordingReview": {
      const recordingReview = createMeetingRecordingReview(state, action);
      if (!recordingReview) return state;
      return withAudit(
        {
          ...state,
          meetingRecordingReviews: [recordingReview, ...(state.meetingRecordingReviews || [])]
        },
        "Meeting recording readiness",
        "Meeting recording readiness recorded",
        "A meeting recording/transcript source readiness review was saved before transcript recap use."
      );
    }
    case "updateStaffContinuity": {
      const reviewedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          staffContinuity: (state.staffContinuity || []).map((record) =>
            record.id === action.continuityId
              ? {
                  ...record,
                  status: action.status,
                  riskLevel: action.riskLevel,
                  coverageOwner: action.coverageOwner,
                  nextReviewDate: action.nextReviewDate,
                  coveragePlan: action.coveragePlan,
                  reviewedBy: state.user.name,
                  reviewedByRole: state.user.role,
                  reviewedAt
                }
              : record
          )
        },
        "Leadership oversight",
        "Staff continuity plan updated",
        "A leadership user updated staffing coverage, risk, owner, and next-review details."
      );
    }
    case "reviewSourceRegistry": {
      const reviewedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          sourceRegistry: {
            ...(state.sourceRegistry || {}),
            reviewStatus: action.status,
            lastReviewedAt: reviewedAt,
            nextReviewDate: action.nextReviewDate,
            reviewedBy: state.user.name,
            reviewedByRole: state.user.role,
            reviewNote: action.note,
            entries: (state.sourceRegistry?.entries || []).map((entry) =>
              entry.sourceId === action.sourceId
                ? {
                    ...entry,
                    reviewStatus: action.status,
                    retrievedDate: action.retrievedDate,
                    reviewNote: action.note,
                    nextReviewDate: action.nextReviewDate,
                    reviewedBy: state.user.name,
                    reviewedByRole: state.user.role,
                    reviewedAt
                  }
                : entry
            )
          }
        },
        "Source registry",
        "Source registry entry reviewed",
        "A reviewer updated source-version review status for the Pennsylvania source registry."
      );
    }
    case "saveSourceRegistryEntry": {
      const reviewedAt = new Date().toISOString();
      const entry = createSourceRegistryEntry(state, action, reviewedAt);
      const existingEntries = state.sourceRegistry?.entries || [];
      const hasExistingEntry = existingEntries.some((item) => item.sourceId === entry.sourceId);
      const entries = hasExistingEntry
        ? existingEntries.map((item) => (item.sourceId === entry.sourceId ? entry : item))
        : [entry, ...existingEntries];
      const nextRegistryVersion = action.sourceRegistryVersion?.trim() || state.sourceRegistry?.sourceRegistryVersion || entry.sourceRegistryVersion;
      return withAudit(
        {
          ...state,
          sourceRegistry: {
            ...(state.sourceRegistry || {}),
            sourceRegistryVersion: nextRegistryVersion,
            entries,
            ...(action.activate
              ? {
                  activeSourceId: entry.sourceId,
                  jurisdiction: entry.jurisdiction,
                  programArea: entry.programArea,
                  retrievedDate: entry.retrievedDate,
                  reviewStatus: entry.reviewStatus,
                  lastReviewedAt: reviewedAt,
                  nextReviewDate: entry.nextReviewDate,
                  reviewedBy: state.user.name,
                  reviewedByRole: state.user.role,
                  reviewNote: entry.reviewNote
                }
              : {})
          }
        },
        "Source registry",
        "Source registry entry saved",
        `${entry.title} was ${action.activate ? "saved and activated" : "saved"} in the source registry.`
      );
    }
    case "revokeSecuritySession": {
      const reviewedAt = new Date().toISOString();
      const targetSession = (state.securitySessions || []).find((item) => item.id === action.sessionId);
      if (!targetSession) return state;
      const review = {
        id: `security-review-${Date.now()}`,
        action: "Session revoked",
        sessionId: action.sessionId,
        userName: targetSession.userName,
        role: targetSession.role,
        status: "Revoked",
        note: action.note,
        reviewedBy: state.user.name,
        reviewedByRole: state.user.role,
        reviewedAt
      };
      return withAudit(
        {
          ...state,
          securitySessions: (state.securitySessions || []).map((item) =>
            item.id === action.sessionId
              ? {
                  ...item,
                  status: "Revoked",
                  revokedAt: reviewedAt,
                  revokedBy: state.user.name,
                  revocationReason: action.note
                }
              : item
          ),
          securityReviews: [review, ...(state.securityReviews || [])],
          securityPosture: {
            ...(state.securityPosture || {}),
            reviewStatus: "Session reviewed",
            lastReviewedAt: reviewedAt,
            reviewedBy: state.user.name,
            reviewedByRole: state.user.role
          }
        },
        "Security",
        "Security session revoked",
        `${targetSession.userName} session was revoked during administrator review.`
      );
    }
    case "reviewIdentityLifecycle": {
      const reviewedAt = new Date().toISOString();
      const identityProvider = String(action.identityProvider || "").trim();
      const accountLifecyclePlan = String(action.accountLifecyclePlan || "").trim();
      const tenantBoundaryEvidence = String(action.tenantBoundaryEvidence || "").trim();
      const roleProvisioningNote = String(action.roleProvisioningNote || "").trim();
      if (!identityProvider || !accountLifecyclePlan || !tenantBoundaryEvidence || !roleProvisioningNote) return state;
      const lifecycleStatus = normalizeIdentityLifecycleStatus(action.lifecycleStatus);
      const mfaStatus = normalizeIdentityMfaStatus(action.mfaStatus);
      const tenantBoundaryStatus = normalizeTenantBoundaryStatus(action.tenantBoundaryStatus);
      const roleProvisioningStatus = normalizeRoleProvisioningStatus(action.roleProvisioningStatus);
      const nextReviewDate = String(action.nextReviewDate || "").trim();
      const review = {
        id: `security-review-${Date.now()}`,
        action: "Identity lifecycle reviewed",
        sessionId: "",
        userName: "All demo accounts",
        role: "all",
        status: lifecycleStatus,
        identityProvider,
        lifecycleStatus,
        mfaStatus,
        tenantBoundaryStatus,
        roleProvisioningStatus,
        accountLifecyclePlan,
        tenantBoundaryEvidence,
        roleProvisioningNote,
        note: `${identityProvider}: ${accountLifecyclePlan}`,
        nextReviewDate,
        reviewedBy: state.user.name,
        reviewedByRole: state.user.role,
        reviewedAt,
        productionBoundary:
          "This local review records readiness evidence only; production deployments still require district IdP, MFA enforcement, tenant isolation, provisioning, and deprovisioning controls."
      };
      const reviewWithDigest = {
        ...review,
        securityDigest: localIdentityLifecycleDigest(review, state)
      };
      return withAudit(
        {
          ...state,
          securityReviews: [reviewWithDigest, ...(state.securityReviews || [])],
          securityPosture: {
            ...(state.securityPosture || {}),
            identityProvider,
            mfaStatus,
            tenantBoundaryStatus,
            roleProvisioningStatus,
            accountLifecyclePlan,
            tenantBoundaryEvidence,
            reviewStatus: lifecycleStatus,
            nextReviewDate,
            lastReviewedAt: reviewedAt,
            reviewedBy: state.user.name,
            reviewedByRole: state.user.role,
            retentionNote:
              "Identity lifecycle review records are retained locally; production IdP, MFA, tenant isolation, and deprovisioning enforcement remain external to this demo."
          }
        },
        "Security",
        "Identity lifecycle reviewed",
        `${identityProvider} lifecycle readiness was recorded for administrator review.`
      );
    }
    case "createAuditAnchor": {
      const createdAt = new Date().toISOString();
      const latestEvent = (state.auditLog || [])[0] || {};
      const anchor = {
        id: `audit-anchor-${Date.now()}`,
        status: "Local fallback anchor",
        anchorScope: "Browser-local audit events",
        anchoredSequence: (state.auditLog || []).length,
        anchoredHash: latestEvent.hash || "browser-local-no-chain-hash",
        anchorDigest: localAuditAnchorDigest(state, action, createdAt),
        externalReference: action.externalReference || "Browser-local fallback anchor",
        note: action.note,
        createdBy: state.user.name,
        createdByRole: state.user.role,
        createdAt,
        verificationStatus: latestEvent.hash ? "Local hash reference captured" : "No NDJSON chain available in browser fallback"
      };
      return withAudit(
        {
          ...state,
          auditAnchors: [anchor, ...(state.auditAnchors || [])]
        },
        "Audit anchoring",
        "Audit anchor created",
        `Audit anchor captured sequence ${anchor.anchoredSequence}.`
      );
    }
    case "recordExternalTimestampReceipt": {
      const recordedAt = new Date().toISOString();
      const anchor = (state.auditAnchors || []).find((item) => item.id === action.anchorId);
      if (!anchor) return state;
      const receipt = createLocalExternalTimestampReceipt(anchor, action, state, recordedAt);
      return withAudit(
        {
          ...state,
          auditAnchors: (state.auditAnchors || []).map((item) =>
            item.id === anchor.id
              ? {
                  ...item,
                  status: "External timestamp recorded",
                  externalTimestampReceipt: receipt,
                  notarizationStatus: receipt.status
                }
              : item
          )
        },
        "Audit anchoring",
        "External timestamp receipt recorded",
        `${receipt.provider} receipt ${receipt.receiptId} was attached to audit anchor sequence ${anchor.anchoredSequence}.`
      );
    }
    case "sealAuditRetentionPackage": {
      const createdAt = new Date().toISOString();
      const anchor = (state.auditAnchors || []).find((item) => item.id === action.anchorId) ||
        (state.auditAnchors || []).find((item) => !/seed/i.test(item.status || "")) ||
        (state.auditAnchors || [])[0] ||
        {};
      const packageDigest = localAuditRetentionDigest(state, action, anchor, createdAt);
      const retentionPackage = {
        id: `retention-${Date.now()}`,
        status: "Local fallback seal",
        retentionScope: "Browser-local audit retention manifest",
        retentionMode: "Browser-local manifest preview",
        anchorId: anchor.id || "browser-local-anchor",
        anchorDigest: anchor.anchorDigest || "browser-local-no-anchor-digest",
        anchoredSequence: anchor.anchoredSequence || (state.auditLog || []).length,
        anchoredHash: anchor.anchoredHash || state.auditLog?.[0]?.hash || "browser-local-no-chain-hash",
        packageDigest,
        note: action.note,
        createdBy: state.user.name,
        createdByRole: state.user.role,
        createdAt,
        verificationStatus: "Browser-local preview; API mode writes a non-overwriting manifest file"
      };
      return withAudit(
        {
          ...state,
          auditRetentionPackages: [retentionPackage, ...(state.auditRetentionPackages || [])]
        },
        "Audit retention",
        "Retention package sealed",
        `Retention manifest preview captured anchor sequence ${retentionPackage.anchoredSequence}.`
      );
    }
    case "reviewRetentionPolicy": {
      const reviewedAt = new Date().toISOString();
      const retentionPackage = (state.auditRetentionPackages || []).find((item) => item.id === action.retentionPackageId) ||
        (state.auditRetentionPackages || [])[0] ||
        null;
      const anchor = (state.auditAnchors || []).find((item) => item.id === (action.anchorId || retentionPackage?.anchorId)) ||
        (state.auditAnchors || [])[0] ||
        null;
      const review = createLocalRetentionPolicyReview(state, action, { retentionPackage, anchor, reviewedAt });
      if (!review) return state;
      return withAudit(
        {
          ...state,
          retentionPolicyReviews: [review, ...(state.retentionPolicyReviews || [])]
        },
        "Audit retention",
        "Retention policy reviewed",
        `${review.policyScope} marked ${review.disposition}; production policy enforcement remains district-owned.`
      );
    }
    case "submitConcern": {
      const concern = {
        id: `concern-${Date.now()}`,
        title: action.title,
        concern: action.concern,
        status: "Open",
        submittedBy: state.user.name,
        submittedByRole: state.user.role,
        submittedAt: new Date().toISOString(),
        owner: "IEP team",
        response: "",
        decision: "",
        nextStep: "Team response pending.",
        priorWrittenNotice: "Review if the response proposes or refuses a change to identification, evaluation, placement, or FAPE."
      };
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) =>
            meeting.id === action.meetingId
              ? { ...meeting, concerns: [concern, ...(meeting.concerns || [])] }
              : meeting
          )
        },
        "Concern submitted",
        "Meeting concern logged",
        "A parent, student, or staff concern was added to the early-resolution record."
      );
    }
    case "resolveConcern":
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) => ({
            ...meeting,
            concerns: (meeting.concerns || []).map((concern) =>
              concern.id === action.concernId
                ? {
                    ...concern,
                    status: "Resolved",
                    response: action.response,
                    decision: action.decision,
                    nextStep: action.nextStep,
                    priorWrittenNotice: action.priorWrittenNotice,
                    resolvedBy: state.user.name,
                    resolvedAt: new Date().toISOString()
                  }
                : concern
            )
          }))
        },
        "Concern resolved",
        "Decision record updated",
        "A staff response and next step were recorded for a meeting concern."
      );
    case "reviewReminder": {
      if (!action.reminderId) return state;
      const reviewedAt = new Date().toISOString();
      const review = {
        id: `reminder-review-${Date.now()}`,
        reminderId: action.reminderId,
        title: action.title || "Implementation reminder",
        studentId: action.studentId || state.currentStudentId,
        reviewedBy: state.user.name,
        reviewedByUserId: state.user.id,
        reviewedByRole: state.user.role,
        reviewedAt,
        note: action.note || "Marked reviewed from the reminder center."
      };
      return withAudit(
        {
          ...state,
          reminderReviews: [
            review,
            ...(state.reminderReviews || []).filter(
              (item) => !(item.reminderId === action.reminderId && item.reviewedByUserId === state.user.id)
            )
          ]
        },
        "Reminder reviewed",
        "Implementation reminder reviewed",
        `${review.title} was reviewed by ${state.user.name}.`
      );
    }
    case "sendNotification": {
      const delivery = createNotificationDelivery(state, action);
      if (!delivery) return state;
      return withAudit(
        {
          ...state,
          notificationDeliveries: [delivery, ...(state.notificationDeliveries || [])]
        },
        "Notification delivery",
        "Notification sent",
        `${delivery.sourceTitle} notice sent to ${notificationAudienceLabel(delivery.audience)} by ${state.user.name}.`
      );
    }
    case "finalizeDraftDiff":
      return withAudit(
        {
          ...state,
          meetings: state.meetings.map((meeting) => ({
            ...meeting,
            draftDiffs: (meeting.draftDiffs || []).map((diff) =>
              diff.id === action.diffId
                ? {
                    ...diff,
                    status: "Finalized",
                    finalText: action.finalText,
                    decisionRationale: action.decisionRationale,
                    finalizedBy: state.user.name,
                    finalizedAt: new Date().toISOString()
                  }
                : diff
            )
          }))
        },
        "Meeting preparation",
        "Draft-to-final decision recorded",
        "A proposed meeting change was resolved with final language and rationale."
      );
    case "createDraft":
      {
        const createdAt = new Date().toISOString();
        const guidedResponses = normalizeDraftGuidedResponses(action.guidedResponses);
        const annotatedSample = action.annotatedSample?.trim() || "";
        const draft = {
          id: `draft-${Date.now()}`,
          profile: action.profile,
          guidedResponses,
          annotatedSample,
          status: "Draft - human review required",
          reviewStatus: "Human review pending",
          contentLabel: "AI-assisted fictional training draft",
          sourceReferences: ["Fictional learner profile", "Guided intake responses", "Annotated sample cue"],
          generationMetadata: localGeneratedContentMetadata(state.user, createdAt),
          officialRecordBoundary: localGeneratedContentBoundary(),
          createdBy: state.user.name,
          createdByRole: state.user.role,
          createdAt,
          sections: draftSeedSections(action.profile, guidedResponses, annotatedSample).map((section) => ({
            ...section,
            status: "Draft - human review required",
            reviewStatus: "Human review pending",
            contentLabel: "AI-assisted fictional training draft section",
            sourceReferences: ["Fictional learner profile", "Guided intake responses", "Annotated sample cue"],
            generationMetadata: localGeneratedContentMetadata(state.user, createdAt),
            officialRecordBoundary: localGeneratedContentBoundary(),
            version: 1,
            versionHistory: []
          }))
        };
        return withAudit(
          {
            ...state,
            draft
          },
          "Draft generated",
          "Training draft generated",
          "A fictional or draft IEP section set was generated and labeled for human review."
        );
      }
    case "reviseDraftSection": {
      const targetSection = state.draft?.sections?.find((section) => draftSectionKey(section) === action.sectionId);
      const content = action.content?.trim();
      if (!state.draft || !targetSection || !content) return state;
      const revisedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          draft: {
            ...state.draft,
            status: "Revised - human review required",
            reviewStatus: "Human review pending",
            approvedBy: null,
            approvedByRole: null,
            approvedAt: null,
            sections: state.draft.sections.map((section) =>
              draftSectionKey(section) === action.sectionId
                ? reviseDraftSection(section, action, state.user, revisedAt)
                : section
            )
          }
        },
        "Draft review",
        "Draft section revised",
        `${targetSection.heading} was edited and prior language was preserved.`
      );
    }
    case "regenerateDraftSection": {
      const targetSection = state.draft?.sections?.find((section) => draftSectionKey(section) === action.sectionId);
      if (!state.draft || !targetSection) return state;
      const regeneratedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          draft: {
            ...state.draft,
            status: "Regenerated - human review required",
            reviewStatus: "Human review pending",
            approvedBy: null,
            approvedByRole: null,
            approvedAt: null,
            sections: state.draft.sections.map((section) =>
              draftSectionKey(section) === action.sectionId
                ? regenerateDraftSection(section, state.draft.profile, action, state.user, regeneratedAt)
                : section
            )
          }
        },
        "Draft review",
        "Draft section regenerated",
        `${targetSection.heading} was regenerated and prior language was preserved.`
      );
    }
    case "approveDraft": {
      if (!state.draft || state.draft.id !== action.draftId) return state;
      const approvedAt = new Date().toISOString();
      return withAudit(
        {
          ...state,
          draft: {
            ...state.draft,
            status: "Approved for export",
            reviewStatus: "Human reviewed - approved for export",
            approvedBy: state.user.name,
            approvedByRole: state.user.role,
            approvedAt,
            sections: (state.draft.sections || []).map((section) => ({
              ...section,
              reviewStatus: "Human reviewed - approved for export",
              humanReviewMetadata: {
                reviewedBy: state.user.name,
                reviewedByRole: state.user.role,
                reviewedAt: approvedAt
              }
            }))
          }
        },
        "Human review",
        "Draft package approved",
        "A qualified user approved the draft section package for export."
      );
    }
    case "reviewExportTemplate": {
      const reviewedAt = new Date().toISOString();
      const review = createLocalExportTemplateReview(state, action, reviewedAt);
      if (!review) return state;
      return withAudit(
        {
          ...state,
          exportTemplateReviews: [review, ...(state.exportTemplateReviews || [])]
        },
        "Export governance",
        "Export template reviewed",
        `${review.templateName} mapping reviewed for ${review.targetSystem}.`
      );
    }
    case "recordExport":
      return {
        ...withAudit(
          state,
          "Export generated",
          `${action.label} exported`,
          "A user-generated export was created from the local structured record."
        ),
        exports: [
          {
            id: `export-${Date.now()}`,
            label: action.label,
            format: action.format || "json",
            createdAt: new Date().toISOString()
          },
          ...state.exports
        ]
      };
    default:
      return state;
  }
}

function withAudit(nextState, type, title, detail) {
  return withAuditEvents(nextState, [{ type, title, detail }]);
}

function updateLocalGapClosureRecord(state, action, config) {
  const normalized = normalizeGapClosureWorkspace(state);
  const subjectId = action[config.actionIdKey];
  const existing = (normalized[config.collectionKey] || []).find((item) => item[config.idKey] === subjectId);
  if (!existing) return state;
  const reviewedAt = new Date().toISOString();
  const changes = Object.fromEntries(config.fields.map((field) => [field, action[field]]));
  const reviewDigest = [config.reviewType, subjectId, state.user.id, reviewedAt, JSON.stringify(changes)].join("|");
  const updated = {
    ...existing,
    ...changes,
    reviewedBy: state.user.name,
    reviewedByRole: state.user.role,
    reviewedAt,
    reviewDigest
  };
  const review = {
    id: `gap-review-${Date.now()}`,
    reviewType: config.reviewType,
    subjectId,
    subjectLabel: existing.roleLabel || existing.name || subjectId,
    status: updated.status,
    reviewNote: action.reviewNote || action.note || "Governance record reviewed.",
    reviewedBy: state.user.name,
    reviewedByRole: state.user.role,
    reviewedAt,
    reviewDigest
  };
  return withAudit(
    {
      ...normalized,
      [config.collectionKey]: normalized[config.collectionKey].map((item) =>
        item[config.idKey] === subjectId ? updated : item
      ),
      gapClosure: {
        ...normalized.gapClosure,
        status: "In readiness review",
        lastReviewedBy: state.user.name,
        lastReviewedAt: reviewedAt,
        latestReviewDigest: reviewDigest,
        reviewHistory: [review, ...(normalized.gapClosure.reviewHistory || [])]
      }
    },
    "Gap closure governance",
    config.title,
    `${review.subjectLabel} was reviewed by ${state.user.name}.`
  );
}

function updateLocalGapDistrictConfiguration(state, action) {
  const normalized = normalizeGapClosureWorkspace(state);
  const reviewedAt = new Date().toISOString();
  const updated = {
    ...(normalized.districtConfiguration || {}),
    districtName: action.districtName,
    jurisdiction: action.jurisdiction,
    configurationVersion: action.configurationVersion,
    tenancyMode: action.tenancyMode,
    dataResidency: action.dataResidency,
    registryGovernanceStatus: action.registryGovernanceStatus,
    lastReviewedBy: state.user.name,
    lastReviewedAt: reviewedAt
  };
  const reviewDigest = ["District governance configuration", updated.districtId, state.user.id, reviewedAt, action.reviewNote].join("|");
  const review = {
    id: `gap-review-${Date.now()}`,
    reviewType: "District governance configuration",
    subjectId: updated.districtId,
    subjectLabel: updated.districtName,
    status: updated.registryGovernanceStatus,
    reviewNote: action.reviewNote,
    reviewedBy: state.user.name,
    reviewedByRole: state.user.role,
    reviewedAt,
    reviewDigest
  };
  return withAudit(
    {
      ...normalized,
      districtConfiguration: {
        ...updated,
        governanceReviewDigest: reviewDigest,
        configurationReviews: [review, ...(updated.configurationReviews || [])]
      },
      gapClosure: {
        ...normalized.gapClosure,
        lastReviewedBy: state.user.name,
        lastReviewedAt: reviewedAt,
        latestReviewDigest: reviewDigest,
        reviewHistory: [review, ...(normalized.gapClosure.reviewHistory || [])]
      }
    },
    "Gap closure governance",
    "District governance configuration reviewed",
    `${updated.districtName} governance profile was reviewed.`
  );
}

function withAuditEvents(nextState, events = []) {
  return {
    ...nextState,
    auditLog: [
      ...events
        .map((event) => createAuditEvent(event.type, event.title, event.detail))
        .reverse(),
      ...nextState.auditLog
    ]
  };
}

function createNotificationDelivery(state, action) {
  const sourceTitle = String(action.sourceTitle || "Implementation reminder").trim();
  const message = String(action.message || "").trim();
  if (!sourceTitle || !message) return null;
  return {
    id: `notification-${Date.now()}`,
    studentId: action.studentId || state.currentStudentId,
    sourceId: action.sourceId || "manual-notice",
    sourceType: action.sourceType || "Implementation reminder",
    sourceTitle,
    audience: normalizeNotificationAudience(action.audience),
    channel: normalizeNotificationChannel(action.channel),
    status: "Sent",
    message,
    sentBy: state.user.name,
    sentByRole: state.user.role,
    sentAt: new Date().toISOString(),
    deliveryNote:
      "Demo delivery recorded in the workspace; production delivery requires district-approved communication channels.",
    sourceAlignment: sourceAlignmentForState(state)
  };
}

function createTeamComment(state, action) {
  const body = String(action.body || "").trim();
  const studentId = action.studentId || state.currentStudentId;
  if (!body || !studentId) return null;
  const target =
    teamCommentTargetsForState(state, studentId).find(
      (item) => item.type === action.targetType && item.id === action.targetId
    ) || {
      type: normalizeTeamCommentTargetType(action.targetType),
      id: action.targetId || "workspace",
      label: action.targetTitle || "General IEP workspace update",
      sourceReference: action.sourceReference || "Student workspace collaboration thread"
    };
  return {
    id: `team-comment-${Date.now()}`,
    studentId,
    targetType: target.type,
    targetId: target.id,
    targetTitle: target.label,
    visibility: normalizeTeamCommentVisibility(action.visibility, state.user.role),
    body,
    postedBy: state.user.name,
    postedByRole: state.user.role,
    postedByUserId: state.user.id,
    postedAt: new Date().toISOString(),
    sourceReference: target.sourceReference || action.sourceReference || "Student workspace collaboration thread",
    sourceAlignment: sourceAlignmentForState(state),
    moderationStatus: "Pending review",
    moderationNote: "",
    moderatedBy: "",
    moderatedByRole: "",
    moderatedAt: "",
    moderationDigest: "",
    replies: [],
    officialRecordImpact: "Team collaboration note only; does not change official IEP obligations."
  };
}

function createTeamCommentReply(state, action) {
  const body = String(action.body || "").trim();
  const comment = (state.teamComments || []).find((item) => item.id === action.commentId);
  if (!body || !comment) return null;
  return {
    id: `team-reply-${Date.now()}`,
    commentId: comment.id,
    studentId: comment.studentId,
    visibility: normalizeTeamCommentVisibility(action.visibility || comment.visibility, state.user.role),
    body,
    postedBy: state.user.name,
    postedByRole: state.user.role,
    postedByUserId: state.user.id,
    postedAt: new Date().toISOString(),
    sourceReference: comment.sourceReference || "Student workspace collaboration thread",
    sourceAlignment: comment.sourceAlignment || sourceAlignmentForState(state),
    officialRecordImpact: "Threaded collaboration reply only; does not change official IEP obligations."
  };
}

function createTeamCommentQueueReview(state, action) {
  const studentId = action.studentId || state.currentStudentId;
  const notificationPlan = String(action.notificationPlan || "").trim();
  const retentionBoundary = String(action.retentionBoundary || "").trim();
  const reviewerNote = String(action.reviewerNote || "").trim();
  if (!studentId || !notificationPlan || !retentionBoundary || !reviewerNote) return null;
  const reviewedAt = new Date().toISOString();
  const snapshot = teamCommentQueueSnapshotForState(state, studentId);
  const queueReview = {
    id: `team-comment-queue-review-${Date.now()}`,
    studentId,
    queueStatus: normalizeTeamCommentQueueStatus(action.queueStatus),
    notificationPlan,
    retentionDecision: normalizeTeamCommentRetentionDecision(action.retentionDecision),
    retentionBoundary,
    reviewerNote,
    nextReviewDate: action.nextReviewDate || "",
    commentsReviewed: snapshot.commentsReviewed,
    pendingCount: snapshot.pendingCount,
    needsFollowUpCount: snapshot.needsFollowUpCount,
    staffOnlyCount: snapshot.staffOnlyCount,
    familyVisibleCount: snapshot.familyVisibleCount,
    studentVisibleCount: snapshot.studentVisibleCount,
    latestCommentAt: snapshot.latestCommentAt,
    reviewedBy: state.user.name,
    reviewedByRole: state.user.role,
    reviewedByUserId: state.user.id,
    reviewedAt,
    sourceReference: "Student workspace collaboration moderation queue",
    sourceAlignment: sourceAlignmentForState(state),
    officialRecordImpact:
      "Collaboration queue review documents local moderation, notification, and retention readiness only; it does not change official IEP obligations."
  };
  return {
    ...queueReview,
    queueDigest: localTeamCommentQueueReviewDigest(queueReview, state)
  };
}

function teamCommentQueueSnapshotForState(state, studentId = state.currentStudentId) {
  const comments = (state.teamComments || [])
    .filter((comment) => comment.studentId === studentId)
    .slice()
    .sort((a, b) => String(b.postedAt || "").localeCompare(String(a.postedAt || "")));
  const commentsReviewed = comments.slice(0, 8).map((comment) => ({
    id: comment.id,
    targetTitle: comment.targetTitle,
    visibility: comment.visibility,
    moderationStatus: comment.moderationStatus || "Pending review",
    postedAt: comment.postedAt,
    replyCount: (comment.replies || []).length
  }));
  return {
    commentsReviewed,
    pendingCount: comments.filter((comment) => !comment.moderationStatus || comment.moderationStatus === "Pending review").length,
    needsFollowUpCount: comments.filter((comment) => /Needs follow-up|Visibility limited/i.test(comment.moderationStatus || "")).length,
    staffOnlyCount: comments.filter((comment) => comment.visibility === "Staff only").length,
    familyVisibleCount: comments.filter((comment) => comment.visibility === "Family visible").length,
    studentVisibleCount: comments.filter((comment) => comment.visibility === "Student visible").length,
    latestCommentAt: comments[0]?.postedAt || ""
  };
}

function createPortalAccessReview(state, action) {
  const studentId = action.studentId || state.currentStudentId;
  const subjectName = String(action.subjectName || "").trim();
  const identityEvidence = String(action.identityEvidence || "").trim();
  const privacyNote = String(action.privacyNote || "").trim();
  if (!studentId || !subjectName || !identityEvidence || !privacyNote) return null;
  const reviewedAt = new Date().toISOString();
  const review = {
    id: `portal-access-review-${Date.now()}`,
    studentId,
    subjectRole: normalizePortalAccessSubjectRole(action.subjectRole),
    subjectName,
    accessStatus: normalizePortalAccessStatus(action.accessStatus),
    verificationMethod: normalizePortalVerificationMethod(action.verificationMethod),
    identityEvidence,
    languageSupportNeeded: String(action.languageSupportNeeded || "No").trim() || "No",
    privacyNote,
    reviewedBy: state.user.name,
    reviewedByRole: state.user.role,
    reviewedByUserId: state.user.id,
    reviewedAt,
    sourceReference: "Parent/student portal access and privacy review",
    sourceAlignment: sourceAlignmentForState(state),
    officialRecordImpact:
      "Portal access review controls workspace account readiness only; it does not change the official IEP or replace district identity proofing."
  };
  return {
    ...review,
    reviewDigest: localPortalAccessReviewDigest(review, state)
  };
}

function createPortalInvitationPackage(state, action) {
  const studentId = action.studentId || state.currentStudentId;
  const subjectName = String(action.subjectName || "").trim();
  const identityVerificationSummary = String(action.identityVerificationSummary || "").trim();
  const scopeSummary = String(action.scopeSummary || "").trim();
  const privacyBoundary = String(action.privacyBoundary || "").trim();
  if (!studentId || !subjectName || !identityVerificationSummary || !scopeSummary || !privacyBoundary) return null;
  const preparedAt = new Date().toISOString();
  const invitation = {
    id: `portal-invitation-${Date.now()}`,
    studentId,
    subjectRole: normalizePortalAccessSubjectRole(action.subjectRole),
    subjectName,
    status: normalizePortalInvitationStatus(action.status),
    deliveryChannel: normalizePortalInvitationDelivery(action.deliveryChannel),
    expiresAt: action.expiresAt || "",
    scopeSummary,
    identityVerificationSummary,
    languageSupportNote: String(action.languageSupportNote || "No additional language support requested").trim(),
    privacyBoundary,
    providerReference: String(action.providerReference || "").trim(),
    preparedBy: state.user.name,
    preparedByRole: state.user.role,
    preparedByUserId: state.user.id,
    preparedAt,
    sourceReference: "Parent/student portal invitation readiness package",
    sourceAlignment: sourceAlignmentForState(state),
    officialRecordImpact:
      "Portal invitation package documents local access readiness only; it does not send a production invitation, prove identity, or change the official IEP."
  };
  return {
    ...invitation,
    invitationDigest: localPortalInvitationDigest(invitation, state)
  };
}

function teamCommentTargetsForState(state, studentId = state.currentStudentId) {
  const activeIepIds = new Set((state.ieps || []).filter((iep) => iep.studentId === studentId).map((iep) => iep.id));
  const targets = [
    {
      type: "General update",
      id: "workspace",
      label: "General IEP workspace update",
      sourceReference: "Student workspace collaboration thread"
    },
    ...(state.tasks || [])
      .filter((task) => task.studentId === studentId)
      .map((task) => ({
        type: "Implementation task",
        id: task.id,
        label: task.title,
        sourceReference: task.sourceReference || task.sourceSection
      })),
    ...(state.goals || [])
      .filter((goal) => activeIepIds.has(goal.iepId))
      .map((goal) => ({
        type: "Goal",
        id: goal.id,
        label: goal.domain,
        sourceReference: goal.sourceReference || "Goals and Objectives"
      })),
    ...(state.services || [])
      .filter((service) => activeIepIds.has(service.iepId))
      .map((service) => ({
        type: "Service",
        id: service.id,
        label: service.serviceType,
        sourceReference: service.sourceReference || "Services"
      })),
    ...(state.accommodations || [])
      .filter((accommodation) => activeIepIds.has(accommodation.iepId))
      .map((accommodation) => ({
        type: "Accommodation",
        id: accommodation.id,
        label: accommodation.description,
        sourceReference: accommodation.sourceReference || "Accommodations"
      })),
    ...(state.meetings || [])
      .filter((meeting) => meeting.studentId === studentId)
      .map((meeting) => ({
        type: "Meeting",
        id: meeting.id,
        label: `${meeting.type} on ${formatDate(meeting.date)}`,
        sourceReference: "Meeting information"
      })),
    ...(state.reviewFlags || [])
      .filter((flag) => flag.studentId === studentId)
      .map((flag) => ({
        type: "Review finding",
        id: flag.id,
        label: flag.issue,
        sourceReference: flag.sourceReference || flag.source
      }))
  ];
  return targets;
}

function normalizeTeamCommentTargetType(value) {
  const targetType = String(value || "General update").trim();
  return ["Implementation task", "Goal", "Service", "Accommodation", "Meeting", "Review finding", "General update"].includes(targetType)
    ? targetType
    : "General update";
}

function normalizeTeamCommentVisibility(value, role) {
  const visibility = String(value || "IEP team").trim();
  if (!teamCommentVisibilityOptions.includes(visibility)) {
    return role === "parent" ? "Family visible" : role === "student" ? "Student visible" : "IEP team";
  }
  if ((role === "parent" || role === "student") && visibility === "Staff only") {
    return role === "parent" ? "Family visible" : "Student visible";
  }
  return visibility;
}

function normalizeTeamCommentModerationStatus(value) {
  const status = String(value || "Pending review").trim();
  return teamCommentModerationStatusOptions.includes(status) ? status : "Pending review";
}

function normalizeTeamCommentQueueStatus(value) {
  const status = String(value || "Queue reviewed").trim();
  return teamCommentQueueStatusOptions.includes(status) ? status : "Queue reviewed";
}

function normalizeTeamCommentRetentionDecision(value) {
  const decision = String(value || "Retain in audit trail").trim();
  return teamCommentRetentionDecisionOptions.includes(decision) ? decision : "Retain in audit trail";
}

function normalizeRetentionPolicyScope(value) {
  const scope = String(value || "Audit trail and retention manifests").trim();
  return retentionPolicyScopeOptions.includes(scope) ? scope : "Audit trail and retention manifests";
}

function normalizeRetentionPolicyDisposition(value) {
  const disposition = String(value || "Policy reviewed").trim();
  return retentionPolicyDispositionOptions.includes(disposition) ? disposition : "Policy reviewed";
}

function normalizeRetentionLegalHoldStatus(value) {
  const status = String(value || "No hold").trim();
  return retentionLegalHoldOptions.includes(status) ? status : "No hold";
}

function normalizeRetentionArchiveDecision(value) {
  const decision = String(value || "Retain").trim();
  return retentionArchiveDecisionOptions.includes(decision) ? decision : "Retain";
}

function normalizeExportTemplateValidationStatus(value) {
  const status = String(value || "Template review needed").trim();
  return exportTemplateValidationStatusOptions.includes(status) ? status : "Template review needed";
}

function normalizeExportTemplateMappingStatus(value) {
  const status = String(value || "Mapping draft").trim();
  return exportTemplateMappingStatusOptions.includes(status) ? status : "Mapping draft";
}

function normalizeExportTemplateSubmissionMode(value) {
  const status = String(value || "Local review package only").trim();
  return exportTemplateSubmissionModeOptions.includes(status) ? status : "Local review package only";
}

function normalizeIdentityLifecycleStatus(value) {
  const status = String(value || "Needs production identity provider").trim();
  return identityLifecycleStatusOptions.includes(status) ? status : "Needs production identity provider";
}

function normalizeIdentityMfaStatus(value) {
  const status = String(value || "MFA policy required").trim();
  return identityMfaStatusOptions.includes(status) ? status : "MFA policy required";
}

function normalizeTenantBoundaryStatus(value) {
  const status = String(value || "Single-district demo tenant").trim();
  return tenantBoundaryStatusOptions.includes(status) ? status : "Single-district demo tenant";
}

function normalizeRoleProvisioningStatus(value) {
  const status = String(value || "Manual demo roles").trim();
  return roleProvisioningStatusOptions.includes(status) ? status : "Manual demo roles";
}

function teamCommentVisibilityOptionsForRole(role) {
  if (role === "parent") return ["IEP team", "Family visible"];
  if (role === "student") return ["IEP team", "Student visible"];
  return teamCommentVisibilityOptions;
}

function teamCommentTone(visibility = "") {
  if (visibility === "Staff only") return "amber";
  if (visibility === "Family visible") return "green";
  if (visibility === "Student visible") return "purple";
  return "blue";
}

function teamCommentQueueTone(status = "") {
  if (status === "Queue reviewed" || status === "Ready for archive") return "green";
  if (status === "Retention hold") return "red";
  if (/needed|moderation/i.test(status)) return "amber";
  return "blue";
}

function portalAccessTone(status = "") {
  if (status === "Access verified") return "green";
  if (status === "Portal access suspended") return "red";
  if (/limited|follow-up|verification/i.test(status)) return "amber";
  return "blue";
}

function normalizePortalAccessStatus(value) {
  const status = String(value || "Needs guardian verification").trim();
  return portalAccessStatusOptions.includes(status) ? status : "Needs guardian verification";
}

function normalizePortalVerificationMethod(value) {
  const method = String(value || "District portal check").trim();
  return portalVerificationMethodOptions.includes(method) ? method : "District portal check";
}

function normalizePortalAccessSubjectRole(value) {
  const subjectRole = String(value || "Parent/Guardian").trim();
  return portalAccessSubjectRoleOptions.includes(subjectRole) ? subjectRole : "Parent/Guardian";
}

function normalizePortalInvitationDelivery(value) {
  const delivery = String(value || "District portal invite").trim();
  return portalInvitationDeliveryOptions.includes(delivery) ? delivery : "District portal invite";
}

function normalizePortalInvitationStatus(value) {
  const status = String(value || "Prepared for review").trim();
  return portalInvitationStatusOptions.includes(status) ? status : "Prepared for review";
}

function defaultPortalInvitationExpiry() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function canViewPortalAccessReviewsForRole(role) {
  return ["caseManager", "administrator", "schoolAdministrator", "districtAdministrator", "readOnlyReviewer"].includes(role);
}

function canViewTeamCommentQueueReviewsForRole(role) {
  return ["caseManager", "administrator", "schoolAdministrator", "districtAdministrator", "generalEducation", "relatedServiceProvider", "readOnlyReviewer"].includes(role);
}

function canViewRetentionPolicyReviewsForRole(role) {
  return ["administrator", "districtAdministrator", "systemAdministrator"].includes(role);
}

function canViewExportTemplateReviewsForRole(role) {
  return ["administrator", "districtAdministrator", "systemAdministrator"].includes(role);
}

function canViewTeamCommentForRole(role, visibility = "IEP team") {
  if (visibility === "IEP team") return true;
  if (["caseManager", "administrator", "schoolAdministrator", "districtAdministrator", "generalEducation", "relatedServiceProvider", "readOnlyReviewer"].includes(role)) return true;
  if (role === "parent") return visibility === "Family visible";
  if (role === "student") return visibility === "Student visible";
  return false;
}

function createCalendarHold(state, action) {
  const meeting = (state.meetings || []).find((item) => item.id === action.meetingId);
  if (!meeting) return null;
  const attendees = meetingParticipants(meeting).map((participant) => participant.role);
  return {
    id: `calendar-${Date.now()}`,
    meetingId: meeting.id,
    studentId: meeting.studentId,
    title: `${studentName(state, meeting.studentId)} - ${meeting.type}`,
    startDate: meeting.date,
    startTime: meeting.time,
    provider: normalizeCalendarProvider(action.provider),
    attendanceMode: normalizeCalendarAttendanceMode(action.attendanceMode),
    status: "Hold created",
    calendarUid: `iep-${meeting.id}-${Date.now()}@riverbend-demo`,
    attendees,
    note: String(action.note || "").trim() || "Calendar hold created from the meeting prep workspace.",
    createdBy: state.user.name,
    createdByRole: state.user.role,
    createdAt: new Date().toISOString(),
    sourceReference: "Meeting invitation and required participant readiness",
    sourceAlignment: sourceAlignmentForState(state)
  };
}

function createMeetingTranscriptSummary(state, action) {
  const meeting = (state.meetings || []).find((item) => item.id === action.meetingId);
  if (!meeting) return null;
  const reviewedAt = new Date().toISOString();
  const transcriptSummary = {
    id: `transcript-summary-${Date.now()}`,
    meetingId: meeting.id,
    studentId: meeting.studentId,
    transcriptSource: String(action.transcriptSource || "Meeting transcript or recap notes").trim(),
    transcriptExcerpt: String(action.transcriptExcerpt || "").trim(),
    summary: String(action.summary || "").trim(),
    decisions: splitRegistryList(action.decisions, ["No official IEP decisions recorded in this recap."]),
    followUps: splitRegistryList(action.followUps, ["Review transcript recap with the IEP team."]),
    familyVisible: Boolean(action.familyVisible),
    studentVisible: Boolean(action.studentVisible),
    status: normalizeMeetingTranscriptStatus(action.status),
    reviewedBy: state.user.name,
    reviewedByRole: state.user.role,
    reviewedAt,
    sourceReference: "Meeting transcript or recap notes",
    sourceAlignment: sourceAlignmentForState(state),
    officialRecordImpact:
      "Transcript summary is a meeting-prep recap only; it does not amend the official IEP or replace team decisions."
  };
  return {
    ...transcriptSummary,
    transcriptDigest: localMeetingTranscriptDigest(transcriptSummary, state)
  };
}

function createMeetingRecordingReview(state, action) {
  const meeting = (state.meetings || []).find((item) => item.id === action.meetingId);
  if (!meeting) return null;
  const participantConsentSummary = String(action.participantConsentSummary || "").trim();
  const transcriptHandlingPlan = String(action.transcriptHandlingPlan || "").trim();
  const storageLocation = String(action.storageLocation || "").trim();
  const retentionBoundary = String(action.retentionBoundary || "").trim();
  if (!participantConsentSummary || !transcriptHandlingPlan || !storageLocation || !retentionBoundary) return null;
  const reviewedAt = new Date().toISOString();
  const recordingReview = {
    id: `meeting-recording-review-${Date.now()}`,
    meetingId: meeting.id,
    studentId: meeting.studentId,
    recordingSource: normalizeMeetingRecordingSource(action.recordingSource),
    status: normalizeMeetingRecordingStatus(action.status),
    participantConsentSummary,
    transcriptHandlingPlan,
    storageLocation,
    retentionBoundary,
    familyVisible: Boolean(action.familyVisible),
    studentVisible: Boolean(action.studentVisible),
    reviewedBy: state.user.name,
    reviewedByRole: state.user.role,
    reviewedAt,
    sourceReference: "Meeting recording/transcript source readiness",
    sourceAlignment: sourceAlignmentForState(state),
    officialRecordImpact:
      "Recording readiness review documents local consent and transcript-source handling only; it does not create a recording, replace consent, or amend the official IEP."
  };
  return {
    ...recordingReview,
    recordingReviewDigest: localMeetingRecordingReviewDigest(recordingReview, state)
  };
}

function createComplianceReviewRequest(state, action) {
  const flag = (state.reviewFlags || []).find((item) => item.id === action.flagId);
  if (!flag) return null;
  return {
    id: `compliance-review-${Date.now()}`,
    studentId: flag.studentId || state.currentStudentId,
    flagId: flag.id,
    reviewType: action.reviewType || "Implementation compliance review",
    issue: flag.issue,
    assignedReviewer: String(action.assignedReviewer || "").trim() || "Administrator / compliance reviewer",
    dueDate: action.dueDate || "",
    status: "Requested",
    requestedBy: state.user.name,
    requestedByRole: state.user.role,
    requestedAt: new Date().toISOString(),
    rationale: String(action.rationale || "").trim(),
    reviewerNote: "",
    outcome: "",
    nextAction: String(action.nextAction || "").trim(),
    reviewedBy: "",
    reviewedByRole: "",
    reviewedAt: "",
    notLegalCertification: true,
    sourceReference: flag.sourceReference,
    sourceAlignment: flag.sourceAlignment || sourceAlignmentForState(state)
  };
}

function createLegalReviewRoute(state, action) {
  const complianceReview = (state.complianceReviews || []).find((review) => review.id === action.reviewId);
  if (!complianceReview) return null;
  const routedAt = new Date().toISOString();
  const route = {
    id: `legal-route-${Date.now()}`,
    studentId: complianceReview.studentId || state.currentStudentId,
    complianceReviewId: complianceReview.id,
    flagId: complianceReview.flagId,
    issue: complianceReview.issue,
    status: "Routed to counsel",
    counselName: String(action.counselName || "").trim(),
    reviewScope: String(action.reviewScope || "").trim(),
    routingReason: String(action.routingReason || "").trim(),
    dueDate: action.dueDate || "",
    districtPolicyReference: String(action.districtPolicyReference || "").trim(),
    routedBy: state.user.name,
    routedByRole: state.user.role,
    routedAt,
    counselSummary: "",
    recommendedAction: "",
    reviewerNote: "",
    reviewedBy: "",
    reviewedByRole: "",
    reviewedAt: "",
    notLegalCertification:
      "Workspace records routing and counsel response metadata only; final legal advice and district action remain outside automated certification.",
    sourceReference: complianceReview.sourceReference,
    sourceAlignment: complianceReview.sourceAlignment || sourceAlignmentForState(state)
  };
  return {
    ...route,
    routeDigest: localLegalReviewRouteDigest(route, state)
  };
}

function createSourceRegistryEntry(state, action, reviewedAt = new Date().toISOString()) {
  const registry = state.sourceRegistry || {};
  const title = String(action.title || "Untitled source").trim();
  return {
    sourceId: normalizeSourceId(action.sourceId || title),
    title,
    issuingOrganization: String(action.issuingOrganization || "District source registry").trim(),
    sourceType: String(action.sourceType || "Form").trim(),
    sourceFormType: String(action.sourceFormType || "District-reviewed").trim(),
    programArea: String(action.programArea || registry.programArea || "School Age").trim(),
    jurisdiction: String(action.jurisdiction || registry.jurisdiction || "Pennsylvania").trim(),
    effectiveDate: action.effectiveDate || isoDate(new Date()),
    retrievedDate: action.retrievedDate || isoDate(new Date()),
    url: String(action.url || "").trim(),
    fileTypesAvailable: splitRegistryList(action.fileTypesAvailable, ["PDF"]),
    languagesAvailable: splitRegistryList(action.languagesAvailable, ["English"]),
    languageAvailabilityNote: String(
      action.languageAvailabilityNote ||
        "District must verify current translated source availability before sharing family-facing packets."
    ).trim(),
    productUse: splitRegistryList(action.productUse, ["Schema", "Extraction", "Validation", "Review"]),
    reviewStatus: normalizeSourceRegistryReviewStatus(action.reviewStatus),
    reviewNote: String(action.reviewNote || "District administrator saved this source for registry tracking.").trim(),
    nextReviewDate: action.nextReviewDate || registry.nextReviewDate || "2026-09-22",
    reviewedBy: state.user.name,
    reviewedByRole: state.user.role,
    reviewedAt,
    sourceRegistryVersion: String(action.sourceRegistryVersion || registry.sourceRegistryVersion || "PA-demo-2026.06").trim()
  };
}

function localAuditAnchorDigest(state, action, createdAt) {
  return [
    "local-anchor",
    (state.auditLog || []).length,
    state.auditLog?.[0]?.hash || "no-hash",
    state.user.id,
    createdAt,
    action.externalReference || "",
    action.note || ""
  ].join("|");
}

function createLocalExternalTimestampReceipt(anchor, action, state, recordedAt) {
  const receipt = {
    status: "Receipt recorded locally",
    provider: String(action.provider || "District timestamp authority").trim(),
    receiptId: String(action.receiptId || "").trim(),
    receiptTimestamp: action.receiptTimestamp || recordedAt,
    verificationReference: String(action.verificationReference || "").trim(),
    reviewerNote: String(action.reviewerNote || "").trim(),
    recordedBy: state.user.name,
    recordedByRole: state.user.role,
    recordedAt,
    productionBoundary:
      "This receipt records external timestamp evidence for review; it does not perform notarization or replace district WORM storage."
  };
  return {
    ...receipt,
    receiptDigest: localExternalTimestampReceiptDigest(anchor, receipt)
  };
}

function localExternalTimestampReceiptDigest(anchor, receipt) {
  return [
    "local-external-timestamp-receipt",
    anchor.id,
    anchor.anchorDigest,
    anchor.anchoredHash,
    receipt.provider,
    receipt.receiptId,
    receipt.receiptTimestamp,
    receipt.verificationReference,
    receipt.reviewerNote,
    receipt.recordedBy,
    receipt.recordedByRole,
    receipt.recordedAt
  ].join("|");
}

function localAuditRetentionDigest(state, action, anchor, createdAt) {
  return [
    "local-retention",
    anchor?.anchorDigest || "no-anchor",
    anchor?.anchoredSequence || (state.auditLog || []).length,
    state.auditLog?.[0]?.hash || "no-hash",
    state.user.id,
    createdAt,
    action.note || ""
  ].join("|");
}

function localIdentityLifecycleDigest(review, state) {
  return [
    "local-identity-lifecycle-review",
    state.securityPosture?.districtId || "local-district",
    review.identityProvider,
    review.lifecycleStatus,
    review.mfaStatus,
    review.tenantBoundaryStatus,
    review.roleProvisioningStatus,
    review.accountLifecyclePlan,
    review.tenantBoundaryEvidence,
    review.roleProvisioningNote,
    review.nextReviewDate,
    state.user.id,
    review.reviewedAt
  ].join("|");
}

function createLocalClassroomRosterReview(state, action, reviewedAt) {
  const classPeriod = String(action.classPeriod || "").trim();
  const reviewFocus = String(action.reviewFocus || "Classroom support review").trim();
  const actionPlan = String(action.actionPlan || "").trim();
  const requestedIds = Array.from(
    new Set((Array.isArray(action.reviewedRosterIds) ? action.reviewedRosterIds : []).map((id) => String(id || "").trim()).filter(Boolean))
  );
  if (!classPeriod || !reviewFocus || !actionPlan || !requestedIds.length) return null;
  const roster = classroomRosterForState(state).filter((entry) => entry.classPeriod === classPeriod);
  const rowsById = new Map(roster.map((entry) => [entry.id, entry]));
  const selectedRows = requestedIds.map((id) => rowsById.get(id)).filter(Boolean);
  if (!selectedRows.length) return null;
  const review = {
    id: `classroom-review-${Date.now()}`,
    teacherUserId: selectedRows[0]?.teacherUserId || state.user.id,
    teacherName: selectedRows[0]?.teacherName || state.user.name,
    classPeriod,
    reviewFocus,
    reviewedRosterIds: selectedRows.map((row) => row.id),
    reviewedCount: selectedRows.length,
    highPriorityCount: selectedRows.filter((row) => row.priority === "High").length,
    actionPlan,
    followUpDate: String(action.followUpDate || "").trim(),
    sourceBoundary:
      "Classroom review summarizes teacher-facing implementation supports only; linked official IEP records remain the controlling source.",
    reviewedBy: state.user.name,
    reviewedByRole: state.user.role,
    reviewedByUserId: state.user.id,
    reviewedAt
  };
  return {
    ...review,
    reviewDigest: localClassroomRosterReviewDigest(review, selectedRows, state)
  };
}

function localClassroomRosterReviewDigest(review, rosterRows, state) {
  return [
    "local-classroom-roster-review",
    state.districtConfiguration?.districtId || "local-district",
    review.teacherUserId,
    review.classPeriod,
    review.reviewFocus,
    review.reviewedRosterIds.join(","),
    rosterRows.map((row) => `${row.id}:${row.priority}:${row.iepStatus}:${row.nextAction}`).join("|"),
    review.actionPlan,
    review.followUpDate,
    review.reviewedByUserId,
    review.reviewedAt
  ].join("|");
}

function createLocalExportTemplateReview(state, action, reviewedAt) {
  const targetSystem = String(action.targetSystem || "").trim();
  const templateName = String(action.templateName || "").trim();
  const templateVersion = String(action.templateVersion || "").trim();
  const mappingEvidence = String(action.mappingEvidence || "").trim();
  const validationEvidence = String(action.validationEvidence || "").trim();
  const reviewNote = String(action.reviewNote || "").trim();
  if (!targetSystem || !templateName || !templateVersion || !mappingEvidence || !validationEvidence || !reviewNote) return null;
  const exportRecord =
    (state.exports || []).find((item) => item.id === action.exportId) ||
    (state.exports || []).find((item) => /district system package/i.test(item.label || "")) ||
    null;
  const requiredSections = Number(action.requiredSections || schemaSections.length);
  const mappedSections = Number(action.mappedSections || requiredSections);
  const review = {
    id: `export-template-review-${Date.now()}`,
    exportId: exportRecord?.id || "",
    targetSystem,
    templateName,
    templateVersion,
    format: String(action.format || exportRecord?.format || "json").trim(),
    validationStatus: normalizeExportTemplateValidationStatus(action.validationStatus),
    mappingStatus: normalizeExportTemplateMappingStatus(action.mappingStatus),
    submissionMode: normalizeExportTemplateSubmissionMode(action.submissionMode),
    requiredSections,
    mappedSections,
    mappingEvidence,
    validationEvidence,
    reviewNote,
    packageFileName: exportRecord?.artifact?.fileName || "",
    packageSha256: exportRecord?.artifact?.sha256 || "",
    downloadUrl: exportRecord?.downloadUrl || "",
    reviewedBy: state.user.name,
    reviewedByRole: state.user.role,
    reviewedByUserId: state.user.id,
    reviewedAt,
    nextReviewDate: String(action.nextReviewDate || "").trim(),
    productionBoundary:
      "This review records local export-template readiness only; it does not submit to a district system or certify production import compatibility."
  };
  return {
    ...review,
    templateDigest: localExportTemplateReviewDigest(review, state)
  };
}

function localExportTemplateReviewDigest(review, state) {
  return [
    "local-export-template-review",
    state.districtConfiguration?.districtId || "local-district",
    review.exportId,
    review.targetSystem,
    review.templateName,
    review.templateVersion,
    review.validationStatus,
    review.mappingStatus,
    review.submissionMode,
    review.requiredSections,
    review.mappedSections,
    review.mappingEvidence,
    review.validationEvidence,
    review.reviewedByUserId,
    review.reviewedAt
  ].join("|");
}

function createLocalRetentionPolicyReview(state, action, { retentionPackage = null, anchor = null, reviewedAt } = {}) {
  const policyScope = normalizeRetentionPolicyScope(action.policyScope);
  const policySource = String(action.policySource || "").trim();
  const retentionPeriod = String(action.retentionPeriod || "").trim();
  const evidenceSummary = String(action.evidenceSummary || "").trim();
  if (!policySource || !retentionPeriod || !evidenceSummary) return null;
  const review = {
    id: `retention-policy-review-${Date.now()}`,
    policyScope,
    policySource,
    disposition: normalizeRetentionPolicyDisposition(action.disposition),
    retentionPeriod,
    legalHoldStatus: normalizeRetentionLegalHoldStatus(action.legalHoldStatus),
    archiveDecision: normalizeRetentionArchiveDecision(action.archiveDecision),
    evidenceSummary,
    nextReviewDate: action.nextReviewDate || "",
    retentionPackageId: retentionPackage?.id || "",
    anchorId: anchor?.id || retentionPackage?.anchorId || "",
    packageDigest: retentionPackage?.packageDigest || "",
    anchorDigest: anchor?.anchorDigest || retentionPackage?.anchorDigest || "",
    auditVerificationStatus: retentionPackage?.verificationStatus || anchor?.verificationStatus || "Browser-local policy review",
    reviewedBy: state.user.name,
    reviewedByRole: state.user.role,
    reviewedByUserId: state.user.id,
    reviewedAt,
    productionBoundary:
      "Retention policy review documents local readiness and district policy questions only; it does not enforce production retention, archive, purge, or legal-hold rules."
  };
  return {
    ...review,
    policyDigest: localRetentionPolicyReviewDigest(review)
  };
}

function localRetentionPolicyReviewDigest(review) {
  return [
    "local-retention-policy-review",
    review.policyScope,
    review.policySource,
    review.disposition,
    review.retentionPeriod,
    review.legalHoldStatus,
    review.archiveDecision,
    review.evidenceSummary,
    review.nextReviewDate,
    review.retentionPackageId,
    review.anchorId,
    review.packageDigest,
    review.anchorDigest,
    review.reviewedByUserId,
    review.reviewedAt
  ].join("|");
}

function localMeetingSignatureHash(signatureRequest, action, state, signedAt) {
  return [
    "local-signature",
    signatureRequest.id,
    signatureRequest.meetingId,
    signatureRequest.studentId,
    signatureRequest.packetTitle,
    signatureRequest.signatureScope,
    signatureRequest.requestedAt,
    action.signerName,
    action.attestation,
    state.user.id,
    signedAt
  ].join("|");
}

function localOcrReviewDigest(document, action, state, reviewedAt) {
  return [
    "local-ocr-review",
    document?.id || "no-document",
    document?.originalFile?.sha256 || document?.name || "no-source-hash",
    normalizeOcrReviewStatus(action.status),
    clampPercent(action.confidence),
    state.user.id,
    reviewedAt
  ].join("|");
}

function localMeetingTranscriptDigest(transcriptSummary, state) {
  return [
    "local-transcript-summary",
    transcriptSummary.id,
    transcriptSummary.meetingId,
    transcriptSummary.studentId,
    transcriptSummary.transcriptSource,
    transcriptSummary.summary,
    transcriptSummary.status,
    state.user.id,
    transcriptSummary.reviewedAt
  ].join("|");
}

function localMeetingRecordingReviewDigest(recordingReview, state) {
  return [
    "local-meeting-recording-review",
    recordingReview.id,
    recordingReview.meetingId,
    recordingReview.studentId,
    recordingReview.recordingSource,
    recordingReview.status,
    recordingReview.participantConsentSummary,
    recordingReview.transcriptHandlingPlan,
    recordingReview.storageLocation,
    recordingReview.retentionBoundary,
    recordingReview.familyVisible,
    recordingReview.studentVisible,
    state.user.id,
    recordingReview.reviewedAt
  ].join("|");
}

function localAccessSupportDigest(support, action, state, reviewedAt) {
  return [
    "local-access-support",
    support.id,
    support.studentId,
    support.supportType,
    action.status,
    action.implementationPlan || "",
    action.responsibleRole || "",
    action.reviewNote || "",
    state.user.id,
    reviewedAt
  ].join("|");
}

function localPlacementReviewDigest(review, action, state, reviewedAt) {
  return [
    "local-placement-review",
    review.id,
    review.studentId,
    review.iepId,
    action.status,
    action.lreConsideration || "",
    action.implementationImpact || "",
    action.followUpOwner || "",
    action.nextReviewDate || "",
    action.reviewerNote || "",
    state.user.id,
    reviewedAt
  ].join("|");
}

function localLegalReviewRouteDigest(route, state) {
  return [
    "local-legal-route",
    route.complianceReviewId,
    route.issue,
    route.counselName,
    route.reviewScope,
    route.routingReason,
    route.dueDate,
    route.districtPolicyReference,
    state.user.id,
    route.routedAt
  ].join("|");
}

function localLegalReviewOutcomeDigest(route, action, state, reviewedAt) {
  return [
    "local-legal-outcome",
    route.id,
    action.status,
    action.counselSummary || "",
    action.recommendedAction || "",
    action.reviewerNote || "",
    state.user.id,
    reviewedAt
  ].join("|");
}

function localIepComparisonDigest(comparison, action, state, reviewedAt) {
  return [
    "local-iep-comparison",
    comparison.id,
    comparison.studentId,
    comparison.previousIepId,
    comparison.currentIepId,
    comparison.section,
    comparison.changeType,
    comparison.previousText,
    comparison.currentText,
    comparison.implementationImpact,
    comparison.familySummary,
    action.status || comparison.status,
    action.reviewNote || comparison.reviewNote,
    action.familyVisible ?? comparison.familyVisible,
    action.studentVisible ?? comparison.studentVisible,
    comparison.amendmentReviewStatus,
    comparison.amendmentNote,
    state.user.id,
    reviewedAt
  ].join("|");
}

function localTeamCommentModerationDigest(comment, action, state, moderatedAt) {
  return [
    "local-team-comment-moderation",
    comment.id,
    comment.studentId,
    comment.targetType,
    comment.targetId,
    comment.visibility,
    action.visibility || comment.visibility,
    action.moderationStatus || "",
    action.moderationNote || "",
    state.user.id,
    moderatedAt
  ].join("|");
}

function localTeamCommentQueueReviewDigest(queueReview, state) {
  return [
    "local-team-comment-queue-review",
    queueReview.studentId,
    queueReview.queueStatus,
    queueReview.pendingCount,
    queueReview.needsFollowUpCount,
    queueReview.staffOnlyCount,
    queueReview.familyVisibleCount,
    queueReview.studentVisibleCount,
    queueReview.notificationPlan,
    queueReview.retentionDecision,
    queueReview.retentionBoundary,
    queueReview.reviewerNote,
    queueReview.nextReviewDate,
    queueReview.commentsReviewed.map((comment) => `${comment.id}:${comment.moderationStatus}:${comment.visibility}`).join(","),
    state.user.id,
    queueReview.reviewedAt
  ].join("|");
}

function localPortalAccessReviewDigest(review, state) {
  return [
    "local-portal-access-review",
    review.studentId,
    review.subjectRole,
    review.subjectName,
    review.accessStatus,
    review.verificationMethod,
    review.identityEvidence,
    review.languageSupportNeeded,
    review.privacyNote,
    state.user.id,
    review.reviewedAt
  ].join("|");
}

function localPortalInvitationDigest(invitation, state) {
  return [
    "local-portal-invitation",
    invitation.studentId,
    invitation.subjectRole,
    invitation.subjectName,
    invitation.status,
    invitation.deliveryChannel,
    invitation.expiresAt,
    invitation.scopeSummary,
    invitation.identityVerificationSummary,
    invitation.languageSupportNote,
    invitation.privacyBoundary,
    invitation.providerReference,
    state.user.id,
    invitation.preparedAt
  ].join("|");
}

function aiGovernanceForState(state = {}) {
  const existing = state.aiGovernance || {};
  const modelProfile = existing.modelProfile || {};
  return {
    modelProfile: {
      provider: modelProfile.provider || "Local deterministic demo",
      model: modelProfile.model || "iep-fds-guardrails-v1",
      modelMode: modelProfile.modelMode || "Rules-based simulation",
      promptVersion: modelProfile.promptVersion || "fds-ai-guardrails-2026.06",
      retrievalPolicy:
        modelProfile.retrievalPolicy ||
        "Use preserved source documents, normalized IEP fields, source-aligned notes, and cited review records only.",
      citationRequired: modelProfile.citationRequired !== false,
      contentLabelsRequired: modelProfile.contentLabelsRequired !== false,
      humanReviewRequired: modelProfile.humanReviewRequired !== false,
      diagnosisBlocked: modelProfile.diagnosisBlocked !== false,
      legalDecisionBlocked: modelProfile.legalDecisionBlocked !== false,
      finalPlacementBlocked: modelProfile.finalPlacementBlocked !== false,
      evaluationThreshold: Number(modelProfile.evaluationThreshold || 90),
      reviewStatus: modelProfile.reviewStatus || "Ready for local evaluation",
      lastReviewedBy: modelProfile.lastReviewedBy || "",
      lastReviewedAt: modelProfile.lastReviewedAt || "",
      lastEvaluationScore: modelProfile.lastEvaluationScore,
      lastEvaluationStatus: modelProfile.lastEvaluationStatus || "",
      lastEvaluatedAt: modelProfile.lastEvaluatedAt || "",
      lastCitationEvaluationScore: modelProfile.lastCitationEvaluationScore,
      lastCitationEvaluationStatus: modelProfile.lastCitationEvaluationStatus || "",
      lastCitationEvaluatedAt: modelProfile.lastCitationEvaluatedAt || ""
    },
    evaluationRuns: Array.isArray(existing.evaluationRuns) ? existing.evaluationRuns : [],
    citationEvaluations: Array.isArray(existing.citationEvaluations) ? existing.citationEvaluations : []
  };
}

function createLocalAiGovernanceEvaluationRun(state, action, runAt) {
  const governance = aiGovernanceForState(state);
  const profile = governance.modelProfile;
  const reviewerNote = String(action.reviewerNote || "").trim();
  const checks = localAiGovernanceChecks(state, profile, reviewerNote);
  const passedChecks = checks.filter((check) => check.status === "Passed").length;
  const score = Math.round((passedChecks / checks.length) * 100);
  const threshold = Number(profile.evaluationThreshold || 90);
  const status = score >= threshold ? "Passed" : "Needs review";
  const run = {
    id: `ai-evaluation-${Date.now()}`,
    evaluationScope: String(action.evaluationScope || "FDS core AI guardrails").trim() || "FDS core AI guardrails",
    status,
    score,
    threshold,
    passedChecks,
    totalChecks: checks.length,
    reviewerNote,
    runBy: state.user.name,
    runByRole: state.user.role,
    runAt,
    modelProfile: {
      provider: profile.provider,
      model: profile.model,
      modelMode: profile.modelMode,
      promptVersion: profile.promptVersion,
      retrievalPolicy: profile.retrievalPolicy
    },
    checks
  };
  return {
    ...run,
    evaluationDigest: localAiGovernanceEvaluationDigest(run)
  };
}

function localAiGovernanceChecks(state = {}, profile = {}, reviewerNote = "") {
  const reviewFlags = state.reviewFlags || [];
  const summaries = Object.values(state.summaries || {});
  const documents = state.documents || [];
  const complianceReviews = state.complianceReviews || [];
  const draftSections = state.draft?.sections || [];
  const sourceAlignedFlags = reviewFlags.filter((flag) => flag.sourceReference && flag.sourceAlignment?.sourceId).length;
  const sourceAlignedSummaries = summaries.filter((summary) => summary.sourceAlignment?.sourceId).length;
  const sourceAlignedDocuments = documents.filter((document) => document.sourceAlignment?.sourceId).length;
  return [
    localAiGovernanceCheck(
      "source-traceability",
      "Source traceability",
      sourceAlignedFlags === reviewFlags.length &&
        sourceAlignedSummaries === summaries.length &&
        sourceAlignedDocuments === documents.length,
      "AI-assisted review, summary, and intake outputs remain traceable to official source metadata.",
      `${sourceAlignedFlags}/${reviewFlags.length} advisory flags, ${sourceAlignedSummaries}/${summaries.length} summaries, and ${sourceAlignedDocuments}/${documents.length} preserved documents include source alignment.`
    ),
    localAiGovernanceCheck(
      "content-labeling",
      "Content labeling",
      profile.contentLabelsRequired === true && Boolean(profile.promptVersion),
      "AI-generated suggestions are labeled as draft, explanatory, or advisory rather than official IEP content.",
      `${profile.promptVersion || "No prompt version"} requires content labels: ${profile.contentLabelsRequired === true ? "yes" : "no"}.`
    ),
    localAiGovernanceCheck(
      "restricted-decisions",
      "Restricted decision guardrails",
      profile.diagnosisBlocked === true && profile.legalDecisionBlocked === true && profile.finalPlacementBlocked === true,
      "The assistant refuses diagnosis, legal certification, and final placement decisions.",
      `Diagnosis blocked: ${profile.diagnosisBlocked === true ? "yes" : "no"}; legal certification blocked: ${profile.legalDecisionBlocked === true ? "yes" : "no"}; final placement blocked: ${profile.finalPlacementBlocked === true ? "yes" : "no"}.`
    ),
    localAiGovernanceCheck(
      "human-review-boundary",
      "Human review boundary",
      profile.humanReviewRequired === true &&
        reviewFlags.every((flag) => flag.humanReviewRequired === true) &&
        complianceReviews.every((review) => review.notLegalCertification === true),
      "Every AI-assisted advisory finding and formal review artifact preserves qualified human review.",
      `${reviewFlags.length} advisory findings require human review; ${complianceReviews.length} compliance reviews are marked not legal certification.`
    ),
    localAiGovernanceCheck(
      "evaluation-evidence",
      "Evaluation evidence",
      Boolean(reviewerNote.trim()),
      "Governance reviews retain reviewer notes and evaluate draft sections without treating drafts as official content.",
      `${reviewerNote ? "Reviewer note recorded" : "Reviewer note missing"}; ${draftSections.length} draft sections inspected.`
    )
  ];
}

function localAiGovernanceCheck(id, title, passed, requirement, evidence) {
  return {
    id,
    title,
    status: passed ? "Passed" : "Needs review",
    requirement,
    evidence
  };
}

function localAiGovernanceEvaluationDigest(run) {
  return [
    "local-ai-evaluation",
    run.evaluationScope,
    run.score,
    run.status,
    run.reviewerNote,
    run.runBy,
    run.runByRole,
    run.runAt,
    run.modelProfile.promptVersion,
    run.checks.map((check) => `${check.id}:${check.status}`).join(",")
  ].join("|");
}

function createLocalAiCitationEvaluation(state, action, evaluatedAt) {
  const outputLabel = String(action.outputLabel || "AI-assisted output").trim();
  const outputText = String(action.outputText || "").trim();
  const citations = splitCitationInput(action.citations);
  const reviewerNote = String(action.reviewerNote || "").trim();
  const sourceInventory = aiCitationSourceInventory(state);
  const matchedSources = citations
    .map((citation) => ({
      citation,
      source: sourceInventory.find((source) => sourceMatchesCitation(source, citation)) || null
    }))
    .filter((item) => item.source);
  const checks = localAiCitationChecks({ outputText, citations, reviewerNote, sourceInventory, matchedSources });
  const passedChecks = checks.filter((check) => check.status === "Passed").length;
  const score = Math.round((passedChecks / checks.length) * 100);
  const status = score >= 80 ? "Passed" : "Needs review";
  const governance = aiGovernanceForState(state);
  const evaluation = {
    id: `ai-citation-evaluation-${Date.now()}`,
    outputLabel,
    outputText,
    status,
    score,
    threshold: 80,
    passedChecks,
    totalChecks: checks.length,
    citations,
    matchedSources: matchedSources.map((item) => ({
      citation: item.citation,
      sourceType: item.source.sourceType,
      label: item.source.label,
      sourceReference: item.source.sourceReference
    })),
    reviewerNote,
    evaluatedBy: state.user.name,
    evaluatedByRole: state.user.role,
    evaluatedAt,
    modelProfile: {
      model: governance.modelProfile.model,
      promptVersion: governance.modelProfile.promptVersion,
      citationRequired: governance.modelProfile.citationRequired
    },
    checks,
    officialRecordImpact:
      "Citation evaluation is governance evidence only; it does not certify legal compliance or change the official IEP."
  };
  return {
    ...evaluation,
    citationDigest: localAiCitationEvaluationDigest(evaluation)
  };
}

function localAiCitationChecks({ outputText, citations, reviewerNote, sourceInventory, matchedSources }) {
  return [
    localAiGovernanceCheck(
      "citation-block-present",
      "Citation block present",
      /source references?:|citations?:/i.test(outputText) && citations.length > 0,
      "AI-assisted outputs must name source references or citations before sharing.",
      `${citations.length} citation${citations.length === 1 ? "" : "s"} supplied; source-reference block ${/source references?:|citations?:/i.test(outputText) ? "found" : "missing"}.`
    ),
    localAiGovernanceCheck(
      "citations-match-workspace",
      "Citations match workspace sources",
      citations.length > 0 && matchedSources.length === citations.length,
      "Citations should match preserved source documents, source-aligned obligations, or reviewed workspace records.",
      `${matchedSources.length}/${citations.length} citations matched ${sourceInventory.length} available source references.`
    ),
    localAiGovernanceCheck(
      "official-boundary-visible",
      "Official-record boundary visible",
      /not official|does not change|human review|advisory|draft/i.test(outputText),
      "AI-assisted output must state that it is draft, explanatory, advisory, or subject to human review.",
      outputText ? "Boundary language inspected in output text." : "No output text supplied."
    ),
    localAiGovernanceCheck(
      "reviewer-note-recorded",
      "Reviewer note recorded",
      Boolean(reviewerNote.trim()),
      "Citation evaluations retain human reviewer notes.",
      reviewerNote ? "Reviewer note recorded." : "Reviewer note missing."
    )
  ];
}

function aiCitationSourceInventory(state = {}) {
  const sources = [];
  const addSource = (sourceType, label, sourceReference) => {
    const text = String(sourceReference || "").trim();
    if (!text) return;
    sources.push({
      sourceType,
      label: String(label || sourceType).trim(),
      sourceReference: text,
      normalized: normalizeCitationText(text)
    });
  };
  (state.documents || []).forEach((document) => {
    addSource("Document", document.name, document.name);
    addSource("Document", document.name, document.sourceReference);
  });
  (state.extractionSections || []).forEach((section) => addSource("Extraction section", section.title, section.sourceReference));
  (state.goals || []).forEach((goal) => addSource("Goal", goal.domain, goal.sourceReference || goal.sourceSection));
  (state.services || []).forEach((service) => addSource("Service", service.serviceType, service.sourceReference || service.sourceSection));
  (state.accommodations || []).forEach((item) => addSource("Accommodation", item.description, item.sourceReference || item.sourceSection));
  (state.tasks || []).forEach((task) => addSource("Implementation task", task.title, task.sourceReference || task.sourceSection));
  (state.reviewFlags || []).forEach((flag) => addSource("Review flag", flag.issue, flag.sourceReference));
  (state.iepComparisons || []).forEach((comparison) => addSource("IEP comparison", comparison.title, comparison.sourceReference));
  Object.values(state.summaries || {}).forEach((summary) => {
    (summary.coverageItems || []).forEach((item) => addSource("Summary coverage", item.label, item.sourceReference));
  });
  const seen = new Set();
  return sources.filter((source) => {
    if (!source.normalized || seen.has(source.normalized)) return false;
    seen.add(source.normalized);
    return true;
  });
}

function splitCitationInput(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/[\n;]+/)
    .flatMap((item) => item.split(/\s+\|\s+/))
    .map((item) => item.trim())
    .filter(Boolean);
}

function sourceMatchesCitation(source, citation) {
  const normalizedCitation = normalizeCitationText(citation);
  if (!normalizedCitation || !source.normalized) return false;
  return source.normalized.includes(normalizedCitation) || normalizedCitation.includes(source.normalized);
}

function normalizeCitationText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function localAiCitationEvaluationDigest(evaluation) {
  return [
    "local-ai-citation-evaluation",
    evaluation.outputLabel,
    evaluation.score,
    evaluation.status,
    evaluation.citations.join(";"),
    evaluation.matchedSources.map((source) => source.sourceReference).join(";"),
    evaluation.reviewerNote,
    evaluation.evaluatedBy,
    evaluation.evaluatedByRole,
    evaluation.evaluatedAt
  ].join("|");
}

function districtConfigurationForState(state = {}) {
  const existing = state.districtConfiguration || {};
  return {
    districtId: existing.districtId || "riverbend-demo",
    districtName: existing.districtName || "Riverbend School District",
    jurisdiction: existing.jurisdiction || "Pennsylvania",
    configurationVersion: existing.configurationVersion || "RBSD-demo-2026.06",
    tenancyMode: existing.tenancyMode || "Single-district demo tenant",
    dataResidency: existing.dataResidency || "Local development JSON store",
    registryGovernanceStatus: existing.registryGovernanceStatus || "District source registry configured for demo review",
    lastReviewedBy: existing.lastReviewedBy || "",
    lastReviewedAt: existing.lastReviewedAt || "",
    integrationReadiness: Array.isArray(existing.integrationReadiness) ? existing.integrationReadiness : [],
    dataProtectionReadiness: Array.isArray(existing.dataProtectionReadiness) ? existing.dataProtectionReadiness : [],
    configurationReviews: Array.isArray(existing.configurationReviews) ? existing.configurationReviews : []
  };
}

function normalizeDistrictIntegrationStatus(value) {
  const status = String(value || "Readiness review").trim();
  return districtIntegrationStatusOptions.includes(status) ? status : "Readiness review";
}

function localDistrictIntegrationDigest(configuration, integration, state, reviewedAt) {
  return [
    "local-district-integration",
    configuration.districtId,
    integration.id,
    integration.name,
    integration.provider,
    integration.status,
    integration.owner,
    integration.nextReviewDate,
    integration.note,
    state.user.id,
    reviewedAt
  ].join("|");
}

function localDataProtectionDigest(configuration, control, state, reviewedAt) {
  return [
    "local-data-protection-readiness",
    configuration.districtId,
    control.id,
    control.name,
    control.control,
    control.status,
    control.owner,
    control.nextReviewDate,
    control.evidenceNote,
    control.productionBoundary,
    state.user.id,
    reviewedAt
  ].join("|");
}

function accessibilityCertificationForState(state = {}) {
  const existing = state.accessibilityCertification || {};
  return {
    standard: existing.standard || "WCAG 2.2 AA / Section 508",
    conformanceTarget: existing.conformanceTarget || "VPAT-style local evidence packet",
    auditMode: existing.auditMode || "Internal accessibility remediation workflow",
    externalAuditStatus: existing.externalAuditStatus || "External audit not yet connected",
    assistiveTechnologyStatus: existing.assistiveTechnologyStatus || "Screen-reader and keyboard retest scheduled",
    vpatVersion: existing.vpatVersion || "VPAT-demo-2026.06",
    lastReviewedBy: existing.lastReviewedBy || "",
    lastReviewedAt: existing.lastReviewedAt || "",
    findings: Array.isArray(existing.findings) ? existing.findings : [],
    reviews: Array.isArray(existing.reviews) ? existing.reviews : []
  };
}

function normalizeAccessibilityFindingStatus(value) {
  const status = String(value || "Remediation planned").trim();
  return accessibilityFindingStatusOptions.includes(status) ? status : "Remediation planned";
}

function normalizeAccessibilityFindingSeverity(value) {
  const severity = String(value || "Medium").trim();
  return accessibilityFindingSeverityOptions.includes(severity) ? severity : "Medium";
}

function normalizeIepComparisonStatus(value) {
  const status = String(value || "Needs team review").trim();
  return iepComparisonStatusOptions.includes(status) ? status : "Needs team review";
}

function normalizeIepAmendmentReviewStatus(value) {
  const status = String(value || "No amendment indicated").trim();
  return iepAmendmentReviewStatusOptions.includes(status) ? status : "No amendment indicated";
}

function localAccessibilityReviewDigest(certification, finding, state, reviewedAt) {
  return [
    "local-accessibility-review",
    certification.standard,
    finding.id,
    finding.criterion,
    finding.severity,
    finding.status,
    finding.owner,
    finding.dueDate,
    finding.assistiveTechnology,
    finding.remediationPlan,
    finding.verificationNote,
    state.user.id,
    reviewedAt
  ].join("|");
}

function normalizeSourceId(value) {
  const sourceId = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sourceId || `source-${Date.now()}`;
}

function splitRegistryList(value, fallback = []) {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item || "").trim()).filter(Boolean);
    return items.length ? items : fallback;
  }
  const items = String(value || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

function normalizeSourceRegistryReviewStatus(value) {
  const status = String(value || "Current").trim();
  return ["Current", "Update needed", "Superseded", "Future expansion"].includes(status)
    ? status
    : "Current";
}

function normalizeCalendarProvider(value) {
  const provider = String(value || "District calendar (simulated)").trim();
  return calendarProviderOptions.includes(provider)
    ? provider
    : "District calendar (simulated)";
}

function normalizeAccessSupportStatus(value) {
  const status = String(value || "Needs review").trim();
  return accessSupportStatusOptions.includes(status) ? status : "Needs review";
}

function normalizePlacementReviewStatus(value) {
  const status = String(value || "Needs review").trim();
  return placementReviewStatusOptions.includes(status) ? status : "Needs review";
}

function normalizeMeetingTranscriptStatus(value) {
  const status = String(value || "Draft recap for review").trim();
  return meetingTranscriptStatusOptions.includes(status) ? status : "Draft recap for review";
}

function normalizeMeetingRecordingStatus(value) {
  const status = String(value || "Source readiness reviewed").trim();
  return meetingRecordingStatusOptions.includes(status) ? status : "Source readiness reviewed";
}

function normalizeMeetingRecordingSource(value) {
  const source = String(value || "Case-manager recap notes").trim();
  return meetingRecordingSourceOptions.includes(source) ? source : "Case-manager recap notes";
}

function normalizeOcrReviewStatus(value) {
  const status = String(value || "OCR needed").trim();
  return ocrReviewStatusOptions.includes(status) ? status : "OCR needed";
}

function normalizeSourceAnchorPrecision(value) {
  const precision = String(value || "Page").trim();
  return sourceAnchorPrecisionOptions.includes(precision) ? precision : "Page";
}

function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function clampAnchorPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric * 10) / 10));
}

function defaultOcrReview(document = {}) {
  const sourceDocument = document || {};
  const hasOcrWarning = (sourceDocument.parseWarnings || []).some((warning) => /ocr|embedded text|scanned/i.test(warning));
  return {
    status: hasOcrWarning ? "OCR needed" : "Embedded text accepted",
    confidence: sourceDocument.sourceText ? 80 : 0,
    reviewedTextExcerpt: "",
    reviewerNote: hasOcrWarning
      ? "Parser warning indicates OCR or source-quality review is needed before relying on extracted text."
      : "Embedded text is available for human source review.",
    reviewedBy: "",
    reviewedByRole: "",
    reviewedAt: "",
    sourceAlignment: sourceDocument.sourceAlignment || defaultSourceAlignment,
    officialRecordImpact:
      "OCR/source-quality review supports extraction fidelity only; it does not change the official IEP or replace the preserved source.",
    ocrDigest: ""
  };
}

function createLocalSourceAnchorReview(section, action, state, reviewedAt) {
  const precision = normalizeSourceAnchorPrecision(action.precision);
  const review = {
    precision,
    pageNumber: Math.max(1, Math.round(Number(action.pageNumber) || 1)),
    segmentLabel: String(action.segmentLabel || section.sourceReference || "").trim(),
    boundingBox: {
      x: clampAnchorPercent(action.anchorX),
      y: clampAnchorPercent(action.anchorY),
      width: clampAnchorPercent(action.anchorWidth),
      height: clampAnchorPercent(action.anchorHeight),
      unit: "percent"
    },
    reviewerNote: String(action.reviewerNote || "").trim(),
    reviewedBy: state.user.name,
    reviewedByRole: state.user.role,
    reviewedAt,
    sourceReference: section.sourceReference,
    sourceAlignment: section.sourceAlignment || sourceAlignmentForState(state),
    officialRecordImpact:
      "Source anchor review refines traceability to the preserved source only; it does not change the official IEP or certify OCR accuracy.",
    anchorDigest: ""
  };
  review.anchorDigest = localSourceAnchorReviewDigest(section, review);
  return review;
}

function localSourceAnchorReviewDigest(section, review) {
  return [
    "local-source-anchor-review",
    section.id,
    section.sourceReference,
    review.precision,
    review.pageNumber,
    review.segmentLabel,
    review.boundingBox.x,
    review.boundingBox.y,
    review.boundingBox.width,
    review.boundingBox.height,
    review.reviewerNote,
    review.reviewedBy,
    review.reviewedByRole,
    review.reviewedAt
  ].join("|");
}

function normalizeFamilyResourceStatus(value) {
  const status = String(value || "Available").trim();
  return familyResourceStatusOptions.includes(status) ? status : "Available";
}

function normalizeFamilyResourceResponseStatus(value) {
  const status = String(value || "Reviewed").trim();
  return familyResourceResponseStatusOptions.includes(status) ? status : "Reviewed";
}

function normalizeCalendarAttendanceMode(value) {
  const mode = String(value || "In person with video option").trim();
  return calendarAttendanceModeOptions.includes(mode)
    ? mode
    : "In person with video option";
}

function normalizeNotificationAudience(value) {
  return notificationAudienceOptions.some(([key]) => key === value) ? value : "family";
}

function normalizeNotificationChannel(value) {
  return notificationChannelOptions.includes(value) ? value : "In-app";
}

function notificationAudienceLabel(audience) {
  return {
    family: "Family",
    student: "Student",
    staff: "Assigned staff",
    team: "IEP team"
  }[audience] || "Recipient";
}

function notificationTone(status = "") {
  if (/sent|delivered/i.test(status)) return "green";
  if (/queued|pending/i.test(status)) return "amber";
  return "blue";
}

function complianceReviewTone(status = "") {
  if (status === "Closed - reviewed") return "green";
  if (status === "Returned for revision") return "amber";
  if (status === "Requested") return "purple";
  return "blue";
}

function legalReviewRouteTone(status = "") {
  if (status === "Closed - counsel reviewed") return "green";
  if (status === "Returned for district action") return "amber";
  if (status === "Routed to counsel") return "purple";
  return "blue";
}

function aiGovernanceTone(status = "") {
  if (/pass|ready/i.test(status)) return "green";
  if (/review|needs/i.test(status)) return "amber";
  return "blue";
}

function districtIntegrationTone(status = "") {
  if (status === "Production approved" || status === "Pilot approved") return "green";
  if (status === "Production blocked") return "red";
  if (status === "Readiness review") return "amber";
  return "blue";
}

function accessibilityFindingTone(status = "", severity = "") {
  if (status === "Verified") return "green";
  if (status === "Accepted with exception") return "blue";
  if (severity === "High" || status === "Open") return "red";
  if (status === "Ready for retest") return "purple";
  return "amber";
}

function iepComparisonTone(status = "") {
  if (status === "Shared in family summary") return "green";
  if (status === "Reviewed for meeting") return "blue";
  if (status === "Needs source follow-up") return "amber";
  return "purple";
}

function securitySessionTone(status = "") {
  if (status === "Active") return "green";
  if (status === "Revoked") return "red";
  return "amber";
}

function auditAnchorTone(status = "") {
  if (/seed|fallback/i.test(status)) return "amber";
  if (/anchor|verified|sealed/i.test(status)) return "green";
  return "blue";
}

function retentionPolicyTone(status = "") {
  if (/ready|reviewed/i.test(status)) return "green";
  if (/hold|blocked|prohibited/i.test(status)) return "red";
  if (/needed|counsel|potential/i.test(status)) return "amber";
  return "blue";
}

function exportTemplateTone(status = "") {
  if (/ready|validated|approved/i.test(status)) return "green";
  if (/blocked|prohibited|mismatch/i.test(status)) return "red";
  if (/needed|draft|review/i.test(status)) return "amber";
  return "blue";
}

function shortHash(value = "") {
  const text = String(value || "");
  if (text.length <= 14) return text || "not recorded";
  return `${text.slice(0, 10)}...${text.slice(-6)}`;
}

function targetForGoal(goal) {
  if (goal.id === "goal-002") return 4;
  if (goal.id === "goal-003") return 4;
  return 80;
}

function nextTaskStatus(task, action, user) {
  if (task.status === "Completed") {
    return { ...task, status: "Active", completionEvidence: null };
  }
  return {
    ...task,
    status: "Completed",
    completionEvidence: {
      completedBy: user.name,
      completedByRole: user.role,
      completedAt: new Date().toISOString(),
      note: action.note || "Marked complete from the implementation checklist.",
      evidenceDocumentId: action.evidenceDocumentId || null,
      evidenceLabel: action.evidenceLabel || ""
    }
  };
}

function defaultDraftGuidedResponses() {
  return {
    strengths: "Strong verbal participation, persistence with visual supports, and willingness to ask clarifying questions.",
    needs: "Reading comprehension, written organization, and independent classroom routines.",
    progressEvidence: "Weekly probes, rubric-scored writing samples, teacher routine ratings, and recent meeting notes.",
    familyPriority: "Make supports clear across classes and explain how progress will be shared before meetings.",
    studentVoice: "I learn more when I can see the steps and know what finished work should look like."
  };
}

function normalizeDraftGuidedResponses(responses = {}) {
  const defaults = defaultDraftGuidedResponses();
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => {
      const value = String(responses?.[key] ?? fallback).trim();
      return [key, value || fallback];
    })
  );
}

function draftSeedSections(profile = "", guidedResponses = {}, annotatedSample = "") {
  const guided = normalizeDraftGuidedResponses(guidedResponses);
  const profileText = String(profile || "").trim() || "Fictional learner profile";
  const sampleCue = String(annotatedSample || "").trim()
    || "Annotated sample cue: compare with a district-approved sample before official use.";
  return [
    {
      id: "present-levels",
      heading: "Present levels draft",
      content:
        `Draft from profile: ${profileText} Strengths to preserve: ${guided.strengths} Priority needs: ${guided.needs} Progress evidence to verify: ${guided.progressEvidence} Student voice: ${guided.studentVoice} ${sampleCue}`
    },
    {
      id: "special-considerations",
      heading: "Special considerations draft",
      content:
        `Draft special-considerations prompts from profile: ${profileText} Identify assistive technology, communication, behavior, language, health, or other factors that may affect access. Preserve strengths: ${guided.strengths} Human review must confirm what belongs in the official IEP. ${sampleCue}`
    },
    {
      id: "measurable-goal",
      heading: "Measurable annual goal draft",
      content:
        `Given the selected support area, draft a measurable goal with baseline, method, frequency, and mastery criterion before export. Use evidence from: ${guided.progressEvidence} Align the goal to: ${guided.needs} Family or team priority: ${guided.familyPriority} ${sampleCue}`
    },
    {
      id: "short-term-objectives",
      heading: "Short-term objectives draft",
      content:
        `Draft short-term objectives only when required for the student and program. Break the annual goal into observable steps connected to ${guided.needs}, evidence from ${guided.progressEvidence}, and student voice: ${guided.studentVoice} ${sampleCue}`
    },
    {
      id: "services-supports",
      heading: "Services and supports draft",
      content:
        `Recommended service language remains a draft. Confirm frequency, duration, location, provider role, and source evidence. Preserve these priorities: ${guided.familyPriority} Include student-facing supports connected to: ${guided.studentVoice} ${sampleCue}`
    },
    {
      id: "supplementary-aids",
      heading: "Supplementary aids draft",
      content:
        `Draft supplementary aids and program supports that help the student access instruction without changing IEP obligations. Connect supports to ${guided.needs}, family priority: ${guided.familyPriority}, and staff implementation evidence. ${sampleCue}`
    },
    {
      id: "assessment-accommodations",
      heading: "Assessment accommodations draft",
      content:
        `Draft assessment accommodations separately from classroom supports. Identify the assessment setting, allowed support, implementation trigger, and evidence source. Do not infer a time multiplier or testing condition not supported by the source. ${sampleCue}`
    },
    {
      id: "behavior-support-plan",
      heading: "Behavior support plan draft",
      content:
        `Draft behavior-support considerations for review when behavior affects learning or classroom routines. Identify need, support strategy, responsible role, data to collect, and whether a separate plan is required. Connect to: ${guided.needs} ${sampleCue}`
    },
    {
      id: "transition-services",
      heading: "Transition services draft",
      content:
        `Draft transition-service prompts when age-appropriate. Connect student strengths, preferences, post-school goals, course of study, agency coordination, and self-advocacy opportunities. Student voice: ${guided.studentVoice} ${sampleCue}`
    },
    {
      id: "placement-rationale",
      heading: "Educational placement rationale draft",
      content:
        `Draft placement-rationale prompts for team review. Explain how services, supports, supplementary aids, and progress evidence relate to the least restrictive environment discussion without making an automatic placement decision. ${sampleCue}`
    }
  ];
}

function draftSectionKey(section) {
  return section?.id || section?.heading || "";
}

function reviseDraftSection(section, action, user, revisedAt) {
  const previousVersion = section.version || 1;
  const revisionNote = action.revisionNote?.trim() || "Reviewed draft section for source fidelity and implementation clarity.";
  return {
    ...section,
    content: action.content.trim(),
    status: "Revised - human review required",
    reviewStatus: "Human review pending",
    version: previousVersion + 1,
    revisionNote,
    reviewedBy: user.name,
    reviewedByRole: user.role,
    reviewedAt: revisedAt,
    versionHistory: [
      {
        version: previousVersion,
        content: section.content,
        savedBy: section.reviewedBy || "AI draft",
        savedAt: section.reviewedAt || revisedAt,
        note: section.revisionNote || "Initial generated draft"
      },
      ...(section.versionHistory || [])
    ]
  };
}

function localGeneratedContentMetadata(user, generatedAt) {
  return {
    generatedAt,
    generatedBy: user.name,
    generatedByRole: user.role,
    modelProfile: "Local deterministic demo",
    promptVersion: "fds-drafting-2026.07"
  };
}

function localGeneratedContentBoundary() {
  return {
    label: "AI-assisted draft - not official IEP language",
    officialSubmission: false,
    controllingSource: "The district-approved IEP and human IEP team decisions remain controlling.",
    humanReviewRequired: true
  };
}

function regenerateDraftSection(section, profile, action, user, regeneratedAt) {
  const previousVersion = section.version || 1;
  const guidance = action.guidance?.trim() || "Reviewer requested regeneration before approval.";
  return {
    ...section,
    content: regeneratedDraftContent(section, profile, guidance),
    status: "Regenerated - human review required",
    reviewStatus: "Human review pending",
    version: previousVersion + 1,
    revisionNote: guidance,
    regenerationGuidance: guidance,
    reviewedBy: user.name,
    reviewedByRole: user.role,
    reviewedAt: regeneratedAt,
    versionHistory: [
      {
        version: previousVersion,
        content: section.content,
        savedBy: section.reviewedBy || "AI draft",
        savedAt: section.reviewedAt || regeneratedAt,
        note: section.revisionNote || "Prior draft language"
      },
      ...(section.versionHistory || [])
    ]
  };
}

function regeneratedDraftContent(section, profile, guidance) {
  const profileText = profile?.trim() || "the reviewed student profile";
  const sectionPrompts = {
    "present-levels":
      "Summarize current strengths, needs, classroom impact, and the evidence the team must verify before official use.",
    "special-considerations":
      "Regenerate special-considerations language that asks reviewers to confirm assistive technology, communication, behavior, language, health, or other access factors before official use.",
    "measurable-goal":
      "Draft one annual goal with baseline, measurable condition, method, frequency, criterion, and review schedule for team confirmation.",
    "short-term-objectives":
      "Regenerate short-term objective prompts as observable steps only when required, tied to the annual goal and evidence schedule.",
    "services-supports":
      "Draft implementation language that prompts staff to confirm frequency, duration, location, provider role, accommodations, and recovery procedures.",
    "supplementary-aids":
      "Regenerate supplementary aids and program supports that clarify access supports, responsible staff, and implementation evidence without inventing new obligations.",
    "assessment-accommodations":
      "Regenerate assessment-accommodation language that separates testing supports from classroom supports and avoids unsupported assumptions.",
    "behavior-support-plan":
      "Regenerate behavior-support plan prompts that identify the need, strategy, responsible role, data collection, and whether a separate plan is required.",
    "transition-services":
      "Regenerate transition-service prompts for age-appropriate planning, student preferences, post-school goals, and self-advocacy opportunities.",
    "placement-rationale":
      "Regenerate educational placement rationale prompts that connect services, supports, supplementary aids, and evidence without making an automatic placement decision."
  };
  return `Regenerated from profile: ${profileText} ${sectionPrompts[draftSectionKey(section)] || "Draft review language for this section with source evidence and team confirmation steps."} Reviewer guidance: ${guidance}`;
}

function rejectExtractionSection(section, action, user) {
  return {
    ...section,
    status: "Rejected",
    rejectionReason: action.reason || "Reviewer flagged this extraction for regeneration before approval.",
    rejectedBy: user.name,
    rejectedByRole: user.role,
    rejectedAt: new Date().toISOString()
  };
}

function regenerateExtractionSection(section, activeDocument, state, action = {}) {
  const regenerated = createDemoExtraction(activeDocument?.sourceText || "", activeDocument?.name || "source").find(
    (candidate) => candidate.key === section.key || candidate.sourceSection === section.sourceSection
  );
  const now = new Date().toISOString();
  return {
    ...section,
    ...(regenerated || {}),
    id: section.id,
    status: "Needs review",
    priorContent: section.content,
    regenerationGuidance: action.guidance || "Reviewer requested a fresh source-grounded extraction.",
    regeneratedBy: state.user.name,
    regeneratedByRole: state.user.role,
    regeneratedAt: now,
    sourceAlignment: section.sourceAlignment || activeDocument?.sourceAlignment || sourceAlignmentForState(state)
  };
}

function documentForCurrentStudent(state) {
  return state.documents.find((document) => document.studentId === state.currentStudentId) || null;
}

function documentsForCurrentStudent(state) {
  return (state.documents || []).filter((document) => document.studentId === state.currentStudentId);
}

function activeIepForState(state) {
  return (state.ieps || []).find((iep) => iep.studentId === state.currentStudentId) || null;
}

function activeIepItemsForState(state, key) {
  const activeIep = activeIepForState(state);
  if (!activeIep) return [];
  return (state[key] || []).filter((item) => item.iepId === activeIep.id || item.studentId === state.currentStudentId);
}

function currentStudentTasksForState(state) {
  return (state.tasks || []).filter((task) => task.studentId === state.currentStudentId);
}

function currentStudentReviewFlagsForState(state) {
  return (state.reviewFlags || []).filter((flag) => flag.studentId === state.currentStudentId);
}

function currentStudentMeetingForState(state) {
  return (state.meetings || []).find((meeting) => meeting.studentId === state.currentStudentId) || null;
}

function currentStudentHasApprovedRecord(state) {
  return Boolean(activeIepForState(state)?.extractionApproved);
}

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function activityForStudent(state, student) {
  const documents = state.documents.filter((document) => document.studentId === student.id);
  const iepIds = state.ieps.filter((iep) => iep.studentId === student.id).map((iep) => iep.id);
  const iepIdSet = new Set(iepIds);
  const relatedIds = new Set([
    student.id,
    ...documents.map((document) => document.id),
    ...iepIds,
    ...state.tasks.filter((task) => task.studentId === student.id).map((task) => task.id),
    ...state.goals.filter((goal) => iepIdSet.has(goal.iepId)).map((goal) => goal.id),
    ...state.services.filter((service) => iepIdSet.has(service.iepId)).map((service) => service.id),
    ...state.meetings.filter((meeting) => meeting.studentId === student.id).map((meeting) => meeting.id),
    ...state.reviewFlags.filter((flag) => flag.studentId === student.id).map((flag) => flag.id)
  ]);
  const needles = [
    student.id,
    `${student.firstName} ${student.lastName}`,
    `${student.firstName}_${student.lastName}`,
    ...documents.map((document) => document.name)
  ].map((value) => String(value || "").toLowerCase()).filter(Boolean);
  const events = (state.auditLog || []).filter((event) => {
    if (event.subjectId && relatedIds.has(event.subjectId)) return true;
    const haystack = `${event.title || ""} ${event.detail || ""}`.toLowerCase();
    return needles.some((needle) => haystack.includes(needle));
  });
  return events.length ? events : state.auditLog || [];
}

function sourceMappingForSection(document, section) {
  if (!document || !section) return { matchText: "", matchedBy: "No mapping selected", segment: null };
  const segments = document.sourceSegments || [];
  const reference = String(section.sourceReference || "").toLowerCase();
  const content = String(section.content || "");
  const segment =
    segments.find((item) => reference.includes(String(item.label || item.id || "").toLowerCase())) ||
    segments.find((item) => {
      const excerpt = String(item.excerpt || item.text || "").toLowerCase();
      return excerpt && sharedKeywordCount(excerpt, content) >= 2;
    }) ||
    null;
  const matchText = segment?.excerpt || segment?.text || bestSourceExcerpt(document.sourceText, content, section.sourceSection);
  return {
    matchText,
    matchedBy: segment
      ? `Matched preserved segment: ${segment.label || segment.id}`
      : "Matched by source text and extracted field overlap",
    segment
  };
}

function sourceSegmentMeta(segment = {}) {
  const parts = [];
  if (segment.pageNumber) parts.push(`PDF page ${segment.pageNumber}`);
  if (segment.locator?.precision) parts.push(`${segment.locator.precision} precision`);
  if (segment.anchorType && !segment.pageNumber) parts.push(segment.anchorType.replace(/-/g, " "));
  return parts.join(" · ");
}

function bestSourceExcerpt(sourceText = "", content = "", sourceSection = "") {
  const source = String(sourceText || "");
  if (!source) return "";
  const contentSentences = String(content || "").split(/(?<=[.!?])\s+/).filter(Boolean);
  for (const sentence of contentSentences) {
    const trimmed = sentence.trim();
    if (trimmed.length > 24 && source.toLowerCase().includes(trimmed.toLowerCase())) return trimmed;
  }
  const sourceSentences = source.split(/(?<=[.!?])\s+/).filter(Boolean);
  const keywords = meaningfulWords(`${content} ${sourceSection}`);
  const scored = sourceSentences
    .map((sentence) => ({
      sentence,
      score: keywords.filter((word) => sentence.toLowerCase().includes(word)).length
    }))
    .sort((a, b) => b.score - a.score);
  if (scored[0]?.score > 0) return scored[0].sentence.trim();
  return source.slice(0, 320);
}

function sharedKeywordCount(text, content) {
  const source = String(text || "").toLowerCase();
  return meaningfulWords(content).filter((word) => source.includes(word)).length;
}

function meaningfulWords(value) {
  const stop = new Set(["about", "across", "after", "before", "given", "should", "source", "student", "review", "with", "will", "that", "this", "from"]);
  return Array.from(
    new Set(
      String(value || "")
        .toLowerCase()
        .match(/[a-z0-9]+/g)
        ?.filter((word) => word.length > 4 && !stop.has(word)) || []
    )
  ).slice(0, 14);
}

function canShareSummary(state, audience) {
  if (!can(state, "shareSummary")) return false;
  if (!currentStudentHasApprovedRecord(state)) return false;
  if (["caseManager", "administrator", "schoolAdministrator", "districtAdministrator"].includes(state.user.role)) return true;
  return summaryAudienceForRole(state.user.role) === audience;
}

function canSubmitSummaryComprehension(state, audience) {
  if (!can(state, "submitComprehensionCheck")) return false;
  if (!currentStudentHasApprovedRecord(state)) return false;
  if (state.user.role === "caseManager") return audience === "parent" || audience === "student";
  return summaryAudienceForRole(state.user.role) === audience;
}

function summaryAudienceForRole(role) {
  return {
    generalEducation: "teacher",
    relatedServiceProvider: "teacher",
    parent: "parent",
    student: "student",
    administrator: "administrator",
    schoolAdministrator: "administrator",
    districtAdministrator: "administrator"
  }[role] || null;
}

function normalizeSummaryUnderstandingStatus(value) {
  const status = String(value || "Needs explanation").trim();
  return summaryUnderstandingStatusOptions.includes(status) ? status : "Needs explanation";
}

function normalizeSummaryComprehensionReviewStatus(value) {
  const status = String(value || "Awaiting team response").trim();
  return summaryComprehensionReviewStatusOptions.includes(status) ? status : "Awaiting team response";
}

function createSummaryHandout({ id, studentId, audience, summary, coverageItems = [], actor, role }) {
  const createdAt = new Date().toISOString();
  return {
    id,
    studentId,
    audience,
    label: `${summary.label} meeting handout`,
    title: `${summary.title} - meeting handout`,
    sourceSummaryTitle: summary.title,
    sourceAlignment: summary.sourceAlignment,
    createdBy: actor,
    createdByRole: role,
    createdAt,
    disclaimer: "Prepared from the role-specific summary. Review before sharing as part of an official IEP meeting packet.",
    sections: summary.sections || [],
    coverageItems,
    questions: questionsForRole(audience) || []
  };
}

function createSummaryComprehensionCheck(state, action, id = `comprehension-${Date.now()}`) {
  const summary = state.summaries?.[action.audience] || {};
  const selectedSection =
    (summary.sections || []).find((section) => section.heading === action.sectionHeading) ||
    (summary.sections || [])[0] ||
    {};
  const submittedAt = new Date().toISOString();
  return {
    id,
    studentId: state.currentStudentId,
    audience: action.audience,
    summaryTitle: summary.title || "Role-specific summary",
    summaryLabel: summary.label || action.audience,
    sectionHeading: action.sectionHeading || selectedSection.heading || "Summary section",
    understandingStatus: normalizeSummaryUnderstandingStatus(action.understandingStatus),
    language: String(action.language || "English").trim(),
    questionOrNote: String(action.questionOrNote || "").trim(),
    preferredFollowUp: String(action.preferredFollowUp || "Review with the IEP team.").trim(),
    reviewStatus: "Awaiting team response",
    staffResponse: "",
    nextStep: "Team response pending.",
    submittedBy: state.user.name,
    submittedByRole: state.user.role,
    submittedAt,
    reviewedBy: "",
    reviewedByRole: "",
    reviewedAt: "",
    sourceReference: selectedSection.sourceReference || summary.sourceAlignment?.sourceForm || "Role-specific summary",
    sourceAlignment: summary.sourceAlignment || sourceAlignmentForState(state),
    officialRecordImpact:
      "Understanding check documents questions and follow-up only; it does not amend the official IEP or replace IEP team decisions."
  };
}

function summaryToClipboardText(summary, audience) {
  const lines = [
    summary.title,
    summary.label,
    "Review before official use.",
    ""
  ];
  for (const section of summary.sections || []) {
    lines.push(section.heading);
    if (section.text) lines.push(section.text);
    for (const bullet of section.bullets || []) lines.push(`- ${bullet}`);
    if (section.sourceReference) lines.push(`Source: ${section.sourceReference}`);
    lines.push("");
  }
  const questions = questionsForRole(audience) || [];
  if (questions.length) {
    lines.push("Questions to prepare");
    for (const question of questions) lines.push(`- ${question}`);
  }
  return lines.filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");
}

function createStudentProfileRecord(action, state, createdAt) {
  const firstName = String(action.firstName || "").trim() || "New";
  const lastName = String(action.lastName || "").trim() || "Student";
  const supportAreas = splitSupportAreas(action.supportAreas);
  return {
    id: `student-${Date.now()}`,
    firstName,
    lastName,
    grade: String(action.grade || "").trim() || "Not set",
    school: String(action.school || "").trim() || "School to confirm",
    caseManagerId: state.user.id,
    status: "Draft review",
    supportAreas,
    annualReviewDate: action.annualReviewDate || isoDate(new Date(Date.now() + 30 * 86400000)),
    createdAt,
    createdBy: state.user.name,
    createdByRole: state.user.role
  };
}

function createDraftIepForStudent(student, state, createdAt) {
  const sourceAlignment = sourceAlignmentForState(state);
  const startDate = isoDate(new Date());
  return {
    id: `iep-${Date.now()}`,
    studentId: student.id,
    documentId: "",
    meetingDate: student.annualReviewDate,
    startDate,
    endDate: student.annualReviewDate,
    status: "Draft",
    extractionApproved: false,
    sourceAlignment,
    createdAt,
    structuredRecord: {
      sourceAlignment,
      studentInformation: {
        studentId: student.id,
        name: `${student.firstName} ${student.lastName}`,
        grade: student.grade,
        school: student.school
      },
      IEPTeam: ["Parent/guardian", "Special education teacher"],
      specialConsiderations: {},
      currentPerformance: {},
      goalsAndObjectives: [],
      services: [],
      supplementaryAidsAndServices: [],
      accommodations: [],
      educationalPlacement: {},
      meetingInformation: {
        meetingDate: student.annualReviewDate,
        startDate,
        endDate: student.annualReviewDate,
        meetingType: "Annual review planning",
        participants: []
      },
      transitionServices: {},
      stateAndLocalAssessments: {},
      behaviorSupportPlan: {},
      progressMonitoring: [],
      additionalInformation: {}
    }
  };
}

function createLocalIepComparison(action, state, createdAt) {
  const currentIep = activeIepForState(state);
  const sourceAlignment = sourceAlignmentForState(state);
  const section = String(action.section || "IEP version review").trim();
  const title = String(action.title || `${section} prior/current comparison`).trim();
  const comparison = {
    id: `comparison-${Date.now()}`,
    studentId: state.currentStudentId,
    previousIepId: String(action.previousIepId || "previous-iep-local-intake").trim(),
    currentIepId: currentIep?.id || String(action.currentIepId || "current-iep-local-intake").trim(),
    section,
    changeType: String(action.changeType || "User-entered comparison").trim(),
    title,
    previousText: String(action.previousText || "").trim(),
    currentText: String(action.currentText || "").trim(),
    implementationImpact: String(action.implementationImpact || "").trim(),
    familySummary: String(action.familySummary || "").trim(),
    status: normalizeIepComparisonStatus(action.status),
    reviewNote: String(action.reviewNote || "Review captured from prior/current IEP language intake.").trim(),
    reviewedBy: "",
    reviewedByRole: "",
    reviewedAt: "",
    familyVisible: Boolean(action.familyVisible),
    studentVisible: Boolean(action.studentVisible),
    sourceReference: String(action.sourceReference || `Prior/current IEP version intake - ${section}`).trim(),
    sourceAlignment,
    versionIntake: {
      intakeMethod: String(action.intakeMethod || "Manual prior/current language paste").trim(),
      createdBy: state.user.name,
      createdByRole: state.user.role,
      createdAt
    },
    amendmentReviewStatus: normalizeIepAmendmentReviewStatus(action.amendmentReviewStatus),
    amendmentNote: String(action.amendmentNote || "").trim(),
    officialRecordImpact:
      "Prior/current comparison is advisory meeting-prep evidence only; it does not amend the official IEP or replace district amendment procedures."
  };
  return {
    ...comparison,
    comparisonDigest: localIepComparisonDigest(comparison, action, state, createdAt)
  };
}

function createLocalAutoIepComparisons(action, state, createdAt) {
  const previousText = String(action.previousText || "").trim();
  const currentText = String(action.currentText || "").trim();
  if (!previousText || !currentText || !state.currentStudentId) return [];
  const currentIep = activeIepForState(state);
  const sourceAlignment = sourceAlignmentForState(state);
  const previousDocumentLabel = String(action.previousDocumentLabel || "Previous IEP text").trim();
  const currentDocumentLabel = String(action.currentDocumentLabel || "Current IEP text").trim();
  const candidates = generateIepAutoDiffCandidates(previousText, currentText).slice(0, 6);
  return candidates.map((candidate, index) => {
    const amendmentReviewStatus = candidate.amendmentReviewStatus || "Amendment review needed";
    const comparison = {
      id: `comparison-auto-${Date.now()}-${index + 1}`,
      studentId: state.currentStudentId,
      previousIepId: String(action.previousIepId || "previous-iep-auto-diff").trim(),
      currentIepId: currentIep?.id || String(action.currentIepId || "current-iep-auto-diff").trim(),
      section: candidate.section,
      changeType: candidate.changeType,
      title: candidate.title,
      previousText: candidate.previousText,
      currentText: candidate.currentText,
      implementationImpact: candidate.implementationImpact,
      familySummary: candidate.familySummary,
      status: "Needs team review",
      reviewNote: "Auto-diff candidate requires human review before meeting or family-facing language is shared.",
      reviewedBy: "",
      reviewedByRole: "",
      reviewedAt: "",
      familyVisible: true,
      studentVisible: candidate.section === "Goals and progress monitoring" || candidate.section === "Transition services",
      sourceReference: `Automated prior/current IEP diff - ${candidate.section}`,
      sourceAlignment,
      versionIntake: {
        intakeMethod: "Automated prior/current text diff",
        previousDocumentLabel,
        currentDocumentLabel,
        candidateIndex: index + 1,
        candidateCount: candidates.length,
        createdBy: state.user.name,
        createdByRole: state.user.role,
        createdAt
      },
      amendmentReviewStatus,
      amendmentNote:
        "Automated diff only identifies changed language; the IEP team must decide whether an amendment, meeting action, or district procedure is required.",
      officialRecordImpact:
        "Prior/current auto-diff candidate is advisory meeting-prep evidence only; it does not amend the official IEP or replace district amendment procedures."
    };
    return {
      ...comparison,
      comparisonDigest: localIepComparisonDigest(comparison, comparison, state, createdAt)
    };
  });
}

function generateIepAutoDiffCandidates(previousText, currentText) {
  const previousSegments = segmentIepVersionText(previousText);
  const currentSegments = segmentIepVersionText(currentText);
  const candidates = iepAutoDiffSectionConfigs.flatMap((config) => {
    const previousMatches = matchingIepVersionSegments(previousSegments, config.keywords);
    const currentMatches = matchingIepVersionSegments(currentSegments, config.keywords);
    if (!previousMatches.length && !currentMatches.length) return [];
    const previousLanguage = previousMatches.join(" ");
    const currentLanguage = currentMatches.join(" ");
    if (normalizeComparisonLanguage(previousLanguage) === normalizeComparisonLanguage(currentLanguage)) return [];
    return [{
      section: config.section,
      changeType: config.changeType,
      title: config.title,
      previousText: previousLanguage || "No matching prior language was identified in the pasted previous IEP text.",
      currentText: currentLanguage || "No matching current language was identified in the pasted current IEP text.",
      implementationImpact: config.implementationImpact,
      familySummary: config.familySummary,
      amendmentReviewStatus: "Amendment review needed"
    }];
  });
  if (!candidates.length && normalizeComparisonLanguage(previousText) !== normalizeComparisonLanguage(currentText)) {
    return [{
      section: "IEP version review",
      changeType: "Automated whole-document change",
      title: "Auto-diff found changed prior/current IEP language",
      previousText: previousText.slice(0, 700),
      currentText: currentText.slice(0, 700),
      implementationImpact:
        "The team should inspect the changed language and decide whether it affects implementation responsibilities or meeting preparation.",
      familySummary:
        "The prior and current IEP text differ; the team should explain the meaningful changes before sharing meeting language.",
      amendmentReviewStatus: "Amendment review needed"
    }];
  }
  return candidates;
}

function segmentIepVersionText(text) {
  return String(text || "")
    .replace(/([.!?])\s+/g, "$1\n")
    .split(/\n+|[-*]\s+/)
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function matchingIepVersionSegments(segments, keywords) {
  const terms = keywords.map((keyword) => keyword.toLowerCase());
  const matches = segments.filter((segment) => {
    const text = segment.toLowerCase();
    return terms.some((keyword) => text.includes(keyword));
  });
  return [...new Set(matches)].slice(0, 3);
}

function normalizeComparisonLanguage(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function splitSupportAreas(value) {
  const items = String(value || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : ["Needs profile review"];
}

export function App() {
  const [state, dispatch, syncStatus, setSyncStatus] = useReducerWithPersistence();
  const [view, setView] = useState("dashboard");
  const [roleView, setRoleView] = useState("teacher");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const selectedStudent = state.students.find((student) => student.id === state.currentStudentId);
  const currentIep = state.ieps.find((iep) => iep.studentId === state.currentStudentId);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  function notify(title, detail) {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToast({ title, detail });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 8000);
  }

  function navigate(nextView) {
    setView(nextView);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleAction(action, message) {
    if (action.type === "selectStudent") {
      dispatch(action);
      if (syncStatus.mode !== "api") {
        if (message) notify(message.title, message.detail);
        return null;
      }
      try {
        setSyncStatus({ mode: "syncing", label: "Saving to API" });
        const payload = await mutateWorkspace(action, state);
        if (payload?.workspace) {
          dispatch({ type: "replaceWorkspace", workspace: payload.workspace });
        }
        setSyncStatus({ mode: "api", label: "API-backed workspace" });
        if (message) notify(message.title, message.detail);
        return payload;
      } catch (error) {
        setSyncStatus({ mode: "local", label: "Browser-local fallback" });
        notify("Student selected locally", "The local API was unavailable, so this session kept the active student in browser state.");
        return null;
      }
    }

    if (action.type === "switchRole") {
      return switchDemoAccount(action.role);
    }

    if ((action.type === "recordExport" && !can(state, "export")) || syncStatus.mode !== "api") {
      dispatch(action);
      if (message) notify(message.title, message.detail);
      return null;
    }

    try {
      setSyncStatus({ mode: "syncing", label: "Saving to API" });
      const payload = await mutateWorkspace(action, state);
      if (payload?.workspace) {
        dispatch({ type: "replaceWorkspace", workspace: payload.workspace });
      } else {
        dispatch(action);
      }
      setSyncStatus({ mode: "api", label: "API-backed workspace" });
      if (message) notify(message.title, message.detail);
      return payload;
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setSyncStatus({ mode: "api", label: "API-backed workspace" });
        notify("Action blocked", error.message);
        return null;
      }
      dispatch(action);
      setSyncStatus({ mode: "local", label: "Browser-local fallback" });
      notify("Saved locally", "The local API was unavailable, so this session kept the change in browser state.");
      return null;
    }
  }

  async function switchDemoAccount(role) {
    if (syncStatus.mode !== "api") {
      dispatch({ type: "switchRole", role });
      notify("Role lens changed", roles[role].label);
      return null;
    }

    try {
      setSyncStatus({ mode: "syncing", label: "Switching account" });
      const session = await loginAsRole(role);
      const workspace = await loadWorkspace(session);
      dispatch({ type: "replaceWorkspace", workspace, preserveRole: false });
      setSyncStatus({ mode: "api", label: "API-backed workspace" });
      notify("Account switched", `${session.user.name} signed in as ${roles[session.user.role].label}.`);
      return { session, workspace };
    } catch (error) {
      dispatch({ type: "switchRole", role });
      setSyncStatus({ mode: "local", label: "Browser-local fallback" });
      notify("Role switched locally", "The local API was unavailable, so this session is using browser-only permissions.");
      return null;
    }
  }

  async function exportRecord(label, payload, formatOverride = null) {
    const format = formatOverride || exportFormatForLabel(label);
    let exportWasRecorded = false;
    if (syncStatus.mode === "api" && can(state, "export")) {
      const result = await handleAction({ type: "recordExport", label, payload, format });
      exportWasRecorded = true;
      const exportRecord = result?.exportRecord || result;
      if (exportRecord?.downloadUrl) {
        try {
          const { blob, fileName } = await downloadExportArtifact(exportRecord, state);
          downloadBlob(blob, fileName);
          notify("Export generated", `${exportRecord.label} downloaded as ${exportRecord.format.toUpperCase()}.`);
          return;
        } catch (error) {
          notify("Download failed", error.message || "The export was recorded but could not be downloaded.");
          return;
        }
      }
    }

    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      `${slug(label)}.json`
    );
    if (!exportWasRecorded) await handleAction({ type: "recordExport", label, payload, format: "json" });
    notify("Export generated", `${label} downloaded as JSON.`);
  }

  async function downloadRetentionRecord(packageRecord) {
    if (!packageRecord?.downloadUrl) {
      notify("Download unavailable", "Browser-local retention previews do not have a sealed manifest file.");
      return;
    }
    try {
      const { blob, fileName } = await downloadRetentionPackage(packageRecord);
      downloadBlob(blob, fileName);
      notify("Retention package downloaded", `${packageRecord.status} manifest downloaded for review.`);
    } catch (error) {
      notify("Download failed", error.message || "The retention package could not be downloaded.");
    }
  }

  const body = {
    dashboard: (
      <DashboardView state={state} navigate={navigate} setRoleView={setRoleView} dispatch={handleAction} exportRecord={exportRecord} />
    ),
    student: (
      <StudentView
        state={state}
        student={selectedStudent}
        iep={currentIep}
        navigate={navigate}
        dispatch={handleAction}
        setRoleView={setRoleView}
      />
    ),
    intake: (
      <IntakeView
        state={state}
        dispatch={handleAction}
        student={selectedStudent}
        navigate={navigate}
        exportRecord={exportRecord}
      />
    ),
    summary: (
      <SummaryView
        state={state}
        roleView={roleView}
        setRoleView={setRoleView}
        navigate={navigate}
        dispatch={handleAction}
        exportRecord={exportRecord}
        notify={notify}
      />
    ),
    implementation: <ImplementationView state={state} dispatch={handleAction} navigate={navigate} exportRecord={exportRecord} />,
    services: <ServicesView state={state} dispatch={handleAction} navigate={navigate} exportRecord={exportRecord} />,
    progress: <ProgressView state={state} dispatch={handleAction} navigate={navigate} exportRecord={exportRecord} />,
    meetings: <MeetingsView state={state} dispatch={handleAction} navigate={navigate} exportRecord={exportRecord} />,
    review: <ReviewView state={state} dispatch={handleAction} navigate={navigate} exportRecord={exportRecord} />,
    drafting: <DraftingView state={state} dispatch={handleAction} exportRecord={exportRecord} />,
    audit: (
      <AuditView
        state={state}
        navigate={navigate}
        dispatch={handleAction}
        exportRecord={exportRecord}
        downloadRetentionPackage={downloadRetentionRecord}
      />
    ),
    admin: <AdminView state={state} dispatch={handleAction} />
  }[view];

  const [title, subtitle] = viewMeta[view];

  return (
    <div className="app">
      <a className="skip-link" href="#workspace-main">Skip to workspace content</a>
      <Sidebar
        state={state}
        view={view}
        navigate={navigate}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      <main className="main" id="workspace-main" tabIndex={-1} aria-labelledby="workspace-title">
        <Topbar
          title={title}
          subtitle={subtitle}
          state={state}
          syncStatus={syncStatus}
          navigate={navigate}
          dispatch={handleAction}
          setDrawerOpen={setDrawerOpen}
          setMobileOpen={setMobileOpen}
        />
        <div className="content">{body}</div>
      </main>
      <AssistantDrawer
        open={drawerOpen}
        setOpen={setDrawerOpen}
        state={state}
        dispatch={handleAction}
      />
      {toast ? (
        <div className="toast" role="status" aria-live="polite" aria-atomic="true">
          <Check size={16} />
          <div>
            <strong>{toast.title}</strong>
            <span>{toast.detail}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function useReducerWithPersistence() {
  const [state, dispatchBase] = useReducer(reducer, initialWorkspace, (seed) => {
    const savedWorkspace = readStorage(LOCAL_WORKSPACE_KEY);
    const savedPrefs = readStorage(LOCAL_PREFS_KEY);
    const workspace = normalizeGapClosureWorkspace(
      savedWorkspace?.sourceRegistry && savedWorkspace?.summaries && savedWorkspace?.auditLog ? savedWorkspace : seed
    );
    return {
      ...workspace,
      user: {
        ...workspace.user,
        role: savedPrefs?.role || workspace.user.role
      }
    };
  });
  const [syncStatus, setSyncStatus] = useState({ mode: "checking", label: "Checking API" });

  const dispatch = (action) => dispatchBase(action);

  useEffect(() => {
    let cancelled = false;
    loadWorkspace()
      .then((workspace) => {
        if (cancelled) return;
        dispatchBase({ type: "replaceWorkspace", workspace, preserveRole: false });
        setSyncStatus({ mode: "api", label: "API-backed workspace" });
      })
      .catch(() => {
        if (!cancelled) setSyncStatus({ mode: "local", label: "Browser-local workspace" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    writeStorage(LOCAL_PREFS_KEY, { role: state.user.role });
    if (syncStatus.mode === "local") writeStorage(LOCAL_WORKSPACE_KEY, state);
  }, [state, syncStatus.mode]);
  return [state, dispatch, syncStatus, setSyncStatus];
}

function readStorage(key) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be disabled or full; in-memory state remains usable.
  }
}

function Sidebar({ state, view, navigate, mobileOpen, setMobileOpen }) {
  const openFlags = currentStudentReviewFlagsForState(state).filter((flag) => flag.status === "Open").length;
  const activeTasks = currentStudentTasksForState(state).filter((task) => task.status !== "Completed").length;

  return (
    <>
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brandmark">IEP</div>
          <div>
            <strong>IEP Implementation Assistant</strong>
            <small>Pennsylvania school-age pilot</small>
          </div>
        </div>
        <button className="org" type="button">
          <Building2 size={16} />
          <span>
            <strong>{state.user.district}</strong>
            <small>{roles[state.user.role].label}</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <nav>
          <p className="navlabel">Workspace</p>
          {views.slice(0, 8).map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={view === item.id}
              badge={item.id === "implementation" ? activeTasks : item.id === "student" ? state.students.length : null}
              onClick={() => navigate(item.id)}
            />
          ))}
          <p className="navlabel">Review & oversight</p>
          {views.slice(8).map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={view === item.id}
              badge={item.id === "review" ? openFlags : null}
              onClick={() => navigate(item.id)}
            />
          ))}
        </nav>
        <div className="privacy">
          <Lock size={16} />
          <div>
            <strong>Protected student workspace</strong>
            <span>Role-aware access, source traceability, and human-reviewed AI actions.</span>
          </div>
        </div>
      </aside>
      {mobileOpen ? <button className="scrim" type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} /> : null}
    </>
  );
}

function NavButton({ item, active, badge, onClick }) {
  const Icon = item.icon;
  return (
    <button className={`navbtn ${active ? "active" : ""}`} type="button" onClick={onClick}>
      <Icon size={18} />
      <span>{item.label}</span>
      {badge ? <b>{badge}</b> : null}
    </button>
  );
}

function Topbar({ title, subtitle, state, syncStatus, navigate, dispatch, setDrawerOpen, setMobileOpen }) {
  const [query, setQuery] = useState("");
  const openReminderCount = remindersForState(state).filter((reminder) => !reminder.reviewed).length;
  const routeSearch = () => {
    const q = query.toLowerCase();
    if (q.includes("service") || q.includes("speech")) navigate("services");
    else if (q.includes("meeting") || q.includes("family")) navigate("meetings");
    else if (q.includes("goal") || q.includes("progress")) navigate("progress");
    else if (q.includes("audit") || q.includes("access") || q.includes("export")) navigate("audit");
    else if (q.includes("review") || q.includes("compliance")) navigate("review");
    else if (q.includes("draft") || q.includes("training")) navigate("drafting");
    else if (q.includes("document") || q.includes("extract")) navigate("intake");
    else navigate("student");
  };

  return (
    <header className="topbar">
      <button className="iconbtn mobile-only" type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu">
        <Menu size={18} />
      </button>
      <div className="topcopy">
        <h1 id="workspace-title">{title}</h1>
        <p>{subtitle}</p>
      </div>
      <label className="search">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") routeSearch();
          }}
          placeholder="Search students, goals, services, meetings, or audit"
        />
        <span>Enter</span>
      </label>
      <SyncPill status={syncStatus} />
      <button className="iconbtn" type="button" aria-label="Help">
        <HelpCircle size={18} />
      </button>
      <button
        className={`iconbtn ${openReminderCount ? "has-dot" : ""}`}
        type="button"
        aria-label={`${openReminderCount} open reminders`}
        title={`${openReminderCount} open reminders`}
        onClick={() => navigate("dashboard")}
      >
        <Bell size={18} />
        {openReminderCount ? <b className="notification-count">{openReminderCount}</b> : null}
      </button>
      <button className="userbtn" type="button" onClick={() => setDrawerOpen(true)}>
        <span>{initials(state.user.name)}</span>
        <div>
          <strong>{state.user.name}</strong>
          <small>{roles[state.user.role].label}</small>
        </div>
      </button>
      <label className="role-control">
        <span>Role</span>
        <select
          value={state.user.role}
          disabled={syncStatus.mode === "checking" || syncStatus.mode === "syncing"}
          onChange={(event) => dispatch({ type: "switchRole", role: event.target.value })}
        >
          {Object.entries(roles).map(([key, role]) => (
            <option value={key} key={key}>{role.label}</option>
          ))}
        </select>
      </label>
    </header>
  );
}

function SyncPill({ status }) {
  return (
    <div className={`sync-pill ${status.mode}`} title={status.label}>
      <span />
      <strong>{status.label}</strong>
    </div>
  );
}

function DashboardView({ state, navigate, setRoleView, dispatch, exportRecord }) {
  const openFlags = state.reviewFlags.filter((flag) => flag.status === "Open");
  const evidenceDue = state.goals.filter((goal) => goal.status === "Insufficient data").length;
  const servicePercent = deliveryPercent(state.services);
  const reminders = remindersForState(state);
  const openReminders = reminders.filter((reminder) => !reminder.reviewed);
  const parentSummaryActivity = parentSummaryActivityForState(state);
  const iepReviewQueue = iepReviewQueueForState(state);

  return (
    <section className="page">
      <PageHead
        label="IEP implementation workspace"
        title={`Good morning, ${firstName(state.user.name)}.`}
        description="Start with the obligations, evidence, and meetings that need attention across your caseload. Recommendations remain source-grounded and subject to human review."
        actions={
          <>
            <Button icon={Plus} onClick={() => navigate("intake")}>Add student</Button>
            <Button variant="primary" icon={Upload} onClick={() => navigate("intake")}>Upload IEP</Button>
          </>
        }
      />
      <div className="banner">
        <ShieldCheck size={16} />
        <span>
          <strong>MVP implementation.</strong> Fictional records demonstrate upload, extraction, role summaries,
          tasking, progress, review, export, and audit workflows.
        </span>
      </div>
      <div className="metrics">
        <Metric label="Active caseload" value={state.students.length} note="Assigned student workspaces" icon={Users} />
        <Metric label="Meetings in 14 days" value={state.meetings.length} note="1 packet needs pre-read" icon={CalendarDays} tone="purple" />
        <Metric label="Progress evidence due" value={evidenceDue} note="Goals with stale or missing data" icon={BarChart3} tone="amber" />
        <Metric label="Services logged" value={`${servicePercent}%`} note="Scheduled minutes documented" icon={ClipboardCheck} tone="green" />
        <Metric label="Reminders due" value={openReminders.length} note="Unreviewed deadline prompts" icon={Bell} tone="red" />
      </div>
      <div className="grid two-one">
        <Card
          title="Attention needed"
          description="Prioritized by deadline, implementation risk, and missing evidence."
          action={<Button icon={ListChecks} onClick={() => navigate("implementation")}>View work queue</Button>}
        >
          <div className="list">
            {openFlags.map((flag) => (
              <AlertRow
                key={flag.id}
                tone={flag.severity === "High" ? "red" : "amber"}
                icon={AlertTriangle}
                title={flag.issue}
                description={flag.whyItMatters}
                meta={`${flag.severity} priority`}
                onClick={() => navigate("review")}
              />
            ))}
            <AlertRow
              tone="blue"
              icon={MessageSquare}
              title="Family question awaits team response"
              description="How will recent reading data change the support plan?"
              meta="Meeting prep"
              onClick={() => navigate("meetings")}
            />
          </div>
        </Card>
        <Card title="Upcoming meetings" description="Readiness combines data, family input, draft status, and participation.">
          <div className="meeting-list">
            {state.meetings.map((meeting) => (
              <button className="meeting-row" type="button" key={meeting.id} onClick={() => navigate("meetings")}>
                <span className="date-tile">
                  <small>{month(meeting.date)}</small>
                  <strong>{day(meeting.date)}</strong>
                </span>
                <span>
                  <strong>{studentName(state, meeting.studentId)} - {meeting.type}</strong>
                  <small>{meeting.time} - {meeting.readiness}% ready</small>
                </span>
                <Badge tone={meeting.readiness > 80 ? "green" : "amber"}>{meeting.readiness}%</Badge>
              </button>
            ))}
          </div>
        </Card>
      </div>
      <ReminderCenter reminders={reminders} dispatch={dispatch} navigate={navigate} />
      <NotificationOutbox
        state={state}
        reminders={reminders}
        dispatch={dispatch}
        disabled={!can(state, "sendNotification")}
      />
      <IepReviewQueueCard
        queue={iepReviewQueue}
        navigate={navigate}
        dispatch={dispatch}
      />
      {state.teacherClassroomRoster?.length ? (
        <ClassroomRosterCard state={state} navigate={navigate} dispatch={dispatch} />
      ) : null}
      <div className="grid equal">
        <Card
          title="Caseload snapshot"
          description="Implementation, evidence, and annual review status."
          action={
            <Button
              disabled={!can(state, "export")}
              title={!can(state, "export") ? "Current role cannot export roster data." : undefined}
              onClick={() => exportRecord("Structured student roster", state.students)}
            >
              Export
            </Button>
          }
        >
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>IEP status</th>
                <th>Support areas</th>
                <th>Annual review</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {state.students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <Person student={student} />
                  </td>
                  <td><Badge tone={student.status === "Active" ? "green" : "purple"}>{student.status}</Badge></td>
                  <td>{student.supportAreas.join(", ")}</td>
                  <td>{formatDate(student.annualReviewDate)}</td>
                  <td>
                    <Button
                      icon={Eye}
                      onClick={async () => {
                        await dispatch(
                          { type: "selectStudent", studentId: student.id },
                          { title: "Student selected", detail: `${student.firstName} ${student.lastName} workspace opened.` }
                        );
                        navigate("student");
                      }}
                    >
                      Open workspace
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Service delivery this month" description="Scheduled minutes compared with documented delivery.">
          <Donut percent={servicePercent} />
          <div className="legend">
            {state.services.map((service) => (
              <div className="legend-row" key={service.id}>
                <i />
                <span>{service.serviceType}</span>
                <strong>{service.deliveredMinutes}/{service.scheduledMinutes} min</strong>
              </div>
            ))}
          </div>
        </Card>
        <RecentParentSummariesCard
          activity={parentSummaryActivity}
          navigate={navigate}
          setRoleView={setRoleView}
        />
      </div>
    </section>
  );
}

function IepReviewQueueCard({ queue, navigate, dispatch }) {
  const openCount = queue.filter((item) => item.requiresReview).length;
  const openReview = async (item) => {
    await dispatch(
      { type: "selectStudent", studentId: item.studentId },
      { title: "Student selected", detail: `${item.studentName} source review opened.` }
    );
    navigate("intake");
  };

  return (
    <Card
      title="IEPs needing review"
      description="Recent source uploads, extraction status, and human approval readiness across the caseload."
      action={<Badge tone={openCount ? "amber" : "green"}>{countLabel(openCount, "pending review", "pending reviews")}</Badge>}
    >
      <div className="document-list">
        {queue.length ? (
          queue.slice(0, 5).map((item) => (
            <article className="document-row" key={item.documentId}>
              <div>
                <strong>{item.documentName}</strong>
                <span>{item.studentName} · uploaded {formatDateTime(item.uploadedAt)}</span>
                <small>{item.sourceId} · {item.sourceFormType}</small>
              </div>
              <div className="document-meta">
                <Badge tone={item.tone}>{item.statusLabel}</Badge>
                <small>{item.sectionCount} extracted sections</small>
                <Button icon={FileText} onClick={() => openReview(item)}>Review source</Button>
              </div>
            </article>
          ))
        ) : (
          <EmptyState title="No IEP sources uploaded" text="Upload or paste an IEP source to start extraction review." />
        )}
      </div>
    </Card>
  );
}

function ClassroomRosterCard({ state, navigate, dispatch }) {
  const roster = useMemo(() => classroomRosterForState(state), [state]);
  const periods = useMemo(() => Array.from(new Set(roster.map((entry) => entry.classPeriod))).filter(Boolean), [roster]);
  const [classPeriod, setClassPeriod] = useState(periods[0] || "");
  const [reviewFocus, setReviewFocus] = useState("Weekly accommodation scan");
  const [actionPlan, setActionPlan] = useState(
    "Prioritize high-need rows, verify assessment accommodations, and capture any progress evidence due before the next team check-in."
  );
  const [followUpDate, setFollowUpDate] = useState("2026-06-30");

  useEffect(() => {
    if (!periods.length) {
      setClassPeriod("");
      return;
    }
    if (!periods.includes(classPeriod)) setClassPeriod(periods[0]);
  }, [periods, classPeriod]);

  const visibleRoster = roster.filter((entry) => entry.classPeriod === classPeriod);
  const summary = classroomRosterSummary(visibleRoster);
  const latestReview = (state.teacherClassroomReviews || [])
    .filter((review) => review.classPeriod === classPeriod)
    .slice()
    .sort((a, b) => String(b.reviewedAt || "").localeCompare(String(a.reviewedAt || "")))[0];
  const ready = Boolean(classPeriod && visibleRoster.length && reviewFocus.trim() && actionPlan.trim() && can(state, "reviewClassroomRoster"));

  if (!roster.length) return null;

  return (
    <Card
      title="Classroom management"
      description="Teacher-facing support roster for scanning a full class period, prioritizing follow-through, and preserving official-record boundaries."
      action={<Badge tone={summary.highPriority ? "amber" : "green"}>{summary.total} students</Badge>}
    >
      <div className="classroom-toolbar">
        <label className="field">
          <span>Class period</span>
          <select aria-label="Class period" value={classPeriod} onChange={(event) => setClassPeriod(event.target.value)}>
            {periods.map((period) => <option value={period} key={period}>{period}</option>)}
          </select>
        </label>
        <div className="classroom-stats" aria-label="Classroom roster summary">
          <span><strong>{summary.highPriority}</strong> high priority</span>
          <span><strong>{summary.progressDue}</strong> progress checks</span>
          <span><strong>{summary.serviceAlerts}</strong> service alerts</span>
          <span><strong>{summary.accommodations}</strong> accommodations</span>
        </div>
      </div>
      {latestReview ? (
        <div className="classroom-review-strip">
          <ShieldCheck size={15} />
          <span>
            <strong>{latestReview.reviewFocus}</strong>
            Reviewed {latestReview.reviewedCount} students by {latestReview.reviewedBy} on {formatDateTime(latestReview.reviewedAt)}.
          </span>
          <Badge tone="blue">Digest {shortHash(latestReview.reviewDigest)}</Badge>
        </div>
      ) : null}
      <div className="classroom-table-wrap">
        <table className="table classroom-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Priority</th>
              <th>Support load</th>
              <th>Next action</th>
              <th>Source</th>
              <th>Workspace</th>
            </tr>
          </thead>
          <tbody>
            {visibleRoster.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <strong>{entry.studentName}</strong>
                  <small>{entry.course} · grade {entry.grade}</small>
                </td>
                <td>
                  <Badge tone={classroomPriorityTone(entry.priority)}>{entry.priority}</Badge>
                  <small>{entry.iepStatus}</small>
                </td>
                <td>
                  <span className="classroom-load">
                    <strong>{entry.accommodationCount}</strong> supports
                    <strong>{entry.taskCount}</strong> tasks
                    <strong>{entry.overdueProgressCount}</strong> due
                  </span>
                  <small>{entry.serviceAlertCount ? `${entry.serviceAlertCount} service alert` : "No service alert"}</small>
                </td>
                <td>
                  <span className="classroom-support-text">{entry.nextAction}</span>
                  <small>{entry.supportSummary}</small>
                </td>
                <td>
                  <Badge tone={classroomStatusTone(entry)}>{entry.officialRecordStatus}</Badge>
                  <small>{entry.sourceTrace}</small>
                </td>
                <td>
                  <Button
                    icon={Eye}
                    disabled={!entry.linkedStudentId}
                    title={entry.linkedStudentId ? undefined : "No full IEP workspace imported for this classroom row."}
                    onClick={async () => {
                      await dispatch(
                        { type: "selectStudent", studentId: entry.linkedStudentId },
                        { title: "Student selected", detail: `${entry.studentName} workspace opened.` }
                      );
                      navigate("student");
                    }}
                  >
                    Open
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="meeting-input classroom-review-form">
        <div className="mini-form-grid">
          <label className="field">
            <span>Review focus</span>
            <select aria-label="Classroom review focus" value={reviewFocus} onChange={(event) => setReviewFocus(event.target.value)}>
              <option>Weekly accommodation scan</option>
              <option>Progress evidence check</option>
              <option>Meeting preparation scan</option>
              <option>Service carryover scan</option>
            </select>
          </label>
          <label className="field">
            <span>Classroom follow-up date</span>
            <input
              aria-label="Classroom follow-up date"
              type="date"
              value={followUpDate}
              onChange={(event) => setFollowUpDate(event.target.value)}
            />
          </label>
        </div>
        <label className="field">
          <span>Classroom action plan</span>
          <textarea
            aria-label="Classroom action plan"
            value={actionPlan}
            onChange={(event) => setActionPlan(event.target.value)}
          />
        </label>
        {!can(state, "reviewClassroomRoster") ? (
          <AccessNotice text={`${roles[state.user.role].label} can view classroom support evidence but cannot record roster reviews.`} />
        ) : null}
        <Button
          icon={ClipboardCheck}
          disabled={!ready}
          onClick={() =>
            dispatch(
              {
                type: "reviewClassroomRoster",
                classPeriod,
                reviewFocus,
                reviewedRosterIds: visibleRoster.map((entry) => entry.id),
                actionPlan: actionPlan.trim(),
                followUpDate
              },
              {
                title: "Classroom roster reviewed",
                detail: `${classPeriod} support scan saved for ${visibleRoster.length} students.`
              }
            )
          }
        >
          Record classroom roster review
        </Button>
      </div>
    </Card>
  );
}

function classroomRosterForState(state) {
  const priorityRank = { High: 0, Medium: 1, Low: 2 };
  return (state.teacherClassroomRoster || [])
    .slice()
    .sort((a, b) =>
      String(a.classPeriod || "").localeCompare(String(b.classPeriod || "")) ||
      (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9) ||
      String(a.studentName || "").localeCompare(String(b.studentName || ""))
    );
}

function classroomRosterSummary(roster = []) {
  return roster.reduce(
    (summary, entry) => ({
      total: summary.total + 1,
      highPriority: summary.highPriority + (entry.priority === "High" ? 1 : 0),
      progressDue: summary.progressDue + Number(entry.overdueProgressCount || 0),
      serviceAlerts: summary.serviceAlerts + Number(entry.serviceAlertCount || 0),
      accommodations: summary.accommodations + Number(entry.accommodationCount || 0),
      tasks: summary.tasks + Number(entry.taskCount || 0)
    }),
    { total: 0, highPriority: 0, progressDue: 0, serviceAlerts: 0, accommodations: 0, tasks: 0 }
  );
}

function classroomPriorityTone(priority) {
  if (priority === "High") return "red";
  if (priority === "Medium") return "amber";
  return "green";
}

function classroomStatusTone(entry) {
  if (/linked|verified|active/i.test(entry.officialRecordStatus || entry.iepStatus || "")) return "green";
  if (/due|prep|coordination|check/i.test(entry.iepStatus || "")) return "amber";
  return "blue";
}

function RecentParentSummariesCard({ activity, navigate, setRoleView }) {
  const openFamilySummary = () => {
    setRoleView("parent");
    navigate("summary");
  };
  return (
    <Card
      title="Recent parent summaries"
      description="Family-facing summaries and meeting handouts prepared from approved IEP content."
      action={<Button icon={BookOpen} onClick={openFamilySummary}>Open family summary</Button>}
    >
      <div className="list">
        {activity.handouts.length ? (
          activity.handouts.slice(0, 4).map((handout) => (
            <div className="question-row" key={handout.id}>
              <div>
                <strong>{handout.label}</strong>
                <span>{handout.studentName} · {handout.sections.length} sections · {handout.questions.length} prompts</span>
                <small>Prepared by {handout.createdBy} · {formatDateTime(handout.createdAt)}</small>
                <small>{handout.sourceAlignment?.sourceId || "No source id recorded"}</small>
              </div>
              <Badge tone="green">Family-ready</Badge>
            </div>
          ))
        ) : activity.currentSummaryReady ? (
          <div className="question-row">
            <div>
              <strong>{activity.currentSummaryTitle}</strong>
              <span>{activity.currentStudentName} family summary is ready for review or handout generation.</span>
              <small>{activity.sourceId}</small>
            </div>
            <Badge tone="blue">Ready</Badge>
          </div>
        ) : (
          <EmptyState title="No parent summaries yet" text="Approve this student's source extraction before preparing a family-facing summary." />
        )}
      </div>
    </Card>
  );
}

function ReminderCenter({ reminders, dispatch, navigate }) {
  const openCount = reminders.filter((reminder) => !reminder.reviewed).length;
  return (
    <Card
      title="Reminder center"
      description="Deadline engine for upcoming IEP reviews, stale progress data, service logs, meetings, and human review actions."
      action={<Badge tone={openCount ? "red" : "green"}>{openCount} open</Badge>}
    >
      <div className="reminder-list">
        {reminders.slice(0, 7).map((reminder) => {
          const Icon = reminder.icon;
          return (
            <article className={`reminder-row ${reminder.reviewed ? "reviewed" : ""}`} key={reminder.id}>
              <span className={`reminder-icon ${reminder.tone}`}>
                <Icon size={16} />
              </span>
              <div>
                <strong>{reminder.title}</strong>
                <p>{reminder.description}</p>
                <small>{reminder.meta}</small>
              </div>
              <div className="reminder-actions">
                <Badge tone={reminder.reviewed ? "green" : reminder.tone}>{reminder.reviewed ? "Reviewed" : reminder.status}</Badge>
                <Button
                  icon={Check}
                  disabled={reminder.reviewed}
                  onClick={() =>
                    dispatch(
                      {
                        type: "reviewReminder",
                        reminderId: reminder.id,
                        title: reminder.title,
                        studentId: reminder.studentId,
                        note: `Reviewed ${reminder.status.toLowerCase()} reminder from ${reminder.source}.`
                      },
                      { title: "Reminder reviewed", detail: reminder.title }
                    )
                  }
                >
                  Mark reviewed
                </Button>
                <Button icon={Eye} onClick={() => navigate(reminder.targetView)}>
                  Open
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </Card>
  );
}

function NotificationOutbox({ state, reminders, dispatch, disabled = false }) {
  const deliveries = state.notificationDeliveries || [];
  return (
    <div className="grid two-one">
      <Card title="Notification outbox" description="Simulated delivery log for reminder and packet follow-up.">
        <div className="list">
          {deliveries.length ? (
            deliveries.slice(0, 4).map((delivery) => (
              <div className="question-row" key={delivery.id}>
                <div>
                  <strong>{delivery.sourceTitle}</strong>
                  <span>
                    {notificationAudienceLabel(delivery.audience)} · {delivery.channel} · {studentName(state, delivery.studentId)}
                  </span>
                  <span>{delivery.message}</span>
                  <small>Sent by {delivery.sentBy} · {formatDateTime(delivery.sentAt)}</small>
                </div>
                <Badge tone={notificationTone(delivery.status)}>{delivery.status}</Badge>
              </div>
            ))
          ) : (
            <EmptyState title="No notices sent" text="Send a reminder notice to record delivery follow-up." />
          )}
        </div>
      </Card>
      <Card title="Send reminder notice" description="Record in-app delivery without changing the official IEP.">
        {disabled ? (
          <AccessNotice text={`${roles[state.user.role].label} can review notification status but cannot send reminder or packet notices.`} />
        ) : null}
        <NotificationForm
          reminders={reminders}
          dispatch={dispatch}
          disabled={disabled || !reminders.length}
          currentStudentId={state.currentStudentId}
        />
      </Card>
    </div>
  );
}

function NotificationForm({ reminders, dispatch, disabled = false, currentStudentId }) {
  const [sourceId, setSourceId] = useState(reminders[0]?.id || "");
  const [audience, setAudience] = useState("family");
  const [channel, setChannel] = useState("In-app");
  const selectedReminder = reminders.find((reminder) => reminder.id === sourceId) || reminders[0];
  const [message, setMessage] = useState(() => defaultNotificationMessage(selectedReminder));

  useEffect(() => {
    if (!reminders.some((reminder) => reminder.id === sourceId)) {
      setSourceId(reminders[0]?.id || "");
    }
  }, [reminders, sourceId]);

  useEffect(() => {
    setMessage(defaultNotificationMessage(selectedReminder));
  }, [selectedReminder?.id]);

  const ready = selectedReminder && String(message || "").trim();

  return (
    <div className="notification-form">
      <label className="field">
        <span>Notification source</span>
        <select
          aria-label="Notification source"
          value={selectedReminder?.id || ""}
          disabled={disabled}
          onChange={(event) => setSourceId(event.target.value)}
        >
          {reminders.map((reminder) => (
            <option value={reminder.id} key={reminder.id}>{reminder.title}</option>
          ))}
        </select>
      </label>
      <div className="mini-form-grid">
        <label className="field">
          <span>Audience</span>
          <select
            aria-label="Notification audience"
            value={audience}
            disabled={disabled}
            onChange={(event) => setAudience(event.target.value)}
          >
            {notificationAudienceOptions.map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Channel</span>
          <select
            aria-label="Notification channel"
            value={channel}
            disabled={disabled}
            onChange={(event) => setChannel(event.target.value)}
          >
            {notificationChannelOptions.map((item) => (
              <option value={item} key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Message</span>
        <textarea
          aria-label="Notification message"
          value={message}
          disabled={disabled}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>
      <Button
        icon={Send}
        variant="primary"
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "sendNotification",
              studentId: selectedReminder?.studentId || currentStudentId,
              sourceId: selectedReminder?.id,
              sourceType: selectedReminder?.source,
              sourceTitle: selectedReminder?.title,
              audience,
              channel,
              message: message.trim()
            },
            { title: "Notification sent", detail: selectedReminder?.title || "Reminder notice" }
          )
        }
      >
        Send notice
      </Button>
      <p className="card-note">Delivery is simulated for the MVP and preserved in the audit trail for follow-up.</p>
    </div>
  );
}

function StudentView({ state, student, iep, navigate, dispatch, setRoleView }) {
  const [profileTab, setProfileTab] = useState("overview");
  const studentDocuments = useMemo(
    () => state.documents.filter((document) => document.studentId === student.id),
    [state.documents, student.id]
  );
  const studentActivity = useMemo(
    () => activityForStudent(state, student).slice(0, 8),
    [state, student]
  );

  return (
    <section className="page">
      <PageHead
        label="Student workspace"
        title={`${student.firstName} ${student.lastName}`}
        description="A single operating view of source documents, obligations, evidence, family input, and team activity."
        actions={
          <>
            <Button icon={Eye} onClick={() => navigate("summary")}>Preview role view</Button>
            <Button variant="primary" icon={CalendarDays} onClick={() => navigate("meetings")}>Prepare meeting</Button>
          </>
        }
      />
      <StudentHero student={student} iep={iep} />
      <StudentProfileTabs active={profileTab} setActive={setProfileTab} navigate={navigate} />
      <StudentProfileWorkflowMap
        state={state}
        active={profileTab}
        setActive={setProfileTab}
        navigate={navigate}
        activityEvents={studentActivity}
      />
      {profileTab === "documents" ? (
        <StudentDocumentsPanel documents={studentDocuments} iep={iep} navigate={navigate} />
      ) : profileTab === "activity" ? (
        <StudentActivityPanel events={studentActivity} navigate={navigate} />
      ) : (
        <StudentOverviewPanel state={state} navigate={navigate} setRoleView={setRoleView} dispatch={dispatch} />
      )}
    </section>
  );
}

function StudentProfileTabs({ active, setActive, navigate }) {
  const tabs = [
    ["overview", "Overview"],
    ["intake", "IEP Document"],
    ["summary", "Plan Summary"],
    ["progress", "Goals"],
    ["services", "Services"],
    ["services", "Accommodations"],
    ["progress", "Progress Monitoring"],
    ["meetings", "Meeting Prep"],
    ["review", "Compliance Review"],
    ["documents", "Documents"],
    ["activity", "Activity Log"]
  ];
  return (
    <div className="tabs profile-tabs" role="tablist" aria-label="Student profile tabs">
      {tabs.map(([id, label]) => {
        const localTab = id === "overview" || id === "documents" || id === "activity";
        return (
          <button
            className={active === id ? "active" : ""}
            type="button"
            key={`${id}-${label}`}
            role="tab"
            aria-selected={localTab ? active === id : false}
            onClick={() => (localTab ? setActive(id) : navigate(id))}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function StudentProfileWorkflowMap({ state, active, setActive, navigate, activityEvents = [] }) {
  const approvedRecord = currentStudentHasApprovedRecord(state);
  const documents = documentsForCurrentStudent(state);
  const preservedDocuments = documents.filter((document) => document.preserved).length;
  const goals = activeIepItemsForState(state, "goals");
  const services = activeIepItemsForState(state, "services");
  const accommodations = activeIepItemsForState(state, "accommodations");
  const openTasks = currentStudentTasksForState(state).filter((task) => task.status !== "Completed").length;
  const progressEntries = goals.reduce((total, goal) => total + (goal.progressEntries?.length || 0), 0);
  const staleGoals = goals.filter((goal) => goal.status === "Insufficient data" || goal.progressSchedule?.status === "Overdue").length;
  const serviceGaps = services.filter(
    (service) => Number(service.deliveredMinutes || 0) < Number(service.scheduledMinutes || 0)
  ).length;
  const ambiguousAccommodations = accommodations.filter((accommodation) => accommodation.ambiguity).length;
  const meeting = currentStudentMeetingForState(state);
  const openQuestions = (meeting?.familyQuestions || []).filter((question) => question.status !== "Answered").length;
  const companionDocuments = meeting?.companionDocuments || [];
  const readyCompanionDocuments = companionDocuments.filter((document) =>
    ["Sent", "Available", "Ready", "Reviewed"].includes(document.status)
  ).length;
  const reviewFlags = currentStudentReviewFlagsForState(state);
  const openFlags = reviewFlags.filter((flag) => flag.status === "Open").length;
  const handouts = (state.summaryHandouts || []).filter((handout) => handout.studentId === state.currentStudentId);
  const summaryAudiences = approvedRecord
    ? Object.values(state.summaries || {}).filter((summary) => summary?.sections?.length).length
    : 0;
  const latestActivity = activityEvents[0];

  const sections = [
    {
      id: "overview",
      label: "Overview",
      icon: Eye,
      tone: openTasks ? "amber" : "green",
      status: countLabel(openTasks, "open action"),
      detail: approvedRecord ? "Operating status and next steps" : "Source review must be approved first",
      local: true
    },
    {
      id: "intake",
      label: "IEP Document",
      icon: FileText,
      tone: preservedDocuments ? "green" : "amber",
      status: countLabel(documents.length, "source doc"),
      detail: preservedDocuments ? `${preservedDocuments} preserved with source traceability` : "No source document preserved yet",
      view: "intake"
    },
    {
      id: "summary",
      label: "Plan Summary",
      icon: BookOpen,
      tone: summaryAudiences ? "green" : "amber",
      status: summaryAudiences ? countLabel(summaryAudiences, "role view") : "Review pending",
      detail: handouts.length ? countLabel(handouts.length, "family handout") : "Teacher, family, student, and reviewer language",
      view: "summary"
    },
    {
      id: "goals",
      label: "Goals",
      icon: BarChart3,
      tone: goals.length ? "blue" : "amber",
      status: countLabel(goals.length, "goal"),
      detail: goals.length ? goals.map((goal) => goal.domain).join(", ") : "No approved measurable goals",
      view: "progress"
    },
    {
      id: "services",
      label: "Services",
      icon: Clock3,
      tone: serviceGaps ? "red" : services.length ? "green" : "amber",
      status: countLabel(services.length, "service"),
      detail: serviceGaps ? countLabel(serviceGaps, "delivery gap") : `${sum(services, "deliveredMinutes")} of ${sum(services, "scheduledMinutes")} minutes logged`,
      view: "services"
    },
    {
      id: "accommodations",
      label: "Accommodations",
      icon: ClipboardCheck,
      tone: ambiguousAccommodations ? "amber" : accommodations.length ? "green" : "amber",
      status: countLabel(accommodations.length, "support"),
      detail: ambiguousAccommodations ? countLabel(ambiguousAccommodations, "clarification needed", "clarifications needed") : "Access supports assigned to staff roles",
      view: "services"
    },
    {
      id: "progress-monitoring",
      label: "Progress Monitoring",
      icon: ListChecks,
      tone: staleGoals ? "amber" : progressEntries ? "green" : "amber",
      status: countLabel(progressEntries, "data point"),
      detail: staleGoals ? countLabel(staleGoals, "schedule needs review", "schedules need review") : "Evidence history and report language",
      view: "progress"
    },
    {
      id: "meeting-prep",
      label: "Meeting Prep",
      icon: CalendarDays,
      tone: meeting ? (openQuestions ? "amber" : "green") : "amber",
      status: meeting ? `Readiness ${meeting.readiness}%` : "Not scheduled",
      detail: meeting ? `${countLabel(openQuestions, "open question")} · ${readyCompanionDocuments}/${companionDocuments.length} companion docs ready` : "No meeting prep record",
      view: "meetings"
    },
    {
      id: "compliance-review",
      label: "Compliance Review",
      icon: ShieldCheck,
      tone: openFlags ? "red" : reviewFlags.length ? "green" : "amber",
      status: countLabel(openFlags, "open flag"),
      detail: reviewFlags.length ? countLabel(reviewFlags.length, "review item") : "No review findings for this student",
      view: "review"
    },
    {
      id: "documents",
      label: "Documents",
      icon: Upload,
      tone: documents.length ? "blue" : "amber",
      status: countLabel(documents.length, "document"),
      detail: documents.length ? "Preserved originals stay separate from AI output" : "No documents visible for this student",
      local: true
    },
    {
      id: "activity",
      label: "Activity Log",
      icon: Lock,
      tone: activityEvents.length ? "purple" : "amber",
      status: countLabel(activityEvents.length, "event"),
      detail: latestActivity ? `Latest: ${latestActivity.title}` : "No student activity yet",
      local: true
    }
  ];

  return (
    <section className="profile-workflow" aria-label="Student profile section status">
      <div className="profile-workflow-head">
        <div>
          <span>Profile workflow map</span>
          <strong>FDS profile sections</strong>
        </div>
        <Badge tone={approvedRecord ? "green" : "amber"}>
          {approvedRecord ? "Human-approved record" : "Review pending"}
        </Badge>
      </div>
      <div className="profile-section-grid">
        {sections.map((section) => {
          const Icon = section.icon;
          const activeLocalSection = section.local && active === section.id;
          return (
            <button
              className={`profile-section-link ${activeLocalSection ? "active" : ""}`}
              type="button"
              key={section.id}
              aria-current={activeLocalSection ? "page" : undefined}
              onClick={() => (section.local ? setActive(section.id) : navigate(section.view))}
            >
              <span className={`profile-section-icon ${section.tone}`}><Icon size={16} /></span>
              <span className="profile-section-copy">
                <strong>{section.label}</strong>
                <small>{section.detail}</small>
              </span>
              <Badge tone={section.tone}>{section.status}</Badge>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StudentOverviewPanel({ state, navigate, setRoleView, dispatch }) {
  const studentComments = visibleTeamCommentsForState(state);
  const teamCommentQueueReviews = visibleTeamCommentQueueReviewsForState(state);
  const canViewTeamCommentQueueReviews = canViewTeamCommentQueueReviewsForRole(state.user.role);
  const canModerateTeamComments = can(state, "moderateTeamComment");
  const portalAccessReviews = visiblePortalAccessReviewsForState(state);
  const portalInvitationPackages = visiblePortalInvitationPackagesForState(state);
  const commentTargets = teamCommentTargetsForState(state, state.currentStudentId);
  const nextActions = currentStudentTasksForState(state).filter((task) => task.status !== "Completed");
  return (
    <div className="grid two-one">
      <Card title="IEP at a glance" description="Operational status derived from the approved structured record.">
        <div className="mini-grid">
          <MiniStat label="Staff handoff" value="7 of 9" note="Two acknowledgments pending" />
          <MiniStat label="Goal evidence" value="82%" note="One data point due Friday" />
          <MiniStat label="Meeting readiness" value="78%" note="Family question unresolved" />
        </div>
        <h3 className="section-title">Next actions</h3>
        <div className="list">
          {nextActions.length ? (
            nextActions.map((task) => (
              <div className="checkrow" key={task.id}>
                <span className="checkbox"><Clock3 size={13} /></span>
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.description}</span>
                </div>
                <small>{task.dueDate}</small>
              </div>
            ))
          ) : (
            <EmptyState title="No next actions" text="Approved implementation responsibilities will appear after this student's source review is complete." />
          )}
        </div>
      </Card>
      <Card title="What each audience sees" description="One plan, translated for different responsibilities.">
        <div className="audience-grid">
          {[
            ["teacher", "Teacher view", "Classroom accommodations, data responsibilities, and implementation checklist.", BookOpen],
            ["parent", "Family view", "Plain-language services, goals, progress, and questions.", Users],
            ["student", "Student view", "My strengths, goals, supports, and self-advocacy prompts.", GraduationCap],
            ["administrator", "Reviewer view", "Completeness, clarity, timelines, risk, and audit history.", ShieldCheck]
          ].map(([key, title, description, Icon]) => (
            <button
              className="audience-card"
              key={key}
              type="button"
              onClick={() => {
                setRoleView(key);
                navigate("summary");
              }}
            >
              <Icon size={19} />
              <strong>{title}</strong>
              <span>{description}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card title="Portal access review" description="Staff verification of parent/student portal readiness without changing IEP obligations.">
        <div className="list">
          {portalAccessReviews.length ? (
            portalAccessReviews.slice(0, 4).map((review) => (
              <div className="question-row" key={review.id}>
                <div>
                  <strong>{review.subjectRole}: {review.subjectName}</strong>
                  <span>{review.verificationMethod} · {review.privacyNote}</span>
                  <small>Identity evidence: {review.identityEvidence}</small>
                  <small>Language/support follow-up: {review.languageSupportNeeded || "No"}</small>
                  {review.reviewedBy ? (
                    <small>
                      Reviewed by {review.reviewedBy} on {formatDateTime(review.reviewedAt)} · digest {shortHash(review.reviewDigest)}
                    </small>
                  ) : null}
                  <small>{review.officialRecordImpact}</small>
                </div>
                <Badge tone={portalAccessTone(review.accessStatus)}>{review.accessStatus}</Badge>
              </div>
            ))
          ) : (
            <EmptyState
              title="No portal access reviews"
              text="Staff can record local parent/student access verification before sharing portal materials."
            />
          )}
        </div>
        {!canViewPortalAccessReviewsForRole(state.user.role) ? (
          <AccessNotice text={`${roles[state.user.role].label} cannot view internal identity-verification evidence for portal access.`} />
        ) : null}
        <PortalAccessReviewForm
          state={state}
          dispatch={dispatch}
          disabled={!can(state, "reviewPortalAccess")}
        />
        <h3 className="section-title">Portal invitation packages</h3>
        <div className="list">
          {portalInvitationPackages.length ? (
            portalInvitationPackages.slice(0, 4).map((invitation) => (
              <div className="question-row" key={invitation.id}>
                <div>
                  <strong>{invitation.subjectRole}: {invitation.subjectName}</strong>
                  <span>{invitation.deliveryChannel} · expires {invitation.expiresAt || "not set"}</span>
                  <small>Scope: {invitation.scopeSummary}</small>
                  <small>Identity readiness: {invitation.identityVerificationSummary}</small>
                  <small>Privacy boundary: {invitation.privacyBoundary}</small>
                  <small>Language/support note: {invitation.languageSupportNote || "No additional support recorded"}</small>
                  {invitation.providerReference ? <small>Provider/reference: {invitation.providerReference}</small> : null}
                  {invitation.preparedBy ? (
                    <small>
                      Prepared by {invitation.preparedBy} on {formatDateTime(invitation.preparedAt)} · digest {shortHash(invitation.invitationDigest)}
                    </small>
                  ) : null}
                  <small>{invitation.officialRecordImpact}</small>
                </div>
                <Badge tone={/hold|verification/i.test(invitation.status) ? "amber" : "blue"}>{invitation.status}</Badge>
              </div>
            ))
          ) : (
            <EmptyState
              title="No portal invitation packages"
              text="Staff can prepare a scoped invitation readiness package after identity and privacy review."
            />
          )}
        </div>
        <PortalInvitationPackageForm
          state={state}
          reviews={portalAccessReviews}
          dispatch={dispatch}
          disabled={!can(state, "reviewPortalAccess")}
        />
        {!can(state, "reviewPortalAccess") ? (
          <AccessNotice text={`${roles[state.user.role].label} cannot record portal identity or privacy verification from this workspace.`} />
        ) : null}
      </Card>
      <Card title="Team collaboration thread" description="Role-aware comments tied to source-traced IEP items without changing official obligations.">
        <div className="list">
          {studentComments.length ? (
            studentComments.slice(0, 5).map((comment) => (
              <div className="question-row" key={comment.id}>
                <div>
                  <strong>{comment.targetTitle}</strong>
                  <span>{comment.body}</span>
                  <small>
                    {comment.postedBy} · {formatDateTime(comment.postedAt)} · {comment.sourceReference}
                  </small>
                  <small>Moderation status: {comment.moderationStatus || "Pending review"}</small>
                  {comment.moderationNote ? <small>Moderation note: {comment.moderationNote}</small> : null}
                  {(comment.replies || []).length ? (
                    <div className="list compact-list">
                      {comment.replies.slice(0, 2).map((reply) => (
                        <div className="question-row" key={reply.id}>
                          <div>
                            <strong>Thread reply</strong>
                            <span>{reply.body}</span>
                            <small>{reply.postedBy} · {formatDateTime(reply.postedAt)} · {reply.sourceReference}</small>
                            <small>{reply.officialRecordImpact}</small>
                          </div>
                          <Badge tone={teamCommentTone(reply.visibility)}>{reply.visibility}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <small>{comment.officialRecordImpact}</small>
                </div>
                <Badge tone={teamCommentTone(comment.visibility)}>{comment.visibility}</Badge>
              </div>
            ))
          ) : (
            <EmptyState title="No team comments" text="Add a source-aware note for a goal, task, service, meeting, or review finding." />
          )}
        </div>
        <TeamCommentForm
          state={state}
          targets={commentTargets}
          dispatch={dispatch}
          disabled={!can(state, "addTeamComment")}
        />
        <TeamCommentReplyForm
          comments={studentComments}
          role={state.user.role}
          dispatch={dispatch}
          disabled={!can(state, "addTeamComment")}
        />
        {!canModerateTeamComments ? (
          <AccessNotice text={`${roles[state.user.role].label} can participate in visible collaboration threads but cannot moderate comment visibility or review status.`} />
        ) : null}
        <TeamCommentModerationForm
          comments={studentComments}
          role={state.user.role}
          dispatch={dispatch}
          disabled={!canModerateTeamComments}
        />
        {canViewTeamCommentQueueReviews ? (
          <>
            <h3 className="section-title">Collaboration moderation queue</h3>
            <div className="list">
              {teamCommentQueueReviews.length ? (
                teamCommentQueueReviews.slice(0, 3).map((review) => (
                  <div className="question-row" key={review.id}>
                    <div>
                      <strong>{review.queueStatus}</strong>
                      <span>
                        Pending {review.pendingCount} · follow-up {review.needsFollowUpCount} · staff-only {review.staffOnlyCount}
                      </span>
                      <small>Notification plan: {review.notificationPlan}</small>
                      <small>Retention: {review.retentionDecision} · {review.retentionBoundary}</small>
                      <small>Reviewed by {review.reviewedBy} on {formatDateTime(review.reviewedAt)} · digest {shortHash(review.queueDigest)}</small>
                      <small>{review.officialRecordImpact}</small>
                    </div>
                    <Badge tone={teamCommentQueueTone(review.queueStatus)}>{review.commentsReviewed?.length || 0} items</Badge>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No collaboration queue review"
                  text="Record a local moderation queue review before relying on live notification or retention workflows."
                />
              )}
            </div>
            <TeamCommentQueueReviewForm
              state={state}
              comments={studentComments}
              dispatch={dispatch}
              disabled={!canModerateTeamComments}
            />
          </>
        ) : (
          <AccessNotice text={`${roles[state.user.role].label} cannot view internal moderation queue and retention review records.`} />
        )}
      </Card>
    </div>
  );
}

function visiblePortalAccessReviewsForState(state) {
  if (!canViewPortalAccessReviewsForRole(state.user.role)) return [];
  return (state.portalAccessReviews || []).filter((review) => review.studentId === state.currentStudentId);
}

function visiblePortalInvitationPackagesForState(state) {
  if (!canViewPortalAccessReviewsForRole(state.user.role)) return [];
  return (state.portalInvitationPackages || []).filter((invitation) => invitation.studentId === state.currentStudentId);
}

function visibleTeamCommentsForState(state) {
  return (state.teamComments || [])
    .filter((comment) => comment.studentId === state.currentStudentId && canViewTeamCommentForRole(state.user.role, comment.visibility))
    .map((comment) => ({
      ...comment,
      replies: (comment.replies || []).filter((reply) => canViewTeamCommentForRole(state.user.role, reply.visibility))
    }));
}

function visibleTeamCommentQueueReviewsForState(state) {
  if (!canViewTeamCommentQueueReviewsForRole(state.user.role)) return [];
  return (state.teamCommentQueueReviews || []).filter((review) => review.studentId === state.currentStudentId);
}

function TeamCommentForm({ state, targets = [], dispatch, disabled = false }) {
  const initialTarget = targets[0] ? `${targets[0].type}::${targets[0].id}` : "";
  const [targetValue, setTargetValue] = useState(initialTarget);
  const visibilityOptions = teamCommentVisibilityOptionsForRole(state.user.role);
  const [visibility, setVisibility] = useState(visibilityOptions[0] || "IEP team");
  const [body, setBody] = useState("Add a team note that preserves source context and does not change the official IEP.");

  useEffect(() => {
    if (!targets.length) {
      setTargetValue("");
      return;
    }
    if (!targets.some((target) => `${target.type}::${target.id}` === targetValue)) {
      setTargetValue(`${targets[0].type}::${targets[0].id}`);
    }
  }, [targets, targetValue]);

  useEffect(() => {
    const options = teamCommentVisibilityOptionsForRole(state.user.role);
    if (!options.includes(visibility)) setVisibility(options[0] || "IEP team");
  }, [state.user.role, visibility]);

  const selectedTarget = targets.find((target) => `${target.type}::${target.id}` === targetValue) || targets[0] || null;
  const ready = Boolean(selectedTarget && body.trim());

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Comment target</span>
        <select
          aria-label="Comment target"
          value={targetValue}
          disabled={disabled || targets.length === 0}
          onChange={(event) => setTargetValue(event.target.value)}
        >
          {targets.map((target) => (
            <option value={`${target.type}::${target.id}`} key={`${target.type}-${target.id}`}>
              {target.type}: {target.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Comment visibility</span>
        <select
          aria-label="Comment visibility"
          value={visibility}
          disabled={disabled}
          onChange={(event) => setVisibility(event.target.value)}
        >
          {visibilityOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Team comment</span>
        <textarea
          aria-label="Team comment"
          value={body}
          disabled={disabled}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <Button
        icon={MessageSquare}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "addTeamComment",
              studentId: state.currentStudentId,
              targetType: selectedTarget.type,
              targetId: selectedTarget.id,
              targetTitle: selectedTarget.label,
              visibility,
              body: body.trim(),
              sourceReference: selectedTarget.sourceReference
            },
            {
              title: "Team comment added",
              detail: `${visibility} comment saved for ${selectedTarget.label}.`
            }
          )
        }
      >
        Add team comment
      </Button>
    </div>
  );
}

function TeamCommentReplyForm({ comments = [], role, dispatch, disabled = false }) {
  const [commentId, setCommentId] = useState(comments[0]?.id || "");
  const selected = comments.find((comment) => comment.id === commentId) || comments[0] || null;
  const visibilityOptions = teamCommentVisibilityOptionsForRole(role);
  const [visibility, setVisibility] = useState(visibilityOptions[0] || "IEP team");
  const [body, setBody] = useState("Threaded follow-up keeps the discussion tied to the same source-traced IEP item.");

  useEffect(() => {
    if (!comments.length) {
      setCommentId("");
      return;
    }
    if (!comments.some((comment) => comment.id === commentId)) {
      setCommentId(comments[0].id);
    }
  }, [comments, commentId]);

  useEffect(() => {
    const options = teamCommentVisibilityOptionsForRole(role);
    if (!options.includes(visibility)) setVisibility(options[0] || "IEP team");
  }, [role, visibility]);

  useEffect(() => {
    setBody("Threaded follow-up keeps the discussion tied to the same source-traced IEP item.");
  }, [role, commentId]);

  const ready = Boolean(selected && body.trim());
  return (
    <div className="meeting-input">
      <label className="field">
        <span>Reply comment</span>
        <select
          aria-label="Reply comment"
          value={commentId}
          disabled={disabled || comments.length === 0}
          onChange={(event) => setCommentId(event.target.value)}
        >
          {comments.length ? (
            comments.map((comment) => <option value={comment.id} key={comment.id}>{comment.targetTitle}</option>)
          ) : (
            <option value="">No visible comments</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Thread reply visibility</span>
        <select
          aria-label="Thread reply visibility"
          value={visibility}
          disabled={disabled || !selected}
          onChange={(event) => setVisibility(event.target.value)}
        >
          {visibilityOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Thread reply</span>
        <textarea
          aria-label="Thread reply"
          value={body}
          disabled={disabled || !selected}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <Button
        icon={MessageSquare}
        disabled={disabled || !ready}
        onClick={() => {
          dispatch(
            {
              type: "replyTeamComment",
              commentId,
              visibility,
              body: body.trim()
            },
            { title: "Team comment reply added", detail: "Threaded follow-up saved with source context." }
          );
          setBody("Threaded follow-up keeps the discussion tied to the same source-traced IEP item.");
        }}
      >
        Add thread reply
      </Button>
    </div>
  );
}

function TeamCommentModerationForm({ comments = [], role, dispatch, disabled = false }) {
  const [commentId, setCommentId] = useState(comments[0]?.id || "");
  const selected = comments.find((comment) => comment.id === commentId) || comments[0] || null;
  const [moderationStatus, setModerationStatus] = useState(selected?.moderationStatus || "Pending review");
  const [visibility, setVisibility] = useState(selected?.visibility || "IEP team");
  const [moderationNote, setModerationNote] = useState(
    selected?.moderationNote || "Review confirms this collaboration note preserves source fidelity and does not change IEP obligations."
  );

  useEffect(() => {
    if (!comments.length) {
      setCommentId("");
      return;
    }
    if (!comments.some((comment) => comment.id === commentId)) {
      setCommentId(comments[0].id);
    }
  }, [comments, commentId]);

  useEffect(() => {
    if (!selected) return;
    setModerationStatus(selected.moderationStatus || "Pending review");
    setVisibility(selected.visibility || "IEP team");
    setModerationNote(
      selected.moderationNote || "Review confirms this collaboration note preserves source fidelity and does not change IEP obligations."
    );
  }, [selected]);

  const ready = Boolean(selected && moderationNote.trim());
  return (
    <div className="meeting-input">
      <label className="field">
        <span>Moderation comment</span>
        <select
          aria-label="Moderation comment"
          value={commentId}
          disabled={disabled || comments.length === 0}
          onChange={(event) => setCommentId(event.target.value)}
        >
          {comments.length ? (
            comments.map((comment) => <option value={comment.id} key={comment.id}>{comment.targetTitle}</option>)
          ) : (
            <option value="">No visible comments</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Moderation status</span>
        <select
          aria-label="Moderation status"
          value={moderationStatus}
          disabled={disabled || !selected}
          onChange={(event) => setModerationStatus(event.target.value)}
        >
          {teamCommentModerationStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Moderation visibility</span>
        <select
          aria-label="Moderation visibility"
          value={visibility}
          disabled={disabled || !selected}
          onChange={(event) => setVisibility(event.target.value)}
        >
          {teamCommentVisibilityOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Moderation note</span>
        <textarea
          aria-label="Moderation note"
          value={moderationNote}
          disabled={disabled || !selected}
          onChange={(event) => setModerationNote(event.target.value)}
        />
      </label>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "moderateTeamComment",
              commentId,
              moderationStatus,
              visibility,
              moderationNote: moderationNote.trim()
            },
            { title: "Team comment moderated", detail: "Collaboration thread review saved." }
          )
        }
      >
        Record moderation review
      </Button>
    </div>
  );
}

function TeamCommentQueueReviewForm({ state, comments = [], dispatch, disabled = false }) {
  const snapshot = teamCommentQueueSnapshotForState(state, state.currentStudentId);
  const [queueStatus, setQueueStatus] = useState("Queue reviewed");
  const [notificationPlan, setNotificationPlan] = useState(
    "Use in-app team follow-up only; no live external threaded notifications are connected in the local demo."
  );
  const [retentionDecision, setRetentionDecision] = useState("Retain in audit trail");
  const [retentionBoundary, setRetentionBoundary] = useState(
    "Retain source-traced collaboration in the local audit trail; production retention schedule and legal hold rules require district approval."
  );
  const [reviewerNote, setReviewerNote] = useState(
    "Queue review confirms pending collaboration items remain source-traced, role-aware, and separate from official IEP changes."
  );
  const [nextReviewDate, setNextReviewDate] = useState(() => isoDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));

  useEffect(() => {
    setNotificationPlan("Use in-app team follow-up only; no live external threaded notifications are connected in the local demo.");
    setRetentionBoundary(
      "Retain source-traced collaboration in the local audit trail; production retention schedule and legal hold rules require district approval."
    );
    setReviewerNote(
      "Queue review confirms pending collaboration items remain source-traced, role-aware, and separate from official IEP changes."
    );
  }, [state.currentStudentId, comments.length]);

  const ready = Boolean(notificationPlan.trim() && retentionBoundary.trim() && reviewerNote.trim() && nextReviewDate);
  return (
    <div className="meeting-input">
      <div className="mini-grid">
        <MiniStat label="Pending queue" value={snapshot.pendingCount} note={`${snapshot.commentsReviewed.length} recent items reviewed`} />
        <MiniStat label="Staff-only" value={snapshot.staffOnlyCount} note="Internal visibility checks" />
        <MiniStat label="Follow-up" value={snapshot.needsFollowUpCount} note="Needs visibility or team action" />
      </div>
      <label className="field">
        <span>Queue review status</span>
        <select
          aria-label="Queue review status"
          value={queueStatus}
          disabled={disabled}
          onChange={(event) => setQueueStatus(event.target.value)}
        >
          {teamCommentQueueStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Queue notification plan</span>
        <textarea
          aria-label="Queue notification plan"
          value={notificationPlan}
          disabled={disabled}
          onChange={(event) => setNotificationPlan(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Queue retention decision</span>
        <select
          aria-label="Queue retention decision"
          value={retentionDecision}
          disabled={disabled}
          onChange={(event) => setRetentionDecision(event.target.value)}
        >
          {teamCommentRetentionDecisionOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Queue retention boundary</span>
        <textarea
          aria-label="Queue retention boundary"
          value={retentionBoundary}
          disabled={disabled}
          onChange={(event) => setRetentionBoundary(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Queue reviewer note</span>
        <textarea
          aria-label="Queue reviewer note"
          value={reviewerNote}
          disabled={disabled}
          onChange={(event) => setReviewerNote(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Queue next review</span>
        <input
          aria-label="Queue next review"
          type="date"
          value={nextReviewDate}
          disabled={disabled}
          onChange={(event) => setNextReviewDate(event.target.value)}
        />
      </label>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "recordTeamCommentQueueReview",
              studentId: state.currentStudentId,
              queueStatus,
              notificationPlan: notificationPlan.trim(),
              retentionDecision,
              retentionBoundary: retentionBoundary.trim(),
              reviewerNote: reviewerNote.trim(),
              nextReviewDate
            },
            { title: "Collaboration queue reviewed", detail: "Moderation queue and retention review saved." }
          )
        }
      >
        Record queue review
      </Button>
    </div>
  );
}

function PortalAccessReviewForm({ state, dispatch, disabled = false }) {
  const [subjectRole, setSubjectRole] = useState("Parent/Guardian");
  const [subjectName, setSubjectName] = useState("Robin Lee");
  const [accessStatus, setAccessStatus] = useState("Access verified");
  const [verificationMethod, setVerificationMethod] = useState("District portal check");
  const [identityEvidence, setIdentityEvidence] = useState(
    "Guardian account matched student assignment, preferred language, and packet visibility scope."
  );
  const [languageSupportNeeded, setLanguageSupportNeeded] = useState("No");
  const [privacyNote, setPrivacyNote] = useState(
    "Family-visible materials reviewed; internal staff notes and staff-only collaboration threads remain restricted."
  );

  useEffect(() => {
    if (!disabled) return;
    setSubjectRole("Parent/Guardian");
    setSubjectName("");
    setAccessStatus("Needs guardian verification");
    setVerificationMethod("District portal check");
    setIdentityEvidence("");
    setLanguageSupportNeeded("");
    setPrivacyNote("");
  }, [disabled, state.user.role, state.currentStudentId]);

  const ready = Boolean(subjectName.trim() && identityEvidence.trim() && privacyNote.trim());

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Portal review role</span>
        <select
          aria-label="Portal review role"
          value={subjectRole}
          disabled={disabled}
          onChange={(event) => setSubjectRole(event.target.value)}
        >
          {portalAccessSubjectRoleOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Portal subject name</span>
        <input
          aria-label="Portal subject name"
          value={subjectName}
          disabled={disabled}
          onChange={(event) => setSubjectName(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Portal access status</span>
        <select
          aria-label="Portal access status"
          value={accessStatus}
          disabled={disabled}
          onChange={(event) => setAccessStatus(event.target.value)}
        >
          {portalAccessStatusOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Portal verification method</span>
        <select
          aria-label="Portal verification method"
          value={verificationMethod}
          disabled={disabled}
          onChange={(event) => setVerificationMethod(event.target.value)}
        >
          {portalVerificationMethodOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Portal identity evidence</span>
        <textarea
          aria-label="Portal identity evidence"
          value={identityEvidence}
          disabled={disabled}
          onChange={(event) => setIdentityEvidence(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Portal language support</span>
        <input
          aria-label="Portal language support"
          value={languageSupportNeeded}
          disabled={disabled}
          onChange={(event) => setLanguageSupportNeeded(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Portal privacy note</span>
        <textarea
          aria-label="Portal privacy note"
          value={privacyNote}
          disabled={disabled}
          onChange={(event) => setPrivacyNote(event.target.value)}
        />
      </label>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "recordPortalAccessReview",
              studentId: state.currentStudentId,
              subjectRole,
              subjectName: subjectName.trim(),
              accessStatus,
              verificationMethod,
              identityEvidence: identityEvidence.trim(),
              languageSupportNeeded: languageSupportNeeded.trim() || "No",
              privacyNote: privacyNote.trim()
            },
            { title: "Portal access reviewed", detail: `${subjectRole} portal access review saved.` }
          )
        }
      >
        Record portal access review
      </Button>
    </div>
  );
}

function PortalInvitationPackageForm({ state, reviews = [], dispatch, disabled = false }) {
  const [reviewId, setReviewId] = useState(reviews[0]?.id || "manual");
  const [subjectRole, setSubjectRole] = useState(reviews[0]?.subjectRole || "Parent/Guardian");
  const [subjectName, setSubjectName] = useState(reviews[0]?.subjectName || "Robin Lee");
  const [status, setStatus] = useState("Prepared for review");
  const [deliveryChannel, setDeliveryChannel] = useState("District portal invite");
  const [expiresAt, setExpiresAt] = useState(() => defaultPortalInvitationExpiry());
  const [scopeSummary, setScopeSummary] = useState(
    "Family summary, goals, progress summaries, meeting packet acknowledgments, and family-visible collaboration only."
  );
  const [identityVerificationSummary, setIdentityVerificationSummary] = useState(
    "Based on staff portal access review; district identity provider must still complete production verification."
  );
  const [languageSupportNote, setLanguageSupportNote] = useState("No additional language support requested.");
  const [privacyBoundary, setPrivacyBoundary] = useState(
    "Internal identity evidence, staff-only notes, compliance review, and unrelated student records remain restricted."
  );
  const [providerReference, setProviderReference] = useState("Demo provider queue reference pending");
  const selectedReview = reviews.find((review) => review.id === reviewId) || null;

  useEffect(() => {
    if (disabled) {
      setReviewId("manual");
      setSubjectRole("Parent/Guardian");
      setSubjectName("");
      setStatus("Prepared for review");
      setDeliveryChannel("District portal invite");
      setExpiresAt("");
      setScopeSummary("");
      setIdentityVerificationSummary("");
      setLanguageSupportNote("");
      setPrivacyBoundary("");
      setProviderReference("");
      return;
    }
    if (reviews.length && !reviews.some((review) => review.id === reviewId)) {
      setReviewId(reviews[0].id);
    }
  }, [disabled, reviews, reviewId, state.currentStudentId, state.user.role]);

  useEffect(() => {
    if (disabled || !selectedReview) return;
    setSubjectRole(selectedReview.subjectRole);
    setSubjectName(selectedReview.subjectName);
    setIdentityVerificationSummary(
      `Review ${shortHash(selectedReview.reviewDigest)}: ${selectedReview.verificationMethod} recorded ${selectedReview.accessStatus}.`
    );
    setLanguageSupportNote(selectedReview.languageSupportNeeded || "No additional language support requested.");
    setPrivacyBoundary(
      selectedReview.privacyNote ||
        "Internal identity evidence, staff-only notes, compliance review, and unrelated student records remain restricted."
    );
  }, [disabled, selectedReview?.id]);

  const ready = Boolean(
    subjectName.trim() &&
      expiresAt &&
      scopeSummary.trim() &&
      identityVerificationSummary.trim() &&
      privacyBoundary.trim()
  );

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Portal invite basis</span>
        <select
          aria-label="Portal invite basis"
          value={reviewId}
          disabled={disabled || reviews.length === 0}
          onChange={(event) => setReviewId(event.target.value)}
        >
          {reviews.length ? (
            reviews.map((review) => (
              <option value={review.id} key={review.id}>
                {review.subjectRole}: {review.subjectName} - {review.accessStatus}
              </option>
            ))
          ) : (
            <option value="manual">No staff review recorded</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Portal invitation role</span>
        <select
          aria-label="Portal invitation role"
          value={subjectRole}
          disabled={disabled}
          onChange={(event) => setSubjectRole(event.target.value)}
        >
          {portalAccessSubjectRoleOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Portal invitation subject</span>
        <input
          aria-label="Portal invitation subject"
          value={subjectName}
          disabled={disabled}
          onChange={(event) => setSubjectName(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Invitation status</span>
        <select
          aria-label="Invitation status"
          value={status}
          disabled={disabled}
          onChange={(event) => setStatus(event.target.value)}
        >
          {portalInvitationStatusOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Invitation delivery channel</span>
        <select
          aria-label="Invitation delivery channel"
          value={deliveryChannel}
          disabled={disabled}
          onChange={(event) => setDeliveryChannel(event.target.value)}
        >
          {portalInvitationDeliveryOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Invitation expires</span>
        <input
          aria-label="Invitation expires"
          type="date"
          value={expiresAt}
          disabled={disabled}
          onChange={(event) => setExpiresAt(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Invitation access scope</span>
        <textarea
          aria-label="Invitation access scope"
          value={scopeSummary}
          disabled={disabled}
          onChange={(event) => setScopeSummary(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Invitation identity summary</span>
        <textarea
          aria-label="Invitation identity summary"
          value={identityVerificationSummary}
          disabled={disabled}
          onChange={(event) => setIdentityVerificationSummary(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Invitation language support</span>
        <input
          aria-label="Invitation language support"
          value={languageSupportNote}
          disabled={disabled}
          onChange={(event) => setLanguageSupportNote(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Invitation privacy boundary</span>
        <textarea
          aria-label="Invitation privacy boundary"
          value={privacyBoundary}
          disabled={disabled}
          onChange={(event) => setPrivacyBoundary(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Invitation provider reference</span>
        <input
          aria-label="Invitation provider reference"
          value={providerReference}
          disabled={disabled}
          onChange={(event) => setProviderReference(event.target.value)}
        />
      </label>
      <Button
        icon={Send}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "preparePortalInvitationPackage",
              studentId: state.currentStudentId,
              subjectRole,
              subjectName: subjectName.trim(),
              status,
              deliveryChannel,
              expiresAt,
              scopeSummary: scopeSummary.trim(),
              identityVerificationSummary: identityVerificationSummary.trim(),
              languageSupportNote: languageSupportNote.trim() || "No additional language support requested.",
              privacyBoundary: privacyBoundary.trim(),
              providerReference: providerReference.trim()
            },
            { title: "Portal invitation package prepared", detail: `${subjectRole} portal invitation package is ready for staff review.` }
          )
        }
      >
        Prepare portal invitation
      </Button>
    </div>
  );
}

function StudentDocumentsPanel({ documents, iep, navigate }) {
  return (
    <div className="grid two-one profile-panel">
      <Card
        title="Preserved source documents"
        description="Official sources remain separate from AI-assisted extraction and downstream summaries."
        action={<Button icon={FileText} onClick={() => navigate("intake")}>Open source viewer</Button>}
      >
        {documents.length ? (
          <div className="document-list">
            {documents.map((document) => (
              <article className="document-row" key={document.id}>
                <div>
                  <strong>{document.name}</strong>
                  <span>{document.type || "Source"} · uploaded by {document.uploadedBy} · {formatDateTime(document.uploadedAt)}</span>
                </div>
                <div className="document-meta">
                  <Badge tone={document.preserved ? "green" : "amber"}>{document.preserved ? "Preserved" : "Needs preservation"}</Badge>
                  <small>{document.sourceAlignment?.sourceId || "No source id recorded"}</small>
                  {document.originalFile?.sha256 ? <small>SHA-256 {document.originalFile.sha256.slice(0, 12)}...</small> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No documents" text="No preserved source documents are visible for this student." />
        )}
      </Card>
      <Card title="IEP document link" description="Structured record points back to the preserved source used for review.">
        <div className="source-step tall">
          <span>Current IEP record</span>
          <strong>{iep?.id || "No active IEP"}</strong>
          <small>{iep?.extractionApproved ? "Extraction approved for downstream summaries and tasks." : "Extraction still requires human approval."}</small>
        </div>
        <div className="source-step tall">
          <span>IEP term</span>
          <strong>{iep ? `${formatDate(iep.startDate)} to ${formatDate(iep.endDate)}` : "Not available"}</strong>
          <small>{iep?.sourceAlignment?.sourceFormType || "Source form type not recorded"}</small>
        </div>
      </Card>
    </div>
  );
}

function StudentActivityPanel({ events, navigate }) {
  return (
    <div className="grid two-one profile-panel">
      <Card
        title="Student activity log"
        description="Student-level upload, extraction, review, progress, and implementation events."
        action={<Button icon={Lock} onClick={() => navigate("audit")}>Open full audit</Button>}
      >
        {events.length ? (
          <div className="timeline">
            {events.map((event) => (
              <div className="timeline-event" key={event.id || `${event.title}-${event.timestamp}`}>
                <span><Clock3 size={16} /></span>
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.detail}</p>
                </div>
                <small>{event.actor}<br />{formatDateTime(event.timestamp)}</small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No activity" text="No activity is visible for this student yet." />
        )}
      </Card>
      <Card title="Activity coverage" description="Events distinguish source content, human review, user notes, and AI-assisted output.">
        <div className="mini-grid two">
          <MiniStat label="Visible events" value={events.length} note="Current student context" />
          <MiniStat label="Latest actor" value={events[0]?.actor || "None"} note={events[0]?.type || "No activity yet"} />
        </div>
        <div className="note">
          <strong>Audit boundary</strong>
          <span>The profile shows student-context events. The full audit packet remains available for authorized export and hash-chain verification.</span>
        </div>
      </Card>
    </div>
  );
}

function IntakeView({ state, dispatch, navigate, exportRecord }) {
  const [sourceText, setSourceText] = useState("");
  const [documentName, setDocumentName] = useState("Pasted_IEP_Source.txt");
  const [sourceFile, setSourceFile] = useState(null);
  const [editing, setEditing] = useState(null);
  const [mappedSectionId, setMappedSectionId] = useState(state.extractionSections[0]?.id || "");
  const activeStudent = state.students.find((student) => student.id === state.currentStudentId);
  const activeDocument = state.documents.find((document) => document.studentId === state.currentStudentId) || null;
  const activeIep = state.ieps.find((iep) => iep.studentId === state.currentStudentId);
  const activeSourceAlignment = activeIep?.sourceAlignment || activeDocument?.sourceAlignment || sourceAlignmentForState(state);
  const activeSourceEntry = activeSourceEntryForState(state);
  const sourceGuidance = sourceGuidanceForState(state);
  const visibleExtractionSections = useMemo(
    () => state.extractionSections.filter((section) => !section.studentId || section.studentId === state.currentStudentId),
    [state.extractionSections, state.currentStudentId]
  );
  const mappedSection =
    visibleExtractionSections.find((section) => section.id === mappedSectionId) ||
    visibleExtractionSections[0] ||
    null;

  useEffect(() => {
    if (!visibleExtractionSections.some((section) => section.id === mappedSectionId)) {
      setMappedSectionId(visibleExtractionSections[0]?.id || "");
    }
  }, [visibleExtractionSections, mappedSectionId]);

  return (
    <section className="page">
      <PageHead
        label="Human-in-the-loop intake"
        title="Review the source beside the structured record."
        description="Uploaded or pasted content is preserved, extracted into structured fields, and held for human review before it drives tasks or summaries."
        actions={
          <>
            <Button
              icon={Download}
              disabled={!can(state, "export")}
              title={!can(state, "export") ? "Current role cannot export official structured records." : undefined}
              onClick={() => exportRecord("Structured IEP record", structuredIepExport(state))}
            >
              Export JSON
            </Button>
            <Button
              icon={FileText}
              disabled={!can(state, "export")}
              title={!can(state, "export") ? "Current role cannot export official structured records." : undefined}
              onClick={() => exportRecord("Structured IEP record", structuredIepExport(state), "pdf")}
            >
              Export PDF
            </Button>
            <Button
              icon={Building2}
              disabled={!can(state, "export") || !currentStudentHasApprovedRecord(state)}
              title={
                !can(state, "export")
                  ? "Current role cannot export district system packages."
                  : !currentStudentHasApprovedRecord(state)
                    ? "Approve the selected student's extraction before creating a district system package."
                    : undefined
              }
              onClick={() => exportRecord("District system package", districtSystemExport(state), "json")}
            >
              Export district package
            </Button>
            <Button
              variant="primary"
              icon={Check}
              disabled={!can(state, "approveExtraction")}
              title={!can(state, "approveExtraction") ? "Only authorized staff can approve extracted official IEP content." : undefined}
              onClick={() =>
                dispatch(
                  { type: "approveExtraction" },
                  { title: "Extraction approved", detail: "Downstream summaries and tasks can use the structured record." }
                )
              }
            >
              Approve extraction
            </Button>
          </>
        }
      />
      <Tabs active="intake" navigate={navigate} />
      <div className="intake-layout">
        <div className="stack">
          <StudentProfileIntakeCard
            student={activeStudent}
            dispatch={dispatch}
            disabled={!can(state, "createStudent")}
            roleLabel={roles[state.user.role].label}
          />
          <Card title="Source document" description="Original source is preserved and never overwritten.">
            {!can(state, "upload") ? (
              <AccessNotice text={`${roles[state.user.role].label} can view source context but cannot upload or replace official IEP documents.`} />
            ) : null}
            <div className="upload-panel">
              <Upload size={22} />
              <div>
                <strong>Add PDF, DOCX, text, or pasted IEP content</strong>
                <span>This browser MVP preserves file metadata and routes content to demo extraction.</span>
              </div>
              <label className={`file-input ${!can(state, "upload") ? "disabled" : ""}`}>
                Choose file
                <input
                  type="file"
                  disabled={!can(state, "upload")}
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const base64 = await fileToBase64(file);
                    const previewText = await previewTextForFile(file);
                    setDocumentName(file.name);
                    setSourceFile({
                      name: file.name,
                      mimeType: file.type,
                      size: file.size,
                      base64,
                      previewText
                    });
                    if (previewText) setSourceText(previewText);
                  }}
                />
              </label>
            </div>
            {sourceFile ? (
              <div className="upload-selected">
                <FileText size={16} />
                <span>
                  <strong>{sourceFile.name}</strong>
                  <small>{formatBytes(sourceFile.size)} selected for server-side parsing and source preservation.</small>
                </span>
              </div>
            ) : null}
            <label className="field">
              <span>Document name</span>
              <input value={documentName} onChange={(event) => setDocumentName(event.target.value)} />
            </label>
            <label className="field">
              <span>Manual paste option</span>
              <textarea
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Paste IEP text here to run the demo extraction workflow."
              />
            </label>
            <Button
              variant="primary"
              icon={Sparkles}
              disabled={!can(state, "upload")}
              title={!can(state, "upload") ? "Current role cannot upload official IEP content." : undefined}
              onClick={() =>
                dispatch(
                  {
                    type: "addSourceDocument",
                    name: documentName,
                    documentType: documentTypeForName(documentName),
                    sourceText,
                    previewText: sourceFile?.previewText,
                    mimeType: sourceFile?.mimeType,
                    fileBase64: sourceFile?.base64
                  },
                  { title: "Source preserved", detail: "Demo extraction is ready for review." }
                )
              }
            >
              Preserve source and extract
            </Button>
            {activeDocument ? (
              <div className="source-card">
                <FileText size={18} />
                <div>
                  <strong>{activeDocument.name}</strong>
                  <span>{activeDocument.type} - uploaded by {activeDocument.uploadedBy} - preserved source</span>
                </div>
              </div>
            ) : (
              <EmptyState title="No source document" text="Create or select a student, then upload or paste an IEP source document for extraction." />
            )}
            {activeDocument?.originalFile ? (
              <div className="source-meta">
                <span>Original file</span>
                <strong>{formatBytes(activeDocument.originalFile.sizeBytes)}</strong>
                <small>SHA-256 {activeDocument.originalFile.sha256.slice(0, 12)}...</small>
              </div>
            ) : null}
            {activeDocument?.parseWarnings?.length ? (
              <div className="warning">
                {activeDocument.parseWarnings.map((warning) => <span key={warning}>{warning}</span>)}
              </div>
            ) : null}
            {activeDocument ? (
              <OcrReviewPanel
                document={activeDocument}
                dispatch={dispatch}
                disabled={!can(state, "editExtraction")}
                roleLabel={roles[state.user.role].label}
              />
            ) : null}
            <SourceMappingPanel
              document={activeDocument}
              section={mappedSection}
              dispatch={dispatch}
              disabled={!can(state, "editExtraction")}
              roleLabel={roles[state.user.role].label}
            />
          </Card>
          <Card title="Annotated source guidance" description="Field help from the tracked Pennsylvania annotated source.">
            <SourceGuidancePanel guidance={sourceGuidance} activeSection={mappedSection} />
          </Card>
        </div>
        <Card title="Structured extraction" description={`${visibleExtractionSections.length} sections detected with confidence and source links.`}>
          {!can(state, "editExtraction") ? (
            <AccessNotice text={`${roles[state.user.role].label} can review extracted sections but cannot edit or confirm official structured fields.`} />
          ) : null}
          <div className="schema-strip">
            <ShieldCheck size={15} />
            <span>
              Pennsylvania source alignment: {activeSourceAlignment.sourceRegistryVersion} · {activeSourceAlignment.sourceId}
            </span>
          </div>
          <div className="source-meta">
            <span>{activeSourceAlignment.jurisdiction} · {activeSourceAlignment.programArea}</span>
            <strong>{activeSourceAlignment.sourceForm}</strong>
            <small>
              {activeSourceAlignment.sourceFormType} · effective {formatDate(activeSourceAlignment.effectiveDate)}
              {activeSourceEntry?.retrievedDate ? ` · retrieved ${formatDate(activeSourceEntry.retrievedDate)}` : ""}
            </small>
          </div>
          <div className="extract-list">
            {visibleExtractionSections.length ? (
              visibleExtractionSections.map((section) => (
                <article
                  className={`extract-card ${section.status === "Confirmed" ? "confirmed" : ""} ${mappedSection?.id === section.id ? "mapped" : ""}`}
                  key={section.id}
                >
                  <div className="extract-head">
                    <div>
                      <strong>{section.title}</strong>
                      <span>{section.sourceSection} - {section.sourceReference}</span>
                    </div>
                    <Badge tone={section.confidence < 80 ? "amber" : "green"}>{section.confidence}%</Badge>
                  </div>
                  {editing === section.id ? (
                    <textarea
                      className="inline-editor"
                      value={section.content}
                      onChange={(event) =>
                        dispatch({ type: "editExtraction", sectionId: section.id, content: event.target.value })
                      }
                    />
                  ) : (
                    <p>{section.content}</p>
                  )}
                  {section.warning ? <p className="warning">{section.warning}</p> : null}
                  {section.rejectionReason ? <p className="card-note">Review flag: {section.rejectionReason}</p> : null}
                  {section.priorContent ? <p className="card-note">Prior extraction preserved: {section.priorContent}</p> : null}
                  {section.editedBy ? <p className="card-note">Edited by {section.editedBy} on {formatDate(section.editedAt)}</p> : null}
                  <div className="button-row">
                    <Button
                      icon={Eye}
                      variant={mappedSection?.id === section.id ? "soft" : "secondary"}
                      onClick={() => setMappedSectionId(section.id)}
                    >
                      Map source
                    </Button>
                    <Button
                      icon={Check}
                      variant={section.status === "Confirmed" ? "soft" : "primary"}
                      disabled={!can(state, "editExtraction")}
                      onClick={() =>
                        dispatch(
                          { type: "confirmExtraction", sectionId: section.id },
                          { title: "Section confirmed", detail: section.title }
                        )
                      }
                    >
                      {section.status}
                    </Button>
                    <Button
                      icon={Edit3}
                      disabled={!can(state, "editExtraction")}
                      onClick={() => setEditing(editing === section.id ? null : section.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      icon={Sparkles}
                      disabled={!can(state, "editExtraction")}
                      onClick={() =>
                        dispatch(
                          { type: "regenerateExtraction", sectionId: section.id },
                          { title: "Section regenerated", detail: section.title }
                        )
                      }
                    >
                      Regenerate
                    </Button>
                    <Button
                      icon={X}
                      disabled={!can(state, "editExtraction")}
                      onClick={() =>
                        dispatch(
                          {
                            type: "rejectExtraction",
                            sectionId: section.id,
                            reason: "Reviewer flagged this extraction for regeneration before approval."
                          },
                          { title: "Section rejected", detail: section.title }
                        )
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState title="No extraction sections" text="Upload or paste an IEP source document for this student to generate reviewable structured sections." />
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

function StudentProfileIntakeCard({ student, dispatch, disabled = false, roleLabel = "Current role" }) {
  const [firstName, setFirstName] = useState("Samira");
  const [lastName, setLastName] = useState("Patel");
  const [grade, setGrade] = useState("6");
  const [school, setSchool] = useState("Riverbend Middle School");
  const [supportAreas, setSupportAreas] = useState("Reading, written expression");
  const [annualReviewDate, setAnnualReviewDate] = useState("2026-08-15");
  const ready = firstName.trim() && lastName.trim() && grade.trim() && school.trim() && annualReviewDate;

  return (
    <Card title="Student profile intake" description="Create or select the student workspace before uploading source documents.">
      {student ? (
        <div className="source-card">
          <Users size={18} />
          <div>
            <strong>{student.firstName} {student.lastName}</strong>
            <span>{student.grade} · {student.school} · annual review {formatDate(student.annualReviewDate)}</span>
          </div>
        </div>
      ) : (
        <EmptyState title="No selected student" text="Create a student profile or select one from the dashboard caseload." />
      )}
      {disabled ? (
        <AccessNotice text={`${roleLabel} can select assigned student workspaces but cannot create new student profiles.`} />
      ) : null}
      <div className="mini-form-grid">
        <label className="field">
          <span>Student first name</span>
          <input
            aria-label="Student first name"
            value={firstName}
            disabled={disabled}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Student last name</span>
          <input
            aria-label="Student last name"
            value={lastName}
            disabled={disabled}
            onChange={(event) => setLastName(event.target.value)}
          />
        </label>
      </div>
      <div className="mini-form-grid">
        <label className="field">
          <span>Student grade</span>
          <input
            aria-label="Student grade"
            value={grade}
            disabled={disabled}
            onChange={(event) => setGrade(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Student school</span>
          <input
            aria-label="Student school"
            value={school}
            disabled={disabled}
            onChange={(event) => setSchool(event.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span>Student support areas</span>
        <input
          aria-label="Student support areas"
          value={supportAreas}
          disabled={disabled}
          onChange={(event) => setSupportAreas(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Student annual review date</span>
        <input
          type="date"
          aria-label="Student annual review date"
          value={annualReviewDate}
          disabled={disabled}
          onChange={(event) => setAnnualReviewDate(event.target.value)}
        />
      </label>
      <Button
        icon={Plus}
        variant="primary"
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "createStudentProfile",
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              grade: grade.trim(),
              school: school.trim(),
              supportAreas: supportAreas.trim(),
              annualReviewDate
            },
            { title: "Student profile created", detail: `${firstName.trim()} ${lastName.trim()} is ready for source intake.` }
          )
        }
      >
        Create student profile
      </Button>
      <p className="card-note">New profiles start as draft intake scaffolds until an IEP source is uploaded, extracted, and approved by authorized staff.</p>
    </Card>
  );
}

function SourceMappingPanel({ document, section, dispatch, disabled = false, roleLabel = "Current role" }) {
  const mapping = sourceMappingForSection(document, section);
  if (!section) {
    return (
      <div className="paper">
        <h3>Individualized Education Program</h3>
        <p>{document?.sourceText || "No preserved source text is available."}</p>
      </div>
    );
  }
  return (
    <div className="source-map-panel">
      <div className="source-map-summary">
        <div>
          <span>Source-to-field mapping</span>
          <strong>{section.title}</strong>
          <small>{section.key} · {section.sourceSection}</small>
        </div>
        <Badge tone={section.confidence < 80 ? "amber" : "green"}>{section.confidence}% confidence</Badge>
      </div>
      <div className="mapping-grid">
        <div className="source-step tall">
          <span>Source reference</span>
          <strong>{section.sourceReference}</strong>
          <small>{mapping.matchedBy}</small>
        </div>
        <div className="source-step tall">
          <span>Structured field</span>
          <strong>{section.status}</strong>
          <small>{section.content}</small>
        </div>
      </div>
      <div className="paper mapped-source">
        <h3>Highlighted source excerpt</h3>
        <SourceTextWithHighlight text={document?.sourceText || ""} matchText={mapping.matchText} />
      </div>
      {document?.sourceSegments?.length ? (
        <div className="source-segment-list">
          {document.sourceSegments.slice(0, 5).map((segment) => {
            const active = mapping.segment?.id === segment.id || mapping.segment?.label === segment.label;
            const meta = sourceSegmentMeta(segment);
            return (
              <div className={`source-segment ${active ? "active" : ""}`} key={segment.id || segment.label}>
                <strong>{segment.label || "Source segment"}</strong>
                {meta ? <small>{meta}</small> : null}
                <span>{segment.excerpt || segment.text}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      <SourceAnchorReviewPanel
        section={section}
        mapping={mapping}
        dispatch={dispatch}
        disabled={disabled}
        roleLabel={roleLabel}
      />
    </div>
  );
}

function SourceAnchorReviewPanel({ section, mapping, dispatch, disabled = false, roleLabel = "Current role" }) {
  const review = section.sourceAnchorReview || null;
  return (
    <div className="source-quality-panel">
      <div className="source-map-summary">
        <div>
          <span>Source anchor review</span>
          <strong>{review?.precision || "Not reviewed"}</strong>
          <small>
            {review
              ? `Page ${review.pageNumber} · ${review.segmentLabel}`
              : "Record page, segment, and bounding-box traceability for this extracted field."}
          </small>
        </div>
        <Badge tone={review?.precision === "Needs remediation" ? "amber" : review ? "green" : "blue"}>
          {review?.precision || "Pending"}
        </Badge>
      </div>
      {review ? (
        <div className="list compact-list">
          <div className="question-row">
            <div>
              <strong>Reviewed source anchor</strong>
              <span>
                Box {review.boundingBox.x}%, {review.boundingBox.y}% · {review.boundingBox.width}% x {review.boundingBox.height}%
              </span>
              <span>{review.reviewerNote}</span>
              <small>{review.officialRecordImpact}</small>
              <small>Digest {shortHash(review.anchorDigest)} · {review.reviewedBy} · {formatDateTime(review.reviewedAt)}</small>
            </div>
          </div>
        </div>
      ) : null}
      {disabled ? (
        <AccessNotice text={`${roleLabel} can review source anchors but cannot update field-level source anchor records.`} />
      ) : null}
      <SourceAnchorReviewForm section={section} mapping={mapping} review={review} dispatch={dispatch} disabled={disabled} />
    </div>
  );
}

function SourceAnchorReviewForm({ section, mapping, review, dispatch, disabled = false }) {
  const defaultSegmentLabel = mapping?.segment?.label || section.sourceReference || "Source segment";
  const defaultPageNumber = mapping?.segment?.pageNumber || review?.pageNumber || 1;
  const [precision, setPrecision] = useState(review?.precision || "Bounding box");
  const [pageNumber, setPageNumber] = useState(review?.pageNumber || defaultPageNumber);
  const [segmentLabel, setSegmentLabel] = useState(review?.segmentLabel || defaultSegmentLabel);
  const [anchorX, setAnchorX] = useState(review?.boundingBox?.x ?? 8);
  const [anchorY, setAnchorY] = useState(review?.boundingBox?.y ?? 12);
  const [anchorWidth, setAnchorWidth] = useState(review?.boundingBox?.width ?? 84);
  const [anchorHeight, setAnchorHeight] = useState(review?.boundingBox?.height ?? 12);
  const [reviewerNote, setReviewerNote] = useState(
    review?.reviewerNote || "Reviewer confirmed this extracted field against the highlighted preserved source region."
  );

  useEffect(() => {
    const nextSegmentLabel = mapping?.segment?.label || section.sourceReference || "Source segment";
    const nextPageNumber = mapping?.segment?.pageNumber || 1;
    setPrecision(review?.precision || "Bounding box");
    setPageNumber(review?.pageNumber || nextPageNumber);
    setSegmentLabel(review?.segmentLabel || nextSegmentLabel);
    setAnchorX(review?.boundingBox?.x ?? 8);
    setAnchorY(review?.boundingBox?.y ?? 12);
    setAnchorWidth(review?.boundingBox?.width ?? 84);
    setAnchorHeight(review?.boundingBox?.height ?? 12);
    setReviewerNote(review?.reviewerNote || "Reviewer confirmed this extracted field against the highlighted preserved source region.");
  }, [
    section.id,
    section.sourceReference,
    mapping?.segment?.label,
    mapping?.segment?.pageNumber,
    review?.precision,
    review?.pageNumber,
    review?.segmentLabel,
    review?.boundingBox?.x,
    review?.boundingBox?.y,
    review?.boundingBox?.width,
    review?.boundingBox?.height,
    review?.reviewerNote
  ]);

  const ready = segmentLabel.trim() && reviewerNote.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Anchor precision</span>
        <select
          aria-label="Anchor precision"
          value={precision}
          disabled={disabled}
          onChange={(event) => setPrecision(event.target.value)}
        >
          {sourceAnchorPrecisionOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Anchor page number</span>
        <input
          aria-label="Anchor page number"
          type="number"
          min="1"
          value={pageNumber}
          disabled={disabled}
          onChange={(event) => setPageNumber(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Anchor segment label</span>
        <input
          aria-label="Anchor segment label"
          value={segmentLabel}
          disabled={disabled}
          onChange={(event) => setSegmentLabel(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Anchor x percent</span>
        <input
          aria-label="Anchor x percent"
          type="number"
          min="0"
          max="100"
          value={anchorX}
          disabled={disabled}
          onChange={(event) => setAnchorX(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Anchor y percent</span>
        <input
          aria-label="Anchor y percent"
          type="number"
          min="0"
          max="100"
          value={anchorY}
          disabled={disabled}
          onChange={(event) => setAnchorY(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Anchor width percent</span>
        <input
          aria-label="Anchor width percent"
          type="number"
          min="0"
          max="100"
          value={anchorWidth}
          disabled={disabled}
          onChange={(event) => setAnchorWidth(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Anchor height percent</span>
        <input
          aria-label="Anchor height percent"
          type="number"
          min="0"
          max="100"
          value={anchorHeight}
          disabled={disabled}
          onChange={(event) => setAnchorHeight(event.target.value)}
        />
      </label>
      <label className="field wide">
        <span>Source anchor reviewer note</span>
        <textarea
          aria-label="Source anchor reviewer note"
          value={reviewerNote}
          disabled={disabled}
          onChange={(event) => setReviewerNote(event.target.value)}
        />
      </label>
      <Button
        variant="secondary"
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "updateSourceAnchorReview",
              sectionId: section.id,
              precision,
              pageNumber,
              segmentLabel: segmentLabel.trim(),
              anchorX,
              anchorY,
              anchorWidth,
              anchorHeight,
              reviewerNote: reviewerNote.trim()
            },
            { title: "Source anchor review recorded", detail: section.title }
          )
        }
      >
        Record source anchor review
      </Button>
    </div>
  );
}

function OcrReviewPanel({ document, dispatch, disabled = false, roleLabel = "Current role" }) {
  if (!document) {
    return (
      <div className="source-quality-panel">
        <EmptyState title="OCR/source quality pending" text="Preserve a source document before reviewing OCR or embedded-text quality." />
      </div>
    );
  }
  const review = document.ocrReview || defaultOcrReview(document);
  return (
    <div className="source-quality-panel">
      <div className="source-map-summary">
        <div>
          <span>OCR/source quality review</span>
          <strong>{review.status}</strong>
          <small>
            Confidence {review.confidence || 0}% · {document.extractionMethod || "source extraction method pending"}
          </small>
        </div>
        <Badge tone={ocrReviewTone(review.status)}>{review.status}</Badge>
      </div>
      <div className="list compact-list">
        <div className="question-row">
          <div>
            <strong>Source quality decision</strong>
            {document.parseWarnings?.length ? <span>{document.parseWarnings.join(" ")}</span> : <span>No parser warnings are active for this document.</span>}
            {review.reviewedTextExcerpt ? <span>Reviewed excerpt: {review.reviewedTextExcerpt}</span> : null}
            {review.reviewerNote ? <span>Reviewer note: {review.reviewerNote}</span> : null}
            {review.reviewedBy ? <small>Reviewed by {review.reviewedBy} on {formatDateTime(review.reviewedAt)} · digest {shortHash(review.ocrDigest)}</small> : null}
            <small>{review.officialRecordImpact}</small>
          </div>
        </div>
      </div>
      {disabled ? (
        <AccessNotice text={`${roleLabel} can review OCR/source quality but cannot update OCR review records.`} />
      ) : null}
      <OcrReviewForm document={document} review={review} dispatch={dispatch} disabled={disabled} />
    </div>
  );
}

function OcrReviewForm({ document, review, dispatch, disabled = false }) {
  const [status, setStatus] = useState(review.status || "Embedded text accepted");
  const [confidence, setConfidence] = useState(review.confidence || 80);
  const [reviewedTextExcerpt, setReviewedTextExcerpt] = useState(
    review.reviewedTextExcerpt || document.sourceText?.slice(0, 180) || "Reviewed OCR or embedded text excerpt."
  );
  const [reviewerNote, setReviewerNote] = useState(
    review.reviewerNote || "Confirm whether embedded text is sufficient or OCR remediation is required before extraction approval."
  );
  useEffect(() => {
    setStatus(review.status || "Embedded text accepted");
    setConfidence(review.confidence || 80);
    setReviewedTextExcerpt(review.reviewedTextExcerpt || document.sourceText?.slice(0, 180) || "Reviewed OCR or embedded text excerpt.");
    setReviewerNote(review.reviewerNote || "Confirm whether embedded text is sufficient or OCR remediation is required before extraction approval.");
  }, [document.id, document.sourceText, review.status, review.confidence, review.reviewedTextExcerpt, review.reviewerNote]);
  return (
    <div className="meeting-input">
      <label className="field">
        <span>OCR review status</span>
        <select
          aria-label="OCR review status"
          value={status}
          disabled={disabled}
          onChange={(event) => setStatus(event.target.value)}
        >
          {ocrReviewStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>OCR confidence</span>
        <input
          aria-label="OCR confidence"
          type="number"
          min="0"
          max="100"
          value={confidence}
          disabled={disabled}
          onChange={(event) => setConfidence(event.target.value)}
        />
      </label>
      <label className="field wide">
        <span>Reviewed text excerpt</span>
        <textarea
          aria-label="Reviewed text excerpt"
          value={reviewedTextExcerpt}
          disabled={disabled}
          onChange={(event) => setReviewedTextExcerpt(event.target.value)}
        />
      </label>
      <label className="field wide">
        <span>OCR reviewer note</span>
        <textarea
          aria-label="OCR reviewer note"
          value={reviewerNote}
          disabled={disabled}
          onChange={(event) => setReviewerNote(event.target.value)}
        />
      </label>
      <Button
        variant="secondary"
        icon={ShieldCheck}
        disabled={disabled}
        onClick={() =>
          dispatch(
            {
              type: "updateOcrReview",
              documentId: document.id,
              status,
              confidence,
              reviewedTextExcerpt: reviewedTextExcerpt.trim(),
              reviewerNote: reviewerNote.trim()
            },
            { title: "OCR/source review recorded", detail: document.name }
          )
        }
      >
        Record OCR review
      </Button>
    </div>
  );
}

function SourceGuidancePanel({ guidance = [], activeSection = null, compact = false }) {
  const activeGuidance = sourceGuidanceForSection(guidance, activeSection);
  const orderedGuidance = activeGuidance
    ? [activeGuidance, ...guidance.filter((item) => item.id !== activeGuidance.id)]
    : guidance;
  const visibleGuidance = orderedGuidance.slice(0, compact ? 3 : 4);

  if (!visibleGuidance.length) {
    return <EmptyState title="No source guidance" text="No field-help guidance is available from the current source registry." />;
  }

  return (
    <div className="source-guidance-list">
      {visibleGuidance.map((item) => {
        const active = activeGuidance?.id === item.id;
        const prompts = compact ? item.validationPrompts.slice(0, 2) : item.validationPrompts;
        return (
          <article className={`guidance-row ${active ? "active" : ""}`} key={item.id}>
            <div className="guidance-head">
              <HelpCircle size={16} />
              <div>
                <strong>{item.section}</strong>
                <span>{item.sourceTitle}</span>
              </div>
              <Badge tone={active ? "blue" : sourceRegistryReviewTone(item.reviewStatus)}>
                {active ? "Selected field" : item.reviewStatus}
              </Badge>
            </div>
            <p>{item.fieldHelp}</p>
            <div className="guidance-prompts">
              <strong>Validation prompts</strong>
              <ul>
                {prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
              </ul>
            </div>
            <div className="note muted">
              <strong>Review prompt</strong>
              <span>{item.reviewPrompt}</span>
            </div>
            {!compact ? (
              <small className="guidance-guardrail">Drafting guardrail: {item.draftingGuardrail}</small>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function SourceTextWithHighlight({ text, matchText }) {
  const source = String(text || "");
  const match = String(matchText || "").trim();
  if (!source) return <p>No preserved source text is available.</p>;
  if (!match) return <p>{source}</p>;
  const index = source.toLowerCase().indexOf(match.toLowerCase());
  if (index === -1) {
    return (
      <p>
        <mark>{match}</mark>
      </p>
    );
  }
  return (
    <p>
      {source.slice(0, index)}
      <mark>{source.slice(index, index + match.length)}</mark>
      {source.slice(index + match.length)}
    </p>
  );
}

function SummaryView({ state, roleView, setRoleView, navigate, dispatch, exportRecord, notify }) {
  const summary = state.summaries[roleView];
  const hasApprovedRecord = currentStudentHasApprovedRecord(state);
  const hasCurrentSummary = Boolean(hasApprovedRecord && summary?.sections?.length);
  const shareAllowed = hasCurrentSummary && canShareSummary(state, roleView);
  const coverageItems = hasCurrentSummary ? summaryCoverageItemsForWorkspace(state, roleView) : [];
  const handouts = (state.summaryHandouts || []).filter(
    (handout) => handout.audience === roleView && handout.studentId === state.currentStudentId
  );
  const iepComparisons = visibleIepComparisonsForState(state);
  const comprehensionChecks = visibleSummaryComprehensionChecksForState(state).filter((check) => check.audience === roleView);
  const canSubmitComprehension = hasCurrentSummary && canSubmitSummaryComprehension(state, roleView);
  const canReviewComprehension = comprehensionChecks.length > 0 && can(state, "reviewComprehensionCheck");
  const shareTitle = !shareAllowed ? `${roles[state.user.role].label} cannot generate or share this audience summary.` : undefined;
  const copySummary = async () => {
    if (!hasCurrentSummary) return;
    try {
      await copyToClipboard(summaryToClipboardText(summary, roleView));
      await dispatch(
        { type: "recordSummaryCopy", audience: roleView },
        { title: "Summary copied", detail: `${summary.label} summary copied to clipboard.` }
      );
    } catch (error) {
      notify("Copy blocked", error.message || "The browser did not allow clipboard access.");
    }
  };
  return (
    <section className="page">
      <PageHead
        label="One plan, different lenses"
        title="Make the IEP understandable without changing its meaning."
        description="Role views adapt language, emphasis, and actions while preserving fidelity to the approved structured record."
        actions={
          <>
            <Button
              icon={Copy}
              disabled={!shareAllowed}
              title={shareTitle}
              onClick={copySummary}
            >
              Copy summary
            </Button>
            <Button
              icon={FileText}
              disabled={!shareAllowed}
              title={shareTitle}
              onClick={() =>
                dispatch(
                  { type: "generateSummaryHandout", audience: roleView },
                  { title: "Meeting handout generated", detail: `${summary.label} handout added to the workspace.` }
                )
              }
            >
              Generate meeting handout
            </Button>
            <Button
              icon={Download}
              disabled={!shareAllowed}
              title={shareTitle}
              onClick={() => exportRecord(`${summary.label} summary`, { ...summary, coverageItems })}
            >
              Export summary
            </Button>
          </>
        }
      />
      <Tabs active="summary" navigate={navigate} />
      <div className="rolebar" role="tablist" aria-label="Summary audience">
        {Object.keys(state.summaries).map((key) => (
          <button className={roleView === key ? "active" : ""} type="button" key={key} onClick={() => setRoleView(key)}>
            {state.summaries[key].label}
          </button>
        ))}
      </div>
      <div className="summary-layout">
        <Card
          title={hasCurrentSummary ? summary.title : "Role summary pending"}
          description={hasCurrentSummary ? `${summary.label} - current through July 1, 2026` : "Approve this student's source extraction before generating role-specific summary language."}
        >
          {hasCurrentSummary ? (
            <div className="summary-doc">
              {summary.sections.map((section) => (
                <section key={section.heading}>
                  <h3>{section.heading}</h3>
                  {section.text ? <p>{section.text}</p> : null}
                  {section.bullets ? (
                    <ul>
                      {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                    </ul>
                  ) : null}
                  {section.sourceReference ? <small>Source: {section.sourceReference}</small> : null}
                </section>
              ))}
            </div>
          ) : (
            <EmptyState title="No approved summary" text="Role-specific summaries will appear after a human-reviewed source extraction is approved for this student." />
          )}
        </Card>
        <div className="stack">
          <Card title="Source fidelity" description="What the recipient can trust.">
            <div className="note">
              <strong>Grounded in approved IEP content</strong>
              <span>This view can simplify language and reorganize information, but it does not add services, change conditions, or make placement decisions.</span>
            </div>
          </Card>
          <Card title="Audience coverage" description="FDS-required ingredients for the selected summary lens.">
            {coverageItems.length ? (
              <div className="list">
                {coverageItems.map((item) => (
                  <div className="question-row" key={item.label}>
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.detail}</span>
                      <small>Source: {item.sourceReference}</small>
                    </div>
                    <Badge tone={summaryCoverageTone(item.status)}>{item.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Coverage pending" text="Approve this student's source extraction before coverage can be checked." />
            )}
          </Card>
          <Card title="Question prompts" description="Supports meaningful participation.">
            <div className="list">
              {questionsForRole(roleView).map((question) => <div className="question" key={question}>{question}</div>)}
            </div>
          </Card>
          <Card title="Understanding checks" description="Section-specific comprehension status and team follow-up.">
            <div className="list">
              {comprehensionChecks.length ? (
                comprehensionChecks.map((check) => (
                  <div className="question-row" key={check.id}>
                    <div>
                      <strong>{check.sectionHeading}</strong>
                      <span>{check.questionOrNote}</span>
                      <span>Follow-up: {check.preferredFollowUp}</span>
                      {check.staffResponse ? <span>Response: {check.staffResponse}</span> : null}
                      {check.nextStep ? <span>Next step: {check.nextStep}</span> : null}
                      <small>
                        Submitted by {check.submittedBy} · {roles[check.submittedByRole]?.label || check.submittedByRole} · {check.language}
                      </small>
                      <small>Source: {check.sourceReference}</small>
                      <small>{check.officialRecordImpact}</small>
                    </div>
                    <div className="badge-stack">
                      <Badge tone={summaryComprehensionTone(check.understandingStatus)}>{check.understandingStatus}</Badge>
                      <Badge tone={summaryComprehensionTone(check.reviewStatus)}>{check.reviewStatus}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="No understanding checks" text="No family or student understanding checks have been recorded for this summary lens." />
              )}
            </div>
            {!canSubmitComprehension ? (
              <AccessNotice text={`${roles[state.user.role].label} can review visible checks but cannot submit an understanding check for this summary lens.`} />
            ) : null}
            <SummaryComprehensionCheckForm
              audience={roleView}
              sections={summary?.sections || []}
              dispatch={dispatch}
              disabled={!canSubmitComprehension}
            />
            {!can(state, "reviewComprehensionCheck") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review understanding status but cannot record the team response.`} />
            ) : null}
            <SummaryComprehensionReviewForm
              checks={comprehensionChecks}
              dispatch={dispatch}
              disabled={!canReviewComprehension}
            />
          </Card>
          <Card title="IEP version comparison" description="Review what changed from the previous IEP before sharing meeting language.">
            <div className="list">
              {iepComparisons.length ? (
                iepComparisons.map((comparison) => (
                  <div className="question-row" key={comparison.id}>
                    <div>
                      <strong>{comparison.title}</strong>
                      <span>{comparison.changeType} · {comparison.section}</span>
                      <span>{comparison.familySummary}</span>
                      <small>{comparison.sourceReference}</small>
                      {comparison.versionIntake ? (
                        <small>
                          Version intake: {comparison.versionIntake.intakeMethod} · {comparison.versionIntake.createdBy} · {formatDateTime(comparison.versionIntake.createdAt)}
                        </small>
                      ) : null}
                      {comparison.amendmentReviewStatus ? (
                        <small>Amendment review: {comparison.amendmentReviewStatus} · {comparison.amendmentNote}</small>
                      ) : null}
                      {comparison.reviewNote ? <small>Review note: {comparison.reviewNote}</small> : null}
                      <small>{comparison.officialRecordImpact}</small>
                    </div>
                    <Badge tone={iepComparisonTone(comparison.status)}>{comparison.status}</Badge>
                  </div>
                ))
              ) : (
                <EmptyState title="No comparison items" text="No prior/current IEP comparisons are visible for this role." />
              )}
            </div>
            {!can(state, "reviewIepComparison") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review comparison language but cannot add or mark version-comparison items reviewed.`} />
            ) : null}
            <IepComparisonAutoDiffForm
              dispatch={dispatch}
              disabled={!can(state, "reviewIepComparison")}
            />
            <IepComparisonIntakeForm
              dispatch={dispatch}
              disabled={!can(state, "reviewIepComparison")}
            />
            <IepComparisonReviewForm
              comparisons={iepComparisons}
              dispatch={dispatch}
              disabled={!can(state, "reviewIepComparison")}
            />
          </Card>
          <Card title="Meeting handouts" description="Generated from the selected summary lens and preserved for the team.">
            {handouts.length ? (
              <div className="list">
                {handouts.slice(0, 3).map((handout) => (
                  <div className="question" key={handout.id}>
                    <strong>{handout.label}</strong>
                    <span>{handout.sections.length} sections · {handout.questions.length} prompts</span>
                    <small>Prepared by {handout.createdBy} · {formatDate(handout.createdAt)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No handout yet" text="No meeting handout has been generated for this audience." />
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}

function visibleIepComparisonsForState(state) {
  const role = state.user.role;
  return (state.iepComparisons || []).filter((comparison) => {
    if (comparison.studentId !== state.currentStudentId) return false;
    if (["caseManager", "administrator", "schoolAdministrator", "districtAdministrator", "generalEducation", "relatedServiceProvider"].includes(role)) return true;
    if (role === "parent") return comparison.familyVisible !== false;
    if (role === "student") return comparison.studentVisible === true;
    return false;
  });
}

function visibleMeetingTranscriptSummariesForState(state) {
  const role = state.user.role;
  return (state.meetingTranscriptSummaries || []).filter((summary) => {
    if (summary.studentId !== state.currentStudentId) return false;
    if (["caseManager", "administrator", "schoolAdministrator", "districtAdministrator", "generalEducation", "relatedServiceProvider"].includes(role)) return true;
    if (role === "parent") return summary.familyVisible !== false;
    if (role === "student") return summary.studentVisible === true;
    return false;
  });
}

function visibleMeetingRecordingReviewsForState(state) {
  const role = state.user.role;
  return (state.meetingRecordingReviews || []).filter((review) => {
    if (review.studentId !== state.currentStudentId) return false;
    if (["caseManager", "administrator", "schoolAdministrator", "districtAdministrator", "generalEducation", "relatedServiceProvider"].includes(role)) return true;
    if (role === "parent") return review.familyVisible !== false;
    if (role === "student") return review.studentVisible === true;
    return false;
  });
}

function visibleSummaryComprehensionChecksForState(state) {
  const role = state.user.role;
  return (state.summaryComprehensionChecks || []).filter((check) => {
    if (check.studentId !== state.currentStudentId) return false;
    if (["caseManager", "administrator", "schoolAdministrator", "districtAdministrator", "generalEducation", "relatedServiceProvider", "readOnlyReviewer"].includes(role)) return true;
    return summaryAudienceForRole(role) === check.audience;
  });
}

function summaryComprehensionTone(status = "") {
  if (/understood|closed|recorded/i.test(status)) return "green";
  if (/interpreter/i.test(status)) return "purple";
  if (/follow|needs|awaiting/i.test(status)) return "amber";
  return "blue";
}

function SummaryComprehensionCheckForm({ audience, sections = [], dispatch, disabled = false }) {
  const [sectionHeading, setSectionHeading] = useState(sections[0]?.heading || "");
  const [understandingStatus, setUnderstandingStatus] = useState("Needs explanation");
  const [language, setLanguage] = useState("English");
  const [questionOrNote, setQuestionOrNote] = useState("Please explain this part before the meeting.");
  const [preferredFollowUp, setPreferredFollowUp] = useState("Review with the IEP team before the meeting packet is finalized.");

  useEffect(() => {
    if (!sections.length) {
      setSectionHeading("");
      return;
    }
    if (!sections.some((section) => section.heading === sectionHeading)) {
      setSectionHeading(sections[0].heading);
    }
  }, [sections, sectionHeading]);

  const ready = audience && sectionHeading && questionOrNote.trim();
  return (
    <div className="meeting-input">
      <label className="field">
        <span>Understanding summary section</span>
        <select
          aria-label="Understanding summary section"
          value={sectionHeading}
          disabled={disabled || sections.length === 0}
          onChange={(event) => setSectionHeading(event.target.value)}
        >
          {sections.length ? (
            sections.map((section) => <option value={section.heading} key={section.heading}>{section.heading}</option>)
          ) : (
            <option value="">No summary sections</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Understanding status</span>
        <select
          aria-label="Understanding status"
          value={understandingStatus}
          disabled={disabled}
          onChange={(event) => setUnderstandingStatus(event.target.value)}
        >
          {summaryUnderstandingStatusOptions.map((status) => <option value={status} key={status}>{status}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Check language</span>
        <select
          aria-label="Check language"
          value={language}
          disabled={disabled}
          onChange={(event) => setLanguage(event.target.value)}
        >
          {["English", "Spanish", "Arabic", "Chinese", "Vietnamese"].map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Understanding question or note</span>
        <textarea
          aria-label="Understanding question or note"
          value={questionOrNote}
          disabled={disabled}
          onChange={(event) => setQuestionOrNote(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Preferred follow-up</span>
        <textarea
          aria-label="Preferred follow-up"
          value={preferredFollowUp}
          disabled={disabled}
          onChange={(event) => setPreferredFollowUp(event.target.value)}
        />
      </label>
      <Button
        variant="primary"
        icon={Check}
        disabled={disabled || !ready}
        onClick={() => {
          dispatch(
            {
              type: "submitSummaryComprehensionCheck",
              audience,
              sectionHeading,
              understandingStatus,
              language,
              questionOrNote: questionOrNote.trim(),
              preferredFollowUp: preferredFollowUp.trim()
            },
            { title: "Understanding check submitted", detail: "Summary section check saved for team follow-up." }
          );
          setQuestionOrNote("");
        }}
      >
        Record understanding check
      </Button>
    </div>
  );
}

function SummaryComprehensionReviewForm({ checks = [], dispatch, disabled = false }) {
  const openChecks = checks.filter((check) => check.reviewStatus !== "Closed");
  const [checkId, setCheckId] = useState(openChecks[0]?.id || "");
  const selected = openChecks.find((check) => check.id === checkId) || openChecks[0] || null;
  const [reviewStatus, setReviewStatus] = useState(selected?.reviewStatus || "Team response recorded");
  const [response, setResponse] = useState(selected?.staffResponse || "The team will review this section and answer the family question.");
  const [nextStep, setNextStep] = useState(selected?.nextStep || "Case manager will follow up before the meeting.");

  useEffect(() => {
    if (!openChecks.length) {
      setCheckId("");
      return;
    }
    if (!openChecks.some((check) => check.id === checkId)) {
      setCheckId(openChecks[0].id);
    }
  }, [openChecks, checkId]);

  useEffect(() => {
    if (!selected) return;
    setReviewStatus(selected.reviewStatus === "Awaiting team response" ? "Team response recorded" : selected.reviewStatus);
    setResponse(selected.staffResponse || "The team will review this section and answer the family question.");
    setNextStep(selected.nextStep || "Case manager will follow up before the meeting.");
  }, [selected]);

  const ready = checkId && response.trim() && nextStep.trim();
  return (
    <div className="meeting-input">
      <label className="field">
        <span>Understanding check</span>
        <select
          aria-label="Understanding check"
          value={checkId}
          disabled={disabled || openChecks.length === 0}
          onChange={(event) => setCheckId(event.target.value)}
        >
          {openChecks.length ? (
            openChecks.map((check) => <option value={check.id} key={check.id}>{check.sectionHeading}</option>)
          ) : (
            <option value="">No open checks</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Understanding review status</span>
        <select
          aria-label="Understanding review status"
          value={reviewStatus}
          disabled={disabled || !checkId}
          onChange={(event) => setReviewStatus(event.target.value)}
        >
          {summaryComprehensionReviewStatusOptions.map((status) => <option value={status} key={status}>{status}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Understanding response</span>
        <textarea
          aria-label="Understanding response"
          value={response}
          disabled={disabled || !checkId}
          onChange={(event) => setResponse(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Understanding next step</span>
        <textarea
          aria-label="Understanding next step"
          value={nextStep}
          disabled={disabled || !checkId}
          onChange={(event) => setNextStep(event.target.value)}
        />
      </label>
      <Button
        icon={MessageSquare}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "reviewSummaryComprehensionCheck",
              checkId,
              reviewStatus,
              response: response.trim(),
              nextStep: nextStep.trim()
            },
            { title: "Understanding response recorded", detail: "Family summary follow-up saved." }
          )
        }
      >
        Record understanding response
      </Button>
    </div>
  );
}

function IepComparisonAutoDiffForm({ dispatch, disabled = false }) {
  const [previousDocumentLabel, setPreviousDocumentLabel] = useState("Previous IEP draft");
  const [currentDocumentLabel, setCurrentDocumentLabel] = useState("Current IEP draft");
  const [previousText, setPreviousText] = useState(
    "Goal: Jordan will improve reading comprehension with teacher support. Service: Reading support 30 minutes weekly in a pull-out small group. Accommodation: Extended time as needed."
  );
  const [currentText, setCurrentText] = useState(
    "Goal: Jordan will answer literal and inferential questions with 80% accuracy across weekly probes. Service: Reading support 30 minutes weekly in the general education classroom. Accommodation: Extended time 1.5x for classroom assessments."
  );
  const ready = previousText.trim() && currentText.trim();

  return (
    <div className="meeting-input">
      <h3 className="section-title">Automated prior/current diff</h3>
      <label className="field">
        <span>Previous document label</span>
        <input
          aria-label="Previous document label"
          value={previousDocumentLabel}
          disabled={disabled}
          onChange={(event) => setPreviousDocumentLabel(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Current document label</span>
        <input
          aria-label="Current document label"
          value={currentDocumentLabel}
          disabled={disabled}
          onChange={(event) => setCurrentDocumentLabel(event.target.value)}
        />
      </label>
      <label className="field wide">
        <span>Previous IEP full text</span>
        <textarea
          aria-label="Previous IEP full text"
          value={previousText}
          disabled={disabled}
          onChange={(event) => setPreviousText(event.target.value)}
        />
      </label>
      <label className="field wide">
        <span>Current IEP full text</span>
        <textarea
          aria-label="Current IEP full text"
          value={currentText}
          disabled={disabled}
          onChange={(event) => setCurrentText(event.target.value)}
        />
      </label>
      <Button
        icon={Search}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "autoGenerateIepComparisons",
              previousDocumentLabel: previousDocumentLabel.trim() || "Previous IEP text",
              currentDocumentLabel: currentDocumentLabel.trim() || "Current IEP text",
              previousText: previousText.trim(),
              currentText: currentText.trim()
            },
            {
              title: "IEP auto-diff candidates generated",
              detail: "Prior/current IEP changes are ready for human review."
            }
          )
        }
      >
        Generate comparison candidates
      </Button>
    </div>
  );
}

function IepComparisonIntakeForm({ dispatch, disabled = false }) {
  const [section, setSection] = useState("Goals and progress monitoring");
  const [changeType, setChangeType] = useState("Prior/current language comparison");
  const [title, setTitle] = useState("New prior/current IEP comparison");
  const [previousText, setPreviousText] = useState(
    "Previous IEP language did not clearly state the measurement method or implementation responsibility."
  );
  const [currentText, setCurrentText] = useState(
    "Current IEP language names the measurement method, responsible role, and source-aligned implementation follow-up."
  );
  const [implementationImpact, setImplementationImpact] = useState(
    "Staff can confirm whether the changed language affects classroom responsibilities, progress monitoring, or meeting questions."
  );
  const [familySummary, setFamilySummary] = useState(
    "The team should explain what changed and confirm whether any official IEP amendment or meeting action is needed."
  );
  const [sourceReference, setSourceReference] = useState("Prior/current IEP version intake");
  const [amendmentReviewStatus, setAmendmentReviewStatus] = useState("Amendment review needed");
  const [amendmentNote, setAmendmentNote] = useState(
    "This comparison is advisory; the IEP team must decide whether district amendment procedures are required."
  );
  const [familyVisible, setFamilyVisible] = useState(true);
  const [studentVisible, setStudentVisible] = useState(false);
  const ready =
    section.trim() &&
    changeType.trim() &&
    title.trim() &&
    previousText.trim() &&
    currentText.trim() &&
    implementationImpact.trim() &&
    familySummary.trim() &&
    amendmentNote.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Comparison section</span>
        <select
          aria-label="Comparison section"
          value={section}
          disabled={disabled}
          onChange={(event) => setSection(event.target.value)}
        >
          {[
            "Present levels",
            "Goals and progress monitoring",
            "Services",
            "Accommodations",
            "Assessment accommodations",
            "Behavior support",
            "Transition services",
            "Educational placement",
            "Meeting information"
          ].map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Comparison change type</span>
        <input
          aria-label="Comparison change type"
          value={changeType}
          disabled={disabled}
          onChange={(event) => setChangeType(event.target.value)}
        />
      </label>
      <label className="field wide">
        <span>Comparison title</span>
        <input
          aria-label="Comparison title"
          value={title}
          disabled={disabled}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="field wide">
        <span>Previous IEP language</span>
        <textarea
          aria-label="Previous IEP language"
          value={previousText}
          disabled={disabled}
          onChange={(event) => setPreviousText(event.target.value)}
        />
      </label>
      <label className="field wide">
        <span>Current IEP language</span>
        <textarea
          aria-label="Current IEP language"
          value={currentText}
          disabled={disabled}
          onChange={(event) => setCurrentText(event.target.value)}
        />
      </label>
      <label className="field wide">
        <span>Comparison implementation impact</span>
        <textarea
          aria-label="Comparison implementation impact"
          value={implementationImpact}
          disabled={disabled}
          onChange={(event) => setImplementationImpact(event.target.value)}
        />
      </label>
      <label className="field wide">
        <span>Comparison family language</span>
        <textarea
          aria-label="Comparison family language"
          value={familySummary}
          disabled={disabled}
          onChange={(event) => setFamilySummary(event.target.value)}
        />
      </label>
      <label className="field wide">
        <span>Comparison source reference</span>
        <input
          aria-label="Comparison source reference"
          value={sourceReference}
          disabled={disabled}
          onChange={(event) => setSourceReference(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Amendment review status</span>
        <select
          aria-label="Amendment review status"
          value={amendmentReviewStatus}
          disabled={disabled}
          onChange={(event) => setAmendmentReviewStatus(event.target.value)}
        >
          {iepAmendmentReviewStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field wide">
        <span>Amendment review note</span>
        <textarea
          aria-label="Amendment review note"
          value={amendmentNote}
          disabled={disabled}
          onChange={(event) => setAmendmentNote(event.target.value)}
        />
      </label>
      <div className="stack">
        <label className="field check-field">
          <input
            type="checkbox"
            checked={familyVisible}
            disabled={disabled}
            onChange={(event) => setFamilyVisible(event.target.checked)}
          />
          <span>Make new comparison family-visible</span>
        </label>
        <label className="field check-field">
          <input
            type="checkbox"
            checked={studentVisible}
            disabled={disabled}
            onChange={(event) => setStudentVisible(event.target.checked)}
          />
          <span>Make new comparison student-visible</span>
        </label>
      </div>
      <Button
        icon={FileText}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "createIepComparison",
              section,
              changeType: changeType.trim(),
              title: title.trim(),
              previousText: previousText.trim(),
              currentText: currentText.trim(),
              implementationImpact: implementationImpact.trim(),
              familySummary: familySummary.trim(),
              sourceReference: sourceReference.trim(),
              amendmentReviewStatus,
              amendmentNote: amendmentNote.trim(),
              familyVisible,
              studentVisible
            },
            {
              title: "IEP comparison added",
              detail: "Prior/current IEP language captured for human review."
            }
          )
        }
      >
        Add IEP comparison
      </Button>
    </div>
  );
}

function IepComparisonReviewForm({ comparisons = [], dispatch, disabled = false }) {
  const [comparisonId, setComparisonId] = useState(comparisons[0]?.id || "");
  const selected = comparisons.find((comparison) => comparison.id === comparisonId) || comparisons[0] || null;
  const [status, setStatus] = useState(selected?.status || "Needs team review");
  const [reviewNote, setReviewNote] = useState(selected?.reviewNote || "Confirm this comparison before the meeting packet is shared.");
  const [familyVisible, setFamilyVisible] = useState(selected?.familyVisible !== false);
  const [studentVisible, setStudentVisible] = useState(Boolean(selected?.studentVisible));

  useEffect(() => {
    if (!comparisons.length) {
      setComparisonId("");
      return;
    }
    if (!comparisons.some((comparison) => comparison.id === comparisonId)) {
      setComparisonId(comparisons[0].id);
    }
  }, [comparisons, comparisonId]);

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.status || "Needs team review");
    setReviewNote(selected.reviewNote || "Confirm this comparison before the meeting packet is shared.");
    setFamilyVisible(selected.familyVisible !== false);
    setStudentVisible(Boolean(selected.studentVisible));
  }, [selected]);

  const ready = Boolean(selected && reviewNote.trim());

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Comparison item</span>
        <select
          aria-label="Comparison item"
          value={comparisonId}
          disabled={disabled || comparisons.length === 0}
          onChange={(event) => setComparisonId(event.target.value)}
        >
          {comparisons.map((comparison) => <option value={comparison.id} key={comparison.id}>{comparison.title}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Comparison review status</span>
        <select
          aria-label="Comparison review status"
          value={status}
          disabled={disabled || !selected}
          onChange={(event) => setStatus(event.target.value)}
        >
          {iepComparisonStatusOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Comparison review note</span>
        <textarea
          aria-label="Comparison review note"
          value={reviewNote}
          disabled={disabled || !selected}
          onChange={(event) => setReviewNote(event.target.value)}
        />
      </label>
      <div className="stack">
        <label className="field check-field">
          <input
            type="checkbox"
            checked={familyVisible}
            disabled={disabled || !selected}
            onChange={(event) => setFamilyVisible(event.target.checked)}
          />
          <span>Family-visible comparison</span>
        </label>
        <label className="field check-field">
          <input
            type="checkbox"
            checked={studentVisible}
            disabled={disabled || !selected}
            onChange={(event) => setStudentVisible(event.target.checked)}
          />
          <span>Student-visible comparison</span>
        </label>
      </div>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "reviewIepComparison",
              comparisonId,
              status,
              reviewNote: reviewNote.trim(),
              familyVisible,
              studentVisible
            },
            {
              title: "IEP comparison reviewed",
              detail: selected ? `${selected.title} comparison status saved.` : "Comparison review saved."
            }
          )
        }
      >
        Review IEP comparison
      </Button>
    </div>
  );
}

function ImplementationView({ state, dispatch, navigate, exportRecord }) {
  const [filter, setFilter] = useState("all");
  const currentTasks = currentStudentTasksForState(state);
  const currentDocuments = documentsForCurrentStudent(state);
  const tasks = currentTasks.filter((task) => filter === "all" || task.category === filter);
  const taskObservations = currentTasks
    .flatMap((task) => (task.observations || []).map((observation) => ({ ...observation, taskId: task.id, taskTitle: task.title })))
    .sort((a, b) => new Date(b.enteredAt || b.observedAt) - new Date(a.enteredAt || a.observedAt));
  return (
    <section className="page">
      <PageHead
        label="From document to daily practice"
        title="Turn each IEP obligation into a clear handoff."
        description="Staff see role-relevant responsibilities with source context, timing, acknowledgment, and evidence expectations."
        actions={
          <Button
            icon={Download}
            disabled={!can(state, "export")}
            title={!can(state, "export") ? "Current role cannot export teacher checklists." : undefined}
            onClick={() => exportRecord("Teacher checklist", teacherChecklistExport(state))}
          >
            Export teacher checklist
          </Button>
        }
      />
      <Tabs active="implementation" navigate={navigate} />
      {!can(state, "completeTask") ? (
        <AccessNotice text={`${roles[state.user.role].label} can review assigned responsibilities but cannot mark staff implementation tasks complete.`} />
      ) : null}
      <div className="filters">
        {[
          ["all", "All tasks"],
          ["caseManager", "Assigned to me"],
          ["generalEducation", "General education"],
          ["related", "Related services"]
        ].map(([key, label]) => (
          <button className={filter === key ? "active" : ""} type="button" key={key} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid two-one">
        <Card title="Implementation checklist" description="Generated from approved structured obligations.">
          <div className="task-list">
            {tasks.length ? (
              tasks.map((task) => (
                <article className={`task ${task.status === "Completed" ? "done" : ""}`} key={task.id}>
                  <button
                    className="task-check"
                    type="button"
                    disabled={!can(state, "completeTask")}
                    onClick={() =>
                      dispatch(
                        { type: "toggleTask", taskId: task.id },
                        { title: "Task updated", detail: task.title }
                      )
                    }
                    aria-label={`Toggle ${task.title}`}
                  >
                    {task.status === "Completed" ? <Check size={14} /> : null}
                  </button>
                  <div>
                    <strong>{task.title}</strong>
                    <p>{task.description}</p>
                    <div className="chips">
                      <span>{task.sourceSection}</span>
                      <span>{task.responsibleRole}</span>
                      <span>{(task.acknowledgments || []).length} acknowledgment{(task.acknowledgments || []).length === 1 ? "" : "s"}</span>
                      <span>{(task.observations || []).length} observation{(task.observations || []).length === 1 ? "" : "s"}</span>
                      {task.evidenceRequired ? <span>Evidence required</span> : null}
                      {task.completionEvidence?.evidenceLabel ? <span>Evidence: {task.completionEvidence.evidenceLabel}</span> : null}
                    </div>
                    {task.completionEvidence?.note ? (
                      <p className="card-note">Completion note: {task.completionEvidence.note}</p>
                    ) : null}
                    {task.observations?.[0] ? (
                      <p className="card-note">
                        Latest observation: {task.observations[0].context} - {task.observations[0].note}
                      </p>
                    ) : null}
                  </div>
                  <small>{task.dueDate}</small>
                </article>
              ))
            ) : (
              <EmptyState title="No implementation tasks" text="Approved obligations for this student will appear here after source review." />
            )}
          </div>
        </Card>
        <div className="stack">
          <Card title="Task evidence" description="Complete a responsibility with an implementation note and preserved evidence reference.">
            {!can(state, "completeTask") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review task evidence but cannot record implementation completion.`} />
            ) : null}
            <TaskCompletionForm
              tasks={currentTasks}
              documents={currentDocuments}
              dispatch={dispatch}
              disabled={!can(state, "completeTask")}
            />
          </Card>
          <Card title="Classroom observations" description="Add implementation notes without changing the official IEP obligation.">
            {!can(state, "recordObservation") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review classroom observations but cannot add staff implementation notes.`} />
            ) : null}
            {taskObservations.length ? (
              <div className="list">
                {taskObservations.slice(0, 4).map((observation) => (
                  <div className="question" key={observation.id}>
                    <strong>{observation.taskTitle}</strong>
                    <span>{observation.context} - {observation.note}</span>
                    <small>
                      {formatDate(observation.observedAt)} · {observation.supportUsed} · {observation.enteredBy}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No observations yet" text="Staff observations will appear here after they are recorded." />
            )}
            <TaskObservationForm
              tasks={currentTasks}
              dispatch={dispatch}
              disabled={!can(state, "recordObservation")}
            />
          </Card>
          <Card title="Staff handoff" description="Acknowledgment is visible but does not replace implementation evidence.">
            {!can(state, "acknowledgeTask") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review handoff status but cannot acknowledge staff responsibilities.`} />
            ) : null}
            <div className="handoff">
              {currentTasks.length ? (
                currentTasks.map((task) => {
                  const latest = task.acknowledgments?.[0];
                  return (
                  <div className="handoff-row" key={task.id}>
                    <span>{initials(task.assignedTo)}</span>
                    <div>
                      <strong>{task.assignedTo}</strong>
                      <small>
                        {latest
                          ? `${task.title} - acknowledged by ${latest.acknowledgedBy} ${formatDate(latest.acknowledgedAt)}`
                          : `${task.title} - acknowledgment pending`}
                      </small>
                      {latest?.note ? <small>{latest.note}</small> : null}
                    </div>
                    {latest ? <Check size={14} /> : <Clock3 size={14} />}
                  </div>
                  );
                })
              ) : (
                <EmptyState title="No handoff items" text="Staff acknowledgments will appear after this student's implementation checklist is available." />
              )}
            </div>
            <HandoffForm tasks={currentTasks} dispatch={dispatch} disabled={!can(state, "acknowledgeTask")} />
          </Card>
        </div>
      </div>
    </section>
  );
}

function ServicesView({ state, dispatch, navigate, exportRecord }) {
  const activeIep = activeIepForState(state);
  const structuredRecord = activeIep ? normalizeStructuredIepRecord(state, activeIep) : {};
  const services = activeIepItemsForState(state, "services");
  const accommodations = activeIepItemsForState(state, "accommodations");
  const accessSupportPlans = (state.accessSupportPlans || []).filter((support) => support.studentId === state.currentStudentId);
  const scheduledMinutes = sum(services, "scheduledMinutes");
  const deliveredMinutes = sum(services, "deliveredMinutes");
  return (
    <section className="page">
      <PageHead
        label="Implementation fidelity"
        title="See service gaps before they become surprises."
        description="Track scheduled and delivered services, document missed minutes, assign recovery actions, and retain an auditable explanation."
        actions={
            <Button
              icon={Download}
              disabled={!can(state, "export")}
              title={!can(state, "export") ? "Current role cannot export service reports." : undefined}
              onClick={() => exportRecord("Service delivery report", { services, accommodations })}
            >
              Monthly report
            </Button>
        }
      />
      <Tabs active="services" navigate={navigate} />
      <div className="metrics">
        <Metric label="Scheduled" value={`${scheduledMinutes} min`} note="Current month" icon={Clock3} />
        <Metric label="Delivered" value={`${deliveredMinutes} min`} note="Documented delivery" icon={Check} tone="green" />
        <Metric label="Gap" value={`${scheduledMinutes - deliveredMinutes} min`} note="Recovery needed" icon={AlertTriangle} tone="red" />
        <Metric label="Documentation" value={services.length ? "96%" : "0%"} note={services.length ? "One note pending" : "No service log"} icon={FileText} tone="blue" />
      </div>
      <div className="grid two-one">
        <Card title="Services and accommodations" description="Source terms preserved beside operational status.">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Requirement</th>
                <th>Implementation window</th>
                <th>Responsible role</th>
                <th>Evidence/logging</th>
              </tr>
            </thead>
            <tbody>
              {services.length || accommodations.length ? (
                <>
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td><strong>{service.serviceType}</strong><small>{service.sourceReference}</small></td>
                      <td>
                        {serviceDurationLabel(service.duration)} - {service.frequency} - {service.location}
                        <small>Source section: Services</small>
                      </td>
                      <td>{implementationWindowLabel(service)}</td>
                      <td>{service.providerRole}</td>
                      <td>
                        <Badge tone={recoveryTone(service.recoveryStatus)}>{service.recoveryStatus}</Badge>
                        <small>{service.loggingRequirement || "Service delivery logging required."}</small>
                        {service.recoveryPlan?.recoveryDate ? (
                          <small>Recovery: {formatDate(service.recoveryPlan.recoveryDate)} with {service.recoveryPlan.provider}</small>
                        ) : null}
                        {service.recoveryPlan?.familyCommunication ? (
                          <small>Family note: {service.recoveryPlan.familyCommunication}</small>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {accommodations.map((acc) => (
                    <tr key={acc.id}>
                      <td><strong>{acc.description}</strong><small>{acc.sourceReference}</small></td>
                      <td>
                        {acc.frequency} - {acc.setting}
                        <small>Source section: Accommodations</small>
                      </td>
                      <td>{implementationWindowLabel(acc)}</td>
                      <td>{acc.responsibleRole}</td>
                      <td>
                        <Badge tone={acc.ambiguity ? "amber" : "blue"}>{acc.ambiguity ? "Clarify" : "Active"}</Badge>
                        <small>{acc.evidenceRequired ? "Implementation evidence required." : "No separate evidence attachment required."}</small>
                      </td>
                    </tr>
                  ))}
                </>
              ) : (
                <tr>
                  <td colSpan="5">
                    <EmptyState title="No services or accommodations" text="Approved services and accommodations will appear after this student's source review is complete." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <div className="stack">
          <Card title="Service action" description="Document delivery or assign recovery.">
            {!can(state, "logService") && !can(state, "planRecovery") ? (
              <AccessNotice text={`${roles[state.user.role].label} can view service requirements but cannot document delivery or assign recovery.`} />
            ) : null}
            <ServiceLogger
              services={services}
              dispatch={dispatch}
              logDisabled={!can(state, "logService")}
              recoveryDisabled={!can(state, "planRecovery")}
            />
          </Card>
          <AccessSupportsCard
            supports={accessSupportPlans}
            dispatch={dispatch}
            disabled={!can(state, "updateAccessSupport")}
            roleLabel={roles[state.user.role].label}
          />
          <AssessmentSupportsCard record={structuredRecord} />
        </div>
      </div>
    </section>
  );
}

function AccessSupportsCard({ supports = [], dispatch, disabled = false, roleLabel = "Current role" }) {
  return (
    <Card title="Access supports" description="Assistive technology and transportation checks remain traceable to the source IEP.">
      <div className="list">
        {supports.length ? (
          supports.map((support) => (
            <div className="question-row" key={support.id}>
              <div>
                <strong>{support.supportType}</strong>
                <span>{support.requirement}</span>
                <span>{support.implementationPlan}</span>
                <small>{support.sourceReference} · owner {support.responsibleRole}</small>
                {support.reviewNote ? <small>{support.reviewNote}</small> : null}
                {support.reviewedBy ? <small>Reviewed by {support.reviewedBy} on {formatDateTime(support.reviewedAt)} · digest {shortHash(support.supportDigest)}</small> : null}
                <small>{support.officialRecordImpact}</small>
              </div>
              <Badge tone={accessSupportTone(support.status)}>{support.status}</Badge>
            </div>
          ))
        ) : (
          <EmptyState title="No access supports" text="No assistive technology or transportation support records are visible for this student." />
        )}
      </div>
      {disabled ? (
        <AccessNotice text={`${roleLabel} can review access supports but cannot update assistive-technology or transportation implementation review.`} />
      ) : null}
      <AccessSupportForm supports={supports} dispatch={dispatch} disabled={disabled} />
    </Card>
  );
}

function ProgressView({ state, dispatch, navigate, exportRecord }) {
  const goals = activeIepItemsForState(state, "goals");
  const currentDocuments = documentsForCurrentStudent(state);
  const progressReportRows = progressReportRowsForGoals(goals);
  return (
    <section className="page">
      <PageHead
        label="Evidence before interpretation"
        title="Connect every progress statement to actual data."
        description="The system surfaces stale evidence, shows trends against mastery criteria, and drafts report language only from confirmed entries."
        actions={
            <Button
              icon={Download}
              disabled={!can(state, "export")}
              title={!can(state, "export") ? "Current role cannot export progress report drafts." : undefined}
              onClick={() => exportRecord("Progress report draft", progressExport(state))}
          >
            Draft progress report
          </Button>
        }
      />
      <Tabs active="progress" navigate={navigate} />
      <div className="progress-layout">
        <div className="stack">
          {goals.length ? (
            goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} />
            ))
          ) : (
            <Card title="Progress goals" description="Confirmed annual goals and evidence history.">
              <EmptyState title="No progress goals" text="Approved measurable annual goals will appear after this student's source review is complete." />
            </Card>
          )}
        </div>
        <div className="stack">
          <Card title="Enter progress data" description="Use the measurement method written in the approved goal.">
            {!can(state, "addProgress") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review progress but cannot enter official progress data.`} />
            ) : null}
            <ProgressForm goals={goals} documents={currentDocuments} dispatch={dispatch} disabled={!can(state, "addProgress")} />
          </Card>
          <Card title="Measurement schedule" description="Shows what data is due, stale, or recently collected.">
            <ProgressSchedule goals={goals} />
          </Card>
          <Card title="Progress report packet" description="Per-goal draft language generated from confirmed data points.">
            {progressReportRows.length ? (
              <div className="list">
                {progressReportRows.map((row) => (
                  <div className="question-row" key={row.goalId}>
                    <div>
                      <strong>{row.heading}</strong>
                      <span>{row.narrative}</span>
                      <span>{row.latestData}</span>
                      <small>{row.scheduleStatus}</small>
                      <small>{row.evidenceSummary}</small>
                      <small>Source: {row.sourceReference}</small>
                      <small>{row.reviewBoundary}</small>
                    </div>
                    <Badge tone={progressReportTone(row.status)}>{row.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No draft report language" text="Progress report rows will appear after approved goals are available." />
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}

function AssessmentSupportsCard({ record }) {
  const assessments = Array.isArray(record.stateAndLocalAssessments?.accommodations)
    ? record.stateAndLocalAssessments.accommodations
    : [];
  const specialConsiderations = structuredDetailRows(record.specialConsiderations);
  const behaviorPlan = structuredDetailRows(record.behaviorSupportPlan);
  const transitionServices = structuredDetailRows(record.transitionServices);
  const educationalPlacement = structuredDetailRows(record.educationalPlacement);
  const behaviorNeed = record.specialConsiderations?.behavior;
  return (
    <Card
      title="Assessment and special considerations"
      description="Assessment supports, behavior notes, placement rationale, and transition details from the reviewed structured record."
    >
      <div className="support-panel">
        <section className="support-block">
          <div className="support-heading">
            <strong>State and local assessments</strong>
            <Badge tone={assessments.length ? "blue" : "amber"}>{assessments.length ? "Documented" : "Needs review"}</Badge>
          </div>
          {assessments.length ? (
            <ul>
              {assessments.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>No assessment accommodations are documented in the structured record.</p>
          )}
        </section>
        <section className="support-block">
          <div className="support-heading">
            <strong>Special considerations</strong>
            <Badge tone={specialConsiderations.length ? "blue" : "amber"}>{specialConsiderations.length ? "Documented" : "Needs review"}</Badge>
          </div>
          {specialConsiderations.length ? <DetailList rows={specialConsiderations} /> : <p>No special considerations are documented.</p>}
        </section>
        <section className="support-block">
          <div className="support-heading">
            <strong>Behavior support plan</strong>
            <Badge tone={behaviorPlan.length ? "blue" : behaviorNeed ? "amber" : "green"}>
              {behaviorPlan.length ? "Documented" : behaviorNeed ? "Needs review" : "Not indicated"}
            </Badge>
          </div>
          {behaviorPlan.length ? (
            <DetailList rows={behaviorPlan} />
          ) : behaviorNeed ? (
            <p>Behavior need noted: {behaviorNeed}. No behavior support plan details are documented.</p>
          ) : (
            <p>No behavior support plan is indicated in the structured record.</p>
          )}
        </section>
        <section className="support-block">
          <div className="support-heading">
            <strong>Educational placement</strong>
            <Badge tone={educationalPlacement.length ? "blue" : "amber"}>{educationalPlacement.length ? "Documented" : "Needs review"}</Badge>
          </div>
          {educationalPlacement.length ? (
            <DetailList rows={educationalPlacement} />
          ) : (
            <p>No educational placement rationale is documented in this record.</p>
          )}
        </section>
        <section className="support-block">
          <div className="support-heading">
            <strong>Transition services</strong>
            <Badge tone={transitionServices.length ? "blue" : "amber"}>{transitionServices.length ? "Documented" : "Not documented"}</Badge>
          </div>
          {transitionServices.length ? <DetailList rows={transitionServices} /> : <p>No transition service details are documented in this record.</p>}
        </section>
      </div>
    </Card>
  );
}

function MeetingsView({ state, dispatch, navigate, exportRecord }) {
  const meeting = currentStudentMeetingForState(state);
  if (!meeting) {
    return (
      <section className="page">
        <PageHead
          label="Shared preparation, fewer surprises"
          title="Prepare the team before everyone enters the room."
          description="Bring goals, evidence, family questions, student voice, proposed changes, and participation requirements into one visible pre-meeting workspace."
          actions={
            <Button
              icon={Download}
              disabled
              title="No meeting packet is available for the selected student."
              onClick={() => {}}
            >
              Export packet
            </Button>
          }
        />
        <Tabs active="meetings" navigate={navigate} />
        <Card title="Meeting prep pending" description="Meeting records are scoped to the selected student workspace.">
          <EmptyState title="No meeting prep record" text="Create or import a meeting record after this student's source intake and team schedule are ready." />
        </Card>
      </section>
    );
  }
  const languageAccess = meeting.languageAccess || defaultLanguageAccess();
  const glossaryItems = normalizeGlossaryItems(languageAccess.glossary);
  const companionDocuments = meeting.companionDocuments || [];
  const familyResources = meeting.familyResources || [];
  const packetAcknowledgments = meeting.packetAcknowledgments || [];
  const eSignatureRequests = meeting.eSignatureRequests || [];
  const recordingReviews = visibleMeetingRecordingReviewsForState(state).filter((review) => review.meetingId === meeting.id);
  const transcriptSummaries = visibleMeetingTranscriptSummariesForState(state).filter((summary) => summary.meetingId === meeting.id);
  const calendarEvents = (state.calendarEvents || []).filter((event) => event.meetingId === meeting.id);
  const participants = meetingParticipants(meeting);
  const confirmedRequired = participants.filter((participant) => participant.required && participant.status === "Confirmed").length;
  const requiredCount = participants.filter((participant) => participant.required).length;
  const readyCompanionDocuments = companionDocuments.filter((document) =>
    ["Sent", "Available", "Complete", "Not needed"].includes(document.status)
  ).length;
  const reviewedFamilyResources = familyResources.filter((resource) =>
    ["Reviewed", "Needs explanation", "Request copy", "Interpreter support needed"].includes(resource.familyStatus)
  ).length;
  const openGlossaryQuestions = glossaryItems.filter((item) =>
    ["Needs explanation", "Interpreter explanation requested"].includes(item.clarityStatus) &&
    item.staffResponseStatus !== "Explained by staff"
  ).length;
  const completedPacketAcknowledgments = packetAcknowledgments.filter((acknowledgment) => acknowledgment.status !== "Sent").length;
  const signedRequests = eSignatureRequests.filter((request) => request.status === "Signed").length;
  const teacherFeedback = teacherFeedbackForMeeting(state, meeting);
  const meetingPrepNotes = meeting.meetingPrepNotes || [];
  return (
    <section className="page">
      <PageHead
        label="Shared preparation, fewer surprises"
        title="Prepare the team before everyone enters the room."
        description="Bring goals, evidence, family questions, student voice, proposed changes, and participation requirements into one visible pre-meeting workspace."
        actions={
          <Button
            icon={Download}
            disabled={!can(state, "export") && state.user.role !== "parent"}
            title={!can(state, "export") && state.user.role !== "parent" ? "Current role cannot export meeting packets." : undefined}
            onClick={() => exportRecord("Meeting prep packet", meetingPrepPacketExport(state, meeting))}
          >
            Export packet
          </Button>
        }
      />
      <Tabs active="meetings" navigate={navigate} />
      <div className="meeting-hero">
        <span className="date-tile large">
          <small>{month(meeting.date)}</small>
          <strong>{day(meeting.date)}</strong>
        </span>
        <div>
          <h3>{studentName(state, meeting.studentId)} - {meeting.type}</h3>
          <p>{meeting.time} - {participants.length} invited participants - secure in-person and video option</p>
          <div className="chips">
            <span>Student attending</span>
            <span>Required team: {confirmedRequired}/{requiredCount} confirmed</span>
            <span>Companion docs: {readyCompanionDocuments}/{companionDocuments.length}</span>
            <span>Resource guide: {reviewedFamilyResources}/{familyResources.length}</span>
            <span>Glossary questions: {openGlossaryQuestions}</span>
            <span>Packet receipts: {completedPacketAcknowledgments}/{packetAcknowledgments.length}</span>
            <span>E-signatures: {signedRequests}/{eSignatureRequests.length}</span>
            <span>Recording readiness: {recordingReviews.length}</span>
            <span>Transcript recaps: {transcriptSummaries.length}</span>
            <span>Calendar holds: {calendarEvents.length}</span>
            <span>Family questions visible</span>
            <span>Draft shared: not yet</span>
          </div>
        </div>
        <strong>{meeting.readiness}% ready</strong>
      </div>
      <div className="grid two-one">
        <div className="stack">
          <Card title="Shared agenda" description="Proposed decisions stay separate from final decisions.">
            <ol className="agenda">
              {meeting.agenda.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </Card>
          <Card title="Required participants" description="Confirm required roles, participation mode, and alternate coverage before the meeting.">
            <div className="participant-list">
              {participants.map((participant) => (
                <div className="participant-row" key={participant.id}>
                  <div>
                    <strong>{participant.role}</strong>
                    <span>{participant.name} · {participant.mode}</span>
                    <small>{participant.note}</small>
                    {participant.confirmedBy ? <small>Updated by {participant.confirmedBy} on {formatDate(participant.confirmedAt)}</small> : null}
                  </div>
                  <Badge tone={participantTone(participant)}>{participant.status}</Badge>
                </div>
              ))}
            </div>
            {!can(state, "coordinateParticipants") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review participant readiness but cannot coordinate attendance status.`} />
            ) : null}
            <ParticipantReadinessForm
              meetingId={meeting.id}
              participants={participants}
              dispatch={dispatch}
              disabled={!can(state, "coordinateParticipants")}
            />
          </Card>
          <Card title="Teacher feedback" description="Classroom observations and staff comments brought into meeting prep.">
            <div className="list">
              {teacherFeedback.length ? (
                teacherFeedback.map((item) => (
                  <div className="question-row" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.body}</span>
                      <small>{item.sourceReference}</small>
                      <small>{item.enteredBy} · {formatDateTime(item.enteredAt || item.observedAt || item.postedAt)}</small>
                    </div>
                    <Badge tone={item.tone}>{item.kind}</Badge>
                  </div>
                ))
              ) : (
                <EmptyState title="No teacher feedback" text="Classroom observations and source-aware teacher comments will appear here before the meeting." />
              )}
            </div>
          </Card>
          <Card title="Calendar holds" description="Create auditable meeting holds without connecting a live district calendar.">
            <div className="list">
              {calendarEvents.length ? (
                calendarEvents.map((event) => (
                  <div className="question-row" key={event.id}>
                    <div>
                      <strong>{event.title}</strong>
                      <span>{formatDate(event.startDate)} · {event.startTime} · {event.attendanceMode}</span>
                      <span>{event.provider} · UID {event.calendarUid}</span>
                      <small>{event.note}</small>
                      <small>Created by {event.createdBy} on {formatDate(event.createdAt)}</small>
                    </div>
                    <Badge tone={calendarEventTone(event.status)}>{event.status}</Badge>
                  </div>
                ))
              ) : (
                <EmptyState title="No calendar hold" text="Create a simulated hold to track meeting scheduling follow-through." />
              )}
            </div>
            {!can(state, "syncCalendar") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review calendar status but cannot create meeting calendar holds.`} />
            ) : null}
            <CalendarHoldForm
              meetingId={meeting.id}
              dispatch={dispatch}
              disabled={!can(state, "syncCalendar")}
            />
          </Card>
          <Card title="Transcript recap" description="Summarize meeting recordings or pasted transcript notes without changing official IEP decisions.">
            <h3 className="section-title">Recording/source readiness</h3>
            <div className="list">
              {recordingReviews.length ? (
                recordingReviews.map((review) => (
                  <div className="question-row" key={review.id}>
                    <div>
                      <strong>{review.recordingSource}</strong>
                      <span>Consent: {review.participantConsentSummary}</span>
                      <span>Transcript handling: {review.transcriptHandlingPlan}</span>
                      <span>Storage: {review.storageLocation}</span>
                      <small>Retention/privacy boundary: {review.retentionBoundary}</small>
                      <small>{review.officialRecordImpact}</small>
                      <small>
                        Reviewed by {review.reviewedBy || "Human review pending"} on {formatDateTime(review.reviewedAt)} · digest {shortHash(review.recordingReviewDigest)}
                      </small>
                    </div>
                    <Badge tone={meetingRecordingTone(review.status)}>{review.status}</Badge>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No recording readiness review"
                  text="Record consent and transcript-source handling before using a recording or transcript in the meeting packet."
                />
              )}
            </div>
            <MeetingRecordingReviewForm
              meetingId={meeting.id}
              dispatch={dispatch}
              disabled={!can(state, "summarizeMeetingTranscript")}
            />
            <h3 className="section-title">Transcript summaries</h3>
            <div className="list">
              {transcriptSummaries.length ? (
                transcriptSummaries.map((summary) => (
                  <div className="question-row" key={summary.id}>
                    <div>
                      <strong>{summary.summary}</strong>
                      <span>Source: {summary.transcriptSource}</span>
                      {summary.transcriptExcerpt ? <span>Excerpt: {summary.transcriptExcerpt}</span> : null}
                      <span>Decisions: {(summary.decisions || []).join("; ")}</span>
                      <span>Follow-ups: {(summary.followUps || []).join("; ")}</span>
                      <small>{summary.officialRecordImpact}</small>
                      <small>
                        Reviewed by {summary.reviewedBy || "Human review pending"} on {formatDateTime(summary.reviewedAt)} · digest {shortHash(summary.transcriptDigest)}
                      </small>
                    </div>
                    <Badge tone={meetingTranscriptTone(summary.status)}>{summary.status}</Badge>
                  </div>
                ))
              ) : (
                <EmptyState title="No transcript recap" text="Record a human-reviewed recap after meeting notes or a transcript are available." />
              )}
            </div>
            {!can(state, "summarizeMeetingTranscript") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review visible transcript recaps but cannot create or review transcript summaries.`} />
            ) : null}
            <MeetingTranscriptSummaryForm
              meetingId={meeting.id}
              dispatch={dispatch}
              disabled={!can(state, "summarizeMeetingTranscript")}
            />
          </Card>
          <Card title="Companion documents" description="Track related Pennsylvania forms and notices without treating them as completed IEP changes.">
            <div className="list">
              {companionDocuments.map((document) => (
                <div className="question-row" key={document.id}>
                  <div>
                    <strong>{document.title}</strong>
                    <span>{document.documentType} · owner {document.owner}</span>
                    <span>{document.purpose}</span>
                    <small>Due {formatDate(document.dueDate)} · source {document.sourceReference}</small>
                    {document.note ? <small>{document.note}</small> : null}
                    {document.reviewedBy ? <small>Reviewed by {document.reviewedBy} on {formatDate(document.reviewedAt)}</small> : null}
                  </div>
                  <Badge tone={companionDocumentTone(document.status)}>{document.status}</Badge>
                </div>
              ))}
            </div>
            {!can(state, "coordinateCompanionDocuments") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review companion-document readiness but cannot update related form status.`} />
            ) : null}
            <CompanionDocumentForm
              meetingId={meeting.id}
              documents={companionDocuments}
              dispatch={dispatch}
              disabled={!can(state, "coordinateCompanionDocuments")}
            />
          </Card>
          <Card title="Family resource guide" description="Rights, options, and meeting-prep resources with family/student response status.">
            <div className="list">
              {familyResources.length ? (
                familyResources.map((resource) => (
                  <div className="question-row" key={resource.id}>
                    <div>
                      <strong>{resource.title}</strong>
                      <span>{resource.category} · for {roles[resource.audienceRole]?.label || resource.audienceRole}</span>
                      <span>{resource.purpose}</span>
                      <span>Family/student response: {resource.familyStatus || "Not reviewed"}{resource.familyNote ? ` - ${resource.familyNote}` : ""}</span>
                      {(resource.suggestedQuestions || []).length ? (
                        <small>Suggested questions: {(resource.suggestedQuestions || []).join(" / ")}</small>
                      ) : null}
                      <small>Due {formatDate(resource.dueDate)} · source {resource.sourceReference}</small>
                      {resource.note ? <small>{resource.note}</small> : null}
                      <small>{resource.officialRecordImpact}</small>
                    </div>
                    <div className="badge-stack">
                      <Badge tone={familyResourceTone(resource.status)}>{resource.status}</Badge>
                      <Badge tone={familyResourceResponseTone(resource.familyStatus)}>{resource.familyStatus || "Not reviewed"}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="No resource guide items" text="Add resource-guide items when families or students need rights, options, or meeting-prep support." />
              )}
            </div>
            {!can(state, "coordinateFamilyResources") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review resource-guide status but cannot coordinate resource readiness.`} />
            ) : null}
            <FamilyResourceForm
              meetingId={meeting.id}
              resources={familyResources}
              dispatch={dispatch}
              disabled={!can(state, "coordinateFamilyResources")}
            />
            {!can(state, "acknowledgeFamilyResource") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review resource-guide responses but cannot record family or student resource review.`} />
            ) : null}
            <FamilyResourceResponseForm
              meetingId={meeting.id}
              resources={familyResources}
              role={state.user.role}
              dispatch={dispatch}
              disabled={!can(state, "acknowledgeFamilyResource")}
            />
          </Card>
          <Card title="Draft-to-final changes" description="Visible proposed language, final language, and rationale.">
            <div className="list">
              {(meeting.draftDiffs || []).map((diff) => (
                <div className="question-row" key={diff.id}>
                  <div>
                    <strong>{diff.section}</strong>
                    <span>Source: {diff.sourceReference}</span>
                    <span>Draft: {diff.draftText}</span>
                    <span>Final: {diff.finalText || "Awaiting team decision."}</span>
                    {diff.decisionRationale ? <span>Rationale: {diff.decisionRationale}</span> : null}
                    {diff.finalizedBy ? <span>Recorded by {diff.finalizedBy} on {formatDate(diff.finalizedAt)}</span> : null}
                  </div>
                  <Badge tone={diff.status === "Finalized" ? "green" : "amber"}>{diff.status}</Badge>
                </div>
              ))}
            </div>
            {!can(state, "finalizeDraftDiff") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review draft-to-final changes but cannot record final meeting language.`} />
            ) : null}
            <DraftDiffResolutionForm
              draftDiffs={meeting.draftDiffs || []}
              dispatch={dispatch}
              disabled={!can(state, "finalizeDraftDiff")}
            />
          </Card>
        </div>
        <div className="stack">
          <Card title="Packet acknowledgments" description="Pre-read receipt status without treating the response as final consent.">
            <div className="list">
              {packetAcknowledgments.map((acknowledgment) => (
                <div className="question-row" key={acknowledgment.id}>
                  <div>
                    <strong>{acknowledgment.label}</strong>
                    <span>{acknowledgment.packetTitle} · {acknowledgment.participantName}</span>
                    <span>{acknowledgment.responseNote}</span>
                    <small>Sent {formatDate(acknowledgment.sentAt)} · source {acknowledgment.sourceReference}</small>
                    {acknowledgment.acknowledgedBy ? (
                      <small>Updated by {acknowledgment.acknowledgedBy} on {formatDate(acknowledgment.acknowledgedAt)}</small>
                    ) : null}
                  </div>
                  <Badge tone={packetAcknowledgmentTone(acknowledgment.status)}>{acknowledgment.status}</Badge>
                </div>
              ))}
            </div>
            {!can(state, "acknowledgeMeetingPacket") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review packet receipt status but cannot acknowledge family or student packet review.`} />
            ) : null}
            <PacketAcknowledgmentForm
              meetingId={meeting.id}
              acknowledgments={packetAcknowledgments}
              role={state.user.role}
              dispatch={dispatch}
              disabled={!can(state, "acknowledgeMeetingPacket")}
            />
          </Card>
          <Card title="E-signature requests" description="Scoped typed signatures for packet receipt or change-review attestations.">
            <div className="list">
              {eSignatureRequests.length ? (
                eSignatureRequests.map((signatureRequest) => (
                  <div className="question-row" key={signatureRequest.id}>
                    <div>
                      <strong>{signatureRequest.packetTitle}</strong>
                      <span>{signatureRequest.signatureScope} · for {roles[signatureRequest.requestedForRole]?.label || signatureRequest.requestedForRole}</span>
                      <span>{signatureRequest.requestNote}</span>
                      <small>{signatureRequest.notConsentNote}</small>
                      {signatureRequest.signatureHash ? (
                        <small>Signature hash {shortHash(signatureRequest.signatureHash)} · signed by {signatureRequest.signerName} on {formatDateTime(signatureRequest.signedAt)}</small>
                      ) : (
                        <small>Requested by {signatureRequest.requestedBy} on {formatDateTime(signatureRequest.requestedAt)}</small>
                      )}
                    </div>
                    <Badge tone={signatureRequestTone(signatureRequest.status)}>{signatureRequest.status}</Badge>
                  </div>
                ))
              ) : (
                <EmptyState title="No e-signature requests" text="Request a scoped parent signature after packet materials are ready." />
              )}
            </div>
            {!can(state, "requestSignature") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review signature status but cannot request new e-signatures.`} />
            ) : null}
            <SignatureRequestForm
              meetingId={meeting.id}
              dispatch={dispatch}
              disabled={!can(state, "requestSignature")}
            />
            {!can(state, "signMeetingPacket") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review signature requests but cannot sign parent/guardian attestations.`} />
            ) : null}
            <MeetingSignatureForm
              meetingId={meeting.id}
              requests={eSignatureRequests}
              role={state.user.role}
              userName={state.user.name}
              dispatch={dispatch}
              disabled={!can(state, "signMeetingPacket")}
            />
          </Card>
          <Card title="Language access" description="Plain-language translation support and interpreter coordination.">
            <div className="language-status">
              <Badge tone={languageAccess.preferredLanguage === "English" ? "blue" : "purple"}>{languageAccess.preferredLanguage}</Badge>
              <Badge tone={languageAccess.translationStatus === "Human reviewed" ? "green" : "amber"}>{languageAccess.translationStatus}</Badge>
              <Badge tone={languageAccess.interpreterStatus === "Interpreter assigned" ? "green" : "blue"}>{languageAccess.interpreterStatus}</Badge>
            </div>
            {languageAccess.requestedBy ? (
              <p className="card-note">
                Requested by {languageAccess.requestedBy} on {formatDate(languageAccess.requestedAt)}.
              </p>
            ) : null}
            {languageAccess.coordinatorNote ? <div className="question">{languageAccess.coordinatorNote}</div> : null}
            {languageAccess.translatedSummary ? (
              <div className="note">
                <strong>{languageAccess.translatedSummary.title}</strong>
                <span>{languageAccess.translatedSummary.disclaimer}</span>
              </div>
            ) : null}
            <div className="list">
              {glossaryItems.map((item) => (
                <div className="question-row" key={item.id}>
                  <div>
                    <strong>{item.term}</strong>
                    <span>{item.plainLanguage}</span>
                    {item.sourceReference ? <span>Source: {item.sourceReference}</span> : null}
                    {item.clarityNote ? <span>Question: {item.clarityNote}</span> : null}
                    {item.staffResponse ? <span>Staff response: {item.staffResponse}</span> : null}
                    {item.staffRespondedBy ? <span>Responded by {item.staffRespondedBy} on {formatDate(item.staffRespondedAt)}</span> : null}
                    <small>{item.officialRecordImpact}</small>
                  </div>
                  <div className="badge-stack">
                    <Badge tone={glossaryClarityTone(item.clarityStatus)}>{item.clarityStatus}</Badge>
                    <Badge tone={glossaryResponseTone(item.staffResponseStatus)}>{item.staffResponseStatus}</Badge>
                  </div>
                </div>
              ))}
            </div>
            {!can(state, "requestLanguageAccess") && !can(state, "coordinateLanguageAccess") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review language support status but cannot update requests or coordination.`} />
            ) : null}
            <LanguageAccessForm
              meetingId={meeting.id}
              languageAccess={languageAccess}
              dispatch={dispatch}
              canRequest={can(state, "requestLanguageAccess")}
              canCoordinate={can(state, "coordinateLanguageAccess")}
            />
            {!can(state, "requestLanguageAccess") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review glossary notes but cannot request family or student term clarification.`} />
            ) : null}
            <GlossaryClarificationForm
              meetingId={meeting.id}
              glossary={glossaryItems}
              dispatch={dispatch}
              disabled={!can(state, "requestLanguageAccess")}
            />
            {!can(state, "coordinateLanguageAccess") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review glossary responses but cannot record staff explanations.`} />
            ) : null}
            <GlossaryResponseForm
              meetingId={meeting.id}
              glossary={glossaryItems}
              dispatch={dispatch}
              disabled={!can(state, "coordinateLanguageAccess")}
            />
          </Card>
          <Card title="Concern and decision log" description="Early-resolution record separate from official IEP changes.">
            <div className="list">
              {(meeting.concerns || []).map((concern) => (
                <div className="question-row" key={concern.id}>
                  <div>
                    <strong>{concern.title}</strong>
                    <span>{concern.concern}</span>
                    <span>
                      Submitted by {concern.submittedBy} - owner {concern.owner}
                    </span>
                    {concern.response ? <span>Response: {concern.response}</span> : null}
                    {concern.decision ? <span>Decision: {concern.decision}</span> : null}
                    {concern.nextStep ? <span>Next step: {concern.nextStep}</span> : null}
                    {concern.priorWrittenNotice ? <span>PWN check: {concern.priorWrittenNotice}</span> : null}
                  </div>
                  <Badge tone={concern.status === "Resolved" ? "green" : "amber"}>{concern.status}</Badge>
                </div>
              ))}
            </div>
            {!can(state, "submitConcern") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review concerns but cannot submit family or student concerns.`} />
            ) : null}
            <ConcernForm
              meetingId={meeting.id}
              dispatch={dispatch}
              disabled={!can(state, "submitConcern")}
            />
            {!can(state, "resolveConcern") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review the decision record but cannot resolve concerns.`} />
            ) : null}
            <ConcernResolutionForm
              concerns={meeting.concerns || []}
              dispatch={dispatch}
              disabled={!can(state, "resolveConcern")}
            />
          </Card>
          <Card title="Family questions" description="Visible before the meeting with response history.">
            <div className="list">
              {meeting.familyQuestions.map((question) => (
                <div className="question-row" key={question.id}>
                  <div>
                    <strong>{question.text}</strong>
                    <span>
                      Assigned to {question.assignedTo}
                      {question.submittedBy ? ` - submitted by ${question.submittedBy}` : ""}
                    </span>
                    {question.response ? <span>Response: {question.response}</span> : null}
                  </div>
                  {question.status === "Open" ? (
                    <Button
                      disabled={!can(state, "answerQuestion")}
                      title={!can(state, "answerQuestion") ? "Current role cannot answer family questions on behalf of the team." : undefined}
                      onClick={() =>
                        dispatch(
                          { type: "answerQuestion", questionId: question.id },
                          { title: "Question answered", detail: question.text }
                        )
                      }
                    >
                      Answer
                    </Button>
                  ) : (
                    <Badge tone="green">Answered</Badge>
                  )}
                </div>
              ))}
            </div>
            {!can(state, "submitQuestion") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review pre-meeting questions but cannot submit family or student concerns.`} />
            ) : null}
            <MeetingQuestionForm
              meetingId={meeting.id}
              dispatch={dispatch}
              disabled={!can(state, "submitQuestion")}
            />
          </Card>
          <Card title="Meeting prep notes" description="Parent notes area and team preparation notes that do not change the official IEP.">
            <div className="list">
              {meetingPrepNotes.length ? (
                meetingPrepNotes.map((note) => (
                  <div className="question-row" key={note.id}>
                    <div>
                      <strong>{note.topic}</strong>
                      <span>{note.body}</span>
                      <small>{note.submittedBy} · {roles[note.submittedByRole]?.label || note.submittedByRole} · {formatDateTime(note.submittedAt)}</small>
                      <small>{note.officialRecordImpact}</small>
                    </div>
                    <Badge tone={meetingPrepNoteTone(note.submittedByRole)}>{note.audience}</Badge>
                  </div>
                ))
              ) : (
                <EmptyState title="No meeting prep notes" text="Families, students, and staff can add notes for the team before the meeting." />
              )}
            </div>
            {!can(state, "addMeetingPrepNote") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review meeting prep notes but cannot add notes for the team.`} />
            ) : null}
            <MeetingPrepNoteForm
              meetingId={meeting.id}
              role={state.user.role}
              dispatch={dispatch}
              disabled={!can(state, "addMeetingPrepNote")}
            />
          </Card>
          <Card title="Student voice" description="Guided pre-meeting reflection.">
            <blockquote>{meeting.studentVoice}</blockquote>
            {meeting.studentVoiceUpdatedBy ? (
              <p className="card-note">Updated by {meeting.studentVoiceUpdatedBy} on {formatDate(meeting.studentVoiceUpdatedAt)}</p>
            ) : null}
            {!can(state, "updateStudentVoice") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review student voice but cannot update the student's reflection.`} />
            ) : null}
            <StudentVoiceForm
              meetingId={meeting.id}
              currentValue={meeting.studentVoice}
              dispatch={dispatch}
              disabled={!can(state, "updateStudentVoice")}
            />
          </Card>
          <Card title="Self-advocacy prep" description="Student-facing practice plan for asking for supports during instruction or the meeting.">
            <div className="list">
              <div className="question">
                <strong>Support to ask for</strong>
                <span>{meeting.selfAdvocacyPlan?.preferredSupport || "No preferred support documented yet."}</span>
              </div>
              <div className="question">
                <strong>Participation goal</strong>
                <span>{meeting.selfAdvocacyPlan?.participationGoal || "No participation goal documented yet."}</span>
              </div>
              <div className="question">
                <strong>Practice script</strong>
                <span>{meeting.selfAdvocacyPlan?.requestScript || "No script documented yet."}</span>
              </div>
              <div className="question">
                <strong>Confidence</strong>
                <span>{meeting.selfAdvocacyPlan?.confidence || 1} of 5 · {meeting.selfAdvocacyPlan?.barrier || "No barrier documented."}</span>
              </div>
              <div className="question">
                <strong>Next step</strong>
                <span>{meeting.selfAdvocacyPlan?.nextStep || "No next step documented."}</span>
                {meeting.selfAdvocacyPlan?.updatedBy ? (
                  <small>Updated by {meeting.selfAdvocacyPlan.updatedBy} on {formatDate(meeting.selfAdvocacyPlan.updatedAt)}</small>
                ) : null}
              </div>
            </div>
            {!can(state, "updateSelfAdvocacy") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review self-advocacy prep but cannot update the student's plan.`} />
            ) : null}
            <SelfAdvocacyForm
              meetingId={meeting.id}
              plan={meeting.selfAdvocacyPlan}
              dispatch={dispatch}
              disabled={!can(state, "updateSelfAdvocacy")}
            />
          </Card>
        </div>
      </div>
    </section>
  );
}

function ReviewView({ state, dispatch, navigate, exportRecord }) {
  const reviewFlags = currentStudentReviewFlagsForState(state);
  const open = reviewFlags.filter((flag) => flag.status === "Open");
  const score = Math.max(0, 100 - open.length * 7);
  const coverage = structuredSectionCoverage(state);
  const sourceGuidance = sourceGuidanceForState(state);
  const complianceReviews = (state.complianceReviews || []).filter((review) => review.studentId === state.currentStudentId);
  const legalReviewRoutes = (state.legalReviewRoutes || []).filter((route) => route.studentId === state.currentStudentId);
  const placementReviews = (state.placementReviews || []).filter((review) => review.studentId === state.currentStudentId);
  return (
    <section className="page">
      <PageHead
        label="Advisory, not determinative"
        title="Surface ambiguity and missing connections for human review."
        description="The review checks completeness, clarity, internal alignment, and implementation readiness. It does not certify compliance or replace the IEP team."
        actions={
          <>
            <Button
              icon={Sparkles}
              disabled={!can(state, "generateReview")}
              title={!can(state, "generateReview") ? "Current role cannot generate advisory quality reviews." : undefined}
              onClick={() =>
                dispatch(
                  { type: "generateReview" },
                  { title: "Completeness review generated", detail: "Advisory findings require human disposition before closure." }
                )
              }
            >
              Run completeness review
            </Button>
            <Button
              icon={Download}
              disabled={!can(state, "export")}
              title={!can(state, "export") ? "Current role cannot export compliance review reports." : undefined}
              onClick={() => exportRecord("Compliance review report", reviewFlags)}
            >
              Export review
            </Button>
          </>
        }
      />
      <Tabs active="review" navigate={navigate} />
      <div className="grid two-one">
        <div className="stack">
          <Card title={`Review score: ${score}`} description={`${open.length} advisory findings require human judgment.`}>
            <div className="review-score">
              <Donut percent={score} />
              <div>
                <strong>Human review required before any official change.</strong>
                <p>AI-assisted findings explain possible risk, cite source references, and require qualified users to resolve them.</p>
              </div>
            </div>
          </Card>
          {reviewFlags.length ? (
            reviewFlags.map((flag) => (
              <article className={`issue ${flag.status === "Resolved" ? "resolved" : ""}`} key={flag.id}>
                <div>
                  <Badge tone={flag.severity === "High" ? "red" : "amber"}>{flag.severity}</Badge>
                  <h3>{flag.issue}</h3>
                  <p>{flag.whyItMatters}</p>
                  <small>{flag.sourceReference}</small>
                  <div className="note muted">
                    <strong>Suggested revision</strong>
                    <span>{flag.suggestedRevision}</span>
                  </div>
                </div>
                <div className="issue-status">
                  {flag.status === "Open" ? (
                    <Badge tone="amber">Needs disposition</Badge>
                  ) : (
                    <Badge tone="green">Resolved</Badge>
                  )}
                  {flag.resolution ? (
                    <p className="card-note">
                      {flag.resolution.decision}: {flag.resolution.rationale}
                      {flag.resolution.nextAction ? ` Next: ${flag.resolution.nextAction}` : ""}
                    </p>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <Card title="No advisory findings" description="Quality review findings are scoped to the selected student.">
              <EmptyState title="No review findings" text="Run a completeness review after this student's structured source record is ready." />
            </Card>
          )}
        </div>
        <div className="stack">
          <Card title="Human review disposition" description="Record professional judgment before closing an advisory finding.">
            {!can(state, "resolveFlag") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review advisory findings but cannot close quality-review items.`} />
            ) : null}
            <ReviewResolutionForm
              flags={reviewFlags}
              dispatch={dispatch}
              disabled={!can(state, "resolveFlag")}
            />
          </Card>
          <Card title="Formal compliance review" description="Escalate advisory findings for qualified human review; this does not certify legal compliance.">
            <div className="list">
              {complianceReviews.length ? (
                complianceReviews.slice(0, 4).map((review) => (
                  <div className="question-row" key={review.id}>
                    <div>
                      <strong>{review.issue}</strong>
                      <span>{review.reviewType} · assigned to {review.assignedReviewer}</span>
                      <span>Due {formatDate(review.dueDate)} · requested by {review.requestedBy}</span>
                      {review.rationale ? <span>Rationale: {review.rationale}</span> : null}
                      {review.outcome ? <span>Outcome: {review.outcome}</span> : null}
                      {review.legalRouteStatus ? <span>District counsel: {review.legalRouteStatus}</span> : null}
                      <small>{review.notLegalCertification ? "Human implementation review only; not legal certification." : "Review scope not specified."}</small>
                    </div>
                    <Badge tone={complianceReviewTone(review.status)}>{review.status}</Badge>
                  </div>
                ))
              ) : (
                <EmptyState title="No compliance review requests" text="Escalate an advisory finding when it needs formal human review." />
              )}
            </div>
            {!can(state, "requestComplianceReview") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review escalation status but cannot request formal compliance review.`} />
            ) : null}
            <ComplianceReviewRequestForm
              flags={reviewFlags}
              dispatch={dispatch}
              disabled={!can(state, "requestComplianceReview")}
            />
            {!can(state, "completeComplianceReview") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review outcomes but cannot record formal compliance-review disposition.`} />
            ) : null}
            <ComplianceReviewOutcomeForm
              reviews={complianceReviews}
              dispatch={dispatch}
              disabled={!can(state, "completeComplianceReview")}
            />
          </Card>
          <Card title="District counsel routing" description="Route formal review records for district counsel input without turning advisory output into legal certification.">
            <div className="list">
              {legalReviewRoutes.length ? (
                legalReviewRoutes.slice(0, 4).map((route) => (
                  <div className="question-row" key={route.id}>
                    <div>
                      <strong>{route.issue}</strong>
                      <span>{route.reviewScope} · counsel {route.counselName}</span>
                      <span>Due {formatDate(route.dueDate)} · policy {route.districtPolicyReference}</span>
                      <span>Reason: {route.routingReason}</span>
                      {route.counselSummary ? <span>Counsel summary: {route.counselSummary}</span> : null}
                      {route.recommendedAction ? <span>Recommended action: {route.recommendedAction}</span> : null}
                      <small>{route.notLegalCertification || "Counsel routing metadata only; no automated legal certification."}</small>
                      <small>Digest {shortHash(route.outcomeDigest || route.routeDigest)}</small>
                    </div>
                    <Badge tone={legalReviewRouteTone(route.status)}>{route.status}</Badge>
                  </div>
                ))
              ) : (
                <EmptyState title="No district counsel routes" text="Route a formal compliance review when district counsel input is needed." />
              )}
            </div>
            {!can(state, "manageLegalReview") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review counsel-routing status but cannot route or record district counsel outcomes.`} />
            ) : null}
            <LegalReviewRouteForm
              reviews={complianceReviews}
              dispatch={dispatch}
              disabled={!can(state, "manageLegalReview")}
            />
            <LegalReviewOutcomeForm
              routes={legalReviewRoutes}
              dispatch={dispatch}
              disabled={!can(state, "manageLegalReview")}
            />
          </Card>
          <PlacementReviewCard
            reviews={placementReviews}
            dispatch={dispatch}
            disabled={!can(state, "reviewPlacement")}
            roleLabel={roles[state.user.role].label}
          />
          <Card title="Section coverage" description="Presence and structured-review status.">
            <div className="coverage">
              {coverage.map((item) => (
                <div className="coverage-row" key={item.section}>
                  <span>
                    <strong>{item.section}</strong>
                    <small>{item.note}</small>
                  </span>
                  <ProgressBar value={item.percent} tone={item.tone} />
                  <Badge tone={item.tone}>{item.status}</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Source-guided review prompts" description="Annotated-form cues for validation and quality review.">
            <SourceGuidancePanel guidance={sourceGuidance} compact />
          </Card>
        </div>
      </div>
    </section>
  );
}

function ReviewResolutionForm({ flags, dispatch, disabled = false }) {
  const openFlags = useMemo(() => flags.filter((flag) => flag.status === "Open"), [flags]);
  const [flagId, setFlagId] = useState(openFlags[0]?.id || "");
  const selectedFlag = openFlags.find((flag) => flag.id === flagId);
  const [decision, setDecision] = useState("Reviewed - follow-up assigned");
  const [rationale, setRationale] = useState(selectedFlag?.suggestedRevision || "");
  const [nextAction, setNextAction] = useState("Document team follow-up before the next IEP meeting.");

  useEffect(() => {
    if (!openFlags.some((flag) => flag.id === flagId)) setFlagId(openFlags[0]?.id || "");
  }, [flagId, openFlags]);

  useEffect(() => {
    setRationale(selectedFlag?.suggestedRevision || "");
    setNextAction("Document team follow-up before the next IEP meeting.");
  }, [selectedFlag]);

  const ready = flagId && decision.trim() && rationale.trim() && nextAction.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Review finding</span>
        <select
          aria-label="Review finding"
          value={flagId}
          disabled={disabled || openFlags.length === 0}
          onChange={(event) => setFlagId(event.target.value)}
        >
          {openFlags.length ? (
            openFlags.map((flag) => <option value={flag.id} key={flag.id}>{flag.issue}</option>)
          ) : (
            <option value="">No open advisory findings</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Reviewer decision</span>
        <select
          aria-label="Reviewer decision"
          value={decision}
          disabled={disabled || !flagId}
          onChange={(event) => setDecision(event.target.value)}
        >
          <option>Reviewed - follow-up assigned</option>
          <option>Reviewed - no IEP change needed</option>
          <option>Reviewed - team meeting needed</option>
        </select>
      </label>
      <label className="field">
        <span>Review rationale</span>
        <textarea
          aria-label="Review rationale"
          value={rationale}
          disabled={disabled || !flagId}
          onChange={(event) => setRationale(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Next action</span>
        <textarea
          aria-label="Next action"
          value={nextAction}
          disabled={disabled || !flagId}
          onChange={(event) => setNextAction(event.target.value)}
        />
      </label>
      <Button
        variant="primary"
        icon={ClipboardCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "resolveFlag",
              flagId,
              decision: decision.trim(),
              rationale: rationale.trim(),
              nextAction: nextAction.trim()
            },
            { title: "Finding resolved", detail: selectedFlag?.issue || "Advisory finding disposition recorded." }
          )
        }
      >
        Record review disposition
      </Button>
    </div>
  );
}

function ComplianceReviewRequestForm({ flags, dispatch, disabled = false }) {
  const openFlags = useMemo(() => flags.filter((flag) => flag.status === "Open"), [flags]);
  const [flagId, setFlagId] = useState(openFlags[0]?.id || "");
  const selectedFlag = openFlags.find((flag) => flag.id === flagId);
  const [reviewType, setReviewType] = useState("Implementation compliance review");
  const [assignedReviewer, setAssignedReviewer] = useState("D. Nguyen");
  const [dueDate, setDueDate] = useState("2026-06-27");
  const [rationale, setRationale] = useState(selectedFlag?.whyItMatters || "");
  const [nextAction, setNextAction] = useState(selectedFlag?.suggestedRevision || "");

  useEffect(() => {
    if (!openFlags.some((flag) => flag.id === flagId)) setFlagId(openFlags[0]?.id || "");
  }, [flagId, openFlags]);

  useEffect(() => {
    setRationale(selectedFlag?.whyItMatters || "");
    setNextAction(selectedFlag?.suggestedRevision || "");
  }, [selectedFlag]);

  const ready = selectedFlag && reviewType.trim() && assignedReviewer.trim() && dueDate.trim() && rationale.trim() && nextAction.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Review finding to escalate</span>
        <select
          aria-label="Review finding to escalate"
          value={flagId}
          disabled={disabled || openFlags.length === 0}
          onChange={(event) => setFlagId(event.target.value)}
        >
          {openFlags.length ? (
            openFlags.map((flag) => <option value={flag.id} key={flag.id}>{flag.issue}</option>)
          ) : (
            <option value="">No open advisory findings</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Review type</span>
        <input
          aria-label="Review type"
          value={reviewType}
          disabled={disabled || !selectedFlag}
          onChange={(event) => setReviewType(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Assigned reviewer</span>
        <input
          aria-label="Assigned reviewer"
          value={assignedReviewer}
          disabled={disabled || !selectedFlag}
          onChange={(event) => setAssignedReviewer(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Compliance review due date</span>
        <input
          aria-label="Compliance review due date"
          type="date"
          value={dueDate}
          disabled={disabled || !selectedFlag}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Escalation rationale</span>
        <textarea
          aria-label="Escalation rationale"
          value={rationale}
          disabled={disabled || !selectedFlag}
          onChange={(event) => setRationale(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Compliance review next action</span>
        <textarea
          aria-label="Compliance review next action"
          value={nextAction}
          disabled={disabled || !selectedFlag}
          onChange={(event) => setNextAction(event.target.value)}
        />
      </label>
      <Button
        variant="primary"
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "requestComplianceReview",
              flagId,
              reviewType: reviewType.trim(),
              assignedReviewer: assignedReviewer.trim(),
              dueDate,
              rationale: rationale.trim(),
              nextAction: nextAction.trim()
            },
            { title: "Compliance review requested", detail: selectedFlag?.issue || "Advisory finding escalated for formal review." }
          )
        }
      >
        Request compliance review
      </Button>
    </div>
  );
}

function ComplianceReviewOutcomeForm({ reviews, dispatch, disabled = false }) {
  const [reviewId, setReviewId] = useState(reviews[0]?.id || "");
  const selectedReview = reviews.find((review) => review.id === reviewId);
  const [status, setStatus] = useState(selectedReview?.status === "Closed - reviewed" ? "Closed - reviewed" : "In review");
  const [outcome, setOutcome] = useState(selectedReview?.outcome || "Reviewer confirmed this remains an implementation follow-up item, not a legal certification.");
  const [reviewerNote, setReviewerNote] = useState(selectedReview?.reviewerNote || "Verify source-aligned recovery plan, family communication, and responsible owner.");
  const [nextAction, setNextAction] = useState(selectedReview?.nextAction || "");

  useEffect(() => {
    if (!reviews.some((review) => review.id === reviewId)) setReviewId(reviews[0]?.id || "");
  }, [reviewId, reviews]);

  useEffect(() => {
    setStatus(selectedReview?.status === "Closed - reviewed" ? "Closed - reviewed" : "In review");
    setOutcome(selectedReview?.outcome || "Reviewer confirmed this remains an implementation follow-up item, not a legal certification.");
    setReviewerNote(selectedReview?.reviewerNote || "Verify source-aligned recovery plan, family communication, and responsible owner.");
    setNextAction(selectedReview?.nextAction || "");
  }, [selectedReview]);

  const ready = selectedReview && status.trim() && outcome.trim() && reviewerNote.trim() && nextAction.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Compliance review record</span>
        <select
          aria-label="Compliance review record"
          value={reviewId}
          disabled={disabled || reviews.length === 0}
          onChange={(event) => setReviewId(event.target.value)}
        >
          {reviews.length ? (
            reviews.map((review) => <option value={review.id} key={review.id}>{review.issue}</option>)
          ) : (
            <option value="">No compliance review records</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Compliance review status</span>
        <select
          aria-label="Compliance review status"
          value={status}
          disabled={disabled || !selectedReview}
          onChange={(event) => setStatus(event.target.value)}
        >
          {complianceReviewStatusOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Compliance review outcome</span>
        <textarea
          aria-label="Compliance review outcome"
          value={outcome}
          disabled={disabled || !selectedReview}
          onChange={(event) => setOutcome(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Compliance reviewer note</span>
        <textarea
          aria-label="Compliance reviewer note"
          value={reviewerNote}
          disabled={disabled || !selectedReview}
          onChange={(event) => setReviewerNote(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Compliance next action</span>
        <textarea
          aria-label="Compliance next action"
          value={nextAction}
          disabled={disabled || !selectedReview}
          onChange={(event) => setNextAction(event.target.value)}
        />
      </label>
      <Button
        variant="primary"
        icon={ClipboardCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "completeComplianceReview",
              reviewId,
              status,
              outcome: outcome.trim(),
              reviewerNote: reviewerNote.trim(),
              nextAction: nextAction.trim()
            },
            { title: "Compliance review outcome recorded", detail: selectedReview?.issue || "Formal review outcome saved." }
          )
        }
      >
        Record compliance review outcome
      </Button>
    </div>
  );
}

function LegalReviewRouteForm({ reviews, dispatch, disabled = false }) {
  const [reviewId, setReviewId] = useState(reviews[0]?.id || "");
  const selectedReview = reviews.find((review) => review.id === reviewId);
  const [counselName, setCounselName] = useState("District counsel office");
  const [reviewScope, setReviewScope] = useState("Review whether proposed meeting packet language needs district counsel input before sharing.");
  const [dueDate, setDueDate] = useState("2026-06-30");
  const [districtPolicyReference, setDistrictPolicyReference] = useState("Riverbend special education review protocol 2026");
  const [routingReason, setRoutingReason] = useState(selectedReview?.rationale || "Formal review outcome needs district counsel input before district action.");

  useEffect(() => {
    if (!reviews.some((review) => review.id === reviewId)) setReviewId(reviews[0]?.id || "");
  }, [reviewId, reviews]);

  useEffect(() => {
    setRoutingReason(selectedReview?.rationale || "Formal review outcome needs district counsel input before district action.");
  }, [selectedReview]);

  const ready = selectedReview && counselName.trim() && reviewScope.trim() && dueDate.trim() && districtPolicyReference.trim() && routingReason.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Counsel review record</span>
        <select
          aria-label="Counsel review record"
          value={reviewId}
          disabled={disabled || reviews.length === 0}
          onChange={(event) => setReviewId(event.target.value)}
        >
          {reviews.length ? (
            reviews.map((review) => <option value={review.id} key={review.id}>{review.issue}</option>)
          ) : (
            <option value="">No formal compliance reviews</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>District counsel</span>
        <input
          aria-label="District counsel"
          value={counselName}
          disabled={disabled || !selectedReview}
          onChange={(event) => setCounselName(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Legal review scope</span>
        <textarea
          aria-label="Legal review scope"
          value={reviewScope}
          disabled={disabled || !selectedReview}
          onChange={(event) => setReviewScope(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Legal review due date</span>
        <input
          aria-label="Legal review due date"
          type="date"
          value={dueDate}
          disabled={disabled || !selectedReview}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>District policy reference</span>
        <input
          aria-label="District policy reference"
          value={districtPolicyReference}
          disabled={disabled || !selectedReview}
          onChange={(event) => setDistrictPolicyReference(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Legal routing reason</span>
        <textarea
          aria-label="Legal routing reason"
          value={routingReason}
          disabled={disabled || !selectedReview}
          onChange={(event) => setRoutingReason(event.target.value)}
        />
      </label>
      <Button
        variant="primary"
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "requestLegalReviewRoute",
              reviewId,
              counselName: counselName.trim(),
              reviewScope: reviewScope.trim(),
              routingReason: routingReason.trim(),
              dueDate,
              districtPolicyReference: districtPolicyReference.trim()
            },
            { title: "District counsel review routed", detail: selectedReview?.issue || "Formal review routed for district counsel input." }
          )
        }
      >
        Route to district counsel
      </Button>
    </div>
  );
}

function LegalReviewOutcomeForm({ routes, dispatch, disabled = false }) {
  const [routeId, setRouteId] = useState(routes[0]?.id || "");
  const selectedRoute = routes.find((route) => route.id === routeId);
  const [status, setStatus] = useState("Counsel response recorded");
  const [counselSummary, setCounselSummary] = useState(selectedRoute?.counselSummary || "Counsel reviewed the routing record and identified district action steps for staff follow-through.");
  const [recommendedAction, setRecommendedAction] = useState(selectedRoute?.recommendedAction || "Document district action separately and update the meeting packet after human review.");
  const [reviewerNote, setReviewerNote] = useState(selectedRoute?.reviewerNote || "Workspace stores counsel-response metadata only; consult district records for legal advice.");

  useEffect(() => {
    if (!routes.some((route) => route.id === routeId)) setRouteId(routes[0]?.id || "");
  }, [routeId, routes]);

  useEffect(() => {
    setStatus(selectedRoute?.status === "Routed to counsel" ? "Counsel response recorded" : selectedRoute?.status || "Counsel response recorded");
    setCounselSummary(selectedRoute?.counselSummary || "Counsel reviewed the routing record and identified district action steps for staff follow-through.");
    setRecommendedAction(selectedRoute?.recommendedAction || "Document district action separately and update the meeting packet after human review.");
    setReviewerNote(selectedRoute?.reviewerNote || "Workspace stores counsel-response metadata only; consult district records for legal advice.");
  }, [selectedRoute]);

  const ready = selectedRoute && status.trim() && counselSummary.trim() && recommendedAction.trim() && reviewerNote.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Legal route record</span>
        <select
          aria-label="Legal route record"
          value={routeId}
          disabled={disabled || routes.length === 0}
          onChange={(event) => setRouteId(event.target.value)}
        >
          {routes.length ? (
            routes.map((route) => <option value={route.id} key={route.id}>{route.issue}</option>)
          ) : (
            <option value="">No district counsel routes</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Legal review status</span>
        <select
          aria-label="Legal review status"
          value={status}
          disabled={disabled || !selectedRoute}
          onChange={(event) => setStatus(event.target.value)}
        >
          {legalReviewStatusOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Counsel summary</span>
        <textarea
          aria-label="Counsel summary"
          value={counselSummary}
          disabled={disabled || !selectedRoute}
          onChange={(event) => setCounselSummary(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Counsel recommended action</span>
        <textarea
          aria-label="Counsel recommended action"
          value={recommendedAction}
          disabled={disabled || !selectedRoute}
          onChange={(event) => setRecommendedAction(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Legal review note</span>
        <textarea
          aria-label="Legal review note"
          value={reviewerNote}
          disabled={disabled || !selectedRoute}
          onChange={(event) => setReviewerNote(event.target.value)}
        />
      </label>
      <Button
        variant="primary"
        icon={ClipboardCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "recordLegalReviewOutcome",
              routeId,
              status,
              counselSummary: counselSummary.trim(),
              recommendedAction: recommendedAction.trim(),
              reviewerNote: reviewerNote.trim()
            },
            { title: "District counsel response recorded", detail: selectedRoute?.issue || "Counsel-response metadata saved." }
          )
        }
      >
        Record counsel response
      </Button>
    </div>
  );
}

function DraftingView({ state, dispatch, exportRecord }) {
  const [profile, setProfile] = useState("Fictional grade 6 learner with reading comprehension needs, strong verbal participation, and emerging self-advocacy.");
  const [guidedResponses, setGuidedResponses] = useState(() => defaultDraftGuidedResponses());
  const [annotatedSample, setAnnotatedSample] = useState(
    "Annotated sample cue: include baseline, method, frequency, mastery criterion, and review schedule before any official use."
  );
  const draftApproved = state.draft?.status === "Approved for export";
  const canExportDraft = Boolean(state.draft && draftApproved && can(state, "export"));
  const exportTitle = !state.draft
    ? undefined
    : !draftApproved
      ? "Draft sections require human approval before export."
      : !can(state, "export")
        ? "Current role cannot export draft sections."
        : undefined;
  return (
    <section className="page">
      <PageHead
        label="Drafting and training"
        title="Generate practice sections without bypassing human review."
        description="This workflow supports fictional training examples and draft section preparation. Drafts are not official IEP content until reviewed and approved."
        actions={state.draft ? (
          <Button
            icon={Download}
            disabled={!canExportDraft}
            title={exportTitle}
            onClick={() => exportRecord("Draft training IEP sections", state.draft)}
          >
            Export draft
          </Button>
        ) : null}
      />
      <div className="grid two-one">
        <Card title="Guided profile" description="Answer core prompts before any draft section is generated.">
          <label className="field">
            <span>Student profile, meeting notes, or assessment summary</span>
            <textarea value={profile} onChange={(event) => setProfile(event.target.value)} />
          </label>
          <h3 className="section-title">Guided intake questionnaire</h3>
          {[
            ["strengths", "Primary strengths"],
            ["needs", "Priority needs"],
            ["progressEvidence", "Progress evidence"],
            ["familyPriority", "Family or team priority"],
            ["studentVoice", "Student voice"]
          ].map(([key, label]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <textarea
                aria-label={label}
                value={guidedResponses[key]}
                onChange={(event) =>
                  setGuidedResponses((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </label>
          ))}
          <label className="field">
            <span>Annotated sample or district language</span>
            <textarea
              aria-label="Annotated sample or district language"
              value={annotatedSample}
              onChange={(event) => setAnnotatedSample(event.target.value)}
            />
          </label>
          <div className="button-row">
            <Button
              variant="primary"
              icon={Sparkles}
              disabled={!can(state, "generateDraft")}
              title={!can(state, "generateDraft") ? "Current role cannot generate draft IEP sections." : undefined}
              onClick={() =>
                dispatch(
                  { type: "createDraft", profile, guidedResponses, annotatedSample },
                  { title: "Draft generated", detail: "Sections are labeled for human review." }
                )
              }
            >
              Generate fictional training IEP
            </Button>
          </div>
        </Card>
        <Card title="Draft package" description="Editable draft sections with preserved version history before export.">
          {!can(state, "reviseDraft") ? (
            <AccessNotice text={`${roles[state.user.role].label} can review draft sections but cannot revise draft language.`} />
          ) : null}
          {state.draft ? (
            <>
              <div className="note">
                <strong>{state.draft.status}</strong>
                <span>
                  {draftApproved
                    ? `Approved by ${state.draft.approvedBy} before export.`
                    : "Human approval is required before these draft sections can be exported."}
                </span>
              </div>
              <div className="draft-list">
                {state.draft.sections.map((section) => (
                  <article className="draft-section" key={draftSectionKey(section)}>
                    <Badge tone="purple">{section.status || "Draft - review required"}</Badge>
                    <h3>{section.heading}</h3>
                    <div className="chips">
                      <span>Version {section.version || 1}</span>
                      <span>{(section.versionHistory || []).length} prior version{(section.versionHistory || []).length === 1 ? "" : "s"}</span>
                      {section.reviewedBy ? <span>Reviewed by {section.reviewedBy}</span> : null}
                    </div>
                    <p>{section.content}</p>
                    {section.revisionNote ? <p className="card-note">Review note: {section.revisionNote}</p> : null}
                    {(section.versionHistory || []).length ? (
                      <details className="version-history">
                        <summary>Version history</summary>
                        {(section.versionHistory || []).map((entry) => (
                          <p key={`${draftSectionKey(section)}-${entry.version}-${entry.savedAt}`}>
                            v{entry.version}: {entry.content}
                          </p>
                        ))}
                      </details>
                    ) : null}
                  </article>
                ))}
              </div>
              <DraftRevisionForm
                draft={state.draft}
                dispatch={dispatch}
                disabled={!can(state, "reviseDraft")}
              />
              <div className="button-row">
                <Button
                  variant="primary"
                  icon={ShieldCheck}
                  disabled={!can(state, "approveDraft") || draftApproved}
                  title={!can(state, "approveDraft") ? "Current role cannot approve draft section packages." : undefined}
                  onClick={() =>
                    dispatch(
                      { type: "approveDraft", draftId: state.draft.id },
                      { title: "Draft package approved", detail: "Draft sections can now be exported." }
                    )
                  }
                >
                  Approve draft for export
                </Button>
              </div>
            </>
          ) : (
            <EmptyState title="No draft yet" text="Generate a fictional training example to populate draft sections." />
          )}
        </Card>
      </div>
    </section>
  );
}

function AuditView({ state, navigate, dispatch, exportRecord, downloadRetentionPackage }) {
  const activeSourceAlignment = sourceAlignmentForState(state);
  const registryEntries = state.sourceRegistry?.entries || [];
  const accessibilityChecks = accessibilityChecksForState(state);
  const accessibilityCertification = accessibilityCertificationForState(state);
  const latestAccessibilityReview = accessibilityCertification.reviews[0] || null;
  const notificationDeliveries = state.notificationDeliveries || [];
  const calendarEvents = state.calendarEvents || [];
  const complianceReviews = state.complianceReviews || [];
  const securitySessions = state.securitySessions || [];
  const securityReviews = state.securityReviews || [];
  const securityPosture = state.securityPosture || {};
  const aiGovernance = aiGovernanceForState(state);
  const latestAiEvaluation = aiGovernance.evaluationRuns[0] || null;
  const latestAiCitationEvaluation = aiGovernance.citationEvaluations[0] || null;
  const auditAnchors = state.auditAnchors || [];
  const auditRetentionPackages = state.auditRetentionPackages || [];
  const retentionPolicyReviews = canViewRetentionPolicyReviewsForRole(state.user.role) ? (state.retentionPolicyReviews || []) : [];
  const exportTemplateReviews = canViewExportTemplateReviewsForRole(state.user.role) ? (state.exportTemplateReviews || []) : [];
  const districtPackageExports = (state.exports || []).filter((item) => /district system package/i.test(item.label || ""));
  const latestVerifiedAnchor = auditAnchors.find((anchor) => !/seed/i.test(anchor.status || "")) || null;
  return (
    <section className="page">
      <PageHead
        label="Traceability and access"
        title="Show what changed, who touched it, and what source supports it."
        description="The workspace distinguishes official source content, user-entered notes, AI-assisted drafts, advisory findings, exports, and final human actions."
        actions={
          <Button
            icon={Download}
            disabled={!can(state, "export")}
            title={!can(state, "export") ? "Current role cannot export audit packets." : undefined}
            onClick={() => exportRecord("Audit packet", state.auditLog)}
          >
            Export audit packet
          </Button>
        }
      />
      <Tabs active="audit" navigate={navigate} />
      <div className="audit-layout">
        <div className="stack">
          <Card title="Source chain" description="How an official IEP becomes trackable work without losing fidelity.">
            <div className="source-chain">
              {[
                ["Registry", `${activeSourceAlignment.jurisdiction} school-age IEP`, `${activeSourceAlignment.sourceId} · ${activeSourceAlignment.sourceRegistryVersion}`],
                ["Document", "Preserved source file", "Original upload retained and never overwritten."],
                ["Structured record", "Human-approved fields", "Goals, services, accommodations, and meetings mapped to source."],
                ["Workflows", "Role-aware outputs", "Summaries, checklists, review flags, and packets inherit citations."]
              ].map(([label, title, detail]) => (
                <div className="source-step" key={label}>
                  <span>{label}</span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
              ))}
            </div>
            <div className="list">
              {registryEntries.map((entry) => (
                <div className="question" key={entry.sourceId}>
                  <strong>{entry.title}</strong>
                  <span>{entry.sourceType} · {entry.programArea} · effective {formatDate(entry.effectiveDate)}</span>
                  <span>Use: {(entry.productUse || []).join(", ")}</span>
                  <span>Languages: {(entry.languagesAvailable || ["English"]).join(", ")}</span>
                  {entry.languageAvailabilityNote ? <small>{entry.languageAvailabilityNote}</small> : null}
                  <span>
                    Review: {entry.reviewStatus || "Not reviewed"} · next {entry.nextReviewDate ? formatDate(entry.nextReviewDate) : "not scheduled"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Source registry review" description="Track form-version review without overwriting source-aligned IEP records.">
            <div className="list">
              {registryEntries.map((entry) => (
                <div className="question-row" key={`review-${entry.sourceId}`}>
                  <div>
                    <strong>{entry.title}</strong>
                    <span>
                      {entry.sourceType} · retrieved {entry.retrievedDate ? formatDate(entry.retrievedDate) : "not recorded"} · next review {entry.nextReviewDate ? formatDate(entry.nextReviewDate) : "not scheduled"}
                    </span>
                    <span>{entry.reviewNote || "No source review note recorded."}</span>
                    {entry.reviewedBy ? (
                      <small>Reviewed by {entry.reviewedBy}{entry.reviewedAt ? ` on ${formatDate(entry.reviewedAt)}` : ""}</small>
                    ) : null}
                  </div>
                  <Badge tone={sourceRegistryReviewTone(entry.reviewStatus)}>{entry.reviewStatus || "Not reviewed"}</Badge>
                </div>
              ))}
            </div>
            {!can(state, "reviewSourceRegistry") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review source metadata but cannot update source registry review status.`} />
            ) : null}
            <SourceRegistryReviewForm
              entries={registryEntries}
              dispatch={dispatch}
              disabled={!can(state, "reviewSourceRegistry")}
            />
          </Card>
          <Card title="Source registry administration" description="Add or update district-approved source versions and optionally make one active for future source alignment.">
            <div className="list">
              <div className="question">
                <strong>Active source</strong>
                <span>{activeSourceAlignment.sourceForm}</span>
                <span>{activeSourceAlignment.sourceId} · {activeSourceAlignment.sourceRegistryVersion}</span>
                <small>{activeSourceAlignment.jurisdiction} · {activeSourceAlignment.programArea}</small>
              </div>
            </div>
            {!can(state, "manageSourceRegistry") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review source metadata but cannot administer registry entries or active source versions.`} />
            ) : null}
            <SourceRegistryAdminForm
              registry={state.sourceRegistry || {}}
              dispatch={dispatch}
              disabled={!can(state, "manageSourceRegistry")}
            />
          </Card>
          <Card title="Export template review" description="Review district-system package mappings without submitting to production systems.">
            <div className="list">
              {exportTemplateReviews.length ? (
                exportTemplateReviews.slice(0, 4).map((review) => (
                  <div className="question-row" key={review.id}>
                    <div>
                      <strong>{review.templateName}</strong>
                      <span>{review.targetSystem} · {review.templateVersion} · {review.format}</span>
                      <span>{review.mappingStatus} · {review.submissionMode}</span>
                      <span>{review.mappingEvidence}</span>
                      {review.packageFileName ? <small>{review.packageFileName} · {shortHash(review.packageSha256)}</small> : null}
                      <small>{review.reviewedBy} · {formatDateTime(review.reviewedAt)}</small>
                      {review.productionBoundary ? <small>{review.productionBoundary}</small> : null}
                    </div>
                    <Badge tone={exportTemplateTone(`${review.validationStatus} ${review.mappingStatus} ${review.submissionMode}`)}>
                      {review.validationStatus}
                    </Badge>
                  </div>
                ))
              ) : (
                <EmptyState title="No export template reviews" text="Generate a district package, then record local mapping validation evidence." />
              )}
            </div>
            {!can(state, "reviewExportTemplates") ? (
              <AccessNotice text={`${roles[state.user.role].label} can generate permitted exports but cannot review district-system template mappings.`} />
            ) : null}
            <ExportTemplateReviewForm
              exports={districtPackageExports}
              dispatch={dispatch}
              disabled={!can(state, "reviewExportTemplates")}
            />
          </Card>
          <Card title="Activity log" description="Required events from upload through exports.">
            <div className="timeline">
              {state.auditLog.map((event) => (
                <article className="timeline-event" key={event.id}>
                  <span><Clock3 size={15} /></span>
                  <div>
                    <strong>{event.title}</strong>
                    <p>{event.detail}</p>
                  </div>
                  <small>{event.actor}<br />{formatDateTime(event.timestamp)}</small>
                </article>
              ))}
            </div>
          </Card>
          <Card title="Audit anchoring" description="Capture a verified hash-chain digest for external retention or review.">
            <div className="list">
              {auditAnchors.length ? (
                auditAnchors.slice(0, 4).map((anchor) => (
                  <div className="question-row" key={anchor.id}>
                    <div>
                      <strong>{anchor.status}</strong>
                      <span>Sequence {anchor.anchoredSequence} · {anchor.anchorScope}</span>
                      <span>Digest {shortHash(anchor.anchorDigest)} · hash {shortHash(anchor.anchoredHash)}</span>
                      <span>{anchor.externalReference}</span>
                      {anchor.externalTimestampReceipt ? (
                        <span>
                          Timestamp receipt {anchor.externalTimestampReceipt.provider} · {anchor.externalTimestampReceipt.receiptId}
                        </span>
                      ) : null}
                      <small>{anchor.createdBy} · {formatDateTime(anchor.createdAt)} · {anchor.verificationStatus}</small>
                      {anchor.externalTimestampReceipt ? (
                        <small>
                          Receipt digest {shortHash(anchor.externalTimestampReceipt.receiptDigest)} · {anchor.externalTimestampReceipt.productionBoundary}
                        </small>
                      ) : null}
                    </div>
                    <Badge tone={auditAnchorTone(anchor.status)}>{anchor.status}</Badge>
                  </div>
                ))
              ) : (
                <EmptyState title="No audit anchors" text="Create an anchor after verifying the audit chain." />
              )}
            </div>
            {!can(state, "manageAuditAnchors") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review visible audit activity but cannot create hash-chain anchors.`} />
            ) : null}
            <AuditAnchorForm
              dispatch={dispatch}
              disabled={!can(state, "manageAuditAnchors")}
            />
            <ExternalTimestampReceiptForm
              latestAnchor={latestVerifiedAnchor}
              dispatch={dispatch}
              disabled={!can(state, "manageAuditAnchors")}
            />
          </Card>
          <Card title="Retention packages" description="Seal a local write-once manifest that binds the verified audit chain, anchor digest, and workspace evidence hashes.">
            <div className="list">
              {auditRetentionPackages.length ? (
                auditRetentionPackages.slice(0, 4).map((retentionPackage) => (
                  <div className="question-row" key={retentionPackage.id}>
                    <div>
                      <strong>{retentionPackage.status}</strong>
                      <span>Anchor sequence {retentionPackage.anchoredSequence} · {retentionPackage.retentionScope}</span>
                      <span>Package {shortHash(retentionPackage.packageDigest)} · anchor {shortHash(retentionPackage.anchorDigest)}</span>
                      <span>{retentionPackage.artifact?.fileName || retentionPackage.retentionMode}</span>
                      <small>{retentionPackage.createdBy} · {formatDateTime(retentionPackage.createdAt)} · {retentionPackage.verificationStatus}</small>
                    </div>
                    <div className="button-row">
                      <Badge tone={auditAnchorTone(retentionPackage.status)}>{retentionPackage.status}</Badge>
                      {retentionPackage.downloadUrl ? (
                        <Button icon={Download} onClick={() => downloadRetentionPackage(retentionPackage)}>
                          Download manifest
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="No retention packages" text="Seal a package after creating a verified audit anchor." />
              )}
            </div>
            {!can(state, "manageAuditAnchors") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review visible audit activity but cannot seal retention manifests.`} />
            ) : null}
            <AuditRetentionPackageForm
              latestAnchor={latestVerifiedAnchor}
              dispatch={dispatch}
              disabled={!can(state, "manageAuditAnchors")}
            />
          </Card>
          {canViewRetentionPolicyReviewsForRole(state.user.role) ? (
            <Card title="Retention policy review" description="Record district schedule, legal-hold, archive, and purge boundaries without enforcing production retention rules.">
              <div className="list">
                {retentionPolicyReviews.length ? (
                  retentionPolicyReviews.slice(0, 4).map((review) => (
                    <div className="question-row" key={review.id}>
                      <div>
                        <strong>{review.disposition}</strong>
                        <span>{review.policyScope} · {review.policySource}</span>
                        <span>Hold: {review.legalHoldStatus} · archive: {review.archiveDecision}</span>
                        <small>{review.retentionPeriod}</small>
                        <small>{review.evidenceSummary}</small>
                        <small>
                          Reviewed by {review.reviewedBy} on {formatDateTime(review.reviewedAt)} · digest {shortHash(review.policyDigest)}
                        </small>
                        <small>{review.productionBoundary}</small>
                      </div>
                      <Badge tone={retentionPolicyTone(`${review.disposition} ${review.archiveDecision} ${review.legalHoldStatus}`)}>
                        {review.nextReviewDate ? formatDate(review.nextReviewDate) : "No date"}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No retention policy reviews" text="Record a local policy review before relying on archive, purge, or legal-hold workflows." />
                )}
              </div>
              {!can(state, "reviewRetentionPolicy") ? (
                <AccessNotice text={`${roles[state.user.role].label} can view retention policy records but cannot record district policy decisions.`} />
              ) : null}
              <RetentionPolicyReviewForm
                packages={auditRetentionPackages}
                anchors={auditAnchors}
                dispatch={dispatch}
                disabled={!can(state, "reviewRetentionPolicy")}
              />
            </Card>
          ) : null}
        </div>
        <div className="stack">
          <Card title="Current access lens" description={roles[state.user.role].label}>
            <div className="access-list">
              {roles[state.user.role].can.map((item) => (
                <div className="access-row" key={item}><Check size={14} /><span>{item}</span><Badge tone="green">Allowed</Badge></div>
              ))}
              {roles[state.user.role].cannot.map((item) => (
                <div className="access-row denied" key={item}><X size={14} /><span>{item}</span><Badge tone="red">Blocked</Badge></div>
              ))}
            </div>
          </Card>
          <Card title="Session governance" description="Demo session review for role-aware access hardening.">
            <div className="list">
              <div className="question">
                <strong>{securityPosture.identityProvider || "Demo identity provider"}</strong>
                <span>MFA: {securityPosture.mfaStatus || securityPosture.mfaPolicy || "Production MFA policy not configured"}</span>
                <span>Tenant: {securityPosture.tenantBoundaryStatus || "Single-district demo tenant"}</span>
                <span>Roles: {securityPosture.roleProvisioningStatus || "Manual demo roles"}</span>
                <span>Session TTL: {securityPosture.sessionTtlHours || 8} hours · {securityPosture.reviewStatus || "Needs review"}</span>
                <small>{securityPosture.retentionNote || "Security review notes are retained in the audit trail."}</small>
              </div>
              {securitySessions.length ? (
                securitySessions.slice(0, 5).map((sessionRecord) => (
                  <div className="question-row" key={sessionRecord.id}>
                    <div>
                      <strong>{sessionRecord.userName}</strong>
                      <span>{roles[sessionRecord.role]?.label || sessionRecord.role} · {sessionRecord.authMethod}</span>
                      <span>Last seen {formatDateTime(sessionRecord.lastSeenAt)} · expires {formatDateTime(sessionRecord.expiresAt)}</span>
                      <small>{sessionRecord.mfaVerified ? "MFA verified" : "MFA not verified in demo session"}</small>
                    </div>
                    <Badge tone={securitySessionTone(sessionRecord.status)}>{sessionRecord.status}</Badge>
                  </div>
                ))
              ) : (
                <EmptyState title="No session details visible" text="Only administrators can review live demo sessions." />
              )}
              {securityReviews.length ? (
                <div className="question">
                  <strong>Latest security review</strong>
                  <span>{securityReviews[0].action} · {securityReviews[0].status}</span>
                  {securityReviews[0].tenantBoundaryStatus ? <span>Tenant: {securityReviews[0].tenantBoundaryStatus}</span> : null}
                  {securityReviews[0].roleProvisioningStatus ? <span>Roles: {securityReviews[0].roleProvisioningStatus}</span> : null}
                  <span>{securityReviews[0].note}</span>
                  {securityReviews[0].productionBoundary ? <small>{securityReviews[0].productionBoundary}</small> : null}
                  <small>{securityReviews[0].reviewedBy} · {formatDateTime(securityReviews[0].reviewedAt)}</small>
                </div>
              ) : null}
            </div>
            {!can(state, "manageSecurity") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review their access lens but cannot manage security sessions.`} />
            ) : null}
            <SessionGovernanceForm
              sessions={securitySessions}
              currentSessionId={state.currentSecuritySessionId}
              dispatch={dispatch}
              disabled={!can(state, "manageSecurity")}
            />
          </Card>
          <Card title="Content classification" description="Visual distinction required by the FDS.">
            <div className="list">
              <QualityRow icon={FileText} title="Official source content" text="Uploaded IEP text and source registry metadata." />
              <QualityRow icon={Edit3} title="User-entered notes" text="Progress entries, implementation notes, and meeting concerns." />
              <QualityRow icon={Sparkles} title="AI-assisted output" text="Draft summaries, checklist suggestions, and advisory flags." warn />
              <QualityRow icon={ShieldCheck} title="Human-reviewed action" text="Approvals, resolved findings, and shared packets." />
            </div>
          </Card>
          <Card title="AI governance" description="Local model profile and guardrail evaluation evidence.">
            <div className="list">
              <div className="question">
                <strong>{aiGovernance.modelProfile.model}</strong>
                <span>{aiGovernance.modelProfile.provider} · {aiGovernance.modelProfile.modelMode}</span>
                <span>Prompt {aiGovernance.modelProfile.promptVersion} · threshold {aiGovernance.modelProfile.evaluationThreshold}%</span>
                <small>{aiGovernance.modelProfile.retrievalPolicy}</small>
              </div>
              {latestAiEvaluation ? (
                <>
                  <div className="question-row">
                    <div>
                      <strong>{latestAiEvaluation.evaluationScope}</strong>
                      <span>{latestAiEvaluation.score}% · {latestAiEvaluation.passedChecks}/{latestAiEvaluation.totalChecks} checks passing</span>
                      <span>{latestAiEvaluation.reviewerNote}</span>
                      <small>Digest {shortHash(latestAiEvaluation.evaluationDigest)} · {latestAiEvaluation.runBy} · {formatDateTime(latestAiEvaluation.runAt)}</small>
                    </div>
                    <Badge tone={aiGovernanceTone(latestAiEvaluation.status)}>{latestAiEvaluation.status}</Badge>
                  </div>
                  {(latestAiEvaluation.checks || []).map((check) => (
                    <div className="question" key={check.id}>
                      <strong>{check.title}</strong>
                      <span>{check.requirement}</span>
                      <small>{check.evidence}</small>
                    </div>
                  ))}
                </>
              ) : (
                <EmptyState title="No AI evaluations" text="Run a guardrail evaluation to record source, label, restricted-request, and human-review checks." />
              )}
              {latestAiCitationEvaluation ? (
                <>
                  <div className="question-row">
                    <div>
                      <strong>{latestAiCitationEvaluation.outputLabel}</strong>
                      <span>
                        Citation evaluation: {latestAiCitationEvaluation.score}% · {latestAiCitationEvaluation.passedChecks}/{latestAiCitationEvaluation.totalChecks} checks passing
                      </span>
                      <span>
                        Matched citations: {(latestAiCitationEvaluation.matchedSources || []).map((source) => source.sourceReference).join("; ") || "none"}
                      </span>
                      <small>
                        Digest {shortHash(latestAiCitationEvaluation.citationDigest)} · {latestAiCitationEvaluation.evaluatedBy} · {formatDateTime(latestAiCitationEvaluation.evaluatedAt)}
                      </small>
                    </div>
                    <Badge tone={aiGovernanceTone(latestAiCitationEvaluation.status)}>{latestAiCitationEvaluation.status}</Badge>
                  </div>
                  {(latestAiCitationEvaluation.checks || []).map((check) => (
                    <div className="question" key={`citation-${check.id}`}>
                      <strong>{check.title}</strong>
                      <span>{check.requirement}</span>
                      <small>{check.evidence}</small>
                    </div>
                  ))}
                </>
              ) : (
                <EmptyState title="No citation evaluations" text="Run citation evaluation before sharing AI-assisted summaries, checklists, or meeting language." />
              )}
            </div>
            {!can(state, "manageAiGovernance") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review AI governance evidence but cannot run guardrail evaluations.`} />
            ) : null}
            <AiGovernanceEvaluationForm
              dispatch={dispatch}
              disabled={!can(state, "manageAiGovernance")}
            />
            <AiCitationEvaluationForm
              dispatch={dispatch}
              disabled={!can(state, "manageAiGovernance")}
            />
          </Card>
          <Card title="Notification delivery log" description="Reminder and packet notices are tracked separately from official IEP changes.">
            <div className="list">
              {notificationDeliveries.length ? (
                notificationDeliveries.slice(0, 5).map((delivery) => (
                  <div className="question" key={`audit-${delivery.id}`}>
                    <strong>{delivery.sourceTitle}</strong>
                    <span>{notificationAudienceLabel(delivery.audience)} · {delivery.channel} · {delivery.status}</span>
                    <span>{delivery.message}</span>
                    <small>{delivery.sentBy} · {formatDateTime(delivery.sentAt)}</small>
                  </div>
                ))
              ) : (
                <EmptyState title="No notification history" text="No reminder or packet notices have been recorded yet." />
              )}
            </div>
          </Card>
          <Card title="Calendar hold log" description="Meeting scheduling artifacts are tracked without connecting live district calendars.">
            <div className="list">
              {calendarEvents.length ? (
                calendarEvents.slice(0, 5).map((event) => (
                  <div className="question" key={`calendar-${event.id}`}>
                    <strong>{event.title}</strong>
                    <span>{formatDate(event.startDate)} · {event.startTime} · {event.provider}</span>
                    <span>{event.attendanceMode} · {event.status}</span>
                    <small>{event.createdBy} · {formatDateTime(event.createdAt)}</small>
                  </div>
                ))
              ) : (
                <EmptyState title="No calendar holds" text="No meeting calendar holds have been recorded yet." />
              )}
            </div>
          </Card>
          <Card title="Compliance review log" description="Formal human review records remain separate from AI advisory findings.">
            <div className="list">
              {complianceReviews.length ? (
                complianceReviews.slice(0, 5).map((review) => (
                  <div className="question" key={`compliance-${review.id}`}>
                    <strong>{review.issue}</strong>
                    <span>{review.reviewType} · {review.status}</span>
                    <span>Reviewer: {review.assignedReviewer} · due {formatDate(review.dueDate)}</span>
                    <span>{review.outcome || review.rationale}</span>
                    <small>
                      Requested by {review.requestedBy}{review.reviewedBy ? ` · reviewed by ${review.reviewedBy}` : ""} · not legal certification
                    </small>
                  </div>
                ))
              ) : (
                <EmptyState title="No formal compliance reviews" text="No escalated implementation review records have been logged yet." />
              )}
            </div>
          </Card>
          <Card title="Accessibility review" description="VPAT-style evidence, WCAG checks, assistive-technology testing, and remediation status.">
            <div className="list">
              <div className="question">
                <strong>{accessibilityCertification.standard}</strong>
                <span>{accessibilityCertification.conformanceTarget} · {accessibilityCertification.vpatVersion}</span>
                <span>{accessibilityCertification.assistiveTechnologyStatus}</span>
                <small>{accessibilityCertification.externalAuditStatus}</small>
              </div>
              {accessibilityChecks.map((item) => (
                <QualityRow
                  key={item.title}
                  icon={item.icon}
                  title={item.title}
                  text={item.text}
                  warn={item.warn}
                />
              ))}
              {(accessibilityCertification.findings || []).map((finding) => (
                <div className="question-row" key={finding.id}>
                  <div>
                    <strong>{finding.title}</strong>
                    <span>{finding.criterion} · {finding.assistiveTechnology}</span>
                    <span>Owner: {finding.owner} · due {formatDate(finding.dueDate)}</span>
                    <span>{finding.remediationPlan}</span>
                    <small>{finding.evidence} · {finding.verificationNote}</small>
                  </div>
                  <Badge tone={accessibilityFindingTone(finding.status, finding.severity)}>
                    {finding.status} · {finding.severity}
                  </Badge>
                </div>
              ))}
              {latestAccessibilityReview ? (
                <div className="question">
                  <strong>Latest accessibility remediation</strong>
                  <span>{latestAccessibilityReview.findingTitle} · {latestAccessibilityReview.status}</span>
                  <small>Digest {shortHash(latestAccessibilityReview.accessibilityDigest)} · {latestAccessibilityReview.reviewedBy} · {formatDateTime(latestAccessibilityReview.reviewedAt)}</small>
                </div>
              ) : null}
            </div>
            {!can(state, "manageAccessibility") ? (
              <AccessNotice text={`${roles[state.user.role].label} can review accessibility evidence but cannot update remediation findings.`} />
            ) : null}
            <AccessibilityRemediationForm
              findings={accessibilityCertification.findings}
              dispatch={dispatch}
              disabled={!can(state, "manageAccessibility")}
            />
          </Card>
        </div>
      </div>
    </section>
  );
}

function AdminView({ state, dispatch }) {
  const dashboard = useMemo(() => adminDashboardForState(state), [state]);
  const districtConfiguration = districtConfigurationForState(state);
  const latestConfigurationReview = districtConfiguration.configurationReviews[0] || null;
  const latestConfigurationReviewTitle =
    latestConfigurationReview?.integrationName || latestConfigurationReview?.controlName || "Configuration review";
  const latestConfigurationReviewDigest =
    latestConfigurationReview?.configurationDigest || latestConfigurationReview?.dataProtectionDigest || "";

  return (
    <section className="page">
      <PageHead
        label="Operational oversight"
        title="See capacity risks without losing student-level context."
        description="Leadership views aggregate deadlines, service gaps, caseload balance, and implementation status while preserving role-based access."
      />
      <div className="metrics">
        <Metric label="IEPs due soon" value={dashboard.dueSoon.length} note="Annual reviews in next 30 days" icon={CalendarDays} tone="amber" />
        <Metric label="Overdue progress reports" value={dashboard.overdueProgress.length} note="Goal schedules past due" icon={BarChart3} tone="red" />
        <Metric label="Missing service logs" value={dashboard.missingServiceLogs.length} note="Scheduled minutes not fully documented" icon={ClipboardCheck} tone="red" />
        <Metric label="Drafts pending review" value={dashboard.draftsPending.length} note="Draft or generated packages awaiting approval" icon={Sparkles} tone="purple" />
        <Metric label="Compliance flags" value={dashboard.openFlags.length} note="Advisory findings requiring review" icon={AlertTriangle} tone="amber" />
        <Metric label="Continuity risks" value={dashboard.highContinuityRisks.length} note="Vacancy or coverage risks needing review" icon={Users} tone="red" />
        <Metric label="Caseload overview" value={state.students.length} note={`${dashboard.schoolRows.length} schools represented`} icon={Users} tone="blue" />
      </div>
      <GapClosurePanel state={state} dispatch={dispatch} canManage={can(state, "manageGapClosure")} />
      <div className="grid two-one">
        <Card title="Compliance flags by school" description="Open advisory findings grouped by building for follow-up.">
          {dashboard.schoolRows.map((row) => (
            <div className="capacity-row" key={row.school}>
              <span>{row.school}</span>
              <ProgressBar value={row.riskPercent} tone={row.tone} />
              <strong>{row.openFlags}</strong>
            </div>
          ))}
        </Card>
        <Card title="Leadership work queue" description="Operational signals across upcoming reviews, stale data, and service documentation.">
          <div className="list">
            {dashboard.workQueue.map((item) => (
              <AlertRow
                key={`${item.type}-${item.title}`}
                tone={item.tone}
                icon={item.icon}
                title={item.title}
                description={item.description}
                meta={item.meta}
              />
            ))}
          </div>
        </Card>
      </div>
      <div className="grid equal">
        <Card title="Staff continuity risks" description="Vacancy, coverage, and continuity items tied to affected IEP services.">
          <div className="list">
            {dashboard.continuityRows.map((row) => (
              <div className="question-row" key={row.id}>
                <div>
                  <strong>{row.role}</strong>
                  <span>{row.school} · {row.providerName}</span>
                  <span>{row.affectedStudents} · {row.affectedServices.join(", ")}</span>
                  <small>{row.coveragePlan}</small>
                </div>
                <Badge tone={row.tone}>{row.riskLevel} risk</Badge>
              </div>
            ))}
          </div>
          {!can(state, "updateStaffContinuity") ? (
            <AccessNotice text="Only administrator role can update staffing continuity plans." />
          ) : null}
          <StaffContinuityForm
            records={dashboard.continuityRows}
            dispatch={dispatch}
            disabled={!can(state, "updateStaffContinuity")}
          />
        </Card>
        <Card title="Privacy boundary" description="Operational signals, not unrestricted records.">
          <div className="note">
            <strong>Role-aware aggregation</strong>
            <span>Detailed student content stays hidden unless the user has an authorized educational need. Leadership sees counts, queues, and student-level indicators only within authorized scope.</span>
          </div>
        </Card>
        <Card title="District implementation readiness" description="Configuration and integration readiness for a district deployment.">
          <div className="list">
            <div className="question">
              <strong>{districtConfiguration.districtName}</strong>
              <span>{districtConfiguration.jurisdiction} · {districtConfiguration.tenancyMode}</span>
              <span>{districtConfiguration.configurationVersion} · {districtConfiguration.dataResidency}</span>
              <small>{districtConfiguration.registryGovernanceStatus}</small>
            </div>
            {(districtConfiguration.integrationReadiness || []).length ? (
              districtConfiguration.integrationReadiness.map((integration) => (
                <div className="question-row" key={integration.id}>
                  <div>
                    <strong>{integration.name}</strong>
                    <span>{integration.category} · {integration.provider}</span>
                    <span>Owner: {integration.owner} · next review {formatDate(integration.nextReviewDate)}</span>
                    <span>{integration.note}</span>
                    <small>{(integration.productUse || []).join(", ")}{integration.reviewedBy ? ` · reviewed by ${integration.reviewedBy}` : ""}</small>
                  </div>
                  <Badge tone={districtIntegrationTone(integration.status)}>{integration.status}</Badge>
                </div>
              ))
            ) : (
              <EmptyState title="No integration records" text="Administrator-only district readiness records are restricted for this role." />
            )}
            {(districtConfiguration.dataProtectionReadiness || []).length ? (
              <>
                <strong className="section-title">Data protection readiness</strong>
                {districtConfiguration.dataProtectionReadiness.map((control) => (
                  <div className="question-row" key={control.id}>
                    <div>
                      <strong>{control.name}</strong>
                      <span>{control.category} · {control.control}</span>
                      <span>Owner: {control.owner} · next review {formatDate(control.nextReviewDate)}</span>
                      <span>{control.evidenceNote}</span>
                      <small>{control.productionBoundary}{control.reviewedBy ? ` · reviewed by ${control.reviewedBy}` : ""}</small>
                    </div>
                    <Badge tone={districtIntegrationTone(control.status)}>{control.status}</Badge>
                  </div>
                ))}
              </>
            ) : (
              <EmptyState title="Data protection readiness restricted" text="Administrator-only storage, encryption, backup, migration, and deployment readiness records are restricted for this role." />
            )}
            {latestConfigurationReview ? (
              <div className="question">
                <strong>Latest readiness review</strong>
                <span>{latestConfigurationReviewTitle} · {latestConfigurationReview.status}</span>
                <small>Digest {shortHash(latestConfigurationReviewDigest)} · {latestConfigurationReview.reviewedBy} · {formatDateTime(latestConfigurationReview.reviewedAt)}</small>
              </div>
            ) : null}
          </div>
          {!can(state, "manageDistrictConfiguration") ? (
            <AccessNotice text={`${roles[state.user.role].label} can review limited district readiness context but cannot update integration configuration.`} />
          ) : null}
          <DistrictIntegrationReadinessForm
            integrations={districtConfiguration.integrationReadiness}
            dispatch={dispatch}
            disabled={!can(state, "manageDistrictConfiguration")}
          />
          <DataProtectionReadinessForm
            controls={districtConfiguration.dataProtectionReadiness}
            dispatch={dispatch}
            disabled={!can(state, "manageDistrictConfiguration")}
          />
        </Card>
      </div>
      <Card title="Caseload overview" description="Student-level operational indicators without exposing unrelated record detail.">
        <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>School</th>
              <th>Annual review</th>
              <th>Progress due</th>
              <th>Service gaps</th>
              <th>Open flags</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.caseloadRows.map((row) => (
              <tr key={row.student.id}>
                <td><Person student={row.student} /></td>
                <td>{row.student.school}</td>
                <td>{formatDate(row.student.annualReviewDate)}</td>
                <td><Badge tone={row.progressDue ? "red" : "green"}>{row.progressDue}</Badge></td>
                <td><Badge tone={row.serviceGaps ? "red" : "green"}>{row.serviceGaps}</Badge></td>
                <td><Badge tone={row.openFlags ? "amber" : "green"}>{row.openFlags}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

function AssistantDrawer({ open, setOpen, state, dispatch }) {
  const activeStudentName = studentName(state, state.currentStudentId);
  const activeRecordLabel = currentStudentHasApprovedRecord(state) ? "approved IEP + implementation record" : "draft intake workspace";
  const [mode, setMode] = useState("Explain");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text:
        "Mode: Explain. I can explain source content, summarize responsibilities, prepare meeting materials, draft training examples, or review confirmed progress data. I will label drafts and avoid inventing obligations."
    }
  ]);
  const [input, setInput] = useState("");

  function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((items) => [
      ...items,
      { role: "user", text: trimmed },
      { role: "assistant", text: assistantResponse(mode, trimmed, state), mode }
    ]);
    setInput("");
    dispatch(
      { type: "recordExport", label: "AI assistant response log" },
      { title: "Assistant response logged", detail: "AI output remains advisory." }
    );
  }

  return (
    <aside className={`assistant ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="assistant-head">
        <Sparkles size={18} />
        <div>
          <strong>IEP Assistant</strong>
          <span>Source-grounded - role-aware - human-reviewed</span>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={17} /></button>
      </div>
      <div className="assistant-context">Context: {activeStudentName} - {activeRecordLabel}</div>
      <div className="assistant-modes" role="tablist" aria-label="Assistant response modes">
        {assistantModes.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={mode === item}
            className={mode === item ? "active" : ""}
            key={item}
            onClick={() => setMode(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="chat">
        {messages.map((message, index) => (
          <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
            {message.role === "assistant" ? (
              <div className="assistant-labels">
                <Badge tone="purple">{message.mode || "Assistant"} draft</Badge>
                <Badge tone="blue">Source-grounded</Badge>
              </div>
            ) : null}
            <p>{message.text}</p>
          </div>
        ))}
      </div>
      <div className="prompt-row">
        {assistantPromptsForMode(mode).map((prompt) => (
          <button type="button" key={prompt} onClick={() => sendMessage(prompt)}>{prompt}</button>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage(input);
        }}
      >
        <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about the active plan or workflow" />
        <button type="submit" aria-label="Send"><Send size={16} /></button>
      </form>
      <p className="disclaimer">AI output is explanatory or advisory and requires qualified human review before use in an official IEP process.</p>
    </aside>
  );
}

function assistantPromptsForMode(mode) {
  return {
    Explain: ["Science accommodations", "What services are listed?", "Parent-friendly explanation"],
    Extract: ["Summarize detected sections", "Review source references", "Extraction approval steps"],
    Summarize: ["Teacher summary", "Parent summary", "Student summary"],
    Checklist: ["Generate teacher checklist", "Progress data due", "Service documentation"],
    Review: ["Are goals measurable?", "Review quality flags", "What needs human review?"],
    Progress: ["Progress monitoring support", "Stale progress data", "Draft progress report language"],
    Draft: ["Draft measurable goal section", "Draft present levels section", "Draft service recovery note"],
    Compare: ["Compare draft and final", "Compare services and logs", "Compare parent and teacher views"],
    "Prepare for meeting": ["Meeting readiness", "Family questions", "Pre-read packet"],
    "Generate fictional training example": ["Fictional IEP example", "Training goal example", "Training service example"]
  }[mode] || ["Science accommodations", "Progress update", "Meeting readiness"];
}

function assistantResponse(mode, text, state) {
  const lower = text.toLowerCase();
  const student = studentName(state, state.currentStudentId);
  const goals = activeIepItemsForState(state, "goals");
  const services = activeIepItemsForState(state, "services");
  const accommodations = activeIepItemsForState(state, "accommodations");
  const currentGoal = goals[0];
  const service = services[0] || null;
  const meeting = currentStudentMeetingForState(state);
  const openFlags = currentStudentReviewFlagsForState(state).filter((flag) => flag.status === "Open");
  const sourceLine = assistantSourceLine(state);
  const guardrail =
    "Guardrail: this is advisory; the IEP team or qualified school personnel must review before any official change.";
  const labelResponse = (body) => `${body} ${assistantContentLabels(state)}`;
  const restrictedResponse = assistantRestrictedRequestResponse(lower, mode, sourceLine, guardrail);

  if (restrictedResponse) {
    return labelResponse(restrictedResponse);
  }

  if (mode === "Extract") {
    return labelResponse(extractionSupportResponse(state, guardrail));
  }

  if (mode === "Summarize") {
    const audience = assistantSummaryAudience(lower);
    return labelResponse(audienceSummaryResponse(state, audience, sourceLine, guardrail));
  }

  if (mode === "Checklist") {
    const tasks = currentStudentTasksForState(state).filter((task) => task.status !== "Completed").slice(0, 4);
    const progressDue = goals
      .filter((goal) => /overdue|due/i.test(goal.progressSchedule?.status || ""))
      .map((goal) => `${goal.domain} ${goal.progressSchedule.status}`)
      .join("; ");
    return labelResponse(`Mode: Checklist. Teacher checklist suggestion: ${tasks.map((task) => `${task.title} (${task.responsibleRole}, ${task.frequency})`).join("; ") || `No approved implementation tasks are available for ${student} yet`}. Progress due: ${progressDue || "none"}. Source references: approved structured obligations and task source sections. ${guardrail}`);
  }

  if (mode === "Review") {
    return labelResponse(`Mode: Review. ${goalMeasurabilityReview(state)} Open advisory flags: ${openFlags.map((flag) => `${flag.issue} (${flag.severity})`).join("; ") || "none"}. I am not making a legal compliance determination. Source references: ${sourceLine}; goal source references; progress schedules; review flags. ${guardrail}`);
  }

  if (mode === "Progress") {
    return labelResponse(progressMonitoringSupportResponse(state, guardrail));
  }

  if (mode === "Draft") {
    if (lower.includes("service recovery") || lower.includes("recovery")) {
      return labelResponse(sensitiveDraftInfoResponse(state, guardrail));
    }
    if (lower.includes("iep section") || lower.includes("present level") || lower.includes("goal section") || lower.includes("measurable goal")) {
      return labelResponse(draftIepSectionResponse(state, lower, guardrail));
    }
    if (lower.includes("progress")) {
      return labelResponse(`Mode: Draft. Draft progress language: ${progressNarrative(currentGoal)} Label: draft progress report language for human review. Source references: confirmed progress entries and measurement schedule. ${guardrail}`);
    }
    const supportList = accommodations.map((item) => item.description).join("; ");
    const serviceList = services.map((item) => item.serviceType).join("; ");
    return labelResponse(`Mode: Draft. Draft parent-friendly language for ${student}: ${supportList || serviceList ? `Supports include ${[supportList, serviceList].filter(Boolean).join("; ")}.` : "No approved supports or services are available in this student's structured record yet."} Label: draft summary, not official IEP language. Source references: ${sourceLine}. ${guardrail}`);
  }

  if (mode === "Compare") {
    const diff = meeting?.draftDiffs?.[0];
    const serviceComparison = service
      ? `${service.serviceType} has ${service.deliveredMinutes}/${service.scheduledMinutes} minutes documented`
      : `No service log is available for ${student}`;
    return labelResponse(`Mode: Compare. Draft-to-final comparison: ${diff ? `${diff.section} draft says "${diff.draftText}" and status is ${diff.status}. Final language: ${diff.finalText || "not finalized yet"}.` : "No draft-to-final differences are available."} Service-log comparison: ${serviceComparison}. Source references: meeting draft diffs and service logs. ${guardrail}`);
  }

  if (mode === "Prepare for meeting") {
    return labelResponse(`Mode: Prepare for meeting. Meeting readiness: ${meeting ? "respond to open family questions, review current progress data, and finalize the pre-read packet" : `no meeting prep record is available for ${student} yet`}. Open questions: ${(meeting?.familyQuestions || []).filter((question) => question.status !== "Answered").map((question) => question.text).join("; ") || "none"}. Source references: meeting agenda, family questions, progress schedule, and service logs. ${guardrail}`);
  }

  if (mode === "Generate fictional training example") {
    return labelResponse("Mode: Generate fictional training example. Fictional draft: A grade 6 learner with strong verbal reasoning and reading-comprehension needs may need a measurable goal with baseline, method, frequency, and mastery criterion, plus clearly labeled services and accommodations. Label: fictional training example only; do not treat as a real student's IEP. Source references: annotated sample cues and FDS drafting workflow. Guardrail: human review required before adapting any language.");
  }

  if (lower.includes("progress")) {
    return labelResponse(`Mode: Explain. ${progressNarrative(currentGoal)} Source references: confirmed progress entries and measurement schedule. ${guardrail}`);
  }
  if (lower.includes("service")) {
    return labelResponse(`Mode: Explain. Services listed: ${services.map((item) => `${item.serviceType}, ${item.frequency}, ${item.duration} minutes, ${item.location}`).join("; ") || `no approved services are listed for ${student} yet`}. Source references: service grid and delivery logs. ${guardrail}`);
  }
  return labelResponse(`Mode: Explain. Source-grounded explanation for ${student}: ${accommodations.length ? accommodations.map((item) => item.description).join("; ") : "no approved accommodations are available yet"}. I will not infer supports, service changes, or time amounts that are not in the selected student's source record. Source references: ${sourceLine}. ${guardrail}`);
}

function extractionSupportResponse(state, guardrail) {
  const document = documentForCurrentStudent(state);
  const activeIep = activeIepForState(state);
  const sections = (state.extractionSections || [])
    .filter((section) => !section.studentId || section.studentId === state.currentStudentId)
    .filter((section) => section.status !== "Rejected");
  const detected = sections.slice(0, 5).map((section) => {
    const confidence = Number.isFinite(Number(section.confidence)) ? `${section.confidence}% confidence` : "confidence not available";
    return `${section.title || section.sourceSection}: ${section.status || "Needs review"} (${confidence}; ${section.sourceReference || "source reference pending"})`;
  });
  const needsReview = sections.filter((section) => section.status !== "Confirmed").length;
  const approvalStatus = activeIep?.extractionApproved
    ? "approved for downstream summaries, tasks, and progress workflows"
    : `${needsReview || sections.length} section${(needsReview || sections.length) === 1 ? "" : "s"} still need human review before approval`;

  if (!document && !sections.length) {
    return `Mode: Extract. IEP extraction support: no preserved source document is available for the selected student yet. Upload or paste an IEP source, review detected sections, preserve source references, and approve only after qualified human review. Source references: no source document yet. ${guardrail}`;
  }

  return `Mode: Extract. IEP extraction support: preserved source ${document?.name || "source document"} is ${activeIep?.extractionApproved ? "already approved" : "awaiting review"}. Detected sections: ${detected.join("; ") || "no active detected sections"}. Approval status: ${approvalStatus}. Next review steps: compare each detected section to the source excerpt, edit or regenerate weak fields, reject unsupported content, and approve extraction only after source-aligned human review. Source references: ${sections.map((section) => section.sourceReference).filter(Boolean).slice(0, 4).join("; ") || "source references pending"}. ${guardrail}`;
}

function assistantSummaryAudience(lower = "") {
  if (/\b(parent|family|guardian)\b/i.test(lower)) return "parent";
  if (/\b(student|self-advocacy|my supports|my goals)\b/i.test(lower)) return "student";
  if (/\b(admin|administrator|reviewer|compliance)\b/i.test(lower)) return "administrator";
  return "teacher";
}

function audienceSummaryResponse(state, audience, sourceLine, guardrail) {
  const student = studentName(state, state.currentStudentId);
  const summary = state.summaries[audience] || state.summaries.teacher;
  const capability = {
    teacher: "Teacher summary generation",
    parent: "Parent summary generation",
    student: "Student-friendly explanation",
    administrator: "Administrator review summary"
  }[audience] || "Role-specific summary generation";

  if (!currentStudentHasApprovedRecord(state) || !summary?.sections?.length) {
    return `Mode: Summarize. ${capability}: no approved role-specific summary is available for ${student} yet. Approve a source extraction before generating audience language. Source references: ${sourceLine}. ${guardrail}`;
  }

  const coverageItems = summaryCoverageItemsForWorkspace(state, audience);
  const covered = coverageItems.filter((item) => !/needs|missing|unclear|ambiguous|flag/i.test(item.status || ""));
  const needsReview = coverageItems.filter((item) => /needs|missing|unclear|ambiguous|flag/i.test(item.status || ""));
  const sections = (summary.sections || [])
    .slice(0, 4)
    .map((section) => `${section.heading}: ${section.text || (section.bullets || []).join("; ")}`)
    .join(" ");
  const questions = questionsForRole(audience) || [];
  const coverageSummary = coverageItems.length
    ? `${covered.length}/${coverageItems.length} audience coverage items covered`
    : "audience coverage pending";
  const reviewSummary = needsReview.length
    ? needsReview.map((item) => `${item.label} (${item.status})`).join("; ")
    : "none";

  return `Mode: Summarize. ${capability}. ${summary.title}: ${sections} Audience coverage: ${coverageSummary}. Needs review before sharing: ${reviewSummary}. Questions to prepare: ${questions.join("; ") || "none"}. Boundary: simplify language for the audience without adding services, changing placement, or making legal conclusions. Source references: ${sourceLine}; ${coverageItems.map((item) => item.sourceReference).filter(Boolean).slice(0, 4).join("; ") || "summary source references pending"}. ${guardrail}`;
}

function progressMonitoringSupportResponse(state, guardrail) {
  const student = studentName(state, state.currentStudentId);
  const goals = activeIepItemsForState(state, "goals");
  if (!currentStudentHasApprovedRecord(state) || !goals.length) {
    return `Mode: Progress. Progress monitoring support: no approved measurable goals are available for ${student} yet. Approve the source extraction before drafting progress language or schedule reminders. Source references: ${assistantSourceLine(state)}. ${guardrail}`;
  }

  const rows = goals.map((goal) => {
    const entries = (goal.progressEntries || []).slice().sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const latest = entries[entries.length - 1] || null;
    const schedule = goal.progressSchedule || {};
    const latestEvidence = latest?.evidenceLabel || latest?.evidenceType || latest?.evidenceDocumentId || "no evidence artifact attached";
    const scheduleStatus = schedule.status || goal.status || "schedule status not set";
    return `${goal.domain}: ${scheduleStatus}. Latest data: ${latest ? `${latest.value} on ${formatDate(latest.date)}` : "no confirmed data point entered"}; evidence: ${latestEvidence}; method: ${goal.measurementMethod || "method not recorded"}; next due: ${schedule.nextDueDate ? formatDate(schedule.nextDueDate) : "not recorded"}; source: ${goal.sourceReference || "structured goal record"}`;
  });
  const staleOrDue = goals
    .filter((goal) => /overdue|due|stale|needs/i.test(`${goal.progressSchedule?.status || ""} ${goal.status || ""}`))
    .map((goal) => `${goal.domain} (${goal.progressSchedule?.status || goal.status})`);
  const draftRows = progressReportRowsForGoals(goals).map((row) => `${row.heading}: ${row.status}; ${row.latestData}`);

  return `Mode: Progress. Progress monitoring support for ${student}: ${rows.join(" ")} Missing or stale data: ${staleOrDue.join("; ") || "none flagged by the current schedule"}. Draft progress report language support: ${draftRows.join(" ")} Boundary: draft progress language must use entered evidence and measurement schedules only; it cannot change annual goals, mastery criteria, services, or placement. Source references: ${assistantSourceLine(state)}; ${goals.map((goal) => goal.sourceReference).filter(Boolean).slice(0, 4).join("; ") || "goal source references pending"}. ${guardrail}`;
}

function draftIepSectionResponse(state, lower, guardrail) {
  const student = studentName(state, state.currentStudentId);
  const goals = activeIepItemsForState(state, "goals");
  const services = activeIepItemsForState(state, "services");
  const accommodations = activeIepItemsForState(state, "accommodations");
  const goal = goals[0] || {};
  const record = activeIepForState(state) ? normalizeStructuredIepRecord(state, activeIepForState(state)) : {};
  const currentPerformance = structuredDetailRows(record.currentPerformance || {})
    .slice(0, 3)
    .map((row) => `${row.label}: ${row.value}`)
    .join("; ");
  const missing = [
    goal.baseline ? "" : "baseline",
    goal.measurementMethod ? "" : "measurement method",
    goal.frequency || goal.progressSchedule?.frequency ? "" : "progress-monitoring frequency",
    goal.criteriaForMastery ? "" : "mastery criterion"
  ].filter(Boolean);
  const sourceRefs = [
    goal.sourceReference,
    ...services.map((service) => service.sourceReference),
    ...accommodations.map((accommodation) => accommodation.sourceReference)
  ].filter(Boolean);

  if (!currentStudentHasApprovedRecord(state) || !goals.length) {
    return `Mode: Draft. Draft IEP section generation: no approved goal or present-level record is available for ${student} yet. Missing information needed before drafting: approved source extraction, present levels, baseline, measurable need, method, frequency, and criterion. Label: draft IEP section blocked until source review. Source references: ${assistantSourceLine(state)}. ${guardrail}`;
  }

  if (lower.includes("present level")) {
    return `Mode: Draft. Draft IEP section generation: Present levels draft for human review. Draft content: ${student} shows strengths and needs documented in the reviewed record. Current performance evidence: ${currentPerformance || goal.presentLevelReference || "present-level evidence needs team confirmation"}. This draft should connect classroom impact, strengths, priority need, and data source before official use. Missing information to confirm: ${missing.join(", ") || "none flagged for the selected goal structure"}. Label: draft IEP section, not official IEP content. Source references: ${assistantSourceLine(state)}; ${sourceRefs.slice(0, 4).join("; ") || "source references pending"}. ${guardrail}`;
  }

  return `Mode: Draft. Draft IEP section generation: Measurable annual goal draft for human review. Draft content: Given the documented support context, ${student} will work on ${goal.domain || "the selected need"} from baseline ${goal.baseline || "baseline to confirm"} using ${goal.measurementMethod || "a team-confirmed measure"} ${goal.frequency || goal.progressSchedule?.frequency || "on a confirmed schedule"} toward ${goal.criteriaForMastery || "a team-confirmed mastery criterion"}. Connect this draft to present levels: ${goal.presentLevelReference || currentPerformance || "present-level reference needs team confirmation"}. Missing information to confirm: ${missing.join(", ") || "none flagged for the selected goal structure"}. Label: draft IEP section, not official IEP content; human approval is required before export or official use. Source references: ${assistantSourceLine(state)}; ${sourceRefs.slice(0, 4).join("; ") || "source references pending"}. ${guardrail}`;
}

function assistantSourceLine(state) {
  const document = documentForCurrentStudent(state);
  const alignment = sourceAlignmentForState(state);
  const recordStatus = currentStudentHasApprovedRecord(state) ? "confirmed extraction and structured IEP record" : "source intake or human approval pending";
  return `${document?.name || "no preserved source document for the selected student"}; ${alignment.sourceId}; ${recordStatus}`;
}

function assistantRestrictedRequestResponse(lower, mode, sourceLine, guardrail) {
  const asksForDiagnosis =
    /\bdiagnos(e|is|tic|ing)?\b/.test(lower) ||
    /\b(disability label|eligibility category)\b/.test(lower) ||
    /\b(does|do|can|could|is|are|has|have|identify|label|qualif\w*)\b.{0,50}\b(dyslexia|adhd|autis\w*|disability|specific learning disability|intellectual disability|emotional disturbance)\b/.test(lower);
  if (asksForDiagnosis) {
    return `Mode: ${mode}. I cannot diagnose disabilities, assign an eligibility category, or infer that a student has a disability from this IEP record. I can summarize documented present levels, services, accommodations, evaluation references, and questions for qualified evaluators or the IEP team. Source references: ${sourceLine}. ${guardrail}`;
  }

  const asksForLegalConclusion =
    /\b(legal conclusion|compliance certification|legally compliant|guarantee compliance|certify compliance|automated legal compliance)\b/.test(lower) ||
    /\b(certify|guarantee|determine|conclude|declare|prove)\b.{0,60}\b(compliant|compliance|legal|legally|lawful|binding)\b/.test(lower);
  const asksForFinalDecision =
    /\b(finalize|make|decide|determine|approve|order)\b.{0,60}\b(placement|service|services|iep change|change the iep)\b/.test(lower);
  if (asksForLegalConclusion || asksForFinalDecision) {
    return `Mode: ${mode}. I cannot make legal conclusions, certify compliance, finalize placement, or change services. I can list source-grounded items that may need human review, compare draft and final language, and prepare questions for the IEP team. Source references: ${sourceLine}; review flags; meeting decisions. ${guardrail}`;
  }

  return "";
}

function assistantContentLabels(state) {
  const extracted = (state.extractionSections || [])
    .filter((section) => section.studentId === state.currentStudentId)
    .filter((section) => section.status !== "Rejected")
    .slice(0, 3)
    .map((section) => `${section.title || section.sourceSection} (${section.status})`)
    .join("; ");
  const goals = activeIepItemsForState(state, "goals");
  const progressEntries = goals.flatMap((goal) =>
    (goal.progressEntries || []).map((entry) => ({ ...entry, goalDomain: goal.domain }))
  );
  const latestProgress = progressEntries
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];
  const meeting = currentStudentMeetingForState(state);
  const services = activeIepItemsForState(state, "services");
  const userNotes = [
    latestProgress
      ? `${latestProgress.goalDomain} progress note from ${latestProgress.enteredBy || "staff"} on ${formatDate(latestProgress.date)}`
      : "",
    meeting?.concerns?.length ? `${meeting.concerns.length} meeting concern record(s)` : "",
    services.some((service) => service.recoveryPlan?.familyCommunication)
      ? "service recovery communication note"
      : ""
  ].filter(Boolean);
  const warnings = currentStudentReviewFlagsForState(state)
    .filter((flag) => flag.status === "Open")
    .slice(0, 3)
    .map((flag) => `${flag.issue} (${flag.severity})`)
    .join("; ");

  return `Content labels: Extracted IEP content = ${extracted || "confirmed structured fields from the preserved source document"}. User-entered notes = ${userNotes.join("; ") || "none used in this response"}. AI-generated suggestion = this assistant response is draft/advisory output. Compliance warnings requiring human review = ${warnings || "none open"}.`;
}

function sensitiveDraftInfoResponse(state, guardrail) {
  const services = activeIepItemsForState(state, "services");
  const service = services.find((item) => item.recoveryStatus !== "On schedule") || services[0] || null;
  if (!service) {
    return `Mode: Draft. No approved service record is available for ${studentName(state, state.currentStudentId)} yet, so I cannot draft service recovery language. Label: draft support request blocked until source review. ${guardrail}`;
  }
  const recoveryPlan = service.recoveryPlan || {};
  const missing = [
    recoveryPlan.recoveryDate ? "" : "recovery date",
    recoveryPlan.provider ? "" : "responsible provider",
    recoveryPlan.familyCommunication ? "" : "family communication note"
  ].filter(Boolean);
  if (missing.length) {
    return `Mode: Draft. Missing information needed before drafting service recovery language: ${missing.join(", ")}. I will not invent a recovery date, provider, or service change. Suggested staff questions: What date will the missed minutes be recovered? Who is responsible for delivery? What has been communicated to the family? Label: draft support request, not official IEP language. Source references: ${service.serviceType || "service"} service grid, delivery log, and recovery plan. ${guardrail}`;
  }
  return `Mode: Draft. Draft service recovery note: ${service.serviceType} has ${recoveryPlan.missedMinutes || 0} missed minutes scheduled for recovery on ${formatDate(recoveryPlan.recoveryDate)} with ${recoveryPlan.provider}. Family communication recorded: ${recoveryPlan.familyCommunication}. Label: draft service recovery note for human review, not official IEP language. Source references: service grid, delivery log, and recorded recovery plan. ${guardrail}`;
}

function goalMeasurabilityReview(state) {
  const goals = activeIepItemsForState(state, "goals");
  const rows = goals.map((goal) => {
    const elements = goalMeasurabilityElements(goal);
    const missing = Object.entries(elements).flatMap(([label, present]) => (present ? [] : [label]));
    const schedule = goal.progressSchedule || {};
    const nextDue = schedule.nextDueDate ? ` next data due ${formatDate(schedule.nextDueDate)}` : " no next data date recorded";
    const status = missing.length ? `needs human review for missing ${missing.join(", ")}` : "has a complete measurable structure";
    return `${goal.domain}: ${status}. Baseline: ${goal.baseline || "not recorded"}; method: ${goal.measurementMethod || "not recorded"}; criterion: ${goal.criteriaForMastery || "not recorded"}; schedule: ${schedule.frequency || goal.frequency || "not recorded"};${nextDue}. Source: ${goal.sourceReference || "structured goal record"}`;
  });
  const dueItems = goals
    .filter((goal) => /overdue|due/i.test(goal.progressSchedule?.status || ""))
    .map((goal) => `${goal.domain} ${goal.progressSchedule.status}`);
  return `Goal measurability review: ${rows.join(" ") || "No approved measurable goals are available for this student yet."} Progress monitoring support: ${dueItems.length ? dueItems.join("; ") : "no due or overdue schedules"}; use entered evidence before drafting progress language.`;
}

function goalMeasurabilityElements(goal = {}) {
  const annualGoal = String(goal.annualGoal || "");
  return {
    baseline: Boolean(String(goal.baseline || "").trim()),
    condition: /\b(given|when|after|with|during|across)\b/i.test(annualGoal) || Boolean(goal.presentLevelReference),
    criterion: Boolean(String(goal.criteriaForMastery || "").trim()) || /\d+|percent|accuracy|consecutive|of\s+\d/i.test(annualGoal),
    method: Boolean(String(goal.measurementMethod || "").trim()) || Boolean(goal.progressSchedule?.evidenceType),
    schedule: Boolean(String(goal.frequency || goal.progressSchedule?.frequency || "").trim())
  };
}

function PageHead({ label, title, description, actions }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{label}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}

function Button({ children, icon: Icon, variant = "secondary", onClick, type = "button", disabled = false, title }) {
  return (
    <button className={`btn ${variant}`} type={type} onClick={onClick} disabled={disabled} title={title}>
      {Icon ? <Icon size={15} /> : null}
      {children}
    </button>
  );
}

function Card({ title, description, action, children }) {
  return (
    <article className="card">
      <div className="card-head">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="card-body">{children}</div>
    </article>
  );
}

function Metric({ label, value, note, icon: Icon, tone = "blue" }) {
  return (
    <article className={`metric ${tone}`}>
      <div>
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function Badge({ children, tone = "blue" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function AlertRow({ tone, icon: Icon, title, description, meta, onClick }) {
  return (
    <button className="alert-row" type="button" onClick={onClick}>
      <i className={tone}><Icon size={16} /></i>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <em>{meta}</em>
    </button>
  );
}

function StudentHero({ student, iep }) {
  const termLabel = iep ? `${formatDate(iep.startDate)} to ${formatDate(iep.endDate)}` : "Source intake pending";
  return (
    <article className="student-hero">
      <div className="avatar-lg">{initials(`${student.firstName} ${student.lastName}`)}</div>
      <div>
        <h2>{student.firstName} {student.lastName} <Badge tone="green">{student.status}</Badge></h2>
        <p>Grade {student.grade} - {student.school} - Fictional demo record</p>
        <div className="chips">
          <span>IEP term: {termLabel}</span>
          <span>Annual review: {formatDate(student.annualReviewDate)}</span>
          <span>{iep?.sourceAlignment ? "PA source version recorded" : "PA source version pending"}</span>
        </div>
      </div>
    </article>
  );
}

function Tabs({ active, navigate }) {
  const items = [
    ["student", "Overview"],
    ["intake", "Source & extraction"],
    ["summary", "Plan summary"],
    ["progress", "Goals & progress"],
    ["services", "Services & accommodations"],
    ["meetings", "Meeting prep"],
    ["review", "Quality review"],
    ["audit", "Activity log"]
  ];
  return (
    <div className="tabs">
      {items.map(([id, label]) => (
        <button className={active === id ? "active" : ""} type="button" key={id} onClick={() => navigate(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function MiniStat({ label, value, note }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function Person({ student }) {
  return (
    <div className="person">
      <span>{initials(`${student.firstName} ${student.lastName}`)}</span>
      <div>
        <strong>{student.firstName} {student.lastName}</strong>
        <small>Grade {student.grade} - {student.school}</small>
      </div>
    </div>
  );
}

function Donut({ percent }) {
  return (
    <div className="donut" style={{ background: `conic-gradient(#11865c 0 ${percent}%, #edf1f5 ${percent}% 100%)` }}>
      <div>
        <strong>{percent}%</strong>
        <span>logged</span>
      </div>
    </div>
  );
}

function ProgressBar({ value, tone = "green" }) {
  return (
    <span className="progressbar">
      <i className={tone} style={{ width: `${Math.min(100, value)}%` }} />
    </span>
  );
}

function DetailList({ rows }) {
  return (
    <dl className="detail-list">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ServiceLogger({ services, dispatch, logDisabled = false, recoveryDisabled = false }) {
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [minutes, setMinutes] = useState("30");
  const [recoveryDate, setRecoveryDate] = useState(services[0]?.recoveryPlan?.recoveryDate || "2026-06-26");
  const [provider, setProvider] = useState(services[0]?.provider || "");
  const [familyCommunication, setFamilyCommunication] = useState(
    services[0]?.recoveryPlan?.familyCommunication ||
      "Family will receive the recovery date, provider name, and recovered minutes after scheduling."
  );
  const selectedService = services.find((service) => service.id === serviceId) || services[0];

  useEffect(() => {
    if (!services.some((service) => service.id === serviceId)) setServiceId(services[0]?.id || "");
  }, [serviceId, services]);

  useEffect(() => {
    if (!selectedService) return;
    setRecoveryDate(selectedService.recoveryPlan?.recoveryDate || "2026-06-26");
    setProvider(selectedService.recoveryPlan?.provider || selectedService.provider || "");
    setFamilyCommunication(
      selectedService.recoveryPlan?.familyCommunication ||
        "Family will receive the recovery date, provider name, and recovered minutes after scheduling."
    );
  }, [selectedService]);

  const recoveryReady = Boolean(serviceId && recoveryDate && provider.trim() && familyCommunication.trim());
  const hasService = services.length > 0;

  return (
    <div className="stack">
      <label className="field">
        <span>Service</span>
        <select value={serviceId} disabled={!hasService} onChange={(event) => setServiceId(event.target.value)}>
          {hasService ? (
            services.map((service) => <option value={service.id} key={service.id}>{service.serviceType}</option>)
          ) : (
            <option value="">No services available</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Minutes delivered</span>
        <input value={minutes} disabled={!hasService || logDisabled} onChange={(event) => setMinutes(event.target.value)} inputMode="numeric" />
      </label>
      <label className="field">
        <span>Recovery date</span>
        <input
          type="date"
          aria-label="Recovery date"
          value={recoveryDate}
          disabled={!hasService || recoveryDisabled}
          onChange={(event) => setRecoveryDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Recovery provider</span>
        <input aria-label="Recovery provider" value={provider} disabled={!hasService || recoveryDisabled} onChange={(event) => setProvider(event.target.value)} />
      </label>
      <label className="field">
        <span>Family communication</span>
        <textarea
          aria-label="Family communication"
          value={familyCommunication}
          disabled={!hasService || recoveryDisabled}
          onChange={(event) => setFamilyCommunication(event.target.value)}
        />
      </label>
      <div className="button-row">
        <Button
          variant="primary"
          icon={Plus}
          disabled={logDisabled || !serviceId}
          onClick={() =>
            dispatch(
              { type: "logService", serviceId, minutes },
              { title: "Service logged", detail: `${minutes} delivered minutes recorded.` }
            )
          }
        >
          Log service
        </Button>
        <Button
          icon={CalendarDays}
          disabled={recoveryDisabled || !recoveryReady}
          onClick={() =>
            dispatch(
              {
                type: "assignRecovery",
                serviceId,
                recoveryDate,
                provider: provider.trim(),
                familyCommunication: familyCommunication.trim()
              },
              { title: "Recovery planned", detail: `Recovery set for ${formatDate(recoveryDate)} with ${provider.trim()}.` }
            )
          }
        >
          Plan recovery
        </Button>
      </div>
    </div>
  );
}

function AccessSupportForm({ supports = [], dispatch, disabled = false }) {
  const [supportId, setSupportId] = useState(supports[0]?.id || "");
  const selectedSupport = supports.find((support) => support.id === supportId) || supports[0] || null;
  const [status, setStatus] = useState(selectedSupport?.status || "Needs review");
  const [implementationPlan, setImplementationPlan] = useState(selectedSupport?.implementationPlan || "");
  const [responsibleRole, setResponsibleRole] = useState(selectedSupport?.responsibleRole || "Case Manager");
  const [reviewNote, setReviewNote] = useState(selectedSupport?.reviewNote || "");

  useEffect(() => {
    if (!supports.length) {
      setSupportId("");
      return;
    }
    if (!supports.some((support) => support.id === supportId)) setSupportId(supports[0].id);
  }, [supports, supportId]);

  useEffect(() => {
    if (!selectedSupport) return;
    setStatus(selectedSupport.status || "Needs review");
    setImplementationPlan(selectedSupport.implementationPlan || "");
    setResponsibleRole(selectedSupport.responsibleRole || "Case Manager");
    setReviewNote(selectedSupport.reviewNote || "");
  }, [selectedSupport]);

  const ready = Boolean(selectedSupport && implementationPlan.trim() && responsibleRole.trim() && reviewNote.trim());

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Access support</span>
        <select
          aria-label="Access support"
          value={selectedSupport?.id || ""}
          disabled={disabled || supports.length === 0}
          onChange={(event) => setSupportId(event.target.value)}
        >
          {supports.length ? (
            supports.map((support) => <option value={support.id} key={support.id}>{support.supportType}</option>)
          ) : (
            <option value="">No access supports</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Access support status</span>
        <select
          aria-label="Access support status"
          value={status}
          disabled={disabled || !selectedSupport}
          onChange={(event) => setStatus(event.target.value)}
        >
          {accessSupportStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Access support owner</span>
        <input
          aria-label="Access support owner"
          value={responsibleRole}
          disabled={disabled || !selectedSupport}
          onChange={(event) => setResponsibleRole(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Access implementation plan</span>
        <textarea
          aria-label="Access implementation plan"
          value={implementationPlan}
          disabled={disabled || !selectedSupport}
          onChange={(event) => setImplementationPlan(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Access review note</span>
        <textarea
          aria-label="Access review note"
          value={reviewNote}
          disabled={disabled || !selectedSupport}
          onChange={(event) => setReviewNote(event.target.value)}
        />
      </label>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "updateAccessSupport",
              supportId: selectedSupport.id,
              status,
              implementationPlan: implementationPlan.trim(),
              responsibleRole: responsibleRole.trim(),
              reviewNote: reviewNote.trim()
            },
            {
              title: "Access support reviewed",
              detail: selectedSupport ? `${selectedSupport.supportType} review updated.` : "Access support review updated."
            }
          )
        }
      >
        Update access support
      </Button>
    </div>
  );
}

function PlacementReviewCard({ reviews = [], dispatch, disabled = false, roleLabel = "Current role" }) {
  return (
    <Card title="Placement and LRE review" description="Review educational placement rationale as source-grounded implementation context, not an automated placement decision.">
      <div className="list">
        {reviews.length ? (
          reviews.map((review) => (
            <div className="question-row" key={review.id}>
              <div>
                <strong>{review.setting}</strong>
                <span>{review.rationale}</span>
                <span>{review.lreConsideration}</span>
                <span>{review.implementationImpact}</span>
                <small>{review.sourceReference} · owner {review.followUpOwner} · next review {formatDate(review.nextReviewDate)}</small>
                {review.reviewerNote ? <small>{review.reviewerNote}</small> : null}
                {review.reviewedBy ? <small>Reviewed by {review.reviewedBy} on {formatDateTime(review.reviewedAt)} · digest {shortHash(review.placementDigest)}</small> : null}
                <small>{review.officialRecordImpact}</small>
              </div>
              <Badge tone={placementReviewTone(review.status)}>{review.status}</Badge>
            </div>
          ))
        ) : (
          <EmptyState title="No placement review" text="No educational placement or LRE review record is visible for this student." />
        )}
      </div>
      {disabled ? (
        <AccessNotice text={`${roleLabel} can review placement rationale but cannot update educational placement or LRE review records.`} />
      ) : null}
      <PlacementReviewForm reviews={reviews} dispatch={dispatch} disabled={disabled} />
    </Card>
  );
}

function PlacementReviewForm({ reviews = [], dispatch, disabled = false }) {
  const [reviewId, setReviewId] = useState(reviews[0]?.id || "");
  const selectedReview = reviews.find((review) => review.id === reviewId) || reviews[0] || null;
  const [status, setStatus] = useState(selectedReview?.status || "Needs review");
  const [lreConsideration, setLreConsideration] = useState(selectedReview?.lreConsideration || "");
  const [implementationImpact, setImplementationImpact] = useState(selectedReview?.implementationImpact || "");
  const [followUpOwner, setFollowUpOwner] = useState(selectedReview?.followUpOwner || "Case Manager");
  const [nextReviewDate, setNextReviewDate] = useState(selectedReview?.nextReviewDate || "2026-07-01");
  const [reviewerNote, setReviewerNote] = useState(selectedReview?.reviewerNote || "");

  useEffect(() => {
    if (!reviews.length) {
      setReviewId("");
      return;
    }
    if (!reviews.some((review) => review.id === reviewId)) setReviewId(reviews[0].id);
  }, [reviews, reviewId]);

  useEffect(() => {
    if (!selectedReview) return;
    setStatus(selectedReview.status || "Needs review");
    setLreConsideration(selectedReview.lreConsideration || "");
    setImplementationImpact(selectedReview.implementationImpact || "");
    setFollowUpOwner(selectedReview.followUpOwner || "Case Manager");
    setNextReviewDate(selectedReview.nextReviewDate || "2026-07-01");
    setReviewerNote(selectedReview.reviewerNote || "");
  }, [selectedReview]);

  const ready = Boolean(
    selectedReview &&
      lreConsideration.trim() &&
      implementationImpact.trim() &&
      followUpOwner.trim() &&
      nextReviewDate &&
      reviewerNote.trim()
  );

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Placement review</span>
        <select
          aria-label="Placement review"
          value={selectedReview?.id || ""}
          disabled={disabled || reviews.length === 0}
          onChange={(event) => setReviewId(event.target.value)}
        >
          {reviews.length ? (
            reviews.map((review) => <option value={review.id} key={review.id}>{review.setting}</option>)
          ) : (
            <option value="">No placement reviews</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Placement review status</span>
        <select
          aria-label="Placement review status"
          value={status}
          disabled={disabled || !selectedReview}
          onChange={(event) => setStatus(event.target.value)}
        >
          {placementReviewStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Placement follow-up owner</span>
        <input
          aria-label="Placement follow-up owner"
          value={followUpOwner}
          disabled={disabled || !selectedReview}
          onChange={(event) => setFollowUpOwner(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Next placement review date</span>
        <input
          type="date"
          aria-label="Next placement review date"
          value={nextReviewDate}
          disabled={disabled || !selectedReview}
          onChange={(event) => setNextReviewDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>LRE consideration</span>
        <textarea
          aria-label="LRE consideration"
          value={lreConsideration}
          disabled={disabled || !selectedReview}
          onChange={(event) => setLreConsideration(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Placement implementation impact</span>
        <textarea
          aria-label="Placement implementation impact"
          value={implementationImpact}
          disabled={disabled || !selectedReview}
          onChange={(event) => setImplementationImpact(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Placement reviewer note</span>
        <textarea
          aria-label="Placement reviewer note"
          value={reviewerNote}
          disabled={disabled || !selectedReview}
          onChange={(event) => setReviewerNote(event.target.value)}
        />
      </label>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "updatePlacementReview",
              reviewId: selectedReview.id,
              status,
              lreConsideration: lreConsideration.trim(),
              implementationImpact: implementationImpact.trim(),
              followUpOwner: followUpOwner.trim(),
              nextReviewDate,
              reviewerNote: reviewerNote.trim()
            },
            {
              title: "Placement review updated",
              detail: selectedReview ? `${selectedReview.setting} review updated.` : "Placement review updated."
            }
          )
        }
      >
        Update placement review
      </Button>
    </div>
  );
}

function TaskCompletionForm({ tasks, documents = [], dispatch, disabled = false }) {
  const openTasks = useMemo(() => tasks.filter((task) => task.status !== "Completed"), [tasks]);
  const [taskId, setTaskId] = useState(openTasks[0]?.id || "");
  const selectedTask = useMemo(() => openTasks.find((task) => task.id === taskId), [openTasks, taskId]);
  const [note, setNote] = useState(selectedTask?.description || "Implementation completed as written.");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState(documents[0]?.id || "");
  const [evidenceLabel, setEvidenceLabel] = useState("Implementation evidence note");

  useEffect(() => {
    if (!openTasks.some((task) => task.id === taskId)) setTaskId(openTasks[0]?.id || "");
  }, [openTasks, taskId]);

  useEffect(() => {
    if (!documents.some((document) => document.id === evidenceDocumentId)) setEvidenceDocumentId(documents[0]?.id || "");
  }, [documents, evidenceDocumentId]);

  useEffect(() => {
    setNote(selectedTask?.description || "Implementation completed as written.");
    setEvidenceLabel(selectedTask?.evidenceRequired ? `${selectedTask.sourceSection} implementation evidence` : "Implementation evidence note");
  }, [selectedTask]);

  const ready = taskId && note.trim();

  return (
    <div className="handoff-form">
      <label className="field">
        <span>Task to complete</span>
        <select
          aria-label="Task to complete"
          value={taskId}
          disabled={disabled || openTasks.length === 0}
          onChange={(event) => setTaskId(event.target.value)}
        >
          {openTasks.length ? (
            openTasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)
          ) : (
            <option value="">No open tasks</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Completion note</span>
        <textarea
          aria-label="Completion note"
          value={note}
          disabled={disabled || !taskId}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Evidence document</span>
        <select
          aria-label="Task evidence document"
          value={evidenceDocumentId}
          disabled={disabled || !taskId || documents.length === 0}
          onChange={(event) => setEvidenceDocumentId(event.target.value)}
        >
          {documents.length ? (
            documents.map((document) => <option value={document.id} key={document.id}>{document.name}</option>)
          ) : (
            <option value="">No preserved documents</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Evidence label</span>
        <input
          aria-label="Task evidence label"
          value={evidenceLabel}
          disabled={disabled || !taskId}
          onChange={(event) => setEvidenceLabel(event.target.value)}
        />
      </label>
      <Button
        variant="primary"
        icon={ClipboardCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "toggleTask",
              taskId,
              note: note.trim(),
              evidenceDocumentId,
              evidenceLabel: evidenceLabel.trim()
            },
            { title: "Task evidence recorded", detail: "Completion note and evidence reference saved." }
          )
        }
      >
        Complete with evidence
      </Button>
    </div>
  );
}

function TaskObservationForm({ tasks, dispatch, disabled = false }) {
  const [taskId, setTaskId] = useState(tasks[0]?.id || "");
  const selectedTask = useMemo(() => tasks.find((task) => task.id === taskId), [tasks, taskId]);
  const [observedAt, setObservedAt] = useState(isoDate(new Date()));
  const [context, setContext] = useState(selectedTask?.sourceSection || "Classroom routine");
  const [supportUsed, setSupportUsed] = useState("Support was available and used as written.");
  const [note, setNote] = useState(selectedTask?.description || "Observation recorded for implementation follow-up.");

  useEffect(() => {
    if (!tasks.some((task) => task.id === taskId)) setTaskId(tasks[0]?.id || "");
  }, [taskId, tasks]);

  useEffect(() => {
    setContext(selectedTask?.sourceSection || "Classroom routine");
    setSupportUsed("Support was available and used as written.");
    setNote(selectedTask?.description || "Observation recorded for implementation follow-up.");
  }, [selectedTask]);

  const ready = taskId && observedAt && context.trim() && note.trim();

  return (
    <div className="handoff-form">
      <label className="field">
        <span>Observation task</span>
        <select
          aria-label="Observation task"
          value={taskId}
          disabled={disabled || tasks.length === 0}
          onChange={(event) => setTaskId(event.target.value)}
        >
          {tasks.length ? (
            tasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)
          ) : (
            <option value="">No tasks available</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Observation date</span>
        <input
          aria-label="Observation date"
          type="date"
          value={observedAt}
          disabled={disabled || !taskId}
          onChange={(event) => setObservedAt(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Classroom context</span>
        <input
          aria-label="Classroom context"
          value={context}
          disabled={disabled || !taskId}
          onChange={(event) => setContext(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Support use</span>
        <input
          aria-label="Support use"
          value={supportUsed}
          disabled={disabled || !taskId}
          onChange={(event) => setSupportUsed(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Observation note</span>
        <textarea
          aria-label="Observation note"
          value={note}
          disabled={disabled || !taskId}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button
        variant="primary"
        icon={Plus}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "recordTaskObservation",
              taskId,
              observedAt,
              context: context.trim(),
              supportUsed: supportUsed.trim(),
              note: note.trim()
            },
            { title: "Classroom observation recorded", detail: "Observation note attached to the implementation task." }
          )
        }
      >
        Record observation
      </Button>
    </div>
  );
}

function HandoffForm({ tasks, dispatch, disabled = false }) {
  const [taskId, setTaskId] = useState(tasks[0]?.id || "");
  const [note, setNote] = useState("Reviewed the assigned support and know when to use it.");
  useEffect(() => {
    if (!tasks.some((task) => task.id === taskId)) setTaskId(tasks[0]?.id || "");
  }, [taskId, tasks]);
  const trimmed = note.trim();
  return (
    <div className="handoff-form">
      <label className="field">
        <span>Responsibility</span>
        <select value={taskId} disabled={disabled || tasks.length === 0} onChange={(event) => setTaskId(event.target.value)}>
          {tasks.length ? (
            tasks.map((task) => (
              <option value={task.id} key={task.id}>{task.title}</option>
            ))
          ) : (
            <option value="">No responsibilities available</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Acknowledgment note</span>
        <textarea value={note} disabled={disabled || !taskId} onChange={(event) => setNote(event.target.value)} />
      </label>
      <Button
        variant="primary"
        icon={Check}
        disabled={disabled || !taskId || !trimmed}
        onClick={() =>
          dispatch(
            { type: "acknowledgeTask", taskId, note: trimmed },
            { title: "Handoff acknowledged", detail: "Staff acknowledgment and audit log updated." }
          )
        }
      >
        Acknowledge handoff
      </Button>
    </div>
  );
}

function MeetingRecordingReviewForm({ meetingId, dispatch, disabled = false }) {
  const [recordingSource, setRecordingSource] = useState("Manual transcript paste");
  const [status, setStatus] = useState("Source readiness reviewed");
  const [participantConsentSummary, setParticipantConsentSummary] = useState(
    "No meeting recording is attached; recap uses staff notes and family-visible questions already shared in the meeting prep workspace."
  );
  const [transcriptHandlingPlan, setTranscriptHandlingPlan] = useState(
    "Human reviewer will summarize only meeting-prep topics and separate proposed follow-ups from official IEP decisions."
  );
  const [storageLocation, setStorageLocation] = useState("Local demo workspace; no production recording provider connected.");
  const [retentionBoundary, setRetentionBoundary] = useState(
    "Do not upload recordings containing sensitive student information until district consent, retention, and access rules are confirmed."
  );
  const [familyVisible, setFamilyVisible] = useState(false);
  const [studentVisible, setStudentVisible] = useState(false);
  const ready =
    participantConsentSummary.trim() &&
    transcriptHandlingPlan.trim() &&
    storageLocation.trim() &&
    retentionBoundary.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Recording source</span>
        <select
          aria-label="Recording source"
          value={recordingSource}
          disabled={disabled}
          onChange={(event) => setRecordingSource(event.target.value)}
        >
          {meetingRecordingSourceOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Recording readiness status</span>
        <select
          aria-label="Recording readiness status"
          value={status}
          disabled={disabled}
          onChange={(event) => setStatus(event.target.value)}
        >
          {meetingRecordingStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Participant consent summary</span>
        <textarea
          aria-label="Participant consent summary"
          value={participantConsentSummary}
          disabled={disabled}
          onChange={(event) => setParticipantConsentSummary(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Transcript handling plan</span>
        <textarea
          aria-label="Transcript handling plan"
          value={transcriptHandlingPlan}
          disabled={disabled}
          onChange={(event) => setTranscriptHandlingPlan(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Recording storage location</span>
        <input
          aria-label="Recording storage location"
          value={storageLocation}
          disabled={disabled}
          onChange={(event) => setStorageLocation(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Recording retention boundary</span>
        <textarea
          aria-label="Recording retention boundary"
          value={retentionBoundary}
          disabled={disabled}
          onChange={(event) => setRetentionBoundary(event.target.value)}
        />
      </label>
      <label className="field check-field">
        <input
          type="checkbox"
          checked={familyVisible}
          disabled={disabled}
          onChange={(event) => setFamilyVisible(event.target.checked)}
        />
        <span>Family-visible readiness note</span>
      </label>
      <label className="field check-field">
        <input
          type="checkbox"
          checked={studentVisible}
          disabled={disabled}
          onChange={(event) => setStudentVisible(event.target.checked)}
        />
        <span>Student-visible readiness note</span>
      </label>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "recordMeetingRecordingReview",
              meetingId,
              recordingSource,
              status,
              participantConsentSummary: participantConsentSummary.trim(),
              transcriptHandlingPlan: transcriptHandlingPlan.trim(),
              storageLocation: storageLocation.trim(),
              retentionBoundary: retentionBoundary.trim(),
              familyVisible,
              studentVisible
            },
            { title: "Meeting recording readiness recorded", detail: "Recording/transcript source readiness saved with consent boundaries." }
          )
        }
      >
        Record recording readiness
      </Button>
    </div>
  );
}

function MeetingTranscriptSummaryForm({ meetingId, dispatch, disabled = false }) {
  const [transcriptSource, setTranscriptSource] = useState("Case-manager recap notes");
  const [transcriptExcerpt, setTranscriptExcerpt] = useState(
    "Parent asked how missed speech-language minutes will be recovered. Team noted the recovery plan still needs provider/date confirmation."
  );
  const [summary, setSummary] = useState(
    "Team needs to clarify missed-service recovery and extended-time implementation before the annual IEP meeting."
  );
  const [decisions, setDecisions] = useState("No official IEP changes were finalized in the recap.");
  const [followUps, setFollowUps] = useState(
    "Confirm recovery date and provider.\nClarify extended-time amount and trigger.\nAdd student self-advocacy prompt to agenda."
  );
  const [status, setStatus] = useState("Draft recap for review");
  const [familyVisible, setFamilyVisible] = useState(true);
  const [studentVisible, setStudentVisible] = useState(false);
  const ready = transcriptSource.trim() && transcriptExcerpt.trim() && summary.trim() && decisions.trim() && followUps.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Transcript source</span>
        <input
          aria-label="Transcript source"
          value={transcriptSource}
          disabled={disabled}
          onChange={(event) => setTranscriptSource(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Transcript excerpt</span>
        <textarea
          aria-label="Transcript excerpt"
          value={transcriptExcerpt}
          disabled={disabled}
          onChange={(event) => setTranscriptExcerpt(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Transcript recap summary</span>
        <textarea
          aria-label="Transcript recap summary"
          value={summary}
          disabled={disabled}
          onChange={(event) => setSummary(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Transcript decisions</span>
        <textarea
          aria-label="Transcript decisions"
          value={decisions}
          disabled={disabled}
          onChange={(event) => setDecisions(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Transcript follow-ups</span>
        <textarea
          aria-label="Transcript follow-ups"
          value={followUps}
          disabled={disabled}
          onChange={(event) => setFollowUps(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Transcript review status</span>
        <select
          aria-label="Transcript review status"
          value={status}
          disabled={disabled}
          onChange={(event) => setStatus(event.target.value)}
        >
          {meetingTranscriptStatusOptions.map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field check-field">
        <input
          type="checkbox"
          checked={familyVisible}
          disabled={disabled}
          onChange={(event) => setFamilyVisible(event.target.checked)}
        />
        <span>Family-visible recap</span>
      </label>
      <label className="field check-field">
        <input
          type="checkbox"
          checked={studentVisible}
          disabled={disabled}
          onChange={(event) => setStudentVisible(event.target.checked)}
        />
        <span>Student-visible recap</span>
      </label>
      <Button
        icon={Sparkles}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "recordMeetingTranscriptSummary",
              meetingId,
              transcriptSource: transcriptSource.trim(),
              transcriptExcerpt: transcriptExcerpt.trim(),
              summary: summary.trim(),
              decisions: decisions.trim(),
              followUps: followUps.trim(),
              status,
              familyVisible,
              studentVisible
            },
            { title: "Meeting transcript summary recorded", detail: "Transcript recap saved with human review guardrails." }
          )
        }
      >
        Record transcript summary
      </Button>
    </div>
  );
}

function PacketAcknowledgmentForm({ meetingId, acknowledgments = [], role, dispatch, disabled = false }) {
  const editableAcknowledgments = useMemo(
    () => acknowledgments.filter((acknowledgment) => packetAcknowledgmentMatchesRole(role, acknowledgment)),
    [acknowledgments, role]
  );
  const [acknowledgmentId, setAcknowledgmentId] = useState(editableAcknowledgments[0]?.id || "");
  const selected = editableAcknowledgments.find((acknowledgment) => acknowledgment.id === acknowledgmentId) || editableAcknowledgments[0] || null;
  const [status, setStatus] = useState(selected?.status === "Sent" ? "Reviewed" : selected?.status || "Reviewed");
  const [note, setNote] = useState(selected?.responseNote || "I reviewed the packet and am ready for the meeting.");

  useEffect(() => {
    if (!editableAcknowledgments.length) {
      setAcknowledgmentId("");
      return;
    }
    if (!editableAcknowledgments.some((acknowledgment) => acknowledgment.id === acknowledgmentId)) {
      setAcknowledgmentId(editableAcknowledgments[0].id);
    }
  }, [editableAcknowledgments, acknowledgmentId]);

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.status === "Sent" ? "Reviewed" : selected.status || "Reviewed");
    setNote(selected.responseNote || "I reviewed the packet and am ready for the meeting.");
  }, [selected]);

  const ready = selected && note.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Packet receipt</span>
        <select
          aria-label="Packet receipt"
          value={selected?.id || ""}
          disabled={disabled || !editableAcknowledgments.length}
          onChange={(event) => setAcknowledgmentId(event.target.value)}
        >
          {editableAcknowledgments.map((acknowledgment) => (
            <option value={acknowledgment.id} key={acknowledgment.id}>{acknowledgment.label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Packet status</span>
        <select
          aria-label="Packet status"
          value={status}
          disabled={disabled || !selected}
          onChange={(event) => setStatus(event.target.value)}
        >
          {["Reviewed", "Needs clarification", "Needs more time", "Cannot attend"].map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Packet note</span>
        <textarea
          aria-label="Packet note"
          value={note}
          disabled={disabled || !selected}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button
        icon={Check}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "acknowledgeMeetingPacket",
              meetingId,
              acknowledgmentId: selected.id,
              status,
              note: note.trim()
            },
            { title: "Packet acknowledgment updated", detail: "Pre-read packet status saved for the meeting team." }
          )
        }
      >
        Update packet acknowledgment
      </Button>
    </div>
  );
}

function SignatureRequestForm({ meetingId, dispatch, disabled = false }) {
  const [packetTitle, setPacketTitle] = useState("Annual IEP pre-read packet");
  const [signatureScope, setSignatureScope] = useState("Meeting packet receipt");
  const [requestedForName, setRequestedForName] = useState("Robin Lee");
  const [requestNote, setRequestNote] = useState("Please sign to confirm receipt and review of the scoped packet before the meeting.");
  const ready = packetTitle.trim() && requestedForName.trim() && requestNote.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Signature packet title</span>
        <input
          aria-label="Signature packet title"
          value={packetTitle}
          disabled={disabled}
          onChange={(event) => setPacketTitle(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Signature scope</span>
        <select
          aria-label="Signature scope"
          value={signatureScope}
          disabled={disabled}
          onChange={(event) => setSignatureScope(event.target.value)}
        >
          {eSignatureScopeOptions.map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Requested signer</span>
        <input
          aria-label="Requested signer"
          value={requestedForName}
          disabled={disabled}
          onChange={(event) => setRequestedForName(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Signature request note</span>
        <textarea
          aria-label="Signature request note"
          value={requestNote}
          disabled={disabled}
          onChange={(event) => setRequestNote(event.target.value)}
        />
      </label>
      <Button
        icon={Send}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "requestMeetingSignature",
              meetingId,
              packetTitle: packetTitle.trim(),
              signatureScope,
              requestedForRole: "parent",
              requestedForName: requestedForName.trim(),
              requestNote: requestNote.trim()
            },
            { title: "E-signature requested", detail: "Scoped parent signature request saved." }
          )
        }
      >
        Request e-signature
      </Button>
    </div>
  );
}

function MeetingSignatureForm({ meetingId, requests = [], role, userName, dispatch, disabled = false }) {
  const editableRequests = useMemo(
    () => requests.filter((request) => request.status !== "Signed" && signatureRequestMatchesRole(role, request)),
    [requests, role]
  );
  const [signatureId, setSignatureId] = useState(editableRequests[0]?.id || "");
  const selected = editableRequests.find((request) => request.id === signatureId) || editableRequests[0] || null;
  const [signerName, setSignerName] = useState(userName || "");
  const [attestation, setAttestation] = useState("I typed my name to confirm I received and reviewed the scoped meeting packet. I understand this is not blanket consent or a final IEP decision.");

  useEffect(() => {
    if (!editableRequests.length) {
      setSignatureId("");
      return;
    }
    if (!editableRequests.some((request) => request.id === signatureId)) {
      setSignatureId(editableRequests[0].id);
    }
  }, [editableRequests, signatureId]);

  useEffect(() => {
    setSignerName(userName || "");
  }, [userName]);

  const ready = selected && signerName.trim() && attestation.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Signature request</span>
        <select
          aria-label="Signature request"
          value={selected?.id || ""}
          disabled={disabled || !editableRequests.length}
          onChange={(event) => setSignatureId(event.target.value)}
        >
          {editableRequests.length ? (
            editableRequests.map((request) => (
              <option value={request.id} key={request.id}>{request.packetTitle}</option>
            ))
          ) : (
            <option value="">No open signature requests</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Typed signature name</span>
        <input
          aria-label="Typed signature name"
          value={signerName}
          disabled={disabled || !selected}
          onChange={(event) => setSignerName(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Signature attestation</span>
        <textarea
          aria-label="Signature attestation"
          value={attestation}
          disabled={disabled || !selected}
          onChange={(event) => setAttestation(event.target.value)}
        />
      </label>
      <Button
        icon={ShieldCheck}
        variant="primary"
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "signMeetingPacket",
              meetingId,
              signatureId: selected.id,
              signerName: signerName.trim(),
              attestation: attestation.trim()
            },
            { title: "Meeting packet e-signed", detail: "Scoped signature hash and audit log updated." }
          )
        }
      >
        Sign packet
      </Button>
    </div>
  );
}

function SourceRegistryReviewForm({ entries = [], dispatch, disabled = false }) {
  const [sourceId, setSourceId] = useState(entries[0]?.sourceId || "");
  const selected = entries.find((entry) => entry.sourceId === sourceId) || entries[0] || null;
  const [status, setStatus] = useState(selected?.reviewStatus || "Current");
  const [retrievedDate, setRetrievedDate] = useState(selected?.retrievedDate || isoDate(new Date()));
  const [nextReviewDate, setNextReviewDate] = useState(selected?.nextReviewDate || "2026-09-22");
  const [note, setNote] = useState(selected?.reviewNote || "Source version reviewed against district registry.");

  useEffect(() => {
    if (!entries.length) {
      setSourceId("");
      return;
    }
    if (!entries.some((entry) => entry.sourceId === sourceId)) {
      setSourceId(entries[0].sourceId);
    }
  }, [entries, sourceId]);

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.reviewStatus || "Current");
    setRetrievedDate(selected.retrievedDate || isoDate(new Date()));
    setNextReviewDate(selected.nextReviewDate || "2026-09-22");
    setNote(selected.reviewNote || "Source version reviewed against district registry.");
  }, [selected]);

  const ready = selected && retrievedDate.trim() && nextReviewDate.trim() && note.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Registry source</span>
        <select
          aria-label="Registry source"
          value={selected?.sourceId || ""}
          disabled={disabled || !entries.length}
          onChange={(event) => setSourceId(event.target.value)}
        >
          {entries.map((entry) => (
            <option value={entry.sourceId} key={entry.sourceId}>{entry.title}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Source review status</span>
        <select
          aria-label="Source review status"
          value={status}
          disabled={disabled || !selected}
          onChange={(event) => setStatus(event.target.value)}
        >
          {["Current", "Update needed", "Superseded", "Future expansion"].map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Retrieved date</span>
        <input
          aria-label="Source retrieved date"
          type="date"
          value={retrievedDate}
          disabled={disabled || !selected}
          onChange={(event) => setRetrievedDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Next source review</span>
        <input
          aria-label="Next source review"
          type="date"
          value={nextReviewDate}
          disabled={disabled || !selected}
          onChange={(event) => setNextReviewDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Source review note</span>
        <textarea
          aria-label="Source review note"
          value={note}
          disabled={disabled || !selected}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "reviewSourceRegistry",
              sourceId: selected.sourceId,
              status,
              retrievedDate: retrievedDate.trim(),
              nextReviewDate: nextReviewDate.trim(),
              note: note.trim()
            },
            { title: "Source registry reviewed", detail: "Source-version review status saved for traceability." }
          )
        }
      >
        Update source review
      </Button>
    </div>
  );
}

function SourceRegistryAdminForm({ registry = {}, dispatch, disabled = false }) {
  const [sourceId, setSourceId] = useState("pa-school-age-iep-district-2026");
  const [title, setTitle] = useState("District-reviewed Pennsylvania School Age IEP, 2026");
  const [issuingOrganization, setIssuingOrganization] = useState("Riverbend School District / PaTTAN reference");
  const [sourceType, setSourceType] = useState("Form");
  const [sourceFormType, setSourceFormType] = useState("District-reviewed");
  const [jurisdiction, setJurisdiction] = useState(registry.jurisdiction || "Pennsylvania");
  const [programArea, setProgramArea] = useState(registry.programArea || "School Age");
  const [sourceRegistryVersion, setSourceRegistryVersion] = useState(registry.sourceRegistryVersion || "PA-demo-2026.06");
  const [effectiveDate, setEffectiveDate] = useState("2026-07-01");
  const [retrievedDate, setRetrievedDate] = useState(isoDate(new Date()));
  const [nextReviewDate, setNextReviewDate] = useState("2026-10-01");
  const [url, setUrl] = useState("https://www.pattan.net/Forms/Individualized-Education-Program-IEP-1-1");
  const [fileTypesAvailable, setFileTypesAvailable] = useState("PDF, DOCX");
  const [languagesAvailable, setLanguagesAvailable] = useState("English, Spanish");
  const [languageAvailabilityNote, setLanguageAvailabilityNote] = useState(
    "District verified English and Spanish packet availability from the forms hub before family sharing."
  );
  const [productUse, setProductUse] = useState("Schema, Extraction, Validation, Review, Export");
  const [reviewStatus, setReviewStatus] = useState("Current");
  const [reviewNote, setReviewNote] = useState("District administrator verified this source for future source-aligned workflows.");
  const [activate, setActivate] = useState(true);

  useEffect(() => {
    setJurisdiction(registry.jurisdiction || "Pennsylvania");
    setProgramArea(registry.programArea || "School Age");
    setSourceRegistryVersion(registry.sourceRegistryVersion || "PA-demo-2026.06");
  }, [registry.jurisdiction, registry.programArea, registry.sourceRegistryVersion]);

  const ready =
    sourceId.trim() &&
    title.trim() &&
    sourceRegistryVersion.trim() &&
    effectiveDate.trim() &&
    retrievedDate.trim() &&
    nextReviewDate.trim() &&
    reviewNote.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>New source ID</span>
        <input
          aria-label="New source ID"
          value={sourceId}
          disabled={disabled}
          onChange={(event) => setSourceId(event.target.value)}
        />
      </label>
      <label className="field">
        <span>New source title</span>
        <input
          aria-label="New source title"
          value={title}
          disabled={disabled}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Issuing organization</span>
        <input
          aria-label="New source issuing organization"
          value={issuingOrganization}
          disabled={disabled}
          onChange={(event) => setIssuingOrganization(event.target.value)}
        />
      </label>
      <label className="field">
        <span>New source type</span>
        <select
          aria-label="New source type"
          value={sourceType}
          disabled={disabled}
          onChange={(event) => setSourceType(event.target.value)}
        >
          {["Form", "Annotated Form", "Guidance", "Notice", "Policy"].map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>New source form type</span>
        <input
          aria-label="New source form type"
          value={sourceFormType}
          disabled={disabled}
          onChange={(event) => setSourceFormType(event.target.value)}
        />
      </label>
      <label className="field">
        <span>New source jurisdiction</span>
        <input
          aria-label="New source jurisdiction"
          value={jurisdiction}
          disabled={disabled}
          onChange={(event) => setJurisdiction(event.target.value)}
        />
      </label>
      <label className="field">
        <span>New source program area</span>
        <input
          aria-label="New source program area"
          value={programArea}
          disabled={disabled}
          onChange={(event) => setProgramArea(event.target.value)}
        />
      </label>
      <label className="field">
        <span>New source registry version</span>
        <input
          aria-label="New source registry version"
          value={sourceRegistryVersion}
          disabled={disabled}
          onChange={(event) => setSourceRegistryVersion(event.target.value)}
        />
      </label>
      <label className="field">
        <span>New source effective date</span>
        <input
          aria-label="New source effective date"
          type="date"
          value={effectiveDate}
          disabled={disabled}
          onChange={(event) => setEffectiveDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>New source retrieved date</span>
        <input
          aria-label="New source retrieved date"
          type="date"
          value={retrievedDate}
          disabled={disabled}
          onChange={(event) => setRetrievedDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>New source next review</span>
        <input
          aria-label="New source next review"
          type="date"
          value={nextReviewDate}
          disabled={disabled}
          onChange={(event) => setNextReviewDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>New source URL</span>
        <input
          aria-label="New source URL"
          value={url}
          disabled={disabled}
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <label className="field">
        <span>New source file types</span>
        <input
          aria-label="New source file types"
          value={fileTypesAvailable}
          disabled={disabled}
          onChange={(event) => setFileTypesAvailable(event.target.value)}
        />
      </label>
      <label className="field">
        <span>New source languages available</span>
        <input
          aria-label="New source languages available"
          value={languagesAvailable}
          disabled={disabled}
          onChange={(event) => setLanguagesAvailable(event.target.value)}
        />
      </label>
      <label className="field">
        <span>New source language availability note</span>
        <textarea
          aria-label="New source language availability note"
          value={languageAvailabilityNote}
          disabled={disabled}
          onChange={(event) => setLanguageAvailabilityNote(event.target.value)}
        />
      </label>
      <label className="field">
        <span>New source product uses</span>
        <textarea
          aria-label="New source product uses"
          value={productUse}
          disabled={disabled}
          onChange={(event) => setProductUse(event.target.value)}
        />
      </label>
      <label className="field">
        <span>New source review status</span>
        <select
          aria-label="New source review status"
          value={reviewStatus}
          disabled={disabled}
          onChange={(event) => setReviewStatus(event.target.value)}
        >
          {["Current", "Update needed", "Superseded", "Future expansion"].map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>New source review note</span>
        <textarea
          aria-label="New source review note"
          value={reviewNote}
          disabled={disabled}
          onChange={(event) => setReviewNote(event.target.value)}
        />
      </label>
      <label className="field check-field">
        <input
          aria-label="Set new source as active"
          type="checkbox"
          checked={activate}
          disabled={disabled}
          onChange={(event) => setActivate(event.target.checked)}
        />
        <span>Set new source as active for future source alignment</span>
      </label>
      <Button
        icon={Plus}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "saveSourceRegistryEntry",
              sourceId: sourceId.trim(),
              title: title.trim(),
              issuingOrganization: issuingOrganization.trim(),
              sourceType,
              sourceFormType: sourceFormType.trim(),
              jurisdiction: jurisdiction.trim(),
              programArea: programArea.trim(),
              sourceRegistryVersion: sourceRegistryVersion.trim(),
              effectiveDate,
              retrievedDate,
              nextReviewDate,
              url: url.trim(),
              fileTypesAvailable,
              languagesAvailable,
              languageAvailabilityNote: languageAvailabilityNote.trim(),
              productUse,
              reviewStatus,
              reviewNote: reviewNote.trim(),
              activate
            },
            {
              title: "Source registry entry saved",
              detail: activate ? "Source saved and activated for future source alignment." : "Source saved to the registry."
            }
          )
        }
      >
        Save source registry entry
      </Button>
    </div>
  );
}

function SessionGovernanceForm({ sessions = [], currentSessionId, dispatch, disabled = false }) {
  const revocableSessions = useMemo(
    () => sessions.filter((sessionRecord) => sessionRecord.status === "Active" && sessionRecord.id !== currentSessionId),
    [sessions, currentSessionId]
  );
  const [sessionId, setSessionId] = useState(revocableSessions[0]?.id || "");
  const [note, setNote] = useState("Administrator revoked this demo session during access review.");
  const [identityProvider, setIdentityProvider] = useState("District SSO readiness review");
  const [lifecycleStatus, setLifecycleStatus] = useState("SSO mapping in review");
  const [mfaStatus, setMfaStatus] = useState("MFA mapping in review");
  const [tenantBoundaryStatus, setTenantBoundaryStatus] = useState("Cross-tenant access blocked locally");
  const [roleProvisioningStatus, setRoleProvisioningStatus] = useState("SIS/IdP mapping drafted");
  const [accountLifecyclePlan, setAccountLifecyclePlan] = useState(
    "Provision from district IdP groups; deprovision on SIS withdrawal and staff separation."
  );
  const [tenantBoundaryEvidence, setTenantBoundaryEvidence] = useState(
    "Demo users remain scoped to Riverbend district and unauthorized student selection is denied."
  );
  const [roleProvisioningNote, setRoleProvisioningNote] = useState(
    "Map case manager, provider, family, student, school admin, district admin, and system admin groups before pilot."
  );
  const [nextReviewDate, setNextReviewDate] = useState("2026-08-01");

  useEffect(() => {
    if (!revocableSessions.some((sessionRecord) => sessionRecord.id === sessionId)) {
      setSessionId(revocableSessions[0]?.id || "");
    }
  }, [revocableSessions, sessionId]);

  const selected = revocableSessions.find((sessionRecord) => sessionRecord.id === sessionId);
  const ready = selected && note.trim();
  const identityReady =
    identityProvider.trim() && accountLifecyclePlan.trim() && tenantBoundaryEvidence.trim() && roleProvisioningNote.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Security session to revoke</span>
        <select
          aria-label="Security session to revoke"
          value={sessionId}
          disabled={disabled || !revocableSessions.length}
          onChange={(event) => setSessionId(event.target.value)}
        >
          {revocableSessions.length ? (
            revocableSessions.map((sessionRecord) => (
              <option value={sessionRecord.id} key={sessionRecord.id}>
                {sessionRecord.userName} - {roles[sessionRecord.role]?.label || sessionRecord.role}
              </option>
            ))
          ) : (
            <option value="">No revocable sessions</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Session review note</span>
        <textarea
          aria-label="Session review note"
          value={note}
          disabled={disabled || !selected}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button
        icon={Lock}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "revokeSecuritySession",
              sessionId,
              note: note.trim()
            },
            {
              title: "Security session revoked",
              detail: selected ? `${selected.userName} session revoked for review.` : "Session revoked."
            }
          )
        }
      >
        Revoke session
      </Button>
      <div className="mini-form-grid">
        <label className="field">
          <span>Identity provider</span>
          <input
            aria-label="Identity provider"
            value={identityProvider}
            disabled={disabled}
            onChange={(event) => setIdentityProvider(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Lifecycle status</span>
          <select
            aria-label="Lifecycle status"
            value={lifecycleStatus}
            disabled={disabled}
            onChange={(event) => setLifecycleStatus(event.target.value)}
          >
            {identityLifecycleStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          <span>MFA status</span>
          <select
            aria-label="MFA status"
            value={mfaStatus}
            disabled={disabled}
            onChange={(event) => setMfaStatus(event.target.value)}
          >
            {identityMfaStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Tenant boundary status</span>
          <select
            aria-label="Tenant boundary status"
            value={tenantBoundaryStatus}
            disabled={disabled}
            onChange={(event) => setTenantBoundaryStatus(event.target.value)}
          >
            {tenantBoundaryStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Role provisioning status</span>
          <select
            aria-label="Role provisioning status"
            value={roleProvisioningStatus}
            disabled={disabled}
            onChange={(event) => setRoleProvisioningStatus(event.target.value)}
          >
            {roleProvisioningStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Identity next review</span>
          <input
            type="date"
            aria-label="Identity next review"
            value={nextReviewDate}
            disabled={disabled}
            onChange={(event) => setNextReviewDate(event.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span>Account lifecycle plan</span>
        <textarea
          aria-label="Account lifecycle plan"
          value={accountLifecyclePlan}
          disabled={disabled}
          onChange={(event) => setAccountLifecyclePlan(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Tenant boundary evidence</span>
        <textarea
          aria-label="Tenant boundary evidence"
          value={tenantBoundaryEvidence}
          disabled={disabled}
          onChange={(event) => setTenantBoundaryEvidence(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Role provisioning note</span>
        <textarea
          aria-label="Role provisioning note"
          value={roleProvisioningNote}
          disabled={disabled}
          onChange={(event) => setRoleProvisioningNote(event.target.value)}
        />
      </label>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !identityReady}
        onClick={() =>
          dispatch(
            {
              type: "reviewIdentityLifecycle",
              identityProvider: identityProvider.trim(),
              lifecycleStatus,
              mfaStatus,
              tenantBoundaryStatus,
              roleProvisioningStatus,
              accountLifecyclePlan: accountLifecyclePlan.trim(),
              tenantBoundaryEvidence: tenantBoundaryEvidence.trim(),
              roleProvisioningNote: roleProvisioningNote.trim(),
              nextReviewDate
            },
            {
              title: "Identity lifecycle reviewed",
              detail: `${identityProvider.trim()} readiness recorded for administrator review.`
            }
          )
        }
      >
        Record identity lifecycle review
      </Button>
    </div>
  );
}

function AiGovernanceEvaluationForm({ dispatch, disabled = false }) {
  const [evaluationScope, setEvaluationScope] = useState("FDS core AI guardrails");
  const [reviewerNote, setReviewerNote] = useState(
    "Evaluate source traceability, content labels, restricted-request refusals, and human-review boundaries before sharing AI-assisted outputs."
  );
  const ready = evaluationScope.trim() && reviewerNote.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>AI evaluation scope</span>
        <input
          aria-label="AI evaluation scope"
          value={evaluationScope}
          disabled={disabled}
          onChange={(event) => setEvaluationScope(event.target.value)}
        />
      </label>
      <label className="field">
        <span>AI governance review note</span>
        <textarea
          aria-label="AI governance review note"
          value={reviewerNote}
          disabled={disabled}
          onChange={(event) => setReviewerNote(event.target.value)}
        />
      </label>
      <Button
        icon={Sparkles}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "runAiEvaluation",
              evaluationScope: evaluationScope.trim(),
              reviewerNote: reviewerNote.trim()
            },
            {
              title: "AI guardrail evaluation completed",
              detail: "Evaluation evidence was saved for source, label, restricted-request, and human-review checks."
            }
          )
        }
      >
        Run AI guardrail evaluation
      </Button>
    </div>
  );
}

function AiCitationEvaluationForm({ dispatch, disabled = false }) {
  const [outputLabel, setOutputLabel] = useState("Family summary citation review");
  const [outputText, setOutputText] = useState(
    "Draft family summary for human review: Jordan's reading goal uses weekly probes and service language must remain tied to the approved IEP. This is not official IEP language and does not change services. Source references: Prior IEP comparison note and current Goal 1 progress data; Services"
  );
  const [citations, setCitations] = useState("Prior IEP comparison note and current Goal 1 progress data\nServices");
  const [reviewerNote, setReviewerNote] = useState(
    "Confirm citations resolve to preserved source-aligned records before sharing AI-assisted family language."
  );
  const ready = outputLabel.trim() && outputText.trim() && citations.trim() && reviewerNote.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>AI output label</span>
        <input
          aria-label="AI output label"
          value={outputLabel}
          disabled={disabled}
          onChange={(event) => setOutputLabel(event.target.value)}
        />
      </label>
      <label className="field wide">
        <span>AI output text</span>
        <textarea
          aria-label="AI output text"
          value={outputText}
          disabled={disabled}
          onChange={(event) => setOutputText(event.target.value)}
        />
      </label>
      <label className="field wide">
        <span>AI output citations</span>
        <textarea
          aria-label="AI output citations"
          value={citations}
          disabled={disabled}
          onChange={(event) => setCitations(event.target.value)}
        />
      </label>
      <label className="field wide">
        <span>AI citation review note</span>
        <textarea
          aria-label="AI citation review note"
          value={reviewerNote}
          disabled={disabled}
          onChange={(event) => setReviewerNote(event.target.value)}
        />
      </label>
      <Button
        icon={Search}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "runAiCitationEvaluation",
              outputLabel: outputLabel.trim(),
              outputText: outputText.trim(),
              citations: citations.trim(),
              reviewerNote: reviewerNote.trim()
            },
            {
              title: "AI citation evaluation completed",
              detail: "Citation evidence was saved for source-match and official-boundary checks."
            }
          )
        }
      >
        Run AI citation evaluation
      </Button>
    </div>
  );
}

function AccessibilityRemediationForm({ findings = [], dispatch, disabled = false }) {
  const [findingId, setFindingId] = useState(findings[0]?.id || "");
  const selected = findings.find((finding) => finding.id === findingId) || findings[0] || null;
  const [status, setStatus] = useState(selected?.status || "Remediation planned");
  const [severity, setSeverity] = useState(selected?.severity || "Medium");
  const [owner, setOwner] = useState(selected?.owner || "");
  const [dueDate, setDueDate] = useState(selected?.dueDate || "");
  const [assistiveTechnology, setAssistiveTechnology] = useState(selected?.assistiveTechnology || "");
  const [remediationPlan, setRemediationPlan] = useState(selected?.remediationPlan || "");
  const [verificationNote, setVerificationNote] = useState(selected?.verificationNote || "");

  useEffect(() => {
    if (!findings.length) {
      setFindingId("");
      return;
    }
    if (!findings.some((finding) => finding.id === findingId)) {
      setFindingId(findings[0].id);
    }
  }, [findings, findingId]);

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.status || "Remediation planned");
    setSeverity(selected.severity || "Medium");
    setOwner(selected.owner || "");
    setDueDate(selected.dueDate || "");
    setAssistiveTechnology(selected.assistiveTechnology || "");
    setRemediationPlan(selected.remediationPlan || "");
    setVerificationNote(selected.verificationNote || "");
  }, [selected]);

  const ready = selected && owner.trim() && dueDate.trim() && assistiveTechnology.trim() && remediationPlan.trim() && verificationNote.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Accessibility finding</span>
        <select
          aria-label="Accessibility finding"
          value={findingId}
          disabled={disabled || findings.length === 0}
          onChange={(event) => setFindingId(event.target.value)}
        >
          {findings.length ? (
            findings.map((finding) => <option value={finding.id} key={finding.id}>{finding.title}</option>)
          ) : (
            <option value="">No accessibility findings</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Accessibility finding status</span>
        <select
          aria-label="Accessibility finding status"
          value={status}
          disabled={disabled || !selected}
          onChange={(event) => setStatus(event.target.value)}
        >
          {accessibilityFindingStatusOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Accessibility severity</span>
        <select
          aria-label="Accessibility severity"
          value={severity}
          disabled={disabled || !selected}
          onChange={(event) => setSeverity(event.target.value)}
        >
          {accessibilityFindingSeverityOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Accessibility owner</span>
        <input
          aria-label="Accessibility owner"
          value={owner}
          disabled={disabled || !selected}
          onChange={(event) => setOwner(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Accessibility due date</span>
        <input
          aria-label="Accessibility due date"
          type="date"
          value={dueDate}
          disabled={disabled || !selected}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Assistive technology or review method</span>
        <input
          aria-label="Assistive technology or review method"
          value={assistiveTechnology}
          disabled={disabled || !selected}
          onChange={(event) => setAssistiveTechnology(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Accessibility remediation plan</span>
        <textarea
          aria-label="Accessibility remediation plan"
          value={remediationPlan}
          disabled={disabled || !selected}
          onChange={(event) => setRemediationPlan(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Accessibility verification note</span>
        <textarea
          aria-label="Accessibility verification note"
          value={verificationNote}
          disabled={disabled || !selected}
          onChange={(event) => setVerificationNote(event.target.value)}
        />
      </label>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "updateAccessibilityFinding",
              findingId,
              status,
              severity,
              owner: owner.trim(),
              dueDate,
              assistiveTechnology: assistiveTechnology.trim(),
              remediationPlan: remediationPlan.trim(),
              verificationNote: verificationNote.trim()
            },
            {
              title: "Accessibility finding updated",
              detail: selected ? `${selected.title} remediation evidence saved.` : "Accessibility remediation evidence saved."
            }
          )
        }
      >
        Update accessibility finding
      </Button>
    </div>
  );
}

function AuditAnchorForm({ dispatch, disabled = false }) {
  const [externalReference, setExternalReference] = useState("District audit vault reference pending");
  const [note, setNote] = useState("Anchor the verified local audit hash chain before exporting the review packet.");
  const ready = externalReference.trim() && note.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Audit anchor external reference</span>
        <input
          aria-label="Audit anchor external reference"
          value={externalReference}
          disabled={disabled}
          onChange={(event) => setExternalReference(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Audit anchor note</span>
        <textarea
          aria-label="Audit anchor note"
          value={note}
          disabled={disabled}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button
        icon={Lock}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "createAuditAnchor",
              externalReference: externalReference.trim(),
              note: note.trim()
            },
            {
              title: "Audit anchor created",
              detail: "Verified audit hash-chain digest retained for review."
            }
          )
        }
      >
        Create audit anchor
      </Button>
    </div>
  );
}

function ExternalTimestampReceiptForm({ latestAnchor, dispatch, disabled = false }) {
  const [provider, setProvider] = useState("District timestamp authority (simulated)");
  const [receiptId, setReceiptId] = useState("TS-RBSD-2026-0001");
  const [receiptTimestamp, setReceiptTimestamp] = useState("2026-06-24T14:30");
  const [verificationReference, setVerificationReference] = useState("District audit vault receipt URL pending");
  const [reviewerNote, setReviewerNote] = useState(
    "Record external timestamp evidence after the local audit anchor is verified; production still requires district-approved notarization or WORM storage."
  );
  const ready =
    Boolean(latestAnchor?.id) &&
    provider.trim() &&
    receiptId.trim() &&
    receiptTimestamp.trim() &&
    verificationReference.trim() &&
    reviewerNote.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Timestamp anchor</span>
        <input
          aria-label="Timestamp anchor"
          value={latestAnchor ? `${latestAnchor.status} · sequence ${latestAnchor.anchoredSequence}` : "Create a verified audit anchor first"}
          disabled
          readOnly
        />
      </label>
      <label className="field">
        <span>Timestamp provider</span>
        <input
          aria-label="Timestamp provider"
          value={provider}
          disabled={disabled || !latestAnchor}
          onChange={(event) => setProvider(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Timestamp receipt ID</span>
        <input
          aria-label="Timestamp receipt ID"
          value={receiptId}
          disabled={disabled || !latestAnchor}
          onChange={(event) => setReceiptId(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Timestamp receipt time</span>
        <input
          aria-label="Timestamp receipt time"
          type="datetime-local"
          value={receiptTimestamp}
          disabled={disabled || !latestAnchor}
          onChange={(event) => setReceiptTimestamp(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Timestamp verification reference</span>
        <input
          aria-label="Timestamp verification reference"
          value={verificationReference}
          disabled={disabled || !latestAnchor}
          onChange={(event) => setVerificationReference(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Timestamp reviewer note</span>
        <textarea
          aria-label="Timestamp reviewer note"
          value={reviewerNote}
          disabled={disabled || !latestAnchor}
          onChange={(event) => setReviewerNote(event.target.value)}
        />
      </label>
      <Button
        icon={Clock3}
        disabled={disabled || !ready}
        title={!latestAnchor ? "Create a verified audit anchor before recording an external timestamp receipt." : undefined}
        onClick={() =>
          dispatch(
            {
              type: "recordExternalTimestampReceipt",
              anchorId: latestAnchor.id,
              provider: provider.trim(),
              receiptId: receiptId.trim(),
              receiptTimestamp,
              verificationReference: verificationReference.trim(),
              reviewerNote: reviewerNote.trim()
            },
            {
              title: "External timestamp receipt recorded",
              detail: "Timestamp receipt evidence attached to the verified audit anchor."
            }
          )
        }
      >
        Record timestamp receipt
      </Button>
    </div>
  );
}

function AuditRetentionPackageForm({ latestAnchor, dispatch, disabled = false }) {
  const [note, setNote] = useState("Seal the verified audit anchor manifest for district retention review.");
  const ready = Boolean(latestAnchor?.id && note.trim());

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Retention anchor</span>
        <input
          aria-label="Retention anchor"
          value={latestAnchor ? `${latestAnchor.status} · sequence ${latestAnchor.anchoredSequence}` : "Create a verified audit anchor first"}
          disabled
          readOnly
        />
      </label>
      <label className="field">
        <span>Retention package note</span>
        <textarea
          aria-label="Retention package note"
          value={note}
          disabled={disabled}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !ready}
        title={!latestAnchor ? "Create a verified audit anchor before sealing a retention package." : undefined}
        onClick={() =>
          dispatch(
            {
              type: "sealAuditRetentionPackage",
              anchorId: latestAnchor.id,
              note: note.trim()
            },
            {
              title: "Retention package sealed",
              detail: "Audit anchor manifest sealed for district retention review."
            }
          )
        }
      >
        Seal retention package
      </Button>
    </div>
  );
}

function ExportTemplateReviewForm({ exports = [], dispatch, disabled = false }) {
  const [exportId, setExportId] = useState(exports[0]?.id || "");
  const [targetSystem, setTargetSystem] = useState("District IEP system compatible JSON interchange");
  const [templateName, setTemplateName] = useState("District system package");
  const [templateVersion, setTemplateVersion] = useState("IEP-IW-district-json-0.1");
  const [validationStatus, setValidationStatus] = useState("District import review ready");
  const [mappingStatus, setMappingStatus] = useState("Required sections mapped");
  const [submissionMode, setSubmissionMode] = useState("District import review");
  const [requiredSections, setRequiredSections] = useState(String(schemaSections.length));
  const [mappedSections, setMappedSections] = useState(String(schemaSections.length));
  const [mappingEvidence, setMappingEvidence] = useState(
    "Generated package includes FDS section coverage, source registry metadata, goals, services, accommodations, implementation tasks, and audit context for district import review."
  );
  const [validationEvidence, setValidationEvidence] = useState(
    "Local package validation confirms required FDS sections are present; live SIS/IEP-system import validation remains pending."
  );
  const [reviewNote, setReviewNote] = useState(
    "Treat this as a district-system import review package only; do not submit as the official IEP without district template approval."
  );
  const [nextReviewDate, setNextReviewDate] = useState("2026-08-15");

  useEffect(() => {
    if (!exports.length) {
      setExportId("");
      return;
    }
    if (!exports.some((item) => item.id === exportId)) {
      setExportId(exports[0].id);
    }
  }, [exports, exportId]);

  const selectedExport = exports.find((item) => item.id === exportId) || exports[0] || null;
  const ready = Boolean(
    selectedExport &&
      targetSystem.trim() &&
      templateName.trim() &&
      templateVersion.trim() &&
      mappingEvidence.trim() &&
      validationEvidence.trim() &&
      reviewNote.trim()
  );

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Export package</span>
        <select
          aria-label="Export package"
          value={exportId}
          disabled={disabled || !exports.length}
          onChange={(event) => setExportId(event.target.value)}
        >
          {exports.length ? (
            exports.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label} · {item.artifact?.fileName || item.format}
              </option>
            ))
          ) : (
            <option value="">No district package generated</option>
          )}
        </select>
      </label>
      <div className="mini-form-grid">
        <label className="field">
          <span>Target system</span>
          <input
            aria-label="Target system"
            value={targetSystem}
            disabled={disabled}
            onChange={(event) => setTargetSystem(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Template name</span>
          <input
            aria-label="Template name"
            value={templateName}
            disabled={disabled}
            onChange={(event) => setTemplateName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Template version</span>
          <input
            aria-label="Template version"
            value={templateVersion}
            disabled={disabled}
            onChange={(event) => setTemplateVersion(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Validation status</span>
          <select
            aria-label="Validation status"
            value={validationStatus}
            disabled={disabled}
            onChange={(event) => setValidationStatus(event.target.value)}
          >
            {exportTemplateValidationStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Mapping status</span>
          <select
            aria-label="Mapping status"
            value={mappingStatus}
            disabled={disabled}
            onChange={(event) => setMappingStatus(event.target.value)}
          >
            {exportTemplateMappingStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Submission mode</span>
          <select
            aria-label="Submission mode"
            value={submissionMode}
            disabled={disabled}
            onChange={(event) => setSubmissionMode(event.target.value)}
          >
            {exportTemplateSubmissionModeOptions.map((option) => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Required export sections</span>
          <input
            aria-label="Required export sections"
            type="number"
            min="0"
            value={requiredSections}
            disabled={disabled}
            onChange={(event) => setRequiredSections(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Mapped export sections</span>
          <input
            aria-label="Mapped export sections"
            type="number"
            min="0"
            value={mappedSections}
            disabled={disabled}
            onChange={(event) => setMappedSections(event.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span>Mapping evidence</span>
        <textarea
          aria-label="Mapping evidence"
          value={mappingEvidence}
          disabled={disabled}
          onChange={(event) => setMappingEvidence(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Validation evidence</span>
        <textarea
          aria-label="Validation evidence"
          value={validationEvidence}
          disabled={disabled}
          onChange={(event) => setValidationEvidence(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Export review note</span>
        <textarea
          aria-label="Export review note"
          value={reviewNote}
          disabled={disabled}
          onChange={(event) => setReviewNote(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Export template next review</span>
        <input
          aria-label="Export template next review"
          type="date"
          value={nextReviewDate}
          disabled={disabled}
          onChange={(event) => setNextReviewDate(event.target.value)}
        />
      </label>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !ready}
        title={!selectedExport ? "Generate a district system package before recording a template review." : undefined}
        onClick={() =>
          dispatch(
            {
              type: "reviewExportTemplate",
              exportId: selectedExport?.id || "",
              targetSystem: targetSystem.trim(),
              templateName: templateName.trim(),
              templateVersion: templateVersion.trim(),
              format: selectedExport?.format || "json",
              validationStatus,
              mappingStatus,
              submissionMode,
              requiredSections: Number(requiredSections || schemaSections.length),
              mappedSections: Number(mappedSections || requiredSections || schemaSections.length),
              mappingEvidence: mappingEvidence.trim(),
              validationEvidence: validationEvidence.trim(),
              reviewNote: reviewNote.trim(),
              nextReviewDate
            },
            {
              title: "Export template reviewed",
              detail: `${templateName.trim()} mapping readiness recorded.`
            }
          )
        }
      >
        Record export template review
      </Button>
    </div>
  );
}

function RetentionPolicyReviewForm({ packages = [], anchors = [], dispatch, disabled = false }) {
  const latestPackage = packages[0] || null;
  const latestAnchor = anchors.find((anchor) => anchor.id === latestPackage?.anchorId) || anchors[0] || null;
  const [retentionPackageId, setRetentionPackageId] = useState(latestPackage?.id || "");
  const [policyScope, setPolicyScope] = useState("Audit trail and retention manifests");
  const [policySource, setPolicySource] = useState("Riverbend draft records schedule RBSD-RET-2026");
  const [disposition, setDisposition] = useState("District schedule needed");
  const [retentionPeriod, setRetentionPeriod] = useState(
    "Retain local audit-chain evidence, source-aligned workspace records, and sealed manifests until the district approves a records schedule, legal-hold process, and immutable storage location."
  );
  const [legalHoldStatus, setLegalHoldStatus] = useState("Counsel review needed");
  const [archiveDecision, setArchiveDecision] = useState("Archive blocked");
  const [evidenceSummary, setEvidenceSummary] = useState(
    "Policy review links the latest local retention manifest, audit anchor, export metadata, and WORM integration readiness for district records-owner review."
  );
  const [nextReviewDate, setNextReviewDate] = useState("2026-10-15");

  useEffect(() => {
    if (!packages.length) {
      setRetentionPackageId("");
      return;
    }
    if (!packages.some((item) => item.id === retentionPackageId)) {
      setRetentionPackageId(packages[0].id);
    }
  }, [packages, retentionPackageId]);

  const selectedPackage = packages.find((item) => item.id === retentionPackageId) || latestPackage;
  const selectedAnchor = anchors.find((anchor) => anchor.id === selectedPackage?.anchorId) || latestAnchor;
  const ready = Boolean(policySource.trim() && retentionPeriod.trim() && evidenceSummary.trim());

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Retention evidence package</span>
        <select
          aria-label="Retention evidence package"
          value={retentionPackageId}
          disabled={disabled || packages.length === 0}
          onChange={(event) => setRetentionPackageId(event.target.value)}
        >
          {packages.length ? (
            packages.map((item) => (
              <option value={item.id} key={item.id}>
                {item.status} · sequence {item.anchoredSequence}
              </option>
            ))
          ) : (
            <option value="">No sealed manifest yet</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Retention policy scope</span>
        <select
          aria-label="Retention policy scope"
          value={policyScope}
          disabled={disabled}
          onChange={(event) => setPolicyScope(event.target.value)}
        >
          {retentionPolicyScopeOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Retention policy source</span>
        <input
          aria-label="Retention policy source"
          value={policySource}
          disabled={disabled}
          onChange={(event) => setPolicySource(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Retention disposition</span>
        <select
          aria-label="Retention disposition"
          value={disposition}
          disabled={disabled}
          onChange={(event) => setDisposition(event.target.value)}
        >
          {retentionPolicyDispositionOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Legal hold status</span>
        <select
          aria-label="Legal hold status"
          value={legalHoldStatus}
          disabled={disabled}
          onChange={(event) => setLegalHoldStatus(event.target.value)}
        >
          {retentionLegalHoldOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Archive decision</span>
        <select
          aria-label="Archive decision"
          value={archiveDecision}
          disabled={disabled}
          onChange={(event) => setArchiveDecision(event.target.value)}
        >
          {retentionArchiveDecisionOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Retention period or trigger</span>
        <textarea
          aria-label="Retention period or trigger"
          value={retentionPeriod}
          disabled={disabled}
          onChange={(event) => setRetentionPeriod(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Retention policy evidence</span>
        <textarea
          aria-label="Retention policy evidence"
          value={evidenceSummary}
          disabled={disabled}
          onChange={(event) => setEvidenceSummary(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Policy next review</span>
        <input
          aria-label="Policy next review"
          type="date"
          value={nextReviewDate}
          disabled={disabled}
          onChange={(event) => setNextReviewDate(event.target.value)}
        />
      </label>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "reviewRetentionPolicy",
              retentionPackageId: selectedPackage?.id || "",
              anchorId: selectedAnchor?.id || "",
              policyScope,
              policySource: policySource.trim(),
              disposition,
              retentionPeriod: retentionPeriod.trim(),
              legalHoldStatus,
              archiveDecision,
              evidenceSummary: evidenceSummary.trim(),
              nextReviewDate
            },
            {
              title: "Retention policy reviewed",
              detail: "District retention, archive, and legal-hold policy review recorded."
            }
          )
        }
      >
        Record retention policy review
      </Button>
    </div>
  );
}

function LanguageAccessForm({ meetingId, languageAccess, dispatch, canRequest = false, canCoordinate = false }) {
  const [preferredLanguage, setPreferredLanguage] = useState(languageAccess.preferredLanguage || "English");
  const [interpreterNeeded, setInterpreterNeeded] = useState(Boolean(languageAccess.interpreterNeeded));
  const [requestNote, setRequestNote] = useState(languageAccess.requestNote || "Please provide a family-friendly summary before the meeting.");
  const [translationStatus, setTranslationStatus] = useState(languageAccess.translationStatus || "Requested");
  const [interpreterStatus, setInterpreterStatus] = useState(languageAccess.interpreterStatus || "Requested");
  const [coordinatorNote, setCoordinatorNote] = useState(languageAccess.coordinatorNote || "Interpreter assignment is being confirmed.");
  useEffect(() => {
    setPreferredLanguage(languageAccess.preferredLanguage || "English");
    setInterpreterNeeded(Boolean(languageAccess.interpreterNeeded));
    setRequestNote(languageAccess.requestNote || "Please provide a family-friendly summary before the meeting.");
    setTranslationStatus(languageAccess.translationStatus || "Requested");
    setInterpreterStatus(languageAccess.interpreterStatus || "Requested");
    setCoordinatorNote(languageAccess.coordinatorNote || "Interpreter assignment is being confirmed.");
  }, [languageAccess]);

  const disabled = !canRequest && !canCoordinate;
  return (
    <div className="meeting-input">
      <label className="field">
        <span>Preferred language</span>
        <select value={preferredLanguage} disabled={disabled} onChange={(event) => setPreferredLanguage(event.target.value)}>
          {["English", "Spanish", "Arabic", "Chinese", "Vietnamese"].map((language) => (
            <option value={language} key={language}>{language}</option>
          ))}
        </select>
      </label>
      <label className="field check-field">
        <input
          type="checkbox"
          checked={interpreterNeeded}
          disabled={disabled}
          onChange={(event) => setInterpreterNeeded(event.target.checked)}
        />
        <span>Interpreter needed for the meeting</span>
      </label>
      <label className="field">
        <span>Family note</span>
        <textarea value={requestNote} disabled={disabled} onChange={(event) => setRequestNote(event.target.value)} />
      </label>
      {canCoordinate ? (
        <>
          <label className="field">
            <span>Translation status</span>
            <select value={translationStatus} onChange={(event) => setTranslationStatus(event.target.value)}>
              {["Requested", "Draft ready", "Human reviewed", "Not needed"].map((status) => (
                <option value={status} key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Interpreter status</span>
            <select value={interpreterStatus} onChange={(event) => setInterpreterStatus(event.target.value)}>
              {["Requested", "Interpreter assigned", "Not needed"].map((status) => (
                <option value={status} key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Coordinator note</span>
            <textarea value={coordinatorNote} onChange={(event) => setCoordinatorNote(event.target.value)} />
          </label>
        </>
      ) : null}
      <Button
        variant="primary"
        icon={MessageSquare}
        disabled={disabled}
        onClick={() =>
          dispatch(
            {
              type: "updateLanguageAccess",
              meetingId,
              preferredLanguage,
              interpreterNeeded,
              requestNote,
              translationStatus,
              interpreterStatus,
              coordinatorNote,
              coordinate: canCoordinate
            },
            {
              title: canCoordinate ? "Language access coordinated" : "Language access requested",
              detail: canCoordinate ? "Translation and interpreter status updated." : "Language support request saved."
            }
          )
        }
      >
        {canCoordinate ? "Update language support" : "Request language support"}
      </Button>
    </div>
  );
}

function GlossaryClarificationForm({ meetingId, glossary, dispatch, disabled = false }) {
  const [termId, setTermId] = useState(glossary[0]?.id || "");
  const [status, setStatus] = useState("Needs explanation");
  const [note, setNote] = useState("Please explain how this term applies to Jordan's IEP.");
  const selected = glossary.find((item) => item.id === termId);
  useEffect(() => {
    if (!glossary.some((item) => item.id === termId)) {
      setTermId(glossary[0]?.id || "");
    }
  }, [glossary, termId]);
  return (
    <div className="meeting-input">
      <label className="field">
        <span>Glossary term</span>
        <select
          aria-label="Glossary term"
          value={termId}
          disabled={disabled || !glossary.length}
          onChange={(event) => setTermId(event.target.value)}
        >
          {glossary.map((item) => (
            <option value={item.id} key={item.id}>{item.term}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Term clarity status</span>
        <select
          aria-label="Term clarity status"
          value={status}
          disabled={disabled || !termId}
          onChange={(event) => setStatus(event.target.value)}
        >
          {glossaryClarityStatusOptions.map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field wide">
        <span>Term question or note</span>
        <textarea
          aria-label="Term question or note"
          value={note}
          disabled={disabled || !termId}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button
        variant="secondary"
        icon={MessageSquare}
        disabled={disabled || !termId}
        onClick={() =>
          dispatch(
            {
              type: "updateGlossaryTerm",
              meetingId,
              termId,
              status,
              note: note.trim(),
              coordinate: false
            },
            { title: "Glossary clarification requested", detail: selected?.term || "Glossary term updated." }
          )
        }
      >
        Update glossary note
      </Button>
    </div>
  );
}

function GlossaryResponseForm({ meetingId, glossary, dispatch, disabled = false }) {
  const needsResponse = glossary.filter((item) =>
    ["Needs explanation", "Interpreter explanation requested"].includes(item.clarityStatus)
  );
  const options = needsResponse.length ? needsResponse : glossary;
  const [termId, setTermId] = useState(options[0]?.id || "");
  const [responseStatus, setResponseStatus] = useState("Explained by staff");
  const [response, setResponse] = useState("Reviewed this term in plain language and confirmed the official IEP wording stays unchanged.");
  const selected = glossary.find((item) => item.id === termId);
  useEffect(() => {
    if (!options.some((item) => item.id === termId)) {
      setTermId(options[0]?.id || "");
    }
  }, [options, termId]);
  return (
    <div className="meeting-input">
      <label className="field">
        <span>Glossary response term</span>
        <select
          aria-label="Glossary response term"
          value={termId}
          disabled={disabled || !options.length}
          onChange={(event) => setTermId(event.target.value)}
        >
          {options.map((item) => (
            <option value={item.id} key={item.id}>{item.term}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Glossary response status</span>
        <select
          aria-label="Glossary response status"
          value={responseStatus}
          disabled={disabled || !termId}
          onChange={(event) => setResponseStatus(event.target.value)}
        >
          {glossaryResponseStatusOptions.map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field wide">
        <span>Glossary response</span>
        <textarea
          aria-label="Glossary response"
          value={response}
          disabled={disabled || !termId}
          onChange={(event) => setResponse(event.target.value)}
        />
      </label>
      <Button
        variant="secondary"
        icon={MessageSquare}
        disabled={disabled || !termId}
        onClick={() =>
          dispatch(
            {
              type: "updateGlossaryTerm",
              meetingId,
              termId,
              responseStatus,
              response: response.trim(),
              coordinate: true
            },
            { title: "Glossary explanation recorded", detail: selected?.term || "Glossary response saved." }
          )
        }
      >
        Record glossary response
      </Button>
    </div>
  );
}

function ConcernForm({ meetingId, dispatch, disabled = false }) {
  const [title, setTitle] = useState("Service recovery question");
  const [concern, setConcern] = useState("Please clarify when missed service minutes will be recovered.");
  const ready = title.trim() && concern.trim();
  return (
    <div className="meeting-input">
      <label className="field">
        <span>Concern title</span>
        <input value={title} disabled={disabled} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="field">
        <span>Concern detail</span>
        <textarea value={concern} disabled={disabled} onChange={(event) => setConcern(event.target.value)} />
      </label>
      <Button
        variant="primary"
        icon={MessageSquare}
        disabled={disabled || !ready}
        onClick={() => {
          dispatch(
            { type: "submitConcern", meetingId, title: title.trim(), concern: concern.trim() },
            { title: "Concern logged", detail: "Concern added to the early-resolution record." }
          );
          setTitle("");
          setConcern("");
        }}
      >
        Log concern
      </Button>
    </div>
  );
}

function DraftRevisionForm({ draft, dispatch, disabled = false }) {
  const sections = draft?.sections || [];
  const [sectionId, setSectionId] = useState(draftSectionKey(sections[0]) || "");
  const selectedSection = useMemo(
    () => sections.find((section) => draftSectionKey(section) === sectionId),
    [sections, sectionId]
  );
  const [content, setContent] = useState(selectedSection?.content || "");
  const [revisionNote, setRevisionNote] = useState("Reviewed for clarity, measurement, and source fidelity.");

  useEffect(() => {
    if (!sections.some((section) => draftSectionKey(section) === sectionId)) {
      setSectionId(draftSectionKey(sections[0]) || "");
    }
  }, [sections, sectionId]);

  useEffect(() => {
    setContent(selectedSection?.content || "");
    setRevisionNote("Reviewed for clarity, measurement, and source fidelity.");
  }, [selectedSection]);

  const ready = draft?.id && sectionId && content.trim();

  return (
    <div className="draft-revision-form">
      <label className="field">
        <span>Draft section</span>
        <select
          aria-label="Draft section"
          value={sectionId}
          disabled={disabled || sections.length === 0}
          onChange={(event) => setSectionId(event.target.value)}
        >
          {sections.length ? (
            sections.map((section) => (
              <option value={draftSectionKey(section)} key={draftSectionKey(section)}>
                {section.heading}
              </option>
            ))
          ) : (
            <option value="">No draft sections</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Revised draft text</span>
        <textarea
          aria-label="Revised draft text"
          value={content}
          disabled={disabled || !sectionId}
          onChange={(event) => setContent(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Revision note</span>
        <input
          aria-label="Revision note"
          value={revisionNote}
          disabled={disabled || !sectionId}
          onChange={(event) => setRevisionNote(event.target.value)}
        />
      </label>
      <div className="button-row">
        <Button
          variant="primary"
          icon={Edit3}
          disabled={disabled || !ready}
          onClick={() =>
            dispatch(
              {
                type: "reviseDraftSection",
                draftId: draft.id,
                sectionId,
                content: content.trim(),
                revisionNote: revisionNote.trim()
              },
              { title: "Draft revision saved", detail: "Version history preserved for human review." }
            )
          }
        >
          Save draft revision
        </Button>
        <Button
          icon={Sparkles}
          disabled={disabled || !draft?.id || !sectionId}
          onClick={() =>
            dispatch(
              {
                type: "regenerateDraftSection",
                draftId: draft.id,
                sectionId,
                guidance: revisionNote.trim()
              },
              { title: "Draft section regenerated", detail: "Prior draft language remains in version history." }
            )
          }
        >
          Regenerate section
        </Button>
      </div>
    </div>
  );
}

function DraftDiffResolutionForm({ draftDiffs, dispatch, disabled = false }) {
  const openDiffs = draftDiffs.filter((diff) => diff.status !== "Finalized");
  const [diffId, setDiffId] = useState(openDiffs[0]?.id || "");
  const selectedDiff = openDiffs.find((diff) => diff.id === diffId);
  const [finalText, setFinalText] = useState(selectedDiff?.finalText || selectedDiff?.draftText || "");
  const [decisionRationale, setDecisionRationale] = useState(
    "Team reviewed the proposal with available evidence and will preserve final wording in the meeting record."
  );

  useEffect(() => {
    if (!openDiffs.some((diff) => diff.id === diffId)) setDiffId(openDiffs[0]?.id || "");
  }, [diffId, openDiffs]);

  useEffect(() => {
    setFinalText(selectedDiff?.finalText || selectedDiff?.draftText || "");
    setDecisionRationale(
      selectedDiff?.decisionRationale ||
        "Team reviewed the proposal with available evidence and will preserve final wording in the meeting record."
    );
  }, [selectedDiff]);

  const ready = diffId && finalText.trim() && decisionRationale.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Draft change to finalize</span>
        <select
          aria-label="Draft change to finalize"
          value={diffId}
          disabled={disabled || openDiffs.length === 0}
          onChange={(event) => setDiffId(event.target.value)}
        >
          {openDiffs.length ? (
            openDiffs.map((diff) => <option value={diff.id} key={diff.id}>{diff.section}</option>)
          ) : (
            <option value="">No open draft changes</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Final language</span>
        <textarea
          aria-label="Final language"
          value={finalText}
          disabled={disabled || !diffId}
          onChange={(event) => setFinalText(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Decision rationale</span>
        <textarea
          aria-label="Decision rationale"
          value={decisionRationale}
          disabled={disabled || !diffId}
          onChange={(event) => setDecisionRationale(event.target.value)}
        />
      </label>
      <Button
        icon={ClipboardCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "finalizeDraftDiff",
              diffId,
              finalText: finalText.trim(),
              decisionRationale: decisionRationale.trim()
            },
            { title: "Final language recorded", detail: "Draft-to-final change and rationale saved." }
          )
        }
      >
        Record final language
      </Button>
    </div>
  );
}

function ConcernResolutionForm({ concerns, dispatch, disabled = false }) {
  const openConcerns = concerns.filter((concern) => concern.status !== "Resolved");
  const [concernId, setConcernId] = useState(openConcerns[0]?.id || "");
  const [response, setResponse] = useState("The team reviewed the concern and identified a follow-up owner.");
  const [decision, setDecision] = useState("Recovery plan will be documented without changing the official service frequency.");
  const [nextStep, setNextStep] = useState("Case manager will send the recovery date and provider by Friday.");
  const [priorWrittenNotice, setPriorWrittenNotice] = useState(
    "No PWN generated in this demo; review if the team proposes or refuses a formal IEP change."
  );
  useEffect(() => {
    if (!openConcerns.some((concern) => concern.id === concernId)) setConcernId(openConcerns[0]?.id || "");
  }, [concernId, openConcerns]);
  const ready = concernId && response.trim() && decision.trim() && nextStep.trim();
  return (
    <div className="meeting-input">
      <label className="field">
        <span>Concern to resolve</span>
        <select value={concernId} disabled={disabled || openConcerns.length === 0} onChange={(event) => setConcernId(event.target.value)}>
          {openConcerns.length ? (
            openConcerns.map((concern) => <option value={concern.id} key={concern.id}>{concern.title}</option>)
          ) : (
            <option value="">No open concerns</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Staff response</span>
        <textarea value={response} disabled={disabled || !concernId} onChange={(event) => setResponse(event.target.value)} />
      </label>
      <label className="field">
        <span>Decision record</span>
        <textarea value={decision} disabled={disabled || !concernId} onChange={(event) => setDecision(event.target.value)} />
      </label>
      <label className="field">
        <span>Next step</span>
        <textarea value={nextStep} disabled={disabled || !concernId} onChange={(event) => setNextStep(event.target.value)} />
      </label>
      <label className="field">
        <span>PWN support note</span>
        <textarea
          value={priorWrittenNotice}
          disabled={disabled || !concernId}
          onChange={(event) => setPriorWrittenNotice(event.target.value)}
        />
      </label>
      <Button
        icon={ClipboardCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "resolveConcern",
              concernId,
              response: response.trim(),
              decision: decision.trim(),
              nextStep: nextStep.trim(),
              priorWrittenNotice: priorWrittenNotice.trim()
            },
            { title: "Decision recorded", detail: "Concern response and next step saved." }
          )
        }
      >
        Record decision
      </Button>
    </div>
  );
}

function ParticipantReadinessForm({ meetingId, participants, dispatch, disabled = false }) {
  const [participantId, setParticipantId] = useState(participants[0]?.id || "");
  const selectedParticipant = participants.find((participant) => participant.id === participantId);
  const [status, setStatus] = useState(selectedParticipant?.status || "Invited");
  const [mode, setMode] = useState(selectedParticipant?.mode || "In person");
  const [note, setNote] = useState(selectedParticipant?.note || "Participant status reviewed for meeting readiness.");

  useEffect(() => {
    if (!participants.some((participant) => participant.id === participantId)) setParticipantId(participants[0]?.id || "");
  }, [participantId, participants]);

  useEffect(() => {
    setStatus(selectedParticipant?.status || "Invited");
    setMode(selectedParticipant?.mode || "In person");
    setNote(selectedParticipant?.note || "Participant status reviewed for meeting readiness.");
  }, [selectedParticipant]);

  const ready = participantId && note.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Participant role</span>
        <select
          aria-label="Participant role"
          value={participantId}
          disabled={disabled || participants.length === 0}
          onChange={(event) => setParticipantId(event.target.value)}
        >
          {participants.length ? (
            participants.map((participant) => (
              <option value={participant.id} key={participant.id}>{participant.role} - {participant.name}</option>
            ))
          ) : (
            <option value="">No participants listed</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Attendance status</span>
        <select
          aria-label="Attendance status"
          value={status}
          disabled={disabled || !participantId}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option>Invited</option>
          <option>Confirmed</option>
          <option>Needs alternate</option>
        </select>
      </label>
      <label className="field">
        <span>Participation mode</span>
        <select
          aria-label="Participation mode"
          value={mode}
          disabled={disabled || !participantId}
          onChange={(event) => setMode(event.target.value)}
        >
          <option>In person</option>
          <option>Video option</option>
          <option>Phone</option>
          <option>Written input</option>
        </select>
      </label>
      <label className="field">
        <span>Participant note</span>
        <textarea
          aria-label="Participant note"
          value={note}
          disabled={disabled || !participantId}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button
        icon={Users}
        variant="primary"
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "updateParticipantReadiness",
              meetingId,
              participantId,
              status,
              mode,
              note: note.trim()
            },
            { title: "Participant readiness updated", detail: selectedParticipant?.role || "Required participant" }
          )
        }
      >
        Update participant readiness
      </Button>
    </div>
  );
}

function CalendarHoldForm({ meetingId, dispatch, disabled = false }) {
  const [provider, setProvider] = useState("District calendar (simulated)");
  const [attendanceMode, setAttendanceMode] = useState("In person with video option");
  const [note, setNote] = useState("Create a calendar hold from the current meeting invitation and participant list.");
  const ready = note.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Calendar provider</span>
        <select
          aria-label="Calendar provider"
          value={provider}
          disabled={disabled}
          onChange={(event) => setProvider(event.target.value)}
        >
          {calendarProviderOptions.map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Attendance mode</span>
        <select
          aria-label="Calendar attendance mode"
          value={attendanceMode}
          disabled={disabled}
          onChange={(event) => setAttendanceMode(event.target.value)}
        >
          {calendarAttendanceModeOptions.map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Calendar note</span>
        <textarea
          aria-label="Calendar note"
          value={note}
          disabled={disabled}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button
        icon={CalendarDays}
        variant="primary"
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "syncCalendarHold",
              meetingId,
              provider,
              attendanceMode,
              note: note.trim()
            },
            { title: "Calendar hold created", detail: "Simulated meeting calendar hold saved." }
          )
        }
      >
        Create calendar hold
      </Button>
    </div>
  );
}

function CompanionDocumentForm({ meetingId, documents, dispatch, disabled = false }) {
  const [documentId, setDocumentId] = useState(documents[0]?.id || "");
  const selectedDocument = documents.find((document) => document.id === documentId);
  const [status, setStatus] = useState(selectedDocument?.status || "Needs review");
  const [owner, setOwner] = useState(selectedDocument?.owner || "Case manager");
  const [dueDate, setDueDate] = useState(selectedDocument?.dueDate || "2026-07-01");
  const [note, setNote] = useState(selectedDocument?.note || "Review companion document readiness before the meeting.");

  useEffect(() => {
    if (!documents.some((document) => document.id === documentId)) setDocumentId(documents[0]?.id || "");
  }, [documentId, documents]);

  useEffect(() => {
    setStatus(selectedDocument?.status || "Needs review");
    setOwner(selectedDocument?.owner || "Case manager");
    setDueDate(selectedDocument?.dueDate || "2026-07-01");
    setNote(selectedDocument?.note || "Review companion document readiness before the meeting.");
  }, [selectedDocument]);

  const ready = documentId && owner.trim() && note.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Companion document</span>
        <select
          aria-label="Companion document"
          value={documentId}
          disabled={disabled || documents.length === 0}
          onChange={(event) => setDocumentId(event.target.value)}
        >
          {documents.length ? (
            documents.map((document) => <option value={document.id} key={document.id}>{document.title}</option>)
          ) : (
            <option value="">No companion documents listed</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Companion status</span>
        <select
          aria-label="Companion status"
          value={status}
          disabled={disabled || !documentId}
          onChange={(event) => setStatus(event.target.value)}
        >
          {["Needed", "Needs review", "In progress", "Sent", "Available", "Complete", "Review if change proposed", "Not needed"].map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Companion owner</span>
        <input
          aria-label="Companion owner"
          value={owner}
          disabled={disabled || !documentId}
          onChange={(event) => setOwner(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Companion due date</span>
        <input
          aria-label="Companion due date"
          type="date"
          value={dueDate}
          disabled={disabled || !documentId}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Companion note</span>
        <textarea
          aria-label="Companion note"
          value={note}
          disabled={disabled || !documentId}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button
        icon={ClipboardCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "updateCompanionDocument",
              meetingId,
              documentId,
              status,
              owner: owner.trim(),
              dueDate,
              note: note.trim()
            },
            { title: "Companion document updated", detail: selectedDocument?.title || "Related form readiness" }
          )
        }
      >
        Update companion document
      </Button>
    </div>
  );
}

function FamilyResourceForm({ meetingId, resources, dispatch, disabled = false }) {
  const [resourceId, setResourceId] = useState(resources[0]?.id || "");
  const selectedResource = resources.find((resource) => resource.id === resourceId);
  const [status, setStatus] = useState(selectedResource?.status || "Available");
  const [owner, setOwner] = useState(selectedResource?.owner || "Case manager");
  const [dueDate, setDueDate] = useState(selectedResource?.dueDate || "2026-07-01");
  const [note, setNote] = useState(selectedResource?.note || "Review resource-guide readiness before the meeting.");

  useEffect(() => {
    if (!resources.some((resource) => resource.id === resourceId)) setResourceId(resources[0]?.id || "");
  }, [resourceId, resources]);

  useEffect(() => {
    setStatus(selectedResource?.status || "Available");
    setOwner(selectedResource?.owner || "Case manager");
    setDueDate(selectedResource?.dueDate || "2026-07-01");
    setNote(selectedResource?.note || "Review resource-guide readiness before the meeting.");
  }, [selectedResource]);

  const ready = resourceId && owner.trim() && note.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Family resource</span>
        <select
          aria-label="Family resource"
          value={resourceId}
          disabled={disabled || resources.length === 0}
          onChange={(event) => setResourceId(event.target.value)}
        >
          {resources.length ? (
            resources.map((resource) => <option value={resource.id} key={resource.id}>{resource.title}</option>)
          ) : (
            <option value="">No resource-guide items</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Resource status</span>
        <select
          aria-label="Resource status"
          value={status}
          disabled={disabled || !resourceId}
          onChange={(event) => setStatus(event.target.value)}
        >
          {familyResourceStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Resource owner</span>
        <input
          aria-label="Resource owner"
          value={owner}
          disabled={disabled || !resourceId}
          onChange={(event) => setOwner(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Resource due date</span>
        <input
          aria-label="Resource due date"
          type="date"
          value={dueDate}
          disabled={disabled || !resourceId}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Resource note</span>
        <textarea
          aria-label="Resource note"
          value={note}
          disabled={disabled || !resourceId}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button
        icon={ClipboardCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "updateFamilyResource",
              meetingId,
              resourceId,
              status,
              owner: owner.trim(),
              dueDate,
              note: note.trim()
            },
            { title: "Family resource guide updated", detail: selectedResource?.title || "Resource-guide readiness" }
          )
        }
      >
        Update family resource
      </Button>
    </div>
  );
}

function FamilyResourceResponseForm({ meetingId, resources, role, dispatch, disabled = false }) {
  const availableResources = useMemo(
    () => resources.filter((resource) => familyResourceMatchesRole(role, resource)),
    [resources, role]
  );
  const [resourceId, setResourceId] = useState(availableResources[0]?.id || "");
  const selectedResource = availableResources.find((resource) => resource.id === resourceId);
  const [status, setStatus] = useState(selectedResource?.familyStatus || "Reviewed");
  const [note, setNote] = useState(selectedResource?.familyNote || "I reviewed this resource and will bring any questions to the meeting.");

  useEffect(() => {
    if (!availableResources.some((resource) => resource.id === resourceId)) setResourceId(availableResources[0]?.id || "");
  }, [availableResources, resourceId]);

  useEffect(() => {
    setStatus(selectedResource?.familyStatus || "Reviewed");
    setNote(selectedResource?.familyNote || "I reviewed this resource and will bring any questions to the meeting.");
  }, [selectedResource]);

  const ready = resourceId && note.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Resource response</span>
        <select
          aria-label="Resource response"
          value={resourceId}
          disabled={disabled || availableResources.length === 0}
          onChange={(event) => setResourceId(event.target.value)}
        >
          {availableResources.length ? (
            availableResources.map((resource) => <option value={resource.id} key={resource.id}>{resource.title}</option>)
          ) : (
            <option value="">No resource responses available</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Resource review status</span>
        <select
          aria-label="Resource review status"
          value={status}
          disabled={disabled || !resourceId}
          onChange={(event) => setStatus(event.target.value)}
        >
          {familyResourceResponseStatusOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Resource response note</span>
        <textarea
          aria-label="Resource response note"
          value={note}
          disabled={disabled || !resourceId}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button
        icon={MessageSquare}
        variant="primary"
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "acknowledgeFamilyResource",
              meetingId,
              resourceId,
              status,
              note: note.trim()
            },
            { title: "Family resource response recorded", detail: selectedResource?.title || "Resource response saved." }
          )
        }
      >
        Update resource response
      </Button>
    </div>
  );
}

function MeetingQuestionForm({ meetingId, dispatch, disabled = false }) {
  const [text, setText] = useState("Can we review how supports will be used during tests?");
  const trimmed = text.trim();
  return (
    <div className="meeting-input">
      <label className="field">
        <span>Question or concern</span>
        <textarea
          value={text}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <Button
        variant="primary"
        icon={MessageSquare}
        disabled={disabled || !trimmed}
        onClick={() => {
          dispatch(
            { type: "submitQuestion", meetingId, text: trimmed },
            { title: "Question submitted", detail: "Pre-meeting input was saved for the IEP team." }
          );
          setText("");
        }}
      >
        Submit question
      </Button>
    </div>
  );
}

function MeetingPrepNoteForm({ meetingId, role, dispatch, disabled = false }) {
  const defaultTopic = role === "parent" ? "Parent notes area" : role === "student" ? "Student meeting note" : "Team preparation note";
  const [topic, setTopic] = useState(defaultTopic);
  const [audience, setAudience] = useState(role === "parent" || role === "student" ? "IEP team" : "Staff and family");
  const [body, setBody] = useState("Add a note for the team to consider before the meeting.");
  const ready = topic.trim() && body.trim();

  useEffect(() => {
    setTopic(defaultTopic);
    setAudience(role === "parent" || role === "student" ? "IEP team" : "Staff and family");
  }, [defaultTopic, role]);

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Note topic</span>
        <input
          aria-label="Meeting prep note topic"
          value={topic}
          disabled={disabled}
          onChange={(event) => setTopic(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Visible to</span>
        <select
          aria-label="Meeting prep note audience"
          value={audience}
          disabled={disabled}
          onChange={(event) => setAudience(event.target.value)}
        >
          <option>IEP team</option>
          <option>Staff and family</option>
          <option>Student and team</option>
        </select>
      </label>
      <label className="field">
        <span>Meeting prep note</span>
        <textarea
          aria-label="Meeting prep note"
          value={body}
          disabled={disabled}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <Button
        variant="primary"
        icon={MessageSquare}
        disabled={disabled || !ready}
        onClick={() => {
          dispatch(
            {
              type: "addMeetingPrepNote",
              meetingId,
              topic: topic.trim(),
              audience,
              body: body.trim()
            },
            { title: "Meeting prep note added", detail: "Note saved for pre-meeting team review." }
          );
          setBody("");
        }}
      >
        Add meeting note
      </Button>
    </div>
  );
}

function StudentVoiceForm({ meetingId, currentValue, dispatch, disabled = false }) {
  const [studentVoice, setStudentVoice] = useState(currentValue || "");
  useEffect(() => {
    setStudentVoice(currentValue || "");
  }, [currentValue]);
  const trimmed = studentVoice.trim();
  return (
    <div className="meeting-input">
      <label className="field">
        <span>Student reflection</span>
        <textarea
          value={studentVoice}
          disabled={disabled}
          onChange={(event) => setStudentVoice(event.target.value)}
        />
      </label>
      <Button
        icon={Send}
        disabled={disabled || !trimmed || trimmed === currentValue}
        onClick={() =>
          dispatch(
            { type: "updateStudentVoice", meetingId, studentVoice: trimmed },
            { title: "Student voice updated", detail: "Reflection was saved for meeting preparation." }
          )
        }
      >
        Update reflection
      </Button>
    </div>
  );
}

function SelfAdvocacyForm({ meetingId, plan = {}, dispatch, disabled = false }) {
  const [preferredSupport, setPreferredSupport] = useState(plan?.preferredSupport || "Graphic organizer and written directions");
  const [participationGoal, setParticipationGoal] = useState(plan?.participationGoal || "Explain which support helps me start.");
  const [requestScript, setRequestScript] = useState(plan?.requestScript || "Can I use my organizer and see the written directions?");
  const [confidence, setConfidence] = useState(Number(plan?.confidence || 3));
  const [barrier, setBarrier] = useState(plan?.barrier || "I forget to ask before work starts.");
  const [nextStep, setNextStep] = useState(plan?.nextStep || "Practice once before the meeting.");

  useEffect(() => {
    setPreferredSupport(plan?.preferredSupport || "Graphic organizer and written directions");
    setParticipationGoal(plan?.participationGoal || "Explain which support helps me start.");
    setRequestScript(plan?.requestScript || "Can I use my organizer and see the written directions?");
    setConfidence(Number(plan?.confidence || 3));
    setBarrier(plan?.barrier || "I forget to ask before work starts.");
    setNextStep(plan?.nextStep || "Practice once before the meeting.");
  }, [plan]);

  const ready = preferredSupport.trim() && participationGoal.trim() && requestScript.trim() && barrier.trim() && nextStep.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Support I want to ask for</span>
        <input
          aria-label="Support I want to ask for"
          value={preferredSupport}
          disabled={disabled}
          onChange={(event) => setPreferredSupport(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Participation goal</span>
        <textarea
          aria-label="Self-advocacy participation goal"
          value={participationGoal}
          disabled={disabled}
          onChange={(event) => setParticipationGoal(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Practice script</span>
        <textarea
          aria-label="Self-advocacy practice script"
          value={requestScript}
          disabled={disabled}
          onChange={(event) => setRequestScript(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Confidence: {confidence} of 5</span>
        <input
          aria-label="Self-advocacy confidence"
          type="range"
          min="1"
          max="5"
          step="1"
          value={confidence}
          disabled={disabled}
          onChange={(event) => setConfidence(Number(event.target.value))}
        />
      </label>
      <label className="field">
        <span>What might get in the way</span>
        <textarea
          aria-label="Self-advocacy barrier"
          value={barrier}
          disabled={disabled}
          onChange={(event) => setBarrier(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Next practice step</span>
        <textarea
          aria-label="Self-advocacy practice action"
          value={nextStep}
          disabled={disabled}
          onChange={(event) => setNextStep(event.target.value)}
        />
      </label>
      <Button
        icon={Send}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "updateSelfAdvocacy",
              meetingId,
              preferredSupport: preferredSupport.trim(),
              participationGoal: participationGoal.trim(),
              requestScript: requestScript.trim(),
              confidence,
              barrier: barrier.trim(),
              nextStep: nextStep.trim()
            },
            { title: "Self-advocacy plan updated", detail: "Student preparation plan saved for team review." }
          )
        }
      >
        Update self-advocacy plan
      </Button>
    </div>
  );
}

function DistrictIntegrationReadinessForm({ integrations = [], dispatch, disabled = false }) {
  const [integrationId, setIntegrationId] = useState(integrations[0]?.id || "");
  const selected = integrations.find((integration) => integration.id === integrationId) || integrations[0] || null;
  const [status, setStatus] = useState(selected?.status || "Readiness review");
  const [provider, setProvider] = useState(selected?.provider || "");
  const [owner, setOwner] = useState(selected?.owner || "");
  const [nextReviewDate, setNextReviewDate] = useState(selected?.nextReviewDate || "");
  const [note, setNote] = useState(selected?.note || "");

  useEffect(() => {
    if (!integrations.length) {
      setIntegrationId("");
      return;
    }
    if (!integrations.some((integration) => integration.id === integrationId)) {
      setIntegrationId(integrations[0].id);
    }
  }, [integrations, integrationId]);

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.status || "Readiness review");
    setProvider(selected.provider || "");
    setOwner(selected.owner || "");
    setNextReviewDate(selected.nextReviewDate || "");
    setNote(selected.note || "");
  }, [selected]);

  const ready = selected && provider.trim() && owner.trim() && nextReviewDate.trim() && note.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>District integration</span>
        <select
          aria-label="District integration"
          value={integrationId}
          disabled={disabled || integrations.length === 0}
          onChange={(event) => setIntegrationId(event.target.value)}
        >
          {integrations.length ? (
            integrations.map((integration) => (
              <option value={integration.id} key={integration.id}>{integration.name}</option>
            ))
          ) : (
            <option value="">No integration records</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Integration status</span>
        <select
          aria-label="Integration status"
          value={status}
          disabled={disabled || !selected}
          onChange={(event) => setStatus(event.target.value)}
        >
          {districtIntegrationStatusOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Integration provider</span>
        <input
          aria-label="Integration provider"
          value={provider}
          disabled={disabled || !selected}
          onChange={(event) => setProvider(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Integration owner</span>
        <input
          aria-label="Integration owner"
          value={owner}
          disabled={disabled || !selected}
          onChange={(event) => setOwner(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Integration next review date</span>
        <input
          aria-label="Integration next review date"
          type="date"
          value={nextReviewDate}
          disabled={disabled || !selected}
          onChange={(event) => setNextReviewDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Readiness note</span>
        <textarea
          aria-label="Readiness note"
          value={note}
          disabled={disabled || !selected}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button
        icon={Building2}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "updateDistrictIntegration",
              integrationId,
              status,
              provider: provider.trim(),
              owner: owner.trim(),
              nextReviewDate,
              note: note.trim()
            },
            {
              title: "District integration readiness updated",
              detail: selected ? `${selected.name} readiness review saved.` : "Integration readiness review saved."
            }
          )
        }
      >
        Update integration readiness
      </Button>
    </div>
  );
}

function DataProtectionReadinessForm({ controls = [], dispatch, disabled = false }) {
  const [controlId, setControlId] = useState(controls[0]?.id || "");
  const selected = controls.find((control) => control.id === controlId) || controls[0] || null;
  const [status, setStatus] = useState(selected?.status || "Readiness review");
  const [control, setControl] = useState(selected?.control || "");
  const [owner, setOwner] = useState(selected?.owner || "");
  const [nextReviewDate, setNextReviewDate] = useState(selected?.nextReviewDate || "");
  const [evidenceNote, setEvidenceNote] = useState(selected?.evidenceNote || "");
  const [productionBoundary, setProductionBoundary] = useState(selected?.productionBoundary || "");

  useEffect(() => {
    if (!controls.length) {
      setControlId("");
      return;
    }
    if (!controls.some((item) => item.id === controlId)) {
      setControlId(controls[0].id);
    }
  }, [controls, controlId]);

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.status || "Readiness review");
    setControl(selected.control || "");
    setOwner(selected.owner || "");
    setNextReviewDate(selected.nextReviewDate || "");
    setEvidenceNote(selected.evidenceNote || "");
    setProductionBoundary(selected.productionBoundary || "");
  }, [selected]);

  const ready =
    selected &&
    control.trim() &&
    owner.trim() &&
    nextReviewDate.trim() &&
    evidenceNote.trim() &&
    productionBoundary.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Data protection control</span>
        <select
          aria-label="Data protection control"
          value={controlId}
          disabled={disabled || controls.length === 0}
          onChange={(event) => setControlId(event.target.value)}
        >
          {controls.length ? (
            controls.map((item) => (
              <option value={item.id} key={item.id}>{item.name}</option>
            ))
          ) : (
            <option value="">No data protection controls</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Data protection status</span>
        <select
          aria-label="Data protection status"
          value={status}
          disabled={disabled || !selected}
          onChange={(event) => setStatus(event.target.value)}
        >
          {districtIntegrationStatusOptions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Control evidence</span>
        <input
          aria-label="Control evidence"
          value={control}
          disabled={disabled || !selected}
          onChange={(event) => setControl(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Control owner</span>
        <input
          aria-label="Control owner"
          value={owner}
          disabled={disabled || !selected}
          onChange={(event) => setOwner(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Control next review date</span>
        <input
          aria-label="Control next review date"
          type="date"
          value={nextReviewDate}
          disabled={disabled || !selected}
          onChange={(event) => setNextReviewDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Data protection evidence note</span>
        <textarea
          aria-label="Data protection evidence note"
          value={evidenceNote}
          disabled={disabled || !selected}
          onChange={(event) => setEvidenceNote(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Production boundary note</span>
        <textarea
          aria-label="Production boundary note"
          value={productionBoundary}
          disabled={disabled || !selected}
          onChange={(event) => setProductionBoundary(event.target.value)}
        />
      </label>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "updateDataProtectionControl",
              controlId,
              status,
              control: control.trim(),
              owner: owner.trim(),
              nextReviewDate,
              evidenceNote: evidenceNote.trim(),
              productionBoundary: productionBoundary.trim()
            },
            {
              title: "Data protection readiness updated",
              detail: selected ? `${selected.name} readiness review saved.` : "Data protection readiness review saved."
            }
          )
        }
      >
        Update data protection readiness
      </Button>
    </div>
  );
}

function StaffContinuityForm({ records = [], dispatch, disabled = false }) {
  const [continuityId, setContinuityId] = useState(records[0]?.id || "");
  const selected = records.find((record) => record.id === continuityId) || records[0] || null;
  const [status, setStatus] = useState(selected?.status || "Coverage needed");
  const [riskLevel, setRiskLevel] = useState(selected?.riskLevel || "High");
  const [coverageOwner, setCoverageOwner] = useState(selected?.coverageOwner || "");
  const [nextReviewDate, setNextReviewDate] = useState(selected?.nextReviewDate || "");
  const [coveragePlan, setCoveragePlan] = useState(selected?.coveragePlan || "");

  useEffect(() => {
    if (!records.length) {
      setContinuityId("");
      return;
    }
    if (!records.some((record) => record.id === continuityId)) {
      setContinuityId(records[0].id);
    }
  }, [records, continuityId]);

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.status || "Coverage needed");
    setRiskLevel(selected.riskLevel || "High");
    setCoverageOwner(selected.coverageOwner || "");
    setNextReviewDate(selected.nextReviewDate || "");
    setCoveragePlan(selected.coveragePlan || "");
  }, [selected]);

  const ready = selected && coverageOwner.trim() && nextReviewDate.trim() && coveragePlan.trim();

  return (
    <div className="meeting-input">
      <label className="field">
        <span>Continuity record</span>
        <select
          aria-label="Continuity record"
          value={selected?.id || ""}
          disabled={disabled || !records.length}
          onChange={(event) => setContinuityId(event.target.value)}
        >
          {records.map((record) => (
            <option value={record.id} key={record.id}>{record.role}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Continuity status</span>
        <select
          aria-label="Continuity status"
          value={status}
          disabled={disabled || !selected}
          onChange={(event) => setStatus(event.target.value)}
        >
          {["Coverage needed", "Coverage assigned", "Covered", "Monitoring", "Escalated"].map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Continuity risk</span>
        <select
          aria-label="Continuity risk"
          value={riskLevel}
          disabled={disabled || !selected}
          onChange={(event) => setRiskLevel(event.target.value)}
        >
          {["Low", "Medium", "High"].map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Coverage owner</span>
        <input
          aria-label="Coverage owner"
          value={coverageOwner}
          disabled={disabled || !selected}
          onChange={(event) => setCoverageOwner(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Next continuity review</span>
        <input
          aria-label="Next continuity review"
          type="date"
          value={nextReviewDate}
          disabled={disabled || !selected}
          onChange={(event) => setNextReviewDate(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Coverage plan</span>
        <textarea
          aria-label="Coverage plan"
          value={coveragePlan}
          disabled={disabled || !selected}
          onChange={(event) => setCoveragePlan(event.target.value)}
        />
      </label>
      <Button
        icon={ShieldCheck}
        disabled={disabled || !ready}
        onClick={() =>
          dispatch(
            {
              type: "updateStaffContinuity",
              continuityId: selected.id,
              status,
              riskLevel,
              coverageOwner: coverageOwner.trim(),
              nextReviewDate: nextReviewDate.trim(),
              coveragePlan: coveragePlan.trim()
            },
            { title: "Continuity plan updated", detail: "Staffing coverage review saved for leadership follow-up." }
          )
        }
      >
        Update continuity plan
      </Button>
    </div>
  );
}

function GoalCard({ goal }) {
  const progressEntries = goal.progressEntries || [];
  const latest = progressEntries[progressEntries.length - 1];
  const schedule = goal.progressSchedule;
  const latestEvidence = latest?.evidenceLabel || latest?.evidenceDocumentId;
  return (
    <Card title={`${goal.domain} goal`} description={goal.annualGoal}>
      <div className="goal-meta">
        <MiniStat label="Baseline" value={goal.baseline} note={goal.presentLevelReference} />
        <MiniStat label="Current" value={`${latest?.value ?? "No"}${goal.id === "goal-002" ? "" : "%"}`} note={latest ? formatDate(latest.date) : "No entries"} />
        <MiniStat label="Criterion" value={goal.criteriaForMastery} note={goal.measurementMethod} />
      </div>
      <LineChart points={progressEntries.map((entry) => entry.value)} />
      <div className="chips">
        <span>{goal.frequency}</span>
        {schedule?.nextDueDate ? <span>Next due: {formatDate(schedule.nextDueDate)}</span> : null}
        {schedule?.status ? <span>{schedule.status}</span> : null}
        {latestEvidence ? <span>Evidence: {latestEvidence}</span> : null}
        <span>{goal.responsibleStaff.join(", ")}</span>
        <span>{goal.sourceReference}</span>
      </div>
    </Card>
  );
}

function ProgressSchedule({ goals }) {
  if (!goals.length) {
    return <EmptyState title="No measurement schedule" text="Progress collection dates will appear after goals are approved for this student." />;
  }
  return (
    <div className="list">
      {goals.map((goal) => {
        const schedule = goal.progressSchedule || {};
        return (
          <div className="question-row" key={goal.id}>
            <div>
              <strong>{goal.domain}</strong>
              <span>{schedule.frequency || goal.frequency} · {schedule.evidenceType || goal.measurementMethod}</span>
              <span>
                Last collected: {schedule.lastCollectedDate ? formatDate(schedule.lastCollectedDate) : "No confirmed data"}
                {schedule.nextDueDate ? ` · next due ${formatDate(schedule.nextDueDate)}` : ""}
              </span>
              <span>{schedule.responsibleRole || goal.responsibleStaff.join(", ")}</span>
            </div>
            <Badge tone={scheduleTone(schedule.status)}>{schedule.status || "Unscheduled"}</Badge>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ points }) {
  const max = Math.max(...points, 100);
  const min = Math.min(...points, 0);
  const coords = points.map((point, index) => {
    const x = 20 + index * (260 / Math.max(1, points.length - 1));
    const y = 100 - ((point - min) / Math.max(1, max - min)) * 76;
    return `${x},${y}`;
  });
  return (
    <svg className="line-chart" viewBox="0 0 310 120" role="img" aria-label="Progress chart">
      <line x1="20" y1="20" x2="290" y2="20" />
      <line x1="20" y1="60" x2="290" y2="60" />
      <line x1="20" y1="100" x2="290" y2="100" />
      <polyline points={coords.join(" ")} />
      {coords.map((coord) => {
        const [cx, cy] = coord.split(",");
        return <circle key={coord} cx={cx} cy={cy} r="3" />;
      })}
    </svg>
  );
}

function ProgressForm({ goals, documents = [], dispatch, disabled = false }) {
  const [goalId, setGoalId] = useState(goals[0]?.id || "");
  const [value, setValue] = useState("74");
  const [date, setDate] = useState("2026-06-23");
  const [notes, setNotes] = useState("Student used the approved support and completed the progress-monitoring task.");
  const selectedGoal = goals.find((goal) => goal.id === goalId) || goals[0];
  const [evidenceDocumentId, setEvidenceDocumentId] = useState(documents[0]?.id || "");
  const [evidenceLabel, setEvidenceLabel] = useState(selectedGoal?.progressSchedule?.evidenceType || "Progress monitoring evidence");
  const [evidenceType, setEvidenceType] = useState(selectedGoal?.progressSchedule?.evidenceType || "Probe");

  useEffect(() => {
    if (!goals.some((goal) => goal.id === goalId)) setGoalId(goals[0]?.id || "");
  }, [goalId, goals]);

  useEffect(() => {
    if (!documents.some((document) => document.id === evidenceDocumentId)) setEvidenceDocumentId(documents[0]?.id || "");
  }, [documents, evidenceDocumentId]);

  useEffect(() => {
    setEvidenceLabel(selectedGoal?.progressSchedule?.evidenceType || "Progress monitoring evidence");
    setEvidenceType(selectedGoal?.progressSchedule?.evidenceType || "Probe");
  }, [selectedGoal]);

  const hasGoal = goals.length > 0;

  return (
    <div className="stack">
      <label className="field">
        <span>Goal</span>
        <select value={goalId} disabled={disabled || !hasGoal} onChange={(event) => setGoalId(event.target.value)}>
          {hasGoal ? (
            goals.map((goal) => <option value={goal.id} key={goal.id}>{goal.domain}</option>)
          ) : (
            <option value="">No goals available</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Date</span>
        <input type="date" value={date} disabled={disabled || !goalId} onChange={(event) => setDate(event.target.value)} />
      </label>
      <label className="field">
        <span>Result</span>
        <input value={value} disabled={disabled || !goalId} onChange={(event) => setValue(event.target.value)} inputMode="decimal" />
      </label>
      <label className="field">
        <span>Observation note</span>
        <textarea value={notes} disabled={disabled || !goalId} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <label className="field">
        <span>Evidence document</span>
        <select
          aria-label="Evidence document"
          value={evidenceDocumentId}
          disabled={disabled || !goalId || documents.length === 0}
          onChange={(event) => setEvidenceDocumentId(event.target.value)}
        >
          {documents.length ? (
            documents.map((document) => <option value={document.id} key={document.id}>{document.name}</option>)
          ) : (
            <option value="">No preserved documents</option>
          )}
        </select>
      </label>
      <label className="field">
        <span>Evidence label</span>
        <input
          aria-label="Evidence label"
          value={evidenceLabel}
          disabled={disabled || !goalId}
          onChange={(event) => setEvidenceLabel(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Evidence type</span>
        <input
          aria-label="Evidence type"
          value={evidenceType}
          disabled={disabled || !goalId}
          onChange={(event) => setEvidenceType(event.target.value)}
        />
      </label>
      <Button
        variant="primary"
        icon={Plus}
        disabled={disabled || !goalId}
        onClick={() =>
          dispatch(
            {
              type: "addProgress",
              goalId,
              date,
              value,
              notes,
              evidenceDocumentId,
              evidenceLabel: evidenceLabel.trim(),
              evidenceType: evidenceType.trim()
            },
            { title: "Progress saved", detail: "Goal evidence and audit log updated." }
          )
        }
      >
        Add data point
      </Button>
    </div>
  );
}

function QualityRow({ icon: Icon, title, text, warn }) {
  return (
    <div className={`quality-row ${warn ? "warn" : ""}`}>
      <Icon size={15} />
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="empty">
      <Sparkles size={22} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function AccessNotice({ text }) {
  return (
    <div className="access-notice">
      <Lock size={15} />
      <span>{text}</span>
    </div>
  );
}

function nextLanguageAccess(current, action, state) {
  const now = new Date().toISOString();
  const preferredLanguage = action.preferredLanguage || current?.preferredLanguage || "English";
  const interpreterNeeded = Boolean(action.interpreterNeeded);
  const next = {
    ...defaultLanguageAccess(),
    ...(current || {}),
    preferredLanguage,
    interpreterNeeded,
    requestNote: action.requestNote || current?.requestNote || "",
    requestedBy: action.coordinate ? current?.requestedBy || state.user.name : state.user.name,
    requestedAt: action.coordinate ? current?.requestedAt || now : now,
    translatedSummary:
      preferredLanguage === "English" ? null : languageAccessDraft(preferredLanguage, state.summaries.parent)
  };
  if (action.coordinate) {
    return {
      ...next,
      translationStatus: action.translationStatus || next.translationStatus || "Requested",
      interpreterStatus: action.interpreterStatus || next.interpreterStatus || (interpreterNeeded ? "Requested" : "Not needed"),
      coordinatorNote: action.coordinatorNote || next.coordinatorNote || "Language support coordination updated.",
      coordinatedBy: state.user.name,
      coordinatedAt: now
    };
  }
  return {
    ...next,
    translationStatus: preferredLanguage === "English" ? "Not needed" : "Requested",
    interpreterStatus: interpreterNeeded ? "Requested" : "Not needed",
    coordinatorNote: next.coordinatorNote || "Language support request is awaiting staff coordination."
  };
}

function defaultGlossaryItems() {
  return [
    {
      id: "glossary-accommodation",
      term: "Accommodation",
      plainLanguage: "A support that helps Jordan access the same work.",
      sourceReference: "IEP Section: Supplementary Aids, Services, and Program Modifications",
      sourceAlignment: defaultSourceAlignment,
      clarityStatus: "Not reviewed",
      clarityNote: "",
      staffResponseStatus: "Not started",
      staffResponse: "",
      officialRecordImpact: "Glossary clarification supports understanding only; it does not change the official IEP accommodation language."
    },
    {
      id: "glossary-progress-monitoring",
      term: "Progress monitoring",
      plainLanguage: "How the team checks whether the goal is improving.",
      sourceReference: "IEP Section: Measurable Annual Goals",
      sourceAlignment: defaultSourceAlignment,
      clarityStatus: "Not reviewed",
      clarityNote: "",
      staffResponseStatus: "Not started",
      staffResponse: "",
      officialRecordImpact: "Glossary clarification supports understanding only; official progress-report decisions still require team review."
    },
    {
      id: "glossary-related-service",
      term: "Related service",
      plainLanguage: "A service, such as speech-language support, that helps Jordan benefit from school.",
      sourceReference: "IEP Section: Special Education / Related Services Grid",
      sourceAlignment: defaultSourceAlignment,
      clarityStatus: "Not reviewed",
      clarityNote: "",
      staffResponseStatus: "Not started",
      staffResponse: "",
      officialRecordImpact: "Glossary clarification supports understanding only; it does not create or revise service minutes."
    }
  ];
}

function normalizeGlossaryItems(glossary = []) {
  const defaults = defaultGlossaryItems();
  const sourceItems = Array.isArray(glossary) ? glossary : [];
  const items = sourceItems.length ? sourceItems : defaults;
  return items.map((item, index) => {
    const match = defaults.find((defaultItem) => defaultItem.id === item.id || defaultItem.term === item.term) || defaults[index] || {};
    const term = item.term || match.term || "IEP term";
    return {
      ...match,
      ...item,
      id: item.id || match.id || `glossary-${slugifyTerm(term)}`,
      term,
      plainLanguage: item.plainLanguage || match.plainLanguage || "Plain-language explanation pending human review.",
      sourceReference: item.sourceReference || match.sourceReference || "IEP source reference pending",
      sourceAlignment: item.sourceAlignment || match.sourceAlignment || defaultSourceAlignment,
      clarityStatus: normalizeGlossaryClarityStatus(item.clarityStatus),
      clarityNote: item.clarityNote || "",
      staffResponseStatus: normalizeGlossaryResponseStatus(item.staffResponseStatus),
      staffResponse: item.staffResponse || "",
      officialRecordImpact:
        item.officialRecordImpact ||
        match.officialRecordImpact ||
        "Glossary clarification supports understanding only; it does not revise the official IEP."
    };
  });
}

function slugifyTerm(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "term";
}

function normalizeGlossaryClarityStatus(status) {
  return glossaryClarityStatusOptions.includes(status) ? status : "Not reviewed";
}

function normalizeGlossaryResponseStatus(status) {
  return glossaryResponseStatusOptions.includes(status) ? status : "Not started";
}

function defaultLanguageAccess() {
  return {
    preferredLanguage: "English",
    interpreterNeeded: false,
    translationStatus: "Not requested",
    interpreterStatus: "Not needed",
    requestedBy: null,
    requestedAt: null,
    requestNote: "",
    coordinatorNote: "",
    translatedSummary: null,
    glossary: defaultGlossaryItems()
  };
}

function languageAccessDraft(language, parentSummary = {}) {
  return {
    language,
    status: "Draft translation support - human review required",
    title: language === "Spanish" ? "Resumen familiar en lenguaje sencillo" : `${language} family summary draft`,
    disclaimer: "Draft language support is for review and does not replace the official IEP or qualified interpretation.",
    sections: (parentSummary.sections || []).map((section) => ({
      heading: language === "Spanish" ? translateSpanish(section.heading) : section.heading,
      text: section.text ? (language === "Spanish" ? translateSpanish(section.text) : section.text) : null,
      bullets: section.bullets?.map((bullet) => (language === "Spanish" ? translateSpanish(bullet) : bullet)) || null,
      sourceReference: section.sourceReference || null
    }))
  };
}

function translateSpanish(value) {
  return [
    ["What the plan supports", "Lo que apoya el plan"],
    ["What the school should provide", "Lo que la escuela debe proporcionar"],
    ["What each goal means", "Lo que significa cada meta"],
    ["How progress will be measured", "Como se medira el progreso"],
    ["Services required", "Servicios requeridos"],
    ["Questions for next meeting", "Preguntas para la proxima reunion"],
    ["What changed from the previous IEP", "Lo que cambio desde el IEP anterior"],
    ["What the family can ask", "Lo que la familia puede preguntar"],
    ["Jordan is working on understanding what is read, organizing written work, and completing classroom routines independently.", "Jordan esta trabajando en comprender lo que lee, organizar el trabajo escrito y completar rutinas de clase con mayor independencia."],
    ["Reading support three times each week.", "Apoyo de lectura tres veces por semana."],
    ["Speech-language support for 30 minutes once each week.", "Apoyo de habla y lenguaje por 30 minutos una vez por semana."],
    ["Written and visual directions, a graphic organizer, and extended time as written.", "Instrucciones escritas y visuales, un organizador grafico y tiempo extendido segun lo escrito."],
    ["Reading comprehension: Jordan is working on answering questions about a passage with an approved organizer.", "Comprension de lectura: Jordan esta trabajando en responder preguntas sobre un texto con un organizador aprobado."],
    ["Written expression: Jordan is working on planning and organizing multi-paragraph writing.", "Expresion escrita: Jordan esta trabajando en planificar y organizar escritos de varios parrafos."],
    ["Executive functioning: Jordan is working on completing classroom routines with more independence.", "Funcion ejecutiva: Jordan esta trabajando en completar rutinas de clase con mas independencia."],
    ["Reading is checked with weekly comprehension probes.", "La lectura se revisa con pruebas semanales de comprension."],
    ["Writing is checked with monthly rubric-scored samples.", "La escritura se revisa con muestras mensuales calificadas con rubrica."],
    ["Classroom routines are checked with weekly teacher ratings.", "Las rutinas de clase se revisan con calificaciones semanales del maestro."],
    ["Executive-function coaching: 15 minutes two times each week.", "Apoyo de funcion ejecutiva: 15 minutos dos veces por semana."],
    ["How will recent reading data change the support plan?", "Como cambiaran los datos recientes de lectura el plan de apoyo?"],
    ["How will missed speech-language minutes be recovered?", "Como se recuperaran los minutos perdidos de habla y lenguaje?"],
    ["The current reading goal names literal and inferential questions with an approved organizer, rather than only describing general comprehension support.", "La meta actual de lectura nombra preguntas literales e inferenciales con un organizador aprobado, en vez de describir solo apoyo general de comprension."],
    ["Implementation follow-up now tracks missed speech-language minutes and a recovery plan before the annual review.", "El seguimiento de implementacion ahora registra minutos perdidos de habla y lenguaje y un plan de recuperacion antes de la revision anual."],
    ["Extended time remains available, but the team needs to confirm the amount and trigger because the source IEP does not specify them.", "El tiempo extendido sigue disponible, pero el equipo necesita confirmar la cantidad y el momento de uso porque el IEP fuente no los especifica."],
    ["Ask how missed speech-language minutes will be recovered.", "Pregunte como se recuperaran los minutos perdidos de habla y lenguaje."],
    ["Ask how reading data will be shared before the next progress report.", "Pregunte como se compartiran los datos de lectura antes del proximo informe de progreso."]
  ].reduce((text, [source, target]) => text.replaceAll(source, target), String(value || ""));
}

function questionsForRole(role) {
  return {
    teacher: [
      "When should the organizer be offered versus student-requested?",
      "Which observations belong in the executive-function rating?",
      "What source section supports the extended-time note?"
    ],
    parent: [
      "Do the current supports match what you see at home?",
      "Which progress examples should the team explain?",
      "Are there new strengths or priorities to share first?"
    ],
    student: [
      "Which support helps you start work?",
      "What should teachers understand about difficult reading tasks?",
      "Which goal do you want to explain at the meeting?"
    ],
    administrator: [
      "Has the recovery plan been assigned and communicated?",
      "Is the extended-time note formally approved?",
      "Do pending acknowledgments reflect an implementation gap?"
    ]
  }[role];
}

function summaryCoverageTone(status = "") {
  if (/not applicable/i.test(status)) return "blue";
  if (/needs|review|missing|unclear|ambiguous|flag/i.test(status)) return "amber";
  return "green";
}

function progressExport(state) {
  const goals = activeIepItemsForState(state, "goals");
  return {
    title: "Progress report draft",
    generatedAt: new Date().toISOString(),
    student: studentName(state, state.currentStudentId),
    sourceAlignment: sourceAlignmentForState(state),
    disclaimer: "Draft progress report language requires qualified human review.",
    reportRows: progressReportRowsForGoals(goals),
    goals: goals.map((goal) => ({
      domain: goal.domain,
      goal: goal.annualGoal,
      measurementMethod: goal.measurementMethod,
      progressSchedule: goal.progressSchedule,
      status: goal.status,
      narrative: progressNarrative(goal),
      entries: goal.progressEntries
    }))
  };
}

function meetingPrepPacketExport(state, meeting = currentStudentMeetingForState(state)) {
  if (!meeting) {
    return {
      title: "Meeting prep packet",
      generatedAt: new Date().toISOString(),
      student: studentName(state, state.currentStudentId),
      reviewGuardrail: "No meeting prep record is available for the selected student.",
      sections: [
        {
          heading: "Review boundary",
          text: "No meeting prep record is available. Create or import a meeting before generating a packet."
        }
      ]
    };
  }

  const companionDocuments = meeting.companionDocuments || [];
  const familyResources = meeting.familyResources || [];
  const packetAcknowledgments = meeting.packetAcknowledgments || [];
  const eSignatureRequests = meeting.eSignatureRequests || [];
  const participants = meetingParticipants(meeting);
  const requiredParticipants = participants.filter((participant) => participant.required);
  const recordingReviews = visibleMeetingRecordingReviewsForState(state).filter((review) => review.meetingId === meeting.id);
  const transcriptSummaries = visibleMeetingTranscriptSummariesForState(state).filter((summary) => summary.meetingId === meeting.id);
  const calendarEvents = (state.calendarEvents || []).filter((event) => event.meetingId === meeting.id);
  const teacherFeedback = teacherFeedbackForMeeting(state, meeting);
  const languageAccess = meeting.languageAccess || defaultLanguageAccess();
  const glossaryItems = normalizeGlossaryItems(languageAccess.glossary);
  const sourceAlignment = sourceAlignmentForState(state);
  const readyCompanionDocuments = companionDocuments.filter((document) =>
    ["Sent", "Available", "Complete", "Not needed"].includes(document.status)
  ).length;
  const completedAcknowledgments = packetAcknowledgments.filter((acknowledgment) => acknowledgment.status !== "Sent").length;
  const signedRequests = eSignatureRequests.filter((request) => request.status === "Signed").length;
  const sourceReferences = [
    sourceAlignment?.sourceId ? `${sourceAlignment.sourceId} ${sourceAlignment.formVersion || ""}`.trim() : "",
    ...companionDocuments.map((document) => document.sourceReference),
    ...familyResources.map((resource) => resource.sourceReference),
    ...glossaryItems.map((term) => term.sourceReference),
    ...(meeting.draftDiffs || []).map((diff) => diff.sourceReference),
    ...teacherFeedback.map((item) => item.sourceReference)
  ].filter(Boolean);

  return {
    title: "Meeting prep packet",
    generatedAt: new Date().toISOString(),
    student: studentName(state, meeting.studentId),
    meetingId: meeting.id,
    meetingType: meeting.type,
    meetingDate: meeting.date,
    sourceAlignment,
    reviewGuardrail:
      "Meeting prep packet does not change the official IEP, replace required notices, or make final team decisions. Review source references and qualified staff notes before sharing.",
    sections: compactSections([
      {
        heading: "Review boundary",
        text:
          "Meeting prep packet does not change the official IEP. This packet organizes meeting preparation only, does not replace procedural notices, and does not record final team decisions.",
        bullets: [
          `Student: ${studentName(state, meeting.studentId)}`,
          `Meeting: ${meeting.type} on ${formatDate(meeting.date)} at ${meeting.time}`,
          `Source alignment: ${sourceAlignment?.sourceId || "source pending"}${sourceAlignment?.formVersion ? `, ${sourceAlignment.formVersion}` : ""}`,
          "Human review required before relying on this packet for official use."
        ]
      },
      {
        heading: "Readiness snapshot",
        bullets: [
          `Overall readiness: ${meeting.readiness}%`,
          `Required participants confirmed: ${requiredParticipants.filter((participant) => participant.status === "Confirmed").length}/${requiredParticipants.length}`,
          `Companion documents ready: ${readyCompanionDocuments}/${companionDocuments.length}`,
          `Family/student resources reviewed: ${familyResources.filter((resource) => resource.familyStatus && resource.familyStatus !== "Not reviewed").length}/${familyResources.length}`,
          `Glossary clarification questions open: ${glossaryItems.filter((term) => ["Needs explanation", "Interpreter explanation requested"].includes(term.clarityStatus) && term.staffResponseStatus !== "Explained by staff").length}`,
          `Packet acknowledgments received: ${completedAcknowledgments}/${packetAcknowledgments.length}`,
          `Scoped e-signatures completed: ${signedRequests}/${eSignatureRequests.length}`,
          `Recording readiness reviews: ${recordingReviews.length}`,
          `Transcript recaps available: ${transcriptSummaries.length}`,
          `Calendar holds created: ${calendarEvents.length}`
        ]
      },
      {
        heading: "Shared agenda",
        bullets: meeting.agenda || []
      },
      {
        heading: "Required participants",
        bullets: participants.map((participant) =>
          `${participant.role}: ${participant.name} - ${participant.status}${participant.required ? " (required)" : ""}; ${participant.mode}. ${participant.note || ""}`.trim()
        )
      },
      {
        heading: "Teacher feedback",
        bullets: teacherFeedback.length
          ? teacherFeedback.map((item) => `${item.kind}: ${item.title} - ${item.body} (${item.sourceReference || "source reference pending"})`)
          : ["No classroom observations or teacher comments are attached to this meeting yet."]
      },
      {
        heading: "Family and student questions",
        bullets: (meeting.familyQuestions || []).length
          ? meeting.familyQuestions.map((question) =>
              `${question.status}: ${question.text}${question.response ? ` Response: ${question.response}` : ""}`
            )
          : ["No family or student questions are open for this meeting."]
      },
      {
        heading: "Meeting prep notes",
        bullets: (meeting.meetingPrepNotes || []).length
          ? meeting.meetingPrepNotes.map((note) =>
              `${note.topic}: ${note.body} (${note.audience || roles[note.submittedByRole]?.label || "team"}; ${note.officialRecordImpact || "does not change the official IEP"})`
            )
          : ["No meeting prep notes have been submitted yet."]
      },
      {
        heading: "Student voice and self-advocacy",
        bullets: [
          `Student voice: ${meeting.studentVoice || "No student reflection documented."}`,
          `Preferred support to practice: ${meeting.selfAdvocacyPlan?.preferredSupport || "Not documented."}`,
          `Participation goal: ${meeting.selfAdvocacyPlan?.participationGoal || "Not documented."}`,
          `Practice script: ${meeting.selfAdvocacyPlan?.requestScript || "Not documented."}`
        ]
      },
      {
        heading: "Language access",
        bullets: [
          `Preferred language: ${languageAccess.preferredLanguage}`,
          `Translation status: ${languageAccess.translationStatus}`,
          `Interpreter status: ${languageAccess.interpreterStatus}`,
          languageAccess.coordinatorNote ? `Coordinator note: ${languageAccess.coordinatorNote}` : "",
          languageAccess.translatedSummary?.disclaimer ? `Translated summary boundary: ${languageAccess.translatedSummary.disclaimer}` : "",
          ...glossaryItems.map((term) =>
            `${term.term}: ${term.plainLanguage}; clarity ${term.clarityStatus}; response ${term.staffResponseStatus}; ${term.clarityNote ? `question ${term.clarityNote}; ` : ""}${term.staffResponse ? `staff response ${term.staffResponse}; ` : ""}${term.officialRecordImpact}`
          )
        ]
      },
      {
        heading: "Family resource guide",
        bullets: familyResources.length
          ? familyResources.map((resource) =>
              `${resource.title}: ${resource.status}; response ${resource.familyStatus || "Not reviewed"}; owner ${resource.owner}; due ${formatDate(resource.dueDate)}; source ${resource.sourceReference}. ${resource.familyNote || resource.note || ""} ${resource.officialRecordImpact || ""}`.trim()
            )
          : ["No family or student resource-guide items are attached to this meeting yet."]
      },
      {
        heading: "Companion documents and packet receipts",
        bullets: [
          ...companionDocuments.map((document) =>
            `${document.title}: ${document.status}; owner ${document.owner}; due ${formatDate(document.dueDate)}; source ${document.sourceReference}. ${document.note || ""}`.trim()
          ),
          ...packetAcknowledgments.map((acknowledgment) =>
            `${acknowledgment.label}: ${acknowledgment.status}; ${acknowledgment.participantName}; ${acknowledgment.responseNote}`
          ),
          ...eSignatureRequests.map((request) =>
            `${request.packetTitle}: ${request.status}; scope ${request.signatureScope}; ${request.notConsentNote}`
          )
        ]
      },
      {
        heading: "Draft-to-final changes",
        bullets: (meeting.draftDiffs || []).length
          ? meeting.draftDiffs.map((diff) =>
              `${diff.section}: ${diff.status}; draft "${diff.draftText}"; final "${diff.finalText || "awaiting team decision"}"; rationale ${diff.decisionRationale || "pending"}`
            )
          : ["No proposed draft-to-final changes are listed for this meeting."]
      },
      {
        heading: "Calendar holds, recording readiness, and transcript recaps",
        bullets: [
          ...calendarEvents.map((event) =>
            `${event.title}: ${formatDate(event.startDate)} at ${event.startTime}; ${event.status}; UID ${event.calendarUid}`
          ),
          ...recordingReviews.map((review) =>
            `${review.status}: ${review.recordingSource}; consent ${review.participantConsentSummary}; retention ${review.retentionBoundary}; ${review.officialRecordImpact}`
          ),
          ...transcriptSummaries.map((summary) =>
            `${summary.status}: ${summary.summary}; decisions ${(summary.decisions || []).join("; ") || "none"}; follow-ups ${(summary.followUps || []).join("; ") || "none"}`
          )
        ]
      },
      {
        heading: "Source references",
        bullets: sourceReferences.length ? Array.from(new Set(sourceReferences)) : ["Source references pending."]
      }
    ])
  };
}

function compactSections(sections = []) {
  return sections.map((section) => ({
    ...section,
    bullets: (section.bullets || []).map((bullet) => String(bullet || "").trim()).filter(Boolean)
  }));
}

function progressReportRowsForGoals(goals = []) {
  return goals.map((goal) => {
    const entries = goal.progressEntries || [];
    const first = entries[0] || null;
    const latest = entries[entries.length - 1] || null;
    const schedule = goal.progressSchedule || {};
    const status = progressReportStatus(goal, entries, schedule);
    const latestEvidence = latest?.evidenceLabel || latest?.evidenceType || latest?.evidenceDocumentId;
    return {
      goalId: goal.id,
      heading: `${goal.domain} progress report draft`,
      status,
      annualGoal: goal.annualGoal,
      baseline: goal.baseline,
      measurementMethod: goal.measurementMethod,
      criteriaForMastery: goal.criteriaForMastery,
      latestData: latest
        ? `Latest data: ${latest.value} on ${formatDate(latest.date)}; first confirmed point in this report window was ${first?.value ?? latest.value}.`
        : "Latest data: no confirmed data points have been entered for this goal.",
      scheduleStatus: `Measurement schedule: ${schedule.frequency || goal.frequency}; last collected ${schedule.lastCollectedDate ? formatDate(schedule.lastCollectedDate) : "not yet"}${schedule.nextDueDate ? `; next due ${formatDate(schedule.nextDueDate)}` : ""}; ${schedule.status || "schedule not set"}.`,
      evidenceSummary: latestEvidence
        ? `Evidence: ${latestEvidence}${latest?.enteredBy ? `, entered by ${latest.enteredBy}` : ""}.`
        : "Evidence: no source artifact or evidence label attached yet.",
      sourceReference: goal.sourceReference,
      narrative: progressNarrative(goal),
      reviewBoundary:
        "Draft progress report language only; requires qualified human review before sharing and does not change official IEP goal language."
    };
  });
}

function progressReportStatus(goal, entries = [], schedule = {}) {
  if (entries.length < 2) return "Insufficient data";
  if (schedule.status === "Overdue") return "Needs review";
  const latest = entries[entries.length - 1];
  const target = targetForGoal(goal);
  if (Number(latest?.value) >= target) return "On track";
  return goal.status || "Monitor closely";
}

function progressReportTone(status = "") {
  if (["On track", "Goal mastered"].includes(status)) return "green";
  if (status === "Needs review" || status === "Insufficient data") return "red";
  if (status === "Monitor closely" || status === "Not on track") return "amber";
  return "blue";
}

function structuredIepExport(state) {
  return state.ieps.map((iep) => ({
    ...iep,
    structuredRecord: normalizeStructuredIepRecord(state, iep)
  }));
}

function districtSystemExport(state) {
  const student = state.students.find((item) => item.id === state.currentStudentId) || null;
  const activeIep = activeIepForState(state);
  const structuredRecord = activeIep ? normalizeStructuredIepRecord(state, activeIep) : {};
  const sectionCoverage = schemaSections.map((section) => ({
    section,
    present: hasStructuredCoverage(structuredRecord[section]),
    sourceReference: structuredRecord[section]?.sourceReference || activeIep?.sourceAlignment?.sourceId || "source pending"
  }));
  const sourceAlignment = activeIep?.sourceAlignment || sourceAlignmentForState(state);
  return {
    packageType: "DistrictSystemImportPackage",
    packageVersion: "IEP-IW-district-json-0.1",
    studentId: state.currentStudentId,
    iepId: activeIep?.id || null,
    generatedAt: new Date().toISOString(),
    generatedBy: {
      name: state.user.name,
      role: state.user.role
    },
    district: {
      name: state.districtConfiguration?.districtName || "Riverbend School District",
      tenancyMode: state.districtConfiguration?.tenancyMode || "Single-district demo tenant"
    },
    importProfile: {
      target: "District IEP system compatible JSON interchange",
      mode: "Review-ready local package",
      officialSubmission: false,
      guardrail:
        "This package supports district-system import review only; it is not an automated official IEP submission and must be validated by district staff."
    },
    student: student
      ? {
          id: student.id,
          name: `${student.firstName} ${student.lastName}`.trim(),
          grade: student.grade,
          school: student.school,
          nextAnnualReview: student.annualReviewDate,
          nextEvaluation: student.reevaluationDate
        }
      : null,
    sourceAlignment,
    sourceRegistry: {
      activeSourceId: state.sourceRegistry?.activeSourceId || sourceAlignment?.sourceId,
      sourceRegistryVersion: state.sourceRegistry?.sourceRegistryVersion || sourceAlignment?.sourceRegistryVersion,
      languagesAvailable: sourceAlignment?.languagesAvailable || [],
      languageAvailabilityNote: sourceAlignment?.languageAvailabilityNote || ""
    },
    validation: {
      status: sectionCoverage.every((item) => item.present) ? "Ready for district import review" : "Needs district review",
      requiredSections: sectionCoverage.length,
      presentSections: sectionCoverage.filter((item) => item.present).length,
      missingSections: sectionCoverage.filter((item) => !item.present).map((item) => item.section),
      sectionCoverage
    },
    structuredRecord,
    obligations: {
      goals: activeIepItemsForState(state, "goals"),
      services: activeIepItemsForState(state, "services"),
      accommodations: activeIepItemsForState(state, "accommodations"),
      implementationTasks: currentStudentTasksForState(state).map((task) => ({
        id: task.id,
        title: task.title,
        responsibleRole: task.responsibleRole,
        frequency: task.frequency,
        status: task.status,
        sourceSection: task.sourceSection
      }))
    },
    auditContext: {
      sourceDocuments: (state.documents || [])
        .filter((document) => document.studentId === state.currentStudentId)
        .map((document) => ({
          id: document.id,
          name: document.name,
          sha256: document.originalFile?.sha256 || null,
          sourceId: document.sourceAlignment?.sourceId || null,
          ocrStatus: document.ocrReview?.status || defaultOcrReview(document).status,
          ocrDigest: document.ocrReview?.ocrDigest || null
        })),
      latestAuditTitles: (state.auditLog || []).slice(0, 5).map((event) => event.title)
    }
  };
}

function normalizeApprovedIep(state, iep, sourceAlignment) {
  const approvedIep = {
    ...iep,
    extractionApproved: true,
    status: "Active",
    sourceAlignment,
    structuredRecord: {
      ...(iep.structuredRecord || {}),
      sourceAlignment
    }
  };
  const normalizedRecord = normalizeStructuredIepRecord(state, approvedIep);
  const structuredRecord = mergeExtractionSectionsIntoStructuredRecord(state, normalizedRecord, sourceAlignment);
  return {
    ...approvedIep,
    structuredRecord: normalizeStructuredIepRecord(state, { ...approvedIep, structuredRecord })
  };
}

function structuredSectionCoverage(state) {
  const activeIep = activeIepForState(state);
  const record = activeIep ? normalizeStructuredIepRecord(state, activeIep) : {};
  const reviewFlags = currentStudentReviewFlagsForState(state);
  return schemaSections.map((section) => {
    const value = record[section];
    const relatedOpenFlags = reviewFlags.filter(
      (flag) => flag.status === "Open" && normalizedLabel(flag.section) === normalizedLabel(section)
    );
    const hasContent = hasStructuredCoverage(value);
    const isPartial = hasContent && relatedOpenFlags.length > 0;
    return {
      section,
      status: !hasContent ? "Not documented" : isPartial ? "Needs review" : "Complete",
      percent: !hasContent ? 12 : isPartial ? 68 : 100,
      tone: !hasContent ? "red" : isPartial ? "amber" : "green",
      note: !hasContent
        ? "No structured content found in the reviewed record."
        : isPartial
          ? `${relatedOpenFlags.length} advisory finding${relatedOpenFlags.length === 1 ? "" : "s"} open.`
          : "Structured content present with no open section finding."
    };
  });
}

function mergeGeneratedReviewFlags(existingFlags = [], generatedFlags = []) {
  const generatedRules = new Set(generatedFlags.map((flag) => flag.generatedRule).filter(Boolean));
  return [
    ...generatedFlags,
    ...existingFlags.filter((flag) => !flag.generatedRule || !generatedRules.has(flag.generatedRule))
  ];
}

function hasStructuredCoverage(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.values(value).some(hasStructuredCoverage);
  return value !== undefined && value !== null && value !== "";
}

function normalizedLabel(value) {
  return String(value || "").toLowerCase().replace(/[^a-z]/g, "");
}

function structuredDetailRows(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value)
    .flatMap(([key, detail]) => {
      if (detail === undefined || detail === null || detail === "") return [];
      if (Array.isArray(detail)) {
        if (!detail.length) return [];
        return [{ label: readableKey(key), value: detail.join(", ") }];
      }
      if (typeof detail === "object") {
        const nested = structuredDetailRows(detail);
        return nested.map((row) => ({ label: `${readableKey(key)}: ${row.label}`, value: row.value }));
      }
      return [{ label: readableKey(key), value: String(detail) }];
    });
}

function readableKey(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function meetingParticipants(meeting = {}) {
  if (Array.isArray(meeting.requiredParticipants) && meeting.requiredParticipants.length) {
    return meeting.requiredParticipants;
  }
  return (meeting.participants || []).map((participant, index) => ({
    id: `participant-${index + 1}`,
    role: participant,
    name: participant,
    required: index !== 1,
    status: "Invited",
    mode: "In person",
    note: "Participant imported from meeting list.",
    confirmedBy: "",
    confirmedAt: ""
  }));
}

function teacherFeedbackForMeeting(state, meeting = {}) {
  const observations = currentStudentTasksForState(state).flatMap((task) =>
    (task.observations || []).map((observation) => ({
      id: `${task.id}-${observation.id}`,
      kind: "Observation",
      tone: "green",
      title: task.title,
      body: `${observation.context}: ${observation.note}`,
      enteredBy: observation.enteredBy || task.assignedTo || "Teacher",
      observedAt: observation.observedAt,
      sourceReference: `${task.sourceSection || "Implementation task"} · ${observation.supportUsed || "Classroom feedback"}`
    }))
  );
  const comments = (state.teamComments || [])
    .filter((comment) => comment.studentId === meeting.studentId && comment.postedByRole === "generalEducation")
    .map((comment) => ({
      id: comment.id,
      kind: "Comment",
      tone: "blue",
      title: comment.targetTitle || comment.targetType,
      body: comment.body,
      enteredBy: comment.postedBy,
      postedAt: comment.postedAt,
      sourceReference: comment.sourceReference || "Teacher collaboration comment"
    }));
  return [...observations, ...comments].sort((a, b) =>
    new Date(b.enteredAt || b.observedAt || b.postedAt || 0) - new Date(a.enteredAt || a.observedAt || a.postedAt || 0)
  );
}

function participantTone(participant) {
  if (participant.status === "Confirmed") return "green";
  if (participant.status === "Needs alternate") return "red";
  return participant.required ? "amber" : "blue";
}

function meetingPrepNoteTone(role = "") {
  if (role === "parent") return "purple";
  if (role === "student") return "blue";
  if (role === "generalEducation") return "green";
  return "amber";
}

function companionDocumentTone(status = "") {
  if (["Sent", "Available", "Complete", "Not needed"].includes(status)) return "green";
  if (status === "In progress") return "blue";
  if (status === "Review if change proposed") return "purple";
  return "amber";
}

function familyResourceTone(status = "") {
  if (["Available", "Sent", "Reviewed with family", "Not needed"].includes(status)) return "green";
  if (status === "Needed") return "amber";
  return "blue";
}

function familyResourceResponseTone(status = "") {
  if (status === "Reviewed") return "green";
  if (status === "Needs explanation" || status === "Request copy" || status === "Interpreter support needed") return "amber";
  return "blue";
}

function glossaryClarityTone(status = "") {
  if (status === "Clear") return "green";
  if (status === "Needs explanation" || status === "Interpreter explanation requested") return "amber";
  return "blue";
}

function glossaryResponseTone(status = "") {
  if (status === "Explained by staff") return "green";
  if (status === "Needs team follow-up") return "amber";
  if (status === "Explanation planned") return "purple";
  return "blue";
}

function sourceRegistryReviewTone(status = "") {
  if (status === "Current") return "green";
  if (status === "Update needed") return "amber";
  if (status === "Superseded") return "red";
  if (status === "Future expansion") return "blue";
  return "purple";
}

function packetAcknowledgmentTone(status = "") {
  if (status === "Reviewed") return "green";
  if (status === "Needs clarification" || status === "Needs more time") return "amber";
  if (status === "Cannot attend") return "red";
  return "blue";
}

function meetingTranscriptTone(status = "") {
  if (status === "Family-ready recap" || status === "Reviewed for packet") return "green";
  if (status === "Needs team clarification") return "amber";
  return "blue";
}

function meetingRecordingTone(status = "") {
  if (status === "Source readiness reviewed" || status === "Transcript source only") return "green";
  if (status === "Recording not permitted") return "red";
  if (/pending|review/i.test(status)) return "amber";
  return "blue";
}

function ocrReviewTone(status = "") {
  if (status === "Embedded text accepted" || status === "OCR text reviewed") return "green";
  if (status === "Source quality blocked") return "red";
  return "amber";
}

function signatureRequestTone(status = "") {
  if (status === "Signed") return "green";
  if (status === "Requested") return "amber";
  return "blue";
}

function calendarEventTone(status = "") {
  if (/created|sent|synced/i.test(status)) return "green";
  if (/needs|failed/i.test(status)) return "red";
  return "blue";
}

function packetAcknowledgmentMatchesRole(role, acknowledgment = {}) {
  if (role === "parent") return acknowledgment.audienceRole === "parent";
  if (role === "student") return acknowledgment.audienceRole === "student";
  return false;
}

function familyResourceMatchesRole(role, resource = {}) {
  if (role === "parent") return resource.audienceRole === "parent";
  if (role === "student") return resource.audienceRole === "student";
  return false;
}

function signatureRequestMatchesRole(role, signatureRequest = {}) {
  return role === "parent" && signatureRequest.requestedForRole === "parent";
}

function teacherChecklistExport(state) {
  const activeIep = state.ieps.find((iep) => iep.studentId === state.currentStudentId);
  const matchesActiveIep = (item) => !activeIep?.id || item.iepId === activeIep.id || item.studentId === state.currentStudentId;
  const tasks = state.tasks.filter((task) => task.studentId === state.currentStudentId);
  const tasksByRole = tasks.reduce((groups, task) => {
    const role = task.responsibleRole || "Unassigned";
    groups[role] = groups[role] || [];
    groups[role].push({
      title: task.title,
      responsibility: task.description,
      frequency: task.frequency,
      dueDate: task.dueDate,
      status: task.status,
      assignedTo: task.assignedTo,
      sourceSection: task.sourceSection,
      evidenceRequired: task.evidenceRequired,
      latestAcknowledgment: task.acknowledgments?.[0]
        ? {
            acknowledgedBy: task.acknowledgments[0].acknowledgedBy,
            acknowledgedAt: task.acknowledgments[0].acknowledgedAt,
            note: task.acknowledgments[0].note
          }
        : null,
      latestObservation: task.observations?.[0]
        ? {
            observedAt: task.observations[0].observedAt,
            context: task.observations[0].context,
            note: task.observations[0].note,
            supportUsed: task.observations[0].supportUsed,
            enteredBy: task.observations[0].enteredBy
          }
        : null,
      completionEvidence: task.completionEvidence
        ? {
            completedBy: task.completionEvidence.completedBy,
            completedAt: task.completionEvidence.completedAt,
            evidenceLabel: task.completionEvidence.evidenceLabel,
            note: task.completionEvidence.note
          }
        : null
    });
    return groups;
  }, {});

  return {
    title: "Teacher checklist",
    generatedAt: new Date().toISOString(),
    student: studentName(state, state.currentStudentId),
    sourceAlignment: sourceAlignmentForState(state),
    reviewGuardrail: "This checklist translates confirmed IEP obligations into daily implementation language. The official IEP remains the controlling document, and staff should review source references before formal use.",
    classroomSupportsAndAccommodations: state.accommodations.filter(matchesActiveIep).map((accommodation) => ({
      support: accommodation.description,
      setting: accommodation.setting,
      frequency: accommodation.frequency,
      startDate: accommodation.startDate,
      endDate: accommodation.endDate,
      responsibleRole: accommodation.responsibleRole,
      evidenceRequired: accommodation.evidenceRequired,
      sourceReference: accommodation.sourceReference,
      clarificationNeeded: accommodation.ambiguity || ""
    })),
    relatedServicesSeparateFromClassroomSupports: state.services.filter(matchesActiveIep).map((service) => ({
      service: service.serviceType,
      frequency: service.frequency,
      durationMinutes: service.duration,
      location: service.location,
      providerRole: service.providerRole,
      provider: service.provider,
      startDate: service.startDate,
      endDate: service.endDate,
      evidenceRequired: service.evidenceRequired,
      loggingRequirement: service.loggingRequirement,
      sourceReference: service.sourceReference,
      documentationStatus: `${service.deliveredMinutes}/${service.scheduledMinutes} minutes documented`,
      recoveryStatus: service.recoveryStatus
    })),
    responsibilitiesGroupedByRole: Object.entries(tasksByRole)
      .sort(([roleA], [roleB]) => roleA.localeCompare(roleB))
      .map(([role, responsibilities]) => ({ role, responsibilities }))
  };
}

function progressNarrative(goal) {
  if (!goal) return "No approved goal data is available to draft a progress statement for this student.";
  const entries = goal.progressEntries || [];
  const first = entries[0];
  const latest = entries[entries.length - 1];
  if (!first || !latest) return "Insufficient confirmed data is available to draft a progress statement.";
  return `${goal.domain}: progress changed from ${first.value} to ${latest.value} using ${goal.measurementMethod}. The criterion is ${goal.criteriaForMastery}; this draft requires human review before sharing.`;
}

function nextProgressSchedule(goal, collectedDate) {
  const previous = goal.progressSchedule || {};
  const nextDueDate = nextDueDateForFrequency(collectedDate, previous.frequency || goal.frequency);
  return {
    ...previous,
    lastCollectedDate: collectedDate,
    nextDueDate,
    status: progressScheduleStatus(nextDueDate)
  };
}

function nextDueDateForFrequency(date, frequency = "") {
  const base = toDisplayDate(date);
  if (String(frequency).toLowerCase().includes("month")) {
    base.setMonth(base.getMonth() + 1);
  } else {
    base.setDate(base.getDate() + 7);
  }
  return isoDate(base);
}

function progressScheduleStatus(nextDueDate, today = "2026-06-23") {
  const due = toDisplayDate(nextDueDate);
  const reference = toDisplayDate(today);
  const diffDays = Math.round((due - reference) / 86400000);
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays <= 7) return "Due soon";
  return "Scheduled";
}

function sourceAlignmentForState(state) {
  const registry = state.sourceRegistry || {};
  const activeEntry = (registry.entries || []).find((entry) => entry.sourceId === registry.activeSourceId) || registry.entries?.[0];
  return {
    jurisdiction: registry.jurisdiction || activeEntry?.jurisdiction || "Pennsylvania",
    programArea: registry.programArea || activeEntry?.programArea || "School Age",
    sourceForm: activeEntry?.title || registry.sourceForm || "Individualized Education Program",
    sourceFormType: activeEntry?.sourceFormType || registry.sourceFormType || "Non-Annotated",
    sourceId: activeEntry?.sourceId || registry.activeSourceId || registry.sourceId || "pa-school-age-iep-non-annotated",
    effectiveDate: activeEntry?.effectiveDate || registry.effectiveDate || "2026-06-22",
    languagesAvailable: activeEntry?.languagesAvailable || ["English"],
    languageAvailabilityNote: activeEntry?.languageAvailabilityNote || "",
    sourceRegistryVersion: registry.sourceRegistryVersion || "PA-demo-2026.06"
  };
}

function activeSourceEntryForState(state) {
  const registry = state.sourceRegistry || {};
  return (registry.entries || []).find((entry) => entry.sourceId === registry.activeSourceId) || registry.entries?.[0] || null;
}

function sourceGuidanceForState(state) {
  const registry = state.sourceRegistry || {};
  const entriesById = new Map((registry.entries || []).map((entry) => [entry.sourceId, entry]));
  return (registry.fieldGuidance || []).map((item) => {
    const sourceEntry = entriesById.get(item.sourceId);
    return {
      ...item,
      sourceTitle: sourceEntry?.title || item.sourceId || "Tracked source guidance",
      reviewStatus: sourceEntry?.reviewStatus || registry.reviewStatus || "Not reviewed",
      validationPrompts: item.validationPrompts || []
    };
  });
}

function sourceGuidanceForSection(guidance = [], section = null) {
  if (!section) return null;
  const sectionText = `${section.key || ""} ${section.sourceSection || ""} ${section.title || ""}`.toLowerCase();
  return guidance.find((item) =>
    (item.structuredFields || []).some((field) => {
      const fieldText = String(field || "").toLowerCase();
      const fieldRoot = fieldText.split(/[.\[\s]/)[0];
      return Boolean(fieldText && (sectionText.includes(fieldText) || (fieldRoot && sectionText.includes(fieldRoot))));
    })
  ) || null;
}

function accessibilityChecksForState(state) {
  const meeting = currentStudentMeetingForState(state) || {};
  const languageAccess = meeting.languageAccess || defaultLanguageAccess();
  const openFlags = currentStudentReviewFlagsForState(state).filter((flag) => flag.status === "Open").length;
  const roleLabel = roles[state.user.role]?.label || "Current role";
  return [
    {
      icon: ListChecks,
      title: "Keyboard navigation",
      text: "Skip link targets the workspace main region, focus-visible styling is enabled, and tab groups expose role labels."
    },
    {
      icon: HelpCircle,
      title: "Screen reader labels",
      text: "Primary buttons, form controls, tabs, charts, and the main workspace region expose accessible names or labels."
    },
    {
      icon: Bell,
      title: "Live status updates",
      text: "Save, export, role-switch, and blocked-action feedback is announced through a polite status region."
    },
    {
      icon: MessageSquare,
      title: "Language access",
      text: `${languageAccess.preferredLanguage || "English"} support: translation ${languageAccess.translationStatus || "not requested"}, interpreter ${languageAccess.interpreterStatus || "not needed"}. Draft translations remain human-reviewed.`
    },
    {
      icon: ShieldCheck,
      title: "Human accessibility review",
      text: `${roleLabel} sees role-appropriate access notices, ${openFlags} open advisory review item${openFlags === 1 ? "" : "s"}, and unresolved accessibility checks should stay in the audit packet.`,
      warn: openFlags > 0
    }
  ];
}

function defaultNotificationMessage(reminder) {
  if (!reminder) return "Please review this IEP implementation reminder before the next meeting.";
  return `Please review: ${reminder.title}. ${reminder.description}`;
}

function remindersForState(state, today = "2026-06-24") {
  const reviewedIds = new Set(
    (state.reminderReviews || [])
      .filter((review) => review.reviewedByUserId === state.user.id)
      .map((review) => review.reminderId)
  );
  const iepsById = new Map((state.ieps || []).map((iep) => [iep.id, iep]));
  const reminder = (item) => ({
    ...item,
    reviewed: reviewedIds.has(item.id),
    sort: reminderSortValue(item.tone, item.dueDate)
  });
  const taskReminders = (state.tasks || [])
    .filter((task) => task.status !== "Completed")
    .map((task) =>
      reminder({
        id: `reminder-task-${task.id}`,
        source: "Implementation checklist",
        title: task.title,
        description: task.description,
        meta: `${task.responsibleRole} · due ${task.dueDate}`,
        status: dateStatus(task.dueDate, today),
        tone: reminderToneForDate(task.dueDate, today),
        dueDate: task.dueDate,
        studentId: task.studentId,
        icon: ListChecks,
        targetView: "implementation"
      })
    );
  const progressReminders = (state.goals || [])
    .filter((goal) => /overdue|due|insufficient/i.test(`${goal.progressSchedule?.status || ""} ${goal.status || ""}`))
    .map((goal) => {
      const studentId = iepsById.get(goal.iepId)?.studentId || state.currentStudentId;
      const status = progressScheduleStatus(goal.progressSchedule?.nextDueDate, today);
      return reminder({
        id: `reminder-progress-${goal.id}`,
        source: "Progress monitoring",
        title: `${goal.domain} progress data ${status.toLowerCase()}`,
        description: `${goal.measurementMethod} is assigned to ${(goal.responsibleStaff || []).join(", ") || goal.progressSchedule?.responsibleRole}.`,
        meta: `Next due ${formatDate(goal.progressSchedule?.nextDueDate)} · ${goal.progressSchedule?.evidenceType || "evidence required"}`,
        status,
        tone: scheduleTone(status),
        dueDate: goal.progressSchedule?.nextDueDate,
        studentId,
        icon: BarChart3,
        targetView: "progress"
      });
    });
  const serviceReminders = (state.services || [])
    .filter((service) => Number(service.deliveredMinutes || 0) < Number(service.scheduledMinutes || 0))
    .map((service) => {
      const missing = Number(service.scheduledMinutes || 0) - Number(service.deliveredMinutes || 0);
      return reminder({
        id: `reminder-service-${service.id}`,
        source: "Service delivery",
        title: `${service.serviceType} service log gap`,
        description: `${missing} minutes need documentation or recovery planning with ${service.provider || service.providerRole}.`,
        meta: `${service.deliveredMinutes}/${service.scheduledMinutes} minutes documented`,
        status: "Action needed",
        tone: "red",
        dueDate: today,
        studentId: iepsById.get(service.iepId)?.studentId || state.currentStudentId,
        icon: ClipboardCheck,
        targetView: "services"
      });
    });
  const meetingReminders = (state.meetings || [])
    .filter((meeting) => isDateWithinNextDays(meeting.date, today, 14) || Number(meeting.readiness || 0) < 85)
    .map((meeting) =>
      reminder({
        id: `reminder-meeting-${meeting.id}`,
        source: "Meeting preparation",
        title: `${meeting.type} meeting readiness`,
        description: `${studentName(state, meeting.studentId)} meeting is ${meeting.readiness}% ready.`,
        meta: `${formatDate(meeting.date)} · ${(meeting.familyQuestions || []).filter((question) => question.status !== "Answered").length} open question(s)`,
        status: Number(meeting.readiness || 0) < 80 ? "Prep needed" : "Upcoming",
        tone: Number(meeting.readiness || 0) < 80 ? "amber" : "purple",
        dueDate: meeting.date,
        studentId: meeting.studentId,
        icon: CalendarDays,
        targetView: "meetings"
      })
    );
  const reviewReminders = (state.reviewFlags || [])
    .filter((flag) => flag.status === "Open")
    .map((flag) =>
      reminder({
        id: `reminder-review-${flag.id}`,
        source: "Quality review",
        title: flag.issue,
        description: flag.whyItMatters,
        meta: `${flag.severity} priority · ${flag.sourceReference}`,
        status: "Human review",
        tone: flag.severity === "High" ? "red" : "amber",
        dueDate: today,
        studentId: flag.studentId,
        icon: AlertTriangle,
        targetView: "review"
      })
    );
  const draftReminders =
    state.draft && state.draft.status !== "Approved for export"
      ? [
          reminder({
            id: `reminder-draft-${state.draft.id}`,
            source: "Drafting",
            title: "Draft package requires human approval",
            description: "Generated or revised draft sections cannot be exported until qualified review is complete.",
            meta: state.draft.status,
            status: "Approval needed",
            tone: "purple",
            dueDate: today,
            studentId: state.currentStudentId,
            icon: Sparkles,
            targetView: "drafting"
          })
        ]
      : [];
  return [
    ...taskReminders,
    ...progressReminders,
    ...serviceReminders,
    ...meetingReminders,
    ...reviewReminders,
    ...draftReminders
  ].sort((a, b) => Number(a.reviewed) - Number(b.reviewed) || a.sort - b.sort || a.title.localeCompare(b.title));
}

function iepReviewQueueForState(state) {
  const iepsByDocumentId = new Map((state.ieps || []).filter((iep) => iep.documentId).map((iep) => [iep.documentId, iep]));
  const sectionsByDocumentId = (state.extractionSections || []).reduce((groups, section) => {
    if (!section.documentId) return groups;
    const current = groups[section.documentId] || { count: 0, needsReview: false };
    groups[section.documentId] = {
      count: current.count + 1,
      needsReview: current.needsReview || !["Confirmed", "Approved"].includes(section.status)
    };
    return groups;
  }, {});

  return (state.documents || [])
    .map((document) => {
      const iep = iepsByDocumentId.get(document.id);
      const sourceAlignment = iep?.sourceAlignment || document.sourceAlignment || sourceAlignmentForState(state);
      const sectionInfo = sectionsByDocumentId[document.id] || { count: 0, needsReview: false };
      const sectionCount = sectionInfo.count || (iep?.structuredRecord ? schemaSections.length : 0);
      const requiresReview = Boolean(sectionInfo.needsReview || (!iep?.extractionApproved && sectionCount > 0));
      const approved = Boolean(iep?.extractionApproved && !requiresReview);
      const statusLabel = requiresReview
        ? "Human review needed"
        : approved
          ? "Extraction approved"
          : document.preserved
            ? "Source preserved"
            : "Extraction pending";
      return {
        documentId: document.id,
        documentName: document.name,
        studentId: document.studentId,
        studentName: studentName(state, document.studentId),
        uploadedAt: document.uploadedAt,
        approved,
        requiresReview,
        statusLabel,
        tone: requiresReview ? "amber" : approved ? "green" : "blue",
        sectionCount,
        sourceId: sourceAlignment.sourceId || "No source id recorded",
        sourceFormType: sourceAlignment.sourceFormType || "Source form type pending"
      };
    })
    .sort((a, b) =>
      Number(b.requiresReview) - Number(a.requiresReview) ||
      Number(b.approved) - Number(a.approved) ||
      new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)
    );
}

function parentSummaryActivityForState(state) {
  const handouts = (state.summaryHandouts || [])
    .filter((handout) => handout.audience === "parent")
    .map((handout) => ({
      ...handout,
      studentName: studentName(state, handout.studentId)
    }))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const currentStudentName = studentName(state, state.currentStudentId);
  const currentSummary = state.summaries?.parent || null;
  const currentSummaryReady = Boolean(currentStudentHasApprovedRecord(state) && currentSummary?.sections?.length);
  return {
    handouts,
    currentSummaryReady,
    currentSummaryTitle: currentSummary?.title || "Family summary",
    currentStudentName,
    sourceId: currentSummary?.sourceAlignment?.sourceId || activeIepForState(state)?.sourceAlignment?.sourceId || "No source id recorded"
  };
}

function reminderSortValue(tone, dueDate) {
  const severity = { red: 0, amber: 1, purple: 2, blue: 3, green: 4 }[tone] ?? 5;
  const due = Number.isFinite(Date.parse(toDisplayDate(dueDate))) ? toDisplayDate(dueDate).getTime() : 9999999999999;
  return severity * 10000000000000 + due;
}

function reminderToneForDate(value, today) {
  const status = dateStatus(value, today).toLowerCase();
  if (status.includes("overdue")) return "red";
  if (status.includes("due")) return "amber";
  return "blue";
}

function dateStatus(value, today) {
  if (!value || /ongoing/i.test(value)) return "Ongoing";
  const days = daysBetween(today, value);
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days <= 7) return "Due soon";
  return "Scheduled";
}

function adminDashboardForState(state, today = "2026-06-24") {
  const studentsById = new Map(state.students.map((student) => [student.id, student]));
  const iepsById = new Map(state.ieps.map((iep) => [iep.id, iep]));
  const studentIdForIep = (iepId) => iepsById.get(iepId)?.studentId || null;
  const studentForService = (service) => studentsById.get(studentIdForIep(service.iepId));
  const dueSoon = state.students.filter((student) => isDateWithinNextDays(student.annualReviewDate, today, 30));
  const overdueProgress = state.goals.filter((goal) => isProgressScheduleOverdue(goal.progressSchedule, today));
  const missingServiceLogs = state.services.filter(
    (service) => Number(service.deliveredMinutes || 0) < Number(service.scheduledMinutes || 0)
  );
  const draftsPending = [
    ...state.students.filter((student) => /draft/i.test(student.status || "")),
    ...(state.draft && state.draft.status !== "Approved for export" ? [{ id: state.draft.id, label: "Generated draft package" }] : [])
  ];
  const openFlags = state.reviewFlags.filter((flag) => flag.status === "Open");
  const continuityRows = (state.staffContinuity || []).map((record) => {
    const affectedStudents = (record.affectedStudentIds || [])
      .map((studentId) => studentsById.get(studentId))
      .filter(Boolean)
      .map((student) => `${student.firstName} ${student.lastName}`)
      .join(", ");
    return {
      ...record,
      affectedStudents: affectedStudents || "No affected students listed",
      affectedServices: record.affectedServices || [],
      vacancyDays: record.vacancyStartDate ? Math.max(daysBetween(record.vacancyStartDate, today), 0) : 0,
      tone: continuityToneForRecord(record)
    };
  });
  const highContinuityRisks = continuityRows.filter((record) =>
    record.riskLevel === "High" || /coverage needed|vacant|unassigned|escalated/i.test(`${record.status} ${record.providerName}`)
  );

  const caseloadRows = state.students.map((student) => {
    const studentIepIds = new Set(state.ieps.filter((iep) => iep.studentId === student.id).map((iep) => iep.id));
    const progressDue = state.goals.filter(
      (goal) => studentIepIds.has(goal.iepId) && isProgressScheduleOverdue(goal.progressSchedule, today)
    ).length;
    const serviceGaps = state.services.filter(
      (service) =>
        studentIepIds.has(service.iepId) &&
        Number(service.deliveredMinutes || 0) < Number(service.scheduledMinutes || 0)
    ).length;
    const openFlagCount = openFlags.filter((flag) => flag.studentId === student.id).length;
    return { student, progressDue, serviceGaps, openFlags: openFlagCount };
  });

  const schoolRows = state.students.map((student) => {
    const row = caseloadRows.find((candidate) => candidate.student.id === student.id);
    const dueSoonStudent = dueSoon.some((candidate) => candidate.id === student.id);
    const existing = {
      school: student.school,
      openFlags: 0,
      progressDue: 0,
      serviceGaps: 0,
      dueSoon: 0,
      students: 0
    };
    return { row, dueSoonStudent, existing };
  }).reduce((rows, { row, dueSoonStudent, existing }) => {
    const current = rows.get(row.student.school) || existing;
    current.openFlags += row.openFlags;
    current.progressDue += row.progressDue;
    current.serviceGaps += row.serviceGaps;
    current.dueSoon += dueSoonStudent ? 1 : 0;
    current.students += 1;
    rows.set(row.student.school, current);
    return rows;
  }, new Map());

  const schoolRollup = Array.from(schoolRows.values()).map((row) => {
    const riskPercent = Math.min(100, row.openFlags * 35 + row.progressDue * 20 + row.serviceGaps * 25 + row.dueSoon * 15);
    return {
      ...row,
      riskPercent,
      tone: riskPercent >= 70 ? "red" : riskPercent >= 35 ? "amber" : riskPercent > 0 ? "blue" : "green"
    };
  });

  const workQueue = [
    ...dueSoon.map((student) => ({
      type: "iep-due",
      tone: "amber",
      icon: CalendarDays,
      title: `${student.firstName} ${student.lastName} annual review due`,
      description: `${student.school} review date is ${formatDate(student.annualReviewDate)}.`,
      meta: "IEP due soon"
    })),
    ...overdueProgress.map((goal) => ({
      type: "progress-overdue",
      tone: "red",
      icon: BarChart3,
      title: `${goal.domain} progress report overdue`,
      description: `${goal.progressSchedule?.responsibleRole || "Assigned staff"} has data due from ${formatDate(goal.progressSchedule?.nextDueDate)}.`,
      meta: "Progress"
    })),
    ...missingServiceLogs.map((service) => ({
      type: "service-gap",
      tone: "red",
      icon: ClipboardCheck,
      title: `${service.serviceType} log gap`,
      description: `${studentForService(service)?.school || "Assigned school"} has ${Number(service.scheduledMinutes || 0) - Number(service.deliveredMinutes || 0)} minutes not documented.`,
      meta: "Service log"
    })),
    ...highContinuityRisks.map((record) => ({
      type: "continuity-risk",
      tone: record.tone,
      icon: Users,
      title: `${record.role} continuity risk`,
      description: `${record.school}: ${record.coveragePlan}`,
      meta: `${record.riskLevel} risk · ${record.affectedStudentIds?.length || 0} student${(record.affectedStudentIds?.length || 0) === 1 ? "" : "s"}`
    })),
    ...draftsPending.map((draft) => ({
      type: "draft-pending",
      tone: "purple",
      icon: Sparkles,
      title: draft.label || `${draft.firstName} ${draft.lastName} draft pending review`,
      description: draft.school ? `${draft.school} draft status is ${draft.status}.` : "Generated sections require human approval before export.",
      meta: "Draft review"
    }))
  ];

  return {
    dueSoon,
    overdueProgress,
    missingServiceLogs,
    draftsPending,
    openFlags,
    continuityRows,
    highContinuityRisks,
    schoolRows: schoolRollup,
    caseloadRows,
    workQueue: workQueue.slice(0, 6)
  };
}

function isDateWithinNextDays(value, today, days) {
  const delta = daysBetween(today, value);
  return delta >= 0 && delta <= days;
}

function isProgressScheduleOverdue(schedule = {}, today) {
  return /overdue/i.test(schedule.status || "") || daysBetween(today, schedule.nextDueDate) < 0;
}

function continuityToneForRecord(record = {}) {
  const text = `${record.riskLevel || ""} ${record.status || ""} ${record.providerName || ""}`.toLowerCase();
  if (/high|coverage needed|vacant|unassigned|escalated/.test(text)) return "red";
  if (/medium|monitoring|assigned/.test(text)) return "amber";
  if (/low|covered/.test(text)) return "green";
  return "blue";
}

function daysBetween(start, end) {
  if (!start || !end) return Number.POSITIVE_INFINITY;
  return Math.round((toDisplayDate(end) - toDisplayDate(start)) / 86400000);
}

function deliveryPercent(services) {
  const scheduled = sum(services, "scheduledMinutes");
  if (!scheduled) return 0;
  return Math.round((sum(services, "deliveredMinutes") / scheduled) * 100);
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function serviceDurationLabel(duration) {
  if (duration === undefined || duration === null || duration === "") return "Duration to confirm";
  return `${duration}${typeof duration === "number" ? " min" : ""}`;
}

function implementationWindowLabel(item = {}) {
  if (item.startDate && item.endDate) return `${formatDate(item.startDate)} to ${formatDate(item.endDate)}`;
  if (item.startDate) return `Starts ${formatDate(item.startDate)}`;
  if (item.endDate) return `Through ${formatDate(item.endDate)}`;
  return "Implementation dates to confirm";
}

function studentName(state, studentId) {
  const student = state.students.find((item) => item.id === studentId);
  return student ? `${student.firstName} ${student.lastName}` : "Unknown student";
}

function firstName(name) {
  return String(name || "there").split(" ")[0] || "there";
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(toDisplayDate(value));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function toDisplayDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

function isoDate(date) {
  const year = date.getFullYear();
  const monthValue = String(date.getMonth() + 1).padStart(2, "0");
  const dayValue = String(date.getDate()).padStart(2, "0");
  return `${year}-${monthValue}-${dayValue}`;
}

function recoveryTone(status = "") {
  const normalized = status.toLowerCase();
  if (normalized.includes("needed")) return "red";
  if (normalized.includes("planned")) return "amber";
  return "green";
}

function accessSupportTone(status = "") {
  if (status === "Active" || status === "Resolved" || status === "Not required") return "green";
  if (status === "Implementation pending") return "amber";
  return "red";
}

function placementReviewTone(status = "") {
  if (status === "Source aligned" || status === "Resolved") return "green";
  if (status === "Implementation follow-up" || status === "Team clarification needed" || status === "Needs review") return "amber";
  return "blue";
}

function scheduleTone(status = "") {
  const normalized = status.toLowerCase();
  if (normalized.includes("overdue")) return "red";
  if (normalized.includes("due")) return "amber";
  return "green";
}

function month(value) {
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(value));
}

function day(value) {
  return new Intl.DateTimeFormat("en-US", { day: "2-digit" }).format(new Date(value));
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function previewTextForFile(file) {
  if (file.type === "text/plain" || /\.txt$/i.test(file.name)) return file.text();
  return "";
}

function documentTypeForName(name) {
  if (/\.docx$/i.test(name)) return "DOCX";
  if (/\.pdf$/i.test(name)) return "PDF";
  return "Text";
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 104857.6) / 10} MB`;
}

function exportFormatForLabel(label) {
  return /^structured/i.test(label) || /audit/i.test(label) || /district system/i.test(label) ? "json" : "docx";
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard copy was blocked by the browser.");
}

function slug(value) {
  return String(value || "export")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
