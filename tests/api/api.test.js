import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApiServer } from "../../server/api.js";
import { createExportArtifact } from "../../server/exportArtifacts.js";
import { WorkspaceStore } from "../../server/store.js";
import { schemaSections } from "../../src/data.js";

async function withApi(t) {
  const dataDir = await mkdtemp(join(tmpdir(), "iep-api-"));
  const store = new WorkspaceStore({ dataDir });
  const server = createApiServer({ store });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const tokens = new Map();
  const tokenForRole = async (role) => {
    if (tokens.has(role)) return tokens.get(role);
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: usernameForRole(role), password: "demo" })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Unable to log in test user.");
    tokens.set(role, payload.token);
    return payload.token;
  };

  const request = async (
    path,
    { method = "GET", role = "caseManager", body, unauthenticated = false, headers = {} } = {}
  ) => {
    const token = unauthenticated ? null : await tokenForRole(role);
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json();
    return { response, payload };
  };

  return { baseUrl, dataDir, request, store, tokenForRole };
}

function usernameForRole(role) {
  return {
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
  }[role];
}

test("returns the seed workspace and verifies the seed audit chain", async (t) => {
  const { request } = await withApi(t);

  const directVerifyResult = await request("/api/audit/verify");
  assert.equal(directVerifyResult.response.status, 200);
  assert.equal(directVerifyResult.payload.valid, true);
  assert.ok(directVerifyResult.payload.checked >= 5);

  const workspaceResult = await request("/api/workspace");
  assert.equal(workspaceResult.response.status, 200);
  assert.equal(workspaceResult.payload.workspace.currentStudentId, "student-001");
  assert.ok(workspaceResult.payload.workspace.goals.length > 0);
  assert.equal(workspaceResult.payload.workspace.sourceRegistry.activeSourceId, "pa-school-age-iep-non-annotated");
  assert.ok(workspaceResult.payload.workspace.sourceRegistry.entries.length >= 3);
  assert.ok(workspaceResult.payload.workspace.sourceRegistry.entries[0].languagesAvailable.includes("English"));
  assert.equal(workspaceResult.payload.workspace.ieps[0].sourceAlignment.sourceRegistryVersion, "PA-demo-2026.06");
  assert.equal(workspaceResult.payload.workspace.ieps[0].sourceAlignment.sourceFormType, "Non-Annotated");
  assert.ok(workspaceResult.payload.workspace.ieps[0].sourceAlignment.languagesAvailable.includes("English"));
  const structuredRecord = workspaceResult.payload.workspace.ieps[0].structuredRecord;
  for (const section of schemaSections) {
    assert.ok(Object.hasOwn(structuredRecord, section), `structured record includes ${section}`);
  }
  assert.ok(structuredRecord.goalsAndObjectives.length > 0);
  assert.ok(structuredRecord.services.length > 0);
  assert.ok(structuredRecord.accommodations.length > 0);
  assert.ok(structuredRecord.progressMonitoring.length > 0);
  assert.ok(structuredRecord.stateAndLocalAssessments.accommodations.includes("Extended time"));
  assert.match(structuredRecord.specialConsiderations.behavior, /Executive-function/);
  assert.equal(workspaceResult.payload.workspace.summaries.parent.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.equal(workspaceResult.payload.workspace.tasks[0].sourceAlignment.jurisdiction, "Pennsylvania");
  assert.equal(workspaceResult.payload.workspace.reviewFlags[0].sourceAlignment.programArea, "School Age");

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.response.status, 200);
  assert.equal(verifyResult.payload.valid, true);
  assert.ok(verifyResult.payload.checked >= 5);
});

test("requires authenticated sessions and ignores spoofed role headers", async (t) => {
  const { request } = await withApi(t);

  const unauthenticated = await request("/api/workspace", { unauthenticated: true });
  assert.equal(unauthenticated.response.status, 401);

  const parentWorkspace = await request("/api/workspace", { role: "parent" });
  assert.equal(parentWorkspace.response.status, 200);
  assert.equal(parentWorkspace.payload.user.role, "parent");
  assert.deepEqual(parentWorkspace.payload.workspace.students.map((student) => student.id), ["student-001"]);

  const relatedWorkspace = await request("/api/workspace", { role: "relatedServiceProvider" });
  assert.equal(relatedWorkspace.response.status, 200);
  assert.equal(relatedWorkspace.payload.user.role, "relatedServiceProvider");
  assert.deepEqual(relatedWorkspace.payload.workspace.students.map((student) => student.id), ["student-001"]);
  assert.ok(relatedWorkspace.payload.workspace.tasks.some((task) => task.category === "related"));

  const reviewerWorkspace = await request("/api/workspace", { role: "readOnlyReviewer" });
  assert.equal(reviewerWorkspace.response.status, 200);
  assert.equal(reviewerWorkspace.payload.user.role, "readOnlyReviewer");
  assert.equal(reviewerWorkspace.payload.workspace.students.length, 4);
  assert.ok(reviewerWorkspace.payload.workspace.reviewFlags.length > 0);
  assert.ok(reviewerWorkspace.payload.workspace.complianceReviews.length > 0);
  assert.ok(reviewerWorkspace.payload.workspace.staffContinuity.length > 0);
  assert.equal(reviewerWorkspace.payload.workspace.securityPosture, null);
  assert.equal(reviewerWorkspace.payload.workspace.districtConfiguration.integrationReadiness.length, 0);

  const reviewerUploadDenied = await request("/api/intake", {
    method: "POST",
    role: "readOnlyReviewer",
    body: { name: "ReviewerUpload.txt", sourceText: "Goal: reviewer cannot upload." }
  });
  assert.equal(reviewerUploadDenied.response.status, 403);

  const reviewerProgressDenied = await request("/api/progress", {
    method: "POST",
    role: "readOnlyReviewer",
    body: {
      goalId: "goal-001",
      date: "2026-06-24",
      value: 77,
      notes: "Read-only reviewer cannot enter progress data."
    }
  });
  assert.equal(reviewerProgressDenied.response.status, 403);

  const reviewerSummaryDenied = await request("/api/summaries/parent/handout", {
    method: "POST",
    role: "readOnlyReviewer"
  });
  assert.equal(reviewerSummaryDenied.response.status, 403);

  const spoofed = await request("/api/intake", {
    method: "POST",
    role: "parent",
    headers: { "x-role": "caseManager" },
    body: { name: "Spoofed.txt", sourceText: "Goal: test" }
  });
  assert.equal(spoofed.response.status, 403);
});

