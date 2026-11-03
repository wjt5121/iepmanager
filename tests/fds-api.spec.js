import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createExportArtifact } from "../server/exportArtifacts.js";

const API_BASE_URL = "http://127.0.0.1:8789";

async function reset(page) {
  await page.addInitScript(() => localStorage.clear());
  const response = await page.request.post(`${API_BASE_URL}/api/test/reset`);
  if (!response.ok()) throw new Error(`Unable to reset API test data: ${response.status()}`);
  await page.goto("/");
  await expect(page.locator(".sync-pill strong")).toHaveText("API-backed workspace", { timeout: 15000 });
}

async function nav(page, label) {
  await page.locator(".navbtn").filter({ hasText: label }).click();
}

async function expectToast(page, message) {
  await expect(page.locator(".toast")).toContainText(message, { timeout: 15000 });
}

test.describe("API-backed workspace integration", () => {
  test("persists implementation workflow changes through the local API", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API persistence coverage runs on desktop.");
    await reset(page);

    const reminder = page.locator(".reminder-row").first();
    await expect(page.getByText("Reminder center")).toBeVisible();
    await reminder.getByRole("button", { name: "Mark reviewed" }).click();
    await expect(page.getByText("Reminder reviewed")).toBeVisible();

    let apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.reminderReviews.length).toBe(1);
    expect(apiWorkspace.auditLog[0].title).toBe("Implementation reminder reviewed");

    await nav(page, "Implementation");
    const task = page.locator(".task").filter({ hasText: "Assign speech-language service recovery plan" });
    await task.locator(".task-check").click();
    await expect(page.getByText("Task updated")).toBeVisible();
    await expect(task).toHaveClass(/done/);

    apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.tasks.find((item) => item.id === "task-001").status).toBe("Completed");
    expect(apiWorkspace.auditLog[0].title).toBe("Implementation task updated");

    await page.reload();
    await expect(page.locator(".sync-pill strong")).toHaveText("API-backed workspace");
    await nav(page, "Implementation");
    await expect(page.locator(".task").filter({ hasText: "Assign speech-language service recovery plan" })).toHaveClass(/done/);

    const auditStatus = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/audit/verify`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return response.json();
    }, API_BASE_URL);
    expect(auditStatus.valid).toBe(true);
  });

  test("persists reminder notification delivery through the dashboard", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed notification coverage runs on desktop.");
    await reset(page);

    await expect(page.getByText("Notification outbox")).toBeVisible();
    await page.getByLabel("Notification source").selectOption({ index: 0 });
    await page.getByLabel("Notification audience").selectOption("family");
    await page.getByLabel("Notification channel").selectOption("Email");
    await page.getByLabel("Notification message").fill("Please review the overdue progress reminder before the IEP meeting.");
    await page.getByRole("button", { name: "Send notice" }).click();
    await expect(page.getByText("Notification sent")).toBeVisible();
    await expect(page.locator(".question-row").filter({ hasText: "overdue progress reminder" })).toBeVisible();

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.notificationDeliveries[0].channel).toBe("Email");
    expect(apiWorkspace.notificationDeliveries[0].audience).toBe("family");
    expect(apiWorkspace.notificationDeliveries[0].message).toContain("overdue progress reminder");
    expect(apiWorkspace.auditLog[0].title).toBe("Notification sent");

    await page.reload();
    await expect(page.locator(".sync-pill strong")).toHaveText("API-backed workspace");
    await expect(page.locator(".question-row").filter({ hasText: "overdue progress reminder" })).toBeVisible();
  });

  test("persists teacher classroom roster review from the overview", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed classroom roster coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("generalEducation");
    await expectToast(page, "Account switched");
    await expect(page.getByRole("heading", { name: "Good morning, Leah." })).toBeVisible();

    const classroomCard = page.locator(".card").filter({ hasText: "Classroom management" });
    await expect(classroomCard).toContainText("15 students");
    await expect(classroomCard).toContainText("Jordan Lee");
    await expect(classroomCard).toContainText("Elise Brown");
    await expect(classroomCard).toContainText("5 high priority");
    await classroomCard.getByLabel("Classroom review focus").selectOption("Progress evidence check");
    await classroomCard.getByLabel("Classroom action plan").fill(
      "Verify assessment accommodations, collect overdue progress checks, and coordinate service carryover before Friday."
    );
    await classroomCard.getByRole("button", { name: "Record classroom roster review" }).click();
    await expectToast(page, "Classroom roster reviewed");
    await expect(classroomCard).toContainText("Progress evidence check");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.user.role).toBe("generalEducation");
    expect(apiWorkspace.teacherClassroomRoster).toHaveLength(15);
    expect(apiWorkspace.teacherClassroomReviews[0].reviewFocus).toBe("Progress evidence check");
    expect(apiWorkspace.teacherClassroomReviews[0].reviewedCount).toBe(15);
    expect(apiWorkspace.teacherClassroomReviews[0].reviewDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(apiWorkspace.auditLog[0].title).toBe("Classroom roster reviewed");
  });

  test("persists team collaboration comments from the student workspace", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed team collaboration coverage runs on desktop.");
    await reset(page);

    await nav(page, "Student workspace");
    const collaborationCard = page.locator(".card").filter({ hasText: "Team collaboration thread" });
    await expect(collaborationCard).toContainText("Team collaboration note only");
    await page.getByLabel("Comment target").selectOption("Implementation task::task-001");
    await page.getByLabel("Comment visibility").selectOption("IEP team");
    await page.getByLabel("Team comment").fill("Please confirm recovery minutes before the family packet is shared.");
    await page.getByRole("button", { name: "Add team comment" }).click();
    await expect(page.getByText("Team comment added")).toBeVisible();
    await expect(collaborationCard).toContainText("Please confirm recovery minutes");
    await page.getByLabel("Thread reply visibility").selectOption("Staff only");
    await page.getByRole("textbox", { name: "Thread reply" }).fill("Staff-only follow-up: recovery minutes owner will be confirmed before packet sharing.");
    await page.getByRole("button", { name: "Add thread reply" }).click();
    await expect(page.getByText("Team comment reply added")).toBeVisible();
    await expect(collaborationCard).toContainText("Staff-only follow-up");
    await page.getByLabel("Moderation status").selectOption("Approved for IEP team");
    await page.getByLabel("Moderation visibility").selectOption("IEP team");
    await page.getByLabel("Moderation note").fill("Approved for team visibility; staff-only reply remains restricted.");
    await page.getByRole("button", { name: "Record moderation review" }).click();
    await expect(page.getByText("Team comment moderated")).toBeVisible();
    await expect(collaborationCard).toContainText("Approved for IEP team");
    await expect(collaborationCard).toContainText("staff-only reply remains restricted");
    await expect(collaborationCard).toContainText("Collaboration moderation queue");
    await page.getByLabel("Queue review status").selectOption("Family follow-up needed");
    await page.getByLabel("Queue notification plan").fill(
      "Use in-app team follow-up only; live external threaded notifications require district notification-provider review."
    );
    await page.getByLabel("Queue retention decision").selectOption("Retain in audit trail");
    await page.getByLabel("Queue retention boundary").fill(
      "Retain source-traced collaboration and queue review in the local audit trail; production retention schedule requires district approval."
    );
    await page.getByLabel("Queue reviewer note").fill(
      "Family recovery-minutes question is visible; staff-only reply remains restricted until team clarification."
    );
    await page.getByLabel("Queue next review").fill("2026-06-30");
    await page.getByRole("button", { name: "Record queue review" }).click();
    await expectToast(page, "Collaboration queue reviewed");
    await expect(collaborationCard).toContainText("Family follow-up needed");
    await expect(collaborationCard).toContainText("live external threaded notifications");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const addedComment = apiWorkspace.teamComments.find((comment) => comment.body.includes("Please confirm recovery minutes"));
    expect(addedComment.targetId).toBe("task-001");
    expect(addedComment.visibility).toBe("IEP team");
    expect(addedComment.sourceAlignment.sourceId).toBe("pa-school-age-iep-non-annotated");
    const moderatedComment = apiWorkspace.teamComments.find((comment) => comment.moderationStatus === "Approved for IEP team");
    expect(moderatedComment).toBeTruthy();
    expect(moderatedComment.moderatedBy).toBe("BJ Tarves");
    expect(moderatedComment.moderationDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(moderatedComment.replies[0].body).toContain("Staff-only follow-up");
    expect(moderatedComment.sourceAlignment.sourceId).toBe("pa-school-age-iep-non-annotated");
    const queueReview = apiWorkspace.teamCommentQueueReviews.find((review) =>
      review.notificationPlan.includes("live external threaded notifications")
    );
    expect(queueReview.queueStatus).toBe("Family follow-up needed");
    expect(queueReview.reviewedBy).toBe("BJ Tarves");
    expect(queueReview.commentsReviewed.some((comment) => comment.id === addedComment.id)).toBe(true);
    expect(queueReview.queueDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(apiWorkspace.auditLog[0].title).toBe("Collaboration queue reviewed");
    expect(apiWorkspace.auditLog.some((event) => event.title === "Team comment moderated")).toBe(true);

    const auditStatus = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/audit/verify`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return response.json();
    }, API_BASE_URL);
    expect(auditStatus.valid).toBe(true);

    await page.locator(".role-control select").selectOption("parent");
    await expectToast(page, "Account switched");
    await nav(page, "Student workspace");
    const parentCollaborationCard = page.locator(".card").filter({ hasText: "Team collaboration thread" });
    await expect(parentCollaborationCard).toContainText("Please confirm recovery minutes");
    await expect(parentCollaborationCard).not.toContainText("General education staff need");
    await expect(parentCollaborationCard).not.toContainText("Staff-only follow-up");
    await expect(parentCollaborationCard).not.toContainText("live external threaded notifications");
  });

  test("persists portal access reviews from the student workspace", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed portal access review coverage runs on desktop.");
    await reset(page);

    await nav(page, "Student workspace");
    const portalCard = page.locator(".card").filter({ hasText: "Portal access review" });
    await expect(portalCard).toContainText("Access verified");
    await expect(portalCard).toContainText("Portal access review controls workspace account readiness");
    await page.getByLabel("Portal review role").selectOption("Student");
    await page.getByLabel("Portal subject name").fill("Jordan Lee");
    await page.getByLabel("Portal access status").selectOption("Student access limited");
    await page.getByLabel("Portal verification method").selectOption("Student conference");
    await page.getByLabel("Portal identity evidence").fill(
      "Student account matched assigned record; self-advocacy packet visibility limited to student-facing sections."
    );
    await page.getByLabel("Portal language support").fill("Yes - plain-language support during first login");
    await page.getByLabel("Portal privacy note").fill(
      "Student view excludes staff-only collaboration, internal identity evidence, and formal compliance notes."
    );
    await page.getByRole("button", { name: "Record portal access review" }).click();
    await expect(page.getByText("Portal access reviewed")).toBeVisible();
    await expect(portalCard).toContainText("Student access limited");
    await expect(portalCard).toContainText("self-advocacy packet visibility");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const review = apiWorkspace.portalAccessReviews.find((item) => item.subjectName === "Jordan Lee");
    expect(review.subjectRole).toBe("Student");
    expect(review.accessStatus).toBe("Student access limited");
    expect(review.reviewedBy).toBe("BJ Tarves");
    expect(review.sourceAlignment.sourceId).toBe("pa-school-age-iep-non-annotated");
    expect(review.reviewDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(apiWorkspace.auditLog[0].title).toBe("Portal access reviewed");

    const auditStatus = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/audit/verify`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return response.json();
    }, API_BASE_URL);
    expect(auditStatus.valid).toBe(true);

    await page.getByLabel("Portal invite basis").selectOption({ label: "Student: Jordan Lee - Student access limited" });
    await page.getByLabel("Invitation status").selectOption("Ready to send");
    await page.getByLabel("Invitation delivery channel").selectOption("District portal invite");
    await page.getByLabel("Invitation expires").fill("2026-06-30");
    await page.getByLabel("Invitation access scope").fill(
      "Student summary, student-visible goals, meeting packet acknowledgments, and student-visible collaboration only."
    );
    await page.getByLabel("Invitation identity summary").fill(
      "Student access review confirmed assigned record and limited self-advocacy packet visibility; district identity provider must still verify before sending."
    );
    await page.getByLabel("Invitation language support").fill("Plain-language login support during first access");
    await page.getByLabel("Invitation privacy boundary").fill(
      "Internal identity evidence, staff-only notes, and formal compliance review remain restricted."
    );
    await page.getByLabel("Invitation provider reference").fill("demo-provider-queue-student-001");
    await page.getByRole("button", { name: "Prepare portal invitation" }).click();
    await expectToast(page, "Portal invitation package prepared");
    await expect(portalCard).toContainText("Portal invitation packages");
    await expect(portalCard).toContainText("Student summary, student-visible goals");
    await expect(portalCard).toContainText("demo-provider-queue-student-001");

    const invitationWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const invitation = invitationWorkspace.portalInvitationPackages.find((item) => item.subjectName === "Jordan Lee");
    expect(invitation.subjectRole).toBe("Student");
    expect(invitation.status).toBe("Ready to send");
    expect(invitation.deliveryChannel).toBe("District portal invite");
    expect(invitation.preparedBy).toBe("BJ Tarves");
    expect(invitation.sourceAlignment.sourceId).toBe("pa-school-age-iep-non-annotated");
    expect(invitation.invitationDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(invitation.officialRecordImpact).toContain("does not send a production invitation");
    expect(invitationWorkspace.auditLog[0].title).toBe("Portal invitation package prepared");

    await page.locator(".role-control select").selectOption("parent");
    await expectToast(page, "Account switched");
    await nav(page, "Student workspace");
    const parentPortalCard = page.locator(".card").filter({ hasText: "Portal access review" });
    await expect(parentPortalCard).toContainText("No portal access reviews");
    await expect(parentPortalCard).not.toContainText("self-advocacy packet visibility");
    await expect(parentPortalCard).not.toContainText("Guardian account matched");
    await expect(parentPortalCard).not.toContainText("demo-provider-queue-student-001");

    const parentWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(parentWorkspace.portalAccessReviews).toEqual([]);
    expect(parentWorkspace.portalInvitationPackages).toEqual([]);
  });

  test("uploads a selected source file through API-backed intake", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed file upload coverage runs on desktop.");
    await reset(page);

    const source = Buffer.from(
      "Present levels: Jordan reads with 70% accuracy. Goal: Jordan will answer questions with at least 80% accuracy. Service: Reading support 30 minutes weekly. Accommodation: Extended time as needed."
    );

    await nav(page, "IEP intake");
    await page.locator('input[type="file"]').setInputFiles({
      name: "Jordan_File_Source.txt",
      mimeType: "text/plain",
      buffer: source
    });
    await expect(page.getByText("Jordan_File_Source.txt")).toBeVisible();
    await page.getByRole("button", { name: "Preserve source and extract" }).click();
    await expectToast(page, "Source preserved");
    await expect(page.getByText("Original file")).toBeVisible();
    await expect(page.getByText("SHA-256", { exact: false })).toBeVisible();
    await expect(page.getByText("pa-school-age-iep-non-annotated", { exact: false })).toBeVisible();
    const goalCard = page.locator(".extract-card").filter({ hasText: "Detected annual goal" });
    await goalCard.getByRole("button", { name: "Map source" }).click();
    await expect(page.getByText("Source-to-field mapping")).toBeVisible();
    await expect(page.getByText("Highlighted source excerpt")).toBeVisible();
    await expect(page.locator(".mapped-source mark")).toContainText("Goal");
    await goalCard.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByText("Section rejected", { exact: true })).toBeVisible();
    await expect(goalCard).toContainText("Review flag");
    await goalCard.getByRole("button", { name: "Regenerate" }).click();
    await expect(page.getByText("Section regenerated", { exact: true })).toBeVisible();
    await expect(goalCard).toContainText("Prior extraction preserved");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.documents[0].name).toBe("Jordan_File_Source.txt");
    expect(apiWorkspace.documents[0].originalFile.sizeBytes).toBe(source.length);
    expect(apiWorkspace.documents[0].sourceAlignment.sourceId).toBe("pa-school-age-iep-non-annotated");
    expect(apiWorkspace.documents[0].sourceText).toContain("Present levels");
    expect(apiWorkspace.extractionSections[0].sourceReference).toContain("text segment");
    expect(apiWorkspace.extractionSections[0].sourceAlignment.sourceRegistryVersion).toBe("PA-demo-2026.06");
    const regeneratedGoal = apiWorkspace.extractionSections.find((section) => section.key === "goalsAndObjectives.detected");
    expect(regeneratedGoal.status).toBe("Needs review");
    expect(regeneratedGoal.regeneratedBy).toBe("BJ Tarves");
    expect(regeneratedGoal.priorContent).toContain("80% accuracy");

    await nav(page, "Overview");
    const dashboardReviewCard = page.locator(".card").filter({ hasText: "IEPs needing review" });
    await expect(dashboardReviewCard).toContainText("Jordan_File_Source.txt");
    await expect(dashboardReviewCard).toContainText("Human review needed");
    const uploadedQueueRow = dashboardReviewCard.locator(".document-row").filter({ hasText: "Jordan_File_Source.txt" });
    await uploadedQueueRow.getByRole("button", { name: "Review source" }).click();
    await expect(page.getByText("Student profile intake")).toBeVisible();
    await expect(page.locator(".source-card").filter({ hasText: "Jordan_File_Source.txt" })).toBeVisible();

    await nav(page, "Audit trail");
    const sourceChain = page.locator("article.card").filter({ has: page.getByRole("heading", { name: "Source chain" }) });
    await expect(sourceChain.getByText("Individualized Education Program (IEP), School Age")).toBeVisible();
    await expect(sourceChain.getByText("Special Education and Gifted Forms Hub")).toBeVisible();
    await expect(page.getByText("Extraction section regenerated")).toBeVisible();
  });

  test("creates and selects student profiles before source intake", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed student profile intake coverage runs on desktop.");
    testInfo.setTimeout(60000);
    await reset(page);

    await nav(page, "IEP intake");
    await expect(page.getByText("Student profile intake")).toBeVisible();
    await page.getByLabel("Student first name").fill("Samira");
    await page.getByLabel("Student last name").fill("Patel");
    await page.getByLabel("Student grade").fill("6");
    await page.getByLabel("Student school").fill("Riverbend Middle School");
    await page.getByLabel("Student support areas").fill("Reading, written expression");
    await page.getByLabel("Student annual review date").fill("2026-08-15");
    await page.getByRole("button", { name: "Create student profile" }).click();
    await expect(page.getByText("Student profile created")).toBeVisible();
    await expect(page.getByText("No source document")).toBeVisible();
    await expect(page.getByText("No extraction sections")).toBeVisible();

    await page.getByLabel("Document name").fill("Samira_Patel_IEP_Source.txt");
    await page.getByLabel("Manual paste option").fill(
      "Present levels: Samira reads grade-level passages with 60% accuracy. Goal: Samira will answer comprehension questions with 80% accuracy. Service: Reading support 30 minutes 2x/week. Accommodation: Written directions and extended time for classroom assessments."
    );
    await page.getByRole("button", { name: "Preserve source and extract" }).click();
    await expectToast(page, "Source preserved");
    await expect(page.locator(".extract-card").first()).toContainText("Detected");

    let apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const createdStudent = apiWorkspace.students.find((student) => student.firstName === "Samira" && student.lastName === "Patel");
    expect(createdStudent).toBeTruthy();
    expect(apiWorkspace.currentStudentId).toBe(createdStudent.id);
    expect(apiWorkspace.documents[0].studentId).toBe(createdStudent.id);
    expect(apiWorkspace.extractionSections.every((section) => section.studentId === createdStudent.id)).toBe(true);

    await nav(page, "Overview");
    const elijahRow = page.locator("tr").filter({ hasText: "Elijah Reed" });
    await elijahRow.getByRole("button", { name: "Open workspace" }).click();
    await expect(page.getByRole("heading", { name: "Elijah Reed", exact: true }).first()).toBeVisible();
    const elijahProfileMap = page.locator(".profile-workflow");
    await expect(elijahProfileMap).toContainText("Review pending");
    await expect(elijahProfileMap).toContainText("0 goals");
    await expect(elijahProfileMap).toContainText("0 services");
    await expect(elijahProfileMap).toContainText("0 supports");
    await expect(elijahProfileMap).toContainText("Not scheduled");
    await expect(page.getByText("No next actions")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Assign speech-language service recovery plan");

    await nav(page, "Implementation");
    await expect(page.getByText("No implementation tasks")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Assign speech-language service recovery plan");

    await nav(page, "Services");
    await expect(page.getByText("No services or accommodations")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Speech-language support");

    await nav(page, "Progress");
    await expect(page.getByText("No progress goals")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Reading comprehension");

    await nav(page, "Meetings");
    await expect(page.getByText("No meeting prep record")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Jordan Lee - Annual IEP");

    await nav(page, "Plan summary");
    await expect(page.getByText("No approved summary")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Jordan's classroom implementation summary");

    await nav(page, "Quality review");
    await expect(page.getByText("No review findings")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Missed service minutes do not have a recovery plan");

    apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.currentStudentId).toBe("student-004");
    expect(apiWorkspace.auditLog[0].title).toBe("Student workspace selected");
  });

  test("preserves page-aware PDF source anchors in intake mapping", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed PDF source anchor coverage runs on desktop.");
    await reset(page);

    const pdf = createExportArtifact({
      id: "browser-source-fixture",
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

    await nav(page, "IEP intake");
    await page.locator('input[type="file"]').setInputFiles({
      name: "Jordan_Page_Source.pdf",
      mimeType: "application/pdf",
      buffer: pdf.buffer
    });
    await page.getByRole("button", { name: "Preserve source and extract" }).click();
    await expectToast(page, "Source preserved");

    const goalCard = page.locator(".extract-card").filter({ hasText: "Detected annual goal" });
    await expect(goalCard).toContainText("Jordan_Page_Source.pdf · page 1");
    await goalCard.getByRole("button", { name: "Map source" }).click();
    await expect(page.getByText("Source-to-field mapping")).toBeVisible();
    await expect(page.locator(".source-segment").filter({ hasText: "page 1" })).toContainText("PDF page 1");
    await expect(page.locator(".mapped-source mark")).toContainText("Goal");
    await expect(page.getByText("Source anchor review", { exact: true })).toBeVisible();
    await page.getByLabel("Anchor precision").selectOption("Bounding box");
    await page.getByLabel("Anchor page number").fill("1");
    await page.getByLabel("Anchor segment label").fill("page 1");
    await page.getByLabel("Anchor x percent").fill("12");
    await page.getByLabel("Anchor y percent").fill("18");
    await page.getByLabel("Anchor width percent").fill("72");
    await page.getByLabel("Anchor height percent").fill("9");
    await page.getByLabel("Source anchor reviewer note").fill(
      "Goal field anchor confirmed against the highlighted PDF page region before extraction approval."
    );
    await page.getByRole("button", { name: "Record source anchor review" }).click();
    await expectToast(page, "Source anchor review recorded");
    await expect(page.getByText("OCR/source quality review")).toBeVisible();
    await page.getByLabel("OCR review status").selectOption("OCR text reviewed");
    await page.getByLabel("OCR confidence").fill("91");
    await page.getByLabel("Reviewed text excerpt").fill("Present levels and annual goal text were reviewed from the page-aware PDF source.");
    await page.getByLabel("OCR reviewer note").fill("Embedded PDF text reviewed; no separate OCR remediation is needed for this demo source.");
    await page.getByRole("button", { name: "Record OCR review" }).click();
    await expectToast(page, "OCR/source review recorded");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.documents[0].name).toBe("Jordan_Page_Source.pdf");
    expect(apiWorkspace.documents[0].sourceSegments[0].label).toBe("page 1");
    expect(apiWorkspace.documents[0].sourceSegments[0].pageNumber).toBe(1);
    expect(apiWorkspace.documents[0].sourceSegments[0].locator.precision).toBe("page");
    expect(apiWorkspace.documents[0].ocrReview.status).toBe("OCR text reviewed");
    expect(apiWorkspace.documents[0].ocrReview.reviewedBy).toBe("BJ Tarves");
    expect(apiWorkspace.documents[0].ocrReview.ocrDigest).toBeTruthy();
    expect(apiWorkspace.auditLog[0].title).toBe("OCR/source review recorded");
    const goalSection = apiWorkspace.extractionSections.find((section) => section.key === "goalsAndObjectives.detected");
    expect(goalSection.sourceReference).toContain("page 1");
    expect(goalSection.sourceAnchorReview.precision).toBe("Bounding box");
    expect(goalSection.sourceAnchorReview.boundingBox.width).toBe(72);
    expect(goalSection.sourceAnchorReview.anchorDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  test("persists source registry review from the audit trail", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed source registry review coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("administrator");
    await expectToast(page, "Account switched");
    await nav(page, "Audit trail");
    await expect(page.getByRole("heading", { name: "Source registry review" })).toBeVisible();
    await page.getByLabel("Registry source").selectOption("pattan-special-education-gifted-forms-hub");
    await page.getByLabel("Source review status", { exact: true }).selectOption("Update needed");
    await page.getByLabel("Source retrieved date", { exact: true }).fill("2026-06-24");
    await page.getByLabel("Next source review", { exact: true }).fill("2026-07-15");
    await page.getByLabel("Source review note", { exact: true }).fill("Review forms hub for updated companion notices before the next district release.");
    await page.getByRole("button", { name: "Update source review" }).click();
    await expect(page.getByText("Source registry reviewed")).toBeVisible();
    await expect(page.locator(".question-row").filter({ hasText: "Special Education and Gifted Forms Hub" })).toContainText("Update needed");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const entry = apiWorkspace.sourceRegistry.entries.find((item) => item.sourceId === "pattan-special-education-gifted-forms-hub");
    expect(entry.reviewStatus).toBe("Update needed");
    expect(entry.reviewedBy).toBe("D. Nguyen");
    expect(entry.reviewNote).toContain("companion notices");
    expect(apiWorkspace.sourceRegistry.reviewStatus).toBe("Update needed");
    expect(apiWorkspace.auditLog[0].title).toBe("Source registry entry reviewed");
  });

  test("persists source registry administration and future source alignment", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed source registry administration coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("administrator");
    await expectToast(page, "Account switched");
    await nav(page, "Audit trail");
    await expect(page.getByRole("heading", { name: "Source registry administration" })).toBeVisible();
    await page.getByLabel("New source ID").fill("pa-school-age-iep-district-ui-2026");
    await page.getByLabel("New source title").fill("District UI reviewed Pennsylvania School Age IEP, 2026");
    await page.getByLabel("New source registry version").fill("PA-demo-2026.07");
    await page.getByLabel("New source effective date").fill("2026-07-01");
    await page.getByLabel("New source retrieved date").fill("2026-06-24");
    await page.getByLabel("New source next review").fill("2026-10-01");
    await page.getByLabel("New source languages available").fill("English, Spanish, Arabic");
    await page.getByLabel("New source language availability note").fill(
      "District language-access lead verified translated packet availability before sharing family summaries."
    );
    await page.getByLabel("New source review note").fill(
      "Administrator verified this district source before future extraction and export workflows."
    );
    await page.getByRole("button", { name: "Save source registry entry" }).click();
    await expectToast(page, "Source registry entry saved");
    await expect(page.locator(".card").filter({ hasText: "Source registry administration" })).toContainText("pa-school-age-iep-district-ui-2026");
    await expect(page.getByText("Languages: English, Spanish, Arabic")).toBeVisible();

    let apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.sourceRegistry.activeSourceId).toBe("pa-school-age-iep-district-ui-2026");
    expect(apiWorkspace.sourceRegistry.sourceRegistryVersion).toBe("PA-demo-2026.07");
    expect(apiWorkspace.sourceRegistry.entries[0].productUse).toContain("Export");
    expect(apiWorkspace.sourceRegistry.entries[0].languagesAvailable).toEqual(["English", "Spanish", "Arabic"]);
    expect(apiWorkspace.sourceRegistry.entries[0].languageAvailabilityNote).toContain("language-access lead");
    expect(apiWorkspace.auditLog[0].title).toBe("Source registry entry saved");

    await page.locator(".role-control select").selectOption("caseManager");
    await expectToast(page, "Account switched");
    apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.sourceRegistry.activeSourceId).toBe("pa-school-age-iep-district-ui-2026");
    await nav(page, "IEP intake");
    await page.getByPlaceholder("Paste IEP text here to run the demo extraction workflow.").fill(
      "Present levels: Jordan reads with 70% accuracy. Goal: Jordan will answer questions with at least 80% accuracy. Service: Reading support 30 minutes weekly."
    );
    await page.getByRole("button", { name: "Preserve source and extract" }).click();
    await expectToast(page, "Source preserved");

    apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.documents[0].sourceAlignment.sourceId).toBe("pa-school-age-iep-district-ui-2026");
    expect(apiWorkspace.extractionSections[0].sourceAlignment.sourceRegistryVersion).toBe("PA-demo-2026.07");
    expect(apiWorkspace.documents[0].sourceAlignment.languagesAvailable).toEqual(["English", "Spanish", "Arabic"]);
  });

  test("persists district integration readiness from the leadership dashboard", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed district readiness coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("administrator");
    await expectToast(page, "Account switched");
    await nav(page, "Leadership");
    await expect(page.getByRole("heading", { name: "District implementation readiness" })).toBeVisible();
    const readinessCard = page.locator(".card").filter({ hasText: "District implementation readiness" });
    await expect(readinessCard).toContainText("Student information system");
    await page.getByLabel("District integration").selectOption("sis");
    await page.getByLabel("Integration status").selectOption("Pilot approved");
    await page.getByLabel("Integration provider").fill("PowerSchool SIS (planned)");
    await page.getByLabel("Integration owner").fill("Data services lead");
    await page.getByLabel("Integration next review date").fill("2026-09-15");
    await page.getByLabel("Readiness note").fill(
      "Pilot mapping approved for student identifiers, school assignment, guardian links, and caseload scope."
    );
    await page.getByRole("button", { name: "Update integration readiness" }).click();
    await expectToast(page, "District integration readiness updated");
    await expect(readinessCard).toContainText("PowerSchool SIS (planned)");
    await expect(readinessCard).toContainText("Pilot approved");
    await expect(readinessCard).toContainText("Data protection readiness");
    await page.getByLabel("Data protection control").selectOption("encryption-at-rest");
    await page.getByLabel("Data protection status").selectOption("Readiness review");
    await page.getByLabel("Control evidence").fill("KMS-backed database and object-store encryption design queued for district security review.");
    await page.getByLabel("Control owner").fill("Information security lead");
    await page.getByLabel("Control next review date").fill("2026-10-15");
    await page.getByLabel("Data protection evidence note").fill(
      "Security lead documented key rotation, encrypted backup, and access-log evidence needed before live IEP storage."
    );
    await page.getByLabel("Production boundary note").fill(
      "Local JSON files remain demo storage and are not the production encryption control."
    );
    await page.getByRole("button", { name: "Update data protection readiness" }).click();
    await expectToast(page, "Data protection readiness updated");
    await expect(readinessCard).toContainText("KMS-backed database");
    await expect(readinessCard).toContainText("production encryption control");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const sis = apiWorkspace.districtConfiguration.integrationReadiness.find((integration) => integration.id === "sis");
    expect(sis.status).toBe("Pilot approved");
    expect(sis.provider).toBe("PowerSchool SIS (planned)");
    const encryptionControl = apiWorkspace.districtConfiguration.dataProtectionReadiness.find((control) => control.id === "encryption-at-rest");
    expect(encryptionControl.control).toContain("KMS-backed database");
    expect(encryptionControl.productionBoundary).toContain("not the production encryption control");
    expect(apiWorkspace.districtConfiguration.configurationReviews[0].controlId).toBe("encryption-at-rest");
    expect(apiWorkspace.districtConfiguration.configurationReviews[0].dataProtectionDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(apiWorkspace.auditLog[0].title).toBe("Data protection readiness updated");

    const verification = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/audit/verify`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return response.json();
    }, API_BASE_URL);
    expect(verification.valid).toBe(true);
  });

  test("revokes demo security sessions from the audit trail", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed security session coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("parent");
    await expectToast(page, "Account switched");
    const parentToken = await page.evaluate(() => JSON.parse(localStorage.getItem("iep-auth-session-v1")).token);

    await page.locator(".role-control select").selectOption("administrator");
    await expectToast(page, "Account switched");
    await nav(page, "Audit trail");
    await expect(page.getByRole("heading", { name: "Session governance" })).toBeVisible();
    const governanceCard = page.locator(".card").filter({ hasText: "Session governance" });
    await expect(governanceCard).toContainText("Robin Lee");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const parentSession = apiWorkspace.securitySessions.find((session) => session.userName === "Robin Lee");
    expect(parentSession.status).toBe("Active");

    await page.getByLabel("Security session to revoke").selectOption(parentSession.id);
    await page.getByLabel("Session review note").fill("Administrator revoked the parent demo session after access review.");
    await page.getByRole("button", { name: "Revoke session" }).click();
    await expectToast(page, "Security session revoked");
    await expect(governanceCard).toContainText("Revoked");

    await governanceCard.getByLabel("Identity provider").fill("District SSO readiness review");
    await governanceCard.getByLabel("Lifecycle status").selectOption("SSO mapping in review");
    await governanceCard.getByLabel("MFA status").selectOption("MFA mapping in review");
    await governanceCard.getByLabel("Tenant boundary status").selectOption("Cross-tenant access blocked locally");
    await governanceCard.getByLabel("Role provisioning status").selectOption("SIS/IdP mapping drafted");
    await governanceCard.getByLabel("Identity next review").fill("2026-08-01");
    await governanceCard
      .getByLabel("Account lifecycle plan")
      .fill("Provision from district IdP groups; deprovision on SIS withdrawal and staff separation.");
    await governanceCard
      .getByLabel("Tenant boundary evidence")
      .fill("Demo users remain scoped to Riverbend district and unauthorized student selection is denied.");
    await governanceCard
      .getByLabel("Role provisioning note")
      .fill("Map case manager, provider, family, student, school admin, district admin, and system admin groups before pilot.");
    await governanceCard.getByRole("button", { name: "Record identity lifecycle review" }).click();
    await expectToast(page, "Identity lifecycle reviewed");
    await expect(governanceCard).toContainText("Cross-tenant access blocked locally");
    await expect(governanceCard).toContainText("SIS/IdP mapping drafted");

    const rejected = await page.request.get(`${API_BASE_URL}/api/workspace`, {
      headers: { authorization: `Bearer ${parentToken}` }
    });
    expect(rejected.status()).toBe(401);

    const updatedWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(updatedWorkspace.securityReviews[0].action).toBe("Identity lifecycle reviewed");
    expect(updatedWorkspace.securityReviews[0].securityDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(updatedWorkspace.securityReviews[0].tenantBoundaryStatus).toBe("Cross-tenant access blocked locally");
    expect(updatedWorkspace.securityPosture.reviewStatus).toBe("SSO mapping in review");
    expect(updatedWorkspace.securityPosture.roleProvisioningStatus).toBe("SIS/IdP mapping drafted");
    expect(updatedWorkspace.auditLog[0].title).toBe("Identity lifecycle reviewed");
    expect(updatedWorkspace.securityReviews.some((review) => review.sessionId === parentSession.id)).toBeTruthy();
    expect(updatedWorkspace.auditLog.some((event) => event.title === "Security session revoked")).toBeTruthy();
  });

  test("persists accessibility remediation evidence from the audit trail", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed accessibility remediation coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("administrator");
    await expectToast(page, "Account switched");
    await nav(page, "Audit trail");
    await expect(page.getByRole("heading", { name: "Accessibility review" })).toBeVisible();
    const accessibilityCard = page.locator(".card").filter({ hasText: "Accessibility review" });
    await expect(accessibilityCard).toContainText("WCAG 2.2 AA / Section 508");
    await page.getByLabel("Accessibility finding", { exact: true }).selectOption("screen-reader-announcements");
    await page.getByLabel("Accessibility finding status").selectOption("Ready for retest");
    await page.getByLabel("Accessibility severity").selectOption("High");
    await page.getByLabel("Accessibility owner").fill("Accessibility reviewer");
    await page.getByLabel("Accessibility due date").fill("2026-09-01");
    await page.getByLabel("Assistive technology or review method").fill("NVDA and VoiceOver");
    await page.getByLabel("Accessibility remediation plan").fill(
      "Run screen-reader passes for save, blocked-action, export, role-switch, and API fallback announcements."
    );
    await page.getByLabel("Accessibility verification note").fill(
      "Ready for assistive-technology retest with transcript evidence."
    );
    await page.getByRole("button", { name: "Update accessibility finding" }).click();
    await expectToast(page, "Accessibility finding updated");
    await expect(accessibilityCard).toContainText("Ready for retest");
    await expect(accessibilityCard).toContainText("NVDA and VoiceOver");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const finding = apiWorkspace.accessibilityCertification.findings.find((item) => item.id === "screen-reader-announcements");
    expect(finding.status).toBe("Ready for retest");
    expect(finding.assistiveTechnology).toBe("NVDA and VoiceOver");
    expect(apiWorkspace.accessibilityCertification.reviews[0].accessibilityDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(apiWorkspace.auditLog[0].title).toBe("Accessibility finding updated");

    const verification = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/audit/verify`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return response.json();
    }, API_BASE_URL);
    expect(verification.valid).toBe(true);
  });

  test("persists AI governance guardrail evaluations from the audit trail", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed AI governance coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("administrator");
    await expectToast(page, "Account switched");
    await nav(page, "Audit trail");
    await expect(page.getByRole("heading", { name: "AI governance" })).toBeVisible();
    await expect(page.locator(".card").filter({ hasText: "AI governance" })).toContainText("iep-fds-guardrails-v1");

    await page.getByLabel("AI evaluation scope").fill("FDS core AI guardrails");
    await page.getByLabel("AI governance review note").fill(
      "Evaluate source traceability, content labels, restricted-request refusals, and human-review boundaries before sharing AI-assisted outputs."
    );
    await page.getByRole("button", { name: "Run AI guardrail evaluation" }).click();
    await expectToast(page, "AI guardrail evaluation completed");
    const governanceCard = page.locator(".card").filter({ hasText: "AI governance" });
    await expect(governanceCard).toContainText("100%");
    await expect(governanceCard).toContainText("Source traceability");
    await expect(governanceCard).toContainText("Restricted decision guardrails");

    await page.getByLabel("AI output label").fill("Family summary citation review");
    await page.getByLabel("AI output text").fill(
      "Draft family summary for human review: Jordan's reading goal uses weekly probes and service language remains tied to the approved IEP. This is not official IEP language and does not change services. Source references: Prior IEP comparison note and current Goal 1 progress data; Services"
    );
    await page.getByLabel("AI output citations").fill("Prior IEP comparison note and current Goal 1 progress data\nServices");
    await page.getByLabel("AI citation review note").fill(
      "Citation matches were reviewed before sharing AI-assisted family language."
    );
    await page.getByRole("button", { name: "Run AI citation evaluation" }).click();
    await expectToast(page, "AI citation evaluation completed");
    await expect(governanceCard).toContainText("Citation evaluation: 100%");
    await expect(governanceCard).toContainText("Citations match workspace sources");
    await expect(governanceCard).toContainText("Official-record boundary visible");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const run = apiWorkspace.aiGovernance.evaluationRuns[0];
    expect(run.status).toBe("Passed");
    expect(run.score).toBe(100);
    expect(run.evaluationDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(run.checks.some((check) => check.id === "human-review-boundary" && check.status === "Passed")).toBe(true);
    expect(apiWorkspace.aiGovernance.modelProfile.lastEvaluationStatus).toBe("Passed");
    const citationRun = apiWorkspace.aiGovernance.citationEvaluations[0];
    expect(citationRun.status).toBe("Passed");
    expect(citationRun.score).toBe(100);
    expect(citationRun.matchedSources.length).toBe(2);
    expect(citationRun.citationDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(citationRun.checks.some((check) => check.id === "citations-match-workspace" && check.status === "Passed")).toBe(true);
    expect(apiWorkspace.aiGovernance.modelProfile.lastCitationEvaluationStatus).toBe("Passed");
    expect(apiWorkspace.auditLog[0].title).toBe("AI citation evaluation completed");

    const verification = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/audit/verify`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return response.json();
    }, API_BASE_URL);
    expect(verification.valid).toBe(true);
  });

  test("creates audit anchors and retention packages from the audit trail", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed audit anchor coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("administrator");
    await expectToast(page, "Account switched");
    const before = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/audit/verify`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return response.json();
    }, API_BASE_URL);
    expect(before.valid).toBe(true);

    await nav(page, "Audit trail");
    await expect(page.getByRole("heading", { name: "Audit anchoring" })).toBeVisible();
    await page.getByLabel("Audit anchor external reference").fill("District audit vault UI reference");
    await page.getByLabel("Audit anchor note").fill("Anchor verified hash chain before sharing the audit packet.");
    await page.getByRole("button", { name: "Create audit anchor" }).click();
    await expectToast(page, "Audit anchor created");
    await expect(page.locator(".card").filter({ hasText: "Audit anchoring" })).toContainText("Anchored locally");
    await page.getByLabel("Timestamp provider").fill("District timestamp authority");
    await page.getByLabel("Timestamp receipt ID").fill("TS-RBSD-2026-0001");
    await page.getByLabel("Timestamp receipt time").fill("2026-06-24T14:30");
    await page.getByLabel("Timestamp verification reference").fill("District audit vault receipt URL pending");
    await page.getByLabel("Timestamp reviewer note").fill(
      "External timestamp evidence recorded after local hash-chain verification."
    );
    await page.getByRole("button", { name: "Record timestamp receipt" }).click();
    await expectToast(page, "External timestamp receipt recorded");
    await expect(page.locator(".card").filter({ hasText: "Audit anchoring" })).toContainText("TS-RBSD-2026-0001");
    await expect(page.getByRole("heading", { name: "Retention packages" })).toBeVisible();
    await page.getByLabel("Retention package note").fill("Seal the UI-created anchor for retention evidence.");
    await page.getByRole("button", { name: "Seal retention package" }).click();
    await expectToast(page, "Retention package sealed");
    const retentionCard = page.locator(".card").filter({ hasText: "Retention packages" });
    await expect(retentionCard).toContainText("Sealed locally");
    const downloadPromise = page.waitForEvent("download");
    await retentionCard.getByRole("button", { name: "Download manifest" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^retention-.*-audit-retention-manifest\.json$/);
    await expect(page.getByRole("heading", { name: "Retention policy review" })).toBeVisible();
    const policyCard = page.locator("article.card").filter({ has: page.getByRole("heading", { name: "Retention policy review" }) });
    await expect(policyCard).toContainText("Riverbend draft records schedule");
    await page.getByLabel("Retention policy scope").selectOption("Audit trail and retention manifests");
    await page.getByLabel("Retention policy source").fill("Riverbend draft records schedule RBSD-RET-2026");
    await page.getByLabel("Retention disposition").selectOption("Legal hold active");
    await page.getByLabel("Legal hold status").selectOption("Legal hold active");
    await page.getByLabel("Archive decision").selectOption("Archive blocked");
    await page.getByLabel("Retention period or trigger").fill(
      "Retain local audit-chain evidence and sealed manifests until district records counsel clears the legal hold and approves archive eligibility."
    );
    await page.getByLabel("Retention policy evidence").fill(
      "Policy review links the sealed retention manifest, external timestamp receipt, WORM readiness record, and export metadata before any archive or purge decision."
    );
    await page.getByLabel("Policy next review").fill("2026-10-15");
    await page.getByRole("button", { name: "Record retention policy review" }).click();
    await expectToast(page, "Retention policy reviewed");
    await expect(policyCard).toContainText("Legal hold active");
    await expect(policyCard).toContainText("does not enforce production retention");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.auditAnchors[0].anchoredSequence).toBe(before.checked);
    expect(apiWorkspace.auditAnchors[0].anchoredHash).toBe(before.latestHash);
    expect(apiWorkspace.auditAnchors[0].anchorDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(apiWorkspace.auditAnchors[0].externalTimestampReceipt.receiptId).toBe("TS-RBSD-2026-0001");
    expect(apiWorkspace.auditAnchors[0].externalTimestampReceipt.receiptDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(apiWorkspace.auditRetentionPackages[0].anchorId).toBe(apiWorkspace.auditAnchors[0].id);
    expect(apiWorkspace.auditRetentionPackages[0].packageDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(apiWorkspace.auditRetentionPackages[0].artifact.fileName).toBe(download.suggestedFilename());
    expect(apiWorkspace.retentionPolicyReviews[0].retentionPackageId).toBe(apiWorkspace.auditRetentionPackages[0].id);
    expect(apiWorkspace.retentionPolicyReviews[0].legalHoldStatus).toBe("Legal hold active");
    expect(apiWorkspace.retentionPolicyReviews[0].archiveDecision).toBe("Archive blocked");
    expect(apiWorkspace.retentionPolicyReviews[0].policyDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(apiWorkspace.auditLog[0].title).toBe("Retention policy reviewed");
    expect(apiWorkspace.auditLog.some((event) => event.title === "Retention package sealed")).toBe(true);
    expect(apiWorkspace.auditLog.some((event) => event.title === "External timestamp receipt recorded")).toBe(true);
    expect(apiWorkspace.auditLog.some((event) => event.title === "Audit anchor created")).toBe(true);

    const after = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/audit/verify`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return response.json();
    }, API_BASE_URL);
    expect(after.valid).toBe(true);
    expect(after.checked).toBe(before.checked + 4);
  });

  test("persists formal compliance review escalation and outcome through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed compliance review coverage runs on desktop.");
    await reset(page);

    await nav(page, "Quality review");
    await expect(page.getByRole("heading", { name: "Formal compliance review" })).toBeVisible();
    await page.getByLabel("Review finding to escalate").selectOption("flag-002");
    await page.getByLabel("Assigned reviewer").fill("D. Nguyen");
    await page.getByLabel("Compliance review due date").fill("2026-06-28");
    await page.getByLabel("Escalation rationale").fill(
      "Extended-time implementation language needs administrator review before the meeting packet is finalized."
    );
    await page.getByLabel("Compliance review next action").fill(
      "Confirm operational trigger and responsible staff without inferring a multiplier."
    );
    await page.getByRole("button", { name: "Request compliance review" }).click();
    await expectToast(page, "Compliance review requested");
    await expect(page.locator(".question-row").filter({ hasText: "Extended-time accommodation lacks implementation specificity" })).toContainText("Requested");

    let apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const reviewId = apiWorkspace.complianceReviews[0].id;
    expect(apiWorkspace.complianceReviews[0].flagId).toBe("flag-002");
    expect(apiWorkspace.complianceReviews[0].assignedReviewer).toBe("D. Nguyen");
    expect(apiWorkspace.complianceReviews[0].notLegalCertification).toBe(true);
    expect(apiWorkspace.auditLog[0].title).toBe("Compliance review requested");

    await page.locator(".role-control select").selectOption("administrator");
    await expectToast(page, "Account switched");
    await nav(page, "Quality review");
    await page.getByLabel("Compliance review record").selectOption(reviewId);
    await page.getByLabel("Compliance review status").selectOption("Closed - reviewed");
    await page.getByLabel("Compliance review outcome").fill(
      "Reviewed as an implementation follow-up item; this is not a legal certification."
    );
    await page.getByLabel("Compliance reviewer note").fill(
      "Team must document the operational trigger, responsible staff, and source-aligned wording."
    );
    await page.getByLabel("Compliance next action").fill("Update packet notes before sharing final meeting materials.");
    await page.getByRole("button", { name: "Record compliance review outcome" }).click();
    await expectToast(page, "Compliance review outcome recorded");
    await expect(page.locator(".question-row").filter({ hasText: "Extended-time accommodation lacks implementation specificity" })).toContainText("Closed - reviewed");

    apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const completed = apiWorkspace.complianceReviews.find((item) => item.id === reviewId);
    expect(completed.status).toBe("Closed - reviewed");
    expect(completed.reviewedBy).toBe("D. Nguyen");
    expect(completed.outcome).toContain("not a legal certification");
    expect(apiWorkspace.auditLog[0].title).toBe("Compliance review outcome recorded");

    await expect(page.getByRole("heading", { name: "District counsel routing" })).toBeVisible();
    await page.getByLabel("Counsel review record").selectOption(reviewId);
    await page.getByLabel("District counsel").fill("District counsel office");
    await page.getByLabel("Legal review scope").fill(
      "Review whether recovery language and meeting packet notes need district counsel input."
    );
    await page.getByLabel("Legal review due date").fill("2026-06-30");
    await page.getByLabel("District policy reference").fill("Riverbend special education review protocol 2026");
    await page.getByLabel("Legal routing reason").fill(
      "Administrator wants counsel input before final district action is documented."
    );
    await page.getByRole("button", { name: "Route to district counsel" }).click();
    await expectToast(page, "District counsel review routed");
    await expect(page.locator(".question-row").filter({ hasText: "District counsel office" })).toContainText("Routed to counsel");

    apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const legalRouteId = apiWorkspace.legalReviewRoutes[0].id;
    expect(apiWorkspace.legalReviewRoutes[0].complianceReviewId).toBe(reviewId);
    expect(apiWorkspace.legalReviewRoutes[0].routeDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(apiWorkspace.complianceReviews.find((item) => item.id === reviewId).legalRouteStatus).toBe("Routed to counsel");
    expect(apiWorkspace.auditLog[0].title).toBe("District counsel review routed");

    await page.getByLabel("Legal route record").selectOption(legalRouteId);
    await page.getByLabel("Legal review status").selectOption("Counsel response recorded");
    await page.getByLabel("Counsel summary").fill(
      "Counsel reviewed the routing record and identified district follow-through steps."
    );
    await page.getByLabel("Counsel recommended action").fill(
      "Document district action separately and update the meeting packet after human review."
    );
    await page.getByLabel("Legal review note").fill(
      "Workspace stores counsel-response metadata only; legal advice remains in district counsel records."
    );
    await page.getByRole("button", { name: "Record counsel response" }).click();
    await expectToast(page, "District counsel response recorded");
    await expect(page.locator(".question-row").filter({ hasText: "District counsel office" })).toContainText("Counsel response recorded");

    apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const legalRoute = apiWorkspace.legalReviewRoutes.find((item) => item.id === legalRouteId);
    expect(legalRoute.status).toBe("Counsel response recorded");
    expect(legalRoute.reviewedBy).toBe("D. Nguyen");
    expect(legalRoute.outcomeDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(legalRoute.notLegalCertification).toContain("final legal advice");
    expect(apiWorkspace.complianceReviews.find((item) => item.id === reviewId).legalRouteStatus).toBe("Counsel response recorded");
    expect(apiWorkspace.auditLog[0].title).toBe("District counsel response recorded");

    await nav(page, "Audit trail");
    await expect(page.getByRole("heading", { name: "Compliance review log" })).toBeVisible();
    await expect(page.locator(".card").filter({ hasText: "Compliance review log" })).toContainText("not legal certification");
  });

  test("persists edited extracted fields into approved structured records from the UI", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed extraction edit coverage runs on desktop.");
    await reset(page);

    await nav(page, "IEP intake");
    await page.getByPlaceholder("Paste IEP text here to run the demo extraction workflow.").fill(
      "Present levels: Jordan reads with 70% accuracy. Goal: Jordan will answer questions with at least 80% accuracy across three probes. Service: Reading support 30 minutes weekly. Accommodation: Extended time as needed."
    );
    await page.getByRole("button", { name: "Preserve source and extract" }).click();
    await expectToast(page, "Source preserved");

    const goalCard = page.locator(".extract-card").filter({ hasText: "Detected annual goal" });
    await goalCard.getByRole("button", { name: "Edit" }).click();
    await goalCard.locator("textarea").fill(
      "Edited annual goal: Jordan will answer inferential questions with 80% accuracy across three weekly probes using the approved organizer."
    );
    await expect(goalCard).toContainText("Edited by BJ Tarves");
    await page.getByRole("button", { name: "Approve extraction" }).click();
    await expect(page.getByText("Extraction approved")).toBeVisible();

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const structuredGoal = apiWorkspace.ieps[0].structuredRecord.goalsAndObjectives.find(
      (goal) => goal.annualGoal.includes("Edited annual goal")
    );
    expect(structuredGoal.editedBy).toBe("BJ Tarves");
    expect(structuredGoal.reviewStatus).toBe("Confirmed");
    expect(structuredGoal.sourceReference).toContain("text segment");
    const derivedGoal = apiWorkspace.goals.find((goal) => goal.annualGoal.includes("Edited annual goal"));
    expect(derivedGoal.progressSchedule.status).toBe("Due soon");
    const progressTask = apiWorkspace.tasks.find(
      (task) => task.extractionSectionId === derivedGoal.extractionSectionId && task.sourceSection === "Progress Monitoring"
    );
    expect(progressTask.description).toContain("Edited annual goal");
    expect(progressTask.evidenceRequired).toBe(true);
    const parentSummaryText = apiWorkspace.summaries.parent.sections
      .flatMap((section) => [section.text, ...(section.bullets || [])])
      .join(" ");
    expect(parentSummaryText).toContain("Edited annual goal");
    expect(apiWorkspace.auditLog.slice(0, 3).map((event) => event.title)).toEqual([
      "Role-specific summaries refreshed",
      "Implementation tasks created",
      "Structured extraction approved"
    ]);

    await nav(page, "Plan summary");
    await page.getByRole("button", { name: "Family view" }).click();
    await expect(page.locator(".summary-doc")).toContainText("Edited annual goal");
  });

  test("persists summary copy audit and meeting handouts through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed summary handout coverage runs on desktop.");
    await reset(page);

    await nav(page, "Plan summary");
    await page.getByRole("button", { name: "Family view" }).click();
    await expect(page.getByRole("heading", { name: "What changed from the previous IEP" })).toBeVisible();
    await expect(page.locator(".summary-doc")).toContainText("Prior IEP comparison note");
    const coverageCard = page.locator(".card").filter({ hasText: "Audience coverage" });
    await expect(coverageCard).toContainText("What each goal means");
    await expect(coverageCard).toContainText("Questions for next meeting");
    await expect(coverageCard).toContainText("What changed from the previous IEP");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.__copiedSummary = text;
          }
        }
      });
    });
    await page.getByRole("button", { name: "Copy summary" }).click();
    await expect(page.getByText("Summary copied", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__copiedSummary || "")).toContain("Jordan's IEP in plain language");
    expect(await page.evaluate(() => window.__copiedSummary || "")).toContain("What changed from the previous IEP");
    expect(await page.evaluate(() => window.__copiedSummary || "")).toContain("Source: Prior IEP comparison note");

    await page.getByRole("button", { name: "Generate meeting handout" }).click();
    await expect(page.getByText("Meeting handout generated")).toBeVisible();
    await expect(page.locator(".card").filter({ hasText: "Meeting handouts" })).toContainText("Family view meeting handout");
    await nav(page, "Overview");
    const parentSummaryCard = page.locator(".card").filter({ hasText: "Recent parent summaries" });
    await expect(parentSummaryCard).toContainText("Family view meeting handout");
    await expect(parentSummaryCard).toContainText("Family-ready");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.summaryHandouts[0].audience).toBe("parent");
    expect(apiWorkspace.summaryHandouts[0].createdBy).toBe("BJ Tarves");
    expect(apiWorkspace.summaryHandouts[0].questions.length).toBeGreaterThan(0);
    expect(apiWorkspace.summaryHandouts[0].sections.some((section) => section.heading === "What changed from the previous IEP")).toBe(true);
    expect(apiWorkspace.summaryHandouts[0].coverageItems.some((item) => item.label === "What each goal means")).toBe(true);
    expect(apiWorkspace.summaryHandouts[0].coverageItems.some((item) => item.label === "Questions for next meeting")).toBe(true);
    expect(apiWorkspace.auditLog[0].title).toBe("Meeting handout generated");
    expect(apiWorkspace.auditLog[1].title).toBe("Summary copied");
  });

  test("persists family summary understanding checks through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed comprehension-check coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("parent");
    await expectToast(page, "Account switched");
    await nav(page, "Plan summary");
    await page.getByRole("button", { name: "Family view" }).click();
    const understandingCard = page.locator(".card").filter({ hasText: "Understanding checks" });
    await expect(understandingCard).toContainText("What changed from the previous IEP");
    await page.getByLabel("Understanding summary section").selectOption("What changed from the previous IEP");
    await page.getByLabel("Understanding status").selectOption("Interpreter review requested");
    await page.getByLabel("Check language").selectOption("Spanish");
    await page.getByLabel("Understanding question or note").fill(
      "Please explain the service-recovery timing in Spanish before the packet is finalized."
    );
    await page.getByLabel("Preferred follow-up").fill("Schedule interpreter-supported follow-up before the annual review.");
    await page.getByRole("button", { name: "Record understanding check" }).click();
    await expectToast(page, "Understanding check submitted");
    await expect(understandingCard).toContainText("service-recovery timing in Spanish");
    await expect(understandingCard).toContainText("Interpreter review requested");
    const submittedCheckId = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      const workspace = (await response.json()).workspace;
      return workspace.summaryComprehensionChecks.find((check) =>
        check.questionOrNote.includes("service-recovery timing")
      ).id;
    }, API_BASE_URL);

    await page.locator(".role-control select").selectOption("caseManager");
    await expectToast(page, "Account switched");
    await nav(page, "Plan summary");
    await page.getByRole("button", { name: "Family view" }).click();
    await expect(understandingCard).toContainText("service-recovery timing in Spanish");
    await page.getByLabel("Understanding check").selectOption(submittedCheckId);
    await page.getByLabel("Understanding review status").selectOption("Interpreter follow-up scheduled");
    await page.getByLabel("Understanding response").fill(
      "The team will review the recovery date and responsible provider with interpreter support."
    );
    await page.getByLabel("Understanding next step").fill("Case manager will send the recovery owner and date by Friday.");
    await page.getByRole("button", { name: "Record understanding response" }).click();
    await expectToast(page, "Understanding response recorded");
    await expect(understandingCard).toContainText("Interpreter follow-up scheduled");
    await expect(understandingCard).toContainText("responsible provider with interpreter support");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.summaryComprehensionChecks[0].questionOrNote).toContain("service-recovery timing");
    expect(apiWorkspace.summaryComprehensionChecks[0].reviewStatus).toBe("Interpreter follow-up scheduled");
    expect(apiWorkspace.summaryComprehensionChecks[0].reviewedByRole).toBe("caseManager");
    expect(apiWorkspace.auditLog[0].title).toBe("Understanding response recorded");
  });

  test("persists IEP version comparison review from the plan summary", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed IEP comparison coverage runs on desktop.");
    await reset(page);

    await nav(page, "Plan summary");
    const comparisonCard = page.locator(".card").filter({ hasText: "IEP version comparison" });
    await expect(comparisonCard).toContainText("Speech-language service gap now has a recovery follow-up");
    await page.getByLabel("Previous document label").fill("Jordan prior IEP");
    await page.getByLabel("Current document label").fill("Jordan current IEP");
    await page.getByLabel("Previous IEP full text").fill(
      "Goal: Jordan will improve reading comprehension with teacher support. Service: Reading support 30 minutes weekly in a pull-out small group. Accommodation: Extended time as needed."
    );
    await page.getByLabel("Current IEP full text").fill(
      "Goal: Jordan will answer literal and inferential questions with 80% accuracy across weekly probes. Service: Reading support 30 minutes weekly in the general education classroom. Accommodation: Extended time 1.5x for classroom assessments."
    );
    await page.getByRole("button", { name: "Generate comparison candidates" }).click();
    await expect(page.getByText("IEP auto-diff candidates generated")).toBeVisible();
    await expect(comparisonCard).toContainText("Auto-diff found changed service-delivery language");
    await expect(comparisonCard).toContainText("Automated prior/current text diff");
    await expect(comparisonCard).toContainText("Amendment review needed");

    await page.getByLabel("Comparison section").selectOption("Services");
    await page.getByLabel("Comparison change type").fill("Prior/current language comparison");
    await page.getByLabel("Comparison title").fill("Service location changed from pull-out to classroom support");
    await page.getByLabel("Previous IEP language").fill("Previous IEP listed reading support in a pull-out small-group setting.");
    await page.getByLabel("Current IEP language").fill("Current IEP lists reading support delivered in the general education classroom with weekly probes.");
    await page.getByLabel("Comparison implementation impact").fill("General education teachers need to know the support now happens during classroom instruction.");
    await page.getByLabel("Comparison family language").fill("Reading support is now described as happening in class, so the team should explain how it will be delivered.");
    await page.getByLabel("Comparison source reference").fill("Prior/current IEP version intake - services");
    await page.getByLabel("Amendment review status").selectOption("Amendment review needed");
    await page.getByLabel("Amendment review note").fill("Team must confirm whether this language reflects an official amendment or a new annual IEP.");
    await page.getByLabel("Make new comparison student-visible").check();
    await page.getByRole("button", { name: "Add IEP comparison" }).click();
    await expect(page.getByText("IEP comparison added")).toBeVisible();
    await expect(comparisonCard).toContainText("Service location changed from pull-out to classroom support");
    await expect(comparisonCard).toContainText("Amendment review needed");
    await expect(comparisonCard).toContainText("does not amend the official IEP");

    await page.getByLabel("Comparison item").selectOption({ label: "Service location changed from pull-out to classroom support" });
    await page.getByLabel("Comparison review status").selectOption("Reviewed for meeting");
    await page.getByLabel("Comparison review note").fill(
      "New service-location comparison reviewed for the meeting packet and amendment-boundary discussion."
    );
    await page.getByRole("button", { name: "Review IEP comparison" }).click();
    await expect(page.getByText("IEP comparison reviewed")).toBeVisible();

    await page.getByLabel("Comparison item").selectOption("comparison-service-recovery");
    await page.getByLabel("Comparison review status").selectOption("Reviewed for meeting");
    await page.getByLabel("Comparison review note").fill(
      "Recovery comparison reviewed for the meeting packet and family-facing summary."
    );
    await page.getByRole("button", { name: "Review IEP comparison" }).click();
    await expect(page.getByText("IEP comparison reviewed")).toBeVisible();
    await expect(comparisonCard).toContainText("Reviewed for meeting");
    await expect(comparisonCard).toContainText("family-facing summary");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const comparison = apiWorkspace.iepComparisons.find((item) => item.id === "comparison-service-recovery");
    expect(comparison.status).toBe("Reviewed for meeting");
    expect(comparison.reviewedBy).toBe("BJ Tarves");
    expect(comparison.comparisonDigest).toMatch(/^[a-f0-9]{64}$/);
    const createdComparison = apiWorkspace.iepComparisons.find((item) => item.title === "Service location changed from pull-out to classroom support");
    expect(createdComparison).toBeTruthy();
    expect(createdComparison.status).toBe("Reviewed for meeting");
    expect(createdComparison.versionIntake.createdBy).toBe("BJ Tarves");
    expect(createdComparison.amendmentReviewStatus).toBe("Amendment review needed");
    expect(createdComparison.studentVisible).toBe(true);
    expect(createdComparison.comparisonDigest).toMatch(/^[a-f0-9]{64}$/);
    const autoDiffComparison = apiWorkspace.iepComparisons.find(
      (item) => item.title === "Auto-diff found changed service-delivery language"
    );
    expect(autoDiffComparison).toBeTruthy();
    expect(autoDiffComparison.status).toBe("Needs team review");
    expect(autoDiffComparison.versionIntake.intakeMethod).toBe("Automated prior/current text diff");
    expect(autoDiffComparison.versionIntake.previousDocumentLabel).toBe("Jordan prior IEP");
    expect(autoDiffComparison.comparisonDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(apiWorkspace.auditLog[0].title).toBe("IEP comparison reviewed");

    const auditStatus = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/audit/verify`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return response.json();
    }, API_BASE_URL);
    expect(auditStatus.valid).toBe(true);
  });

  test("persists staff handoff acknowledgments through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed handoff coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("generalEducation");
    await expectToast(page, "Account switched");
    await nav(page, "Implementation");
    await page.getByLabel("Responsibility").selectOption("task-003");
    await page.getByLabel("Acknowledgment note").fill("Science routine rating will be completed every Friday.");
    await page.getByRole("button", { name: "Acknowledge handoff" }).click();
    await expect(page.getByText("Handoff acknowledged")).toBeVisible();
    await expect(page.locator(".handoff-row").filter({ hasText: "L. Kim" })).toContainText("Leah Kim");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const task = apiWorkspace.tasks.find((item) => item.id === "task-003");
    expect(task.acknowledgments[0].acknowledgedBy).toBe("Leah Kim");
    expect(task.acknowledgments[0].note).toContain("Science routine");
    expect(apiWorkspace.auditLog[0].title).toBe("Implementation handoff acknowledged");
  });

  test("persists classroom observations through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed classroom observation coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("generalEducation");
    await expectToast(page, "Account switched");
    await nav(page, "Implementation");
    await page.getByLabel("Observation task").selectOption("task-003");
    await page.getByLabel("Observation date").fill("2026-06-24");
    await page.getByLabel("Classroom context").fill("Science independent work");
    await page.getByLabel("Support use").fill("Visual checklist and one prompt");
    await page.getByLabel("Observation note").fill("Jordan used the checklist after one prompt and completed three of five routines.");
    await page.getByRole("button", { name: "Record observation" }).click();
    await expect(page.getByText("Classroom observation recorded")).toBeVisible();
    await expect(page.locator(".card").filter({ hasText: "Classroom observations" })).toContainText("Science independent work");
    await expect(page.locator(".task").filter({ hasText: "Collect executive-function teacher rating" })).toContainText("Latest observation");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const task = apiWorkspace.tasks.find((item) => item.id === "task-003");
    expect(task.observations[0].enteredBy).toBe("Leah Kim");
    expect(task.observations[0].note).toContain("three of five routines");
    expect(apiWorkspace.auditLog[0].title).toBe("Classroom observation recorded");
  });

  test("persists task completion evidence through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed task evidence coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("generalEducation");
    await expectToast(page, "Account switched");
    await nav(page, "Implementation");
    await page.getByLabel("Task to complete").selectOption("task-003");
    await page.getByLabel("Completion note").fill("Weekly executive-function rating completed and attached.");
    await page.getByLabel("Task evidence label").fill("Executive-function routine rating");
    await page.getByRole("button", { name: "Complete with evidence" }).click();
    await expect(page.getByText("Task evidence recorded")).toBeVisible();
    await expect(page.locator(".task").filter({ hasText: "Collect executive-function teacher rating" })).toContainText(
      "Executive-function routine rating"
    );

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const task = apiWorkspace.tasks.find((item) => item.id === "task-003");
    expect(task.status).toBe("Completed");
    expect(task.completionEvidence.completedBy).toBe("Leah Kim");
    expect(task.completionEvidence.evidenceDocumentId).toBe("doc-001");
    expect(task.completionEvidence.evidenceLabel).toBe("Executive-function routine rating");
    expect(apiWorkspace.auditLog[0].title).toBe("Implementation task updated");
  });

  test("persists progress evidence attachments and schedule updates through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed progress schedule coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("generalEducation");
    await expectToast(page, "Account switched");
    await nav(page, "Progress");
    await expect(page.getByRole("heading", { name: "Measurement schedule" })).toBeVisible();
    await page.getByLabel("Evidence label").fill("Weekly comprehension probe artifact");
    await page.getByLabel("Evidence type").fill("Comprehension probe");
    await page.getByRole("button", { name: "Add data point" }).click();
    await expect(page.getByText("Progress saved")).toBeVisible();
    await expect(page.locator(".question-row").filter({ hasText: "Weekly · Comprehension probe" })).toContainText("Jun 30, 2026");
    const reportRow = page.locator(".question-row").filter({ hasText: "Reading progress report draft" });
    await expect(reportRow).toContainText("Weekly comprehension probe artifact");
    await expect(reportRow).toContainText("Draft progress report language only");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const goal = apiWorkspace.goals.find((item) => item.id === "goal-001");
    const latest = goal.progressEntries.at(-1);
    expect(latest.evidenceDocumentId).toBe("doc-001");
    expect(latest.evidenceLabel).toBe("Weekly comprehension probe artifact");
    expect(goal.progressSchedule.lastCollectedDate).toBe("2026-06-23");
    expect(goal.progressSchedule.nextDueDate).toBe("2026-06-30");
    expect(apiWorkspace.auditLog[0].title).toBe("Progress evidence entered");
  });

  test("persists missed-service recovery plans through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed service recovery coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("relatedServiceProvider");
    await expectToast(page, "Account switched");
    await nav(page, "Services");
    await page.getByLabel("Recovery date", { exact: true }).fill("2026-06-26");
    await page.getByLabel("Recovery provider", { exact: true }).fill("R. Coleman");
    await page.getByLabel("Family communication", { exact: true }).fill(
      "Family notified that speech-language minutes will be recovered on Friday."
    );
    await page.getByRole("button", { name: "Plan recovery" }).click();
    await expect(page.getByText("Recovery planned").first()).toBeVisible();
    await expect(page.locator("tr").filter({ hasText: "Speech-language support" })).toContainText("Jun 26, 2026");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const service = apiWorkspace.services.find((item) => item.id === "service-001");
    expect(service.recoveryStatus).toBe("Recovery planned");
    expect(service.recoveryPlan.recoveryDate).toBe("2026-06-26");
    expect(service.recoveryPlan.provider).toBe("R. Coleman");
    expect(service.recoveryPlan.familyCommunication).toContain("Friday");
    expect(service.recoveryPlan.plannedBy).toBe("R. Coleman");
    expect(apiWorkspace.user.role).toBe("relatedServiceProvider");
    expect(apiWorkspace.auditLog[0].title).toBe("Service recovery planned");
  });

  test("persists assistive technology and transportation access support reviews", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed access support coverage runs on desktop.");
    await reset(page);

    await nav(page, "Services");
    const accessCard = page.locator("article.card").filter({ has: page.getByRole("heading", { name: "Access supports" }) });
    await expect(accessCard).toContainText("Assistive technology");
    await expect(accessCard).toContainText("Transportation");
    await page.getByLabel("Access support", { exact: true }).selectOption("access-at-organizer");
    await page.getByLabel("Access support status", { exact: true }).selectOption("Active");
    await page.getByLabel("Access support owner", { exact: true }).fill("Case Manager");
    await page.getByLabel("Access implementation plan").fill(
      "Organizer format, storage location, and staff prompt routine confirmed for all core classes."
    );
    await page.getByLabel("Access review note").fill(
      "Assistive technology consideration reviewed; no dedicated device is required beyond organizer access."
    );
    await page.getByRole("button", { name: "Update access support" }).click();
    await expect(page.getByText("Access support reviewed")).toBeVisible();
    await expect(accessCard).toContainText("Active");
    await expect(accessCard).toContainText("staff prompt routine confirmed");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const support = apiWorkspace.accessSupportPlans.find((item) => item.id === "access-at-organizer");
    expect(support.status).toBe("Active");
    expect(support.reviewedBy).toBe("BJ Tarves");
    expect(support.reviewNote).toContain("no dedicated device");
    expect(support.supportDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(apiWorkspace.auditLog[0].title).toBe("Access support review updated");

    const auditStatus = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/audit/verify`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return response.json();
    }, API_BASE_URL);
    expect(auditStatus.valid).toBe(true);
  });

  test("persists educational placement and LRE review from the quality-review workspace", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed placement review coverage runs on desktop.");
    await reset(page);

    await nav(page, "Services");
    await expect(page.locator("article.card").filter({ hasText: "Assessment and special considerations" })).toContainText("Educational placement");
    await nav(page, "Quality review");
    const placementCard = page.locator("article.card").filter({ has: page.getByRole("heading", { name: "Placement and LRE review" }) });
    await expect(placementCard).toContainText("General education with supplemental supports");
    await expect(placementCard).toContainText("official placement and LRE decisions");
    await page.getByLabel("Placement review", { exact: true }).selectOption("placement-review-001");
    await page.getByLabel("Placement review status", { exact: true }).selectOption("Source aligned");
    await page.getByLabel("Placement follow-up owner").fill("Case Manager");
    await page.getByLabel("Next placement review date").fill("2026-07-01");
    await page.getByLabel("LRE consideration").fill(
      "General education remains the primary setting while small-group services support the documented reading and speech-language needs."
    );
    await page.getByLabel("Placement implementation impact").fill(
      "Coordinate pull-out service minutes with classroom accommodation responsibilities before the annual review."
    );
    await page.getByLabel("Placement reviewer note").fill(
      "Placement rationale reviewed for meeting preparation; no automated placement decision was made."
    );
    await page.getByRole("button", { name: "Update placement review" }).click();
    await expect(page.getByText("Placement review updated")).toBeVisible();
    await expect(placementCard).toContainText("Source aligned");
    await expect(placementCard).toContainText("pull-out service minutes");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const review = apiWorkspace.placementReviews.find((item) => item.id === "placement-review-001");
    expect(review.status).toBe("Source aligned");
    expect(review.reviewedBy).toBe("BJ Tarves");
    expect(review.reviewerNote).toContain("no automated placement decision");
    expect(review.placementDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(apiWorkspace.auditLog[0].title).toBe("Placement rationale review updated");

    const auditStatus = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/audit/verify`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return response.json();
    }, API_BASE_URL);
    expect(auditStatus.valid).toBe(true);
  });

  test("persists language access requests and coordination through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed language access coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("parent");
    await expectToast(page, "Account switched");
    await nav(page, "Meetings");
    await page.getByLabel("Preferred language").selectOption("Spanish");
    await page.getByLabel("Interpreter needed for the meeting").check();
    await page.getByLabel("Family note").fill("Please provide Spanish interpretation before the meeting.");
    await page.getByRole("button", { name: "Request language support" }).click();
    await expect(page.getByText("Language access requested")).toBeVisible();
    await expect(page.getByText("Resumen familiar en lenguaje sencillo")).toBeVisible();
    await page.getByLabel("Glossary term", { exact: true }).selectOption("glossary-progress-monitoring");
    await page.getByLabel("Term clarity status").selectOption("Interpreter explanation requested");
    await page.getByLabel("Term question or note").fill("Please explain progress monitoring with the interpreter before the meeting.");
    await page.getByRole("button", { name: "Update glossary note" }).click();
    await expect(page.getByText("Glossary clarification requested")).toBeVisible();

    let apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.meetings[0].languageAccess.requestedBy).toBe("Robin Lee");
    expect(apiWorkspace.meetings[0].languageAccess.interpreterStatus).toBe("Requested");
    let glossaryTerm = apiWorkspace.meetings[0].languageAccess.glossary.find((item) => item.id === "glossary-progress-monitoring");
    expect(glossaryTerm.clarityStatus).toBe("Interpreter explanation requested");
    expect(glossaryTerm.clarityRequestedBy).toBe("Robin Lee");

    await page.locator(".role-control select").selectOption("caseManager");
    await expectToast(page, "Account switched");
    await nav(page, "Meetings");
    await page.getByLabel("Translation status").selectOption("Human reviewed");
    await page.getByLabel("Interpreter status").selectOption("Interpreter assigned");
    await page.getByLabel("Coordinator note").fill("Bilingual packet reviewed and interpreter confirmed.");
    await page.getByRole("button", { name: "Update language support" }).click();
    await expect(page.getByText("Language access coordinated")).toBeVisible();

    apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.meetings[0].languageAccess.translationStatus).toBe("Human reviewed");
    expect(apiWorkspace.meetings[0].languageAccess.interpreterStatus).toBe("Interpreter assigned");
    expect(apiWorkspace.auditLog[0].title).toBe("Language access coordinated");

    await page.getByLabel("Glossary response term", { exact: true }).selectOption("glossary-progress-monitoring");
    await page.getByLabel("Glossary response status").selectOption("Explained by staff");
    await page.getByLabel("Glossary response", { exact: true }).fill(
      "Progress monitoring means the team checks goal data on the schedule and reviews it before reports."
    );
    await page.getByRole("button", { name: "Record glossary response" }).click();
    await expect(page.getByText("Glossary explanation recorded")).toBeVisible();

    apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    glossaryTerm = apiWorkspace.meetings[0].languageAccess.glossary.find((item) => item.id === "glossary-progress-monitoring");
    expect(glossaryTerm.staffResponseStatus).toBe("Explained by staff");
    expect(glossaryTerm.staffRespondedBy).toBe("BJ Tarves");
    expect(glossaryTerm.staffResponse).toContain("checks goal data");
    expect(apiWorkspace.auditLog[0].title).toBe("Glossary explanation recorded");
  });

  test("persists meeting prep notes through parent sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed meeting note coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("parent");
    await expectToast(page, "Account switched");
    await nav(page, "Meetings");
    await expect(page.getByRole("heading", { name: "Meeting prep notes" })).toBeVisible();
    await page.getByLabel("Meeting prep note topic").fill("Parent notes area");
    await page.getByLabel("Meeting prep note audience").selectOption("IEP team");
    await page.getByLabel("Meeting prep note", { exact: true }).fill("Please leave time to discuss service recovery and science reading supports.");
    await page.getByRole("button", { name: "Add meeting note" }).click();
    await expect(page.getByText("Meeting prep note added")).toBeVisible();
    await expect(page.locator(".question-row").filter({ hasText: "service recovery and science reading" })).toContainText("Robin Lee");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const note = apiWorkspace.meetings[0].meetingPrepNotes[0];
    expect(note.topic).toBe("Parent notes area");
    expect(note.submittedBy).toBe("Robin Lee");
    expect(note.submittedByRole).toBe("parent");
    expect(note.officialRecordImpact).toContain("does not change official IEP");
    expect(apiWorkspace.auditLog[0].title).toBe("Meeting prep note added");
  });

  test("persists required participant readiness through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed participant readiness coverage runs on desktop.");
    await reset(page);

    await nav(page, "Meetings");
    await page.getByLabel("Participant role").selectOption("participant-lea");
    await page.getByLabel("Attendance status").selectOption("Confirmed");
    await page.getByLabel("Participation mode").selectOption("In person");
    await page.getByLabel("Participant note").fill("LEA representative confirmed for placement and resource decisions.");
    await page.getByRole("button", { name: "Update participant readiness" }).click();
    await expect(page.getByText("Participant readiness updated")).toBeVisible();

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const lea = apiWorkspace.meetings[0].requiredParticipants.find((item) => item.id === "participant-lea");
    expect(lea.status).toBe("Confirmed");
    expect(lea.confirmedBy).toBe("BJ Tarves");
    expect(lea.note).toContain("placement");
    expect(apiWorkspace.auditLog[0].title).toBe("Participant readiness updated");
  });

  test("persists companion document readiness through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed companion document coverage runs on desktop.");
    await reset(page);

    await nav(page, "Meetings");
    await expect(page.getByRole("heading", { name: "Companion documents" })).toBeVisible();
    await page.getByLabel("Companion document").selectOption("companion-norep-pwn");
    await page.getByLabel("Companion status").selectOption("In progress");
    await page.getByLabel("Companion owner").fill("BJ Tarves");
    await page.getByLabel("Companion due date").fill("2026-06-28");
    await page.getByLabel("Companion note").fill(
      "Review NOREP/PWN support if the team proposes or refuses a formal placement or service change."
    );
    await page.getByRole("button", { name: "Update companion document" }).click();
    await expect(page.getByText("Companion document updated")).toBeVisible();
    await expect(page.locator(".question-row").filter({ hasText: "NOREP/PWN support check" })).toContainText("In progress");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const companion = apiWorkspace.meetings[0].companionDocuments.find((item) => item.id === "companion-norep-pwn");
    expect(companion.status).toBe("In progress");
    expect(companion.owner).toBe("BJ Tarves");
    expect(companion.reviewedBy).toBe("BJ Tarves");
    expect(companion.note).toContain("formal placement or service change");
    expect(apiWorkspace.auditLog[0].title).toBe("Companion document readiness updated");
  });

  test("persists family resource guide responses through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed family resource coverage runs on desktop.");
    await reset(page);

    await nav(page, "Meetings");
    const resourceCard = page.locator("article.card").filter({ has: page.getByRole("heading", { name: "Family resource guide" }) });
    await expect(resourceCard).toContainText("Procedural safeguards and rights overview");
    await page.getByLabel("Family resource").selectOption("resource-procedural-safeguards");
    await page.getByLabel("Resource status").selectOption("Reviewed with family");
    await page.getByLabel("Resource owner").fill("BJ Tarves");
    await page.getByLabel("Resource due date").fill("2026-06-24");
    await page.getByLabel("Resource note").fill(
      "Procedural safeguards and dispute-resolution resource guide reviewed during the pre-meeting call."
    );
    await page.getByRole("button", { name: "Update family resource" }).click();
    await expectToast(page, "Family resource guide updated");
    await expect(resourceCard).toContainText("Reviewed with family");

    await page.locator(".role-control select").selectOption("parent");
    await expectToast(page, "Account switched");
    await nav(page, "Meetings");
    await expect(resourceCard).toContainText("Procedural safeguards and rights overview");
    await page.getByLabel("Resource response", { exact: true }).selectOption("resource-procedural-safeguards");
    await page.getByLabel("Resource review status").selectOption("Interpreter support needed");
    await page.getByLabel("Resource response note").fill(
      "Please explain dispute-resolution options with interpreter support before the meeting."
    );
    await page.getByRole("button", { name: "Update resource response" }).click();
    await expectToast(page, "Family resource response recorded");
    await expect(resourceCard).toContainText("Interpreter support needed");
    await expect(resourceCard).toContainText("dispute-resolution options");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const resource = apiWorkspace.meetings[0].familyResources.find((item) => item.id === "resource-procedural-safeguards");
    expect(resource.status).toBe("Reviewed with family");
    expect(resource.familyStatus).toBe("Interpreter support needed");
    expect(resource.acknowledgedByRole).toBe("parent");
    expect(resource.officialRecordImpact).toContain("does not replace procedural safeguards");
    expect(apiWorkspace.auditLog[0].title).toBe("Family resource response recorded");
  });

  test("persists meeting calendar holds through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed calendar hold coverage runs on desktop.");
    await reset(page);

    await nav(page, "Meetings");
    await expect(page.getByRole("heading", { name: "Calendar holds" })).toBeVisible();
    await page.getByLabel("Calendar provider").selectOption("Outlook (simulated)");
    await page.getByLabel("Calendar attendance mode").selectOption("Video option");
    await page.getByLabel("Calendar note").fill("Calendar hold created after confirming participant options.");
    await page.getByRole("button", { name: "Create calendar hold" }).click();
    await expectToast(page, "Calendar hold created");
    await expect(page.locator(".question-row").filter({ hasText: "Outlook (simulated)" })).toContainText("Video option");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.calendarEvents[0].provider).toBe("Outlook (simulated)");
    expect(apiWorkspace.calendarEvents[0].attendanceMode).toBe("Video option");
    expect(apiWorkspace.calendarEvents[0].createdBy).toBe("BJ Tarves");
    expect(apiWorkspace.auditLog[0].title).toBe("Calendar hold created");

    await page.reload();
    await expect(page.locator(".sync-pill strong")).toHaveText("API-backed workspace");
    await nav(page, "Meetings");
    await expect(page.locator(".question-row").filter({ hasText: "Outlook (simulated)" })).toContainText("Hold created");
  });

  test("persists meeting transcript summaries from the meeting prep workspace", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed transcript recap coverage runs on desktop.");
    await reset(page);

    await nav(page, "Meetings");
    const recapCard = page.locator("article.card").filter({ has: page.getByRole("heading", { name: "Transcript recap" }) });
    await expect(recapCard).toContainText("does not amend the official IEP");
    await expect(recapCard).toContainText("Recording/source readiness");
    await page.getByLabel("Recording source").selectOption("Manual transcript paste");
    await page.getByLabel("Recording readiness status").selectOption("Source readiness reviewed");
    await page.getByLabel("Participant consent summary").fill(
      "No recording is attached; transcript excerpt comes from staff notes and family-visible meeting-prep questions."
    );
    await page.getByLabel("Transcript handling plan").fill(
      "Human reviewer will summarize only meeting-prep topics and separate proposed follow-ups from official IEP decisions."
    );
    await page.getByLabel("Recording storage location").fill("Local demo workspace; no production recording provider connected.");
    await page.getByLabel("Recording retention boundary").fill(
      "Do not upload meeting recordings until district consent, retention, and access rules are confirmed."
    );
    await page.getByRole("button", { name: "Record recording readiness" }).click();
    await expectToast(page, "Meeting recording readiness recorded");
    await expect(recapCard).toContainText("Source readiness reviewed");
    await expect(recapCard).toContainText("no production recording provider");

    const readinessWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const recordingReview = readinessWorkspace.meetingRecordingReviews.find((item) =>
      item.participantConsentSummary.includes("No recording is attached")
    );
    expect(recordingReview.status).toBe("Source readiness reviewed");
    expect(recordingReview.reviewedBy).toBe("BJ Tarves");
    expect(recordingReview.familyVisible).toBe(false);
    expect(recordingReview.studentVisible).toBe(false);
    expect(recordingReview.recordingReviewDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(readinessWorkspace.auditLog[0].title).toBe("Meeting recording readiness recorded");

    await page.getByLabel("Transcript source").fill("Transcript paste from annual IEP prep");
    await page.getByLabel("Transcript excerpt").fill(
      "Family asked when missed speech-language minutes will be recovered and whether extended time applies to science tests."
    );
    await page.getByLabel("Transcript recap summary").fill(
      "Case manager will confirm service recovery and extended-time implementation before packet sharing."
    );
    await page.getByLabel("Transcript decisions").fill(
      "No official IEP changes were finalized in the recap.\nRecovery planning remains an implementation follow-up."
    );
    await page.getByLabel("Transcript follow-ups").fill("Confirm recovery provider.\nClarify extended-time trigger.");
    await page.getByLabel("Transcript review status").selectOption("Reviewed for packet");
    await page.getByRole("button", { name: "Record transcript summary" }).click();
    await expect(page.getByText("Meeting transcript summary recorded")).toBeVisible();
    await expect(recapCard).toContainText("Reviewed for packet");
    await expect(recapCard).toContainText("extended-time implementation");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const recap = apiWorkspace.meetingTranscriptSummaries.find((item) =>
      item.summary.includes("Case manager will confirm service recovery")
    );
    expect(recap.status).toBe("Reviewed for packet");
    expect(recap.reviewedBy).toBe("BJ Tarves");
    expect(recap.familyVisible).toBe(true);
    expect(recap.studentVisible).toBe(false);
    expect(recap.transcriptDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(apiWorkspace.auditLog[0].title).toBe("Meeting transcript summary recorded");

    const auditStatus = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/audit/verify`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return response.json();
    }, API_BASE_URL);
    expect(auditStatus.valid).toBe(true);
  });

  test("persists meeting packet acknowledgments through parent sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed packet acknowledgment coverage runs on desktop.");
    await reset(page);

    await nav(page, "Meetings");
    await expect(page.getByRole("heading", { name: "E-signature requests" })).toBeVisible();
    const signatureCard = page.locator(".card").filter({ hasText: "E-signature requests" });
    await page.getByLabel("Signature request note").fill("Please sign after reviewing the packet and draft-to-final notes.");
    await page.getByRole("button", { name: "Request e-signature" }).click();
    await expect(page.getByText("E-signature requested")).toBeVisible();
    await expect(signatureCard.locator(".question-row").filter({ hasText: "Annual IEP pre-read packet" })).toContainText("Requested");

    await page.locator(".role-control select").selectOption("parent");
    await expectToast(page, "Account switched");
    await nav(page, "Meetings");
    await expect(page.getByRole("heading", { name: "Packet acknowledgments" })).toBeVisible();
    await page.getByLabel("Packet receipt").selectOption("packet-parent-robin");
    await page.getByLabel("Packet status").selectOption("Needs clarification");
    await page.getByLabel("Packet note").fill("I reviewed the packet and need clarification on the missed-service recovery plan.");
    await page.getByRole("button", { name: "Update packet acknowledgment" }).click();
    await expect(page.getByText("Packet acknowledgment updated")).toBeVisible();
    await expect(page.locator(".question-row").filter({ hasText: "Parent/guardian pre-read packet" })).toContainText("Needs clarification");
    await page.getByLabel("Typed signature name").fill("Robin Lee");
    await page.getByLabel("Signature attestation").fill("I typed my name to confirm I received and reviewed the scoped meeting packet. I understand this is not blanket consent or a final IEP decision.");
    await page.getByRole("button", { name: "Sign packet" }).click();
    await expectToast(page, "Meeting packet e-signed");
    await expect(signatureCard.locator(".question-row").filter({ hasText: "Annual IEP pre-read packet" })).toContainText("Signed");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const acknowledgment = apiWorkspace.meetings[0].packetAcknowledgments.find((item) => item.id === "packet-parent-robin");
    expect(acknowledgment.status).toBe("Needs clarification");
    expect(acknowledgment.acknowledgedBy).toBe("Robin Lee");
    expect(acknowledgment.acknowledgedByRole).toBe("parent");
    expect(acknowledgment.responseNote).toContain("missed-service recovery");
    const signature = apiWorkspace.meetings[0].eSignatureRequests[0];
    expect(signature.status).toBe("Signed");
    expect(signature.signerName).toBe("Robin Lee");
    expect(signature.signatureHash).toMatch(/^[a-f0-9]{64}$/);
    expect(signature.notConsentNote).toContain("does not replace IEP team decisions");
    expect(apiWorkspace.auditLog[0].title).toBe("Meeting packet e-signed");
  });

  test("persists student self-advocacy prep through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed self-advocacy coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("student");
    await expectToast(page, "Account switched");
    await nav(page, "Meetings");
    await expect(page.getByRole("heading", { name: "Self-advocacy prep" })).toBeVisible();
    await page.getByLabel("Support I want to ask for").fill("Graphic organizer during science reading");
    await page.getByLabel("Self-advocacy participation goal").fill("I want to explain when the organizer helps me answer questions.");
    await page.getByLabel("Self-advocacy practice script").fill("Can I use my organizer before I answer the science questions?");
    await page.getByLabel("Self-advocacy confidence").fill("5");
    await page.getByLabel("Self-advocacy barrier").fill("I get nervous asking after class has started.");
    await page.getByLabel("Self-advocacy practice action").fill("Practice the request with my case manager before the meeting.");
    await page.getByRole("button", { name: "Update self-advocacy plan" }).click();
    await expect(page.getByText("Self-advocacy plan updated")).toBeVisible();
    await expect(
      page.locator("article.card").filter({ has: page.getByRole("heading", { name: "Self-advocacy prep" }) })
    ).toContainText("Graphic organizer during science reading");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.meetings[0].selfAdvocacyPlan.preferredSupport).toBe("Graphic organizer during science reading");
    expect(apiWorkspace.meetings[0].selfAdvocacyPlan.confidence).toBe(5);
    expect(apiWorkspace.meetings[0].selfAdvocacyPlan.updatedBy).toBe("Jordan Lee");
    expect(apiWorkspace.auditLog[0].title).toBe("Self-advocacy plan updated");
  });

  test("persists staff continuity coverage plans through administrator sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed staff continuity coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("administrator");
    await expectToast(page, "Account switched");
    await nav(page, "Leadership");
    await expect(page.getByRole("heading", { name: "Staff continuity risks" })).toBeVisible();
    await page.getByLabel("Continuity record").selectOption("continuity-slp-vacancy");
    await page.getByLabel("Continuity status").selectOption("Coverage assigned");
    await page.getByLabel("Continuity risk").selectOption("Medium");
    await page.getByLabel("Coverage owner").fill("D. Nguyen");
    await page.getByLabel("Next continuity review").fill("2026-06-28");
    await page.getByLabel("Coverage plan").fill(
      "Contract SLP covers missed sessions and confirms recovery minutes with the family."
    );
    await page.getByRole("button", { name: "Update continuity plan" }).click();
    await expect(page.getByText("Continuity plan updated")).toBeVisible();
    await expect(page.locator(".question-row").filter({ hasText: "Speech-Language Pathologist" })).toContainText("Contract SLP");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const continuity = apiWorkspace.staffContinuity.find((item) => item.id === "continuity-slp-vacancy");
    expect(continuity.status).toBe("Coverage assigned");
    expect(continuity.riskLevel).toBe("Medium");
    expect(continuity.reviewedBy).toBe("D. Nguyen");
    expect(continuity.coveragePlan).toContain("Contract SLP");
    expect(apiWorkspace.auditLog[0].title).toBe("Staff continuity plan updated");
  });

  test("persists draft-to-final meeting decisions through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed draft-to-final coverage runs on desktop.");
    await reset(page);

    await nav(page, "Meetings");
    await page.getByLabel("Draft change to finalize").selectOption("diff-001");
    await page.getByLabel("Final language", { exact: true }).fill(
      "Recovery minutes will be scheduled and communicated before the annual review."
    );
    await page.getByLabel("Decision rationale", { exact: true }).fill(
      "The pre-read packet distinguishes recovery logistics from official service-frequency changes."
    );
    await page.getByRole("button", { name: "Record final language" }).click();
    await expect(page.getByText("Final language recorded")).toBeVisible();
    await expect(
      page.locator(".question-row").filter({ hasText: "Final: Recovery minutes will be scheduled" })
    ).toContainText("Recovery minutes will be scheduled");

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const diff = apiWorkspace.meetings[0].draftDiffs.find((item) => item.id === "diff-001");
    expect(diff.status).toBe("Finalized");
    expect(diff.finalText).toContain("Recovery minutes");
    expect(diff.decisionRationale).toContain("pre-read packet");
    expect(diff.finalizedBy).toBe("BJ Tarves");
    expect(apiWorkspace.auditLog[0].title).toBe("Draft-to-final decision recorded");
  });

  test("persists draft section revisions with version history through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed draft revision coverage runs on desktop.");
    await reset(page);

    await nav(page, "Drafting & training");
    await page.getByLabel("Primary strengths").fill("Strong verbal reasoning and discussion participation.");
    await page.getByLabel("Priority needs").fill("Inferential reading and organized written explanations.");
    await page.getByLabel("Progress evidence").fill("Weekly comprehension probes and monthly writing rubric samples.");
    await page.getByLabel("Family or team priority").fill("Family wants supports that transfer across science and social studies.");
    await page.getByLabel("Student voice").fill("I need steps and an example before I start.");
    await page.getByLabel("Annotated sample or district language").fill(
      "Annotated sample: include condition, baseline, measurement method, frequency, and mastery criterion."
    );
    await page.getByRole("button", { name: "Generate fictional training IEP" }).click();
    await expect(page.getByText("Draft generated")).toBeVisible();
    await expect(page.locator(".draft-section").filter({ hasText: "Present levels draft" })).toContainText("Strong verbal reasoning");
    await expect(page.locator(".draft-section").filter({ hasText: "Services and supports draft" })).toContainText("science and social studies");
    await expect(page.locator(".draft-section").filter({ hasText: "Assessment accommodations draft" })).toContainText("assessment");
    await expect(page.locator(".draft-section").filter({ hasText: "Behavior support plan draft" })).toContainText("behavior");
    await expect(page.locator(".draft-section").filter({ hasText: "Educational placement rationale draft" })).toContainText("placement");
    await page.getByLabel("Draft section").selectOption("measurable-goal");
    await page.getByLabel("Revised draft text").fill(
      "By June 2027, Jordan will answer inferential comprehension questions with 80% accuracy across three probes."
    );
    await page.getByLabel("Revision note").fill("Added criterion, timeline, and measurement method for review.");
    await page.getByRole("button", { name: "Save draft revision" }).click();
    await expect(page.getByText("Draft revision saved")).toBeVisible();
    const section = page.locator(".draft-section").filter({ hasText: "Measurable annual goal draft" });
    await expect(section).toContainText("Version 2");
    await expect(section).toContainText("1 prior version");
    await expect(section).toContainText("By June 2027");
    await expect(page.getByRole("button", { name: "Export draft" })).toBeDisabled();
    await page.getByRole("button", { name: "Regenerate section" }).click();
    await expect(page.getByText("Draft section regenerated")).toBeVisible();
    await expect(section).toContainText("Version 3");
    await expect(section).toContainText("2 prior versions");
    await expect(section).toContainText("Regenerated from profile");
    await expect(page.getByRole("button", { name: "Export draft" })).toBeDisabled();
    await page.getByRole("button", { name: "Approve draft for export" }).click();
    await expect(page.getByText("Draft package approved")).toBeVisible();
    await expect(page.getByText("Approved for export")).toBeVisible();
    await expect(page.getByRole("button", { name: "Export draft" })).toBeEnabled();

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const draftSection = apiWorkspace.draft.sections.find((item) => item.id === "measurable-goal");
    expect(apiWorkspace.draft.guidedResponses.familyPriority).toContain("science and social studies");
    expect(apiWorkspace.draft.annotatedSample).toContain("Annotated sample");
    expect(draftSection.version).toBe(3);
    expect(draftSection.status).toBe("Regenerated - human review required");
    expect(draftSection.reviewedBy).toBe("BJ Tarves");
    expect(draftSection.versionHistory[0].content).toContain("By June 2027");
    expect(draftSection.versionHistory[1].content).toContain("baseline, method, frequency");
    expect(apiWorkspace.draft.status).toBe("Approved for export");
    expect(apiWorkspace.draft.approvedBy).toBe("BJ Tarves");
    expect(apiWorkspace.auditLog[0].title).toBe("Draft package approved");
    expect(apiWorkspace.auditLog[1].title).toBe("Draft section regenerated");
  });

  test("persists concern log decisions through role sessions", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed concern ledger coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("parent");
    await expectToast(page, "Account switched");
    await nav(page, "Meetings");
    await page.getByLabel("Concern title").fill("Recovery communication");
    await page.getByLabel("Concern detail").fill("Please document when missed speech-language minutes will be recovered.");
    await page.getByRole("button", { name: "Log concern" }).click();
    await expect(page.getByText("Concern logged")).toBeVisible();
    await expect(page.locator(".question-row").filter({ hasText: "Recovery communication" })).toContainText("Robin Lee");

    let apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const concernId = apiWorkspace.meetings[0].concerns[0].id;
    expect(apiWorkspace.meetings[0].concerns[0].submittedBy).toBe("Robin Lee");

    await page.locator(".role-control select").selectOption("caseManager");
    await expectToast(page, "Account switched");
    await nav(page, "Meetings");
    await page.getByLabel("Concern to resolve").selectOption(concernId);
    await page.getByLabel("Staff response").fill("The team reviewed missed service documentation.");
    await page.getByLabel("Decision record").fill("Recovery minutes will be scheduled without changing service frequency.");
    await page.getByLabel("Next step").fill("Case manager will send the recovery date to the family.");
    await page.getByLabel("PWN support note").fill("PWN review is only needed if a formal service change is proposed or refused.");
    await page.getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByText("Decision recorded")).toBeVisible();

    apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    const resolved = apiWorkspace.meetings[0].concerns.find((item) => item.id === concernId);
    expect(resolved.status).toBe("Resolved");
    expect(resolved.resolvedBy).toBe("BJ Tarves");
    expect(resolved.decision).toContain("Recovery minutes");
    expect(apiWorkspace.auditLog[0].title).toBe("Decision record updated");
  });

  test("manages gap-closure readiness from Leadership with role-aware filtering", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Gap-closure governance coverage runs on desktop.");
    await reset(page);

    await page.locator(".role-control select").selectOption("administrator");
    await expectToast(page, "Account switched");
    await nav(page, "Leadership");

    const panel = page.getByTestId("gap-closure-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Gap Closure / Readiness");
    await expect(panel).toContainText("Daily workflow acceptance");
    await expect(panel).toContainText("Working workspace - not the official IEP record");
    await expect(panel).toContainText("6/6");
    await expect(panel).toContainText("10");

    await panel.getByRole("tab", { name: "Roles & records" }).click();
    await expect(panel).toContainText("Special education teacher / case manager");
    await expect(panel).toContainText("AI-assisted draft - not official IEP language");
    const roleEditor = page.getByTestId("role-policy-editor");
    await roleEditor.getByLabel("Review role policy record").selectOption("generalEducation");
    await roleEditor.getByLabel("Student scope").fill("Assigned classes and students only");
    await roleEditor.getByLabel("Review note").fill("Leadership confirmed least-privilege classroom scope for the pilot.");
    await roleEditor.getByRole("button", { name: "Save role review" }).click();
    await expectToast(page, "Review role policy saved");

    await panel.getByRole("tab", { name: "Alerts & metrics" }).click();
    await expect(panel).toContainText("Annual review deadline");
    await expect(panel).toContainText("Daily orientation time");
    await expect(panel).toContainText("Critical · 30 day window");
    const alertEditor = page.getByTestId("alert-rule-editor");
    await alertEditor.getByLabel("Review alert rule record").selectOption("missing-progress");
    await alertEditor.getByLabel("Trigger window (days)").fill("5");
    await alertEditor.getByLabel("Review note").fill("Pilot alert window reviewed against expected teacher volume.");
    await alertEditor.getByRole("button", { name: "Save alert review" }).click();
    await expectToast(page, "Review alert rule saved");

    const adminWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(adminWorkspace.rolePolicyMatrix.find((item) => item.roleId === "generalEducation").studentScope).toBe(
      "Assigned classes and students only"
    );
    expect(adminWorkspace.alertRules.find((item) => item.id === "missing-progress").triggerDays).toBe(5);
    expect(adminWorkspace.gapClosure.reviewHistory).toHaveLength(2);
    expect(adminWorkspace.gapClosure.latestReviewDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(adminWorkspace.auditLog[0].title).toBe("Alert prioritization rule reviewed");

    await page.locator(".role-control select").selectOption("parent");
    await expectToast(page, "Account switched");
    await nav(page, "Leadership");
    await expect(panel).toContainText("Working workspace - not the official IEP record");
    await expect(panel).toContainText("Detailed readiness policy is restricted to administrator governance roles");
    await expect(panel).toContainText("Roles documented");
    await panel.getByRole("tab", { name: "Roles & records" }).click();
    await expect(panel).toContainText("Detailed governance records are restricted to authorized administrators");
    await expect(panel).not.toContainText("Assigned classes and students only");
  });

  test("downloads server-generated DOCX and PDF report exports from the UI", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API-backed export coverage runs on desktop.");
    await reset(page);

    await nav(page, "Implementation");
    const checklistDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export teacher checklist" }).click();
    const checklistDownload = await checklistDownloadPromise;
    expect(checklistDownload.suggestedFilename()).toMatch(/^teacher-checklist-.*\.docx$/);
    await expect(page.getByText("Export generated")).toBeVisible();

    await nav(page, "Meetings");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export packet" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^meeting-prep-packet-.*\.docx$/);
    const meetingPacketPath = await download.path();
    expect(meetingPacketPath).toBeTruthy();
    const meetingPacketText = (await readFile(meetingPacketPath)).toString("utf8");
    expect(meetingPacketText).toContain("Review boundary");
    expect(meetingPacketText).toContain("Meeting prep packet does not change the official IEP");
    expect(meetingPacketText).toContain("Required participants");
    expect(meetingPacketText).toContain("Family and student questions");
    expect(meetingPacketText).toContain("Companion documents and packet receipts");
    expect(meetingPacketText).toContain("Source references");
    await expect(page.getByText("Export generated")).toBeVisible();

    await nav(page, "IEP intake");
    const pdfDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PDF" }).click();
    const pdfDownload = await pdfDownloadPromise;
    expect(pdfDownload.suggestedFilename()).toMatch(/^structured-iep-record-.*\.pdf$/);
    await expect(page.getByText("Export generated")).toBeVisible();

    const districtDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export district package" }).click();
    const districtDownload = await districtDownloadPromise;
    expect(districtDownload.suggestedFilename()).toMatch(/^district-system-package-.*\.json$/);
    const districtPackagePath = await districtDownload.path();
    expect(districtPackagePath).toBeTruthy();
    const districtPackage = JSON.parse(await readFile(districtPackagePath, "utf8"));
    expect(districtPackage.payload.packageType).toBe("DistrictSystemImportPackage");
    expect(districtPackage.payload.validation.requiredSections).toBeGreaterThan(5);
    expect(districtPackage.payload.importProfile.officialSubmission).toBe(false);
    expect(districtPackage.payload.importProfile.guardrail).toContain("not an automated official IEP submission");
    expect(districtPackage.payload.sourceRegistry.activeSourceId).toBe("pa-school-age-iep-non-annotated");
    await expect(page.getByText("Export generated")).toBeVisible();

    const apiWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(apiWorkspace.exports[0].label).toBe("District system package");
    expect(apiWorkspace.exports[0].format).toBe("json");
    expect(apiWorkspace.exports[0].artifact.fileName).toBe(districtDownload.suggestedFilename());
    expect(apiWorkspace.exports[0].downloadUrl).toContain("/api/exports/");
    expect(
      apiWorkspace.exports.some(
        (item) =>
          item.label === "Structured IEP record" &&
          item.format === "pdf" &&
          item.artifact.fileName === pdfDownload.suggestedFilename()
      )
    ).toBe(true);
    expect(
      apiWorkspace.exports.some(
        (item) =>
          item.label === "Meeting prep packet" &&
          item.format === "docx" &&
          item.artifact.fileName === download.suggestedFilename()
      )
    ).toBe(true);
    expect(
      apiWorkspace.exports.some(
        (item) =>
          item.label === "Teacher checklist" &&
          item.format === "docx" &&
          item.artifact.fileName === checklistDownload.suggestedFilename()
      )
    ).toBe(true);

    await page.locator(".role-control select").selectOption("districtAdministrator");
    await expectToast(page, "Account switched");
    await nav(page, "Audit trail");
    const exportTemplateCard = page.locator(".card").filter({
      has: page.getByRole("heading", { name: "Export template review" })
    });
    await expect(exportTemplateCard).toContainText("District system package");
    await exportTemplateCard.getByLabel("Target system").fill("District IEP system compatible JSON interchange");
    await exportTemplateCard.getByLabel("Template version").fill("IEP-IW-district-json-0.1");
    await exportTemplateCard.getByLabel("Validation status").selectOption("District import review ready");
    await exportTemplateCard.getByLabel("Mapping status").selectOption("Required sections mapped");
    await exportTemplateCard.getByLabel("Submission mode").selectOption("District import review");
    await exportTemplateCard.getByLabel("Mapping evidence").fill(
      "Generated package includes FDS section coverage, source registry metadata, goals, services, accommodations, implementation tasks, and audit context."
    );
    await exportTemplateCard
      .getByLabel("Validation evidence")
      .fill("Local package validation passed; live district IEP-system import validation remains pending.");
    await exportTemplateCard
      .getByLabel("Export review note")
      .fill("District export template mapping is ready for import review only, not official submission.");
    await exportTemplateCard.getByRole("button", { name: "Record export template review" }).click();
    await expectToast(page, "Export template reviewed");
    await expect(exportTemplateCard).toContainText("Required sections mapped");
    await expect(exportTemplateCard).toContainText("does not submit to a district system");

    const districtWorkspace = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      return (await response.json()).workspace;
    }, API_BASE_URL);
    expect(districtWorkspace.exportTemplateReviews[0].validationStatus).toBe("District import review ready");
    expect(districtWorkspace.exportTemplateReviews[0].mappingStatus).toBe("Required sections mapped");
    expect(districtWorkspace.exportTemplateReviews[0].packageFileName).toBe(districtDownload.suggestedFilename());
    expect(districtWorkspace.exportTemplateReviews[0].templateDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(districtWorkspace.auditLog[0].title).toBe("Export template reviewed");
  });
});
