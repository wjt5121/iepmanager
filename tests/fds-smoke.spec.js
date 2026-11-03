import { expect, test } from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:8789";

async function reset(page) {
  await page.addInitScript(() => localStorage.clear());
  const response = await page.request.post(`${API_BASE_URL}/api/test/reset`);
  if (!response.ok()) throw new Error(`Unable to reset API test data: ${response.status()}`);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good morning, BJ." })).toBeVisible();
  await expect(page.locator(".sync-pill strong")).toHaveText("API-backed workspace", { timeout: 15000 });
}

async function nav(page, label) {
  await page.locator(".navbtn").filter({ hasText: label }).click();
}

async function expectToast(page, message) {
  await expect(page.locator(".toast")).toContainText(message, { timeout: 15000 });
}

async function unnamedInteractiveControls(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const isHidden = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return element.hidden || style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0;
    };
    const labelledByText = (element) => clean(
      (element.getAttribute("aria-labelledby") || "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || "")
        .join(" ")
    );
    const labelForText = (element) => {
      if (!element.id) return "";
      const selector = `label[for="${window.CSS?.escape ? window.CSS.escape(element.id) : element.id}"]`;
      return clean(document.querySelector(selector)?.textContent || "");
    };
    const accessibleName = (element) => clean(
      element.getAttribute("aria-label") ||
      labelledByText(element) ||
      labelForText(element) ||
      element.closest("label")?.textContent ||
      (element.tagName === "BUTTON" ? element.textContent : "") ||
      element.getAttribute("placeholder") ||
      element.getAttribute("title")
    );
    return Array.from(document.querySelectorAll("button, input:not([type='hidden']), select, textarea, [role='tab']"))
      .filter((element) => !element.disabled && !isHidden(element) && element.getAttribute("aria-hidden") !== "true")
      .filter((element) => !accessibleName(element))
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role") || "",
        className: element.className || "",
        html: element.outerHTML.slice(0, 140)
      }));
  });
}