test("creates draft student profiles and persists active student selection", async (t) => {
  const { request } = await withApi(t);

  const parentDenied = await request("/api/students", {
    method: "POST",
    role: "parent",
    body: {
      firstName: "Samira",
      lastName: "Patel",
      grade: "6",
      school: "Riverbend Middle School",
      supportAreas: "Reading, written expression",
      annualReviewDate: "2026-08-15"
    }
  });
  assert.equal(parentDenied.response.status, 403);

  const created = await request("/api/students", {
    method: "POST",
    role: "caseManager",
    body: {
      firstName: "Samira",
      lastName: "Patel",
      grade: "6",
      school: "Riverbend Middle School",
      supportAreas: "Reading, written expression",
      annualReviewDate: "2026-08-15"
    }
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.student.firstName, "Samira");
  assert.equal(created.payload.student.status, "Draft review");
  assert.deepEqual(created.payload.student.supportAreas, ["Reading", "written expression"]);
  assert.equal(created.payload.iep.studentId, created.payload.student.id);
  assert.equal(created.payload.iep.status, "Draft");
  assert.equal(created.payload.iep.structuredRecord.studentInformation.name, "Samira Patel");
  assert.equal(created.payload.workspace.currentStudentId, created.payload.student.id);
  assert.equal(created.payload.workspace.auditLog[0].title, "Student profile created");

  const selected = await request("/api/workspace/current-student", {
    method: "PATCH",
    role: "caseManager",
    body: { studentId: "student-004" }
  });
  assert.equal(selected.response.status, 200);
  assert.equal(selected.payload.studentId, "student-004");
  assert.equal(selected.payload.workspace.currentStudentId, "student-004");
  assert.equal(selected.payload.workspace.auditLog[0].title, "Student workspace selected");

  const deniedSelection = await request("/api/workspace/current-student", {
    method: "PATCH",
    role: "parent",
    body: { studentId: "student-004" }
  });
  assert.equal(deniedSelection.response.status, 403);

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("records role-aware team collaboration comments with source targets", async (t) => {
  const { request } = await withApi(t);

  const parentWorkspace = await request("/api/workspace", { role: "parent" });
  assert.equal(parentWorkspace.response.status, 200);
  assert.ok(parentWorkspace.payload.workspace.teamComments.some((comment) => comment.visibility === "IEP team"));
  assert.ok(!parentWorkspace.payload.workspace.teamComments.some((comment) => comment.visibility === "Staff only"));
  assert.deepEqual(parentWorkspace.payload.workspace.teamCommentQueueReviews, []);

  const readOnlyWorkspace = await request("/api/workspace", { role: "readOnlyReviewer" });
  assert.ok(readOnlyWorkspace.payload.workspace.teamCommentQueueReviews.some((review) => review.id === "team-comment-queue-review-001"));

  const posted = await request("/api/team-comments", {
    method: "POST",
    role: "generalEducation",
    body: {
      studentId: "student-001",
      targetType: "Accommodation",
      targetId: "acc-003",
      visibility: "Staff only",
      body: "Math team needs the extended-time amount clarified before benchmark testing."
    }
  });
  assert.equal(posted.response.status, 201);
  assert.equal(posted.payload.visibility, "Staff only");
  assert.equal(posted.payload.targetTitle, "Provide extended time for classroom assessments and written assignments as written.");
  assert.equal(posted.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.match(posted.payload.officialRecordImpact, /does not change official IEP obligations/);
  assert.equal(posted.payload.workspace.auditLog[0].title, "Team comment added");

  const parentAfterPost = await request("/api/workspace", { role: "parent" });
  assert.ok(!parentAfterPost.payload.workspace.teamComments.some((comment) => /benchmark testing/.test(comment.body)));

  const replied = await request(`/api/team-comments/${posted.payload.id}/replies`, {
    method: "POST",
    role: "generalEducation",
    body: {
      visibility: "Staff only",
      body: "Staff-only follow-up: department chair will bring the ambiguity to the next planning block."
    }
  });
  assert.equal(replied.response.status, 201);
  assert.equal(replied.payload.commentId, posted.payload.id);
  assert.equal(replied.payload.visibility, "Staff only");
  assert.match(replied.payload.officialRecordImpact, /does not change official IEP obligations/);
  assert.equal(replied.payload.workspace.auditLog[0].title, "Team comment reply added");

  const moderationDenied = await request(`/api/team-comments/${posted.payload.id}/moderation`, {
    method: "PATCH",
    role: "parent",
    body: {
      moderationStatus: "Approved for IEP team",
      visibility: "IEP team",
      moderationNote: "Parent cannot moderate collaboration visibility."
    }
  });
  assert.equal(moderationDenied.response.status, 403);

  const moderated = await request(`/api/team-comments/${posted.payload.id}/moderation`, {
    method: "PATCH",
    role: "caseManager",
    body: {
      moderationStatus: "Approved for IEP team",
      visibility: "IEP team",
      moderationNote: "Approved for the full IEP team; staff-only reply remains restricted."
    }
  });
  assert.equal(moderated.response.status, 200);
  assert.equal(moderated.payload.moderationStatus, "Approved for IEP team");
  assert.equal(moderated.payload.visibility, "IEP team");
  assert.equal(moderated.payload.moderatedBy, "BJ Tarves");
  assert.match(moderated.payload.moderationDigest, /^[a-f0-9]{64}$/);
  assert.equal(moderated.payload.replies[0].body, replied.payload.body);
  assert.equal(moderated.payload.workspace.auditLog[0].title, "Team comment moderated");

  const parentAfterModeration = await request("/api/workspace", { role: "parent" });
  const visibleModerated = parentAfterModeration.payload.workspace.teamComments.find((comment) => comment.id === posted.payload.id);
  assert.equal(visibleModerated.visibility, "IEP team");
  assert.equal(visibleModerated.replies.length, 0);

  const familyPosted = await request("/api/team-comments", {
    method: "POST",
    role: "parent",
    body: {
      studentId: "student-001",
      targetType: "Meeting",
      targetId: "meeting-001",
      visibility: "Staff only",
      body: "Family would like the team to explain recovery minutes in plain language."
    }
  });
  assert.equal(familyPosted.response.status, 201);
  assert.equal(familyPosted.payload.visibility, "Family visible");
  assert.equal(familyPosted.payload.targetTitle, "Annual IEP");

  const queueDenied = await request("/api/team-comments/queue-reviews", {
    method: "POST",
    role: "parent",
    body: {
      studentId: "student-001",
      queueStatus: "Queue reviewed",
      notificationPlan: "Family cannot record internal moderation queue review.",
      retentionDecision: "Retain in audit trail",
      retentionBoundary: "This should be blocked.",
      reviewerNote: "Blocked.",
      nextReviewDate: "2026-06-30"
    }
  });
  assert.equal(queueDenied.response.status, 403);

  const queueReview = await request("/api/team-comments/queue-reviews", {
    method: "POST",
    role: "caseManager",
    body: {
      studentId: "student-001",
      queueStatus: "Family follow-up needed",
      notificationPlan:
        "Use in-app team follow-up only; live external threaded notifications require district notification-provider review.",
      retentionDecision: "Retain in audit trail",
      retentionBoundary:
        "Retain source-traced collaboration and queue review in the local audit trail; production retention schedule requires district approval.",
      reviewerNote:
        "Family recovery-minutes question is visible; staff-only accommodation reply remains restricted until team clarification.",
      nextReviewDate: "2026-06-30"
    }
  });
  assert.equal(queueReview.response.status, 201);
  assert.equal(queueReview.payload.queueStatus, "Family follow-up needed");
  assert.equal(queueReview.payload.reviewedBy, "BJ Tarves");
  assert.equal(queueReview.payload.reviewedByRole, "caseManager");
  assert.equal(queueReview.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.ok(queueReview.payload.commentsReviewed.some((comment) => comment.id === familyPosted.payload.id));
  assert.ok(queueReview.payload.pendingCount >= 1);
  assert.match(queueReview.payload.queueDigest, /^[a-f0-9]{64}$/);
  assert.match(queueReview.payload.officialRecordImpact, /does not change official IEP obligations/);
  assert.equal(queueReview.payload.workspace.auditLog[0].title, "Collaboration queue reviewed");

  const parentAfterQueueReview = await request("/api/workspace", { role: "parent" });
  assert.deepEqual(parentAfterQueueReview.payload.workspace.teamCommentQueueReviews, []);

  const verify = await request("/api/audit/verify", { role: "administrator" });
  assert.equal(verify.payload.valid, true);
});

test("records staff portal access reviews while hiding identity evidence from family accounts", async (t) => {
  const { request } = await withApi(t);

  const parentWorkspace = await request("/api/workspace", { role: "parent" });
  assert.equal(parentWorkspace.response.status, 200);
  assert.deepEqual(parentWorkspace.payload.workspace.portalAccessReviews, []);
  assert.deepEqual(parentWorkspace.payload.workspace.portalInvitationPackages, []);

  const readOnlyWorkspace = await request("/api/workspace", { role: "readOnlyReviewer" });
  assert.equal(readOnlyWorkspace.response.status, 200);
  assert.ok(readOnlyWorkspace.payload.workspace.portalAccessReviews.some((review) => review.id === "portal-access-review-001"));
  assert.ok(readOnlyWorkspace.payload.workspace.portalInvitationPackages.some((invitation) => invitation.id === "portal-invitation-001"));

  const parentDenied = await request("/api/portal-access-reviews", {
    method: "POST",
    role: "parent",
    body: {
      studentId: "student-001",
      subjectRole: "Parent/Guardian",
      subjectName: "Robin Lee",
      accessStatus: "Access verified",
      verificationMethod: "Phone confirmation",
      identityEvidence: "Family cannot self-certify portal identity evidence.",
      languageSupportNeeded: "No",
      privacyNote: "This should be blocked."
    }
  });
  assert.equal(parentDenied.response.status, 403);

  const reviewerDenied = await request("/api/portal-access-reviews", {
    method: "POST",
    role: "readOnlyReviewer",
    body: {
      studentId: "student-001",
      subjectRole: "Student",
      subjectName: "Jordan Lee",
      accessStatus: "Student access limited",
      verificationMethod: "Student conference",
      identityEvidence: "Read-only reviewer cannot record portal verification.",
      languageSupportNeeded: "Yes - plain-language review",
      privacyNote: "This should be blocked."
    }
  });
  assert.equal(reviewerDenied.response.status, 403);

  const parentInvitationDenied = await request("/api/portal-invitation-packages", {
    method: "POST",
    role: "parent",
    body: {
      studentId: "student-001",
      subjectRole: "Parent/Guardian",
      subjectName: "Robin Lee",
      status: "Ready to send",
      deliveryChannel: "Secure email",
      expiresAt: "2026-06-30",
      scopeSummary: "Family-visible summaries only.",
      identityVerificationSummary: "Family cannot prepare its own identity verification package.",
      languageSupportNote: "No",
      privacyBoundary: "This should be blocked.",
      providerReference: "blocked-family-request"
    }
  });
  assert.equal(parentInvitationDenied.response.status, 403);

  const recorded = await request("/api/portal-access-reviews", {
    method: "POST",
    role: "caseManager",
    body: {
      studentId: "student-001",
      subjectRole: "Student",
      subjectName: "Jordan Lee",
      accessStatus: "Student access limited",
      verificationMethod: "Student conference",
      identityEvidence: "Student account matched assigned record; self-advocacy packet visibility limited to student-facing sections.",
      languageSupportNeeded: "Yes - plain-language support during first login",
      privacyNote: "Student view excludes staff-only collaboration, internal identity evidence, and formal compliance notes."
    }
  });
  assert.equal(recorded.response.status, 201);
  assert.equal(recorded.payload.subjectRole, "Student");
  assert.equal(recorded.payload.accessStatus, "Student access limited");
  assert.equal(recorded.payload.reviewedBy, "BJ Tarves");
  assert.equal(recorded.payload.reviewedByRole, "caseManager");
  assert.equal(recorded.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.match(recorded.payload.reviewDigest, /^[a-f0-9]{64}$/);
  assert.match(recorded.payload.officialRecordImpact, /official IEP/);
  assert.equal(recorded.payload.workspace.auditLog[0].title, "Portal access reviewed");

  const invitation = await request("/api/portal-invitation-packages", {
    method: "POST",
    role: "caseManager",
    body: {
      studentId: "student-001",
      subjectRole: "Student",
      subjectName: "Jordan Lee",
      status: "Ready to send",
      deliveryChannel: "District portal invite",
      expiresAt: "2026-06-30",
      scopeSummary: "Student summary, student-visible goals, meeting packet acknowledgments, and student-visible collaboration only.",
      identityVerificationSummary:
        "Student access review confirmed assigned record and limited self-advocacy packet visibility; district identity provider must still verify before sending.",
      languageSupportNote: "Plain-language login support during first access",
      privacyBoundary: "Internal identity evidence, staff-only notes, and formal compliance review remain restricted.",
      providerReference: "demo-provider-queue-student-001"
    }
  });
  assert.equal(invitation.response.status, 201);
  assert.equal(invitation.payload.subjectRole, "Student");
  assert.equal(invitation.payload.status, "Ready to send");
  assert.equal(invitation.payload.deliveryChannel, "District portal invite");
  assert.equal(invitation.payload.preparedBy, "BJ Tarves");
  assert.equal(invitation.payload.preparedByRole, "caseManager");
  assert.equal(invitation.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.match(invitation.payload.invitationDigest, /^[a-f0-9]{64}$/);
  assert.match(invitation.payload.officialRecordImpact, /does not send a production invitation/);
  assert.equal(invitation.payload.workspace.auditLog[0].title, "Portal invitation package prepared");
  assert.ok(invitation.payload.workspace.portalInvitationPackages.some((item) => item.id === invitation.payload.id));

  const parentAfterRecord = await request("/api/workspace", { role: "parent" });
  assert.deepEqual(parentAfterRecord.payload.workspace.portalAccessReviews, []);
  assert.deepEqual(parentAfterRecord.payload.workspace.portalInvitationPackages, []);

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("tracks security sessions and administrator revocation", async (t) => {
  const { request, tokenForRole } = await withApi(t);

  const parentToken = await tokenForRole("parent");
  const administratorWorkspace = await request("/api/workspace", { role: "administrator" });
  assert.equal(administratorWorkspace.response.status, 200);
  assert.ok(administratorWorkspace.payload.workspace.securityPosture);
  assert.ok(administratorWorkspace.payload.workspace.securitySessions.some((session) => session.userName === "Robin Lee"));
  assert.ok(administratorWorkspace.payload.workspace.securitySessions.every((session) => !session.token));

  const parentSession = administratorWorkspace.payload.workspace.securitySessions.find((session) => session.userName === "Robin Lee");
  const denied = await request(`/api/security/sessions/${parentSession.id}/revoke`, {
    method: "POST",
    role: "caseManager",
    body: {
      note: "Case managers cannot revoke security sessions."
    }
  });
  assert.equal(denied.response.status, 403);
  const deniedIdentityReview = await request("/api/security/identity-lifecycle-reviews", {
    method: "POST",
    role: "caseManager",
    body: {
      identityProvider: "District SSO readiness review",
      accountLifecyclePlan: "Case managers cannot record account lifecycle reviews.",
      tenantBoundaryEvidence: "Denied before evidence is accepted.",
      roleProvisioningNote: "Denied before provisioning notes are accepted."
    }
  });
  assert.equal(deniedIdentityReview.response.status, 403);

  const revoked = await request(`/api/security/sessions/${parentSession.id}/revoke`, {
    method: "POST",
    role: "administrator",
    body: {
      note: "Parent demo session revoked after administrator access review."
    }
  });
  assert.equal(revoked.response.status, 200);
  assert.equal(revoked.payload.status, "Revoked");
  assert.equal(revoked.payload.review.status, "Revoked");
  assert.equal(revoked.payload.workspace.securityReviews[0].sessionId, parentSession.id);
  assert.equal(revoked.payload.workspace.auditLog[0].title, "Security session revoked");
  assert.equal(
    revoked.payload.workspace.securitySessions.find((session) => session.id === parentSession.id).status,
    "Revoked"
  );

  const rejected = await fetch(`${revoked.response.url.replace(/\/api\/security\/sessions\/.*$/, "")}/api/workspace`, {
    headers: { authorization: `Bearer ${parentToken}` }
  });
  assert.equal(rejected.status, 401);

  const lifecycleReview = await request("/api/security/identity-lifecycle-reviews", {
    method: "POST",
    role: "administrator",
    body: {
      identityProvider: "District SSO readiness review",
      lifecycleStatus: "SSO mapping in review",
      mfaStatus: "MFA mapping in review",
      tenantBoundaryStatus: "Cross-tenant access blocked locally",
      roleProvisioningStatus: "SIS/IdP mapping drafted",
      accountLifecyclePlan: "Provision from district IdP groups; deprovision on SIS withdrawal and staff separation.",
      tenantBoundaryEvidence: "Demo users remain scoped to Riverbend district and unauthorized student selection is denied.",
      roleProvisioningNote:
        "Map case manager, provider, family, student, school admin, district admin, and system admin groups before pilot.",
      nextReviewDate: "2026-08-01"
    }
  });
  assert.equal(lifecycleReview.response.status, 201);
  assert.equal(lifecycleReview.payload.action, "Identity lifecycle reviewed");
  assert.equal(lifecycleReview.payload.workspace.securityReviews[0].action, "Identity lifecycle reviewed");
  assert.equal(lifecycleReview.payload.workspace.securityReviews[0].tenantBoundaryStatus, "Cross-tenant access blocked locally");
  assert.equal(lifecycleReview.payload.workspace.securityReviews[0].roleProvisioningStatus, "SIS/IdP mapping drafted");
  assert.match(lifecycleReview.payload.workspace.securityReviews[0].securityDigest, /^[a-f0-9]{64}$/);
  assert.equal(lifecycleReview.payload.workspace.securityPosture.identityProvider, "District SSO readiness review");
  assert.equal(lifecycleReview.payload.workspace.securityPosture.reviewStatus, "SSO mapping in review");
  assert.equal(lifecycleReview.payload.workspace.securityPosture.roleProvisioningStatus, "SIS/IdP mapping drafted");
  assert.equal(lifecycleReview.payload.workspace.auditLog[0].title, "Identity lifecycle reviewed");
  assert.ok(lifecycleReview.payload.workspace.auditLog.some((event) => event.title === "Security session revoked"));

  const verifyResult = await request("/api/audit/verify", { role: "administrator" });
  assert.equal(verifyResult.payload.valid, true);
});

test("separates school district and system administrator role boundaries", async (t) => {
  const { request, tokenForRole } = await withApi(t);

  await tokenForRole("parent");

  const schoolWorkspace = await request("/api/workspace", { role: "schoolAdministrator" });
  assert.equal(schoolWorkspace.response.status, 200);
  assert.equal(schoolWorkspace.payload.workspace.user.role, "schoolAdministrator");
  assert.ok(schoolWorkspace.payload.workspace.students.length > 0);
  assert.ok(schoolWorkspace.payload.workspace.staffContinuity.length > 0);
  assert.equal(schoolWorkspace.payload.workspace.securityPosture, null);
  assert.deepEqual(schoolWorkspace.payload.workspace.districtConfiguration.integrationReadiness, []);

  const schoolConfigurationDenied = await request("/api/district-configuration/integrations/sis", {
    method: "PATCH",
    role: "schoolAdministrator",
    body: {
      status: "Pilot approved",
      provider: "PowerSchool SIS (planned)",
      owner: "School admin",
      nextReviewDate: "2026-09-15",
      note: "School administrators cannot update district integration readiness."
    }
  });
  assert.equal(schoolConfigurationDenied.response.status, 403);

  const continuityId = schoolWorkspace.payload.workspace.staffContinuity[0].id;
  const schoolContinuity = await request(`/api/staff-continuity/${continuityId}`, {
    method: "PATCH",
    role: "schoolAdministrator",
    body: {
      status: "Coverage assigned",
      riskLevel: "Medium",
      coverageOwner: "School coverage lead",
      nextReviewDate: "2026-07-18",
      coveragePlan: "School administrator assigned a certified coverage lead for affected service windows."
    }
  });
  assert.equal(schoolContinuity.response.status, 200);
  assert.equal(schoolContinuity.payload.reviewedByRole, "schoolAdministrator");
  assert.equal(schoolContinuity.payload.workspace.auditLog[0].title, "Staff continuity plan updated");

  const districtWorkspace = await request("/api/workspace", { role: "districtAdministrator" });
  assert.equal(districtWorkspace.response.status, 200);
  assert.equal(districtWorkspace.payload.workspace.user.role, "districtAdministrator");
  assert.ok(districtWorkspace.payload.workspace.students.length > 0);
  assert.ok(districtWorkspace.payload.workspace.districtConfiguration.integrationReadiness.length > 0);
  assert.equal(districtWorkspace.payload.workspace.securityPosture, null);

  const districtAnchorDenied = await request("/api/audit/anchors", {
    method: "POST",
    role: "districtAdministrator",
    body: {
      externalReference: "District audit vault reference pending",
      note: "District administrators cannot create platform audit anchors."
    }
  });
  assert.equal(districtAnchorDenied.response.status, 403);

  const districtSource = await request("/api/source-registry/entries", {
    method: "POST",
    role: "districtAdministrator",
    body: {
      sourceId: "pa-school-age-iep-district-admin-2026",
      title: "District administrator reviewed PA School Age IEP, 2026",
      issuingOrganization: "Riverbend School District / PaTTAN reference",
      sourceType: "Form",
      sourceFormType: "District-reviewed",
      jurisdiction: "Pennsylvania",
      programArea: "School Age",
      sourceRegistryVersion: "PA-demo-2026.08",
      effectiveDate: "2026-08-01",
      retrievedDate: "2026-06-24",
      nextReviewDate: "2026-11-01",
      url: "https://www.pattan.net/Forms/Individualized-Education-Program-IEP-1-1",
      fileTypesAvailable: "PDF, DOCX",
      productUse: "Schema, Extraction, Validation, Review",
      reviewStatus: "Current",
      reviewNote: "District administrator verified this source without changing the active intake version.",
      activate: false
    }
  });
  assert.equal(districtSource.response.status, 201);
  assert.equal(districtSource.payload.reviewedByRole, "districtAdministrator");
  assert.equal(districtSource.payload.workspace.sourceRegistry.activeSourceId, "pa-school-age-iep-non-annotated");

  const systemWorkspace = await request("/api/workspace", { role: "systemAdministrator" });
  assert.equal(systemWorkspace.response.status, 200);
  assert.equal(systemWorkspace.payload.workspace.user.role, "systemAdministrator");
  assert.equal(systemWorkspace.payload.workspace.students.length, 0);
  assert.ok(systemWorkspace.payload.workspace.securityPosture);
  assert.ok(systemWorkspace.payload.workspace.securitySessions.some((session) => session.userName === "Robin Lee"));
  assert.ok(systemWorkspace.payload.workspace.districtConfiguration.integrationReadiness.length > 0);

  const systemSourceDenied = await request("/api/source-registry/entries", {
    method: "POST",
    role: "systemAdministrator",
    body: {
      sourceId: "system-admin-source-denied",
      title: "System admin source denial",
      sourceRegistryVersion: "PA-demo-denied",
      effectiveDate: "2026-08-01",
      retrievedDate: "2026-06-24",
      nextReviewDate: "2026-11-01",
      reviewNote: "System administrators cannot administer district source entries."
    }
  });
  assert.equal(systemSourceDenied.response.status, 403);

  const parentSession = systemWorkspace.payload.workspace.securitySessions.find((session) => session.userName === "Robin Lee");
  const systemRevoked = await request(`/api/security/sessions/${parentSession.id}/revoke`, {
    method: "POST",
    role: "systemAdministrator",
    body: {
      note: "System administrator revoked the parent demo session during security review."
    }
  });
  assert.equal(systemRevoked.response.status, 200);
  assert.equal(systemRevoked.payload.review.reviewedByRole, "systemAdministrator");
  assert.equal(systemRevoked.payload.workspace.students.length, 0);
  assert.equal(systemRevoked.payload.workspace.securityReviews[0].reviewedByRole, "systemAdministrator");

  const verifyResult = await request("/api/audit/verify", { role: "systemAdministrator" });
  assert.equal(verifyResult.payload.valid, true);
});

test("creates administrator audit anchors from the verified hash chain", async (t) => {
  const { baseUrl, dataDir, request, tokenForRole } = await withApi(t);

  const denied = await request("/api/audit/anchors", {
    method: "POST",
    role: "caseManager",
    body: {
      externalReference: "District audit vault reference pending",
      note: "Case managers cannot create audit anchors."
    }
  });
  assert.equal(denied.response.status, 403);

  const before = await request("/api/audit/verify", { role: "administrator" });
  assert.equal(before.payload.valid, true);

  const anchored = await request("/api/audit/anchors", {
    method: "POST",
    role: "administrator",
    body: {
      externalReference: "District audit vault reference pending",
      note: "Anchor verified chain before sharing audit packet."
    }
  });
  assert.equal(anchored.response.status, 201);
  assert.equal(anchored.payload.status, "Anchored locally");
  assert.equal(anchored.payload.anchoredSequence, before.payload.checked);
  assert.equal(anchored.payload.anchoredHash, before.payload.latestHash);
  assert.match(anchored.payload.anchorDigest, /^[a-f0-9]{64}$/);
  assert.equal(anchored.payload.workspace.auditAnchors[0].id, anchored.payload.id);
  assert.equal(anchored.payload.workspace.auditLog[0].title, "Audit anchor created");

  const after = await request("/api/audit/verify", { role: "administrator" });
  assert.equal(after.payload.valid, true);
  assert.equal(after.payload.checked, before.payload.checked + 1);

  const timestampDenied = await request(`/api/audit/anchors/${anchored.payload.id}/external-timestamp`, {
    method: "PATCH",
    role: "caseManager",
    body: {
      provider: "District timestamp authority",
      receiptId: "TS-DENIED",
      receiptTimestamp: "2026-06-24T14:30:00.000Z",
      verificationReference: "Case manager cannot attach timestamp evidence.",
      reviewerNote: "Permission should be denied."
    }
  });
  assert.equal(timestampDenied.response.status, 403);

  const timestamped = await request(`/api/audit/anchors/${anchored.payload.id}/external-timestamp`, {
    method: "PATCH",
    role: "administrator",
    body: {
      provider: "District timestamp authority",
      receiptId: "TS-RBSD-2026-0001",
      receiptTimestamp: "2026-06-24T14:30:00.000Z",
      verificationReference: "District audit vault receipt URL pending",
      reviewerNote: "External timestamp evidence recorded after local hash-chain verification."
    }
  });
  assert.equal(timestamped.response.status, 200);
  assert.equal(timestamped.payload.status, "External timestamp recorded");
  assert.equal(timestamped.payload.externalTimestampReceipt.provider, "District timestamp authority");
  assert.equal(timestamped.payload.externalTimestampReceipt.receiptId, "TS-RBSD-2026-0001");
  assert.match(timestamped.payload.externalTimestampReceipt.receiptDigest, /^[a-f0-9]{64}$/);
  assert.match(timestamped.payload.externalTimestampReceipt.productionBoundary, /does not perform notarization/);
  assert.equal(timestamped.payload.workspace.auditAnchors[0].externalTimestampReceipt.receiptId, "TS-RBSD-2026-0001");
  assert.equal(timestamped.payload.workspace.auditLog[0].title, "External timestamp receipt recorded");

  const retentionDenied = await request("/api/audit/retention-packages", {
    method: "POST",
    role: "caseManager",
    body: {
      anchorId: anchored.payload.id,
      note: "Case managers cannot seal retention packages."
    }
  });
  assert.equal(retentionDenied.response.status, 403);

  const retained = await request("/api/audit/retention-packages", {
    method: "POST",
    role: "administrator",
    body: {
      anchorId: anchored.payload.id,
      note: "Seal verified audit evidence for district retention."
    }
  });
  assert.equal(retained.response.status, 201);
  assert.equal(retained.payload.status, "Sealed locally");
  assert.equal(retained.payload.anchorId, anchored.payload.id);
  assert.equal(retained.payload.anchoredSequence, anchored.payload.anchoredSequence);
  assert.equal(retained.payload.anchoredHash, anchored.payload.anchoredHash);
  assert.match(retained.payload.packageDigest, /^[a-f0-9]{64}$/);
  assert.match(retained.payload.artifact.fileName, /^retention-.*-audit-retention-manifest\.json$/);
  assert.ok(retained.payload.artifact.sha256);
  assert.equal(retained.payload.workspace.auditRetentionPackages[0].id, retained.payload.id);
  assert.equal(retained.payload.workspace.auditLog[0].title, "Retention package sealed");

  const manifestRaw = await readFile(join(dataDir, retained.payload.artifact.preservedPath), "utf8");
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.id, retained.payload.id);
  assert.equal(manifest.anchor.id, anchored.payload.id);
  assert.equal(manifest.auditVerification.anchoredHashMatched, true);
  assert.equal(manifest.packageDigest, retained.payload.packageDigest);
  assert.ok(manifest.evidenceDigests.workspaceSnapshotSha256);
  assert.match(manifest.productionCaveat, /WORM storage/);

  const download = await fetch(`${baseUrl}${retained.payload.downloadUrl}`, {
    headers: { authorization: `Bearer ${await tokenForRole("administrator")}` }
  });
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition"), /audit-retention-manifest/);
  assert.equal(await download.text(), manifestRaw);

  const policyDenied = await request("/api/audit/retention-policy-reviews", {
    method: "POST",
    role: "caseManager",
    body: {
      retentionPackageId: retained.payload.id,
      anchorId: anchored.payload.id,
      policyScope: "Audit trail and retention manifests",
      policySource: "Case manager cannot set district retention policy.",
      disposition: "Policy reviewed",
      retentionPeriod: "Blocked",
      legalHoldStatus: "No hold",
      archiveDecision: "Retain",
      evidenceSummary: "Blocked",
      nextReviewDate: "2026-10-15"
    }
  });
  assert.equal(policyDenied.response.status, 403);

  const policyReview = await request("/api/audit/retention-policy-reviews", {
    method: "POST",
    role: "districtAdministrator",
    body: {
      retentionPackageId: retained.payload.id,
      anchorId: anchored.payload.id,
      policyScope: "Audit trail and retention manifests",
      policySource: "Riverbend draft records schedule RBSD-RET-2026",
      disposition: "Legal hold active",
      retentionPeriod:
        "Retain local audit-chain evidence and sealed manifests until district records counsel clears the legal hold and approves archive eligibility.",
      legalHoldStatus: "Legal hold active",
      archiveDecision: "Archive blocked",
      evidenceSummary:
        "District records review links the sealed retention manifest, external timestamp receipt, WORM readiness record, and export metadata before any archive or purge decision.",
      nextReviewDate: "2026-10-15"
    }
  });
  assert.equal(policyReview.response.status, 201);
  assert.equal(policyReview.payload.policyScope, "Audit trail and retention manifests");
  assert.equal(policyReview.payload.retentionPackageId, retained.payload.id);
  assert.equal(policyReview.payload.anchorId, anchored.payload.id);
  assert.equal(policyReview.payload.legalHoldStatus, "Legal hold active");
  assert.equal(policyReview.payload.archiveDecision, "Archive blocked");
  assert.equal(policyReview.payload.reviewedBy, "A. Morales");
  assert.equal(policyReview.payload.reviewedByRole, "districtAdministrator");
  assert.equal(policyReview.payload.packageDigest, retained.payload.packageDigest);
  assert.match(policyReview.payload.policyDigest, /^[a-f0-9]{64}$/);
  assert.match(policyReview.payload.productionBoundary, /does not enforce production retention/);
  assert.equal(policyReview.payload.workspace.retentionPolicyReviews[0].id, policyReview.payload.id);
  assert.equal(policyReview.payload.workspace.auditLog[0].title, "Retention policy reviewed");

  const caseManagerWorkspace = await request("/api/workspace", { role: "caseManager" });
  assert.deepEqual(caseManagerWorkspace.payload.workspace.retentionPolicyReviews, []);
  const districtWorkspace = await request("/api/workspace", { role: "districtAdministrator" });
  assert.ok(districtWorkspace.payload.workspace.retentionPolicyReviews.some((review) => review.id === policyReview.payload.id));

  const retainedVerify = await request("/api/audit/verify", { role: "administrator" });
  assert.equal(retainedVerify.payload.valid, true);
  assert.equal(retainedVerify.payload.checked, before.payload.checked + 4);
});

test("tracks source registry version review with administrator-only updates", async (t) => {
  const { request } = await withApi(t);

  const denied = await request("/api/source-registry/pattan-special-education-gifted-forms-hub/review", {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "Update needed",
      retrievedDate: "2026-06-24",
      nextReviewDate: "2026-07-15",
      note: "Case managers cannot update the official source registry review."
    }
  });
  assert.equal(denied.response.status, 403);

  const updated = await request("/api/source-registry/pattan-special-education-gifted-forms-hub/review", {
    method: "PATCH",
    role: "administrator",
    body: {
      status: "Update needed",
      retrievedDate: "2026-06-24",
      nextReviewDate: "2026-07-15",
      note: "Review forms hub for updated companion notices before the next district release."
    }
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.sourceId, "pattan-special-education-gifted-forms-hub");
  assert.equal(updated.payload.reviewStatus, "Update needed");
  assert.equal(updated.payload.reviewedBy, "D. Nguyen");
  assert.equal(updated.payload.reviewedByRole, "administrator");
  assert.match(updated.payload.reviewNote, /companion notices/);
  assert.equal(updated.payload.workspace.sourceRegistry.reviewStatus, "Update needed");
  assert.equal(updated.payload.workspace.sourceRegistry.reviewedBy, "D. Nguyen");
  assert.equal(updated.payload.workspace.auditLog[0].title, "Source registry entry reviewed");

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("administers source registry entries and activates future source alignment", async (t) => {
  const { request } = await withApi(t);

  const denied = await request("/api/source-registry/entries", {
    method: "POST",
    role: "caseManager",
    body: {
      sourceId: "pa-school-age-iep-district-2026",
      title: "District-reviewed Pennsylvania School Age IEP, 2026",
      sourceRegistryVersion: "PA-demo-2026.07",
      effectiveDate: "2026-07-01",
      retrievedDate: "2026-06-24",
      nextReviewDate: "2026-10-01",
      reviewNote: "Case manager cannot administer district source registry entries."
    }
  });
  assert.equal(denied.response.status, 403);

  const saved = await request("/api/source-registry/entries", {
    method: "POST",
    role: "administrator",
    body: {
      sourceId: "pa-school-age-iep-district-2026",
      title: "District-reviewed Pennsylvania School Age IEP, 2026",
      issuingOrganization: "Riverbend School District / PaTTAN reference",
      sourceType: "Form",
      sourceFormType: "District-reviewed",
      jurisdiction: "Pennsylvania",
      programArea: "School Age",
      sourceRegistryVersion: "PA-demo-2026.07",
      effectiveDate: "2026-07-01",
      retrievedDate: "2026-06-24",
      nextReviewDate: "2026-10-01",
      url: "https://www.pattan.net/Forms/Individualized-Education-Program-IEP-1-1",
      fileTypesAvailable: "PDF, DOCX",
      languagesAvailable: "English, Spanish, Arabic",
      languageAvailabilityNote: "District language-access lead verified translated packet availability before sharing family summaries.",
      productUse: "Schema, Extraction, Validation, Review, Export",
      reviewStatus: "Current",
      reviewNote: "District administrator verified this source for future source-aligned workflows.",
      activate: true
    }
  });
  assert.equal(saved.response.status, 201);
  assert.equal(saved.payload.sourceId, "pa-school-age-iep-district-2026");
  assert.equal(saved.payload.activated, true);
  assert.deepEqual(saved.payload.fileTypesAvailable, ["PDF", "DOCX"]);
  assert.deepEqual(saved.payload.languagesAvailable, ["English", "Spanish", "Arabic"]);
  assert.match(saved.payload.languageAvailabilityNote, /language-access lead/);
  assert.deepEqual(saved.payload.productUse, ["Schema", "Extraction", "Validation", "Review", "Export"]);
  assert.equal(saved.payload.workspace.sourceRegistry.activeSourceId, "pa-school-age-iep-district-2026");
  assert.equal(saved.payload.workspace.sourceRegistry.sourceRegistryVersion, "PA-demo-2026.07");
  assert.equal(saved.payload.workspace.sourceRegistry.reviewedBy, "D. Nguyen");
  assert.equal(saved.payload.workspace.auditLog[0].title, "Source registry entry saved");

  const intake = await request("/api/intake", {
    method: "POST",
    role: "caseManager",
    body: {
      studentId: "student-001",
      name: "District_Source_Check.txt",
      sourceText: "Present levels: Jordan reads with 70% accuracy. Goal: Jordan will answer questions with at least 80% accuracy. Service: Reading support 30 minutes weekly."
    }
  });
  assert.equal(intake.response.status, 201);
  assert.equal(intake.payload.document.sourceAlignment.sourceId, "pa-school-age-iep-district-2026");
  assert.equal(intake.payload.document.sourceAlignment.sourceRegistryVersion, "PA-demo-2026.07");
  assert.deepEqual(intake.payload.document.sourceAlignment.languagesAvailable, ["English", "Spanish", "Arabic"]);
  assert.equal(intake.payload.extractionSections[0].sourceAlignment.sourceId, "pa-school-age-iep-district-2026");

  const verifyResult = await request("/api/audit/verify", { role: "administrator" });
  assert.equal(verifyResult.payload.valid, true);
});

test("tracks district integration readiness with administrator-only configuration updates", async (t) => {
  const { request } = await withApi(t);

  const denied = await request("/api/district-configuration/integrations/sis", {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "Readiness review",
      provider: "PowerSchool SIS (planned)",
      owner: "Data services lead",
      nextReviewDate: "2026-09-15",
      note: "Case manager cannot update district integration readiness."
    }
  });
  assert.equal(denied.response.status, 403);

  const updated = await request("/api/district-configuration/integrations/sis", {
    method: "PATCH",
    role: "administrator",
    body: {
      status: "Pilot approved",
      provider: "PowerSchool SIS (planned)",
      owner: "Data services lead",
      nextReviewDate: "2026-09-15",
      note: "Pilot mapping approved for student identifiers, school assignment, guardian links, and caseload scope."
    }
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.id, "sis");
  assert.equal(updated.payload.status, "Pilot approved");
  assert.equal(updated.payload.provider, "PowerSchool SIS (planned)");
  assert.equal(updated.payload.reviewedByRole, "administrator");
  assert.match(updated.payload.configurationReview.configurationDigest, /^[a-f0-9]{64}$/);
  assert.equal(updated.payload.workspace.districtConfiguration.integrationReadiness.find((item) => item.id === "sis").status, "Pilot approved");
  assert.equal(updated.payload.workspace.districtConfiguration.configurationReviews[0].integrationId, "sis");
  assert.equal(updated.payload.workspace.auditLog[0].title, "District integration readiness updated");

  const dataProtectionDenied = await request("/api/district-configuration/data-protection/encryption-at-rest", {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "Readiness review",
      control: "Case manager cannot update encryption readiness.",
      owner: "Information security lead",
      nextReviewDate: "2026-10-15",
      evidenceNote: "Unauthorized staff cannot record data-protection readiness evidence.",
      productionBoundary: "Production encryption governance remains administrator-only."
    }
  });
  assert.equal(dataProtectionDenied.response.status, 403);

  const dataProtectionUpdated = await request("/api/district-configuration/data-protection/encryption-at-rest", {
    method: "PATCH",
    role: "administrator",
    body: {
      status: "Readiness review",
      control: "KMS-backed database and object-store encryption design queued for district security review.",
      owner: "Information security lead",
      nextReviewDate: "2026-10-15",
      evidenceNote: "Security lead documented key rotation, encrypted backup, and access-log evidence needed before live IEP storage.",
      productionBoundary: "Local JSON files remain demo storage and are not the production encryption control."
    }
  });
  assert.equal(dataProtectionUpdated.response.status, 200);
  assert.equal(dataProtectionUpdated.payload.id, "encryption-at-rest");
  assert.equal(dataProtectionUpdated.payload.status, "Readiness review");
  assert.equal(dataProtectionUpdated.payload.reviewedByRole, "administrator");
  assert.match(dataProtectionUpdated.payload.configurationReview.dataProtectionDigest, /^[a-f0-9]{64}$/);
  assert.equal(
    dataProtectionUpdated.payload.workspace.districtConfiguration.dataProtectionReadiness.find((item) => item.id === "encryption-at-rest").owner,
    "Information security lead"
  );
  assert.equal(dataProtectionUpdated.payload.workspace.districtConfiguration.configurationReviews[0].controlId, "encryption-at-rest");
  assert.equal(dataProtectionUpdated.payload.workspace.auditLog[0].title, "Data protection readiness updated");

  const caseManagerWorkspace = await request("/api/workspace", { role: "caseManager" });
  assert.equal(caseManagerWorkspace.payload.workspace.districtConfiguration.districtName, "Riverbend School District");
  assert.deepEqual(caseManagerWorkspace.payload.workspace.districtConfiguration.integrationReadiness, []);
  assert.deepEqual(caseManagerWorkspace.payload.workspace.districtConfiguration.dataProtectionReadiness, []);

  const verifyResult = await request("/api/audit/verify", { role: "administrator" });
  assert.equal(verifyResult.payload.valid, true);
});

test("tracks accessibility remediation findings with VPAT-style evidence", async (t) => {
  const { request } = await withApi(t);

  const denied = await request("/api/accessibility/findings/screen-reader-announcements", {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "Ready for retest",
      severity: "High",
      owner: "Accessibility reviewer",
      dueDate: "2026-09-01",
      assistiveTechnology: "NVDA and VoiceOver",
      remediationPlan: "Case manager cannot update accessibility remediation.",
      verificationNote: "No verification."
    }
  });
  assert.equal(denied.response.status, 403);

  const updated = await request("/api/accessibility/findings/screen-reader-announcements", {
    method: "PATCH",
    role: "administrator",
    body: {
      status: "Ready for retest",
      severity: "High",
      owner: "Accessibility reviewer",
      dueDate: "2026-09-01",
      assistiveTechnology: "NVDA and VoiceOver",
      remediationPlan: "Run screen-reader passes for save, blocked-action, export, role-switch, and API fallback announcements.",
      verificationNote: "Ready for assistive-technology retest with transcript evidence."
    }
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.id, "screen-reader-announcements");
  assert.equal(updated.payload.status, "Ready for retest");
  assert.equal(updated.payload.severity, "High");
  assert.equal(updated.payload.reviewedByRole, "administrator");
  assert.match(updated.payload.accessibilityReview.accessibilityDigest, /^[a-f0-9]{64}$/);
  assert.equal(
    updated.payload.workspace.accessibilityCertification.findings.find((finding) => finding.id === "screen-reader-announcements").status,
    "Ready for retest"
  );
  assert.equal(updated.payload.workspace.accessibilityCertification.reviews[0].findingId, "screen-reader-announcements");
  assert.equal(updated.payload.workspace.auditLog[0].title, "Accessibility finding updated");

  const verifyResult = await request("/api/audit/verify", { role: "administrator" });
  assert.equal(verifyResult.payload.valid, true);
});

test("records summary sharing and handouts with role-aware audience restrictions", async (t) => {
  const { request } = await withApi(t);

  const parentDenied = await request("/api/summaries/teacher/handout", {
    method: "POST",
    role: "parent"
  });
  assert.equal(parentDenied.response.status, 403);

  const copied = await request("/api/summaries/parent/copy", {
    method: "POST",
    role: "parent"
  });
  assert.equal(copied.response.status, 200);
  assert.equal(copied.payload.audience, "parent");
  assert.equal(copied.payload.label, "Family view");
  assert.ok(copied.payload.workspace.summaries.parent.sections.some((section) => section.heading === "What changed from the previous IEP"));
  assert.equal(copied.payload.workspace.auditLog[0].title, "Summary copied");

  const parentHandout = await request("/api/summaries/parent/handout", {
    method: "POST",
    role: "parent"
  });
  assert.equal(parentHandout.response.status, 201);
  assert.equal(parentHandout.payload.audience, "parent");
  assert.equal(parentHandout.payload.createdBy, "Robin Lee");
  assert.equal(parentHandout.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.ok(parentHandout.payload.questions.length > 0);
  const changeSection = parentHandout.payload.sections.find((section) => section.heading === "What changed from the previous IEP");
  assert.match(changeSection.sourceReference, /Prior IEP comparison/);
  assert.match(changeSection.bullets.join(" "), /missed speech-language minutes/);
  assert.ok(parentHandout.payload.coverageItems.some((item) => item.label === "What each goal means"));
  assert.ok(parentHandout.payload.coverageItems.some((item) => item.label === "Questions for next meeting"));
  assert.ok(parentHandout.payload.coverageItems.some((item) => item.label === "What changed from the previous IEP"));
  assert.equal(parentHandout.payload.workspace.summaryHandouts[0].audience, "parent");
  assert.equal(parentHandout.payload.workspace.auditLog[0].title, "Meeting handout generated");

  const teacherHandout = await request("/api/summaries/teacher/handout", {
    method: "POST",
    role: "generalEducation"
  });
  assert.equal(teacherHandout.response.status, 201);
  assert.equal(teacherHandout.payload.audience, "teacher");
  assert.equal(teacherHandout.payload.createdBy, "Leah Kim");
  assert.ok(teacherHandout.payload.sections.some((section) => section.heading === "Assessment accommodations"));
  assert.ok(teacherHandout.payload.sections.some((section) => section.heading === "Important dates"));
  assert.ok(teacherHandout.payload.coverageItems.some((item) => item.label === "Data collection responsibilities"));
  assert.ok(teacherHandout.payload.coverageItems.some((item) => item.label === "Assessment accommodations"));
  assert.deepEqual(teacherHandout.payload.workspace.summaryHandouts.map((handout) => handout.audience), ["teacher"]);

  const reviewerHandout = await request("/api/summaries/administrator/handout", {
    method: "POST",
    role: "administrator"
  });
  assert.equal(reviewerHandout.response.status, 201);
  assert.equal(reviewerHandout.payload.audience, "administrator");
  assert.ok(reviewerHandout.payload.sections.some((section) => section.heading === "Missing sections"));
  assert.ok(reviewerHandout.payload.sections.some((section) => section.heading === "Placement rationale"));
  assert.ok(reviewerHandout.payload.coverageItems.some((item) => item.label === "Compliance flags"));
  assert.ok(reviewerHandout.payload.coverageItems.some((item) => item.label === "Ambiguous services"));

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("records family summary understanding checks with staff follow-up", async (t) => {
  const { request } = await withApi(t);

  const teacherDenied = await request("/api/summaries/parent/comprehension-checks", {
    method: "POST",
    role: "generalEducation",
    body: {
      sectionHeading: "What changed from the previous IEP",
      understandingStatus: "Needs explanation",
      questionOrNote: "Teacher cannot submit a family understanding check.",
      preferredFollowUp: "N/A"
    }
  });
  assert.equal(teacherDenied.response.status, 403);

  const submitted = await request("/api/summaries/parent/comprehension-checks", {
    method: "POST",
    role: "parent",
    body: {
      sectionHeading: "What changed from the previous IEP",
      understandingStatus: "Interpreter review requested",
      language: "Spanish",
      questionOrNote: "Please explain how missed speech-language minutes will be recovered before the annual review.",
      preferredFollowUp: "Discuss with an interpreter before the meeting packet is finalized."
    }
  });
  assert.equal(submitted.response.status, 201);
  assert.match(submitted.payload.id, /^comprehension-/);
  assert.equal(submitted.payload.audience, "parent");
  assert.equal(submitted.payload.submittedBy, "Robin Lee");
  assert.equal(submitted.payload.submittedByRole, "parent");
  assert.equal(submitted.payload.understandingStatus, "Interpreter review requested");
  assert.equal(submitted.payload.language, "Spanish");
  assert.equal(submitted.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.match(submitted.payload.officialRecordImpact, /does not amend the official IEP/);
  assert.equal(submitted.payload.workspace.summaryComprehensionChecks[0].id, submitted.payload.id);
  assert.equal(submitted.payload.workspace.auditLog[0].title, "Understanding check submitted");

  const parentReviewDenied = await request(`/api/summary-comprehension-checks/${submitted.payload.id}`, {
    method: "PATCH",
    role: "parent",
    body: {
      reviewStatus: "Team response recorded",
      response: "Parent cannot record the team response.",
      nextStep: "N/A"
    }
  });
  assert.equal(parentReviewDenied.response.status, 403);

  const reviewed = await request(`/api/summary-comprehension-checks/${submitted.payload.id}`, {
    method: "PATCH",
    role: "caseManager",
    body: {
      reviewStatus: "Interpreter follow-up scheduled",
      response: "The team will explain service recovery with interpreter support before the meeting.",
      nextStep: "Case manager will send the recovery owner and date by Friday."
    }
  });
  assert.equal(reviewed.response.status, 200);
  assert.equal(reviewed.payload.reviewStatus, "Interpreter follow-up scheduled");
  assert.equal(reviewed.payload.reviewedBy, "BJ Tarves");
  assert.equal(reviewed.payload.reviewedByRole, "caseManager");
  assert.match(reviewed.payload.reviewDigest, /^[a-f0-9]{64}$/);
  assert.equal(reviewed.payload.workspace.auditLog[0].title, "Understanding response recorded");

  const parentWorkspace = await request("/api/workspace", { role: "parent" });
  assert.equal(parentWorkspace.response.status, 200);
  assert.ok(parentWorkspace.payload.workspace.summaryComprehensionChecks.some((check) => check.id === submitted.payload.id));

  const studentWorkspace = await request("/api/workspace", { role: "student" });
  assert.equal(studentWorkspace.response.status, 200);
  assert.ok(!studentWorkspace.payload.workspace.summaryComprehensionChecks.some((check) => check.id === submitted.payload.id));

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("reviews previous and current IEP version comparisons with role visibility", async (t) => {
  const { request } = await withApi(t);

  const studentWorkspace = await request("/api/workspace", { role: "student" });
  assert.equal(studentWorkspace.response.status, 200);
  assert.ok(studentWorkspace.payload.workspace.iepComparisons.some((comparison) => comparison.id === "comparison-reading-goal"));
  assert.ok(!studentWorkspace.payload.workspace.iepComparisons.some((comparison) => comparison.id === "comparison-service-recovery"));

  const createDenied = await request("/api/iep-comparisons", {
    method: "POST",
    role: "parent",
    body: {
      section: "Services",
      changeType: "Parent attempted comparison",
      title: "Parent cannot create comparison",
      previousText: "Previous language",
      currentText: "Current language",
      implementationImpact: "Impact",
      familySummary: "Summary",
      amendmentReviewStatus: "Amendment review needed",
      amendmentNote: "Denied roles cannot create comparison items."
    }
  });
  assert.equal(createDenied.response.status, 403);

  const autoDenied = await request("/api/iep-comparisons/auto-diff", {
    method: "POST",
    role: "parent",
    body: {
      previousDocumentLabel: "Prior IEP",
      currentDocumentLabel: "Current IEP",
      previousText: "Goal: parent cannot generate comparison candidates.",
      currentText: "Goal: parent still cannot generate comparison candidates."
    }
  });
  assert.equal(autoDenied.response.status, 403);

  const autoGenerated = await request("/api/iep-comparisons/auto-diff", {
    method: "POST",
    role: "caseManager",
    body: {
      previousDocumentLabel: "Jordan prior IEP",
      currentDocumentLabel: "Jordan current IEP",
      previousText:
        "Goal: Jordan will improve reading comprehension with teacher support. Service: Reading support 30 minutes weekly in a pull-out small group. Accommodation: Extended time as needed.",
      currentText:
        "Goal: Jordan will answer literal and inferential questions with 80% accuracy across weekly probes. Service: Reading support 30 minutes weekly in the general education classroom. Accommodation: Extended time 1.5x for classroom assessments."
    }
  });
  assert.equal(autoGenerated.response.status, 201);
  assert.ok(autoGenerated.payload.generatedCount >= 3);
  assert.equal(autoGenerated.payload.comparisons[0].status, "Needs team review");
  assert.equal(autoGenerated.payload.comparisons[0].versionIntake.intakeMethod, "Automated prior/current text diff");
  assert.equal(autoGenerated.payload.comparisons[0].versionIntake.previousDocumentLabel, "Jordan prior IEP");
  assert.match(autoGenerated.payload.comparisons[0].comparisonDigest, /^[a-f0-9]{64}$/);
  assert.match(autoGenerated.payload.comparisons[0].officialRecordImpact, /does not amend the official IEP/);
  assert.ok(autoGenerated.payload.comparisons.some((comparison) => comparison.section === "Goals and progress monitoring"));
  assert.ok(autoGenerated.payload.comparisons.some((comparison) => comparison.section === "Services"));
  assert.ok(autoGenerated.payload.comparisons.some((comparison) => comparison.section === "Accommodations"));
  assert.equal(autoGenerated.payload.workspace.auditLog[0].title, "IEP auto-diff candidates generated");

  const created = await request("/api/iep-comparisons", {
    method: "POST",
    role: "caseManager",
    body: {
      section: "Services",
      changeType: "Prior/current language comparison",
      title: "Service location changed from pull-out to classroom support",
      previousText: "Previous IEP listed reading support in a pull-out small-group setting.",
      currentText: "Current IEP lists reading support delivered in the general education classroom with weekly probes.",
      implementationImpact: "General education teachers need to know the support now happens during classroom instruction.",
      familySummary: "Reading support is now described as happening in class, so the team should explain how it will be delivered.",
      sourceReference: "Prior/current IEP version intake - services",
      amendmentReviewStatus: "Amendment review needed",
      amendmentNote: "Team must confirm whether this language reflects an official amendment or a new annual IEP.",
      familyVisible: true,
      studentVisible: true
    }
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.status, "Needs team review");
  assert.equal(created.payload.reviewedBy, "");
  assert.equal(created.payload.versionIntake.createdBy, "BJ Tarves");
  assert.equal(created.payload.amendmentReviewStatus, "Amendment review needed");
  assert.match(created.payload.amendmentNote, /official amendment/);
  assert.match(created.payload.comparisonDigest, /^[a-f0-9]{64}$/);
  assert.match(created.payload.officialRecordImpact, /does not amend the official IEP/);
  assert.equal(created.payload.workspace.auditLog[0].title, "IEP comparison added");

  const parentDenied = await request("/api/iep-comparisons/comparison-service-recovery", {
    method: "PATCH",
    role: "parent",
    body: {
      status: "Reviewed for meeting",
      reviewNote: "Parent cannot mark comparison reviews.",
      familyVisible: true,
      studentVisible: false
    }
  });
  assert.equal(parentDenied.response.status, 403);

  const reviewed = await request("/api/iep-comparisons/comparison-service-recovery", {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "Reviewed for meeting",
      reviewNote: "Recovery comparison reviewed for the meeting packet and family summary.",
      familyVisible: true,
      studentVisible: false
    }
  });
  assert.equal(reviewed.response.status, 200);
  assert.equal(reviewed.payload.status, "Reviewed for meeting");
  assert.equal(reviewed.payload.reviewedBy, "BJ Tarves");
  assert.match(reviewed.payload.comparisonDigest, /^[a-f0-9]{64}$/);
  assert.match(reviewed.payload.officialRecordImpact, /official IEP obligations/);
  assert.equal(reviewed.payload.workspace.auditLog[0].title, "IEP comparison reviewed");

  const parentWorkspace = await request("/api/workspace", { role: "parent" });
  const parentComparison = parentWorkspace.payload.workspace.iepComparisons.find((comparison) => comparison.id === "comparison-service-recovery");
  assert.equal(parentComparison.status, "Reviewed for meeting");
  assert.match(parentComparison.reviewNote, /family summary/);
  assert.ok(parentWorkspace.payload.workspace.iepComparisons.some((comparison) => comparison.id === created.payload.id));
  assert.ok(parentWorkspace.payload.workspace.iepComparisons.some((comparison) => comparison.versionIntake?.intakeMethod === "Automated prior/current text diff"));

  const studentAfterCreate = await request("/api/workspace", { role: "student" });
  assert.ok(studentAfterCreate.payload.workspace.iepComparisons.some((comparison) => comparison.id === created.payload.id));
  assert.ok(studentAfterCreate.payload.workspace.iepComparisons.some((comparison) => comparison.section === "Goals and progress monitoring" && comparison.versionIntake?.intakeMethod === "Automated prior/current text diff"));

  const verifyResult = await request("/api/audit/verify", { role: "administrator" });
  assert.equal(verifyResult.payload.valid, true);
});

test("enforces upload permission and persists document intake with extraction output", async (t) => {
  const { request } = await withApi(t);

  const denied = await request("/api/intake", {
    method: "POST",
    role: "parent",
    body: { name: "Parent_Attempt.txt", sourceText: "Goal: test" }
  });
  assert.equal(denied.response.status, 403);

  const intake = await request("/api/intake", {
    method: "POST",
    body: {
      studentId: "student-001",
      name: "Jordan_Lee_Reevaluation.txt",
      documentType: "Text",
      sourceText:
        "Present levels: Jordan reads with 70% accuracy. Goal: Jordan will answer questions with at least 80% accuracy across three probes. Service: Reading support 30 minutes one time per week in a small group. Accommodation: Extended time as needed."
    }
  });
  assert.equal(intake.response.status, 201);
  assert.equal(intake.payload.document.name, "Jordan_Lee_Reevaluation.txt");
  assert.equal(intake.payload.document.preserved, true);
  assert.equal(intake.payload.document.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.equal(intake.payload.document.sourceAlignment.sourceFormType, "Non-Annotated");
  assert.ok(intake.payload.extractionSections.length >= 4);
  assert.equal(intake.payload.extractionSections[0].sourceAlignment.sourceRegistryVersion, "PA-demo-2026.06");
  assert.deepEqual(
    intake.payload.extractionSections.map((section) => section.key),
    [
      "currentPerformance.detected",
      "goalsAndObjectives.detected",
      "services.detected",
      "accommodations.detected"
    ]
  );

  const workspace = await request("/api/workspace");
  assert.equal(workspace.payload.workspace.documents[0].name, "Jordan_Lee_Reevaluation.txt");
  assert.equal(workspace.payload.workspace.documents[0].sourceAlignment.programArea, "School Age");
  assert.equal(workspace.payload.workspace.extractionSections[0].title, "Detected present levels");

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("persists edited extracted fields into the approved structured record", async (t) => {
  const { request } = await withApi(t);

  const intake = await request("/api/intake", {
    method: "POST",
    body: {
      studentId: "student-001",
      name: "Jordan_Extraction_Edit.txt",
      documentType: "Text",
      sourceText:
        "Present levels: Jordan reads with 70% accuracy. Goal: Jordan will answer questions with at least 80% accuracy across three probes. Service: Speech-language support 30 minutes one time per week in a small group with the speech-language pathologist. Accommodation: Extended time as needed."
    }
  });
  const section = intake.payload.extractionSections.find((item) => item.key === "goalsAndObjectives.detected");
  const serviceSection = intake.payload.extractionSections.find((item) => item.key === "services.detected");
  const accommodationSection = intake.payload.extractionSections.find((item) => item.key === "accommodations.detected");

  const parentDenied = await request(`/api/extraction/${section.id}`, {
    method: "PATCH",
    role: "parent",
    body: {
      content: "Family cannot edit official extracted fields."
    }
  });
  assert.equal(parentDenied.response.status, 403);

  const edited = await request(`/api/extraction/${section.id}`, {
    method: "PATCH",
    body: {
      content:
        "Edited annual goal: Jordan will answer inferential questions with 80% accuracy across three weekly probes using the approved organizer."
    }
  });
  assert.equal(edited.response.status, 200);
  assert.equal(edited.payload.status, "Needs review");
  assert.equal(edited.payload.editedBy, "BJ Tarves");
  assert.equal(edited.payload.editedByRole, "caseManager");
  assert.match(edited.payload.priorContent, /Jordan will answer questions/);

  const approved = await request("/api/extraction/approve", { method: "POST" });
  assert.equal(approved.response.status, 200);
  const activeIep = approved.payload.workspace.ieps.find((iep) => iep.id === "iep-001");
  const structuredGoal = activeIep.structuredRecord.goalsAndObjectives.find(
    (goal) => goal.extractionSectionId === section.id
  );
  assert.match(structuredGoal.annualGoal, /Edited annual goal/);
  assert.equal(structuredGoal.editedBy, "BJ Tarves");
  assert.equal(structuredGoal.reviewStatus, "Confirmed");
  assert.match(structuredGoal.sourceReference, /text segment/);
  const structuredProgress = activeIep.structuredRecord.progressMonitoring.find(
    (progress) => progress.extractionSectionId === section.id
  );
  assert.equal(structuredProgress.measurementMethod, "Source-aligned probe");

  const derivedGoal = approved.payload.workspace.goals.find((goal) => goal.extractionSectionId === section.id);
  assert.match(derivedGoal.annualGoal, /Edited annual goal/);
  assert.equal(derivedGoal.progressSchedule.status, "Due soon");
  const progressTask = approved.payload.workspace.tasks.find(
    (task) => task.extractionSectionId === section.id && task.sourceSection === "Progress Monitoring"
  );
  assert.match(progressTask.description, /Edited annual goal/);
  assert.equal(progressTask.evidenceRequired, true);

  const derivedService = approved.payload.workspace.services.find((service) => service.extractionSectionId === serviceSection.id);
  assert.equal(derivedService.serviceType, "Speech-language support");
  assert.equal(derivedService.duration, 30);
  assert.equal(derivedService.location, "Small group");
  assert.equal(derivedService.startDate, activeIep.startDate);
  assert.equal(derivedService.endDate, activeIep.endDate);
  assert.equal(derivedService.evidenceRequired, true);
  assert.match(derivedService.loggingRequirement, /Service delivery minutes/);
  const structuredService = activeIep.structuredRecord.services.find((service) => service.extractionSectionId === serviceSection.id);
  assert.equal(structuredService.startDate, activeIep.startDate);
  assert.equal(structuredService.endDate, activeIep.endDate);
  assert.equal(structuredService.evidenceRequired, true);
  const serviceTask = approved.payload.workspace.tasks.find(
    (task) => task.extractionSectionId === serviceSection.id && task.sourceSection === "Services"
  );
  assert.equal(serviceTask.responsibleRole, "Related Service Provider");
  assert.match(serviceTask.description, /Track minutes/);

  const derivedAccommodation = approved.payload.workspace.accommodations.find(
    (accommodation) => accommodation.extractionSectionId === accommodationSection.id
  );
  assert.match(derivedAccommodation.description, /Extended time/);
  assert.equal(derivedAccommodation.startDate, activeIep.startDate);
  assert.equal(derivedAccommodation.endDate, activeIep.endDate);
  assert.equal(derivedAccommodation.evidenceRequired, Boolean(accommodationSection.warning));
  const structuredAccommodation = activeIep.structuredRecord.accommodations.find(
    (accommodation) => accommodation.extractionSectionId === accommodationSection.id
  );
  assert.equal(structuredAccommodation.startDate, activeIep.startDate);
  assert.equal(structuredAccommodation.endDate, activeIep.endDate);
  assert.equal(structuredAccommodation.evidenceRequired, Boolean(accommodationSection.warning));
  const accommodationTask = approved.payload.workspace.tasks.find(
    (task) => task.extractionSectionId === accommodationSection.id && task.sourceSection === "Accommodations"
  );
  assert.equal(accommodationTask.responsibleRole, "General Education Teacher");
  const parentSummaryText = approved.payload.workspace.summaries.parent.sections
    .flatMap((summarySection) => [summarySection.text, ...(summarySection.bullets || [])])
    .join(" ");
  assert.match(parentSummaryText, /Edited annual goal/);
  assert.match(parentSummaryText, /Speech-language support/);
  assert.ok(approved.payload.workspace.summaries.parent.sections.some((section) => section.heading === "What each goal means"));
  assert.ok(approved.payload.workspace.summaries.parent.sections.some((section) => section.heading === "Questions for next meeting"));
  assert.ok(approved.payload.workspace.summaries.parent.coverageItems.some((item) => item.label === "How progress is measured"));
  const teacherSummaryText = approved.payload.workspace.summaries.teacher.sections
    .flatMap((summarySection) => [summarySection.text, ...(summarySection.bullets || [])])
    .join(" ");
  assert.match(teacherSummaryText, /Source-aligned probe/);
  assert.match(teacherSummaryText, /Track|Speech-language support|extended time/i);
  assert.ok(approved.payload.workspace.summaries.teacher.sections.some((section) => section.heading === "Assessment accommodations"));
  assert.ok(approved.payload.workspace.summaries.teacher.sections.some((section) => section.heading === "Important dates"));
  assert.ok(approved.payload.workspace.summaries.student.sections.some((section) => section.heading === "Transition activities"));
  assert.ok(approved.payload.workspace.summaries.administrator.sections.some((section) => section.heading === "Compliance flags"));
  assert.deepEqual(approved.payload.workspace.auditLog.slice(0, 3).map((event) => event.title), [
    "Role-specific summaries refreshed",
    "Implementation tasks created",
    "Structured extraction approved"
  ]);
  assert.equal(approved.payload.workspace.auditLog[0].type, "AI-generated summaries");
  assert.equal(approved.payload.workspace.auditLog[1].type, "Tasks created");

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("supports extraction rejection and regeneration while blocking family edits", async (t) => {
  const { request } = await withApi(t);

  const intake = await request("/api/intake", {
    method: "POST",
    body: {
      studentId: "student-001",
      name: "Jordan_Extraction_Review.txt",
      documentType: "Text",
      sourceText:
        "Present levels: Jordan reads with 70% accuracy. Goal: Jordan will answer questions with at least 80% accuracy across three probes. Service: Reading support 30 minutes one time per week in a small group. Accommodation: Extended time as needed."
    }
  });
  const sectionId = intake.payload.extractionSections.find((section) => section.key === "goalsAndObjectives.detected").id;

  const parentDenied = await request(`/api/extraction/${sectionId}/reject`, {
    method: "POST",
    role: "parent",
    body: { reason: "Family cannot reject official extraction sections." }
  });
  assert.equal(parentDenied.response.status, 403);

  const rejected = await request(`/api/extraction/${sectionId}/reject`, {
    method: "POST",
    body: { reason: "Goal text needs a cleaner source-grounded extraction." }
  });
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.payload.status, "Rejected");
  assert.equal(rejected.payload.rejectedBy, "BJ Tarves");
  assert.match(rejected.payload.rejectionReason, /cleaner/);

  const regenerated = await request(`/api/extraction/${sectionId}/regenerate`, {
    method: "POST",
    body: { guidance: "Focus on measurable annual goal language." }
  });
  assert.equal(regenerated.response.status, 200);
  assert.equal(regenerated.payload.status, "Needs review");
  assert.equal(regenerated.payload.regeneratedBy, "BJ Tarves");
  assert.match(regenerated.payload.priorContent, /Jordan will answer questions/);
  assert.match(regenerated.payload.regenerationGuidance, /measurable annual goal/);
  assert.equal(regenerated.payload.workspace.auditLog[0].title, "Extraction section regenerated");

  const approved = await request("/api/extraction/approve", { method: "POST" });
  assert.equal(approved.response.status, 200);
  const persisted = approved.payload.workspace.extractionSections.find((section) => section.id === sectionId);
  assert.equal(persisted.status, "Confirmed");
  assert.equal(persisted.priorContent, regenerated.payload.priorContent);

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("parses uploaded DOCX files and preserves original source bytes", async (t) => {
  const { dataDir, request } = await withApi(t);
  const docxBuffer = createDocxBuffer([
    "Present levels: Jordan reads with 70% accuracy using an organizer.",
    "Goal: Jordan will answer inferential questions with at least 80% accuracy across three probes.",
    "Service: Reading support 30 minutes one time per week in a small group.",
    "Accommodation: Extended time as needed for classroom assessments."
  ]);

  const intake = await request("/api/intake", {
    method: "POST",
    body: {
      studentId: "student-001",
      name: "Jordan_Lee_Source.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileBase64: docxBuffer.toString("base64")
    }
  });

  assert.equal(intake.response.status, 201);
  assert.equal(intake.payload.document.type, "DOCX");
  assert.equal(intake.payload.document.extractionMethod, "docx-word-xml");
  assert.match(intake.payload.document.sourceText, /Present levels/);
  assert.equal(intake.payload.document.sourceSegments[1].label, "paragraph 2");
  assert.ok(intake.payload.document.originalFile.sha256);
  assert.match(intake.payload.extractionSections[0].sourceReference, /paragraph 1/);

  const preserved = await readFile(join(dataDir, intake.payload.document.originalFile.preservedPath));
  assert.equal(Buffer.compare(preserved, docxBuffer), 0);
});

test("parses uploaded PDFs with page-aware source references", async (t) => {
  const { dataDir, request } = await withApi(t);
  const pdf = createExportArtifact({
    id: "source-fixture",
    label: "Jordan Lee PDF IEP",
    format: "pdf",
    payload: {
      sections: [
        {
          heading: "Present Levels",
          bullets: ["Present levels: Jordan reads with 70% accuracy using an organizer."]
        },
        {
          heading: "Annual Goal",
          bullets: ["Goal: Jordan will answer inferential questions with at least 80% accuracy across three probes."]
        },
        {
          heading: "Services and Supports",
          bullets: ["Service: Reading support 30 minutes one time per week in a small group."]
        },
        {
          heading: "Accommodations",
          bullets: ["Accommodation: Extended time as needed for classroom assessments."]
        }
      ]
    }
  });

  const intake = await request("/api/intake", {
    method: "POST",
    body: {
      studentId: "student-001",
      name: "Jordan_Lee_Page_Anchored.pdf",
      mimeType: "application/pdf",
      fileBase64: pdf.buffer.toString("base64")
    }
  });

  assert.equal(intake.response.status, 201);
  assert.equal(intake.payload.document.type, "PDF");
  assert.equal(intake.payload.document.extractionMethod, "pdf-embedded-text");
  assert.match(intake.payload.document.sourceText, /Present Levels/);
  assert.match(intake.payload.document.parseWarnings[0], /scanned PDFs still require OCR/);
  assert.equal(intake.payload.document.sourceSegments[0].label, "page 1");
  assert.equal(intake.payload.document.sourceSegments[0].pageNumber, 1);
  assert.equal(intake.payload.document.sourceSegments[0].anchorType, "pdf-page");
  assert.equal(intake.payload.document.sourceSegments[0].locator.precision, "page");
  const goalSection = intake.payload.extractionSections.find((section) => section.key === "goalsAndObjectives.detected");
  assert.match(goalSection.sourceReference, /page 1/);

  const denied = await request(`/api/documents/${intake.payload.document.id}/ocr-review`, {
    method: "PATCH",
    role: "generalEducation",
    body: {
      status: "OCR text reviewed",
      confidence: 91,
      reviewedTextExcerpt: "General education role cannot record OCR review.",
      reviewerNote: "Permission should be denied."
    }
  });
  assert.equal(denied.response.status, 403);

  const ocrReview = await request(`/api/documents/${intake.payload.document.id}/ocr-review`, {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "OCR text reviewed",
      confidence: 91,
      reviewedTextExcerpt: "Present levels: Jordan reads with 70% accuracy using an organizer.",
      reviewerNote: "Embedded PDF text was reviewed against the page anchor; no separate OCR remediation is needed for this demo source."
    }
  });
  assert.equal(ocrReview.response.status, 200);
  assert.equal(ocrReview.payload.status, "OCR text reviewed");
  assert.equal(ocrReview.payload.confidence, 91);
  assert.equal(ocrReview.payload.reviewedBy, "BJ Tarves");
  assert.equal(ocrReview.payload.reviewedByRole, "caseManager");
  assert.equal(ocrReview.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.match(ocrReview.payload.officialRecordImpact, /does not change the official IEP/);
  assert.ok(ocrReview.payload.ocrDigest);
  assert.equal(ocrReview.payload.workspace.documents[0].ocrReview.status, "OCR text reviewed");
  assert.equal(ocrReview.payload.workspace.auditLog[0].title, "OCR/source review recorded");

  const anchorDenied = await request(`/api/extraction/${goalSection.id}/source-anchor`, {
    method: "PATCH",
    role: "parent",
    body: {
      precision: "Bounding box",
      pageNumber: 1,
      segmentLabel: "page 1",
      anchorX: 12,
      anchorY: 18,
      anchorWidth: 72,
      anchorHeight: 9,
      reviewerNote: "Parent cannot record official extraction source anchor review."
    }
  });
  assert.equal(anchorDenied.response.status, 403);

  const anchorReview = await request(`/api/extraction/${goalSection.id}/source-anchor`, {
    method: "PATCH",
    role: "caseManager",
    body: {
      precision: "Bounding box",
      pageNumber: 1,
      segmentLabel: "page 1",
      anchorX: 12,
      anchorY: 18,
      anchorWidth: 72,
      anchorHeight: 9,
      reviewerNote: "Goal field anchor confirmed against the highlighted PDF page region before extraction approval."
    }
  });
  assert.equal(anchorReview.response.status, 200);
  assert.equal(anchorReview.payload.sourceAnchorReview.precision, "Bounding box");
  assert.equal(anchorReview.payload.sourceAnchorReview.pageNumber, 1);
  assert.equal(anchorReview.payload.sourceAnchorReview.boundingBox.width, 72);
  assert.equal(anchorReview.payload.sourceAnchorReview.reviewedBy, "BJ Tarves");
  assert.match(anchorReview.payload.sourceAnchorReview.anchorDigest, /^[a-f0-9]{64}$/);
  assert.match(anchorReview.payload.sourceAnchorReview.officialRecordImpact, /does not change the official IEP/);
  assert.equal(anchorReview.payload.workspace.auditLog[0].title, "Source anchor review recorded");

  const approved = await request("/api/extraction/approve", { method: "POST" });
  const approvedIep = approved.payload.workspace.ieps.find((iep) => iep.studentId === "student-001");
  const structuredGoal = approvedIep.structuredRecord.goalsAndObjectives.find(
    (goal) => goal.extractionSectionId === goalSection.id
  );
  assert.equal(structuredGoal.sourceAnchorReview.precision, "Bounding box");
  assert.equal(structuredGoal.sourceAnchorReview.boundingBox.height, 9);

  const preserved = await readFile(join(dataDir, intake.payload.document.originalFile.preservedPath));
  assert.equal(Buffer.compare(preserved, pdf.buffer), 0);
});

test("allows teacher progress entry while blocking parent edits", async (t) => {
  const { request } = await withApi(t);

  const parentDenied = await request("/api/progress", {
    method: "POST",
    role: "parent",
    body: { goalId: "goal-001", value: 76, notes: "Family observation" }
  });
  assert.equal(parentDenied.response.status, 403);

  const progress = await request("/api/progress", {
    method: "POST",
    role: "generalEducation",
    body: {
      goalId: "goal-001",
      date: "2026-06-19",
      value: 76,
      notes: "Independent organizer use in ELA",
      evidenceDocumentId: "doc-001",
      evidenceLabel: "Weekly comprehension probe",
      evidenceType: "Comprehension probe"
    }
  });
  assert.equal(progress.response.status, 201);
  assert.equal(progress.payload.entry.enteredBy, "Leah Kim");
  assert.equal(progress.payload.entry.evidenceDocumentId, "doc-001");
  assert.equal(progress.payload.entry.evidenceLabel, "Weekly comprehension probe");
  assert.equal(progress.payload.goal.progressEntries.at(-1).value, 76);
  assert.equal(progress.payload.goal.progressSchedule.lastCollectedDate, "2026-06-19");
  assert.equal(progress.payload.goal.progressSchedule.nextDueDate, "2026-06-26");
  assert.equal(progress.payload.goal.progressSchedule.status, "Due soon");

  const verifyResult = await request("/api/audit/verify", { role: "generalEducation" });
  assert.equal(verifyResult.payload.valid, true);
});

test("records detailed missed-service recovery plans while blocking unauthorized roles", async (t) => {
  const { request } = await withApi(t);

  const parentDenied = await request("/api/services/service-001/recovery", {
    method: "POST",
    role: "parent",
    body: {
      recoveryDate: "2026-06-26",
      provider: "R. Coleman",
      familyCommunication: "Family notified that speech-language minutes will be recovered."
    }
  });
  assert.equal(parentDenied.response.status, 403);

  const logged = await request("/api/services/service-001/log", {
    method: "POST",
    role: "relatedServiceProvider",
    body: {
      minutes: 15
    }
  });
  assert.equal(logged.response.status, 200);
  assert.equal(logged.payload.deliveredMinutes, 105);
  assert.equal(logged.payload.recoveryStatus, "Recovery needed");
  assert.equal(logged.payload.workspace.auditLog[0].title, "Service delivery documented");

  const invalid = await request("/api/services/service-001/recovery", {
    method: "POST",
    role: "relatedServiceProvider",
    body: {
      recoveryDate: "2026-06-26",
      provider: "R. Coleman"
    }
  });
  assert.equal(invalid.response.status, 400);

  const planned = await request("/api/services/service-001/recovery", {
    method: "POST",
    role: "relatedServiceProvider",
    body: {
      recoveryDate: "2026-06-26",
      provider: "R. Coleman",
      familyCommunication: "Family notified that speech-language minutes will be recovered on Friday."
    }
  });
  assert.equal(planned.response.status, 200);
  assert.equal(planned.payload.recoveryStatus, "Recovery planned");
  assert.equal(planned.payload.recoveryPlan.recoveryDate, "2026-06-26");
  assert.equal(planned.payload.recoveryPlan.provider, "R. Coleman");
  assert.equal(planned.payload.recoveryPlan.plannedBy, "R. Coleman");
  assert.match(planned.payload.recoveryPlan.familyCommunication, /Friday/);

  const persisted = planned.payload.workspace.services.find((service) => service.id === "service-001");
  assert.equal(persisted.recoveryPlan.recoveryDate, "2026-06-26");
  assert.equal(planned.payload.workspace.auditLog[0].title, "Service recovery planned");

  const reviewDenied = await request("/api/review-flags/generate", {
    method: "POST",
    role: "relatedServiceProvider"
  });
  assert.equal(reviewDenied.response.status, 403);

  const verifyResult = await request("/api/audit/verify", { role: "relatedServiceProvider" });
  assert.equal(verifyResult.payload.valid, true);
});

test("updates assistive technology and transportation access supports with staff review", async (t) => {
  const { request } = await withApi(t);

  const parentDenied = await request("/api/access-supports/access-at-organizer", {
    method: "PATCH",
    role: "parent",
    body: {
      status: "Active",
      implementationPlan: "Family cannot update the official access-support review.",
      responsibleRole: "Parent",
      reviewNote: "This should be blocked."
    }
  });
  assert.equal(parentDenied.response.status, 403);

  const incomplete = await request("/api/access-supports/access-at-organizer", {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "Active",
      implementationPlan: "Confirm graphic organizer routine."
    }
  });
  assert.equal(incomplete.response.status, 400);

  const updated = await request("/api/access-supports/access-at-organizer", {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "Active",
      implementationPlan: "Organizer format, storage location, and staff prompt routine confirmed for all core classes.",
      responsibleRole: "Case Manager",
      reviewNote: "Assistive technology consideration reviewed; no dedicated device is required beyond organizer access."
    }
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.status, "Active");
  assert.equal(updated.payload.reviewedBy, "BJ Tarves");
  assert.equal(updated.payload.reviewedByRole, "caseManager");
  assert.equal(updated.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.match(updated.payload.supportDigest, /^[a-f0-9]{64}$/);
  assert.match(updated.payload.officialRecordImpact, /official IEP/);
  assert.equal(updated.payload.workspace.auditLog[0].title, "Access support review updated");

  const parentWorkspace = await request("/api/workspace", { role: "parent" });
  assert.equal(parentWorkspace.response.status, 200);
  assert.ok(parentWorkspace.payload.workspace.accessSupportPlans.some((support) => support.id === "access-at-organizer"));
  assert.ok(parentWorkspace.payload.workspace.accessSupportPlans.some((support) => support.supportType === "Transportation"));

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("updates educational placement and LRE review records with human boundaries", async (t) => {
  const { request } = await withApi(t);

  const parentDenied = await request("/api/placement-reviews/placement-review-001", {
    method: "PATCH",
    role: "parent",
    body: {
      status: "Source aligned",
      lreConsideration: "Family cannot update placement review metadata directly.",
      implementationImpact: "This should be blocked.",
      followUpOwner: "Parent",
      nextReviewDate: "2026-07-01",
      reviewerNote: "Blocked."
    }
  });
  assert.equal(parentDenied.response.status, 403);

  const incomplete = await request("/api/placement-reviews/placement-review-001", {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "Source aligned",
      lreConsideration: "General education remains the primary setting with documented small-group support."
    }
  });
  assert.equal(incomplete.response.status, 400);

  const updated = await request("/api/placement-reviews/placement-review-001", {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "Source aligned",
      lreConsideration: "General education remains the primary setting while small-group services support the documented reading and speech-language needs.",
      implementationImpact: "Coordinate pull-out service minutes with classroom accommodation responsibilities before the annual review.",
      followUpOwner: "Case Manager",
      nextReviewDate: "2026-07-01",
      reviewerNote: "Placement rationale reviewed for meeting preparation; no automated placement decision was made."
    }
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.status, "Source aligned");
  assert.equal(updated.payload.reviewedBy, "BJ Tarves");
  assert.equal(updated.payload.reviewedByRole, "caseManager");
  assert.equal(updated.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.match(updated.payload.placementDigest, /^[a-f0-9]{64}$/);
  assert.match(updated.payload.officialRecordImpact, /official placement/);
  assert.equal(updated.payload.workspace.auditLog[0].title, "Placement rationale review updated");

  const parentWorkspace = await request("/api/workspace", { role: "parent" });
  assert.equal(parentWorkspace.response.status, 200);
  assert.ok(parentWorkspace.payload.workspace.placementReviews.some((review) => review.id === "placement-review-001"));
  assert.match(parentWorkspace.payload.workspace.placementReviews[0].officialRecordImpact, /IEP team/);

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("records task completion evidence while blocking family edits", async (t) => {
  const { request } = await withApi(t);

  const parentDenied = await request("/api/tasks/task-003/toggle", {
    method: "POST",
    role: "parent",
    body: {
      note: "Family cannot complete staff implementation tasks.",
      evidenceDocumentId: "doc-001",
      evidenceLabel: "Family attempt"
    }
  });
  assert.equal(parentDenied.response.status, 403);

  const completed = await request("/api/tasks/task-003/toggle", {
    method: "POST",
    role: "generalEducation",
    body: {
      note: "Weekly routine rating completed and attached.",
      evidenceDocumentId: "doc-001",
      evidenceLabel: "Executive-function routine rating"
    }
  });
  assert.equal(completed.response.status, 200);
  assert.equal(completed.payload.status, "Completed");
  assert.equal(completed.payload.completionEvidence.completedBy, "Leah Kim");
  assert.equal(completed.payload.completionEvidence.evidenceDocumentId, "doc-001");
  assert.equal(completed.payload.completionEvidence.evidenceLabel, "Executive-function routine rating");
  assert.match(completed.payload.completionEvidence.note, /routine rating/);
  assert.equal(completed.payload.workspace.auditLog[0].title, "Implementation task updated");

  const verifyResult = await request("/api/audit/verify", { role: "generalEducation" });
  assert.equal(verifyResult.payload.valid, true);
});

test("records staff handoff acknowledgments while blocking family edits", async (t) => {
  const { request } = await withApi(t);

  const parentDenied = await request("/api/tasks/task-003/acknowledge", {
    method: "POST",
    role: "parent",
    body: { note: "Family cannot acknowledge staff handoff." }
  });
  assert.equal(parentDenied.response.status, 403);

  const acknowledged = await request("/api/tasks/task-003/acknowledge", {
    method: "POST",
    role: "generalEducation",
    body: { note: "Science routine rating will be completed every Friday." }
  });
  assert.equal(acknowledged.response.status, 200);
  assert.equal(acknowledged.payload.acknowledgments[0].acknowledgedBy, "Leah Kim");
  assert.equal(acknowledged.payload.acknowledgments[0].acknowledgedByRole, "generalEducation");
  assert.match(acknowledged.payload.acknowledgments[0].note, /Science routine/);
  assert.equal(
    acknowledged.payload.workspace.tasks.find((task) => task.id === "task-003").acknowledgments[0].acknowledgedBy,
    "Leah Kim"
  );

  const verifyResult = await request("/api/audit/verify", { role: "generalEducation" });
  assert.equal(verifyResult.payload.valid, true);
});

test("records classroom observations on implementation tasks while blocking family edits", async (t) => {
  const { request } = await withApi(t);

  const parentDenied = await request("/api/tasks/task-003/observations", {
    method: "POST",
    role: "parent",
    body: {
      observedAt: "2026-06-24",
      context: "Science class",
      note: "Family cannot record staff classroom observations.",
      supportUsed: "Checklist"
    }
  });
  assert.equal(parentDenied.response.status, 403);

  const invalid = await request("/api/tasks/task-003/observations", {
    method: "POST",
    role: "generalEducation",
    body: {
      context: "Science class"
    }
  });
  assert.equal(invalid.response.status, 400);

  const recorded = await request("/api/tasks/task-003/observations", {
    method: "POST",
    role: "generalEducation",
    body: {
      observedAt: "2026-06-24",
      context: "Science independent work",
      note: "Jordan used the visual checklist after one prompt and completed three of five routines.",
      supportUsed: "Visual checklist and one prompt"
    }
  });
  assert.equal(recorded.response.status, 201);
  assert.equal(recorded.payload.observations[0].enteredBy, "Leah Kim");
  assert.equal(recorded.payload.observations[0].enteredByRole, "generalEducation");
  assert.match(recorded.payload.observations[0].note, /three of five routines/);
  assert.equal(recorded.payload.workspace.tasks.find((task) => task.id === "task-003").observations[0].context, "Science independent work");
  assert.equal(recorded.payload.workspace.auditLog[0].title, "Classroom observation recorded");

  const verifyResult = await request("/api/audit/verify", { role: "generalEducation" });
  assert.equal(verifyResult.payload.valid, true);
});

test("records reminder reviews with student-scope checks", async (t) => {
  const { request } = await withApi(t);

  const scopedDenied = await request("/api/reminders/reminder-progress-goal-999/review", {
    method: "POST",
    role: "parent",
    body: {
      title: "Unassigned student reminder",
      studentId: "student-002"
    }
  });
  assert.equal(scopedDenied.response.status, 403);

  const reviewed = await request("/api/reminders/reminder-progress-goal-001/review", {
    method: "POST",
    body: {
      title: "Reading progress data overdue",
      studentId: "student-001",
      note: "Reviewed during morning deadline scan."
    }
  });
  assert.equal(reviewed.response.status, 200);
  assert.equal(reviewed.payload.reminderId, "reminder-progress-goal-001");
  assert.equal(reviewed.payload.reviewedBy, "BJ Tarves");
  assert.equal(reviewed.payload.reviewedByUserId, "user-case-manager");
  assert.match(reviewed.payload.note, /morning deadline/);
  assert.equal(reviewed.payload.workspace.reminderReviews[0].title, "Reading progress data overdue");
  assert.equal(reviewed.payload.workspace.auditLog[0].title, "Implementation reminder reviewed");

  const rereviewed = await request("/api/reminders/reminder-progress-goal-001/review", {
    method: "POST",
    body: {
      title: "Reading progress data overdue",
      studentId: "student-001",
      note: "Reviewed again after confirming owner."
    }
  });
  assert.equal(rereviewed.response.status, 200);
  assert.equal(
    rereviewed.payload.workspace.reminderReviews.filter((item) => item.reminderId === "reminder-progress-goal-001").length,
    1
  );
  assert.match(rereviewed.payload.workspace.reminderReviews[0].note, /confirming owner/);

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("records notification delivery with role-aware visibility", async (t) => {
  const { request } = await withApi(t);

  const parentDenied = await request("/api/notifications", {
    method: "POST",
    role: "parent",
    body: {
      studentId: "student-001",
      sourceId: "reminder-progress-goal-001",
      sourceType: "Progress monitoring",
      sourceTitle: "Reading progress data overdue",
      audience: "family",
      channel: "In-app",
      message: "Please review the progress data reminder before the meeting."
    }
  });
  assert.equal(parentDenied.response.status, 403);

  const sent = await request("/api/notifications", {
    method: "POST",
    role: "caseManager",
    body: {
      studentId: "student-001",
      sourceId: "reminder-progress-goal-001",
      sourceType: "Progress monitoring",
      sourceTitle: "Reading progress data overdue",
      audience: "family",
      channel: "Email",
      message: "Please review the progress data reminder before the meeting."
    }
  });

  assert.equal(sent.response.status, 201);
  assert.equal(sent.payload.audience, "family");
  assert.equal(sent.payload.channel, "Email");
  assert.equal(sent.payload.status, "Sent");
  assert.equal(sent.payload.sentBy, "BJ Tarves");
  assert.equal(sent.payload.workspace.notificationDeliveries[0].sourceTitle, "Reading progress data overdue");
  assert.equal(sent.payload.workspace.auditLog[0].title, "Notification sent");

  const parentWorkspace = await request("/api/workspace", { role: "parent" });
  assert.equal(parentWorkspace.response.status, 200);
  assert.equal(parentWorkspace.payload.workspace.notificationDeliveries[0].audience, "family");
  assert.match(parentWorkspace.payload.workspace.notificationDeliveries[0].message, /progress data reminder/);
});

test("allows family and student meeting prep input with staff-only responses", async (t) => {
  const { request } = await withApi(t);

  const parentParticipantDenied = await request("/api/meetings/meeting-001/participants/participant-lea", {
    method: "PATCH",
    role: "parent",
    body: {
      status: "Confirmed",
      mode: "Video option",
      note: "Family cannot coordinate required participant attendance."
    }
  });
  assert.equal(parentParticipantDenied.response.status, 403);

  const participant = await request("/api/meetings/meeting-001/participants/participant-lea", {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "Confirmed",
      mode: "In person",
      note: "LEA representative confirmed for placement and resource decisions."
    }
  });
  assert.equal(participant.response.status, 200);
  assert.equal(participant.payload.status, "Confirmed");
  assert.equal(participant.payload.confirmedBy, "BJ Tarves");
  assert.match(participant.payload.workspace.meetings[0].requiredParticipants.find((item) => item.id === "participant-lea").note, /placement/);

  const parentCompanionDenied = await request("/api/meetings/meeting-001/companion-documents/companion-norep-pwn", {
    method: "PATCH",
    role: "parent",
    body: {
      status: "Complete",
      owner: "Robin Lee",
      dueDate: "2026-07-01",
      note: "Family cannot finalize companion document readiness."
    }
  });
  assert.equal(parentCompanionDenied.response.status, 403);

  const companion = await request("/api/meetings/meeting-001/companion-documents/companion-norep-pwn", {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "In progress",
      owner: "BJ Tarves",
      dueDate: "2026-06-28",
      note: "Review NOREP/PWN support if the team proposes or refuses a formal placement or service change."
    }
  });
  assert.equal(companion.response.status, 200);
  assert.equal(companion.payload.status, "In progress");
  assert.equal(companion.payload.reviewedBy, "BJ Tarves");
  assert.equal(companion.payload.reviewedByRole, "caseManager");
  assert.equal(companion.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  const persistedCompanion = companion.payload.workspace.meetings[0].companionDocuments.find(
    (document) => document.id === "companion-norep-pwn"
  );
  assert.equal(persistedCompanion.owner, "BJ Tarves");
  assert.match(persistedCompanion.note, /formal placement or service change/);
  assert.equal(companion.payload.workspace.auditLog[0].title, "Companion document readiness updated");

  const parentResourceUpdateDenied = await request("/api/meetings/meeting-001/family-resources/resource-procedural-safeguards", {
    method: "PATCH",
    role: "parent",
    body: {
      status: "Reviewed with family",
      owner: "Robin Lee",
      dueDate: "2026-06-24",
      note: "Family cannot coordinate resource-guide readiness."
    }
  });
  assert.equal(parentResourceUpdateDenied.response.status, 403);

  const resource = await request("/api/meetings/meeting-001/family-resources/resource-procedural-safeguards", {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "Reviewed with family",
      owner: "BJ Tarves",
      dueDate: "2026-06-24",
      note: "Procedural safeguards and dispute-resolution resource guide reviewed during the pre-meeting call."
    }
  });
  assert.equal(resource.response.status, 200);
  assert.equal(resource.payload.status, "Reviewed with family");
  assert.equal(resource.payload.owner, "BJ Tarves");
  assert.equal(resource.payload.reviewedByRole, "caseManager");
  assert.equal(resource.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.match(resource.payload.officialRecordImpact, /does not replace procedural safeguards/);
  assert.equal(resource.payload.workspace.auditLog[0].title, "Family resource guide updated");

  const teacherResourceResponseDenied = await request("/api/meetings/meeting-001/family-resources/resource-procedural-safeguards/response", {
    method: "PATCH",
    role: "generalEducation",
    body: {
      status: "Reviewed",
      note: "Teacher cannot acknowledge family resource review."
    }
  });
  assert.equal(teacherResourceResponseDenied.response.status, 403);

  const studentParentResourceDenied = await request("/api/meetings/meeting-001/family-resources/resource-procedural-safeguards/response", {
    method: "PATCH",
    role: "student",
    body: {
      status: "Reviewed",
      note: "Student cannot replace parent resource review."
    }
  });
  assert.equal(studentParentResourceDenied.response.status, 403);

  const resourceResponse = await request("/api/meetings/meeting-001/family-resources/resource-procedural-safeguards/response", {
    method: "PATCH",
    role: "parent",
    body: {
      status: "Interpreter support needed",
      note: "Please explain dispute-resolution options with interpreter support before the meeting."
    }
  });
  assert.equal(resourceResponse.response.status, 200);
  assert.equal(resourceResponse.payload.familyStatus, "Interpreter support needed");
  assert.equal(resourceResponse.payload.acknowledgedBy, "Robin Lee");
  assert.equal(resourceResponse.payload.acknowledgedByRole, "parent");
  assert.match(resourceResponse.payload.familyNote, /dispute-resolution options/);
  assert.equal(resourceResponse.payload.workspace.auditLog[0].title, "Family resource response recorded");

  const teacherPacketDenied = await request("/api/meetings/meeting-001/packet-acknowledgments/packet-parent-robin", {
    method: "PATCH",
    role: "generalEducation",
    body: {
      status: "Reviewed",
      note: "Teacher cannot acknowledge a family pre-read packet."
    }
  });
  assert.equal(teacherPacketDenied.response.status, 403);

  const parentStudentPacketDenied = await request("/api/meetings/meeting-001/packet-acknowledgments/packet-student-jordan", {
    method: "PATCH",
    role: "parent",
    body: {
      status: "Reviewed",
      note: "Parent cannot replace the student's packet receipt."
    }
  });
  assert.equal(parentStudentPacketDenied.response.status, 403);

  const packetAcknowledgment = await request("/api/meetings/meeting-001/packet-acknowledgments/packet-parent-robin", {
    method: "PATCH",
    role: "parent",
    body: {
      status: "Needs clarification",
      note: "I reviewed the packet and need clarification on the missed-service recovery plan."
    }
  });
  assert.equal(packetAcknowledgment.response.status, 200);
  assert.equal(packetAcknowledgment.payload.status, "Needs clarification");
  assert.equal(packetAcknowledgment.payload.acknowledgedBy, "Robin Lee");
  assert.equal(packetAcknowledgment.payload.acknowledgedByRole, "parent");
  assert.equal(packetAcknowledgment.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.match(packetAcknowledgment.payload.workspace.meetings[0].packetAcknowledgments[0].responseNote, /missed-service recovery/);
  assert.equal(packetAcknowledgment.payload.workspace.auditLog[0].title, "Meeting packet acknowledged");

  const parentRequestDenied = await request("/api/meetings/meeting-001/signature-requests", {
    method: "POST",
    role: "parent",
    body: {
      packetTitle: "Annual IEP pre-read packet",
      signatureScope: "Meeting packet receipt",
      requestedForRole: "parent",
      requestedForName: "Robin Lee",
      requestNote: "Parent cannot request a packet signature from themselves."
    }
  });
  assert.equal(parentRequestDenied.response.status, 403);

  const signatureRequest = await request("/api/meetings/meeting-001/signature-requests", {
    method: "POST",
    body: {
      packetTitle: "Annual IEP pre-read packet",
      signatureScope: "Meeting packet receipt",
      requestedForRole: "parent",
      requestedForName: "Robin Lee",
      requestNote: "Please sign after reviewing the packet and draft-to-final notes."
    }
  });
  assert.equal(signatureRequest.response.status, 201);
  assert.equal(signatureRequest.payload.status, "Requested");
  assert.equal(signatureRequest.payload.requestedBy, "BJ Tarves");
  assert.match(signatureRequest.payload.notConsentNote, /does not replace IEP team decisions/);

  const teacherSignDenied = await request(`/api/meetings/meeting-001/signature-requests/${signatureRequest.payload.id}/sign`, {
    method: "PATCH",
    role: "generalEducation",
    body: {
      signerName: "L. Kim",
      attestation: "Teacher cannot sign a parent packet attestation."
    }
  });
  assert.equal(teacherSignDenied.response.status, 403);

  const signed = await request(`/api/meetings/meeting-001/signature-requests/${signatureRequest.payload.id}/sign`, {
    method: "PATCH",
    role: "parent",
    body: {
      signerName: "Robin Lee",
      attestation:
        "I typed my name to confirm I received and reviewed the scoped meeting packet. I understand this is not blanket consent or a final IEP decision."
    }
  });
  assert.equal(signed.response.status, 200);
  assert.equal(signed.payload.status, "Signed");
  assert.equal(signed.payload.signerName, "Robin Lee");
  assert.equal(signed.payload.signedByRole, "parent");
  assert.match(signed.payload.signatureHash, /^[a-f0-9]{64}$/);
  assert.equal(signed.payload.workspace.meetings[0].eSignatureRequests[0].status, "Signed");
  assert.equal(signed.payload.workspace.auditLog[0].title, "Meeting packet e-signed");

  const submitted = await request("/api/meetings/meeting-001/questions", {
    method: "POST",
    role: "parent",
    body: { text: "Can we discuss how reading supports transfer to science tests?" }
  });
  assert.equal(submitted.response.status, 201);
  assert.match(submitted.payload.id, /^question-/);
  assert.equal(submitted.payload.status, "Open");
  assert.equal(submitted.payload.submittedBy, "Robin Lee");
  assert.equal(submitted.payload.workspace.meetings[0].familyQuestions[0].text, submitted.payload.text);

  const prepNote = await request("/api/meetings/meeting-001/notes", {
    method: "POST",
    role: "parent",
    body: {
      topic: "Parent notes area",
      body: "Please help me understand how service recovery and science reading supports will be discussed.",
      audience: "IEP team"
    }
  });
  assert.equal(prepNote.response.status, 201);
  assert.match(prepNote.payload.id, /^prep-note-/);
  assert.equal(prepNote.payload.topic, "Parent notes area");
  assert.equal(prepNote.payload.submittedBy, "Robin Lee");
  assert.equal(prepNote.payload.submittedByRole, "parent");
  assert.equal(prepNote.payload.audience, "IEP team");
  assert.equal(prepNote.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.match(prepNote.payload.officialRecordImpact, /does not change official IEP/);
  assert.equal(prepNote.payload.workspace.meetings[0].meetingPrepNotes[0].body, prepNote.payload.body);
  assert.equal(prepNote.payload.workspace.auditLog[0].title, "Meeting prep note added");

  const parentAnswerDenied = await request(`/api/meetings/questions/${submitted.payload.id}/answer`, {
    method: "POST",
    role: "parent",
    body: { response: "Parent should not answer as the team." }
  });
  assert.equal(parentAnswerDenied.response.status, 403);

  const studentVoice = await request("/api/meetings/meeting-001/student-voice", {
    method: "PATCH",
    role: "student",
    body: { studentVoice: "I want to explain when the organizer helps me and when I forget to use it." }
  });
  assert.equal(studentVoice.response.status, 200);
  assert.equal(studentVoice.payload.studentVoiceUpdatedBy, "Jordan Lee");
  assert.match(studentVoice.payload.studentVoice, /organizer helps me/);
  assert.match(studentVoice.payload.workspace.meetings[0].studentVoice, /organizer helps me/);

  const teacherDenied = await request("/api/meetings/meeting-001/student-voice", {
    method: "PATCH",
    role: "generalEducation",
    body: { studentVoice: "Teacher cannot replace student reflection." }
  });
  assert.equal(teacherDenied.response.status, 403);

  const teacherSelfAdvocacyDenied = await request("/api/meetings/meeting-001/self-advocacy", {
    method: "PATCH",
    role: "generalEducation",
    body: {
      preferredSupport: "Graphic organizer",
      participationGoal: "Teacher cannot replace student self-advocacy prep.",
      requestScript: "Can I use my organizer?",
      confidence: 4,
      barrier: "No barrier.",
      nextStep: "No step."
    }
  });
  assert.equal(teacherSelfAdvocacyDenied.response.status, 403);

  const selfAdvocacy = await request("/api/meetings/meeting-001/self-advocacy", {
    method: "PATCH",
    role: "student",
    body: {
      preferredSupport: "Graphic organizer during science reading",
      participationGoal: "I want to explain when the organizer helps me answer questions.",
      requestScript: "Can I use my organizer before I answer the science questions?",
      confidence: 5,
      barrier: "I get nervous asking after the class has started.",
      nextStep: "Practice the request with my case manager before the meeting."
    }
  });
  assert.equal(selfAdvocacy.response.status, 200);
  assert.equal(selfAdvocacy.payload.preferredSupport, "Graphic organizer during science reading");
  assert.equal(selfAdvocacy.payload.confidence, 5);
  assert.equal(selfAdvocacy.payload.updatedBy, "Jordan Lee");
  assert.equal(selfAdvocacy.payload.updatedByRole, "student");
  assert.equal(selfAdvocacy.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.match(selfAdvocacy.payload.workspace.meetings[0].selfAdvocacyPlan.requestScript, /science questions/);
  assert.equal(selfAdvocacy.payload.workspace.auditLog[0].title, "Self-advocacy plan updated");

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("records meeting calendar holds while blocking family updates", async (t) => {
  const { request } = await withApi(t);

  const denied = await request("/api/meetings/meeting-001/calendar-holds", {
    method: "POST",
    role: "parent",
    body: {
      provider: "Outlook (simulated)",
      attendanceMode: "Video option",
      note: "Family cannot create the calendar hold."
    }
  });
  assert.equal(denied.response.status, 403);

  const created = await request("/api/meetings/meeting-001/calendar-holds", {
    method: "POST",
    role: "caseManager",
    body: {
      provider: "Outlook (simulated)",
      attendanceMode: "Video option",
      note: "Calendar hold created after confirming participant options."
    }
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.provider, "Outlook (simulated)");
  assert.equal(created.payload.attendanceMode, "Video option");
  assert.equal(created.payload.createdBy, "BJ Tarves");
  assert.equal(created.payload.workspace.calendarEvents[0].meetingId, "meeting-001");
  assert.equal(created.payload.workspace.auditLog[0].title, "Calendar hold created");

  const parentWorkspace = await request("/api/workspace", { role: "parent" });
  assert.equal(parentWorkspace.response.status, 200);
  assert.ok(parentWorkspace.payload.workspace.calendarEvents.some((event) => event.meetingId === "meeting-001"));
});

test("records meeting transcript summaries with role-aware visibility", async (t) => {
  const { request } = await withApi(t);

  const parentWorkspaceBefore = await request("/api/workspace", { role: "parent" });
  assert.equal(parentWorkspaceBefore.response.status, 200);
  assert.ok(!parentWorkspaceBefore.payload.workspace.meetingRecordingReviews.some((review) => review.id === "meeting-recording-review-001"));

  const recordingDenied = await request("/api/meetings/meeting-001/recording-reviews", {
    method: "POST",
    role: "parent",
    body: {
      recordingSource: "Manual transcript paste",
      status: "Source readiness reviewed",
      participantConsentSummary: "Family cannot create the recording readiness review.",
      transcriptHandlingPlan: "This should be blocked.",
      storageLocation: "Blocked",
      retentionBoundary: "Blocked",
      familyVisible: true
    }
  });
  assert.equal(recordingDenied.response.status, 403);

  const recordingReview = await request("/api/meetings/meeting-001/recording-reviews", {
    method: "POST",
    role: "caseManager",
    body: {
      recordingSource: "Manual transcript paste",
      status: "Source readiness reviewed",
      participantConsentSummary:
        "No recording is attached; transcript excerpt comes from staff notes and family-visible meeting-prep questions.",
      transcriptHandlingPlan:
        "Human reviewer will summarize only meeting-prep topics and separate proposed follow-ups from official IEP decisions.",
      storageLocation: "Local demo workspace; no production recording provider connected.",
      retentionBoundary:
        "Do not upload meeting recordings until district consent, retention, and access rules are confirmed.",
      familyVisible: false,
      studentVisible: false
    }
  });
  assert.equal(recordingReview.response.status, 201);
  assert.equal(recordingReview.payload.status, "Source readiness reviewed");
  assert.equal(recordingReview.payload.reviewedBy, "BJ Tarves");
  assert.equal(recordingReview.payload.reviewedByRole, "caseManager");
  assert.equal(recordingReview.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.match(recordingReview.payload.recordingReviewDigest, /^[a-f0-9]{64}$/);
  assert.match(recordingReview.payload.officialRecordImpact, /does not create a recording/);
  assert.equal(recordingReview.payload.workspace.meetingRecordingReviews[0].id, recordingReview.payload.id);
  assert.equal(recordingReview.payload.workspace.auditLog[0].title, "Meeting recording readiness recorded");

  const parentDenied = await request("/api/meetings/meeting-001/transcript-summaries", {
    method: "POST",
    role: "parent",
    body: {
      transcriptSource: "Parent recap",
      transcriptExcerpt: "Parent cannot create the reviewed transcript recap.",
      summary: "Family creation should be blocked.",
      decisions: "No decision.",
      followUps: "No follow-up.",
      status: "Draft recap for review",
      familyVisible: true
    }
  });
  assert.equal(parentDenied.response.status, 403);

  const created = await request("/api/meetings/meeting-001/transcript-summaries", {
    method: "POST",
    role: "caseManager",
    body: {
      transcriptSource: "Transcript paste from annual IEP prep",
      transcriptExcerpt:
        "Family asked when missed speech-language minutes will be recovered and whether extended time applies to science tests.",
      summary: "Case manager will confirm service recovery and extended-time implementation before packet sharing.",
      decisions: [
        "No official IEP changes were finalized in the recap.",
        "Recovery planning remains an implementation follow-up."
      ],
      followUps: "Confirm recovery provider.\nClarify extended-time trigger.",
      status: "Reviewed for packet",
      familyVisible: true,
      studentVisible: false
    }
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.status, "Reviewed for packet");
  assert.equal(created.payload.reviewedBy, "BJ Tarves");
  assert.equal(created.payload.reviewedByRole, "caseManager");
  assert.equal(created.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.equal(created.payload.decisions.length, 2);
  assert.match(created.payload.followUps[0], /Confirm recovery/);
  assert.match(created.payload.transcriptDigest, /^[a-f0-9]{64}$/);
  assert.match(created.payload.officialRecordImpact, /does not amend the official IEP/);
  assert.equal(created.payload.workspace.meetingTranscriptSummaries[0].summary, created.payload.summary);
  assert.equal(created.payload.workspace.auditLog[0].title, "Meeting transcript summary recorded");

  const parentWorkspace = await request("/api/workspace", { role: "parent" });
  assert.equal(parentWorkspace.response.status, 200);
  assert.ok(parentWorkspace.payload.workspace.meetingTranscriptSummaries.some((summary) => summary.id === created.payload.id));
  assert.ok(!parentWorkspace.payload.workspace.meetingRecordingReviews.some((review) => review.id === recordingReview.payload.id));

  const studentWorkspace = await request("/api/workspace", { role: "student" });
  assert.equal(studentWorkspace.response.status, 200);
  assert.ok(!studentWorkspace.payload.workspace.meetingTranscriptSummaries.some((summary) => summary.id === created.payload.id));
  assert.ok(!studentWorkspace.payload.workspace.meetingRecordingReviews.some((review) => review.id === recordingReview.payload.id));

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("tracks staff continuity coverage plans with administrator review", async (t) => {
  const { request } = await withApi(t);

  const parentWorkspace = await request("/api/workspace", { role: "parent" });
  assert.equal(parentWorkspace.response.status, 200);
  assert.deepEqual(parentWorkspace.payload.workspace.staffContinuity, []);

  const administratorWorkspace = await request("/api/workspace", { role: "administrator" });
  assert.equal(administratorWorkspace.response.status, 200);
  assert.ok(administratorWorkspace.payload.workspace.staffContinuity.length > 0);
  assert.equal(administratorWorkspace.payload.workspace.staffContinuity[0].sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");

  const denied = await request("/api/staff-continuity/continuity-slp-vacancy", {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "Coverage assigned",
      riskLevel: "Medium",
      coverageOwner: "D. Nguyen",
      nextReviewDate: "2026-06-28",
      coveragePlan: "Case managers cannot update leadership continuity plans."
    }
  });
  assert.equal(denied.response.status, 403);

  const updated = await request("/api/staff-continuity/continuity-slp-vacancy", {
    method: "PATCH",
    role: "administrator",
    body: {
      status: "Coverage assigned",
      riskLevel: "Medium",
      coverageOwner: "D. Nguyen",
      nextReviewDate: "2026-06-28",
      coveragePlan: "Contract SLP covers missed sessions and confirms recovery minutes with the family."
    }
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.payload.status, "Coverage assigned");
  assert.equal(updated.payload.riskLevel, "Medium");
  assert.equal(updated.payload.reviewedBy, "D. Nguyen");
  assert.equal(updated.payload.reviewedByRole, "administrator");
  assert.equal(updated.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.match(updated.payload.workspace.staffContinuity[0].coveragePlan, /Contract SLP/);
  assert.equal(updated.payload.workspace.auditLog[0].title, "Staff continuity plan updated");

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("tracks language access requests and staff coordination", async (t) => {
  const { request } = await withApi(t);

  const teacherDenied = await request("/api/meetings/meeting-001/language-access", {
    method: "PATCH",
    role: "generalEducation",
    body: { preferredLanguage: "Spanish", interpreterNeeded: true }
  });
  assert.equal(teacherDenied.response.status, 403);

  const requested = await request("/api/meetings/meeting-001/language-access", {
    method: "PATCH",
    role: "parent",
    body: {
      preferredLanguage: "Spanish",
      interpreterNeeded: true,
      requestNote: "Please provide Spanish interpretation and a family summary."
    }
  });
  assert.equal(requested.response.status, 200);
  assert.equal(requested.payload.preferredLanguage, "Spanish");
  assert.equal(requested.payload.interpreterStatus, "Requested");
  assert.equal(requested.payload.requestedBy, "Robin Lee");
  assert.equal(requested.payload.translatedSummary.language, "Spanish");
  assert.match(requested.payload.translatedSummary.sections[0].heading, /Lo que apoya/);
  const translatedChangeSection = requested.payload.translatedSummary.sections.find(
    (section) => section.sourceReference?.includes("Prior IEP comparison")
  );
  assert.match(translatedChangeSection.heading, /IEP anterior/);
  assert.match(translatedChangeSection.bullets.join(" "), /minutos perdidos/);

  const coordinated = await request("/api/meetings/meeting-001/language-access", {
    method: "PATCH",
    role: "caseManager",
    body: {
      preferredLanguage: "Spanish",
      interpreterNeeded: true,
      translationStatus: "Human reviewed",
      interpreterStatus: "Interpreter assigned",
      coordinatorNote: "Bilingual packet reviewed and interpreter confirmed."
    }
  });
  assert.equal(coordinated.response.status, 200);
  assert.equal(coordinated.payload.translationStatus, "Human reviewed");
  assert.equal(coordinated.payload.interpreterStatus, "Interpreter assigned");
  assert.equal(coordinated.payload.coordinatedBy, "BJ Tarves");
  assert.match(coordinated.payload.workspace.meetings[0].languageAccess.coordinatorNote, /interpreter confirmed/);

  const glossaryDenied = await request("/api/meetings/meeting-001/language-access/glossary/glossary-progress-monitoring", {
    method: "PATCH",
    role: "generalEducation",
    body: {
      status: "Needs explanation",
      note: "General education staff cannot submit family glossary requests."
    }
  });
  assert.equal(glossaryDenied.response.status, 403);

  const glossaryRequest = await request("/api/meetings/meeting-001/language-access/glossary/glossary-progress-monitoring", {
    method: "PATCH",
    role: "parent",
    body: {
      status: "Interpreter explanation requested",
      note: "Please explain progress monitoring and how often data is reviewed."
    }
  });
  assert.equal(glossaryRequest.response.status, 200);
  assert.equal(glossaryRequest.payload.clarityStatus, "Interpreter explanation requested");
  assert.equal(glossaryRequest.payload.clarityRequestedBy, "Robin Lee");
  assert.equal(glossaryRequest.payload.clarityRequestedByRole, "parent");
  assert.equal(glossaryRequest.payload.sourceAlignment.sourceId, "pa-school-age-iep-non-annotated");
  assert.equal(glossaryRequest.payload.workspace.auditLog[0].title, "Glossary clarification requested");

  const glossaryResponseDenied = await request("/api/meetings/meeting-001/language-access/glossary/glossary-progress-monitoring", {
    method: "PATCH",
    role: "parent",
    body: {
      coordinate: true,
      responseStatus: "Explained by staff",
      response: "Parent cannot record the staff explanation."
    }
  });
  assert.equal(glossaryResponseDenied.response.status, 403);

  const glossaryResponse = await request("/api/meetings/meeting-001/language-access/glossary/glossary-progress-monitoring", {
    method: "PATCH",
    role: "caseManager",
    body: {
      coordinate: true,
      responseStatus: "Explained by staff",
      response: "Progress monitoring means the team checks goal data on the documented schedule and reviews it before reports."
    }
  });
  assert.equal(glossaryResponse.response.status, 200);
  assert.equal(glossaryResponse.payload.staffResponseStatus, "Explained by staff");
  assert.equal(glossaryResponse.payload.staffRespondedBy, "BJ Tarves");
  assert.equal(glossaryResponse.payload.staffRespondedByRole, "caseManager");
  assert.match(glossaryResponse.payload.officialRecordImpact, /understanding only/);
  assert.equal(glossaryResponse.payload.workspace.auditLog[0].title, "Glossary explanation recorded");

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("tracks draft-to-final meeting decisions while blocking family edits", async (t) => {
  const { request } = await withApi(t);

  const parentDenied = await request("/api/meetings/draft-diffs/diff-001", {
    method: "PATCH",
    role: "parent",
    body: {
      finalText: "Family cannot finalize meeting language.",
      decisionRationale: "Only authorized staff can record final wording."
    }
  });
  assert.equal(parentDenied.response.status, 403);

  const invalid = await request("/api/meetings/draft-diffs/diff-001", {
    method: "PATCH",
    body: {
      finalText: "Recovery plan discussed before the meeting."
    }
  });
  assert.equal(invalid.response.status, 400);

  const finalized = await request("/api/meetings/draft-diffs/diff-001", {
    method: "PATCH",
    body: {
      finalText: "Recovery minutes will be scheduled and communicated before the annual review.",
      decisionRationale: "The final pre-read packet should distinguish recovery logistics from official service-frequency changes."
    }
  });
  assert.equal(finalized.response.status, 200);
  assert.equal(finalized.payload.status, "Finalized");
  assert.equal(finalized.payload.finalizedBy, "BJ Tarves");
  assert.match(finalized.payload.finalText, /Recovery minutes/);
  assert.match(finalized.payload.decisionRationale, /pre-read packet/);

  const persisted = finalized.payload.workspace.meetings[0].draftDiffs.find((diff) => diff.id === "diff-001");
  assert.equal(persisted.status, "Finalized");
  assert.equal(finalized.payload.workspace.auditLog[0].title, "Draft-to-final decision recorded");

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("preserves draft section version history while blocking family revisions", async (t) => {
  const { request } = await withApi(t);

  const created = await request("/api/drafts", {
    method: "POST",
    body: {
      profile: "Fictional learner with decoding needs and strong oral comprehension.",
      guidedResponses: {
        strengths: "Strong verbal comprehension and class discussion.",
        needs: "Inferential reading and organized written responses.",
        progressEvidence: "Weekly probes and rubric samples show baseline variance.",
        familyPriority: "Family wants supports that work across content classes.",
        studentVoice: "Student wants steps and examples of finished work."
      },
      annotatedSample: "Annotated sample: include condition, baseline, measurement method, frequency, and mastery criteria."
    }
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.status, "Draft - human review required");
  assert.equal(created.payload.guidedResponses.familyPriority, "Family wants supports that work across content classes.");
  assert.match(created.payload.annotatedSample, /Annotated sample/);
  const sectionIds = created.payload.sections.map((section) => section.id);
  assert.deepEqual(sectionIds, [
    "present-levels",
    "special-considerations",
    "measurable-goal",
    "short-term-objectives",
    "services-supports",
    "supplementary-aids",
    "assessment-accommodations",
    "behavior-support-plan",
    "transition-services",
    "placement-rationale"
  ]);
  const presentLevels = created.payload.sections.find((section) => section.id === "present-levels");
  const measurableGoal = created.payload.sections.find((section) => section.id === "measurable-goal");
  const servicesSupports = created.payload.sections.find((section) => section.id === "services-supports");
  const assessmentAccommodations = created.payload.sections.find((section) => section.id === "assessment-accommodations");
  const behaviorSupportPlan = created.payload.sections.find((section) => section.id === "behavior-support-plan");
  const placementRationale = created.payload.sections.find((section) => section.id === "placement-rationale");
  assert.match(presentLevels.content, /Strong verbal comprehension/);
  assert.match(servicesSupports.content, /Student wants steps/);
  assert.equal(measurableGoal.version, 1);
  assert.match(measurableGoal.content, /baseline, method, frequency/);
  assert.match(assessmentAccommodations.content, /assessment accommodations/i);
  assert.match(behaviorSupportPlan.content, /behavior/i);
  assert.match(placementRationale.content, /placement/i);

  const exportDenied = await request("/api/exports", {
    method: "POST",
    body: {
      label: "Draft training IEP sections",
      format: "docx",
      payload: created.payload
    }
  });
  assert.equal(exportDenied.response.status, 400);

  const parentDenied = await request(`/api/drafts/${created.payload.id}/sections/measurable-goal`, {
    method: "PATCH",
    role: "parent",
    body: {
      content: "Family cannot revise staff draft sections.",
      revisionNote: "Denied"
    }
  });
  assert.equal(parentDenied.response.status, 403);

  const parentRegenerateDenied = await request(`/api/drafts/${created.payload.id}/sections/measurable-goal/regenerate`, {
    method: "POST",
    role: "parent",
    body: {
      guidance: "Family cannot regenerate staff draft sections."
    }
  });
  assert.equal(parentRegenerateDenied.response.status, 403);

  const invalid = await request(`/api/drafts/${created.payload.id}/sections/measurable-goal`, {
    method: "PATCH",
    body: {
      revisionNote: "Missing revised language"
    }
  });
  assert.equal(invalid.response.status, 400);

  const revised = await request(`/api/drafts/${created.payload.id}/sections/measurable-goal`, {
    method: "PATCH",
    body: {
      content: "By June 2027, Jordan will answer inferential comprehension questions with 80% accuracy across three probes.",
      revisionNote: "Added criterion, timeline, and measurement method for review."
    }
  });
  assert.equal(revised.response.status, 200);
  assert.equal(revised.payload.version, 2);
  assert.equal(revised.payload.reviewedBy, "BJ Tarves");
  assert.equal(revised.payload.versionHistory.length, 1);
  assert.match(revised.payload.versionHistory[0].content, /baseline, method, frequency/);
  assert.match(revised.payload.revisionNote, /criterion/);

  const persisted = revised.payload.workspace.draft.sections.find((section) => section.id === "measurable-goal");
  assert.equal(persisted.version, 2);
  assert.equal(revised.payload.workspace.auditLog[0].title, "Draft section revised");

  const parentApprovalDenied = await request(`/api/drafts/${created.payload.id}/approve`, {
    method: "POST",
    role: "parent"
  });
  assert.equal(parentApprovalDenied.response.status, 403);

  const firstApproval = await request(`/api/drafts/${created.payload.id}/approve`, { method: "POST" });
  assert.equal(firstApproval.response.status, 200);
  assert.equal(firstApproval.payload.status, "Approved for export");
  assert.equal(firstApproval.payload.approvedBy, "BJ Tarves");
  assert.equal(firstApproval.payload.workspace.auditLog[0].title, "Draft package approved");

  const regenerated = await request(`/api/drafts/${created.payload.id}/sections/measurable-goal/regenerate`, {
    method: "POST",
    body: {
      guidance: "Regenerate with a clearer baseline and progress-review schedule."
    }
  });
  assert.equal(regenerated.response.status, 200);
  assert.equal(regenerated.payload.version, 3);
  assert.equal(regenerated.payload.status, "Regenerated - human review required");
  assert.match(regenerated.payload.content, /Regenerated from profile/);
  assert.match(regenerated.payload.content, /progress-review schedule/);
  assert.equal(regenerated.payload.reviewedBy, "BJ Tarves");
  assert.equal(regenerated.payload.versionHistory.length, 2);
  assert.match(regenerated.payload.versionHistory[0].content, /By June 2027/);
  assert.equal(regenerated.payload.workspace.draft.status, "Regenerated - human review required");
  assert.equal(regenerated.payload.workspace.draft.approvedBy, null);
  assert.equal(regenerated.payload.workspace.auditLog[0].title, "Draft section regenerated");

  const exportDeniedAfterRegenerate = await request("/api/exports", {
    method: "POST",
    body: {
      label: "Draft training IEP sections",
      format: "docx",
      payload: regenerated.payload.workspace.draft
    }
  });
  assert.equal(exportDeniedAfterRegenerate.response.status, 400);

  const approved = await request(`/api/drafts/${created.payload.id}/approve`, { method: "POST" });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.payload.status, "Approved for export");
  assert.equal(approved.payload.approvedBy, "BJ Tarves");
  assert.equal(approved.payload.sections.find((section) => section.id === "measurable-goal").version, 3);

  const exported = await request("/api/exports", {
    method: "POST",
    body: {
      label: "Draft training IEP sections",
      format: "docx",
      payload: approved.payload
    }
  });
  assert.equal(exported.response.status, 201);
  assert.match(exported.payload.artifact.fileName, /^draft-training-iep-sections-.*\.docx$/);

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("tracks concern submissions and staff decision records", async (t) => {
  const { request } = await withApi(t);

  const submitted = await request("/api/meetings/meeting-001/concerns", {
    method: "POST",
    role: "parent",
    body: {
      title: "Recovery communication",
      concern: "Please document when missed speech-language service minutes will be recovered."
    }
  });
  assert.equal(submitted.response.status, 201);
  assert.match(submitted.payload.id, /^concern-/);
  assert.equal(submitted.payload.status, "Open");
  assert.equal(submitted.payload.submittedBy, "Robin Lee");
  assert.equal(submitted.payload.workspace.meetings[0].concerns[0].title, "Recovery communication");

  const teacherDenied = await request(`/api/meetings/concerns/${submitted.payload.id}`, {
    method: "PATCH",
    role: "generalEducation",
    body: {
      response: "Teacher cannot resolve.",
      decision: "No decision.",
      nextStep: "No next step."
    }
  });
  assert.equal(teacherDenied.response.status, 403);

  const resolved = await request(`/api/meetings/concerns/${submitted.payload.id}`, {
    method: "PATCH",
    role: "caseManager",
    body: {
      response: "The team reviewed missed service documentation.",
      decision: "Recovery minutes will be scheduled without changing service frequency.",
      nextStep: "Case manager will send the recovery date to the family.",
      priorWrittenNotice: "PWN review is only needed if the team proposes or refuses a formal service change."
    }
  });
  assert.equal(resolved.response.status, 200);
  assert.equal(resolved.payload.status, "Resolved");
  assert.equal(resolved.payload.resolvedBy, "BJ Tarves");
  assert.match(resolved.payload.decision, /Recovery minutes/);
  assert.match(resolved.payload.workspace.meetings[0].concerns[0].priorWrittenNotice, /PWN review/);

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.payload.valid, true);
});

test("limits advisory quality resolution to authorized reviewer roles", async (t) => {
  const { request } = await withApi(t);

  const generateDenied = await request("/api/review-flags/generate", {
    method: "POST",
    role: "parent"
  });
  assert.equal(generateDenied.response.status, 403);

  const generated = await request("/api/review-flags/generate", {
    method: "POST",
    role: "administrator"
  });
  assert.equal(generated.response.status, 200);
  assert.ok(generated.payload.generatedCount >= 1);
  assert.ok(generated.payload.generatedFlags.every((flag) => flag.humanReviewRequired));
  assert.ok(generated.payload.generatedFlags.some((flag) => flag.generatedRule === "behavior-need-without-plan"));
  assert.ok(
    generated.payload.workspace.reviewFlags.some((flag) => flag.generatedRule === "behavior-need-without-plan")
  );

  const parentDenied = await request("/api/review-flags/flag-001/resolve", {
    method: "POST",
    role: "parent"
  });
  assert.equal(parentDenied.response.status, 403);

  const missingDisposition = await request("/api/review-flags/flag-001/resolve", {
    method: "POST",
    role: "administrator",
    body: { decision: "Reviewed - follow-up assigned" }
  });
  assert.equal(missingDisposition.response.status, 400);

  const resolved = await request("/api/review-flags/flag-001/resolve", {
    method: "POST",
    role: "administrator",
    body: {
      decision: "Reviewed - follow-up assigned",
      rationale: "Recovery planning was assigned to the service provider and case manager.",
      nextAction: "Confirm the recovery date with the family before the meeting."
    }
  });
  assert.equal(resolved.response.status, 200);
  assert.equal(resolved.payload.status, "Resolved");
  assert.equal(resolved.payload.resolvedBy, "D. Nguyen");
  assert.equal(resolved.payload.resolution.reviewerRole, "administrator");
  assert.match(resolved.payload.resolution.rationale, /Recovery planning/);
  assert.match(resolved.payload.resolution.nextAction, /family/);
});

test("runs administrator AI guardrail evaluations with source and human-review evidence", async (t) => {
  const { request } = await withApi(t);

  const denied = await request("/api/ai-governance/evaluations", {
    method: "POST",
    role: "caseManager",
    body: {
      evaluationScope: "FDS core AI guardrails",
      reviewerNote: "Case managers cannot run governance evaluations."
    }
  });
  assert.equal(denied.response.status, 403);

  const citationDenied = await request("/api/ai-governance/citation-evaluations", {
    method: "POST",
    role: "caseManager",
    body: {
      outputLabel: "Family summary citation review",
      outputText: "Draft output. Source references: Services",
      citations: "Services",
      reviewerNote: "Case managers cannot run citation governance evaluations."
    }
  });
  assert.equal(citationDenied.response.status, 403);

  const evaluated = await request("/api/ai-governance/evaluations", {
    method: "POST",
    role: "administrator",
    body: {
      evaluationScope: "FDS core AI guardrails",
      reviewerNote: "Evaluate source traceability, content labels, restricted-request refusals, and human-review boundaries."
    }
  });
  assert.equal(evaluated.response.status, 201);
  assert.equal(evaluated.payload.status, "Passed");
  assert.equal(evaluated.payload.score, 100);
  assert.equal(evaluated.payload.passedChecks, evaluated.payload.totalChecks);
  assert.match(evaluated.payload.evaluationDigest, /^[a-f0-9]{64}$/);
  assert.ok(evaluated.payload.checks.some((check) => check.id === "source-traceability" && check.status === "Passed"));
  assert.ok(evaluated.payload.checks.some((check) => check.id === "restricted-decisions" && check.status === "Passed"));
  assert.equal(evaluated.payload.modelProfile.promptVersion, "fds-ai-guardrails-2026.06");
  assert.equal(evaluated.payload.workspace.aiGovernance.evaluationRuns[0].id, evaluated.payload.id);
  assert.equal(evaluated.payload.workspace.aiGovernance.modelProfile.lastEvaluationStatus, "Passed");
  assert.equal(evaluated.payload.workspace.auditLog[0].title, "AI guardrail evaluation completed");

  const citationEvaluated = await request("/api/ai-governance/citation-evaluations", {
    method: "POST",
    role: "administrator",
    body: {
      outputLabel: "Family summary citation review",
      outputText:
        "Draft family summary for human review: Jordan's reading goal uses weekly probes and service language remains tied to the approved IEP. This is not official IEP language and does not change services. Source references: Prior IEP comparison note and current Goal 1 progress data; Services",
      citations: "Prior IEP comparison note and current Goal 1 progress data\nServices",
      reviewerNote: "Citation matches were reviewed before sharing AI-assisted family language."
    }
  });
  assert.equal(citationEvaluated.response.status, 201);
  assert.equal(citationEvaluated.payload.status, "Passed");
  assert.equal(citationEvaluated.payload.score, 100);
  assert.match(citationEvaluated.payload.citationDigest, /^[a-f0-9]{64}$/);
  assert.equal(citationEvaluated.payload.matchedSources.length, 2);
  assert.ok(citationEvaluated.payload.checks.some((check) => check.id === "citations-match-workspace" && check.status === "Passed"));
  assert.match(citationEvaluated.payload.officialRecordImpact, /does not certify legal compliance/);
  assert.equal(citationEvaluated.payload.workspace.aiGovernance.citationEvaluations[0].id, citationEvaluated.payload.id);
  assert.equal(citationEvaluated.payload.workspace.aiGovernance.modelProfile.lastCitationEvaluationStatus, "Passed");
  assert.equal(citationEvaluated.payload.workspace.auditLog[0].title, "AI citation evaluation completed");

  const verifyResult = await request("/api/audit/verify", { role: "administrator" });
  assert.equal(verifyResult.payload.valid, true);
});

test("tracks formal compliance review escalation and administrator outcome", async (t) => {
  const { request } = await withApi(t);

  const parentDenied = await request("/api/review-flags/flag-001/compliance-reviews", {
    method: "POST",
    role: "parent",
    body: {
      reviewType: "Implementation compliance review",
      assignedReviewer: "D. Nguyen",
      dueDate: "2026-06-28",
      rationale: "Family users cannot request a formal district review from the workspace.",
      nextAction: "No action."
    }
  });
  assert.equal(parentDenied.response.status, 403);

  const requested = await request("/api/review-flags/flag-001/compliance-reviews", {
    method: "POST",
    role: "caseManager",
    body: {
      reviewType: "Implementation compliance review",
      assignedReviewer: "D. Nguyen",
      dueDate: "2026-06-28",
      rationale: "High-severity missed-service finding needs administrator review before meeting materials are finalized.",
      nextAction: "Confirm recovery plan and family communication before annual review."
    }
  });
  assert.equal(requested.response.status, 201);
  assert.equal(requested.payload.status, "Requested");
  assert.equal(requested.payload.assignedReviewer, "D. Nguyen");
  assert.equal(requested.payload.notLegalCertification, true);
  assert.equal(requested.payload.workspace.complianceReviews[0].id, requested.payload.id);
  assert.equal(requested.payload.workspace.auditLog[0].title, "Compliance review requested");

  const staffDenied = await request(`/api/compliance-reviews/${requested.payload.id}`, {
    method: "PATCH",
    role: "caseManager",
    body: {
      status: "Closed - reviewed",
      outcome: "Case manager cannot close this formal review.",
      reviewerNote: "No note.",
      nextAction: "No action."
    }
  });
  assert.equal(staffDenied.response.status, 403);

  const completed = await request(`/api/compliance-reviews/${requested.payload.id}`, {
    method: "PATCH",
    role: "administrator",
    body: {
      status: "Closed - reviewed",
      outcome: "Reviewed as an implementation follow-up item; this is not a legal certification.",
      reviewerNote: "Recovery plan must cite source requirements, owner, dates, and family communication.",
      nextAction: "Document recovery date and communication before the meeting packet is finalized."
    }
  });
  assert.equal(completed.response.status, 200);
  assert.equal(completed.payload.status, "Closed - reviewed");
  assert.equal(completed.payload.reviewedBy, "D. Nguyen");
  assert.equal(completed.payload.reviewedByRole, "administrator");
  assert.match(completed.payload.outcome, /not a legal certification/);
  assert.equal(completed.payload.workspace.auditLog[0].title, "Compliance review outcome recorded");

  const legalRouteDenied = await request(`/api/compliance-reviews/${requested.payload.id}/legal-routes`, {
    method: "POST",
    role: "caseManager",
    body: {
      counselName: "District counsel office",
      reviewScope: "Review packet language before district action.",
      routingReason: "Case manager cannot route records to district counsel.",
      dueDate: "2026-06-30",
      districtPolicyReference: "Riverbend special education review protocol 2026"
    }
  });
  assert.equal(legalRouteDenied.response.status, 403);

  const routed = await request(`/api/compliance-reviews/${requested.payload.id}/legal-routes`, {
    method: "POST",
    role: "administrator",
    body: {
      counselName: "District counsel office",
      reviewScope: "Review whether recovery language and meeting packet notes need district counsel input.",
      routingReason: "Administrator wants counsel input before final district action is documented.",
      dueDate: "2026-06-30",
      districtPolicyReference: "Riverbend special education review protocol 2026"
    }
  });
  assert.equal(routed.response.status, 201);
  assert.equal(routed.payload.status, "Routed to counsel");
  assert.equal(routed.payload.counselName, "District counsel office");
  assert.match(routed.payload.routeDigest, /^[a-f0-9]{64}$/);
  assert.match(routed.payload.notLegalCertification, /final legal advice/);
  assert.equal(routed.payload.workspace.legalReviewRoutes[0].id, routed.payload.id);
  assert.equal(
    routed.payload.workspace.complianceReviews.find((review) => review.id === requested.payload.id).legalRouteStatus,
    "Routed to counsel"
  );
  assert.equal(routed.payload.workspace.auditLog[0].title, "District counsel review routed");

  const counselOutcome = await request(`/api/legal-review-routes/${routed.payload.id}`, {
    method: "PATCH",
    role: "administrator",
    body: {
      status: "Counsel response recorded",
      counselSummary: "Counsel reviewed the routing record and identified district follow-through steps.",
      recommendedAction: "Document district action separately and update the meeting packet after human review.",
      reviewerNote: "Workspace stores counsel-response metadata only; legal advice remains in district counsel records."
    }
  });
  assert.equal(counselOutcome.response.status, 200);
  assert.equal(counselOutcome.payload.status, "Counsel response recorded");
  assert.equal(counselOutcome.payload.reviewedByRole, "administrator");
  assert.match(counselOutcome.payload.outcomeDigest, /^[a-f0-9]{64}$/);
  assert.equal(
    counselOutcome.payload.workspace.complianceReviews.find((review) => review.id === requested.payload.id).legalRouteStatus,
    "Counsel response recorded"
  );
  assert.equal(
    counselOutcome.payload.workspace.complianceReviews.find((review) => review.id === requested.payload.id).nextAction,
    "Document district action separately and update the meeting packet after human review."
  );
  assert.equal(counselOutcome.payload.workspace.auditLog[0].title, "District counsel response recorded");

  const verifyResult = await request("/api/audit/verify", { role: "administrator" });
  assert.equal(verifyResult.payload.valid, true);
});

test("generates server-side DOCX and PDF export artifacts with download metadata", async (t) => {
  const { baseUrl, dataDir, request, tokenForRole } = await withApi(t);

  const exported = await request("/api/exports", {
    method: "POST",
    body: {
      label: "Teacher checklist",
      format: "docx",
      payload: {
        title: "Teacher checklist",
        sections: [
          {
            heading: "Required classroom supports",
            bullets: ["Provide written directions.", "Offer graphic organizer."]
          }
        ]
      }
    }
  });

  assert.equal(exported.response.status, 201);
  assert.equal(exported.payload.format, "docx");
  assert.match(exported.payload.artifact.fileName, /^teacher-checklist-.*\.docx$/);
  assert.ok(exported.payload.artifact.sha256);
  assert.equal(exported.payload.downloadUrl, `/api/exports/${exported.payload.id}/download`);

  const stored = await readFile(join(dataDir, exported.payload.artifact.preservedPath));
  assert.equal(stored.subarray(0, 2).toString("utf8"), "PK");

  const download = await fetch(`${baseUrl}${exported.payload.downloadUrl}`, {
    headers: { authorization: `Bearer ${await tokenForRole("caseManager")}` }
  });
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition"), /teacher-checklist/);
  const downloaded = Buffer.from(await download.arrayBuffer());
  assert.equal(Buffer.compare(downloaded, stored), 0);

  const workspace = await request("/api/workspace");
  assert.equal(workspace.payload.workspace.exports[0].format, "docx");
  assert.equal(workspace.payload.workspace.exports[0].payloadSummary.kind, "object");

  const pdfExported = await request("/api/exports", {
    method: "POST",
    body: {
      label: "Progress report draft",
      format: "pdf",
      payload: {
        title: "Progress report draft",
        sections: [
          {
            heading: "Reading fluency goal",
            bullets: ["Baseline: 92 correct words per minute.", "Current: 108 correct words per minute."]
          }
        ]
      }
    }
  });

  assert.equal(pdfExported.response.status, 201);
  assert.equal(pdfExported.payload.format, "pdf");
  assert.match(pdfExported.payload.artifact.fileName, /^progress-report-draft-.*\.pdf$/);
  assert.equal(pdfExported.payload.artifact.mimeType, "application/pdf");
  assert.ok(pdfExported.payload.artifact.sha256);

  const storedPdf = await readFile(join(dataDir, pdfExported.payload.artifact.preservedPath));
  assert.equal(storedPdf.subarray(0, 8).toString("utf8"), "%PDF-1.4");
  assert.match(storedPdf.toString("utf8"), /Progress report draft/);
  assert.match(storedPdf.toString("utf8"), /Page 1 of/);

  const pdfDownload = await fetch(`${baseUrl}${pdfExported.payload.downloadUrl}`, {
    headers: { authorization: `Bearer ${await tokenForRole("caseManager")}` }
  });
  assert.equal(pdfDownload.status, 200);
  assert.equal(pdfDownload.headers.get("content-type"), "application/pdf");
  assert.match(pdfDownload.headers.get("content-disposition"), /progress-report-draft/);
  const downloadedPdf = Buffer.from(await pdfDownload.arrayBuffer());
  assert.equal(Buffer.compare(downloadedPdf, storedPdf), 0);

  const updatedWorkspace = await request("/api/workspace");
  assert.equal(updatedWorkspace.payload.workspace.exports[0].format, "pdf");
  assert.equal(updatedWorkspace.payload.workspace.exports[0].artifact.fileName, pdfExported.payload.artifact.fileName);

  const districtExported = await request("/api/exports", {
    method: "POST",
    body: {
      label: "District system package",
      format: "json",
      payload: {
        packageType: "DistrictSystemImportPackage",
        studentId: "student-001"
      }
    }
  });

  assert.equal(districtExported.response.status, 201);
  assert.equal(districtExported.payload.format, "json");
  assert.match(districtExported.payload.artifact.fileName, /^district-system-package-.*\.json$/);
  assert.equal(districtExported.payload.artifact.mimeType, "application/json; charset=utf-8");

  const storedDistrictPackage = JSON.parse(
    await readFile(join(dataDir, districtExported.payload.artifact.preservedPath), "utf8")
  );
  assert.equal(storedDistrictPackage.payload.packageType, "DistrictSystemImportPackage");
  assert.equal(storedDistrictPackage.payload.student.id, "student-001");
  assert.equal(storedDistrictPackage.payload.iep.extractionApproved, true);
  assert.equal(storedDistrictPackage.payload.importProfile.officialSubmission, false);
  assert.match(storedDistrictPackage.payload.importProfile.guardrail, /not an automated official IEP submission/);
  assert.equal(storedDistrictPackage.payload.validation.requiredSections, schemaSections.length);
  assert.equal(storedDistrictPackage.payload.validation.sectionCoverage.length, schemaSections.length);
  assert.equal(storedDistrictPackage.payload.sourceRegistry.activeSourceId, "pa-school-age-iep-non-annotated");
  assert.ok(storedDistrictPackage.payload.packageDigest);

  const districtDownload = await fetch(`${baseUrl}${districtExported.payload.downloadUrl}`, {
    headers: { authorization: `Bearer ${await tokenForRole("caseManager")}` }
  });
  assert.equal(districtDownload.status, 200);
  assert.match(districtDownload.headers.get("content-disposition"), /district-system-package/);

  const districtWorkspace = await request("/api/workspace");
  assert.equal(districtWorkspace.payload.workspace.exports[0].label, "District system package");
  assert.equal(districtWorkspace.payload.workspace.exports[0].format, "json");

  const deniedTemplateReview = await request("/api/exports/template-reviews", {
    method: "POST",
    role: "caseManager",
    body: {
      exportId: districtExported.payload.id,
      targetSystem: "District IEP system compatible JSON interchange",
      templateName: "District system package",
      templateVersion: "IEP-IW-district-json-0.1",
      mappingEvidence: "Case managers cannot approve district export mappings.",
      validationEvidence: "Denied before validation evidence is accepted.",
      reviewNote: "Denied before review note is accepted."
    }
  });
  assert.equal(deniedTemplateReview.response.status, 403);

  const templateReview = await request("/api/exports/template-reviews", {
    method: "POST",
    role: "districtAdministrator",
    body: {
      exportId: districtExported.payload.id,
      targetSystem: "District IEP system compatible JSON interchange",
      templateName: "District system package",
      templateVersion: "IEP-IW-district-json-0.1",
      validationStatus: "District import review ready",
      mappingStatus: "Required sections mapped",
      submissionMode: "District import review",
      requiredSections: schemaSections.length,
      mappedSections: schemaSections.length,
      mappingEvidence:
        "Generated package includes FDS section coverage, source registry metadata, goals, services, accommodations, implementation tasks, and audit context.",
      validationEvidence: "Local package validation passed; live district IEP-system import validation remains pending.",
      reviewNote: "District export template mapping is ready for import review only, not official submission.",
      nextReviewDate: "2026-08-15"
    }
  });
  assert.equal(templateReview.response.status, 201);
  assert.equal(templateReview.payload.exportId, districtExported.payload.id);
  assert.equal(templateReview.payload.validationStatus, "District import review ready");
  assert.equal(templateReview.payload.mappingStatus, "Required sections mapped");
  assert.equal(templateReview.payload.packageFileName, districtExported.payload.artifact.fileName);
  assert.equal(templateReview.payload.packageSha256, districtExported.payload.artifact.sha256);
  assert.match(templateReview.payload.templateDigest, /^[a-f0-9]{64}$/);
  assert.match(templateReview.payload.productionBoundary, /does not submit to a district system/);
  assert.equal(templateReview.payload.workspace.exportTemplateReviews[0].id, templateReview.payload.id);
  assert.equal(templateReview.payload.workspace.auditLog[0].title, "Export template reviewed");

  const parentWorkspace = await request("/api/workspace", { role: "parent" });
  assert.equal(parentWorkspace.payload.workspace.exportTemplateReviews.length, 0);

  const verifyResult = await request("/api/audit/verify", { role: "districtAdministrator" });
  assert.equal(verifyResult.payload.valid, true);
});

test("detects audit-log tampering", async (t) => {
  const { dataDir, request } = await withApi(t);

  const update = await request("/api/tasks/task-002/toggle", {
    method: "POST",
    role: "generalEducation"
  });
  assert.equal(update.response.status, 200);

  const auditPath = join(dataDir, "audit-log.ndjson");
  const original = await readFile(auditPath, "utf8");
  await writeFile(auditPath, original.replace("Implementation task updated", "Implementation task altered"));

  const verifyResult = await request("/api/audit/verify");
  assert.equal(verifyResult.response.status, 200);
  assert.equal(verifyResult.payload.valid, false);
  assert.match(verifyResult.payload.reason, /Hash mismatch/);
});

function createDocxBuffer(paragraphs) {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs
      .map((paragraph) => `<w:p><w:r><w:t>${escapeXml(paragraph)}</w:t></w:r></w:p>`)
      .join("\n")}
  </w:body>
</w:document>`;

  return createStoredZip({
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
    "word/document.xml": documentXml
  });
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const entryList = Object.entries(entries);

  for (const [name, content] of entryList) {
    const nameBuffer = Buffer.from(name);
    const dataBuffer = Buffer.from(content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const localFiles = Buffer.concat(localParts);
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entryList.length, 8);
  end.writeUInt16LE(entryList.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localFiles.length, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localFiles, centralDirectory, end]);
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
