const API_BASE_URL = import.meta.env.VITE_IEP_API_URL || "http://127.0.0.1:8787";
const REQUEST_TIMEOUT_MS = 8000;
const AUTH_SESSION_KEY = "iep-auth-session-v1";

export const demoRoleAccounts = {
  caseManager: "case-manager",
  generalEducation: "general-ed",
  relatedServiceProvider: "related-service",
  parent: "parent",
  student: "student",
  administrator: "administrator",
  schoolAdministrator: "school-admin",
  districtAdministrator: "district-admin",
  systemAdministrator: "system-admin",
  readOnlyReviewer: "read-only-reviewer"
};

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function loadWorkspace(sessionOverride = null) {
  const payload = await requestJson("/api/workspace", { sessionOverride });
  return payload.workspace;
}

export async function verifyAudit() {
  return requestJson("/api/audit/verify");
}

export async function login(username = "case-manager", password = "demo") {
  const session = await requestJson("/api/auth/login", {
    method: "POST",
    body: { username, password },
    skipAuth: true
  });
  writeSession(session);
  return session;
}

export function loginAsRole(role) {
  return login(demoRoleAccounts[role] || demoRoleAccounts.caseManager);
}

export async function downloadExportArtifact(exportRecord, state) {
  return downloadProtectedArtifact(exportRecord, "Export download failed.", exportRecord.artifact?.fileName || "export");
}

export async function downloadRetentionPackage(packageRecord) {
  return downloadProtectedArtifact(
    packageRecord,
    "Retention package download failed.",
    packageRecord.artifact?.fileName || "retention-manifest.json"
  );
}

async function downloadProtectedArtifact(record, errorMessage, fallbackFileName) {
  const session = await ensureSession();
  const response = await fetch(`${API_BASE_URL}${record.downloadUrl}`, {
    headers: {
      authorization: `Bearer ${session.token}`
    }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.message || errorMessage, {
      status: response.status,
      code: payload.error
    });
  }
  return {
    blob: await response.blob(),
    fileName: fileNameFromDisposition(response.headers.get("content-disposition")) || fallbackFileName
  };
}

export async function mutateWorkspace(action, state) {
  const request = requestForAction(action, state);
  if (!request) return null;
  return requestJson(request.path, {
    method: request.method,
    body: request.body
  });
}