test.describe("IEP Implementation Workspace FDS smoke coverage", () => {
  test("renders every major FDS surface and performs core human-reviewed workflows", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Full workflow coverage runs on desktop.");
    test.slow();
    await reset(page);
    await expect(page.getByText("Reminder center")).toBeVisible();
    await expect(page.getByText("Reminders due")).toBeVisible();
    const dashboardReviewCard = page.locator(".card").filter({ hasText: "IEPs needing review" });
    await expect(dashboardReviewCard).toContainText("Jordan_Lee_IEP_2025-2026.pdf");
    await expect(dashboardReviewCard).toContainText("Human review needed");
    await expect(dashboardReviewCard).toContainText("extracted sections");
    await dashboardReviewCard.getByRole("button", { name: "Review source" }).click();
    await expect(page.getByText("Student profile intake")).toBeVisible();
    await expect(page.getByText("Jordan_Lee_IEP_2025-2026.pdf")).toBeVisible();
    await nav(page, "Overview");
    await expect(page.getByText("Recent parent summaries")).toBeVisible();
    await expect(page.getByText("Open family summary")).toBeVisible();
    await page.getByRole("button", { name: "Open family summary" }).click();
    await expect(page.getByRole("heading", { name: "Jordan's IEP in plain language" })).toBeVisible();
    await expect(page.locator(".summary-doc")).toContainText("What the school should provide");
    await nav(page, "Overview");
    await expect(page.getByText("Notification outbox")).toBeVisible();
    await expect(page.getByText("Send reminder notice")).toBeVisible();
    const classroomCard = page.locator(".card").filter({ hasText: "Classroom management" });
    await expect(classroomCard).toBeVisible();
    await expect(classroomCard.getByText("Record classroom roster review")).toBeVisible();
    await expect(classroomCard.getByText("15 students", { exact: true })).toBeVisible();

    const requiredViews = [
      ["Student workspace", ["Profile workflow map", "FDS profile sections", "Human-approved record", "IEP Document", "Plan Summary", "Goals", "Services", "Accommodations", "Progress Monitoring", "Meeting Prep", "Compliance Review", "3 goals", "3 services", "3 supports", "Readiness 78%", "IEP at a glance", "Portal access review", "Record portal access review", "Portal invitation packages", "Prepare portal invitation", "Team collaboration thread", "Add team comment", "Add thread reply", "Moderation status", "Record moderation review", "Collaboration moderation queue", "Record queue review", "Documents", "Activity Log"]],
      ["IEP intake", ["Student profile intake", "Create student profile", "Source document", "Structured extraction", "Source-to-field mapping", "Source anchor review", "Record source anchor review", "OCR/source quality review", "Record OCR review", "Annotated source guidance", "Validation prompts", "Drafting guardrail", "Export district package"]],
      ["Plan summary", ["Make the IEP understandable without changing its meaning.", "Copy summary", "IEP version comparison", "Automated prior/current diff", "Generate comparison candidates", "Add IEP comparison", "Amendment review status", "Review IEP comparison", "Meeting handouts", "Source fidelity", "Audience coverage", "Understanding checks", "What each goal means", "Questions for next meeting"]],
      ["Implementation", ["Implementation checklist", "Task evidence", "Classroom observations", "Staff handoff", "Export teacher checklist"]],
      ["Services", ["Services and accommodations", "Implementation window", "Evidence/logging", "Service delivery minutes must be logged", "No separate evidence attachment required", "Service action", "Access supports", "Assistive technology", "Transportation", "Update access support", "Assessment and special considerations", "State and local assessments", "Behavior support plan", "Educational placement"]],
      ["Progress", ["Enter progress data", "Measurement schedule", "Progress report packet", "Reading progress report draft", "Draft progress report language only"]],
      ["Meetings", ["Shared agenda", "Required participants", "Teacher feedback", "Calendar holds", "Transcript recap", "Recording/source readiness", "Record recording readiness", "Record transcript summary", "Companion documents", "Family resource guide", "Glossary questions", "Update glossary note", "Record glossary response", "Draft-to-final changes", "Packet acknowledgments", "E-signature requests", "Family questions", "Meeting prep notes", "Parent notes area", "Add meeting note", "Student voice", "Self-advocacy prep"]],
      ["Quality review", ["Review score", "Run completeness review", "Human review disposition", "Formal compliance review", "Request compliance review", "Compliance review outcome", "District counsel routing", "Route to district counsel", "Record counsel response", "Placement and LRE review", "Update placement review", "Section coverage", "Source-guided review prompts", "Not documented"]],
      ["Drafting & training", ["Guided profile", "Guided intake questionnaire", "Annotated sample or district language", "Draft package"]],
      ["Audit trail", ["Source chain", "Source registry review", "Source registry administration", "Export template review", "Record export template review", "Activity log", "Audit anchoring", "Record timestamp receipt", "Retention packages", "Current access lens", "Session governance", "Record identity lifecycle review", "Content classification", "AI governance", "Run AI guardrail evaluation", "Run AI citation evaluation", "Notification delivery log", "Calendar hold log", "Compliance review log", "Accessibility review", "VPAT-style", "Update accessibility finding", "Keyboard navigation", "Screen reader labels", "Live status updates", "Language access"]],
      ["Leadership", ["IEPs due soon", "Overdue progress reports", "Missing service logs", "Drafts pending review", "Continuity risks", "Gap Closure / Readiness", "Daily workflow acceptance", "Working workspace - not the official IEP record", "Compliance flags by school", "Staff continuity risks", "District implementation readiness", "Data protection readiness", "Update data protection readiness", "Update integration readiness", "Caseload overview", "Privacy boundary"]]
    ];

    for (const [label, texts] of requiredViews) {
      await nav(page, label);
      for (const text of texts) {
        await expect(page.locator("body")).toContainText(text);
      }
    }

    await nav(page, "Student workspace");
    let profileMap = page.locator(".profile-workflow");
    await profileMap.getByRole("button", { name: /Compliance Review/ }).click();
    await expect(page.getByRole("heading", { name: "Quality review" })).toBeVisible();
    await nav(page, "Student workspace");
    profileMap = page.locator(".profile-workflow");
    await profileMap.getByRole("button", { name: /Documents/ }).click();
    await expect(page.getByText("Preserved source documents")).toBeVisible();
    await expect(page.getByText("Jordan_Lee_IEP_2025-2026.pdf")).toBeVisible();
    await expect(page.getByText("Open source viewer")).toBeVisible();
    profileMap = page.locator(".profile-workflow");
    await profileMap.getByRole("button", { name: /Activity Log/ }).click();
    await expect(page.getByText("Student activity log")).toBeVisible();
    await expect(page.locator(".timeline").getByText("IEP source uploaded", { exact: true })).toBeVisible();
    await expect(page.getByText("Open full audit")).toBeVisible();

    await nav(page, "IEP intake");
    await page.getByPlaceholder("Paste IEP text here to run the demo extraction workflow.").fill(
      "Present levels: demo text. Goal: improve reading comprehension. Services: reading support 30 minutes weekly."
    );
    await page.getByRole("button", { name: "Preserve source and extract" }).click();
    await expect(page.locator(".extract-card").filter({ hasText: "Detected present levels" })).toBeVisible();
    await expect(page.locator("body")).toContainText("Demo extraction");

    await nav(page, "Implementation");
    await page.locator(".task .task-check").first().click();
    await expect(page.locator(".task").filter({ hasText: "Assign speech-language service recovery plan" })).toHaveClass(/done/);

    await nav(page, "Progress");
    await page.getByRole("button", { name: "Add data point" }).click();
    await expect(page.locator("article").filter({ hasText: "Reading goal" })).toContainText("74%");
    await expect(page.locator(".question-row").filter({ hasText: "Reading progress report draft" })).toContainText("Latest data: 74");

    await nav(page, "Services");
    await page.getByRole("button", { name: "Log service" }).click();
    await expect(page.locator("tr").filter({ hasText: "Speech-language support" })).toContainText("On schedule");

    await nav(page, "Quality review");
    await page.getByRole("button", { name: "Run completeness review" }).click();
    await expect(page.locator(".issue").filter({ hasText: "Behavior need is identified" })).toBeVisible();
    await page.getByLabel("Review rationale").fill("Case manager reviewed the service gap and assigned recovery planning.");
    await page.getByRole("textbox", { name: "Next action", exact: true }).fill("Confirm the recovery plan with the family before the meeting.");
    await page.getByRole("button", { name: "Record review disposition" }).click();
    await expect(page.locator(".issue").filter({ hasText: "Case manager reviewed the service gap" })).toBeVisible();

    await nav(page, "Meetings");
    await page.getByLabel("Participant role").selectOption("participant-lea");
    await page.getByLabel("Attendance status").selectOption("Confirmed");
    await page.getByLabel("Participant note").fill("LEA representative confirmed for placement and resource decisions.");
    await page.getByRole("button", { name: "Update participant readiness" }).click();
    await expect(page.locator(".participant-row").filter({ hasText: "LEA representative" })).toContainText("Confirmed");
    const openQuestionRow = page.locator(".question-row").filter({ hasText: "How will recent reading data change the support plan?" });
    await openQuestionRow.getByRole("button", { name: "Answer" }).click();
    await expect(openQuestionRow).toContainText("Response: Answered by team.");

    await nav(page, "Drafting & training");
    await page.getByRole("button", { name: "Generate fictional training IEP" }).click();
    await expect(page.getByRole("heading", { name: "Present levels draft" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Assessment accommodations draft" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Educational placement rationale draft" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save draft revision" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve draft for export" })).toBeVisible();

    await nav(page, "Audit trail");
    await expect(page.getByText("Training draft generated")).toBeVisible();
    await expect(page.locator("body")).toContainText("Progress evidence entered");

    await page.getByRole("button", { name: /BJ Tarves/i }).click();
    await page.getByRole("button", { name: "Science accommodations" }).click();
    await expect(page.locator("aside.assistant")).toContainText("Source-grounded explanation");
    await page.locator("aside.assistant").getByRole("tab", { name: "Extract" }).click();
    await page.getByRole("button", { name: "Summarize detected sections" }).click();
    await expect(page.locator("aside.assistant")).toContainText("Mode: Extract");
    await expect(page.locator("aside.assistant")).toContainText("IEP extraction support");
    await expect(page.locator("aside.assistant")).toContainText("Detected sections");
    await expect(page.locator("aside.assistant")).toContainText("human review");
    await expect(page.locator("aside.assistant")).toContainText("Source references");
    await page.locator("aside.assistant").getByRole("tab", { name: "Summarize" }).click();
    await page.getByRole("button", { name: "Parent summary" }).click();
    await expect(page.locator("aside.assistant")).toContainText("Parent summary generation");
    await expect(page.locator("aside.assistant")).toContainText("Audience coverage");
    await expect(page.locator("aside.assistant")).toContainText("Questions to prepare");
    await expect(page.locator("aside.assistant")).toContainText("without adding services");
    await page.getByRole("button", { name: "Student summary" }).click();
    await expect(page.locator("aside.assistant")).toContainText("Student-friendly explanation");
    await page.locator("aside.assistant").getByRole("tab", { name: "Checklist" }).click();
    await page.getByRole("button", { name: "Generate teacher checklist" }).click();
    await expect(page.locator("aside.assistant")).toContainText("Mode: Checklist");
    await expect(page.locator("aside.assistant")).toContainText("Source references");
    await expect(page.locator("aside.assistant")).toContainText("Content labels");
    await expect(page.locator("aside.assistant")).toContainText("Extracted IEP content");
    await expect(page.locator("aside.assistant")).toContainText("User-entered notes");
    await expect(page.locator("aside.assistant")).toContainText("Compliance warnings requiring human review");
    await page.locator("aside.assistant").getByRole("tab", { name: "Review" }).click();
    await page.getByRole("button", { name: "Are goals measurable?" }).click();
    await expect(page.locator("aside.assistant")).toContainText("Goal measurability review");
    await expect(page.locator("aside.assistant")).toContainText("Reading: has a complete measurable structure");
    await expect(page.locator("aside.assistant")).toContainText("Progress monitoring support");
    await page.locator("aside.assistant").getByRole("tab", { name: "Progress" }).click();
    await page.getByRole("button", { name: "Progress monitoring support" }).click();
    await expect(page.locator("aside.assistant")).toContainText("Mode: Progress");
    await expect(page.locator("aside.assistant")).toContainText("Missing or stale data");
    await expect(page.locator("aside.assistant")).toContainText("Draft progress report language support");
    await expect(page.locator("aside.assistant")).toContainText("cannot change annual goals");
    await page.locator("aside.assistant").getByRole("tab", { name: "Draft" }).click();
    await page.getByRole("button", { name: "Draft measurable goal section" }).click();
    await expect(page.locator("aside.assistant")).toContainText("Draft IEP section generation");
    await expect(page.locator("aside.assistant")).toContainText("Measurable annual goal draft");
    await expect(page.locator("aside.assistant")).toContainText("not official IEP content");
    await expect(page.locator("aside.assistant")).toContainText("human approval is required");
    await page.getByRole("button", { name: "Draft service recovery note" }).click();
    await expect(page.locator("aside.assistant")).toContainText("Missing information needed");
    await expect(page.locator("aside.assistant")).toContainText("recovery date");
    await expect(page.locator("aside.assistant")).toContainText("responsible provider");
    await expect(page.locator("aside.assistant")).toContainText("I will not invent");
    await page.locator("aside.assistant textarea").fill("Can you diagnose dyslexia from this IEP?");
    await page.locator("aside.assistant").getByRole("button", { name: "Send" }).click();
    await expect(page.locator("aside.assistant")).toContainText("I cannot diagnose disabilities");
    await expect(page.locator("aside.assistant")).toContainText("qualified evaluators");
    await page.locator("aside.assistant textarea").fill("Please certify this IEP is legally compliant and finalize placement.");
    await page.locator("aside.assistant").getByRole("button", { name: "Send" }).click();
    await expect(page.locator("aside.assistant")).toContainText("I cannot make legal conclusions");
    await expect(page.locator("aside.assistant")).toContainText("finalize placement");
  });

  test("enforces role-aware restrictions for parent/student style access", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Role-control selector is desktop-only.");
    await reset(page);

    await page.locator(".role-control select").selectOption("parent");
    await expectToast(page, "Account switched");
    await expect(page.getByRole("button", { name: /Robin Lee/i })).toBeVisible();

    const apiAccess = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      const payload = await response.json();
      return {
        role: payload.workspace.user.role,
        studentCount: payload.workspace.students.length
      };
    }, API_BASE_URL);
    expect(apiAccess).toEqual({ role: "parent", studentCount: 1 });

    await nav(page, "IEP intake");
    await expect(page.getByText("cannot upload or replace official IEP documents")).toBeVisible();
    await expect(page.getByRole("button", { name: "Preserve source and extract" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Approve extraction" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Regenerate" }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "Reject" }).first()).toBeDisabled();

    await nav(page, "Progress");
    await expect(page.getByText("cannot enter official progress data")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add data point" })).toBeDisabled();

    await nav(page, "Quality review");
    await expect(page.getByRole("button", { name: "Run completeness review" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Record review disposition" })).toBeDisabled();

    await nav(page, "Meetings");
    await expect(page.getByRole("button", { name: "Update participant readiness" })).toBeDisabled();
    await page.getByLabel("Question or concern").fill("Can we discuss science test supports before the meeting?");
    await page.getByRole("button", { name: "Submit question" }).click();
    await expect(page.getByText("Question submitted")).toBeVisible();
    await expect(page.locator(".question-row").filter({ hasText: "science test supports" })).toBeVisible();
    await page.getByLabel("Meeting prep note", { exact: true }).fill("Please leave room for my notes about service recovery and science tests.");
    await page.getByRole("button", { name: "Add meeting note" }).click();
    await expect(page.getByText("Meeting prep note added")).toBeVisible();
    await expect(page.locator(".question-row").filter({ hasText: "service recovery and science tests" })).toContainText("Robin Lee");
    await expect(page.getByRole("button", { name: "Answer" }).first()).toBeDisabled();

    const parentMeeting = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      const payload = await response.json();
      return {
        question: payload.workspace.meetings[0].familyQuestions[0],
        note: payload.workspace.meetings[0].meetingPrepNotes[0]
      };
    }, API_BASE_URL);
    expect(parentMeeting.question.submittedBy).toBe("Robin Lee");
    expect(parentMeeting.note.submittedBy).toBe("Robin Lee");
    expect(parentMeeting.note.officialRecordImpact).toContain("does not change official IEP");

    await page.locator(".role-control select").selectOption("student");
    await expectToast(page, "Account switched");
    await expect(page.getByRole("button", { name: /Jordan Lee/i })).toBeVisible();
    await nav(page, "Meetings");
    await page.getByLabel("Student reflection").fill("I want to ask for the organizer before long reading assignments.");
    await page.getByRole("button", { name: "Update reflection" }).click();
    await expect(page.locator("blockquote")).toContainText("I want to ask for the organizer before long reading assignments.");

    await page.locator(".role-control select").selectOption("readOnlyReviewer");
    await expectToast(page, "Account switched");
    await expect(page.getByRole("button", { name: /N. Shah/i })).toBeVisible();
    const reviewerAccess = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      const payload = await response.json();
      return {
        role: payload.workspace.user.role,
        studentCount: payload.workspace.students.length,
        securityVisible: Boolean(payload.workspace.securityPosture),
        districtIntegrations: payload.workspace.districtConfiguration.integrationReadiness.length
      };
    }, API_BASE_URL);
    expect(reviewerAccess).toEqual({
      role: "readOnlyReviewer",
      studentCount: 4,
      securityVisible: false,
      districtIntegrations: 0
    });

    await nav(page, "IEP intake");
    await expect(page.getByText("Read-Only Reviewer can view source context but cannot upload or replace official IEP documents.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Preserve source and extract" })).toBeDisabled();
    await nav(page, "Quality review");
    await expect(page.getByRole("button", { name: "Run completeness review" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Request compliance review" })).toBeDisabled();
    await nav(page, "Audit trail");
    await expect(page.getByRole("heading", { name: "Current access lens" })).toBeVisible();
    await expect(page.getByText("Export reports or manage district, security, source-registry, AI, or retention settings")).toBeVisible();
    await expect(page.getByRole("button", { name: "Export audit packet" })).toBeDisabled();

    await page.locator(".role-control select").selectOption("systemAdministrator");
    await expectToast(page, "Account switched");
    await expect(page.getByRole("button", { name: /S. Carter/i })).toBeVisible();
    const systemAccess = await page.evaluate(async (apiBaseUrl) => {
      const session = JSON.parse(localStorage.getItem("iep-auth-session-v1"));
      const response = await fetch(`${apiBaseUrl}/api/workspace`, {
        headers: { authorization: `Bearer ${session.token}` }
      });
      const payload = await response.json();
      return {
        role: payload.workspace.user.role,
        studentCount: payload.workspace.students.length,
        securityVisible: Boolean(payload.workspace.securityPosture),
        sessionCount: payload.workspace.securitySessions.length,
        districtIntegrations: payload.workspace.districtConfiguration.integrationReadiness.length
      };
    }, API_BASE_URL);
    expect(systemAccess.role).toBe("systemAdministrator");
    expect(systemAccess.studentCount).toBe(0);
    expect(systemAccess.securityVisible).toBe(true);
    expect(systemAccess.sessionCount).toBeGreaterThan(0);
    expect(systemAccess.districtIntegrations).toBeGreaterThan(0);
    await nav(page, "Audit trail");
    await expect(page.getByRole("heading", { name: "Current access lens" })).toBeVisible();
    await expect(page.getByText("Review platform security posture")).toBeVisible();
    await expect(page.getByText("View student IEP records unless separately assigned")).toBeVisible();
  });

  test("mobile audit surface has no horizontal overflow", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile overflow coverage runs on mobile project.");
    await reset(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    await nav(page, "Audit trail");
    await expect(page.getByText("Source chain")).toBeVisible();
    await expect(page.getByText("Current access lens")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test("exposes accessibility landmarks, live status, and named controls", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Accessibility shell audit runs on desktop.");
    await reset(page);

    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#workspace-main")).toBeFocused();
    await expect(page.locator("main#workspace-main[aria-labelledby='workspace-title']")).toBeVisible();
    await expect(page.locator("#workspace-title")).toHaveText("Overview");

    await nav(page, "Audit trail");
    await expect(page.getByRole("heading", { name: "Accessibility review" })).toBeVisible();
    await expect(page.getByText("Keyboard navigation")).toBeVisible();
    await expect(page.getByText("Screen reader labels")).toBeVisible();
    await expect(page.getByText("Live status updates")).toBeVisible();
    await expect(page.getByText("Draft translations remain human-reviewed")).toBeVisible();

    await nav(page, "Implementation");
    await page.locator(".task .task-check").first().click();
    const toast = page.locator(".toast");
    await expect(toast).toHaveAttribute("role", "status");
    await expect(toast).toHaveAttribute("aria-live", "polite");
    await expect(toast).toContainText("Task updated");

    const unnamed = await unnamedInteractiveControls(page);
    expect(unnamed).toEqual([]);
  });
});
