import { randomUUID } from "node:crypto";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export const demoUsers = [
  {
    id: "user-case-manager",
    username: "case-manager",
    password: "demo",
    name: "BJ Tarves",
    role: "caseManager",
    district: "Riverbend School District",
    districtId: "riverbend",
    studentIds: ["*"]
  },
  {
    id: "user-general-education",
    username: "general-ed",
    password: "demo",
    name: "Leah Kim",
    role: "generalEducation",
    district: "Riverbend School District",
    districtId: "riverbend",
    studentIds: ["student-001"]
  },
  {
    id: "user-related-service",
    username: "related-service",
    password: "demo",
    name: "R. Coleman",
    role: "relatedServiceProvider",
    district: "Riverbend School District",
    districtId: "riverbend",
    studentIds: ["student-001"]
  },
  {
    id: "user-parent",
    username: "parent",
    password: "demo",
    name: "Robin Lee",
    role: "parent",
    district: "Riverbend School District",
    districtId: "riverbend",
    studentIds: ["student-001"]
  },
  {
    id: "user-student",
    username: "student",
    password: "demo",
    name: "Jordan Lee",
    role: "student",
    district: "Riverbend School District",
    districtId: "riverbend",
    studentIds: ["student-001"]
  },
  {
    id: "user-administrator",
    username: "administrator",
    password: "demo",
    name: "D. Nguyen",
    role: "administrator",
    district: "Riverbend School District",
    districtId: "riverbend",
    studentIds: ["*"]
  },
  {
    id: "user-school-administrator",
    username: "school-admin",
    password: "demo",
    name: "M. Patel",
    role: "schoolAdministrator",
    district: "Riverbend School District",
    districtId: "riverbend",
    studentIds: ["*"]
  },
  {
    id: "user-district-administrator",
    username: "district-admin",
    password: "demo",
    name: "A. Morales",
    role: "districtAdministrator",
    district: "Riverbend School District",
    districtId: "riverbend",
    studentIds: ["*"]
  },
  {
    id: "user-system-administrator",
    username: "system-admin",
    password: "demo",
    name: "S. Carter",
    role: "systemAdministrator",
    district: "Riverbend School District",
    districtId: "riverbend",
    studentIds: []
  },
  {
    id: "user-read-only-reviewer",
    username: "read-only-reviewer",
    password: "demo",
    name: "N. Shah",
    role: "readOnlyReviewer",
    district: "Riverbend School District",
    districtId: "riverbend",
    studentIds: ["*"]
  }
];

export class DemoAuth {
  constructor({ users = demoUsers } = {}) {
    this.users = users;
    this.sessions = new Map();
  }