function requestForAction(action, state) {
  switch (action.type) {
    case "selectStudent":
      return {
        method: "PATCH",
        path: "/api/workspace/current-student",
        body: {
          studentId: action.studentId
        }
      };
    case "createStudentProfile":
      return {
        method: "POST",
        path: "/api/students",
        body: {
          firstName: action.firstName,
          lastName: action.lastName,
          grade: action.grade,
          school: action.school,
          supportAreas: action.supportAreas,
          annualReviewDate: action.annualReviewDate
        }
      };
    case "addSourceDocument":
      return {
        method: "POST",
        path: "/api/intake",
        body: {
          studentId: state.currentStudentId,
          name: action.name,
          documentType: action.documentType,
          sourceText: action.sourceText,
          mimeType: action.mimeType,
          fileBase64: action.fileBase64
        }
      };
    case "confirmExtraction":
      return {
        method: "PATCH",
        path: `/api/extraction/${encodeURIComponent(action.sectionId)}`,
        body: { status: "Confirmed" }
      };
    case "editExtraction":
      return {
        method: "PATCH",
        path: `/api/extraction/${encodeURIComponent(action.sectionId)}`,
        body: { content: action.content }
      };
    case "updateOcrReview":
      return {
        method: "PATCH",
        path: `/api/documents/${encodeURIComponent(action.documentId)}/ocr-review`,
        body: {
          status: action.status,
          confidence: action.confidence,
          reviewedTextExcerpt: action.reviewedTextExcerpt,
          reviewerNote: action.reviewerNote
        }
      };
    case "updateSourceAnchorReview":
      return {
        method: "PATCH",
        path: `/api/extraction/${encodeURIComponent(action.sectionId)}/source-anchor`,
        body: {
          precision: action.precision,
          pageNumber: action.pageNumber,
          segmentLabel: action.segmentLabel,
          anchorX: action.anchorX,
          anchorY: action.anchorY,
          anchorWidth: action.anchorWidth,
          anchorHeight: action.anchorHeight,
          reviewerNote: action.reviewerNote
        }
      };
    case "rejectExtraction":
      return {
        method: "POST",
        path: `/api/extraction/${encodeURIComponent(action.sectionId)}/reject`,
        body: { reason: action.reason }
      };
    case "regenerateExtraction":
      return {
        method: "POST",
        path: `/api/extraction/${encodeURIComponent(action.sectionId)}/regenerate`,
        body: { guidance: action.guidance }
      };
    case "approveExtraction":
      return { method: "POST", path: "/api/extraction/approve" };
    case "recordSummaryCopy":
      return {
        method: "POST",
        path: `/api/summaries/${encodeURIComponent(action.audience)}/copy`
      };
    case "generateSummaryHandout":
      return {
        method: "POST",
        path: `/api/summaries/${encodeURIComponent(action.audience)}/handout`
      };
    case "submitSummaryComprehensionCheck":
      return {
        method: "POST",
        path: `/api/summaries/${encodeURIComponent(action.audience)}/comprehension-checks`,
        body: {
          sectionHeading: action.sectionHeading,
          understandingStatus: action.understandingStatus,
          questionOrNote: action.questionOrNote,
          preferredFollowUp: action.preferredFollowUp,
          language: action.language
        }
      };
    case "reviewSummaryComprehensionCheck":
      return {
        method: "PATCH",
        path: `/api/summary-comprehension-checks/${encodeURIComponent(action.checkId)}`,
        body: {
          reviewStatus: action.reviewStatus,
          response: action.response,
          nextStep: action.nextStep
        }
      };
    case "reviewClassroomRoster":
      return {
        method: "POST",
        path: "/api/classroom-roster/reviews",
        body: {
          classPeriod: action.classPeriod,
          reviewFocus: action.reviewFocus,
          reviewedRosterIds: action.reviewedRosterIds,
          actionPlan: action.actionPlan,
          followUpDate: action.followUpDate
        }
      };
    case "toggleTask":
      return {
        method: "POST",
        path: `/api/tasks/${encodeURIComponent(action.taskId)}/toggle`,
        body: {
          note: action.note,
          evidenceDocumentId: action.evidenceDocumentId,
          evidenceLabel: action.evidenceLabel
        }
      };
    case "acknowledgeTask":
      return {
        method: "POST",
        path: `/api/tasks/${encodeURIComponent(action.taskId)}/acknowledge`,
        body: { note: action.note }
      };
    case "recordTaskObservation":
      return {
        method: "POST",
        path: `/api/tasks/${encodeURIComponent(action.taskId)}/observations`,
        body: {
          observedAt: action.observedAt,
          context: action.context,
          note: action.note,
          supportUsed: action.supportUsed
        }
      };
    case "addTeamComment":
      return {
        method: "POST",
        path: "/api/team-comments",
        body: {
          studentId: action.studentId,
          targetType: action.targetType,
          targetId: action.targetId,
          targetTitle: action.targetTitle,
          visibility: action.visibility,
          body: action.body,
          sourceReference: action.sourceReference
        }
      };
    case "replyTeamComment":
      return {
        method: "POST",
        path: `/api/team-comments/${encodeURIComponent(action.commentId)}/replies`,
        body: {
          body: action.body,
          visibility: action.visibility
        }
      };
    case "moderateTeamComment":
      return {
        method: "PATCH",
        path: `/api/team-comments/${encodeURIComponent(action.commentId)}/moderation`,
        body: {
          moderationStatus: action.moderationStatus,
          visibility: action.visibility,
          moderationNote: action.moderationNote
        }
      };
    case "recordTeamCommentQueueReview":
      return {
        method: "POST",
        path: "/api/team-comments/queue-reviews",
        body: {
          studentId: action.studentId,
          queueStatus: action.queueStatus,
          notificationPlan: action.notificationPlan,
          retentionDecision: action.retentionDecision,
          retentionBoundary: action.retentionBoundary,
          reviewerNote: action.reviewerNote,
          nextReviewDate: action.nextReviewDate
        }
      };
    case "recordPortalAccessReview":
      return {
        method: "POST",
        path: "/api/portal-access-reviews",
        body: {
          studentId: action.studentId,
          subjectRole: action.subjectRole,
          subjectName: action.subjectName,
          accessStatus: action.accessStatus,
          verificationMethod: action.verificationMethod,
          identityEvidence: action.identityEvidence,
          languageSupportNeeded: action.languageSupportNeeded,
          privacyNote: action.privacyNote
        }
      };
    case "preparePortalInvitationPackage":
      return {
        method: "POST",
        path: "/api/portal-invitation-packages",
        body: {
          studentId: action.studentId,
          subjectRole: action.subjectRole,
          subjectName: action.subjectName,
          status: action.status,
          deliveryChannel: action.deliveryChannel,
          expiresAt: action.expiresAt,
          scopeSummary: action.scopeSummary,
          identityVerificationSummary: action.identityVerificationSummary,
          languageSupportNote: action.languageSupportNote,
          privacyBoundary: action.privacyBoundary,
          providerReference: action.providerReference
        }
      };
    case "addProgress":
      return {
        method: "POST",
        path: "/api/progress",
        body: {
          goalId: action.goalId,
          date: action.date,
          value: action.value,
          notes: action.notes,
          evidenceDocumentId: action.evidenceDocumentId,
          evidenceLabel: action.evidenceLabel,
          evidenceType: action.evidenceType
        }
      };
    case "logService":
      return {
        method: "POST",
        path: `/api/services/${encodeURIComponent(action.serviceId)}/log`,
        body: { minutes: action.minutes }
      };
    case "assignRecovery":
      return {
        method: "POST",
        path: `/api/services/${encodeURIComponent(action.serviceId)}/recovery`,
        body: {
          recoveryDate: action.recoveryDate,
          provider: action.provider,
          familyCommunication: action.familyCommunication
        }
      };
    case "generateReview":
      return { method: "POST", path: "/api/review-flags/generate" };
    case "resolveFlag":
      return {
        method: "POST",
        path: `/api/review-flags/${encodeURIComponent(action.flagId)}/resolve`,
        body: {
          decision: action.decision,
          rationale: action.rationale,
          nextAction: action.nextAction
        }
      };
    case "requestComplianceReview":
      return {
        method: "POST",
        path: `/api/review-flags/${encodeURIComponent(action.flagId)}/compliance-reviews`,
        body: {
          reviewType: action.reviewType,
          assignedReviewer: action.assignedReviewer,
          dueDate: action.dueDate,
          rationale: action.rationale,
          nextAction: action.nextAction
        }
      };
    case "completeComplianceReview":
      return {
        method: "PATCH",
        path: `/api/compliance-reviews/${encodeURIComponent(action.reviewId)}`,
        body: {
          status: action.status,
          outcome: action.outcome,
          reviewerNote: action.reviewerNote,
          nextAction: action.nextAction
        }
      };
    case "requestLegalReviewRoute":
      return {
        method: "POST",
        path: `/api/compliance-reviews/${encodeURIComponent(action.reviewId)}/legal-routes`,
        body: {
          counselName: action.counselName,
          reviewScope: action.reviewScope,
          routingReason: action.routingReason,
          dueDate: action.dueDate,
          districtPolicyReference: action.districtPolicyReference
        }
      };
    case "recordLegalReviewOutcome":
      return {
        method: "PATCH",
        path: `/api/legal-review-routes/${encodeURIComponent(action.routeId)}`,
        body: {
          status: action.status,
          counselSummary: action.counselSummary,
          recommendedAction: action.recommendedAction,
          reviewerNote: action.reviewerNote
        }
      };
    case "createIepComparison":
      return {
        method: "POST",
        path: "/api/iep-comparisons",
        body: {
          section: action.section,
          changeType: action.changeType,
          title: action.title,
          previousText: action.previousText,
          currentText: action.currentText,
          implementationImpact: action.implementationImpact,
          familySummary: action.familySummary,
          sourceReference: action.sourceReference,
          amendmentReviewStatus: action.amendmentReviewStatus,
          amendmentNote: action.amendmentNote,
          familyVisible: action.familyVisible,
          studentVisible: action.studentVisible
        }
      };
    case "autoGenerateIepComparisons":
      return {
        method: "POST",
        path: "/api/iep-comparisons/auto-diff",
        body: {
          previousDocumentLabel: action.previousDocumentLabel,
          currentDocumentLabel: action.currentDocumentLabel,
          previousText: action.previousText,
          currentText: action.currentText
        }
      };
    case "reviewIepComparison":
      return {
        method: "PATCH",
        path: `/api/iep-comparisons/${encodeURIComponent(action.comparisonId)}`,
        body: {
          status: action.status,
          reviewNote: action.reviewNote,
          familyVisible: action.familyVisible,
          studentVisible: action.studentVisible
        }
      };
    case "runAiEvaluation":
      return {
        method: "POST",
        path: "/api/ai-governance/evaluations",
        body: {
          evaluationScope: action.evaluationScope,
          reviewerNote: action.reviewerNote
        }
      };
    case "runAiCitationEvaluation":
      return {
        method: "POST",
        path: "/api/ai-governance/citation-evaluations",
        body: {
          outputLabel: action.outputLabel,
          outputText: action.outputText,
          citations: action.citations,
          reviewerNote: action.reviewerNote
        }
      };
    case "updateDistrictIntegration":
      return {
        method: "PATCH",
        path: `/api/district-configuration/integrations/${encodeURIComponent(action.integrationId)}`,
        body: {
          status: action.status,
          provider: action.provider,
          owner: action.owner,
          nextReviewDate: action.nextReviewDate,
          note: action.note
        }
      };
    case "updateDataProtectionControl":
      return {
        method: "PATCH",
        path: `/api/district-configuration/data-protection/${encodeURIComponent(action.controlId)}`,
        body: {
          status: action.status,
          control: action.control,
          owner: action.owner,
          nextReviewDate: action.nextReviewDate,
          evidenceNote: action.evidenceNote,
          productionBoundary: action.productionBoundary
        }
      };
    case "updateRolePolicy":
      return {
        method: "PATCH",
        path: "/api/governance/role-policy",
        body: {
          roleId: action.roleId,
          studentScope: action.studentScope,
          defaultAccess: action.defaultAccess,
          visibleInformation: action.visibleInformation,
          status: action.status,
          owner: action.owner,
          nextReviewDate: action.nextReviewDate,
          note: action.note
        }
      };
    case "updateRecordLifecycle":
      return {
        method: "PATCH",
        path: "/api/governance/record-lifecycle",
        body: {
          ruleId: action.ruleId,
          draftStatus: action.draftStatus,
          reviewedStatus: action.reviewedStatus,
          officialReady: action.officialReady,
          exportable: action.exportable,
          requiredReviewRole: action.requiredReviewRole,
          boundaryLabel: action.boundaryLabel,
          status: action.status,
          reviewNote: action.reviewNote
        }
      };
    case "updateAlertRule":
      return {
        method: "PATCH",
        path: "/api/governance/alert-rules",
        body: {
          ruleId: action.ruleId,
          enabled: action.enabled,
          triggerDays: action.triggerDays,
          priority: action.priority,
          escalationRole: action.escalationRole,
          status: action.status,
          reviewNote: action.reviewNote
        }
      };
    case "updateSuccessMetric":
      return {
        method: "PATCH",
        path: "/api/governance/success-metrics",
        body: {
          metricId: action.metricId,
          baseline: action.baseline,
          target: action.target,
          reviewCadence: action.reviewCadence,
          owner: action.owner,
          status: action.status,
          evidenceSource: action.evidenceSource,
          reviewNote: action.reviewNote
        }
      };
    case "updateIntegrationSource":
      return {
        method: "PATCH",
        path: "/api/governance/integration-sources",
        body: {
          integrationId: action.integrationId,
          sourceOfTruth: action.sourceOfTruth,
          direction: action.direction,
          provider: action.provider,
          owner: action.owner,
          status: action.status,
          nextReviewDate: action.nextReviewDate,
          boundary: action.boundary,
          reviewNote: action.reviewNote
        }
      };
    case "updateGapDistrictConfiguration":
      return {
        method: "PATCH",
        path: "/api/governance/district-configuration",
        body: {
          districtId: action.districtId,
          districtName: action.districtName,
          jurisdiction: action.jurisdiction,
          configurationVersion: action.configurationVersion,
          tenancyMode: action.tenancyMode,
          dataResidency: action.dataResidency,
          registryGovernanceStatus: action.registryGovernanceStatus,
          reviewNote: action.reviewNote
        }
      };
    case "updateAccessibilityFinding":
      return {
        method: "PATCH",
        path: `/api/accessibility/findings/${encodeURIComponent(action.findingId)}`,
        body: {
          status: action.status,
          severity: action.severity,
          owner: action.owner,
          dueDate: action.dueDate,
          assistiveTechnology: action.assistiveTechnology,
          remediationPlan: action.remediationPlan,
          verificationNote: action.verificationNote
        }
      };
    case "answerQuestion":
      return {
        method: "POST",
        path: `/api/meetings/questions/${encodeURIComponent(action.questionId)}/answer`,
        body: { response: action.response || "Answered by team." }
      };
    case "submitQuestion":
      return {
        method: "POST",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/questions`,
        body: { text: action.text }
      };
    case "addMeetingPrepNote":
      return {
        method: "POST",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/notes`,
        body: {
          topic: action.topic,
          body: action.body,
          audience: action.audience
        }
      };
    case "acknowledgeMeetingPacket":
      return {
        method: "PATCH",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/packet-acknowledgments/${encodeURIComponent(action.acknowledgmentId)}`,
        body: {
          status: action.status,
          note: action.note
        }
      };
    case "requestMeetingSignature":
      return {
        method: "POST",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/signature-requests`,
        body: {
          packetTitle: action.packetTitle,
          signatureScope: action.signatureScope,
          requestedForRole: action.requestedForRole,
          requestedForName: action.requestedForName,
          requestNote: action.requestNote
        }
      };
    case "signMeetingPacket":
      return {
        method: "PATCH",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/signature-requests/${encodeURIComponent(action.signatureId)}/sign`,
        body: {
          signerName: action.signerName,
          attestation: action.attestation
        }
      };
    case "updateStudentVoice":
      return {
        method: "PATCH",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/student-voice`,
        body: { studentVoice: action.studentVoice }
      };
    case "updateSelfAdvocacy":
      return {
        method: "PATCH",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/self-advocacy`,
        body: {
          preferredSupport: action.preferredSupport,
          participationGoal: action.participationGoal,
          requestScript: action.requestScript,
          confidence: action.confidence,
          barrier: action.barrier,
          nextStep: action.nextStep
        }
      };
    case "updateParticipantReadiness":
      return {
        method: "PATCH",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/participants/${encodeURIComponent(action.participantId)}`,
        body: {
          status: action.status,
          mode: action.mode,
          note: action.note
        }
      };
    case "updateLanguageAccess":
      return {
        method: "PATCH",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/language-access`,
        body: {
          preferredLanguage: action.preferredLanguage,
          interpreterNeeded: action.interpreterNeeded,
          translationStatus: action.translationStatus,
          interpreterStatus: action.interpreterStatus,
          requestNote: action.requestNote,
          coordinatorNote: action.coordinatorNote
        }
      };
    case "updateGlossaryTerm":
      return {
        method: "PATCH",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/language-access/glossary/${encodeURIComponent(action.termId)}`,
        body: {
          status: action.status,
          note: action.note,
          responseStatus: action.responseStatus,
          response: action.response,
          coordinate: action.coordinate
        }
      };
    case "updateCompanionDocument":
      return {
        method: "PATCH",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/companion-documents/${encodeURIComponent(action.documentId)}`,
        body: {
          status: action.status,
          owner: action.owner,
          dueDate: action.dueDate,
          note: action.note
        }
      };
    case "updateFamilyResource":
      return {
        method: "PATCH",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/family-resources/${encodeURIComponent(action.resourceId)}`,
        body: {
          status: action.status,
          owner: action.owner,
          dueDate: action.dueDate,
          note: action.note
        }
      };
    case "acknowledgeFamilyResource":
      return {
        method: "PATCH",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/family-resources/${encodeURIComponent(action.resourceId)}/response`,
        body: {
          status: action.status,
          note: action.note
        }
      };
    case "syncCalendarHold":
      return {
        method: "POST",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/calendar-holds`,
        body: {
          provider: action.provider,
          attendanceMode: action.attendanceMode,
          note: action.note
        }
      };
    case "recordMeetingTranscriptSummary":
      return {
        method: "POST",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/transcript-summaries`,
        body: {
          transcriptSource: action.transcriptSource,
          transcriptExcerpt: action.transcriptExcerpt,
          summary: action.summary,
          decisions: action.decisions,
          followUps: action.followUps,
          status: action.status,
          familyVisible: action.familyVisible,
          studentVisible: action.studentVisible
        }
      };
    case "recordMeetingRecordingReview":
      return {
        method: "POST",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/recording-reviews`,
        body: {
          recordingSource: action.recordingSource,
          status: action.status,
          participantConsentSummary: action.participantConsentSummary,
          transcriptHandlingPlan: action.transcriptHandlingPlan,
          storageLocation: action.storageLocation,
          retentionBoundary: action.retentionBoundary,
          familyVisible: action.familyVisible,
          studentVisible: action.studentVisible
        }
      };
    case "updateAccessSupport":
      return {
        method: "PATCH",
        path: `/api/access-supports/${encodeURIComponent(action.supportId)}`,
        body: {
          status: action.status,
          implementationPlan: action.implementationPlan,
          responsibleRole: action.responsibleRole,
          reviewNote: action.reviewNote
        }
      };
    case "updatePlacementReview":
      return {
        method: "PATCH",
        path: `/api/placement-reviews/${encodeURIComponent(action.reviewId)}`,
        body: {
          status: action.status,
          lreConsideration: action.lreConsideration,
          implementationImpact: action.implementationImpact,
          followUpOwner: action.followUpOwner,
          nextReviewDate: action.nextReviewDate,
          reviewerNote: action.reviewerNote
        }
      };
    case "updateStaffContinuity":
      return {
        method: "PATCH",
        path: `/api/staff-continuity/${encodeURIComponent(action.continuityId)}`,
        body: {
          status: action.status,
          riskLevel: action.riskLevel,
          coverageOwner: action.coverageOwner,
          nextReviewDate: action.nextReviewDate,
          coveragePlan: action.coveragePlan
        }
      };
    case "reviewSourceRegistry":
      return {
        method: "PATCH",
        path: `/api/source-registry/${encodeURIComponent(action.sourceId)}/review`,
        body: {
          status: action.status,
          retrievedDate: action.retrievedDate,
          nextReviewDate: action.nextReviewDate,
          note: action.note
        }
      };
    case "saveSourceRegistryEntry":
      return {
        method: "POST",
        path: "/api/source-registry/entries",
        body: {
          sourceId: action.sourceId,
          title: action.title,
          issuingOrganization: action.issuingOrganization,
          sourceType: action.sourceType,
          sourceFormType: action.sourceFormType,
          jurisdiction: action.jurisdiction,
          programArea: action.programArea,
          sourceRegistryVersion: action.sourceRegistryVersion,
          effectiveDate: action.effectiveDate,
          retrievedDate: action.retrievedDate,
          nextReviewDate: action.nextReviewDate,
          url: action.url,
          fileTypesAvailable: action.fileTypesAvailable,
          languagesAvailable: action.languagesAvailable,
          languageAvailabilityNote: action.languageAvailabilityNote,
          productUse: action.productUse,
          reviewStatus: action.reviewStatus,
          reviewNote: action.reviewNote,
          activate: action.activate
        }
      };
    case "revokeSecuritySession":
      return {
        method: "POST",
        path: `/api/security/sessions/${encodeURIComponent(action.sessionId)}/revoke`,
        body: {
          note: action.note
        }
      };
    case "reviewIdentityLifecycle":
      return {
        method: "POST",
        path: "/api/security/identity-lifecycle-reviews",
        body: {
          identityProvider: action.identityProvider,
          lifecycleStatus: action.lifecycleStatus,
          mfaStatus: action.mfaStatus,
          tenantBoundaryStatus: action.tenantBoundaryStatus,
          roleProvisioningStatus: action.roleProvisioningStatus,
          accountLifecyclePlan: action.accountLifecyclePlan,
          tenantBoundaryEvidence: action.tenantBoundaryEvidence,
          roleProvisioningNote: action.roleProvisioningNote,
          nextReviewDate: action.nextReviewDate
        }
      };
    case "createAuditAnchor":
      return {
        method: "POST",
        path: "/api/audit/anchors",
        body: {
          note: action.note,
          externalReference: action.externalReference
        }
      };
    case "recordExternalTimestampReceipt":
      return {
        method: "PATCH",
        path: `/api/audit/anchors/${encodeURIComponent(action.anchorId)}/external-timestamp`,
        body: {
          provider: action.provider,
          receiptId: action.receiptId,
          receiptTimestamp: action.receiptTimestamp,
          verificationReference: action.verificationReference,
          reviewerNote: action.reviewerNote
        }
      };
    case "sealAuditRetentionPackage":
      return {
        method: "POST",
        path: "/api/audit/retention-packages",
        body: {
          anchorId: action.anchorId,
          note: action.note
        }
      };
    case "reviewRetentionPolicy":
      return {
        method: "POST",
        path: "/api/audit/retention-policy-reviews",
        body: {
          retentionPackageId: action.retentionPackageId,
          anchorId: action.anchorId,
          policyScope: action.policyScope,
          policySource: action.policySource,
          disposition: action.disposition,
          retentionPeriod: action.retentionPeriod,
          legalHoldStatus: action.legalHoldStatus,
          archiveDecision: action.archiveDecision,
          evidenceSummary: action.evidenceSummary,
          nextReviewDate: action.nextReviewDate
        }
      };
    case "submitConcern":
      return {
        method: "POST",
        path: `/api/meetings/${encodeURIComponent(action.meetingId)}/concerns`,
        body: {
          title: action.title,
          concern: action.concern
        }
      };
    case "resolveConcern":
      return {
        method: "PATCH",
        path: `/api/meetings/concerns/${encodeURIComponent(action.concernId)}`,
        body: {
          response: action.response,
          decision: action.decision,
          nextStep: action.nextStep,
          priorWrittenNotice: action.priorWrittenNotice
        }
      };
    case "reviewReminder":
      return {
        method: "POST",
        path: `/api/reminders/${encodeURIComponent(action.reminderId)}/review`,
        body: {
          title: action.title,
          studentId: action.studentId,
          note: action.note
        }
      };
    case "sendNotification":
      return {
        method: "POST",
        path: "/api/notifications",
        body: {
          studentId: action.studentId,
          sourceId: action.sourceId,
          sourceType: action.sourceType,
          sourceTitle: action.sourceTitle,
          audience: action.audience,
          channel: action.channel,
          message: action.message
        }
      };
    case "finalizeDraftDiff":
      return {
        method: "PATCH",
        path: `/api/meetings/draft-diffs/${encodeURIComponent(action.diffId)}`,
        body: {
          finalText: action.finalText,
          decisionRationale: action.decisionRationale
        }
      };
    case "createDraft":
      return {
        method: "POST",
        path: "/api/drafts",
        body: {
          profile: action.profile,
          guidedResponses: action.guidedResponses,
          annotatedSample: action.annotatedSample
        }
      };
    case "reviseDraftSection":
      return {
        method: "PATCH",
        path: `/api/drafts/${encodeURIComponent(action.draftId)}/sections/${encodeURIComponent(action.sectionId)}`,
        body: {
          content: action.content,
          revisionNote: action.revisionNote
        }
      };
    case "regenerateDraftSection":
      return {
        method: "POST",
        path: `/api/drafts/${encodeURIComponent(action.draftId)}/sections/${encodeURIComponent(action.sectionId)}/regenerate`,
        body: {
          guidance: action.guidance
        }
      };
    case "approveDraft":
      return {
        method: "POST",
        path: `/api/drafts/${encodeURIComponent(action.draftId)}/approve`
      };
    case "recordExport":
      return {
        method: "POST",
        path: "/api/exports",
        body: {
          label: action.label,
          format: action.format || "json",
          payload: action.payload ?? null
        }
      };
    case "reviewExportTemplate":
      return {
        method: "POST",
        path: "/api/exports/template-reviews",
        body: {
          exportId: action.exportId,
          targetSystem: action.targetSystem,
          templateName: action.templateName,
          templateVersion: action.templateVersion,
          format: action.format,
          validationStatus: action.validationStatus,
          mappingStatus: action.mappingStatus,
          submissionMode: action.submissionMode,
          requiredSections: action.requiredSections,
          mappedSections: action.mappedSections,
          mappingEvidence: action.mappingEvidence,
          validationEvidence: action.validationEvidence,
          reviewNote: action.reviewNote,
          nextReviewDate: action.nextReviewDate
        }
      };
    default:
      return null;
  }
}

function fileNameFromDisposition(value) {
  const match = String(value || "").match(/filename="([^"]+)"/i);
  return match?.[1] || null;
}

async function requestJson(path, { method = "GET", body, skipAuth = false, sessionOverride = null } = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const session = skipAuth ? null : sessionOverride || await ensureSession();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(session ? { authorization: `Bearer ${session.token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    const payload = await response.json();
    if (!response.ok) {
      if (response.status === 401 && !skipAuth) clearSession();
      throw new ApiError(payload.message || "API request failed.", {
        status: response.status,
        code: payload.error
      });
    }
    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError("Local API request timed out.", { code: "TIMEOUT" });
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError("Local API is unavailable.", { code: "UNAVAILABLE" });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function ensureSession() {
  const existing = readSession();
  if (existing?.token && Date.parse(existing.expiresAt) > Date.now() + 30_000) return existing;
  return login();
}

function readSession() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  try {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Session remains in memory for this request path; the next request can re-authenticate.
  }
}

function clearSession() {
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
}