  login({ username, password }) {
    const normalized = String(username || "").trim().toLowerCase();
    const user = this.users.find((item) => item.username === normalized);
    if (!user || user.password !== password) throw authError("Invalid username or password.");

    const token = `iep_${randomUUID()}`;
    const sessionId = `session-${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const sessionUser = publicUser(user);
    this.sessions.set(token, {
      id: sessionId,
      token,
      user: sessionUser,
      createdAt,
      lastSeenAt: createdAt,
      expiresAt,
      status: "Active",
      authMethod: "Password demo",
      mfaVerified: false,
      revokedAt: "",
      revokedBy: "",
      revocationReason: ""
    });
    return { token, sessionId, expiresAt, user: sessionUser };
  }

  authenticate(request) {
    const token = bearerToken(request.headers.authorization);
    if (!token) throw authError("Authentication required.");
    const session = this.sessions.get(token);
    if (!session) throw authError("Session not found.");
    if (Date.parse(session.expiresAt) <= Date.now()) {
      this.sessions.delete(token);
      throw authError("Session expired.");
    }
    if (session.status !== "Active") throw authError("Session revoked.");
    session.lastSeenAt = new Date().toISOString();
    return session;
  }

  listSessions() {
    return Array.from(this.sessions.values())
      .map((session) => ({
        id: session.id,
        userId: session.user.id,
        userName: session.user.name,
        role: session.user.role,
        districtId: session.user.districtId,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
        status: session.status,
        authMethod: session.authMethod,
        mfaVerified: session.mfaVerified,
        revokedAt: session.revokedAt,
        revokedBy: session.revokedBy,
        revocationReason: session.revocationReason
      }))
      .sort((a, b) => String(b.lastSeenAt || b.createdAt).localeCompare(String(a.lastSeenAt || a.createdAt)));
  }

  revokeSession(sessionId, { revokedBy, reason } = {}) {
    const session = Array.from(this.sessions.values()).find((item) => item.id === sessionId);
    if (!session) return null;
    session.status = "Revoked";
    session.revokedAt = new Date().toISOString();
    session.revokedBy = revokedBy || "Security reviewer";
    session.revocationReason = reason || "Revoked during security review.";
    return this.listSessions().find((item) => item.id === sessionId);
  }
}

export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    district: user.district,
    districtId: user.districtId,
    studentIds: user.studentIds
  };
}

export function canAccessStudent(user, studentId) {
  if (!studentId) return false;
  return user.studentIds?.includes("*") || user.studentIds?.includes(studentId);
}

export function requireStudentAccess(user, studentId) {
  if (!canAccessStudent(user, studentId)) {
    const error = new Error("User is not assigned to this student record.");
    error.status = 403;
    error.code = "STUDENT_ACCESS_DENIED";
    throw error;
  }
}

const studentReviewRoles = new Set(["caseManager", "administrator", "schoolAdministrator", "districtAdministrator", "readOnlyReviewer"]);
const staffReviewRoles = new Set([
  "caseManager",
  "administrator",
  "schoolAdministrator",
  "districtAdministrator",
  "readOnlyReviewer",
  "generalEducation",
  "relatedServiceProvider"
]);
const leadershipContinuityRoles = new Set(["caseManager", "administrator", "schoolAdministrator", "districtAdministrator", "readOnlyReviewer"]);
const securityGovernanceRoles = new Set(["administrator", "systemAdministrator"]);
const districtConfigurationRoles = new Set(["administrator", "districtAdministrator", "systemAdministrator"]);
const exportTemplateReviewRoles = new Set(["administrator", "districtAdministrator", "systemAdministrator"]);
const portalAccessReviewRoles = new Set(["caseManager", "administrator", "schoolAdministrator", "districtAdministrator", "readOnlyReviewer"]);

export function filterWorkspaceForUser(workspace, user) {
  const visibleStudentIds = visibleIds(user, workspace.students.map((student) => student.id));
  const visibleSet = new Set(visibleStudentIds);
  const visibleIepIds = new Set((workspace.ieps || []).filter((iep) => visibleSet.has(iep.studentId)).map((iep) => iep.id));
  const currentStudentId = visibleSet.has(workspace.currentStudentId) ? workspace.currentStudentId : visibleStudentIds[0] || null;

  return {
    ...workspace,
    user: {
      ...workspace.user,
      ...publicUser(user)
    },
    currentStudentId,
    students: (workspace.students || []).filter((student) => visibleSet.has(student.id)),
    documents: (workspace.documents || []).filter((document) => visibleSet.has(document.studentId)),
    ieps: (workspace.ieps || []).filter((iep) => visibleSet.has(iep.studentId)),
    goals: (workspace.goals || []).filter((goal) => visibleIepIds.has(goal.iepId)),
    services: (workspace.services || []).filter((service) => visibleIepIds.has(service.iepId)),
    accommodations: (workspace.accommodations || []).filter((accommodation) => visibleIepIds.has(accommodation.iepId)),
    accessSupportPlans: (workspace.accessSupportPlans || []).filter((support) => visibleSet.has(support.studentId)),
    placementReviews: (workspace.placementReviews || []).filter((review) => visibleSet.has(review.studentId)),
    portalAccessReviews: canViewPortalAccessReview(user.role)
      ? (workspace.portalAccessReviews || []).filter((review) => visibleSet.has(review.studentId))
      : [],
    portalInvitationPackages: canViewPortalAccessReview(user.role)
      ? (workspace.portalInvitationPackages || []).filter((invitation) => visibleSet.has(invitation.studentId))
      : [],
    tasks: (workspace.tasks || []).filter((task) => visibleSet.has(task.studentId)),
    meetings: (workspace.meetings || []).filter((meeting) => visibleSet.has(meeting.studentId)),
    teamComments: (workspace.teamComments || [])
      .filter((comment) => visibleSet.has(comment.studentId) && canViewTeamComment(user.role, comment.visibility))
      .map((comment) => ({
        ...comment,
        replies: (comment.replies || []).filter((reply) => canViewTeamComment(user.role, reply.visibility))
      })),
    teamCommentQueueReviews: canViewTeamCommentQueueReview(user.role)
      ? (workspace.teamCommentQueueReviews || []).filter((review) => visibleSet.has(review.studentId))
      : [],
    iepComparisons: (workspace.iepComparisons || []).filter(
      (comparison) => visibleSet.has(comparison.studentId) && canViewIepComparison(user.role, comparison)
    ),
    meetingTranscriptSummaries: (workspace.meetingTranscriptSummaries || []).filter(
      (summary) => visibleSet.has(summary.studentId) && canViewMeetingTranscriptSummary(user.role, summary)
    ),
    meetingRecordingReviews: (workspace.meetingRecordingReviews || []).filter(
      (review) => visibleSet.has(review.studentId) && canViewMeetingRecordingReview(user.role, review)
    ),
    calendarEvents: (workspace.calendarEvents || []).filter((event) => visibleSet.has(event.studentId)),
    reviewFlags: (workspace.reviewFlags || []).filter((flag) => visibleSet.has(flag.studentId)),
    complianceReviews: (workspace.complianceReviews || []).filter((review) => visibleSet.has(review.studentId)),
    legalReviewRoutes: (workspace.legalReviewRoutes || []).filter((route) => visibleSet.has(route.studentId)),
    staffContinuity: canViewLeadershipContinuity(user.role)
      ? (workspace.staffContinuity || []).filter((record) =>
          (record.affectedStudentIds || []).some((studentId) => visibleSet.has(studentId))
        )
      : [],
    reminderReviews: (workspace.reminderReviews || []).filter(
      (review) =>
        review.reviewedByUserId === user.id &&
        (!review.studentId || visibleSet.has(review.studentId))
    ),
    notificationDeliveries: (workspace.notificationDeliveries || []).filter(
      (delivery) => visibleSet.has(delivery.studentId) && canViewNotificationAudience(user.role, delivery.audience)
    ),
    summaryComprehensionChecks: (workspace.summaryComprehensionChecks || []).filter(
      (check) => visibleSet.has(check.studentId) && canViewSummaryAudience(user.role, check.audience)
    ),
    summaryHandouts: (workspace.summaryHandouts || []).filter(
      (handout) => visibleSet.has(handout.studentId) && canViewSummaryAudience(user.role, handout.audience)
    ),
    securityPosture: canViewSecurityGovernance(user.role) ? workspace.securityPosture : null,
    securityReviews: canViewSecurityGovernance(user.role) ? (workspace.securityReviews || []) : [],
    districtConfiguration: canViewDistrictConfiguration(user.role)
      ? workspace.districtConfiguration
      : publicDistrictConfiguration(workspace.districtConfiguration),
    auditAnchors: canViewSecurityGovernance(user.role) ? (workspace.auditAnchors || []) : [],
    auditRetentionPackages: canViewSecurityGovernance(user.role) ? (workspace.auditRetentionPackages || []) : [],
    retentionPolicyReviews: canViewRetentionPolicyReviews(user.role) ? (workspace.retentionPolicyReviews || []) : [],
    exportTemplateReviews: canViewExportTemplateReviews(user.role) ? (workspace.exportTemplateReviews || []) : [],
    securitySessions: []
  };
}

function visibleIds(user, allIds) {
  if (user.studentIds?.includes("*")) return allIds;
  return allIds.filter((id) => user.studentIds?.includes(id));
}

function canViewSummaryAudience(role, audience) {
  if (studentReviewRoles.has(role)) return true;
  return {
    generalEducation: "teacher",
    relatedServiceProvider: "teacher",
    parent: "parent",
    student: "student"
  }[role] === audience;
}

function canViewLeadershipContinuity(role) {
  return leadershipContinuityRoles.has(role);
}

function canViewNotificationAudience(role, audience) {
  if (studentReviewRoles.has(role)) return true;
  if (role === "parent") return audience === "family" || audience === "team";
  if (role === "student") return audience === "student" || audience === "team";
  if (role === "generalEducation" || role === "relatedServiceProvider") return audience === "staff" || audience === "team";
  return false;
}

function canViewTeamComment(role, visibility = "IEP team") {
  if (visibility === "IEP team") return true;
  if (staffReviewRoles.has(role)) return true;
  if (role === "parent") return visibility === "Family visible";
  if (role === "student") return visibility === "Student visible";
  return false;
}

function canViewTeamCommentQueueReview(role) {
  return staffReviewRoles.has(role);
}

function canViewIepComparison(role, comparison = {}) {
  if (staffReviewRoles.has(role)) return true;
  if (role === "parent") return comparison.familyVisible !== false;
  if (role === "student") return comparison.studentVisible === true;
  return false;
}

function canViewMeetingTranscriptSummary(role, summary = {}) {
  if (staffReviewRoles.has(role)) return true;
  if (role === "parent") return summary.familyVisible !== false;
  if (role === "student") return summary.studentVisible === true;
  return false;
}

function canViewMeetingRecordingReview(role, review = {}) {
  if (staffReviewRoles.has(role)) return true;
  if (role === "parent") return review.familyVisible !== false;
  if (role === "student") return review.studentVisible === true;
  return false;
}

function canViewPortalAccessReview(role) {
  return portalAccessReviewRoles.has(role);
}

function canViewSecurityGovernance(role) {
  return securityGovernanceRoles.has(role);
}

function canViewDistrictConfiguration(role) {
  return districtConfigurationRoles.has(role);
}

function canViewRetentionPolicyReviews(role) {
  return districtConfigurationRoles.has(role);
}

function canViewExportTemplateReviews(role) {
  return exportTemplateReviewRoles.has(role);
}

function publicDistrictConfiguration(configuration = {}) {
  return {
    districtId: configuration?.districtId || "",
    districtName: configuration?.districtName || "",
    jurisdiction: configuration?.jurisdiction || "",
    configurationVersion: configuration?.configurationVersion || "",
    tenancyMode: configuration?.tenancyMode || "",
    dataResidency: "Restricted to administrator review",
    registryGovernanceStatus: configuration?.registryGovernanceStatus || "",
    integrationReadiness: [],
    dataProtectionReadiness: [],
    configurationReviews: []
  };
}

function bearerToken(value) {
  const match = String(value || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function authError(message) {
  const error = new Error(message);
  error.status = 401;
  error.code = "UNAUTHENTICATED";
  return error;
}
