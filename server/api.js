import { createServer as createHttpServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { DemoAuth, filterWorkspaceForUser, requireStudentAccess } from "./auth.js";
import { extractDocumentText } from "./documentText.js";
import { createExportArtifact } from "./exportArtifacts.js";
import { extractSections } from "./extraction.js";
import { can as hasPermission, requirePermission } from "./permissions.js";
import { WorkspaceStore } from "./store.js";
import {
  applyApprovedExtractionObligations,
  generateCompletenessReviewFlags,
  mergeExtractionSectionsIntoStructuredRecord,
  normalizeStructuredIepRecord,
  refreshRoleSummariesFromWorkspace,
  schemaSections,
  summaryCoverageItemsForWorkspace
} from "../src/data.js";

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

export function createApiServer({ store = new WorkspaceStore(), auth = new DemoAuth(), enableTestReset = false } = {}) {
  return createHttpServer(async (request, response) => {
    try {
      setCors(response);
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      const url = new URL(request.url, "http://localhost");

      if (request.method === "GET" && url.pathname === "/api/health") {
        await sendJson(response, 200, { ok: true });
        return;
      }

      if (enableTestReset && request.method === "POST" && url.pathname === "/api/test/reset") {
        await sendJson(response, 200, { workspace: await store.reset() });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/auth/login") {
        await sendJson(response, 200, auth.login(await readJson(request)));
        return;
      }

      const session = auth.authenticate(request);
      const user = session.user;
      const role = user.role;
      const actor = user.name;

      if (request.method === "GET" && url.pathname === "/api/workspace") {
        requirePermission(role, "readWorkspace");
        const workspace = await store.init();
        await sendJson(response, 200, {
          workspace: workspaceForResponse(workspace, user, auth, session),
          role,
          user
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/audit/verify") {
        requirePermission(role, "readWorkspace");
        await store.init();
        await sendJson(response, 200, await store.verifyAuditChain());
        return;
      }

      if (request.method === "PATCH" && url.pathname === "/api/workspace/current-student") {
        requirePermission(role, "readWorkspace");
        const body = await readJson(request);
        const studentId = requiredString(body.studentId, "Student");
        requireStudentAccess(user, studentId);
        const result = await store.mutate(
          (workspace) => {
            const student = (workspace.students || []).find((item) => item.id === studentId);
            if (!student) throw notFound("Student not found.");
            workspace.currentStudentId = studentId;
            return { studentId, studentName: `${student.firstName} ${student.lastName}`.trim() };
          },
          {
            type: "Student selection",
            title: "Student workspace selected",
            detail: `${actor} opened ${studentId} as the active workspace.`,
            actor,
            role,
            subjectId: studentId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/students") {
        requirePermission(role, "createStudent");
        const body = await readJson(request);
        const firstName = requiredString(body.firstName, "Student first name");
        const lastName = requiredString(body.lastName, "Student last name");
        const grade = requiredString(body.grade, "Student grade");
        const school = requiredString(body.school, "Student school");
        const annualReviewDate = requiredString(body.annualReviewDate, "Annual review date");
        if (Number.isNaN(Date.parse(annualReviewDate))) throw badRequest("Annual review date must be a valid date.");
        const createdAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const sourceAlignment = sourceAlignmentForWorkspace(workspace);
            const student = createStudentProfileRecordFromBody(body, {
              firstName,
              lastName,
              grade,
              school,
              annualReviewDate,
              actor,
              role,
              userId: user.id,
              createdAt
            });
            const iep = createDraftIepForStudentProfile(student, sourceAlignment, createdAt);
            workspace.students = [student, ...(workspace.students || [])];
            workspace.ieps = [iep, ...(workspace.ieps || [])];
            workspace.currentStudentId = student.id;
            workspace.extractionSections = (workspace.extractionSections || []).filter((section) => section.studentId === student.id);
            return { student, iep };
          },
          {
            type: "Student intake",
            title: "Student profile created",
            detail: `${firstName} ${lastName} was created with a draft IEP intake scaffold.`,
            actor,
            role,
            subjectId: `${firstName}-${lastName}`
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/ai-governance/evaluations") {
        requirePermission(role, "manageAiGovernance");
        const body = await readJson(request);
        const evaluationScope = String(body.evaluationScope || "FDS core AI guardrails").trim() || "FDS core AI guardrails";
        const reviewerNote = requiredString(body.reviewerNote, "AI governance review note");
        const runAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const run = createAiGovernanceEvaluationRun(workspace, {
              evaluationScope,
              reviewerNote,
              actor,
              role,
              runAt
            });
            const governance = aiGovernanceForWorkspace(workspace);
            workspace.aiGovernance = {
              ...governance,
              modelProfile: {
                ...governance.modelProfile,
                reviewStatus: run.status,
                lastEvaluationScore: run.score,
                lastEvaluationStatus: run.status,
                lastEvaluatedAt: runAt,
                lastReviewedBy: actor,
                lastReviewedAt: runAt
              },
              evaluationRuns: [run, ...(governance.evaluationRuns || [])]
            };
            return run;
          },
          {
            type: "AI governance",
            title: "AI guardrail evaluation completed",
            detail: `${evaluationScope} guardrail evaluation was recorded with source, content-label, restricted-request, and human-review checks.`,
            actor,
            role,
            subjectId: evaluationScope
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/ai-governance/citation-evaluations") {
        requirePermission(role, "manageAiGovernance");
        const body = await readJson(request);
        const outputLabel = requiredString(body.outputLabel || "AI-assisted output", "AI output label");
        const outputText = requiredString(body.outputText, "AI output text");
        const citations = splitCitationInput(body.citations);
        const reviewerNote = requiredString(body.reviewerNote, "AI citation review note");
        const evaluatedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const evaluation = createAiCitationEvaluation(workspace, {
              outputLabel,
              outputText,
              citations,
              reviewerNote,
              actor,
              role,
              evaluatedAt
            });
            const governance = aiGovernanceForWorkspace(workspace);
            workspace.aiGovernance = {
              ...governance,
              modelProfile: {
                ...governance.modelProfile,
                lastCitationEvaluationScore: evaluation.score,
                lastCitationEvaluationStatus: evaluation.status,
                lastCitationEvaluatedAt: evaluatedAt,
                lastReviewedBy: actor,
                lastReviewedAt: evaluatedAt
              },
              citationEvaluations: [evaluation, ...(governance.citationEvaluations || [])]
            };
            return evaluation;
          },
          {
            type: "AI citation evaluation",
            title: "AI citation evaluation completed",
            detail: `${outputLabel} citation evaluation was recorded with source-match and official-boundary checks.`,
            actor,
            role,
            subjectId: outputLabel
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/audit/anchors") {
        requirePermission(role, "manageAuditAnchors");
        const body = await readJson(request);
        const note = requiredString(body.note, "Audit anchor note");
        const externalReference = requiredString(body.externalReference, "Audit anchor external reference");
        const verification = await store.verifyAuditChain();
        if (!verification.valid) throw badRequest(`Audit chain cannot be anchored: ${verification.reason || "verification failed"}.`);
        const createdAt = new Date().toISOString();
        const anchorDigest = createAuditAnchorDigest({
          checked: verification.checked,
          latestHash: verification.latestHash,
          externalReference,
          note,
          actor,
          role,
          createdAt
        });
        const result = await store.mutate(
          (workspace) => {
            const anchor = {
              id: `audit-anchor-${randomUUID()}`,
              status: "Anchored locally",
              anchorScope: "Local NDJSON audit chain",
              anchoredSequence: verification.checked,
              anchoredHash: verification.latestHash,
              anchorDigest,
              externalReference,
              note,
              createdBy: actor,
              createdByRole: role,
              createdAt,
              verificationStatus: "Verified before anchor creation"
            };
            workspace.auditAnchors = [anchor, ...(workspace.auditAnchors || [])];
            return anchor;
          },
          {
            type: "Audit anchoring",
            title: "Audit anchor created",
            detail: `Audit chain anchored through sequence ${verification.checked}.`,
            actor,
            role,
            subjectId: anchorDigest
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const externalTimestampMatch = url.pathname.match(/^\/api\/audit\/anchors\/([^/]+)\/external-timestamp$/);
      if (request.method === "PATCH" && externalTimestampMatch) {
        requirePermission(role, "manageAuditAnchors");
        const anchorId = decodeURIComponent(externalTimestampMatch[1]);
        const body = await readJson(request);
        const provider = requiredString(body.provider, "Timestamp provider");
        const receiptId = requiredString(body.receiptId, "Timestamp receipt ID");
        const receiptTimestamp = requiredString(body.receiptTimestamp, "Timestamp receipt time");
        const verificationReference = requiredString(body.verificationReference, "Timestamp verification reference");
        const reviewerNote = requiredString(body.reviewerNote, "Timestamp reviewer note");
        const recordedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.auditAnchors = (workspace.auditAnchors || []).map((anchor) => {
              if (anchor.id !== anchorId) return anchor;
              if (/seed/i.test(anchor.status || "")) {
                throw badRequest("Create a verified audit anchor before recording an external timestamp receipt.");
              }
              const receipt = createExternalTimestampReceipt({
                anchor,
                provider,
                receiptId,
                receiptTimestamp,
                verificationReference,
                reviewerNote,
                actor,
                role,
                recordedAt
              });
              updated = {
                ...anchor,
                status: "External timestamp recorded",
                notarizationStatus: receipt.status,
                externalTimestampReceipt: receipt
              };
              return updated;
            });
            if (!updated) throw notFound("Audit anchor not found.");
            return updated;
          },
          {
            type: "Audit anchoring",
            title: "External timestamp receipt recorded",
            detail: `${provider} receipt ${receiptId} was attached to audit anchor ${anchorId}.`,
            actor,
            role,
            subjectId: anchorId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const retentionDownloadMatch = url.pathname.match(/^\/api\/audit\/retention-packages\/([^/]+)\/download$/);
      if (request.method === "GET" && retentionDownloadMatch) {
        requirePermission(role, "manageAuditAnchors");
        const packageId = decodeURIComponent(retentionDownloadMatch[1]);
        const workspace = await store.init();
        const record = (workspace.auditRetentionPackages || []).find((item) => item.id === packageId);
        if (!record?.artifact?.preservedPath) throw notFound("Retention package not found.");
        const file = await store.readStoredFile(record.artifact.preservedPath);
        sendBuffer(response, 200, file, {
          "content-type": record.artifact.mimeType || "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="${record.artifact.fileName || "retention-manifest.json"}"`
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/audit/retention-packages") {
        requirePermission(role, "manageAuditAnchors");
        const body = await readJson(request);
        const note = requiredString(body.note, "Retention package note");
        const verification = await store.verifyAuditChain();
        if (!verification.valid) throw badRequest(`Audit chain cannot be retained: ${verification.reason || "verification failed"}.`);

        const workspace = await store.init();
        const anchor = (workspace.auditAnchors || []).find((item) => item.id === body.anchorId) ||
          (workspace.auditAnchors || []).find((item) => !/seed/i.test(item.status || ""));
        if (!anchor || /seed/i.test(anchor.status || "")) {
          throw badRequest("Create a verified audit anchor before sealing a retention package.");
        }

        const auditEvents = await store.readAuditEvents();
        const anchoredEvent = auditEvents[anchor.anchoredSequence - 1];
        if (!anchoredEvent || anchoredEvent.hash !== anchor.anchoredHash) {
          throw badRequest("Retention package cannot be sealed because the selected anchor does not match the audit chain.");
        }

        const packageId = `retention-${randomUUID()}`;
        const createdAt = new Date().toISOString();
        const { manifest, packageDigest } = createRetentionManifest({
          id: packageId,
          workspace,
          auditEvents,
          verification,
          anchor,
          note,
          actor,
          role,
          createdAt
        });
        const fileName = `${packageId}-audit-retention-manifest.json`;
        const fileBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
        const storedArtifact = await store.saveRetentionPackage(packageId, fileName, fileBuffer);
        const retentionRecord = {
          id: packageId,
          status: "Sealed locally",
          retentionScope: "Local WORM-style audit retention manifest",
          retentionMode: "Write-once local manifest file",
          anchorId: anchor.id,
          anchorDigest: anchor.anchorDigest,
          anchoredSequence: anchor.anchoredSequence,
          anchoredHash: anchor.anchoredHash,
          packageDigest,
          note,
          createdBy: actor,
          createdByRole: role,
          createdAt,
          verificationStatus: "Audit chain verified and anchor hash matched before sealing",
          artifact: {
            fileName,
            mimeType: "application/json; charset=utf-8",
            ...storedArtifact
          },
          downloadUrl: `/api/audit/retention-packages/${packageId}/download`
        };
        const result = await store.mutate(
          (mutableWorkspace) => {
            mutableWorkspace.auditRetentionPackages = [retentionRecord, ...(mutableWorkspace.auditRetentionPackages || [])];
            return retentionRecord;
          },
          {
            type: "Audit retention",
            title: "Retention package sealed",
            detail: `Audit retention manifest sealed for anchor sequence ${anchor.anchoredSequence}.`,
            actor,
            role,
            subjectId: packageDigest
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/audit/retention-policy-reviews") {
        requirePermission(role, "reviewRetentionPolicy");
        const body = await readJson(request);
        const policyScope = normalizeRetentionPolicyScope(body.policyScope);
        const policySource = requiredString(body.policySource, "Retention policy source");
        const disposition = normalizeRetentionPolicyDisposition(body.disposition);
        const retentionPeriod = requiredString(body.retentionPeriod, "Retention period");
        const legalHoldStatus = normalizeRetentionLegalHoldStatus(body.legalHoldStatus);
        const archiveDecision = normalizeRetentionArchiveDecision(body.archiveDecision);
        const evidenceSummary = requiredString(body.evidenceSummary, "Policy evidence summary");
        const nextReviewDate = String(body.nextReviewDate || "").trim();
        const reviewedAt = new Date().toISOString();
        const verification = await store.verifyAuditChain();
        if (!verification.valid) throw badRequest(`Retention policy review cannot be recorded: ${verification.reason || "audit verification failed"}.`);

        const result = await store.mutate(
          (workspace) => {
            const retentionPackage = (workspace.auditRetentionPackages || []).find((item) => item.id === body.retentionPackageId) ||
              (workspace.auditRetentionPackages || [])[0] ||
              null;
            const anchor = (workspace.auditAnchors || []).find((item) => item.id === (body.anchorId || retentionPackage?.anchorId)) ||
              (workspace.auditAnchors || [])[0] ||
              null;
            const review = {
              id: `retention-policy-review-${randomUUID()}`,
              policyScope,
              policySource,
              disposition,
              retentionPeriod,
              legalHoldStatus,
              archiveDecision,
              evidenceSummary,
              nextReviewDate,
              retentionPackageId: retentionPackage?.id || "",
              anchorId: anchor?.id || retentionPackage?.anchorId || "",
              packageDigest: retentionPackage?.packageDigest || "",
              anchorDigest: anchor?.anchorDigest || retentionPackage?.anchorDigest || "",
              auditVerificationStatus: `Audit chain verified through ${verification.checked} events`,
              reviewedBy: actor,
              reviewedByRole: role,
              reviewedByUserId: user.id,
              reviewedAt,
              productionBoundary:
                "Retention policy review documents local readiness and district policy questions only; it does not enforce production retention, archive, purge, or legal-hold rules."
            };
            review.policyDigest = createRetentionPolicyReviewDigest(review, verification);
            workspace.retentionPolicyReviews = [review, ...(workspace.retentionPolicyReviews || [])];
            return review;
          },
          {
            type: "Audit retention",
            title: "Retention policy reviewed",
            detail: `${policyScope} marked ${disposition}; archive decision ${archiveDecision}.`,
            actor,
            role,
            subjectId: policySource
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const sourceRegistryReviewMatch = url.pathname.match(/^\/api\/source-registry\/([^/]+)\/review$/);
      if (request.method === "PATCH" && sourceRegistryReviewMatch) {
        requirePermission(role, "reviewSourceRegistry");
        const sourceId = decodeURIComponent(sourceRegistryReviewMatch[1]);
        const body = await readJson(request);
        const status = normalizeSourceRegistryReviewStatus(body.status);
        const retrievedDate = requiredString(body.retrievedDate, "Retrieved date");
        const nextReviewDate = requiredString(body.nextReviewDate, "Next source review date");
        const note = requiredString(body.note, "Source registry review note");
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            const sourceRegistry = workspace.sourceRegistry || {};
            workspace.sourceRegistry = {
              ...sourceRegistry,
              reviewStatus: status,
              retrievedDate: sourceRegistry.retrievedDate || retrievedDate,
              lastReviewedAt: reviewedAt,
              nextReviewDate,
              reviewedBy: actor,
              reviewedByRole: role,
              reviewNote: note,
              entries: (sourceRegistry.entries || []).map((entry) => {
                if (entry.sourceId !== sourceId) return entry;
                updated = {
                  ...entry,
                  reviewStatus: status,
                  retrievedDate,
                  nextReviewDate,
                  reviewNote: note,
                  reviewedBy: actor,
                  reviewedByRole: role,
                  reviewedAt
                };
                return updated;
              })
            };
            if (!updated) throw notFound("Source registry entry not found.");
            return updated;
          },
          {
            type: "Source registry",
            title: "Source registry entry reviewed",
            detail: `${sourceId} marked ${status} with next review ${nextReviewDate}.`,
            actor,
            role,
            subjectId: sourceId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/source-registry/entries") {
        requirePermission(role, "manageSourceRegistry");
        const body = await readJson(request);
        const savedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const sourceRegistry = workspace.sourceRegistry || {};
            const entry = createSourceRegistryEntry(body, { sourceRegistry, actor, role, savedAt });
            const existingEntries = sourceRegistry.entries || [];
            const action = existingEntries.some((item) => item.sourceId === entry.sourceId) ? "updated" : "created";
            const entries = action === "updated"
              ? existingEntries.map((item) => (item.sourceId === entry.sourceId ? entry : item))
              : [entry, ...existingEntries];
            const sourceRegistryVersion = String(
              body.sourceRegistryVersion || sourceRegistry.sourceRegistryVersion || entry.sourceRegistryVersion || "PA-demo-2026.06"
            ).trim();
            workspace.sourceRegistry = {
              ...sourceRegistry,
              sourceRegistryVersion,
              entries,
              ...(body.activate
                ? {
                    activeSourceId: entry.sourceId,
                    jurisdiction: entry.jurisdiction,
                    programArea: entry.programArea,
                    retrievedDate: entry.retrievedDate,
                    reviewStatus: entry.reviewStatus,
                    lastReviewedAt: savedAt,
                    nextReviewDate: entry.nextReviewDate,
                    reviewedBy: actor,
                    reviewedByRole: role,
                    reviewNote: entry.reviewNote
                  }
                : {})
            };
            return { ...entry, action, activated: Boolean(body.activate) };
          },
          {
            type: "Source registry",
            title: "Source registry entry saved",
            detail: `${body.title || "Source registry entry"} was saved${body.activate ? " and activated" : ""}.`,
            actor,
            role,
            subjectId: body.sourceId || body.title || "source-registry"
          }
        );
        await sendJson(response, result.result.action === "created" ? 201 : 200, mutationPayload(result, user));
        return;
      }

      const districtIntegrationMatch = url.pathname.match(/^\/api\/district-configuration\/integrations\/([^/]+)$/);
      if (request.method === "PATCH" && districtIntegrationMatch) {
        requirePermission(role, "manageDistrictConfiguration");
        const integrationId = decodeURIComponent(districtIntegrationMatch[1]);
        const body = await readJson(request);
        const status = normalizeDistrictIntegrationStatus(body.status);
        const provider = requiredString(body.provider, "Integration provider");
        const owner = requiredString(body.owner, "Integration owner");
        const nextReviewDate = requiredString(body.nextReviewDate, "Integration next review date");
        const note = requiredString(body.note, "Integration readiness note");
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const configuration = districtConfigurationForWorkspace(workspace);
            let updated;
            const integrationReadiness = (configuration.integrationReadiness || []).map((integration) => {
              if (integration.id !== integrationId) return integration;
              updated = {
                ...integration,
                status,
                provider,
                owner,
                nextReviewDate,
                note,
                reviewedBy: actor,
                reviewedByRole: role,
                reviewedAt
              };
              return updated;
            });
            if (!updated) throw notFound("District integration record not found.");
            const review = {
              id: `district-config-review-${randomUUID()}`,
              integrationId,
              integrationName: updated.name,
              status,
              provider,
              owner,
              nextReviewDate,
              note,
              reviewedBy: actor,
              reviewedByRole: role,
              reviewedAt,
              configurationDigest: createDistrictIntegrationDigest({
                districtId: configuration.districtId,
                integration: updated,
                actor,
                role,
                reviewedAt
              })
            };
            workspace.districtConfiguration = {
              ...configuration,
              integrationReadiness,
              lastReviewedBy: actor,
              lastReviewedAt: reviewedAt,
              configurationReviews: [review, ...(configuration.configurationReviews || [])]
            };
            return { ...updated, configurationReview: review };
          },
          {
            type: "District configuration",
            title: "District integration readiness updated",
            detail: `${integrationId} marked ${status} for district implementation readiness.`,
            actor,
            role,
            subjectId: integrationId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const dataProtectionMatch = url.pathname.match(/^\/api\/district-configuration\/data-protection\/([^/]+)$/);
      if (request.method === "PATCH" && dataProtectionMatch) {
        requirePermission(role, "manageDistrictConfiguration");
        const controlId = decodeURIComponent(dataProtectionMatch[1]);
        const body = await readJson(request);
        const status = normalizeDistrictIntegrationStatus(body.status);
        const control = requiredString(body.control, "Data protection control");
        const owner = requiredString(body.owner, "Data protection owner");
        const nextReviewDate = requiredString(body.nextReviewDate, "Data protection next review date");
        const evidenceNote = requiredString(body.evidenceNote, "Data protection evidence note");
        const productionBoundary = requiredString(body.productionBoundary, "Production boundary note");
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const configuration = districtConfigurationForWorkspace(workspace);
            let updated;
            const dataProtectionReadiness = (configuration.dataProtectionReadiness || []).map((record) => {
              if (record.id !== controlId) return record;
              updated = {
                ...record,
                status,
                control,
                owner,
                nextReviewDate,
                evidenceNote,
                productionBoundary,
                reviewedBy: actor,
                reviewedByRole: role,
                reviewedAt
              };
              return updated;
            });
            if (!updated) throw notFound("Data protection readiness record not found.");
            const digest = createDataProtectionDigest({
              districtId: configuration.districtId,
              control: updated,
              actor,
              role,
              reviewedAt
            });
            const review = {
              id: `data-protection-review-${randomUUID()}`,
              reviewType: "Data protection readiness",
              controlId,
              controlName: updated.name,
              status,
              owner,
              nextReviewDate,
              note: evidenceNote,
              productionBoundary,
              reviewedBy: actor,
              reviewedByRole: role,
              reviewedAt,
              configurationDigest: digest,
              dataProtectionDigest: digest
            };
            workspace.districtConfiguration = {
              ...configuration,
              dataProtectionReadiness,
              lastReviewedBy: actor,
              lastReviewedAt: reviewedAt,
              configurationReviews: [review, ...(configuration.configurationReviews || [])]
            };
            return { ...updated, configurationReview: review };
          },
          {
            type: "District configuration",
            title: "Data protection readiness updated",
            detail: `${controlId} marked ${status} for district deployment readiness.`,
            actor,
            role,
            subjectId: controlId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const accessibilityFindingMatch = url.pathname.match(/^\/api\/accessibility\/findings\/([^/]+)$/);
      if (request.method === "PATCH" && accessibilityFindingMatch) {
        requirePermission(role, "manageAccessibility");
        const findingId = decodeURIComponent(accessibilityFindingMatch[1]);
        const body = await readJson(request);
        const status = normalizeAccessibilityFindingStatus(body.status);
        const severity = normalizeAccessibilityFindingSeverity(body.severity);
        const owner = requiredString(body.owner, "Accessibility remediation owner");
        const dueDate = requiredString(body.dueDate, "Accessibility remediation due date");
        const assistiveTechnology = requiredString(body.assistiveTechnology, "Assistive technology or review method");
        const remediationPlan = requiredString(body.remediationPlan, "Accessibility remediation plan");
        const verificationNote = requiredString(body.verificationNote, "Accessibility verification note");
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const certification = accessibilityCertificationForWorkspace(workspace);
            let updated;
            const findings = (certification.findings || []).map((finding) => {
              if (finding.id !== findingId) return finding;
              updated = {
                ...finding,
                status,
                severity,
                owner,
                dueDate,
                assistiveTechnology,
                remediationPlan,
                verificationNote,
                reviewedBy: actor,
                reviewedByRole: role,
                reviewedAt
              };
              return updated;
            });
            if (!updated) throw notFound("Accessibility finding not found.");
            const review = {
              id: `accessibility-review-${randomUUID()}`,
              findingId,
              findingTitle: updated.title,
              criterion: updated.criterion,
              status,
              severity,
              owner,
              dueDate,
              assistiveTechnology,
              remediationPlan,
              verificationNote,
              reviewedBy: actor,
              reviewedByRole: role,
              reviewedAt,
              accessibilityDigest: createAccessibilityReviewDigest({
                standard: certification.standard,
                finding: updated,
                actor,
                role,
                reviewedAt
              })
            };
            workspace.accessibilityCertification = {
              ...certification,
              findings,
              lastReviewedBy: actor,
              lastReviewedAt: reviewedAt,
              reviews: [review, ...(certification.reviews || [])]
            };
            return { ...updated, accessibilityReview: review };
          },
          {
            type: "Accessibility remediation",
            title: "Accessibility finding updated",
            detail: `${findingId} marked ${status} for ${severity.toLowerCase()} accessibility remediation.`,
            actor,
            role,
            subjectId: findingId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const securitySessionMatch = url.pathname.match(/^\/api\/security\/sessions\/([^/]+)\/revoke$/);
      if (request.method === "POST" && securitySessionMatch) {
        requirePermission(role, "manageSecurity");
        const sessionId = decodeURIComponent(securitySessionMatch[1]);
        if (sessionId === session.id) throw badRequest("Current session cannot be revoked from this review workflow.");
        const body = await readJson(request);
        const note = requiredString(body.note, "Session review note");
        const revoked = auth.revokeSession(sessionId, { revokedBy: actor, reason: note });
        if (!revoked) throw notFound("Security session not found.");
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const review = {
              id: `security-review-${randomUUID()}`,
              action: "Session revoked",
              sessionId,
              userName: revoked.userName,
              role: revoked.role,
              status: "Revoked",
              note,
              reviewedBy: actor,
              reviewedByRole: role,
              reviewedAt
            };
            workspace.securityReviews = [review, ...(workspace.securityReviews || [])];
            workspace.securityPosture = {
              ...(workspace.securityPosture || {}),
              reviewStatus: "Session reviewed",
              lastReviewedAt: reviewedAt,
              reviewedBy: actor,
              reviewedByRole: role,
              retentionNote:
                "A demo session was revoked and retained in the audit trail; production deployments require district IdP lifecycle controls."
            };
            return { ...revoked, review };
          },
          {
            type: "Security",
            title: "Security session revoked",
            detail: `${revoked.userName} session was revoked during administrator review.`,
            actor,
            role,
            subjectId: sessionId
          }
        );
        const payload = mutationPayload(result, user);
        payload.workspace = workspaceForResponse(result.workspace, user, auth, session);
        await sendJson(response, 200, payload);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/security/identity-lifecycle-reviews") {
        requirePermission(role, "manageSecurity");
        const body = await readJson(request);
        const identityProvider = requiredString(body.identityProvider, "Identity provider");
        const lifecycleStatus = normalizeIdentityLifecycleStatus(body.lifecycleStatus);
        const mfaStatus = normalizeIdentityMfaStatus(body.mfaStatus);
        const tenantBoundaryStatus = normalizeTenantBoundaryStatus(body.tenantBoundaryStatus);
        const roleProvisioningStatus = normalizeRoleProvisioningStatus(body.roleProvisioningStatus);
        const accountLifecyclePlan = requiredString(body.accountLifecyclePlan, "Account lifecycle plan");
        const tenantBoundaryEvidence = requiredString(body.tenantBoundaryEvidence, "Tenant boundary evidence");
        const roleProvisioningNote = requiredString(body.roleProvisioningNote, "Role provisioning note");
        const nextReviewDate = String(body.nextReviewDate || "").trim();
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const review = {
              id: `security-review-${randomUUID()}`,
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
              reviewedBy: actor,
              reviewedByRole: role,
              reviewedByUserId: user.id,
              reviewedAt,
              productionBoundary:
                "This local review records readiness evidence only; production deployments still require district IdP, MFA enforcement, tenant isolation, provisioning, and deprovisioning controls."
            };
            review.securityDigest = createIdentityLifecycleReviewDigest(review, workspace.securityPosture || {});
            workspace.securityReviews = [review, ...(workspace.securityReviews || [])];
            workspace.securityPosture = {
              ...(workspace.securityPosture || {}),
              identityProvider,
              mfaStatus,
              tenantBoundaryStatus,
              roleProvisioningStatus,
              accountLifecyclePlan,
              tenantBoundaryEvidence,
              reviewStatus: lifecycleStatus,
              nextReviewDate,
              lastReviewedAt: reviewedAt,
              reviewedBy: actor,
              reviewedByRole: role,
              retentionNote:
                "Identity lifecycle review records are retained locally; production IdP, MFA, tenant isolation, and deprovisioning enforcement remain external to this demo."
            };
            return review;
          },
          {
            type: "Security",
            title: "Identity lifecycle reviewed",
            detail: `${identityProvider} lifecycle readiness was recorded for administrator review.`,
            actor,
            role,
            subjectId: identityProvider
          }
        );
        const payload = mutationPayload(result, user);
        payload.workspace = workspaceForResponse(result.workspace, user, auth, session);
        await sendJson(response, 201, payload);
        return;
      }

      const exportDownloadMatch = url.pathname.match(/^\/api\/exports\/([^/]+)\/download$/);
      if (request.method === "GET" && exportDownloadMatch) {
        requirePermission(role, "export");
        const exportId = decodeURIComponent(exportDownloadMatch[1]);
        const workspace = await store.init();
        const record = (workspace.exports || []).find((item) => item.id === exportId);
        if (!record?.artifact?.preservedPath) throw notFound("Export artifact not found.");
        const file = await store.readStoredFile(record.artifact.preservedPath);
        sendBuffer(response, 200, file, {
          "content-type": record.artifact.mimeType || "application/octet-stream",
          "content-disposition": `attachment; filename="${record.artifact.fileName || "export"}"`
        });
        return;
      }

      const summaryActionMatch = url.pathname.match(/^\/api\/summaries\/([^/]+)\/(copy|handout)$/);
      if (request.method === "POST" && summaryActionMatch) {
        requirePermission(role, "shareSummary");
        const audience = decodeURIComponent(summaryActionMatch[1]);
        const action = summaryActionMatch[2];
        if (!canShareSummaryAudience(role, audience)) throw forbidden("Current role cannot share this audience summary.");
        const result = await store.mutate(
          (workspace) => {
            requireStudentAccess(user, workspace.currentStudentId);
            const summary = workspace.summaries?.[audience];
            if (!summary) throw notFound("Summary audience not found.");
            const activeIep = (workspace.ieps || []).find((iep) => iep.studentId === workspace.currentStudentId);
            if (!activeIep?.extractionApproved) {
              throw badRequest("Approve a source extraction for the selected student before sharing role-specific summaries.");
            }
            if (action === "copy") {
              return {
                audience,
                copiedAt: new Date().toISOString(),
                label: summary.label
              };
            }
            const handout = createSummaryHandout({
              id: `handout-${randomUUID()}`,
              studentId: workspace.currentStudentId,
              audience,
              summary,
              coverageItems: summaryCoverageItemsForWorkspace(workspace, audience),
              actor,
              role
            });
            workspace.summaryHandouts = [handout, ...(workspace.summaryHandouts || [])];
            return handout;
          },
          {
            type: action === "copy" ? "Summary shared" : "Meeting preparation",
            title: action === "copy" ? "Summary copied" : "Meeting handout generated",
            detail:
              action === "copy"
                ? "A role-specific summary was copied for approved meeting preparation."
                : "A role-specific meeting handout was generated from the approved summary.",
            actor,
            role,
            subjectId: audience
          }
        );
        await sendJson(response, action === "copy" ? 200 : 201, mutationPayload(result, user));
        return;
      }

      const summaryComprehensionListMatch = url.pathname.match(/^\/api\/summaries\/([^/]+)\/comprehension-checks$/);
      if (request.method === "POST" && summaryComprehensionListMatch) {
        requirePermission(role, "submitComprehensionCheck");
        const audience = decodeURIComponent(summaryComprehensionListMatch[1]);
        if (!canSubmitSummaryComprehensionAudience(role, audience)) {
          throw forbidden("Current role cannot submit an understanding check for this summary audience.");
        }
        const body = await readJson(request);
        const questionOrNote = requiredString(body.questionOrNote, "Understanding question or note");
        const result = await store.mutate(
          (workspace) => {
            requireStudentAccess(user, workspace.currentStudentId);
            const summary = workspace.summaries?.[audience];
            if (!summary) throw notFound("Summary audience not found.");
            const activeIep = (workspace.ieps || []).find((iep) => iep.studentId === workspace.currentStudentId);
            if (!activeIep?.extractionApproved) {
              throw badRequest("Approve a source extraction for the selected student before recording summary understanding checks.");
            }
            const check = createSummaryComprehensionCheck({
              id: `comprehension-${randomUUID()}`,
              workspace,
              audience,
              body: { ...body, questionOrNote },
              actor,
              role
            });
            workspace.summaryComprehensionChecks = [check, ...(workspace.summaryComprehensionChecks || [])];
            return check;
          },
          {
            type: "Family comprehension",
            title: "Understanding check submitted",
            detail: "A source-grounded summary understanding check was recorded for team follow-up.",
            actor,
            role,
            subjectId: audience
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const summaryComprehensionMatch = url.pathname.match(/^\/api\/summary-comprehension-checks\/([^/]+)$/);
      if (request.method === "PATCH" && summaryComprehensionMatch) {
        requirePermission(role, "reviewComprehensionCheck");
        const checkId = decodeURIComponent(summaryComprehensionMatch[1]);
        const body = await readJson(request);
        const responseText = requiredString(body.response, "Staff response");
        const nextStep = requiredString(body.nextStep, "Next step");
        const reviewStatus = normalizeSummaryComprehensionReviewStatus(body.reviewStatus || "Team response recorded");
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.summaryComprehensionChecks = (workspace.summaryComprehensionChecks || []).map((check) => {
              if (check.id !== checkId) return check;
              requireStudentAccess(user, check.studentId);
              updated = {
                ...check,
                reviewStatus,
                staffResponse: responseText,
                nextStep,
                reviewedBy: actor,
                reviewedByRole: role,
                reviewedAt
              };
              updated.reviewDigest = createSummaryComprehensionReviewDigest(updated);
              return updated;
            });
            if (!updated) throw notFound("Understanding check not found.");
            return updated;
          },
          {
            type: "Family comprehension",
            title: "Understanding response recorded",
            detail: "A staff response and next step were recorded for a family summary understanding check.",
            actor,
            role,
            subjectId: checkId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/intake") {
        requirePermission(role, "upload");
        const body = await readJson(request);
        const studentId = requiredString(body.studentId, "Student");
        requireStudentAccess(user, studentId);
        const parsedDocument = extractDocumentText(body);
        const documentId = `doc-${randomUUID()}`;
        const originalFile = parsedDocument.fileBuffer
          ? await store.saveDocumentFile(documentId, body.name || "Uploaded_IEP_Source", parsedDocument.fileBuffer)
          : null;
        const document = {
          id: documentId,
          studentId,
          name: body.name || "Uploaded_IEP_Source.txt",
          type: parsedDocument.documentType || body.documentType || "Text",
          mimeType: body.mimeType || null,
          uploadedAt: new Date().toISOString(),
          uploadedBy: actor,
          preserved: true,
          sourceText: parsedDocument.sourceText,
          extractionMethod: parsedDocument.extractionMethod,
          parseWarnings: parsedDocument.parseWarnings,
          sourceSegments: summarizeSegments(parsedDocument.sourceSegments),
          originalFile
        };
        const extractionSections = extractSections(document.sourceText, document.name, {
          sourceSegments: parsedDocument.sourceSegments
        });
        const result = await store.mutate(
          (workspace) => {
            requireStudentAccess(user, document.studentId);
            const sourceAlignment = sourceAlignmentForWorkspace(workspace);
            document.sourceAlignment = sourceAlignment;
            const alignedSections = extractionSections.map((section) => ({
              ...section,
              studentId,
              documentId,
              sourceAlignment
            }));
            workspace.documents = [document, ...(workspace.documents || [])];
            workspace.ieps = (workspace.ieps || []).map((iep) =>
              iep.studentId === studentId
                ? { ...iep, documentId, sourceAlignment }
                : iep
            );
            workspace.extractionSections = alignedSections;
            return { document, extractionSections: alignedSections };
          },
          {
            type: "Document upload",
            title: "Source document preserved",
            detail: `${document.name} was preserved and routed to structured extraction review.`,
            actor,
            role,
            subjectId: document.id
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const ocrReviewMatch = url.pathname.match(/^\/api\/documents\/([^/]+)\/ocr-review$/);
      if (request.method === "PATCH" && ocrReviewMatch) {
        requirePermission(role, "editExtraction");
        const documentId = decodeURIComponent(ocrReviewMatch[1]);
        const body = await readJson(request);
        const status = normalizeOcrReviewStatus(body.status);
        const confidence = clampPercent(body.confidence);
        const reviewedTextExcerpt = String(body.reviewedTextExcerpt || "").trim();
        const reviewerNote = String(body.reviewerNote || "").trim();
        if (!reviewedTextExcerpt || !reviewerNote) {
          throw badRequest("OCR reviewed text excerpt and reviewer note are required.");
        }
        if (reviewedTextExcerpt.length > 1200 || reviewerNote.length > 800) {
          throw badRequest("OCR review fields are too long.");
        }
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.documents = (workspace.documents || []).map((document) => {
              if (document.id !== documentId) return document;
              requireStudentAccess(user, document.studentId);
              updated = {
                ...document,
                ocrReview: {
                  status,
                  confidence,
                  reviewedTextExcerpt,
                  reviewerNote,
                  reviewedBy: actor,
                  reviewedByRole: role,
                  reviewedAt,
                  sourceAlignment: document.sourceAlignment || sourceAlignmentForWorkspace(workspace),
                  officialRecordImpact:
                    "OCR/source-quality review supports extraction fidelity only; it does not change the official IEP or replace the preserved source.",
                  ocrDigest: createOcrReviewDigest({ document, status, confidence, reviewedTextExcerpt, reviewerNote, actor, role, reviewedAt })
                }
              };
              return updated;
            });
            if (!updated) throw notFound("Document not found.");
            return updated.ocrReview;
          },
          {
            type: "Source quality review",
            title: "OCR/source review recorded",
            detail: "A reviewer recorded OCR or source-quality status for a preserved document.",
            actor,
            role,
            subjectId: documentId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const sourceAnchorReviewMatch = url.pathname.match(/^\/api\/extraction\/([^/]+)\/source-anchor$/);
      if (request.method === "PATCH" && sourceAnchorReviewMatch) {
        requirePermission(role, "editExtraction");
        const sectionId = decodeURIComponent(sourceAnchorReviewMatch[1]);
        const body = await readJson(request);
        const precision = normalizeSourceAnchorPrecision(body.precision);
        const pageNumber = Math.max(1, Math.round(Number(body.pageNumber) || 1));
        const segmentLabel = requiredString(body.segmentLabel, "Source anchor segment");
        const reviewerNote = requiredString(body.reviewerNote, "Source anchor reviewer note");
        if (reviewerNote.length > 800 || segmentLabel.length > 240) {
          throw badRequest("Source anchor review fields are too long.");
        }
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.extractionSections = (workspace.extractionSections || []).map((section) => {
              if (section.id !== sectionId) return section;
              requireStudentAccess(user, section.studentId || workspace.currentStudentId);
              const review = createSourceAnchorReview({
                section,
                precision,
                pageNumber,
                segmentLabel,
                anchorX: body.anchorX,
                anchorY: body.anchorY,
                anchorWidth: body.anchorWidth,
                anchorHeight: body.anchorHeight,
                reviewerNote,
                actor,
                role,
                reviewedAt,
                sourceAlignment: section.sourceAlignment || sourceAlignmentForWorkspace(workspace)
              });
              updated = {
                ...section,
                sourceAnchorReview: review
              };
              return updated;
            });
            if (!updated) throw notFound("Extraction section not found.");
            return updated;
          },
          {
            type: "Source anchor review",
            title: "Source anchor review recorded",
            detail: "A reviewer recorded field-level page, segment, and bounding-box source anchoring.",
            actor,
            role,
            subjectId: sectionId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const extractionMatch = url.pathname.match(/^\/api\/extraction\/([^/]+)$/);
      if (request.method === "PATCH" && extractionMatch) {
        requirePermission(role, "editExtraction");
        const sectionId = decodeURIComponent(extractionMatch[1]);
        const body = await readJson(request);
        const result = await store.mutate(
          (workspace) => {
            requireStudentAccess(user, workspace.currentStudentId);
            let updated;
            workspace.extractionSections = (workspace.extractionSections || []).map((section) => {
              if (section.id !== sectionId) return section;
              const hasContentEdit = Object.hasOwn(body, "content") && body.content !== section.content;
              updated = {
                ...section,
                ...(hasContentEdit
                  ? {
                      content: body.content,
                      status: "Needs review",
                      priorContent: section.priorContent || section.content,
                      editedBy: actor,
                      editedByRole: role,
                      editedAt: new Date().toISOString()
                    }
                  : {}),
                status: body.status ?? (hasContentEdit ? "Needs review" : section.status)
              };
              return updated;
            });
            if (!updated) throw notFound("Extraction section not found.");
            return updated;
          },
          {
            type: "User edit",
            title: "Extracted field updated",
            detail: "A structured extraction field was edited or confirmed by an authorized user.",
            actor,
            role,
            subjectId: sectionId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const extractionReviewMatch = url.pathname.match(/^\/api\/extraction\/([^/]+)\/(reject|regenerate)$/);
      if (request.method === "POST" && extractionReviewMatch) {
        requirePermission(role, "editExtraction");
        const sectionId = decodeURIComponent(extractionReviewMatch[1]);
        const action = extractionReviewMatch[2];
        const body = await readJson(request);
        const result = await store.mutate(
          (workspace) => {
            requireStudentAccess(user, workspace.currentStudentId);
            const activeDocument = documentForCurrentStudent(workspace);
            let updated;
            workspace.extractionSections = (workspace.extractionSections || []).map((section) => {
              if (section.id !== sectionId) return section;
              updated =
                action === "reject"
                  ? rejectExtractionSection(section, body, { name: actor, role })
                  : regenerateExtractionSection(section, activeDocument, workspace, body, { name: actor, role });
              return updated;
            });
            if (!updated) throw notFound("Extraction section not found.");
            return updated;
          },
          {
            type: action === "reject" ? "Human review" : "AI-assisted extraction",
            title: action === "reject" ? "Extraction section rejected" : "Extraction section regenerated",
            detail:
              action === "reject"
                ? "A reviewer flagged extracted content as not ready for the structured record."
                : "A reviewer requested a regenerated extraction while preserving prior section text.",
            actor,
            role,
            subjectId: sectionId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/extraction/approve") {
        requirePermission(role, "approveExtraction");
        const result = await store.mutate(
          (workspace) => {
            requireStudentAccess(user, workspace.currentStudentId);
            const sourceAlignment = sourceAlignmentForWorkspace(workspace);
            workspace.extractionSections = (workspace.extractionSections || []).map((section) => ({
              ...section,
              status: section.status === "Rejected" ? "Rejected" : "Confirmed",
              sourceAlignment: section.sourceAlignment || sourceAlignment
            }));
            workspace.ieps = (workspace.ieps || []).map((iep) =>
              iep.studentId === workspace.currentStudentId
                ? approvedStructuredIep(workspace, iep, sourceAlignment)
                : iep
            );
            Object.assign(workspace, applyApprovedExtractionObligations(workspace, { sourceAlignment }));
            Object.assign(workspace, refreshRoleSummariesFromWorkspace(workspace, { sourceAlignment }));
            return { approved: true, sections: workspace.extractionSections.length };
          },
          [
            {
              type: "Human review",
              title: "Structured extraction approved",
              detail: "An authorized user approved reviewed structured fields for downstream workflows.",
              actor,
              role
            },
            {
              type: "Tasks created",
              title: "Implementation tasks created",
              detail: "Implementation obligations were derived from the approved structured IEP record.",
              actor,
              role
            },
            {
              type: "AI-generated summaries",
              title: "Role-specific summaries refreshed",
              detail: "Teacher, family, student, and reviewer summaries were refreshed from the approved structured IEP record with source alignment.",
              actor,
              role
            }
          ]
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/toggle$/);
      if (request.method === "POST" && taskMatch) {
        requirePermission(role, "completeTask");
        const taskId = decodeURIComponent(taskMatch[1]);
        const body = await readJson(request);
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.tasks = (workspace.tasks || []).map((task) => {
              if (task.id !== taskId) return task;
              requireStudentAccess(user, task.studentId);
              updated = nextTaskStatus(task, body, { name: actor, role });
              return updated;
            });
            if (!updated) throw notFound("Task not found.");
            return updated;
          },
          {
            type: "Task update",
            title: "Implementation task updated",
            detail: "A role-specific IEP implementation task changed status.",
            actor,
            role,
            subjectId: taskId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const taskAcknowledgeMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/acknowledge$/);
      if (request.method === "POST" && taskAcknowledgeMatch) {
        requirePermission(role, "acknowledgeTask");
        const taskId = decodeURIComponent(taskAcknowledgeMatch[1]);
        const body = await readJson(request);
        const acknowledgment = {
          acknowledgedBy: actor,
          acknowledgedByRole: role,
          acknowledgedAt: new Date().toISOString(),
          note: String(body.note || "").trim() || "Reviewed assigned IEP responsibility."
        };
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.tasks = (workspace.tasks || []).map((task) => {
              if (task.id !== taskId) return task;
              requireStudentAccess(user, task.studentId);
              const acknowledgments = [
                acknowledgment,
                ...(task.acknowledgments || []).filter((item) => item.acknowledgedBy !== actor)
              ];
              updated = { ...task, acknowledgments };
              return updated;
            });
            if (!updated) throw notFound("Task not found.");
            return updated;
          },
          {
            type: "Task acknowledgment",
            title: "Implementation handoff acknowledged",
            detail: "A responsible staff member acknowledged an assigned IEP implementation responsibility.",
            actor,
            role,
            subjectId: taskId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const taskObservationMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/observations$/);
      if (request.method === "POST" && taskObservationMatch) {
        requirePermission(role, "recordObservation");
        const taskId = decodeURIComponent(taskObservationMatch[1]);
        const body = await readJson(request);
        const note = String(body.note || "").trim();
        const context = String(body.context || "").trim();
        if (!note || !context) throw badRequest("Observation context and note are required.");
        const observation = {
          id: `observation-${randomUUID()}`,
          observedAt: String(body.observedAt || "").trim() || isoDate(new Date()),
          context,
          note,
          supportUsed: String(body.supportUsed || "").trim() || "Not specified",
          enteredBy: actor,
          enteredByRole: role,
          enteredAt: new Date().toISOString()
        };
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.tasks = (workspace.tasks || []).map((task) => {
              if (task.id !== taskId) return task;
              requireStudentAccess(user, task.studentId);
              updated = {
                ...task,
                observations: [observation, ...(task.observations || [])]
              };
              return updated;
            });
            if (!updated) throw notFound("Task not found.");
            return updated;
          },
          {
            type: "Task observation",
            title: "Classroom observation recorded",
            detail: "A staff observation was attached to an implementation responsibility.",
            actor,
            role,
            subjectId: taskId
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/team-comments") {
        requirePermission(role, "addTeamComment");
        const body = await readJson(request);
        const studentId = requiredString(body.studentId, "Student");
        requireStudentAccess(user, studentId);
        const commentBody = requiredString(body.body, "Team comment");
        const visibility = normalizeTeamCommentVisibility(body.visibility, role);
        const postedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            requireStudentAccess(user, studentId);
            const target = teamCommentTargetForWorkspace(workspace, {
              studentId,
              targetType: body.targetType,
              targetId: body.targetId,
              targetTitle: body.targetTitle,
              sourceReference: body.sourceReference
            });
            const comment = {
              id: `team-comment-${randomUUID()}`,
              studentId,
              targetType: target.targetType,
              targetId: target.targetId,
              targetTitle: target.targetTitle,
              visibility,
              body: commentBody,
              postedBy: actor,
              postedByRole: role,
              postedByUserId: user.id,
              postedAt,
              sourceReference: target.sourceReference,
              sourceAlignment: sourceAlignmentForWorkspace(workspace),
              moderationStatus: "Pending review",
              moderationNote: "",
              moderatedBy: "",
              moderatedByRole: "",
              moderatedAt: "",
              moderationDigest: "",
              replies: [],
              officialRecordImpact:
                "Team collaboration note only; does not change official IEP obligations."
            };
            workspace.teamComments = [comment, ...(workspace.teamComments || [])];
            return comment;
          },
          {
            type: "Team collaboration",
            title: "Team comment added",
            detail: `${actor} added a ${visibility.toLowerCase()} comment for ${body.targetTitle || body.targetType || "the IEP workspace"}.`,
            actor,
            role,
            subjectId: studentId
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const teamCommentReplyMatch = url.pathname.match(/^\/api\/team-comments\/([^/]+)\/replies$/);
      if (request.method === "POST" && teamCommentReplyMatch) {
        requirePermission(role, "addTeamComment");
        const commentId = decodeURIComponent(teamCommentReplyMatch[1]);
        const body = await readJson(request);
        const replyBody = requiredString(body.body, "Thread reply");
        const visibility = normalizeTeamCommentVisibility(body.visibility, role);
        const postedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let reply;
            workspace.teamComments = (workspace.teamComments || []).map((comment) => {
              if (comment.id !== commentId) return comment;
              requireStudentAccess(user, comment.studentId);
              reply = {
                id: `team-reply-${randomUUID()}`,
                commentId,
                studentId: comment.studentId,
                visibility,
                body: replyBody,
                postedBy: actor,
                postedByRole: role,
                postedByUserId: user.id,
                postedAt,
                sourceReference: comment.sourceReference || "Student workspace collaboration thread",
                sourceAlignment: comment.sourceAlignment || sourceAlignmentForWorkspace(workspace),
                officialRecordImpact:
                  "Threaded collaboration reply only; does not change official IEP obligations."
              };
              return {
                ...comment,
                replies: [reply, ...(comment.replies || [])]
              };
            });
            if (!reply) throw notFound("Team comment not found.");
            return reply;
          },
          {
            type: "Team collaboration",
            title: "Team comment reply added",
            detail: `${actor} added a threaded reply to ${commentId}.`,
            actor,
            role,
            subjectId: commentId
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const teamCommentModerationMatch = url.pathname.match(/^\/api\/team-comments\/([^/]+)\/moderation$/);
      if (request.method === "PATCH" && teamCommentModerationMatch) {
        requirePermission(role, "moderateTeamComment");
        const commentId = decodeURIComponent(teamCommentModerationMatch[1]);
        const body = await readJson(request);
        const moderationStatus = normalizeTeamCommentModerationStatus(body.moderationStatus);
        const visibility = normalizeTeamCommentVisibility(body.visibility, role);
        const moderationNote = requiredString(body.moderationNote, "Moderation note");
        const moderatedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.teamComments = (workspace.teamComments || []).map((comment) => {
              if (comment.id !== commentId) return comment;
              requireStudentAccess(user, comment.studentId);
              updated = {
                ...comment,
                visibility,
                moderationStatus,
                moderationNote,
                moderatedBy: actor,
                moderatedByRole: role,
                moderatedAt,
                moderationDigest: createTeamCommentModerationDigest({
                  comment,
                  visibility,
                  moderationStatus,
                  moderationNote,
                  actor,
                  role,
                  moderatedAt
                })
              };
              return updated;
            });
            if (!updated) throw notFound("Team comment not found.");
            return updated;
          },
          {
            type: "Team collaboration moderation",
            title: "Team comment moderated",
            detail: `${commentId} marked ${moderationStatus}; official IEP obligations unchanged.`,
            actor,
            role,
            subjectId: commentId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/team-comments/queue-reviews") {
        requirePermission(role, "moderateTeamComment");
        const body = await readJson(request);
        const studentId = requiredString(body.studentId, "Student");
        requireStudentAccess(user, studentId);
        const queueStatus = normalizeTeamCommentQueueStatus(body.queueStatus);
        const notificationPlan = requiredString(body.notificationPlan, "Queue notification plan");
        const retentionDecision = normalizeTeamCommentRetentionDecision(body.retentionDecision);
        const retentionBoundary = requiredString(body.retentionBoundary, "Queue retention boundary");
        const reviewerNote = requiredString(body.reviewerNote, "Queue reviewer note");
        const nextReviewDate = String(body.nextReviewDate || "").trim();
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            requireStudentAccess(user, studentId);
            const snapshot = teamCommentQueueSnapshotForWorkspace(workspace, studentId);
            const queueReview = {
              id: `team-comment-queue-review-${randomUUID()}`,
              studentId,
              queueStatus,
              notificationPlan,
              retentionDecision,
              retentionBoundary,
              reviewerNote,
              nextReviewDate,
              commentsReviewed: snapshot.commentsReviewed,
              pendingCount: snapshot.pendingCount,
              needsFollowUpCount: snapshot.needsFollowUpCount,
              staffOnlyCount: snapshot.staffOnlyCount,
              familyVisibleCount: snapshot.familyVisibleCount,
              studentVisibleCount: snapshot.studentVisibleCount,
              latestCommentAt: snapshot.latestCommentAt,
              reviewedBy: actor,
              reviewedByRole: role,
              reviewedByUserId: user.id,
              reviewedAt,
              sourceReference: "Student workspace collaboration moderation queue",
              sourceAlignment: sourceAlignmentForWorkspace(workspace),
              officialRecordImpact:
                "Collaboration queue review documents local moderation, notification, and retention readiness only; it does not change official IEP obligations."
            };
            queueReview.queueDigest = createTeamCommentQueueReviewDigest(queueReview);
            workspace.teamCommentQueueReviews = [queueReview, ...(workspace.teamCommentQueueReviews || [])];
            return queueReview;
          },
          {
            type: "Team collaboration queue",
            title: "Collaboration queue reviewed",
            detail: `${queueStatus} for source-traced collaboration items; official IEP obligations unchanged.`,
            actor,
            role,
            subjectId: studentId
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/portal-access-reviews") {
        requirePermission(role, "reviewPortalAccess");
        const body = await readJson(request);
        const studentId = requiredString(body.studentId, "Student");
        requireStudentAccess(user, studentId);
        const subjectRole = normalizePortalAccessSubjectRole(body.subjectRole);
        const subjectName = requiredString(body.subjectName, "Portal subject name");
        const accessStatus = normalizePortalAccessStatus(body.accessStatus);
        const verificationMethod = normalizePortalVerificationMethod(body.verificationMethod);
        const identityEvidence = requiredString(body.identityEvidence, "Portal identity evidence");
        const privacyNote = requiredString(body.privacyNote, "Portal privacy note");
        const languageSupportNeeded = String(body.languageSupportNeeded || "No").trim() || "No";
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            requireStudentAccess(user, studentId);
            const review = {
              id: `portal-access-review-${randomUUID()}`,
              studentId,
              subjectRole,
              subjectName,
              accessStatus,
              verificationMethod,
              identityEvidence,
              languageSupportNeeded,
              privacyNote,
              reviewedBy: actor,
              reviewedByRole: role,
              reviewedByUserId: user.id,
              reviewedAt,
              sourceReference: "Parent/student portal access and privacy review",
              sourceAlignment: sourceAlignmentForWorkspace(workspace),
              officialRecordImpact:
                "Portal access review controls workspace account readiness only; it does not change the official IEP or replace district identity proofing."
            };
            review.reviewDigest = createPortalAccessReviewDigest(review);
            workspace.portalAccessReviews = [review, ...(workspace.portalAccessReviews || [])];
            return review;
          },
          {
            type: "Portal access review",
            title: "Portal access reviewed",
            detail: `${subjectRole} portal access marked ${accessStatus}; official IEP obligations unchanged.`,
            actor,
            role,
            subjectId: studentId
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/portal-invitation-packages") {
        requirePermission(role, "reviewPortalAccess");
        const body = await readJson(request);
        const studentId = requiredString(body.studentId, "Student");
        requireStudentAccess(user, studentId);
        const subjectRole = normalizePortalAccessSubjectRole(body.subjectRole);
        const subjectName = requiredString(body.subjectName, "Portal invitation subject");
        const status = normalizePortalInvitationStatus(body.status);
        const deliveryChannel = normalizePortalInvitationDelivery(body.deliveryChannel);
        const expiresAt = requiredString(body.expiresAt, "Invitation expiration");
        const scopeSummary = requiredString(body.scopeSummary, "Invitation access scope");
        const identityVerificationSummary = requiredString(body.identityVerificationSummary, "Invitation identity summary");
        const privacyBoundary = requiredString(body.privacyBoundary, "Invitation privacy boundary");
        const languageSupportNote = String(body.languageSupportNote || "No additional language support requested.").trim();
        const providerReference = String(body.providerReference || "").trim();
        const preparedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            requireStudentAccess(user, studentId);
            const invitation = {
              id: `portal-invitation-${randomUUID()}`,
              studentId,
              subjectRole,
              subjectName,
              status,
              deliveryChannel,
              expiresAt,
              scopeSummary,
              identityVerificationSummary,
              languageSupportNote,
              privacyBoundary,
              providerReference,
              preparedBy: actor,
              preparedByRole: role,
              preparedByUserId: user.id,
              preparedAt,
              sourceReference: "Parent/student portal invitation readiness package",
              sourceAlignment: sourceAlignmentForWorkspace(workspace),
              officialRecordImpact:
                "Portal invitation package documents local access readiness only; it does not send a production invitation, prove identity, or change the official IEP."
            };
            invitation.invitationDigest = createPortalInvitationDigest(invitation);
            workspace.portalInvitationPackages = [invitation, ...(workspace.portalInvitationPackages || [])];
            return invitation;
          },
          {
            type: "Portal invitation",
            title: "Portal invitation package prepared",
            detail: `${subjectRole} portal invitation package prepared for ${subjectName}; official IEP obligations unchanged.`,
            actor,
            role,
            subjectId: studentId
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/progress") {
        requirePermission(role, "addProgress");
        const body = await readJson(request);
        const entry = {
          id: `progress-${randomUUID()}`,
          date: body.date || new Date().toISOString().slice(0, 10),
          value: Number(body.value),
          notes: body.notes || "",
          enteredBy: actor,
          evidenceDocumentId: body.evidenceDocumentId || null,
          evidenceLabel: String(body.evidenceLabel || "").trim(),
          evidenceType: String(body.evidenceType || "").trim()
        };
        const result = await store.mutate(
          (workspace) => {
            let updatedGoal;
            workspace.goals = (workspace.goals || []).map((goal) => {
              if (goal.id !== body.goalId) return goal;
              requireStudentAccess(user, studentIdForIep(workspace, goal.iepId));
              updatedGoal = {
                ...goal,
                status: Number(entry.value) >= targetForGoal(goal) ? "On track" : goal.status,
                progressSchedule: nextProgressSchedule(goal, entry.date),
                progressEntries: [...(goal.progressEntries || []), entry]
              };
              return updatedGoal;
            });
            if (!updatedGoal) throw notFound("Goal not found.");
            return { goal: updatedGoal, entry };
          },
          {
            type: "Progress data entered",
            title: "Progress evidence entered",
            detail: "A progress entry was saved against an approved goal measurement method.",
            actor,
            role,
            subjectId: body.goalId
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const serviceLogMatch = url.pathname.match(/^\/api\/services\/([^/]+)\/log$/);
      if (request.method === "POST" && serviceLogMatch) {
        requirePermission(role, "logService");
        const serviceId = decodeURIComponent(serviceLogMatch[1]);
        const body = await readJson(request);
        const minutes = Number(body.minutes || 0);
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.services = (workspace.services || []).map((service) => {
              if (service.id !== serviceId) return service;
              requireStudentAccess(user, studentIdForIep(workspace, service.iepId));
              const deliveredMinutes = Number(service.deliveredMinutes || 0) + minutes;
              updated = {
                ...service,
                deliveredMinutes,
                recoveryStatus: deliveredMinutes >= service.scheduledMinutes ? "On schedule" : service.recoveryStatus
              };
              return updated;
            });
            if (!updated) throw notFound("Service not found.");
            return updated;
          },
          {
            type: "Service log",
            title: "Service delivery documented",
            detail: `${minutes} delivered service minutes were recorded.`,
            actor,
            role,
            subjectId: serviceId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const serviceRecoveryMatch = url.pathname.match(/^\/api\/services\/([^/]+)\/recovery$/);
      if (request.method === "POST" && serviceRecoveryMatch) {
        requirePermission(role, "planRecovery");
        const serviceId = decodeURIComponent(serviceRecoveryMatch[1]);
        const body = await readJson(request);
        const recoveryDate = String(body.recoveryDate || "").trim();
        const provider = String(body.provider || "").trim();
        const familyCommunication = String(body.familyCommunication || "").trim();
        if (!recoveryDate || Number.isNaN(Date.parse(recoveryDate)) || !provider || !familyCommunication) {
          throw badRequest("Recovery date, provider, and family communication are required.");
        }
        const plannedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.services = (workspace.services || []).map((service) => {
              if (service.id !== serviceId) return service;
              requireStudentAccess(user, studentIdForIep(workspace, service.iepId));
              updated = {
                ...service,
                recoveryStatus: "Recovery planned",
                recoveryPlan: {
                  status: "Recovery planned",
                  missedMinutes: Math.max(Number(service.scheduledMinutes || 0) - Number(service.deliveredMinutes || 0), 0),
                  recoveryDate,
                  provider,
                  familyCommunication,
                  plannedBy: actor,
                  plannedByRole: role,
                  plannedAt
                }
              };
              return updated;
            });
            if (!updated) throw notFound("Service not found.");
            return updated;
          },
          {
            type: "Service recovery",
            title: "Service recovery planned",
            detail: `Recovery planned for ${recoveryDate} with ${provider}; family communication recorded.`,
            actor,
            role,
            subjectId: serviceId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const accessSupportMatch = url.pathname.match(/^\/api\/access-supports\/([^/]+)$/);
      if (request.method === "PATCH" && accessSupportMatch) {
        requirePermission(role, "updateAccessSupport");
        const supportId = decodeURIComponent(accessSupportMatch[1]);
        const body = await readJson(request);
        const status = normalizeAccessSupportStatus(body.status);
        const implementationPlan = requiredString(body.implementationPlan, "Access implementation plan");
        const responsibleRole = requiredString(body.responsibleRole, "Access support owner");
        const reviewNote = requiredString(body.reviewNote, "Access review note");
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.accessSupportPlans = (workspace.accessSupportPlans || []).map((support) => {
              if (support.id !== supportId) return support;
              requireStudentAccess(user, support.studentId);
              updated = {
                ...support,
                status,
                implementationPlan,
                responsibleRole,
                reviewNote,
                reviewedBy: actor,
                reviewedByRole: role,
                reviewedAt,
                sourceAlignment: support.sourceAlignment || sourceAlignmentForWorkspace(workspace),
                officialRecordImpact:
                  support.officialRecordImpact ||
                  "Access-support review note only; official IEP access-support decisions remain controlled by the reviewed source document and IEP team."
              };
              updated.supportDigest = createAccessSupportDigest({ support: updated, actor, role });
              return updated;
            });
            if (!updated) throw notFound("Access support not found.");
            return updated;
          },
          {
            type: "Access supports",
            title: "Access support review updated",
            detail: "A human reviewer updated assistive-technology or transportation implementation support without changing official IEP requirements.",
            actor,
            role,
            subjectId: supportId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const placementReviewMatch = url.pathname.match(/^\/api\/placement-reviews\/([^/]+)$/);
      if (request.method === "PATCH" && placementReviewMatch) {
        requirePermission(role, "reviewPlacement");
        const reviewId = decodeURIComponent(placementReviewMatch[1]);
        const body = await readJson(request);
        const status = normalizePlacementReviewStatus(body.status);
        const lreConsideration = requiredString(body.lreConsideration, "LRE consideration");
        const implementationImpact = requiredString(body.implementationImpact, "Placement implementation impact");
        const followUpOwner = requiredString(body.followUpOwner, "Placement follow-up owner");
        const reviewerNote = requiredString(body.reviewerNote, "Placement reviewer note");
        const nextReviewDate = String(body.nextReviewDate || "").trim();
        if (!nextReviewDate || Number.isNaN(Date.parse(nextReviewDate))) {
          throw badRequest("Next placement review date is required.");
        }
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.placementReviews = (workspace.placementReviews || []).map((review) => {
              if (review.id !== reviewId) return review;
              requireStudentAccess(user, review.studentId);
              updated = {
                ...review,
                status,
                lreConsideration,
                implementationImpact,
                followUpOwner,
                nextReviewDate,
                reviewerNote,
                reviewedBy: actor,
                reviewedByRole: role,
                reviewedAt,
                sourceAlignment: review.sourceAlignment || sourceAlignmentForWorkspace(workspace),
                officialRecordImpact:
                  review.officialRecordImpact ||
                  "Placement review note only; official placement and LRE decisions remain controlled by the reviewed source document and IEP team."
              };
              updated.placementDigest = createPlacementReviewDigest({ review: updated, actor, role });
              return updated;
            });
            if (!updated) throw notFound("Placement review not found.");
            return updated;
          },
          {
            type: "Placement review",
            title: "Placement rationale review updated",
            detail: "A human reviewer updated educational placement and LRE implementation review without making an official placement decision.",
            actor,
            role,
            subjectId: reviewId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/review-flags/generate") {
        requirePermission(role, "generateReview");
        const generatedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            requireStudentAccess(user, workspace.currentStudentId);
            const generatedFlags = generateCompletenessReviewFlags(workspace, {
              studentId: workspace.currentStudentId,
              actor,
              role,
              generatedAt
            });
            workspace.reviewFlags = mergeGeneratedReviewFlags(workspace.reviewFlags, generatedFlags);
            return { generatedCount: generatedFlags.length, generatedFlags };
          },
          {
            type: "AI-assisted review",
            title: "Completeness review generated",
            detail: "Advisory completeness findings were generated from the structured IEP record and require human disposition.",
            actor,
            role,
            subjectId: user.studentScope?.[0] || "workspace"
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const reviewMatch = url.pathname.match(/^\/api\/review-flags\/([^/]+)\/resolve$/);
      if (request.method === "POST" && reviewMatch) {
        requirePermission(role, "resolveFlag");
        const flagId = decodeURIComponent(reviewMatch[1]);
        const body = await readJson(request);
        const decision = requiredString(body.decision, "Decision");
        const rationale = requiredString(body.rationale, "Rationale");
        const nextAction = requiredString(body.nextAction, "Next action");
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.reviewFlags = (workspace.reviewFlags || []).map((flag) => {
              if (flag.id !== flagId) return flag;
              requireStudentAccess(user, flag.studentId);
              updated = {
                ...flag,
                status: "Resolved",
                resolvedBy: actor,
                resolvedAt: new Date().toISOString(),
                resolution: {
                  decision,
                  rationale,
                  nextAction,
                  reviewerRole: role
                }
              };
              return updated;
            });
            if (!updated) throw notFound("Review flag not found.");
            return updated;
          },
          {
            type: "Compliance flag resolved",
            title: "Advisory finding resolved",
            detail: `A human reviewer recorded a disposition for ${flagId}: ${decision}.`,
            actor,
            role,
            subjectId: flagId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const complianceReviewRequestMatch = url.pathname.match(/^\/api\/review-flags\/([^/]+)\/compliance-reviews$/);
      if (request.method === "POST" && complianceReviewRequestMatch) {
        requirePermission(role, "requestComplianceReview");
        const flagId = decodeURIComponent(complianceReviewRequestMatch[1]);
        const body = await readJson(request);
        const assignedReviewer = requiredString(body.assignedReviewer, "Assigned reviewer");
        const dueDate = requiredString(body.dueDate, "Compliance review due date");
        const rationale = requiredString(body.rationale, "Compliance review rationale");
        const nextAction = requiredString(body.nextAction, "Compliance review next action");
        const reviewType = String(body.reviewType || "Implementation compliance review").trim();
        const requestedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const flag = (workspace.reviewFlags || []).find((item) => item.id === flagId);
            if (!flag) throw notFound("Review flag not found.");
            requireStudentAccess(user, flag.studentId);
            const review = {
              id: `compliance-review-${randomUUID()}`,
              studentId: flag.studentId,
              flagId,
              reviewType,
              issue: flag.issue,
              assignedReviewer,
              dueDate,
              status: "Requested",
              requestedBy: actor,
              requestedByRole: role,
              requestedAt,
              rationale,
              reviewerNote: "",
              outcome: "",
              nextAction,
              reviewedBy: "",
              reviewedByRole: "",
              reviewedAt: "",
              notLegalCertification: true,
              sourceReference: flag.sourceReference,
              sourceAlignment: flag.sourceAlignment || sourceAlignmentForWorkspace(workspace)
            };
            workspace.complianceReviews = [review, ...(workspace.complianceReviews || [])];
            return review;
          },
          {
            type: "Compliance review",
            title: "Compliance review requested",
            detail: `${flagId} was escalated to ${assignedReviewer} for human review.`,
            actor,
            role,
            subjectId: flagId
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const complianceReviewMatch = url.pathname.match(/^\/api\/compliance-reviews\/([^/]+)$/);
      if (request.method === "PATCH" && complianceReviewMatch) {
        requirePermission(role, "completeComplianceReview");
        const reviewId = decodeURIComponent(complianceReviewMatch[1]);
        const body = await readJson(request);
        const status = normalizeComplianceReviewStatus(body.status);
        const outcome = requiredString(body.outcome, "Compliance review outcome");
        const reviewerNote = requiredString(body.reviewerNote, "Reviewer note");
        const nextAction = requiredString(body.nextAction, "Next action");
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.complianceReviews = (workspace.complianceReviews || []).map((review) => {
              if (review.id !== reviewId) return review;
              requireStudentAccess(user, review.studentId);
              updated = {
                ...review,
                status,
                outcome,
                reviewerNote,
                nextAction,
                reviewedBy: actor,
                reviewedByRole: role,
                reviewedAt
              };
              return updated;
            });
            if (!updated) throw notFound("Compliance review not found.");
            return updated;
          },
          {
            type: "Compliance review",
            title: "Compliance review outcome recorded",
            detail: `${status} recorded for ${reviewId}; not a legal certification.`,
            actor,
            role,
            subjectId: reviewId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const legalRouteRequestMatch = url.pathname.match(/^\/api\/compliance-reviews\/([^/]+)\/legal-routes$/);
      if (request.method === "POST" && legalRouteRequestMatch) {
        requirePermission(role, "manageLegalReview");
        const reviewId = decodeURIComponent(legalRouteRequestMatch[1]);
        const body = await readJson(request);
        const counselName = requiredString(body.counselName, "District counsel");
        const reviewScope = requiredString(body.reviewScope, "Legal review scope");
        const routingReason = requiredString(body.routingReason, "Routing reason");
        const dueDate = requiredString(body.dueDate, "Legal review due date");
        const districtPolicyReference = requiredString(body.districtPolicyReference, "District policy reference");
        const routedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const complianceReview = (workspace.complianceReviews || []).find((review) => review.id === reviewId);
            if (!complianceReview) throw notFound("Compliance review not found.");
            requireStudentAccess(user, complianceReview.studentId);
            const route = {
              id: `legal-route-${randomUUID()}`,
              studentId: complianceReview.studentId,
              complianceReviewId: reviewId,
              flagId: complianceReview.flagId,
              issue: complianceReview.issue,
              status: "Routed to counsel",
              counselName,
              reviewScope,
              routingReason,
              dueDate,
              districtPolicyReference,
              routedBy: actor,
              routedByRole: role,
              routedAt,
              counselSummary: "",
              recommendedAction: "",
              reviewerNote: "",
              reviewedBy: "",
              reviewedByRole: "",
              reviewedAt: "",
              notLegalCertification:
                "Workspace records routing and counsel response metadata only; final legal advice and district action remain outside automated certification.",
              routeDigest: createLegalReviewRouteDigest({
                reviewId,
                issue: complianceReview.issue,
                counselName,
                reviewScope,
                routingReason,
                dueDate,
                districtPolicyReference,
                actor,
                role,
                routedAt
              }),
              sourceReference: complianceReview.sourceReference,
              sourceAlignment: complianceReview.sourceAlignment || sourceAlignmentForWorkspace(workspace)
            };
            workspace.legalReviewRoutes = [route, ...(workspace.legalReviewRoutes || [])];
            workspace.complianceReviews = (workspace.complianceReviews || []).map((review) =>
              review.id === reviewId
                ? {
                    ...review,
                    legalRouteStatus: "Routed to counsel",
                    legalRouteId: route.id
                  }
                : review
            );
            return route;
          },
          {
            type: "Legal review routing",
            title: "District counsel review routed",
            detail: `${reviewId} routed to ${counselName} for district counsel review.`,
            actor,
            role,
            subjectId: reviewId
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const legalRouteOutcomeMatch = url.pathname.match(/^\/api\/legal-review-routes\/([^/]+)$/);
      if (request.method === "PATCH" && legalRouteOutcomeMatch) {
        requirePermission(role, "manageLegalReview");
        const routeId = decodeURIComponent(legalRouteOutcomeMatch[1]);
        const body = await readJson(request);
        const status = normalizeLegalReviewStatus(body.status);
        const counselSummary = requiredString(body.counselSummary, "Counsel summary");
        const recommendedAction = requiredString(body.recommendedAction, "Recommended action");
        const reviewerNote = requiredString(body.reviewerNote, "Legal review note");
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.legalReviewRoutes = (workspace.legalReviewRoutes || []).map((route) => {
              if (route.id !== routeId) return route;
              requireStudentAccess(user, route.studentId);
              updated = {
                ...route,
                status,
                counselSummary,
                recommendedAction,
                reviewerNote,
                reviewedBy: actor,
                reviewedByRole: role,
                reviewedAt,
                outcomeDigest: createLegalReviewOutcomeDigest({
                  routeId,
                  status,
                  counselSummary,
                  recommendedAction,
                  reviewerNote,
                  actor,
                  role,
                  reviewedAt
                })
              };
              return updated;
            });
            if (!updated) throw notFound("Legal review route not found.");
            workspace.complianceReviews = (workspace.complianceReviews || []).map((review) =>
              review.id === updated.complianceReviewId
                ? {
                    ...review,
                    legalRouteStatus: status,
                    legalRouteId: updated.id,
                    nextAction: recommendedAction
                  }
                : review
            );
            return updated;
          },
          {
            type: "Legal review routing",
            title: "District counsel response recorded",
            detail: `${status} recorded for ${routeId}; not legal certification by the workspace.`,
            actor,
            role,
            subjectId: routeId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/iep-comparisons") {
        requirePermission(role, "reviewIepComparison");
        const body = await readJson(request);
        const section = requiredString(body.section, "IEP comparison section");
        const changeType = requiredString(body.changeType, "IEP comparison change type");
        const title = requiredString(body.title, "IEP comparison title");
        const previousText = requiredString(body.previousText, "Previous IEP language");
        const currentText = requiredString(body.currentText, "Current IEP language");
        const implementationImpact = requiredString(body.implementationImpact, "Implementation impact");
        const familySummary = requiredString(body.familySummary, "Family summary language");
        const amendmentNote = requiredString(body.amendmentNote, "Amendment review note");
        const amendmentReviewStatus = normalizeIepAmendmentReviewStatus(body.amendmentReviewStatus);
        const createdAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const studentId = workspace.currentStudentId;
            if (!studentId) throw badRequest("Select a student before creating an IEP comparison.");
            requireStudentAccess(user, studentId);
            const currentIep =
              (workspace.ieps || []).find((iep) => iep.studentId === studentId && iep.status === "Active") ||
              (workspace.ieps || []).find((iep) => iep.studentId === studentId);
            const comparison = {
              id: `comparison-${randomUUID()}`,
              studentId,
              previousIepId: String(body.previousIepId || "previous-iep-local-intake").trim(),
              currentIepId: currentIep?.id || String(body.currentIepId || "current-iep-local-intake").trim(),
              section,
              changeType,
              title,
              previousText,
              currentText,
              implementationImpact,
              familySummary,
              status: "Needs team review",
              reviewNote: "Review captured from prior/current IEP language intake.",
              reviewedBy: "",
              reviewedByRole: "",
              reviewedAt: "",
              familyVisible: Boolean(body.familyVisible),
              studentVisible: Boolean(body.studentVisible),
              sourceReference: String(body.sourceReference || `Prior/current IEP version intake - ${section}`).trim(),
              sourceAlignment: sourceAlignmentForWorkspace(workspace),
              versionIntake: {
                intakeMethod: "Manual prior/current language paste",
                createdBy: actor,
                createdByRole: role,
                createdAt
              },
              amendmentReviewStatus,
              amendmentNote,
              officialRecordImpact:
                "Prior/current comparison is advisory meeting-prep evidence only; it does not amend the official IEP or replace district amendment procedures."
            };
            comparison.comparisonDigest = createIepComparisonDigest({
              comparison,
              status: comparison.status,
              reviewNote: comparison.reviewNote,
              familyVisible: comparison.familyVisible,
              studentVisible: comparison.studentVisible,
              actor,
              role,
              reviewedAt: createdAt
            });
            workspace.iepComparisons = [comparison, ...(workspace.iepComparisons || [])];
            return comparison;
          },
          {
            type: "IEP version comparison",
            title: "IEP comparison added",
            detail: `${title} captured for prior/current IEP review; it does not amend the official IEP.`,
            actor,
            role,
            subjectId: title
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/iep-comparisons/auto-diff") {
        requirePermission(role, "reviewIepComparison");
        const body = await readJson(request);
        const previousText = requiredString(body.previousText, "Previous IEP full text");
        const currentText = requiredString(body.currentText, "Current IEP full text");
        const previousDocumentLabel = String(body.previousDocumentLabel || "Previous IEP text").trim();
        const currentDocumentLabel = String(body.currentDocumentLabel || "Current IEP text").trim();
        const createdAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const studentId = workspace.currentStudentId;
            if (!studentId) throw badRequest("Select a student before generating IEP comparison candidates.");
            requireStudentAccess(user, studentId);
            const currentIep =
              (workspace.ieps || []).find((iep) => iep.studentId === studentId && iep.status === "Active") ||
              (workspace.ieps || []).find((iep) => iep.studentId === studentId);
            const candidates = generateIepAutoDiffCandidates(previousText, currentText).slice(0, 6);
            if (!candidates.length) throw badRequest("No material prior/current IEP differences were detected.");
            const comparisons = candidates.map((candidate, index) => {
              const comparison = {
                id: `comparison-auto-${randomUUID()}`,
                studentId,
                previousIepId: String(body.previousIepId || "previous-iep-auto-diff").trim(),
                currentIepId: currentIep?.id || String(body.currentIepId || "current-iep-auto-diff").trim(),
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
                sourceAlignment: sourceAlignmentForWorkspace(workspace),
                versionIntake: {
                  intakeMethod: "Automated prior/current text diff",
                  previousDocumentLabel,
                  currentDocumentLabel,
                  candidateIndex: index + 1,
                  candidateCount: candidates.length,
                  createdBy: actor,
                  createdByRole: role,
                  createdAt
                },
                amendmentReviewStatus: candidate.amendmentReviewStatus || "Amendment review needed",
                amendmentNote:
                  "Automated diff only identifies changed language; the IEP team must decide whether an amendment, meeting action, or district procedure is required.",
                officialRecordImpact:
                  "Prior/current auto-diff candidate is advisory meeting-prep evidence only; it does not amend the official IEP or replace district amendment procedures."
              };
              comparison.comparisonDigest = createIepComparisonDigest({
                comparison,
                status: comparison.status,
                reviewNote: comparison.reviewNote,
                familyVisible: comparison.familyVisible,
                studentVisible: comparison.studentVisible,
                actor,
                role,
                reviewedAt: createdAt
              });
              return comparison;
            });
            workspace.iepComparisons = [...comparisons, ...(workspace.iepComparisons || [])];
            return {
              comparisons,
              generatedCount: comparisons.length
            };
          },
          {
            type: "IEP version comparison",
            title: "IEP auto-diff candidates generated",
            detail: "Prior/current IEP text diff generated comparison candidates for human review.",
            actor,
            role,
            subjectId: "iep-auto-diff"
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const iepComparisonMatch = url.pathname.match(/^\/api\/iep-comparisons\/([^/]+)$/);
      if (request.method === "PATCH" && iepComparisonMatch) {
        requirePermission(role, "reviewIepComparison");
        const comparisonId = decodeURIComponent(iepComparisonMatch[1]);
        const body = await readJson(request);
        const status = normalizeIepComparisonStatus(body.status);
        const reviewNote = requiredString(body.reviewNote, "IEP comparison review note");
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.iepComparisons = (workspace.iepComparisons || []).map((comparison) => {
              if (comparison.id !== comparisonId) return comparison;
              requireStudentAccess(user, comparison.studentId);
              updated = {
                ...comparison,
                status,
                reviewNote,
                familyVisible: Boolean(body.familyVisible),
                studentVisible: Boolean(body.studentVisible),
                reviewedBy: actor,
                reviewedByRole: role,
                reviewedAt,
                comparisonDigest: createIepComparisonDigest({
                  comparison,
                  status,
                  reviewNote,
                  familyVisible: Boolean(body.familyVisible),
                  studentVisible: Boolean(body.studentVisible),
                  actor,
                  role,
                  reviewedAt
                })
              };
              return updated;
            });
            if (!updated) throw notFound("IEP comparison not found.");
            return updated;
          },
          {
            type: "IEP version comparison",
            title: "IEP comparison reviewed",
            detail: `${comparisonId} marked ${status}; explanation only, not an official IEP change.`,
            actor,
            role,
            subjectId: comparisonId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const questionMatch = url.pathname.match(/^\/api\/meetings\/questions\/([^/]+)\/answer$/);
      if (request.method === "POST" && questionMatch) {
        requirePermission(role, "answerQuestion");
        const questionId = decodeURIComponent(questionMatch[1]);
        const body = await readJson(request);
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.meetings = (workspace.meetings || []).map((meeting) => ({
              ...meeting,
              familyQuestions: (meeting.familyQuestions || []).map((question) => {
                if (question.id !== questionId) return question;
                requireStudentAccess(user, meeting.studentId);
                updated = { ...question, status: "Answered", response: body.response || "Answered by team.", answeredBy: actor };
                return updated;
              })
            }));
            if (!updated) throw notFound("Family question not found.");
            return updated;
          },
          {
            type: "Meeting preparation",
            title: "Family question answered",
            detail: "A pre-meeting family question was answered and retained in the meeting record.",
            actor,
            role,
            subjectId: questionId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const meetingQuestionMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/questions$/);
      if (request.method === "POST" && meetingQuestionMatch) {
        requirePermission(role, "submitQuestion");
        const meetingId = decodeURIComponent(meetingQuestionMatch[1]);
        const body = await readJson(request);
        const text = String(body.text || "").trim();
        if (!text) throw badRequest("Question text is required.");
        const question = {
          id: `question-${randomUUID()}`,
          text,
          status: "Open",
          assignedTo: "IEP team",
          submittedBy: actor,
          submittedByRole: role,
          submittedAt: new Date().toISOString()
        };
        const result = await store.mutate(
          (workspace) => {
            let updatedMeeting;
            workspace.meetings = (workspace.meetings || []).map((meeting) => {
              if (meeting.id !== meetingId) return meeting;
              requireStudentAccess(user, meeting.studentId);
              updatedMeeting = {
                ...meeting,
                familyQuestions: [question, ...(meeting.familyQuestions || [])]
              };
              return updatedMeeting;
            });
            if (!updatedMeeting) throw notFound("Meeting not found.");
            return question;
          },
          {
            type: "Meeting preparation",
            title: "Family question submitted",
            detail: "A parent, guardian, or student submitted a pre-meeting question for team response.",
            actor,
            role,
            subjectId: question.id
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const meetingNoteMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/notes$/);
      if (request.method === "POST" && meetingNoteMatch) {
        requirePermission(role, "addMeetingPrepNote");
        const meetingId = decodeURIComponent(meetingNoteMatch[1]);
        const body = await readJson(request);
        const topic = String(body.topic || "Meeting prep note").trim() || "Meeting prep note";
        const noteBody = String(body.body || "").trim();
        if (!noteBody) throw badRequest("Meeting prep note text is required.");
        const note = {
          id: `prep-note-${randomUUID()}`,
          topic,
          body: noteBody,
          audience: String(body.audience || "IEP team").trim() || "IEP team",
          submittedBy: actor,
          submittedByRole: role,
          submittedAt: new Date().toISOString(),
          sourceReference: "Meeting prep notes area",
          sourceAlignment: null,
          officialRecordImpact:
            "Meeting preparation note only; does not change official IEP obligations or final team decisions."
        };
        const result = await store.mutate(
          (workspace) => {
            let updatedMeeting;
            const sourceAlignment = sourceAlignmentForWorkspace(workspace);
            workspace.meetings = (workspace.meetings || []).map((meeting) => {
              if (meeting.id !== meetingId) return meeting;
              requireStudentAccess(user, meeting.studentId);
              const nextNote = { ...note, sourceAlignment };
              updatedMeeting = {
                ...meeting,
                meetingPrepNotes: [nextNote, ...(meeting.meetingPrepNotes || [])]
              };
              return updatedMeeting;
            });
            if (!updatedMeeting) throw notFound("Meeting not found.");
            return updatedMeeting.meetingPrepNotes[0];
          },
          {
            type: "Meeting preparation",
            title: "Meeting prep note added",
            detail: `${topic} was added to the pre-meeting notes area for team review.`,
            actor,
            role,
            subjectId: note.id
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const packetAcknowledgmentMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/packet-acknowledgments\/([^/]+)$/);
      if (request.method === "PATCH" && packetAcknowledgmentMatch) {
        requirePermission(role, "acknowledgeMeetingPacket");
        const meetingId = decodeURIComponent(packetAcknowledgmentMatch[1]);
        const acknowledgmentId = decodeURIComponent(packetAcknowledgmentMatch[2]);
        const body = await readJson(request);
        const status = normalizePacketAcknowledgmentStatus(body.status);
        const note = requiredString(body.note, "Packet acknowledgment note");
        const acknowledgedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.meetings = (workspace.meetings || []).map((meeting) => {
              if (meeting.id !== meetingId) return meeting;
              requireStudentAccess(user, meeting.studentId);
              return {
                ...meeting,
                packetAcknowledgments: (meeting.packetAcknowledgments || []).map((acknowledgment) => {
                  if (acknowledgment.id !== acknowledgmentId) return acknowledgment;
                  if (!packetAcknowledgmentMatchesRole(role, acknowledgment)) {
                    throw forbidden("User cannot acknowledge this meeting packet.");
                  }
                  updated = {
                    ...acknowledgment,
                    status,
                    responseNote: note,
                    sourceAlignment: acknowledgment.sourceAlignment || sourceAlignmentForWorkspace(workspace),
                    acknowledgedBy: actor,
                    acknowledgedByRole: role,
                    acknowledgedAt
                  };
                  return updated;
                })
              };
            });
            if (!updated) throw notFound("Meeting packet acknowledgment not found.");
            return updated;
          },
          {
            type: "Meeting preparation",
            title: "Meeting packet acknowledged",
            detail: `${actor} recorded ${status} for ${acknowledgmentId}.`,
            actor,
            role,
            subjectId: acknowledgmentId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const signatureRequestMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/signature-requests$/);
      if (request.method === "POST" && signatureRequestMatch) {
        requirePermission(role, "requestSignature");
        const meetingId = decodeURIComponent(signatureRequestMatch[1]);
        const body = await readJson(request);
        const packetTitle = requiredString(body.packetTitle || "Annual IEP pre-read packet", "Signature packet title");
        const signatureScope = normalizeSignatureScope(body.signatureScope);
        const requestNote = requiredString(body.requestNote, "Signature request note");
        const requestedForRole = normalizeSignatureRole(body.requestedForRole || "parent");
        const requestedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let signatureRequest;
            workspace.meetings = (workspace.meetings || []).map((meeting) => {
              if (meeting.id !== meetingId) return meeting;
              requireStudentAccess(user, meeting.studentId);
              signatureRequest = {
                id: `signature-${randomUUID()}`,
                meetingId,
                studentId: meeting.studentId,
                packetTitle,
                signatureScope,
                requestedForRole,
                requestedForName: String(body.requestedForName || "Parent/guardian").trim(),
                status: "Requested",
                requestNote,
                notConsentNote:
                  "Typed signature confirms receipt and review for the scoped packet only; it does not replace IEP team decisions, consent requirements, or legal certification.",
                requestedBy: actor,
                requestedByRole: role,
                requestedAt,
                sourceReference: "Meeting packet, draft-to-final change log, and e-signature request",
                sourceAlignment: sourceAlignmentForWorkspace(workspace)
              };
              return {
                ...meeting,
                eSignatureRequests: [signatureRequest, ...(meeting.eSignatureRequests || [])]
              };
            });
            if (!signatureRequest) throw notFound("Meeting not found.");
            return signatureRequest;
          },
          {
            type: "Meeting preparation",
            title: "E-signature requested",
            detail: `${actor} requested a scoped ${signatureScope} signature for ${meetingId}.`,
            actor,
            role,
            subjectId: meetingId
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const signatureSignMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/signature-requests\/([^/]+)\/sign$/);
      if (request.method === "PATCH" && signatureSignMatch) {
        requirePermission(role, "signMeetingPacket");
        const meetingId = decodeURIComponent(signatureSignMatch[1]);
        const signatureId = decodeURIComponent(signatureSignMatch[2]);
        const body = await readJson(request);
        const signerName = requiredString(body.signerName, "Typed signature name");
        const attestation = requiredString(body.attestation, "Signature attestation");
        const signedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.meetings = (workspace.meetings || []).map((meeting) => {
              if (meeting.id !== meetingId) return meeting;
              requireStudentAccess(user, meeting.studentId);
              return {
                ...meeting,
                eSignatureRequests: (meeting.eSignatureRequests || []).map((signatureRequest) => {
                  if (signatureRequest.id !== signatureId) return signatureRequest;
                  if (!signatureRequestMatchesRole(role, signatureRequest)) {
                    throw forbidden("User cannot sign this meeting packet request.");
                  }
                  if (signatureRequest.status === "Signed") {
                    throw badRequest("This signature request has already been signed.");
                  }
                  updated = {
                    ...signatureRequest,
                    status: "Signed",
                    signerName,
                    signedBy: actor,
                    signedByRole: role,
                    signedAt,
                    attestation,
                    signatureHash: createMeetingSignatureHash({
                      signatureRequest,
                      signerName,
                      attestation,
                      actor,
                      role,
                      signedAt
                    })
                  };
                  return updated;
                })
              };
            });
            if (!updated) throw notFound("Signature request not found.");
            return updated;
          },
          {
            type: "Meeting preparation",
            title: "Meeting packet e-signed",
            detail: `${actor} signed a scoped meeting packet attestation.`,
            actor,
            role,
            subjectId: signatureId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const studentVoiceMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/student-voice$/);
      if (request.method === "PATCH" && studentVoiceMatch) {
        requirePermission(role, "updateStudentVoice");
        const meetingId = decodeURIComponent(studentVoiceMatch[1]);
        const body = await readJson(request);
        const studentVoice = String(body.studentVoice || "").trim();
        if (!studentVoice) throw badRequest("Student voice text is required.");
        const result = await store.mutate(
          (workspace) => {
            let updatedMeeting;
            workspace.meetings = (workspace.meetings || []).map((meeting) => {
              if (meeting.id !== meetingId) return meeting;
              requireStudentAccess(user, meeting.studentId);
              updatedMeeting = {
                ...meeting,
                studentVoice,
                studentVoiceUpdatedBy: actor,
                studentVoiceUpdatedAt: new Date().toISOString()
              };
              return updatedMeeting;
            });
            if (!updatedMeeting) throw notFound("Meeting not found.");
            return updatedMeeting;
          },
          {
            type: "Meeting preparation",
            title: "Student voice updated",
            detail: "A student-facing pre-meeting reflection was updated for team review.",
            actor,
            role,
            subjectId: meetingId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const selfAdvocacyMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/self-advocacy$/);
      if (request.method === "PATCH" && selfAdvocacyMatch) {
        requirePermission(role, "updateSelfAdvocacy");
        const meetingId = decodeURIComponent(selfAdvocacyMatch[1]);
        const body = await readJson(request);
        const preferredSupport = requiredString(body.preferredSupport, "Preferred support");
        const participationGoal = requiredString(body.participationGoal, "Participation goal");
        const requestScript = requiredString(body.requestScript, "Request script");
        const confidence = normalizeConfidence(body.confidence);
        const barrier = requiredString(body.barrier, "Self-advocacy barrier");
        const nextStep = requiredString(body.nextStep, "Self-advocacy next step");
        const updatedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updatedMeeting;
            workspace.meetings = (workspace.meetings || []).map((meeting) => {
              if (meeting.id !== meetingId) return meeting;
              requireStudentAccess(user, meeting.studentId);
              updatedMeeting = {
                ...meeting,
                selfAdvocacyPlan: {
                  ...(meeting.selfAdvocacyPlan || {}),
                  preferredSupport,
                  participationGoal,
                  requestScript,
                  confidence,
                  barrier,
                  nextStep,
                  sourceReference: meeting.selfAdvocacyPlan?.sourceReference || "Student strengths and self-advocacy agenda item",
                  sourceAlignment: meeting.selfAdvocacyPlan?.sourceAlignment || sourceAlignmentForWorkspace(workspace),
                  updatedBy: actor,
                  updatedByRole: role,
                  updatedAt
                }
              };
              return updatedMeeting;
            });
            if (!updatedMeeting) throw notFound("Meeting not found.");
            return updatedMeeting.selfAdvocacyPlan;
          },
          {
            type: "Meeting preparation",
            title: "Self-advocacy plan updated",
            detail: "A student-facing self-advocacy preparation plan was updated for team review.",
            actor,
            role,
            subjectId: meetingId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const participantMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/participants\/([^/]+)$/);
      if (request.method === "PATCH" && participantMatch) {
        requirePermission(role, "coordinateParticipants");
        const meetingId = decodeURIComponent(participantMatch[1]);
        const participantId = decodeURIComponent(participantMatch[2]);
        const body = await readJson(request);
        const status = normalizeParticipantStatus(body.status);
        const mode = normalizeParticipantMode(body.mode);
        const note = requiredString(body.note, "Participant note");
        const updatedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.meetings = (workspace.meetings || []).map((meeting) => {
              if (meeting.id !== meetingId) return meeting;
              requireStudentAccess(user, meeting.studentId);
              return {
                ...meeting,
                requiredParticipants: (meeting.requiredParticipants || []).map((participant) => {
                  if (participant.id !== participantId) return participant;
                  updated = {
                    ...participant,
                    status,
                    mode,
                    note,
                    confirmedBy: actor,
                    confirmedByRole: role,
                    confirmedAt: updatedAt
                  };
                  return updated;
                })
              };
            });
            if (!updated) throw notFound("Meeting participant not found.");
            return updated;
          },
          {
            type: "Meeting preparation",
            title: "Participant readiness updated",
            detail: `${status} recorded for ${participantId} with ${mode}.`,
            actor,
            role,
            subjectId: participantId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const companionDocumentMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/companion-documents\/([^/]+)$/);
      if (request.method === "PATCH" && companionDocumentMatch) {
        requirePermission(role, "coordinateCompanionDocuments");
        const meetingId = decodeURIComponent(companionDocumentMatch[1]);
        const documentId = decodeURIComponent(companionDocumentMatch[2]);
        const body = await readJson(request);
        const status = normalizeCompanionDocumentStatus(body.status);
        const owner = requiredString(body.owner, "Companion document owner");
        const dueDate = String(body.dueDate || "").trim();
        const note = requiredString(body.note, "Companion document note");
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.meetings = (workspace.meetings || []).map((meeting) => {
              if (meeting.id !== meetingId) return meeting;
              requireStudentAccess(user, meeting.studentId);
              return {
                ...meeting,
                companionDocuments: (meeting.companionDocuments || []).map((document) => {
                  if (document.id !== documentId) return document;
                  updated = {
                    ...document,
                    status,
                    owner,
                    dueDate,
                    note,
                    reviewedBy: actor,
                    reviewedByRole: role,
                    reviewedAt
                  };
                  return updated;
                })
              };
            });
            if (!updated) throw notFound("Companion document not found.");
            return updated;
          },
          {
            type: "Meeting preparation",
            title: "Companion document readiness updated",
            detail: `${status} recorded for ${documentId}.`,
            actor,
            role,
            subjectId: documentId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const familyResourceMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/family-resources\/([^/]+)$/);
      if (request.method === "PATCH" && familyResourceMatch) {
        requirePermission(role, "coordinateFamilyResources");
        const meetingId = decodeURIComponent(familyResourceMatch[1]);
        const resourceId = decodeURIComponent(familyResourceMatch[2]);
        const body = await readJson(request);
        const status = normalizeFamilyResourceStatus(body.status);
        const owner = requiredString(body.owner, "Family resource owner");
        const dueDate = String(body.dueDate || "").trim();
        const note = requiredString(body.note, "Family resource note");
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.meetings = (workspace.meetings || []).map((meeting) => {
              if (meeting.id !== meetingId) return meeting;
              requireStudentAccess(user, meeting.studentId);
              return {
                ...meeting,
                familyResources: (meeting.familyResources || []).map((resource) => {
                  if (resource.id !== resourceId) return resource;
                  updated = {
                    ...resource,
                    status,
                    owner,
                    dueDate,
                    note,
                    sourceAlignment: resource.sourceAlignment || sourceAlignmentForWorkspace(workspace),
                    reviewedBy: actor,
                    reviewedByRole: role,
                    reviewedAt
                  };
                  return updated;
                })
              };
            });
            if (!updated) throw notFound("Family resource not found.");
            return updated;
          },
          {
            type: "Meeting preparation",
            title: "Family resource guide updated",
            detail: `${status} recorded for ${resourceId}.`,
            actor,
            role,
            subjectId: resourceId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const familyResourceResponseMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/family-resources\/([^/]+)\/response$/);
      if (request.method === "PATCH" && familyResourceResponseMatch) {
        requirePermission(role, "acknowledgeFamilyResource");
        const meetingId = decodeURIComponent(familyResourceResponseMatch[1]);
        const resourceId = decodeURIComponent(familyResourceResponseMatch[2]);
        const body = await readJson(request);
        const status = normalizeFamilyResourceResponseStatus(body.status);
        const note = requiredString(body.note, "Family resource response note");
        const acknowledgedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.meetings = (workspace.meetings || []).map((meeting) => {
              if (meeting.id !== meetingId) return meeting;
              requireStudentAccess(user, meeting.studentId);
              return {
                ...meeting,
                familyResources: (meeting.familyResources || []).map((resource) => {
                  if (resource.id !== resourceId) return resource;
                  if (!familyResourceMatchesRole(role, resource)) {
                    throw forbidden("User cannot respond to this family resource item.");
                  }
                  updated = {
                    ...resource,
                    familyStatus: status,
                    familyNote: note,
                    sourceAlignment: resource.sourceAlignment || sourceAlignmentForWorkspace(workspace),
                    acknowledgedBy: actor,
                    acknowledgedByRole: role,
                    acknowledgedAt
                  };
                  return updated;
                })
              };
            });
            if (!updated) throw notFound("Family resource not found.");
            return updated;
          },
          {
            type: "Meeting preparation",
            title: "Family resource response recorded",
            detail: `${actor} recorded ${status} for ${resourceId}.`,
            actor,
            role,
            subjectId: resourceId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const calendarHoldMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/calendar-holds$/);
      if (request.method === "POST" && calendarHoldMatch) {
        requirePermission(role, "syncCalendar");
        const meetingId = decodeURIComponent(calendarHoldMatch[1]);
        const body = await readJson(request);
        const provider = normalizeCalendarProvider(body.provider);
        const attendanceMode = normalizeCalendarAttendanceMode(body.attendanceMode);
        const note = requiredString(body.note, "Calendar hold note");
        const createdAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const meeting = (workspace.meetings || []).find((item) => item.id === meetingId);
            if (!meeting) throw notFound("Meeting not found.");
            requireStudentAccess(user, meeting.studentId);
            const title = `${studentName(workspace, meeting.studentId)} - ${meeting.type}`;
            const calendarEvent = {
              id: `calendar-${randomUUID()}`,
              meetingId,
              studentId: meeting.studentId,
              title,
              startDate: meeting.date,
              startTime: meeting.time,
              provider,
              attendanceMode,
              status: "Hold created",
              calendarUid: `iep-${meetingId}-${randomUUID()}@riverbend-demo`,
              attendees: meetingParticipants(meeting).map((participant) => participant.role),
              note,
              createdBy: actor,
              createdByRole: role,
              createdAt,
              sourceReference: "Meeting invitation and required participant readiness",
              sourceAlignment: sourceAlignmentForWorkspace(workspace)
            };
            workspace.calendarEvents = [calendarEvent, ...(workspace.calendarEvents || [])];
            return calendarEvent;
          },
          {
            type: "Meeting preparation",
            title: "Calendar hold created",
            detail: `${meetingId} calendar hold recorded through ${provider}.`,
            actor,
            role,
            subjectId: meetingId
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const meetingTranscriptSummaryMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/transcript-summaries$/);
      if (request.method === "POST" && meetingTranscriptSummaryMatch) {
        requirePermission(role, "summarizeMeetingTranscript");
        const meetingId = decodeURIComponent(meetingTranscriptSummaryMatch[1]);
        const body = await readJson(request);
        const transcriptSource = requiredString(body.transcriptSource || "Meeting transcript or recap notes", "Transcript source");
        const transcriptExcerpt = requiredString(body.transcriptExcerpt, "Transcript excerpt");
        const summary = requiredString(body.summary, "Transcript recap summary");
        const decisions = splitRegistryList(body.decisions, ["No official IEP decisions recorded in this recap."]);
        const followUps = splitRegistryList(body.followUps, ["Review transcript recap with the IEP team."]);
        const status = normalizeMeetingTranscriptStatus(body.status);
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const meeting = (workspace.meetings || []).find((item) => item.id === meetingId);
            if (!meeting) throw notFound("Meeting not found.");
            requireStudentAccess(user, meeting.studentId);
            const transcriptSummary = {
              id: `transcript-summary-${randomUUID()}`,
              meetingId,
              studentId: meeting.studentId,
              transcriptSource,
              transcriptExcerpt,
              summary,
              decisions,
              followUps,
              familyVisible: Boolean(body.familyVisible),
              studentVisible: Boolean(body.studentVisible),
              status,
              reviewedBy: actor,
              reviewedByRole: role,
              reviewedAt,
              sourceReference: "Meeting transcript or recap notes",
              sourceAlignment: sourceAlignmentForWorkspace(workspace),
              officialRecordImpact:
                "Transcript summary is a meeting-prep recap only; it does not amend the official IEP or replace team decisions."
            };
            transcriptSummary.transcriptDigest = createMeetingTranscriptDigest({ transcriptSummary, actor, role });
            workspace.meetingTranscriptSummaries = [
              transcriptSummary,
              ...(workspace.meetingTranscriptSummaries || [])
            ];
            return transcriptSummary;
          },
          {
            type: "Meeting recap",
            title: "Meeting transcript summary recorded",
            detail: "A human-reviewed meeting transcript recap was saved with source traceability and official-record guardrails.",
            actor,
            role,
            subjectId: meetingId
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const meetingRecordingReviewMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/recording-reviews$/);
      if (request.method === "POST" && meetingRecordingReviewMatch) {
        requirePermission(role, "summarizeMeetingTranscript");
        const meetingId = decodeURIComponent(meetingRecordingReviewMatch[1]);
        const body = await readJson(request);
        const recordingSource = normalizeMeetingRecordingSource(body.recordingSource);
        const status = normalizeMeetingRecordingStatus(body.status);
        const participantConsentSummary = requiredString(body.participantConsentSummary, "Participant consent summary");
        const transcriptHandlingPlan = requiredString(body.transcriptHandlingPlan, "Transcript handling plan");
        const storageLocation = requiredString(body.storageLocation, "Recording storage location");
        const retentionBoundary = requiredString(body.retentionBoundary, "Recording retention boundary");
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const meeting = (workspace.meetings || []).find((item) => item.id === meetingId);
            if (!meeting) throw notFound("Meeting not found.");
            requireStudentAccess(user, meeting.studentId);
            const recordingReview = {
              id: `meeting-recording-review-${randomUUID()}`,
              meetingId,
              studentId: meeting.studentId,
              recordingSource,
              status,
              participantConsentSummary,
              transcriptHandlingPlan,
              storageLocation,
              retentionBoundary,
              familyVisible: Boolean(body.familyVisible),
              studentVisible: Boolean(body.studentVisible),
              reviewedBy: actor,
              reviewedByRole: role,
              reviewedAt,
              sourceReference: "Meeting recording/transcript source readiness",
              sourceAlignment: sourceAlignmentForWorkspace(workspace),
              officialRecordImpact:
                "Recording readiness review documents local consent and transcript-source handling only; it does not create a recording, replace consent, or amend the official IEP."
            };
            recordingReview.recordingReviewDigest = createMeetingRecordingReviewDigest({ recordingReview, actor, role });
            workspace.meetingRecordingReviews = [
              recordingReview,
              ...(workspace.meetingRecordingReviews || [])
            ];
            return recordingReview;
          },
          {
            type: "Meeting recording readiness",
            title: "Meeting recording readiness recorded",
            detail: "A meeting recording/transcript source readiness review was saved before transcript recap use.",
            actor,
            role,
            subjectId: meetingId
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const staffContinuityMatch = url.pathname.match(/^\/api\/staff-continuity\/([^/]+)$/);
      if (request.method === "PATCH" && staffContinuityMatch) {
        requirePermission(role, "updateStaffContinuity");
        const continuityId = decodeURIComponent(staffContinuityMatch[1]);
        const body = await readJson(request);
        const status = normalizeStaffContinuityStatus(body.status);
        const riskLevel = normalizeStaffContinuityRisk(body.riskLevel);
        const coverageOwner = requiredString(body.coverageOwner, "Coverage owner");
        const nextReviewDate = requiredString(body.nextReviewDate, "Next continuity review date");
        const coveragePlan = requiredString(body.coveragePlan, "Coverage plan");
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.staffContinuity = (workspace.staffContinuity || []).map((record) => {
              if (record.id !== continuityId) return record;
              for (const studentId of record.affectedStudentIds || []) {
                requireStudentAccess(user, studentId);
              }
              updated = {
                ...record,
                status,
                riskLevel,
                coverageOwner,
                nextReviewDate,
                coveragePlan,
                sourceAlignment: record.sourceAlignment || sourceAlignmentForWorkspace(workspace),
                reviewedBy: actor,
                reviewedByRole: role,
                reviewedAt
              };
              return updated;
            });
            if (!updated) throw notFound("Staff continuity record not found.");
            return updated;
          },
          {
            type: "Leadership oversight",
            title: "Staff continuity plan updated",
            detail: `${riskLevel} continuity risk recorded for ${continuityId} with ${coverageOwner} as owner.`,
            actor,
            role,
            subjectId: continuityId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const languageAccessMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/language-access$/);
      if (request.method === "PATCH" && languageAccessMatch) {
        if (!hasPermission(role, "requestLanguageAccess") && !hasPermission(role, "coordinateLanguageAccess")) {
          requirePermission(role, "requestLanguageAccess");
        }
        const meetingId = decodeURIComponent(languageAccessMatch[1]);
        const body = await readJson(request);
        const canCoordinate = hasPermission(role, "coordinateLanguageAccess");
        const preferredLanguage = normalizeLanguage(body.preferredLanguage);
        const interpreterNeeded = Boolean(body.interpreterNeeded);
        const requestNote = String(body.requestNote || "").trim();
        const coordinatorNote = String(body.coordinatorNote || "").trim();
        const now = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updatedMeeting;
            workspace.meetings = (workspace.meetings || []).map((meeting) => {
              if (meeting.id !== meetingId) return meeting;
              requireStudentAccess(user, meeting.studentId);
              const current = meeting.languageAccess || defaultLanguageAccess();
              const next = {
                ...current,
                preferredLanguage,
                interpreterNeeded,
                requestNote: requestNote || current.requestNote || "",
                requestedBy: current.requestedBy || actor,
                requestedAt: current.requestedAt || now,
                translatedSummary:
                  preferredLanguage === "English"
                    ? null
                    : languageAccessDraft(preferredLanguage, workspace.summaries?.parent),
                glossary: current.glossary || defaultLanguageAccess().glossary
              };
              if (canCoordinate) {
                next.translationStatus = String(body.translationStatus || next.translationStatus || "Requested");
                next.interpreterStatus = String(
                  body.interpreterStatus || next.interpreterStatus || (interpreterNeeded ? "Requested" : "Not needed")
                );
                next.coordinatorNote = coordinatorNote || next.coordinatorNote || "Language support coordination updated.";
                next.coordinatedBy = actor;
                next.coordinatedAt = now;
              } else {
                next.translationStatus = preferredLanguage === "English" ? "Not needed" : "Requested";
                next.interpreterStatus = interpreterNeeded ? "Requested" : "Not needed";
                next.coordinatorNote = current.coordinatorNote || "Language support request is awaiting staff coordination.";
                next.requestedBy = actor;
                next.requestedAt = now;
              }
              updatedMeeting = { ...meeting, languageAccess: next };
              return updatedMeeting;
            });
            if (!updatedMeeting) throw notFound("Meeting not found.");
            return updatedMeeting.languageAccess;
          },
          {
            type: "Language access",
            title: canCoordinate ? "Language access coordinated" : "Language access requested",
            detail: canCoordinate
              ? "A staff member updated translation or interpreter coordination status."
              : "A family or student language support request was recorded for the meeting.",
            actor,
            role,
            subjectId: meetingId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const glossaryTermMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/language-access\/glossary\/([^/]+)$/);
      if (request.method === "PATCH" && glossaryTermMatch) {
        if (!hasPermission(role, "requestLanguageAccess") && !hasPermission(role, "coordinateLanguageAccess")) {
          requirePermission(role, "requestLanguageAccess");
        }
        const meetingId = decodeURIComponent(glossaryTermMatch[1]);
        const termId = decodeURIComponent(glossaryTermMatch[2]);
        const body = await readJson(request);
        const coordinate = Boolean(body.coordinate) && hasPermission(role, "coordinateLanguageAccess");
        if (Boolean(body.coordinate) && !coordinate) {
          requirePermission(role, "coordinateLanguageAccess");
        }
        const note = String(body.note || "").trim();
        const staffResponse = String(body.response || "").trim();
        if (note.length > 800 || staffResponse.length > 800) {
          throw badRequest("Glossary notes must be 800 characters or fewer.");
        }
        const clarityStatus = normalizeGlossaryClarityStatus(body.status);
        const responseStatus = normalizeGlossaryResponseStatus(body.responseStatus);
        const now = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updatedTerm;
            workspace.meetings = (workspace.meetings || []).map((meeting) => {
              if (meeting.id !== meetingId) return meeting;
              requireStudentAccess(user, meeting.studentId);
              const current = meeting.languageAccess || defaultLanguageAccess();
              const glossary = normalizeGlossaryItems(current.glossary, workspace).map((item) => {
                if (item.id !== termId) return item;
                updatedTerm = coordinate
                  ? {
                      ...item,
                      staffResponseStatus: responseStatus,
                      staffResponse,
                      staffRespondedBy: actor,
                      staffRespondedByRole: role,
                      staffRespondedAt: now,
                      sourceAlignment: item.sourceAlignment || sourceAlignmentForWorkspace(workspace)
                    }
                  : {
                      ...item,
                      clarityStatus,
                      clarityNote: note,
                      clarityRequestedBy: actor,
                      clarityRequestedByRole: role,
                      clarityRequestedAt: now,
                      sourceAlignment: item.sourceAlignment || sourceAlignmentForWorkspace(workspace)
                    };
                return updatedTerm;
              });
              return { ...meeting, languageAccess: { ...current, glossary } };
            });
            if (!updatedTerm) throw notFound("Glossary term not found.");
            return updatedTerm;
          },
          {
            type: "Language access",
            title: coordinate ? "Glossary explanation recorded" : "Glossary clarification requested",
            detail: coordinate
              ? "A staff response was recorded for a plain-language glossary term."
              : "A family or student glossary clarification request was recorded.",
            actor,
            role,
            subjectId: termId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const concernListMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/concerns$/);
      if (request.method === "POST" && concernListMatch) {
        requirePermission(role, "submitConcern");
        const meetingId = decodeURIComponent(concernListMatch[1]);
        const body = await readJson(request);
        const title = String(body.title || "").trim();
        const concernText = String(body.concern || "").trim();
        if (!title || !concernText) throw badRequest("Concern title and detail are required.");
        const concern = {
          id: `concern-${randomUUID()}`,
          title,
          concern: concernText,
          status: "Open",
          submittedBy: actor,
          submittedByRole: role,
          submittedAt: new Date().toISOString(),
          owner: "IEP team",
          response: "",
          decision: "",
          nextStep: "Team response pending.",
          priorWrittenNotice:
            "Review if the response proposes or refuses a change to identification, evaluation, placement, or FAPE."
        };
        const result = await store.mutate(
          (workspace) => {
            let updatedMeeting;
            workspace.meetings = (workspace.meetings || []).map((meeting) => {
              if (meeting.id !== meetingId) return meeting;
              requireStudentAccess(user, meeting.studentId);
              updatedMeeting = {
                ...meeting,
                concerns: [concern, ...(meeting.concerns || [])]
              };
              return updatedMeeting;
            });
            if (!updatedMeeting) throw notFound("Meeting not found.");
            return concern;
          },
          {
            type: "Concern submitted",
            title: "Meeting concern logged",
            detail: "A parent, student, or staff concern was added to the early-resolution record.",
            actor,
            role,
            subjectId: concern.id
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const concernMatch = url.pathname.match(/^\/api\/meetings\/concerns\/([^/]+)$/);
      if (request.method === "PATCH" && concernMatch) {
        requirePermission(role, "resolveConcern");
        const concernId = decodeURIComponent(concernMatch[1]);
        const body = await readJson(request);
        const responseText = String(body.response || "").trim();
        const decision = String(body.decision || "").trim();
        const nextStep = String(body.nextStep || "").trim();
        if (!responseText || !decision || !nextStep) {
          throw badRequest("Response, decision, and next step are required.");
        }
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.meetings = (workspace.meetings || []).map((meeting) => ({
              ...meeting,
              concerns: (meeting.concerns || []).map((concern) => {
                if (concern.id !== concernId) return concern;
                requireStudentAccess(user, meeting.studentId);
                updated = {
                  ...concern,
                  status: "Resolved",
                  response: responseText,
                  decision,
                  nextStep,
                  priorWrittenNotice:
                    String(body.priorWrittenNotice || "").trim() ||
                    "Review if the response proposes or refuses a change to identification, evaluation, placement, or FAPE.",
                  resolvedBy: actor,
                  resolvedAt: new Date().toISOString()
                };
                return updated;
              })
            }));
            if (!updated) throw notFound("Concern not found.");
            return updated;
          },
          {
            type: "Concern resolved",
            title: "Decision record updated",
            detail: "A staff response and next step were recorded for a meeting concern.",
            actor,
            role,
            subjectId: concernId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const draftDiffMatch = url.pathname.match(/^\/api\/meetings\/draft-diffs\/([^/]+)$/);
      if (request.method === "PATCH" && draftDiffMatch) {
        requirePermission(role, "finalizeDraftDiff");
        const diffId = decodeURIComponent(draftDiffMatch[1]);
        const body = await readJson(request);
        const finalText = String(body.finalText || "").trim();
        const decisionRationale = String(body.decisionRationale || "").trim();
        if (!finalText || !decisionRationale) {
          throw badRequest("Final language and decision rationale are required.");
        }
        const finalizedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            let updated;
            workspace.meetings = (workspace.meetings || []).map((meeting) => ({
              ...meeting,
              draftDiffs: (meeting.draftDiffs || []).map((diff) => {
                if (diff.id !== diffId) return diff;
                requireStudentAccess(user, meeting.studentId);
                updated = {
                  ...diff,
                  status: "Finalized",
                  finalText,
                  decisionRationale,
                  finalizedBy: actor,
                  finalizedByRole: role,
                  finalizedAt
                };
                return updated;
              })
            }));
            if (!updated) throw notFound("Draft change not found.");
            return updated;
          },
          {
            type: "Meeting preparation",
            title: "Draft-to-final decision recorded",
            detail: "A proposed meeting change was resolved with final language and rationale.",
            actor,
            role,
            subjectId: diffId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/drafts") {
        requirePermission(role, "generateDraft");
        const body = await readJson(request);
        const createdAt = new Date().toISOString();
        const guidedResponses = normalizeDraftGuidedResponses(body.guidedResponses);
        const annotatedSample = String(body.annotatedSample || "").trim();
        const draft = {
          id: `draft-${randomUUID()}`,
          profile: body.profile || "",
          guidedResponses,
          annotatedSample,
          status: "Draft - human review required",
          createdBy: actor,
          createdByRole: role,
          createdAt,
          sections: draftSeedSections(body.profile || "", guidedResponses, annotatedSample).map((section) => ({
            ...section,
            status: "Draft - human review required",
            version: 1,
            versionHistory: []
          }))
        };
        const result = await store.mutate(
          (workspace) => {
            workspace.draft = draft;
            return draft;
          },
          {
            type: "Draft generated",
            title: "Training draft generated",
            detail: "A fictional or draft IEP section set was generated and labeled for human review.",
            actor,
            role,
            subjectId: draft.id
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      const draftApproveMatch = url.pathname.match(/^\/api\/drafts\/([^/]+)\/approve$/);
      if (request.method === "POST" && draftApproveMatch) {
        requirePermission(role, "approveDraft");
        const draftId = decodeURIComponent(draftApproveMatch[1]);
        const approvedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            if (workspace.draft?.id !== draftId) throw notFound("Draft not found.");
            workspace.draft = {
              ...workspace.draft,
              status: "Approved for export",
              approvedBy: actor,
              approvedByRole: role,
              approvedAt
            };
            return workspace.draft;
          },
          {
            type: "Human review",
            title: "Draft package approved",
            detail: "A qualified user approved the draft section package for export.",
            actor,
            role,
            subjectId: draftId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const draftSectionRegenerateMatch = url.pathname.match(/^\/api\/drafts\/([^/]+)\/sections\/([^/]+)\/regenerate$/);
      if (request.method === "POST" && draftSectionRegenerateMatch) {
        requirePermission(role, "reviseDraft");
        const draftId = decodeURIComponent(draftSectionRegenerateMatch[1]);
        const sectionId = decodeURIComponent(draftSectionRegenerateMatch[2]);
        const body = await readJson(request);
        const regeneratedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            if (workspace.draft?.id !== draftId) throw notFound("Draft not found.");
            let updated = null;
            workspace.draft = {
              ...workspace.draft,
              status: "Regenerated - human review required",
              approvedBy: null,
              approvedByRole: null,
              approvedAt: null,
              sections: (workspace.draft.sections || []).map((section) => {
                if (draftSectionKey(section) !== sectionId) return section;
                updated = regenerateDraftSection(section, workspace.draft.profile, body, { name: actor, role }, regeneratedAt);
                return updated;
              })
            };
            if (!updated) throw notFound("Draft section not found.");
            return updated;
          },
          {
            type: "Draft review",
            title: "Draft section regenerated",
            detail: "A draft IEP section was regenerated from reviewer guidance and prior language was preserved.",
            actor,
            role,
            subjectId: sectionId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const draftSectionMatch = url.pathname.match(/^\/api\/drafts\/([^/]+)\/sections\/([^/]+)$/);
      if (request.method === "PATCH" && draftSectionMatch) {
        requirePermission(role, "reviseDraft");
        const draftId = decodeURIComponent(draftSectionMatch[1]);
        const sectionId = decodeURIComponent(draftSectionMatch[2]);
        const body = await readJson(request);
        if (!String(body.content || "").trim()) throw badRequest("Revised draft text is required.");
        const revisedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            if (workspace.draft?.id !== draftId) throw notFound("Draft not found.");
            let updated = null;
            workspace.draft = {
              ...workspace.draft,
              status: "Revised - human review required",
              approvedBy: null,
              approvedByRole: null,
              approvedAt: null,
              sections: (workspace.draft.sections || []).map((section) => {
                if (draftSectionKey(section) !== sectionId) return section;
                updated = reviseDraftSection(section, body, { name: actor, role }, revisedAt);
                return updated;
              })
            };
            if (!updated) throw notFound("Draft section not found.");
            return updated;
          },
          {
            type: "Draft review",
            title: "Draft section revised",
            detail: "A draft IEP section was edited by an authorized reviewer and prior language was preserved.",
            actor,
            role,
            subjectId: sectionId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      const reminderReviewMatch = url.pathname.match(/^\/api\/reminders\/([^/]+)\/review$/);
      if (request.method === "POST" && reminderReviewMatch) {
        requirePermission(role, "reviewReminder");
        const reminderId = decodeURIComponent(reminderReviewMatch[1]);
        const body = await readJson(request);
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const studentId = body.studentId || workspace.currentStudentId;
            if (studentId) requireStudentAccess(user, studentId);
            const review = {
              id: `reminder-review-${randomUUID()}`,
              reminderId,
              title: String(body.title || "Implementation reminder").trim(),
              studentId,
              reviewedBy: actor,
              reviewedByUserId: user.id,
              reviewedByRole: role,
              reviewedAt,
              note: String(body.note || "").trim() || "Marked reviewed from the reminder center."
            };
            workspace.reminderReviews = [
              review,
              ...(workspace.reminderReviews || []).filter(
                (item) => !(item.reminderId === reminderId && item.reviewedByUserId === user.id)
              )
            ];
            return review;
          },
          {
            type: "Reminder reviewed",
            title: "Implementation reminder reviewed",
            detail: `${body.title || "Implementation reminder"} was marked reviewed by ${actor}.`,
            actor,
            role,
            subjectId: reminderId
          }
        );
        await sendJson(response, 200, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/notifications") {
        requirePermission(role, "sendNotification");
        const body = await readJson(request);
        const studentId = body.studentId || "student-001";
        requireStudentAccess(user, studentId);
        const audience = normalizeNotificationAudience(body.audience);
        const channel = normalizeNotificationChannel(body.channel);
        const sourceTitle = requiredString(body.sourceTitle, "Notification source title");
        const message = requiredString(body.message, "Notification message");
        const sentAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            requireStudentAccess(user, studentId);
            const delivery = {
              id: `notification-${randomUUID()}`,
              studentId,
              sourceId: String(body.sourceId || "manual-notice").trim(),
              sourceType: String(body.sourceType || "Implementation reminder").trim(),
              sourceTitle,
              audience,
              channel,
              status: "Sent",
              message,
              sentBy: actor,
              sentByRole: role,
              sentAt,
              deliveryNote:
                "Demo delivery recorded in the workspace; production delivery requires district-approved communication channels.",
              sourceAlignment: sourceAlignmentForWorkspace(workspace)
            };
            workspace.notificationDeliveries = [delivery, ...(workspace.notificationDeliveries || [])];
            return delivery;
          },
          {
            type: "Notification delivery",
            title: "Notification sent",
            detail: `${sourceTitle} notice sent to ${notificationAudienceLabel(audience)} by ${actor}.`,
            actor,
            role,
            subjectId: body.sourceId || "manual-notice"
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/exports") {
        requirePermission(role, "export");
        const body = await readJson(request);
        ensureDraftExportApproved(body);
        const exportId = `export-${randomUUID()}`;
        const createdAt = new Date().toISOString();
        const workspace = await store.init();
        const payload = isDistrictSystemExport(body)
          ? createDistrictSystemExportPayload(body.payload, workspace, user, createdAt)
          : body.payload ?? null;
        const artifact = createExportArtifact({
          id: exportId,
          label: body.label || "Structured export",
          format: body.format || "json",
          payload,
          createdAt
        });
        const storedArtifact = await store.saveExportFile(exportId, artifact.fileName, artifact.buffer);
        const exportRecord = {
          id: exportId,
          label: body.label || "Structured export",
          createdAt,
          format: artifact.format,
          payloadSummary: artifact.summary,
          artifact: {
            fileName: artifact.fileName,
            mimeType: artifact.mimeType,
            ...storedArtifact
          },
          downloadUrl: `/api/exports/${exportId}/download`
        };
        const result = await store.mutate(
          (workspace) => {
            workspace.exports = [exportRecord, ...(workspace.exports || [])];
            return exportRecord;
          },
          {
            type: "Export generated",
            title: `${exportRecord.label} exported`,
            detail: "An authorized user generated a structured workspace export.",
            actor,
            role,
            subjectId: exportRecord.id
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/exports/template-reviews") {
        requirePermission(role, "reviewExportTemplates");
        const body = await readJson(request);
        const targetSystem = requiredString(body.targetSystem, "Target system");
        const templateName = requiredString(body.templateName, "Template name");
        const templateVersion = requiredString(body.templateVersion, "Template version");
        const validationStatus = normalizeExportTemplateValidationStatus(body.validationStatus);
        const mappingStatus = normalizeExportTemplateMappingStatus(body.mappingStatus);
        const submissionMode = normalizeExportTemplateSubmissionMode(body.submissionMode);
        const mappingEvidence = requiredString(body.mappingEvidence, "Mapping evidence");
        const validationEvidence = requiredString(body.validationEvidence, "Validation evidence");
        const reviewNote = requiredString(body.reviewNote, "Review note");
        const nextReviewDate = String(body.nextReviewDate || "").trim();
        const reviewedAt = new Date().toISOString();
        const result = await store.mutate(
          (workspace) => {
            const exportRecord =
              (workspace.exports || []).find((item) => item.id === body.exportId) ||
              (workspace.exports || []).find((item) => /district system package/i.test(item.label || ""));
            if (!exportRecord) {
              throw badRequest("Generate a district system package before recording an export template review.");
            }
            if (!/district system package/i.test(exportRecord.label || "")) {
              throw badRequest("Export template review must reference a district system package export.");
            }
            const requiredSections = Number(body.requiredSections || schemaSections.length);
            const mappedSections = Number(body.mappedSections || requiredSections);
            const review = {
              id: `export-template-review-${randomUUID()}`,
              exportId: exportRecord.id,
              targetSystem,
              templateName,
              templateVersion,
              format: String(body.format || exportRecord.format || "json").trim(),
              validationStatus,
              mappingStatus,
              submissionMode,
              requiredSections,
              mappedSections,
              mappingEvidence,
              validationEvidence,
              reviewNote,
              packageFileName: exportRecord.artifact?.fileName || "",
              packageSha256: exportRecord.artifact?.sha256 || "",
              downloadUrl: exportRecord.downloadUrl || "",
              reviewedBy: actor,
              reviewedByRole: role,
              reviewedByUserId: user.id,
              reviewedAt,
              nextReviewDate,
              productionBoundary:
                "This review records local export-template readiness only; it does not submit to a district system or certify production import compatibility."
            };
            review.templateDigest = createExportTemplateReviewDigest(review, workspace.districtConfiguration || {});
            workspace.exportTemplateReviews = [review, ...(workspace.exportTemplateReviews || [])];
            return review;
          },
          {
            type: "Export governance",
            title: "Export template reviewed",
            detail: `${templateName} mapping reviewed for ${targetSystem}.`,
            actor,
            role,
            subjectId: templateVersion
          }
        );
        await sendJson(response, 201, mutationPayload(result, user));
        return;
      }

      await sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      await sendJson(response, error.status || 500, {
        error: error.code || "SERVER_ERROR",
        message: error.message || "Unexpected server error"
      });
    }
  });
}

export async function startServer({ port = process.env.PORT || 8787, store, auth, enableTestReset = false } = {}) {
  const server = createApiServer({ store, auth, enableTestReset });
  await new Promise((resolve) => server.listen(port, resolve));
  return server;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function sendJson(response, status, payload) {
  setCors(response);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(payload)}\n`);
}

function sendBuffer(response, status, buffer, headers = {}) {
  setCors(response);
  response.writeHead(status, {
    "content-length": buffer.length,
    ...headers
  });
  response.end(buffer);
}

function setCors(response) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,PATCH,OPTIONS");
  response.setHeader("access-control-allow-headers", "authorization,content-type");
  response.setHeader("access-control-expose-headers", "content-disposition,content-length,content-type");
}

function mutationPayload({ result, workspace }, user) {
  const visibleWorkspace = user ? filterWorkspaceForUser(workspace, user) : workspace;
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return { ...result, workspace: visibleWorkspace };
  }
  return { result, workspace: visibleWorkspace };
}

function workspaceForResponse(workspace, user, auth, session) {
  const visibleWorkspace = filterWorkspaceForUser(workspace, user);
  if (hasPermission(user.role, "manageSecurity")) {
    return {
      ...visibleWorkspace,
      securitySessions: auth.listSessions(),
      currentSecuritySessionId: session.id
    };
  }
  return visibleWorkspace;
}

function createAuditAnchorDigest(anchor) {
  return createHash("sha256")
    .update(JSON.stringify({
      checked: anchor.checked,
      latestHash: anchor.latestHash,
      externalReference: anchor.externalReference,
      note: anchor.note,
      actor: anchor.actor,
      role: anchor.role,
      createdAt: anchor.createdAt
    }))
    .digest("hex");
}

function createExternalTimestampReceipt({ anchor, provider, receiptId, receiptTimestamp, verificationReference, reviewerNote, actor, role, recordedAt }) {
  const receipt = {
    status: "Receipt recorded locally",
    provider,
    receiptId,
    receiptTimestamp,
    verificationReference,
    reviewerNote,
    recordedBy: actor,
    recordedByRole: role,
    recordedAt,
    productionBoundary:
      "This receipt records external timestamp evidence for review; it does not perform notarization or replace district WORM storage."
  };
  return {
    ...receipt,
    receiptDigest: createExternalTimestampReceiptDigest(anchor, receipt)
  };
}

function createExternalTimestampReceiptDigest(anchor, receipt) {
  return createHash("sha256")
    .update(JSON.stringify({
      anchorId: anchor.id,
      anchoredSequence: anchor.anchoredSequence,
      anchoredHash: anchor.anchoredHash,
      anchorDigest: anchor.anchorDigest,
      provider: receipt.provider,
      receiptId: receipt.receiptId,
      receiptTimestamp: receipt.receiptTimestamp,
      verificationReference: receipt.verificationReference,
      reviewerNote: receipt.reviewerNote,
      actor: receipt.recordedBy,
      role: receipt.recordedByRole,
      recordedAt: receipt.recordedAt
    }))
    .digest("hex");
}

function createRetentionPolicyReviewDigest(review, verification = {}) {
  return createHash("sha256")
    .update(JSON.stringify({
      policyScope: review.policyScope,
      policySource: review.policySource,
      disposition: review.disposition,
      retentionPeriod: review.retentionPeriod,
      legalHoldStatus: review.legalHoldStatus,
      archiveDecision: review.archiveDecision,
      evidenceSummary: review.evidenceSummary,
      nextReviewDate: review.nextReviewDate,
      retentionPackageId: review.retentionPackageId,
      anchorId: review.anchorId,
      packageDigest: review.packageDigest,
      anchorDigest: review.anchorDigest,
      auditChecked: verification.checked,
      auditLatestHash: verification.latestHash,
      reviewedByUserId: review.reviewedByUserId,
      reviewedAt: review.reviewedAt
    }))
    .digest("hex");
}

function createIdentityLifecycleReviewDigest(review, posture = {}) {
  return createHash("sha256")
    .update(JSON.stringify({
      districtId: posture.districtId || "local-district",
      identityProvider: review.identityProvider,
      lifecycleStatus: review.lifecycleStatus,
      mfaStatus: review.mfaStatus,
      tenantBoundaryStatus: review.tenantBoundaryStatus,
      roleProvisioningStatus: review.roleProvisioningStatus,
      accountLifecyclePlan: review.accountLifecyclePlan,
      tenantBoundaryEvidence: review.tenantBoundaryEvidence,
      roleProvisioningNote: review.roleProvisioningNote,
      nextReviewDate: review.nextReviewDate,
      reviewedByUserId: review.reviewedByUserId,
      reviewedAt: review.reviewedAt
    }))
    .digest("hex");
}

function createExportTemplateReviewDigest(review, configuration = {}) {
  return createHash("sha256")
    .update(JSON.stringify({
      districtId: configuration.districtId || "local-district",
      exportId: review.exportId,
      packageSha256: review.packageSha256,
      targetSystem: review.targetSystem,
      templateName: review.templateName,
      templateVersion: review.templateVersion,
      format: review.format,
      validationStatus: review.validationStatus,
      mappingStatus: review.mappingStatus,
      submissionMode: review.submissionMode,
      requiredSections: review.requiredSections,
      mappedSections: review.mappedSections,
      mappingEvidence: review.mappingEvidence,
      validationEvidence: review.validationEvidence,
      reviewNote: review.reviewNote,
      reviewedByUserId: review.reviewedByUserId,
      reviewedAt: review.reviewedAt
    }))
    .digest("hex");
}

function createRetentionManifest({ id, workspace, auditEvents, verification, anchor, note, actor, role, createdAt }) {
  const auditEventsThroughAnchor = auditEvents.slice(0, anchor.anchoredSequence);
  const body = {
    id,
    manifestType: "IEP audit retention manifest",
    retentionScope: "Local WORM-style audit evidence package",
    retentionMode: "Write-once local file; production deployments should copy this manifest to district-approved immutable storage.",
    createdAt,
    createdBy: actor,
    createdByRole: role,
    note,
    anchor: {
      id: anchor.id,
      status: anchor.status,
      anchorScope: anchor.anchorScope,
      anchoredSequence: anchor.anchoredSequence,
      anchoredHash: anchor.anchoredHash,
      anchorDigest: anchor.anchorDigest,
      externalReference: anchor.externalReference,
      createdAt: anchor.createdAt,
      verificationStatus: anchor.verificationStatus
    },
    auditVerification: {
      valid: verification.valid,
      checked: verification.checked,
      latestHash: verification.latestHash,
      anchoredHashMatched: auditEventsThroughAnchor[auditEventsThroughAnchor.length - 1]?.hash === anchor.anchoredHash
    },
    evidenceDigests: {
      workspaceSnapshotSha256: sha256Json(workspace),
      auditLogSha256: sha256Json(auditEvents),
      auditLogThroughAnchorSha256: sha256Json(auditEventsThroughAnchor)
    },
    counts: {
      students: (workspace.students || []).length,
      documents: (workspace.documents || []).length,
      extractionSections: (workspace.extractionSections || []).length,
      auditEvents: auditEvents.length,
      auditEventsThroughAnchor: auditEventsThroughAnchor.length,
      exports: (workspace.exports || []).length
    },
    productionCaveat:
      "This local retention manifest supports demo evidence packaging. Production deployments still require district-approved WORM storage, retention schedules, and external timestamping or notarization."
  };
  const packageDigest = sha256Json(body);
  return {
    packageDigest,
    manifest: {
      ...body,
      packageDigest
    }
  };
}

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function summarizeSegments(segments) {
  return (segments || []).map((segment, index) => ({
    id: `source-segment-${index + 1}`,
    label: segment.label,
    excerpt: String(segment.text || "").slice(0, 420),
    pageNumber: segment.pageNumber || segment.locator?.page || null,
    anchorType: segment.anchorType || null,
    locator: segment.locator || null
  }));
}

function studentIdForIep(workspace, iepId) {
  const iep = (workspace.ieps || []).find((item) => item.id === iepId);
  return iep?.studentId || null;
}

function sourceAlignmentForWorkspace(workspace = {}) {
  const registry = workspace.sourceRegistry || {};
  const entries = registry.entries || [];
  const activeEntry = entries.find((entry) => entry.sourceId === registry.activeSourceId) || entries[0];
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

function teamCommentTargetForWorkspace(workspace = {}, body = {}) {
  const studentId = String(body.studentId || "").trim();
  const targetType = normalizeTeamCommentTargetType(body.targetType);
  const targetId = String(body.targetId || "").trim();
  const fallback = {
    targetType,
    targetId: targetId || "workspace",
    targetTitle: String(body.targetTitle || "General IEP workspace update").trim(),
    sourceReference: String(body.sourceReference || "Student workspace collaboration thread").trim()
  };

  const activeIepIds = new Set((workspace.ieps || []).filter((iep) => iep.studentId === studentId).map((iep) => iep.id));
  const matchers = {
    "Implementation task": () => (workspace.tasks || []).find((task) => task.studentId === studentId && task.id === targetId),
    Goal: () => (workspace.goals || []).find((goal) => activeIepIds.has(goal.iepId) && goal.id === targetId),
    Service: () => (workspace.services || []).find((service) => activeIepIds.has(service.iepId) && service.id === targetId),
    Accommodation: () => (workspace.accommodations || []).find((item) => activeIepIds.has(item.iepId) && item.id === targetId),
    Meeting: () => (workspace.meetings || []).find((meeting) => meeting.studentId === studentId && meeting.id === targetId),
    "Review finding": () => (workspace.reviewFlags || []).find((flag) => flag.studentId === studentId && flag.id === targetId)
  };
  const target = matchers[targetType]?.();
  if (!target) return fallback;
  return {
    targetType,
    targetId,
    targetTitle:
      target.title ||
      target.domain ||
      target.serviceType ||
      target.description ||
      target.type ||
      String(body.targetTitle || "IEP workspace item").trim(),
    sourceReference:
      target.sourceReference ||
      target.sourceSection ||
      target.source ||
      String(body.sourceReference || "Student workspace collaboration thread").trim()
  };
}

function normalizeTeamCommentTargetType(value) {
  const targetType = String(value || "General update").trim();
  return ["Implementation task", "Goal", "Service", "Accommodation", "Meeting", "Review finding", "General update"].includes(targetType)
    ? targetType
    : "General update";
}

function normalizeTeamCommentVisibility(value, role) {
  const visibility = String(value || "IEP team").trim();
  const allowed = ["IEP team", "Staff only", "Family visible", "Student visible"];
  if (!allowed.includes(visibility)) return role === "parent" ? "Family visible" : role === "student" ? "Student visible" : "IEP team";
  if ((role === "parent" || role === "student") && visibility === "Staff only") {
    return role === "parent" ? "Family visible" : "Student visible";
  }
  return visibility;
}

function normalizeTeamCommentModerationStatus(value) {
  const status = String(value || "Pending review").trim();
  return ["Pending review", "Approved for IEP team", "Visibility limited", "Needs follow-up", "Archived from family view"].includes(status)
    ? status
    : "Pending review";
}

function normalizeTeamCommentQueueStatus(value) {
  const status = String(value || "Queue reviewed").trim();
  return ["Queue reviewed", "Needs moderation", "Family follow-up needed", "Retention hold", "Ready for archive"].includes(status)
    ? status
    : "Queue reviewed";
}

function normalizeTeamCommentRetentionDecision(value) {
  const decision = String(value || "Retain in audit trail").trim();
  return ["Retain in audit trail", "Retain with staff-only visibility", "Prepare for archive", "Legal hold recommended"].includes(decision)
    ? decision
    : "Retain in audit trail";
}

function normalizeRetentionPolicyScope(value) {
  const scope = String(value || "Audit trail and retention manifests").trim();
  return [
    "IEP implementation workspace",
    "Audit trail and retention manifests",
    "Source documents and extracted records",
    "Exports and district-system packages",
    "Collaboration and notification records"
  ].includes(scope)
    ? scope
    : "Audit trail and retention manifests";
}

function normalizeRetentionPolicyDisposition(value) {
  const disposition = String(value || "Policy reviewed").trim();
  return ["Policy reviewed", "District schedule needed", "Legal hold active", "Archive blocked", "Ready for district approval"].includes(disposition)
    ? disposition
    : "Policy reviewed";
}

function normalizeRetentionLegalHoldStatus(value) {
  const status = String(value || "No hold").trim();
  return ["No hold", "Potential hold", "Legal hold active", "Counsel review needed"].includes(status)
    ? status
    : "No hold";
}

function normalizeRetentionArchiveDecision(value) {
  const decision = String(value || "Retain").trim();
  return ["Retain", "Retain with hold", "Archive eligible", "Archive blocked", "Purge prohibited"].includes(decision)
    ? decision
    : "Retain";
}

function normalizeExportTemplateValidationStatus(value) {
  const status = String(value || "Template review needed").trim();
  return [
    "Template review needed",
    "Mapping validated locally",
    "District import review ready",
    "Blocked - district system needed",
    "Production submission prohibited"
  ].includes(status)
    ? status
    : "Template review needed";
}

function normalizeExportTemplateMappingStatus(value) {
  const status = String(value || "Mapping draft").trim();
  return [
    "Mapping draft",
    "Required sections mapped",
    "Field-level review needed",
    "District schema mismatch",
    "Pilot mapping approved"
  ].includes(status)
    ? status
    : "Mapping draft";
}

function normalizeExportTemplateSubmissionMode(value) {
  const status = String(value || "Local review package only").trim();
  return [
    "Local review package only",
    "District import review",
    "Pilot import queued",
    "Production submission blocked",
    "No live integration"
  ].includes(status)
    ? status
    : "Local review package only";
}

function normalizeIdentityLifecycleStatus(value) {
  const status = String(value || "Needs production identity provider").trim();
  return [
    "Needs production identity provider",
    "Lifecycle review scheduled",
    "SSO mapping in review",
    "MFA policy ready",
    "Production blocked"
  ].includes(status)
    ? status
    : "Needs production identity provider";
}

function normalizeIdentityMfaStatus(value) {
  const status = String(value || "MFA policy required").trim();
  return [
    "Demo password only",
    "MFA policy required",
    "MFA mapping in review",
    "MFA ready for pilot",
    "MFA exception review needed"
  ].includes(status)
    ? status
    : "MFA policy required";
}

function normalizeTenantBoundaryStatus(value) {
  const status = String(value || "Single-district demo tenant").trim();
  return [
    "Single-district demo tenant",
    "Tenant boundary review needed",
    "Cross-tenant access blocked locally",
    "Multi-district isolation design pending",
    "Pilot boundary approved"
  ].includes(status)
    ? status
    : "Single-district demo tenant";
}

function normalizeRoleProvisioningStatus(value) {
  const status = String(value || "Manual demo roles").trim();
  return [
    "Manual demo roles",
    "Role mapping review needed",
    "SIS/IdP mapping drafted",
    "Deprovisioning workflow needed",
    "Pilot provisioning approved"
  ].includes(status)
    ? status
    : "Manual demo roles";
}

function teamCommentQueueSnapshotForWorkspace(workspace = {}, studentId) {
  const comments = (workspace.teamComments || [])
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

function normalizePortalAccessStatus(value) {
  const status = String(value || "Needs guardian verification").trim();
  return [
    "Access verified",
    "Needs guardian verification",
    "Student access limited",
    "Portal access suspended",
    "Language/support follow-up needed"
  ].includes(status)
    ? status
    : "Needs guardian verification";
}

function normalizePortalVerificationMethod(value) {
  const method = String(value || "District portal check").trim();
  return [
    "District portal check",
    "In-person review",
    "Phone confirmation",
    "Student conference",
    "Signed packet review"
  ].includes(method)
    ? method
    : "District portal check";
}

function normalizePortalAccessSubjectRole(value) {
  const subjectRole = String(value || "Parent/Guardian").trim();
  return ["Parent/Guardian", "Student"].includes(subjectRole) ? subjectRole : "Parent/Guardian";
}

function normalizePortalInvitationDelivery(value) {
  const delivery = String(value || "District portal invite").trim();
  return ["District portal invite", "Secure email", "Printed activation packet", "In-person activation"].includes(delivery)
    ? delivery
    : "District portal invite";
}

function normalizePortalInvitationStatus(value) {
  const status = String(value || "Prepared for review").trim();
  return ["Prepared for review", "Ready to send", "Provider queued", "On hold - verification needed"].includes(status)
    ? status
    : "Prepared for review";
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

function targetForGoal(goal) {
  if (goal.id === "goal-002") return 4;
  if (goal.id === "goal-003") return 4;
  return 80;
}

function nextTaskStatus(task, body, actor) {
  if (task.status === "Completed") {
    return { ...task, status: "Active", completionEvidence: null };
  }
  return {
    ...task,
    status: "Completed",
    completionEvidence: {
      completedBy: actor.name,
      completedByRole: actor.role,
      completedAt: new Date().toISOString(),
      note: String(body.note || "").trim() || "Marked complete from the implementation checklist.",
      evidenceDocumentId: body.evidenceDocumentId || null,
      evidenceLabel: String(body.evidenceLabel || "").trim()
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

function reviseDraftSection(section, body, actor, revisedAt) {
  const previousVersion = section.version || 1;
  const revisionNote = String(body.revisionNote || "").trim() || "Reviewed draft section for source fidelity and implementation clarity.";
  return {
    ...section,
    content: String(body.content || "").trim(),
    status: "Revised - human review required",
    version: previousVersion + 1,
    revisionNote,
    reviewedBy: actor.name,
    reviewedByRole: actor.role,
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

function regenerateDraftSection(section, profile, body, actor, regeneratedAt) {
  const previousVersion = section.version || 1;
  const guidance = String(body.guidance || "").trim() || "Reviewer requested regeneration before approval.";
  return {
    ...section,
    content: regeneratedDraftContent(section, profile, guidance),
    status: "Regenerated - human review required",
    version: previousVersion + 1,
    revisionNote: guidance,
    regenerationGuidance: guidance,
    reviewedBy: actor.name,
    reviewedByRole: actor.role,
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
  const profileText = String(profile || "").trim() || "the reviewed student profile";
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

function ensureDraftExportApproved(body) {
  const payload = body.payload;
  const isDraftIepPackage =
    /draft training iep sections/i.test(body.label || "") ||
    (payload && typeof payload === "object" && Array.isArray(payload.sections) && "profile" in payload);
  if (isDraftIepPackage && payload?.status !== "Approved for export") {
    throw badRequest("Draft section packages require human approval before export.");
  }
}

function isDistrictSystemExport(body = {}) {
  const label = String(body.label || "");
  const packageType = String(body.payload?.packageType || "");
  return /district system|district import/i.test(label) || packageType === "DistrictSystemImportPackage";
}

function createDistrictSystemExportPayload(payload = {}, workspace = {}, user = {}, createdAt) {
  const studentId = String(payload?.studentId || payload?.student?.id || workspace.currentStudentId || "").trim();
  if (!studentId) throw badRequest("District system export requires a selected student.");
  requireStudentAccess(user, studentId);
  const student = (workspace.students || []).find((item) => item.id === studentId);
  if (!student) throw notFound("Student not found for district system export.");
  const ieps = workspace.ieps || [];
  const iep =
    ieps.find((item) => payload?.iepId && item.id === payload.iepId && item.studentId === studentId) ||
    ieps.find((item) => item.studentId === studentId && item.extractionApproved) ||
    ieps.find((item) => item.studentId === studentId);
  if (!iep) throw notFound("IEP record not found for district system export.");
  if (!iep.extractionApproved) {
    throw badRequest("District system export requires an approved structured IEP record.");
  }

  const structuredRecord = normalizeStructuredIepRecord(workspace, {
    ...iep,
    structuredRecord: payload?.structuredRecord || iep.structuredRecord || {}
  });
  const sectionCoverage = schemaSections.map((section) => ({
    section,
    present: hasDistrictExportContent(structuredRecord[section]),
    sourceReference: structuredRecord[section]?.sourceReference || iep.sourceAlignment?.sourceId || "source pending"
  }));
  const sourceAlignment = iep.sourceAlignment || structuredRecord.sourceAlignment || sourceAlignmentForWorkspace(workspace);
  const packageBody = {
    packageType: "DistrictSystemImportPackage",
    packageVersion: "IEP-IW-district-json-0.1",
    generatedAt: createdAt,
    generatedBy: {
      id: user.id,
      name: user.name,
      role: user.role
    },
    district: {
      districtId: workspace.districtConfiguration?.districtId || "riverbend-demo",
      name: workspace.districtConfiguration?.districtName || "Riverbend School District",
      tenancyMode: workspace.districtConfiguration?.tenancyMode || "Single-district demo tenant",
      dataResidency: workspace.districtConfiguration?.dataResidency || "Local demo storage"
    },
    importProfile: {
      target: "District IEP system compatible JSON interchange",
      mode: "Review-ready local package",
      officialSubmission: false,
      guardrail:
        "This package supports district-system import review only; it is not an automated official IEP submission and must be validated by district staff."
    },
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`.trim(),
      grade: student.grade,
      school: student.school,
      nextAnnualReview: student.annualReviewDate,
      nextEvaluation: student.reevaluationDate
    },
    iep: {
      id: iep.id,
      status: iep.status,
      extractionApproved: Boolean(iep.extractionApproved),
      approvedAt: iep.approvedAt || null,
      sourceDocumentId: iep.documentId || null
    },
    sourceAlignment,
    sourceRegistry: {
      activeSourceId: workspace.sourceRegistry?.activeSourceId || sourceAlignment?.sourceId,
      sourceRegistryVersion: workspace.sourceRegistry?.sourceRegistryVersion || sourceAlignment?.sourceRegistryVersion,
      jurisdiction: workspace.sourceRegistry?.jurisdiction || sourceAlignment?.jurisdiction,
      programArea: workspace.sourceRegistry?.programArea || sourceAlignment?.programArea,
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
      goals: (workspace.goals || []).filter((goal) => goal.iepId === iep.id),
      services: (workspace.services || []).filter((service) => service.iepId === iep.id),
      accommodations: (workspace.accommodations || []).filter((accommodation) => accommodation.iepId === iep.id),
      implementationTasks: (workspace.tasks || [])
        .filter((task) => task.iepId === iep.id)
        .map((task) => ({
          id: task.id,
          title: task.title,
          responsibleRole: task.responsibleRole,
          frequency: task.frequency,
          status: task.status,
          sourceSection: task.sourceSection
        }))
    },
    auditContext: {
      sourceDocuments: (workspace.documents || [])
        .filter((document) => document.studentId === studentId)
        .map((document) => ({
          id: document.id,
          name: document.name,
          sha256: document.originalFile?.sha256 || null,
          sourceId: document.sourceAlignment?.sourceId || null,
          ocrStatus: document.ocrReview?.status || null,
          ocrDigest: document.ocrReview?.ocrDigest || null
        })),
      latestAuditTitles: (workspace.auditLog || []).slice(0, 5).map((event) => event.title)
    }
  };
  return {
    ...packageBody,
    packageDigest: sha256Json(packageBody)
  };
}

function hasDistrictExportContent(value) {
  if (value == null || value === "") return false;
  if (Array.isArray(value)) return value.some(hasDistrictExportContent);
  if (typeof value !== "object") return true;
  const entries = Object.entries(value).filter(
    ([key]) => !["id", "sourceAlignment", "sourceReference", "sourceId", "status", "reviewedBy", "reviewedAt"].includes(key)
  );
  return entries.some(([, item]) => hasDistrictExportContent(item));
}

function rejectExtractionSection(section, body, actor) {
  return {
    ...section,
    status: "Rejected",
    rejectionReason:
      String(body.reason || "").trim() || "Reviewer flagged this extraction for regeneration before approval.",
    rejectedBy: actor.name,
    rejectedByRole: actor.role,
    rejectedAt: new Date().toISOString()
  };
}

function regenerateExtractionSection(section, activeDocument, workspace, body, actor) {
  const regenerated = extractSections(activeDocument?.sourceText || "", activeDocument?.name || "source", {
    sourceSegments: sourceSegmentsForExtraction(activeDocument)
  }).find((candidate) => candidate.key === section.key || candidate.sourceSection === section.sourceSection);
  if (!regenerated) throw badRequest("No regenerated content was available for this section.");
  return {
    ...section,
    ...regenerated,
    id: section.id,
    status: "Needs review",
    priorContent: section.content,
    regenerationGuidance: String(body.guidance || "").trim() || "Reviewer requested a fresh source-grounded extraction.",
    regeneratedBy: actor.name,
    regeneratedByRole: actor.role,
    regeneratedAt: new Date().toISOString(),
    sourceAlignment: section.sourceAlignment || activeDocument?.sourceAlignment || sourceAlignmentForWorkspace(workspace)
  };
}

function documentForCurrentStudent(workspace) {
  return (workspace.documents || []).find((document) => document.studentId === workspace.currentStudentId) || null;
}

function sourceSegmentsForExtraction(document) {
  return (document?.sourceSegments || []).map((segment) => ({
    ...segment,
    text: segment.text || segment.excerpt || ""
  }));
}

function canShareSummaryAudience(role, audience) {
  if (role === "caseManager" || role === "administrator" || role === "schoolAdministrator" || role === "districtAdministrator") return true;
  return {
    generalEducation: "teacher",
    relatedServiceProvider: "teacher",
    parent: "parent",
    student: "student"
  }[role] === audience;
}

function canSubmitSummaryComprehensionAudience(role, audience) {
  if (role === "caseManager") return audience === "parent" || audience === "student";
  return {
    parent: "parent",
    student: "student"
  }[role] === audience;
}

function normalizeSummaryUnderstandingStatus(value) {
  const status = String(value || "Needs explanation").trim();
  return ["Understood", "Needs explanation", "Interpreter review requested", "Follow-up requested"].includes(status)
    ? status
    : "Needs explanation";
}

function normalizeSummaryComprehensionReviewStatus(value) {
  const status = String(value || "Awaiting team response").trim();
  return ["Awaiting team response", "Team response recorded", "Interpreter follow-up scheduled", "Closed"].includes(status)
    ? status
    : "Awaiting team response";
}

function createSummaryComprehensionCheck({ id, workspace, audience, body, actor, role }) {
  const summary = workspace.summaries?.[audience] || {};
  const selectedSection =
    (summary.sections || []).find((section) => section.heading === String(body.sectionHeading || "").trim()) ||
    (summary.sections || [])[0] ||
    {};
  const submittedAt = new Date().toISOString();
  return {
    id,
    studentId: workspace.currentStudentId,
    audience,
    summaryTitle: summary.title || "Role-specific summary",
    summaryLabel: summary.label || audience,
    sectionHeading: String(body.sectionHeading || selectedSection.heading || "Summary section").trim(),
    understandingStatus: normalizeSummaryUnderstandingStatus(body.understandingStatus),
    language: String(body.language || "English").trim(),
    questionOrNote: String(body.questionOrNote || "").trim(),
    preferredFollowUp: String(body.preferredFollowUp || "Review with the IEP team.").trim(),
    reviewStatus: "Awaiting team response",
    staffResponse: "",
    nextStep: "Team response pending.",
    submittedBy: actor,
    submittedByRole: role,
    submittedAt,
    reviewedBy: "",
    reviewedByRole: "",
    reviewedAt: "",
    sourceReference: selectedSection.sourceReference || summary.sourceAlignment?.sourceForm || "Role-specific summary",
    sourceAlignment: summary.sourceAlignment || sourceAlignmentForWorkspace(workspace),
    officialRecordImpact:
      "Understanding check documents questions and follow-up only; it does not amend the official IEP or replace IEP team decisions."
  };
}

function createSummaryComprehensionReviewDigest(check) {
  return createHash("sha256")
    .update(JSON.stringify({
      id: check.id,
      studentId: check.studentId,
      audience: check.audience,
      sectionHeading: check.sectionHeading,
      understandingStatus: check.understandingStatus,
      questionOrNote: check.questionOrNote,
      reviewStatus: check.reviewStatus,
      staffResponse: check.staffResponse,
      nextStep: check.nextStep,
      reviewedBy: check.reviewedBy,
      reviewedByRole: check.reviewedByRole,
      reviewedAt: check.reviewedAt
    }))
    .digest("hex");
}

function createSummaryHandout({ id, studentId, audience, summary, coverageItems = [], actor, role }) {
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
    createdAt: new Date().toISOString(),
    disclaimer: "Prepared from the role-specific summary. Review before sharing as part of an official IEP meeting packet.",
    sections: summary.sections || [],
    coverageItems,
    questions: summaryQuestionsForAudience(audience)
  };
}

function summaryQuestionsForAudience(audience) {
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
  }[audience] || [];
}

function nextDueDateForFrequency(date, frequency = "") {
  const base = dateOnly(date);
  if (String(frequency).toLowerCase().includes("month")) {
    base.setMonth(base.getMonth() + 1);
  } else {
    base.setDate(base.getDate() + 7);
  }
  return isoDate(base);
}

function progressScheduleStatus(nextDueDate, today = "2026-06-23") {
  const due = dateOnly(nextDueDate);
  const reference = dateOnly(today);
  const diffDays = Math.round((due - reference) / 86400000);
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Due today";
  if (diffDays <= 7) return "Due soon";
  return "Scheduled";
}

function dateOnly(value) {
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

function normalizeLanguage(value) {
  const language = String(value || "English").trim();
  return ["English", "Spanish", "Arabic", "Chinese", "Vietnamese"].includes(language) ? language : "English";
}

function normalizeParticipantStatus(value) {
  const status = String(value || "Invited").trim();
  return ["Invited", "Confirmed", "Needs alternate"].includes(status) ? status : "Invited";
}

function normalizeParticipantMode(value) {
  const mode = String(value || "In person").trim();
  return ["In person", "Video option", "Phone", "Written input"].includes(mode) ? mode : "In person";
}

function normalizeCompanionDocumentStatus(value) {
  const status = String(value || "Needs review").trim();
  return [
    "Needed",
    "Needs review",
    "In progress",
    "Sent",
    "Available",
    "Complete",
    "Review if change proposed",
    "Not needed"
  ].includes(status)
    ? status
    : "Needs review";
}

function normalizeFamilyResourceStatus(value) {
  const status = String(value || "Available").trim();
  return ["Needed", "Available", "Sent", "Reviewed with family", "Not needed"].includes(status)
    ? status
    : "Available";
}

function normalizeFamilyResourceResponseStatus(value) {
  const status = String(value || "Reviewed").trim();
  return ["Not reviewed", "Reviewed", "Needs explanation", "Request copy", "Interpreter support needed"].includes(status)
    ? status
    : "Reviewed";
}

function normalizePacketAcknowledgmentStatus(value) {
  const status = String(value || "Reviewed").trim();
  return ["Reviewed", "Needs clarification", "Needs more time", "Cannot attend"].includes(status)
    ? status
    : "Reviewed";
}

function normalizeSignatureScope(value) {
  const scope = String(value || "Meeting packet receipt").trim();
  return ["Meeting packet receipt", "Draft-to-final change review", "Companion document review", "Procedural safeguards receipt"].includes(scope)
    ? scope
    : "Meeting packet receipt";
}

function normalizeSignatureRole(value) {
  const requestedForRole = String(value || "parent").trim();
  return requestedForRole === "parent" ? "parent" : "parent";
}

function normalizeCalendarProvider(value) {
  const provider = String(value || "District calendar (simulated)").trim();
  return ["District calendar (simulated)", "Google Calendar (simulated)", "Outlook (simulated)", "Manual hold"].includes(provider)
    ? provider
    : "District calendar (simulated)";
}

function normalizeCalendarAttendanceMode(value) {
  const mode = String(value || "In person with video option").trim();
  return ["In person", "Video option", "Phone", "In person with video option"].includes(mode)
    ? mode
    : "In person with video option";
}

function normalizeNotificationAudience(value) {
  const audience = String(value || "family").trim();
  return ["family", "student", "staff", "team"].includes(audience) ? audience : "family";
}

function normalizeNotificationChannel(value) {
  const channel = String(value || "In-app").trim();
  return ["In-app", "Email", "SMS", "Printed packet"].includes(channel) ? channel : "In-app";
}

function notificationAudienceLabel(audience) {
  return {
    family: "family",
    student: "student",
    staff: "assigned staff",
    team: "IEP team"
  }[audience] || "recipient";
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
    note: "Participant imported from meeting list."
  }));
}

function studentName(workspace, studentId) {
  const student = (workspace.students || []).find((item) => item.id === studentId);
  return student ? `${student.firstName} ${student.lastName}` : "Unknown student";
}

function normalizeSourceRegistryReviewStatus(value) {
  const status = String(value || "Current").trim();
  return ["Current", "Update needed", "Superseded", "Future expansion"].includes(status)
    ? status
    : "Current";
}

function normalizeDistrictIntegrationStatus(value) {
  const status = String(value || "Readiness review").trim();
  return ["Demo only", "Readiness review", "Pilot approved", "Production blocked", "Production approved"].includes(status)
    ? status
    : "Readiness review";
}

function districtConfigurationForWorkspace(workspace = {}) {
  const existing = workspace.districtConfiguration || {};
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

function createDistrictIntegrationDigest({ districtId, integration, actor, role, reviewedAt }) {
  return createHash("sha256")
    .update(JSON.stringify({
      districtId,
      id: integration.id,
      name: integration.name,
      category: integration.category,
      provider: integration.provider,
      status: integration.status,
      owner: integration.owner,
      nextReviewDate: integration.nextReviewDate,
      note: integration.note,
      productUse: integration.productUse,
      actor,
      role,
      reviewedAt
    }))
    .digest("hex");
}

function createDataProtectionDigest({ districtId, control, actor, role, reviewedAt }) {
  return createHash("sha256")
    .update(JSON.stringify({
      districtId,
      id: control.id,
      name: control.name,
      category: control.category,
      control: control.control,
      status: control.status,
      owner: control.owner,
      nextReviewDate: control.nextReviewDate,
      evidenceNote: control.evidenceNote,
      productionBoundary: control.productionBoundary,
      productUse: control.productUse,
      actor,
      role,
      reviewedAt
    }))
    .digest("hex");
}

function normalizeAccessibilityFindingStatus(value) {
  const status = String(value || "Remediation planned").trim();
  return ["Open", "Remediation planned", "In remediation", "Ready for retest", "Verified", "Accepted with exception"].includes(status)
    ? status
    : "Remediation planned";
}

function normalizeAccessibilityFindingSeverity(value) {
  const severity = String(value || "Medium").trim();
  return ["Low", "Medium", "High"].includes(severity) ? severity : "Medium";
}

function accessibilityCertificationForWorkspace(workspace = {}) {
  const existing = workspace.accessibilityCertification || {};
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

function createAccessibilityReviewDigest({ standard, finding, actor, role, reviewedAt }) {
  return createHash("sha256")
    .update(JSON.stringify({
      standard,
      id: finding.id,
      title: finding.title,
      criterion: finding.criterion,
      severity: finding.severity,
      status: finding.status,
      owner: finding.owner,
      dueDate: finding.dueDate,
      assistiveTechnology: finding.assistiveTechnology,
      remediationPlan: finding.remediationPlan,
      verificationNote: finding.verificationNote,
      actor,
      role,
      reviewedAt
    }))
    .digest("hex");
}

function createSourceRegistryEntry(body, { sourceRegistry = {}, actor, role, savedAt }) {
  const title = requiredString(body.title, "Source title");
  const sourceId = normalizeSourceId(body.sourceId || title);
  const sourceRegistryVersion = requiredString(
    body.sourceRegistryVersion || sourceRegistry.sourceRegistryVersion,
    "Source registry version"
  );
  return {
    sourceId,
    title,
    issuingOrganization: String(body.issuingOrganization || "District source registry").trim(),
    sourceType: String(body.sourceType || "Form").trim(),
    sourceFormType: String(body.sourceFormType || "District-reviewed").trim(),
    programArea: String(body.programArea || sourceRegistry.programArea || "School Age").trim(),
    jurisdiction: String(body.jurisdiction || sourceRegistry.jurisdiction || "Pennsylvania").trim(),
    effectiveDate: requiredString(body.effectiveDate, "Source effective date"),
    retrievedDate: requiredString(body.retrievedDate, "Source retrieved date"),
    url: String(body.url || "").trim(),
    fileTypesAvailable: splitRegistryList(body.fileTypesAvailable, ["PDF"]),
    languagesAvailable: splitRegistryList(body.languagesAvailable, ["English"]),
    languageAvailabilityNote: String(
      body.languageAvailabilityNote ||
        "District must verify current translated source availability before sharing family-facing packets."
    ).trim(),
    productUse: splitRegistryList(body.productUse, ["Schema", "Extraction", "Validation", "Review"]),
    reviewStatus: normalizeSourceRegistryReviewStatus(body.reviewStatus),
    reviewNote: requiredString(body.reviewNote, "Source registry review note"),
    nextReviewDate: requiredString(body.nextReviewDate, "Next source review date"),
    reviewedBy: actor,
    reviewedByRole: role,
    reviewedAt: savedAt,
    sourceRegistryVersion
  };
}

function normalizeSourceId(value) {
  const sourceId = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sourceId || `source-${randomUUID()}`;
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

function createStudentProfileRecordFromBody(body, { firstName, lastName, grade, school, annualReviewDate, actor, role, userId, createdAt }) {
  return {
    id: `student-${randomUUID()}`,
    firstName,
    lastName,
    grade,
    school,
    caseManagerId: userId,
    status: "Draft review",
    supportAreas: splitRegistryList(body.supportAreas, ["Needs profile review"]),
    annualReviewDate,
    createdAt,
    createdBy: actor,
    createdByRole: role
  };
}

function createDraftIepForStudentProfile(student, sourceAlignment, createdAt) {
  const startDate = isoDate(new Date());
  return {
    id: `iep-${randomUUID()}`,
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

function normalizeComplianceReviewStatus(value) {
  const status = String(value || "In review").trim();
  return ["Requested", "In review", "Returned for revision", "Closed - reviewed"].includes(status)
    ? status
    : "In review";
}

function normalizeLegalReviewStatus(value) {
  const status = String(value || "Counsel response recorded").trim();
  return ["Routed to counsel", "Counsel response recorded", "Returned for district action", "Closed - counsel reviewed"].includes(status)
    ? status
    : "Counsel response recorded";
}

function normalizeIepComparisonStatus(value) {
  const status = String(value || "Needs team review").trim();
  return ["Needs team review", "Reviewed for meeting", "Needs source follow-up", "Shared in family summary"].includes(status)
    ? status
    : "Needs team review";
}

function normalizeIepAmendmentReviewStatus(value) {
  const status = String(value || "No amendment indicated").trim();
  return ["No amendment indicated", "Amendment review needed", "Amendment routed to team", "Documented outside workspace"].includes(status)
    ? status
    : "No amendment indicated";
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

function normalizeAccessSupportStatus(value) {
  const status = String(value || "Needs review").trim();
  return ["Active", "Needs review", "Implementation pending", "Not required", "Resolved"].includes(status)
    ? status
    : "Needs review";
}

function normalizePlacementReviewStatus(value) {
  const status = String(value || "Needs review").trim();
  return ["Source aligned", "Needs review", "Implementation follow-up", "Team clarification needed", "Resolved"].includes(status)
    ? status
    : "Needs review";
}

function normalizeMeetingTranscriptStatus(value) {
  const status = String(value || "Draft recap for review").trim();
  return ["Draft recap for review", "Reviewed for packet", "Needs team clarification", "Family-ready recap"].includes(status)
    ? status
    : "Draft recap for review";
}

function normalizeMeetingRecordingStatus(value) {
  const status = String(value || "Source readiness reviewed").trim();
  return [
    "Source readiness reviewed",
    "Consent pending",
    "Recording not permitted",
    "Transcript source only",
    "Needs district review"
  ].includes(status)
    ? status
    : "Source readiness reviewed";
}

function normalizeMeetingRecordingSource(value) {
  const source = String(value || "Case-manager recap notes").trim();
  return [
    "Case-manager recap notes",
    "Manual transcript paste",
    "Video platform transcript (simulated)",
    "Audio recording reference (simulated)",
    "District recording provider (simulated)"
  ].includes(source)
    ? source
    : "Case-manager recap notes";
}

function normalizeOcrReviewStatus(value) {
  const status = String(value || "OCR needed").trim();
  return ["Embedded text accepted", "OCR needed", "OCR text reviewed", "Source quality blocked"].includes(status)
    ? status
    : "OCR needed";
}

function normalizeSourceAnchorPrecision(value) {
  const precision = String(value || "Page").trim();
  return ["Page", "Segment", "Bounding box", "Needs remediation"].includes(precision) ? precision : "Page";
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

function createSourceAnchorReview({
  section,
  precision,
  pageNumber,
  segmentLabel,
  anchorX,
  anchorY,
  anchorWidth,
  anchorHeight,
  reviewerNote,
  actor,
  role,
  reviewedAt,
  sourceAlignment
}) {
  const review = {
    precision,
    pageNumber,
    segmentLabel,
    boundingBox: {
      x: clampAnchorPercent(anchorX),
      y: clampAnchorPercent(anchorY),
      width: clampAnchorPercent(anchorWidth),
      height: clampAnchorPercent(anchorHeight),
      unit: "percent"
    },
    reviewerNote,
    reviewedBy: actor,
    reviewedByRole: role,
    reviewedAt,
    sourceReference: section.sourceReference,
    sourceAlignment,
    officialRecordImpact:
      "Source anchor review refines traceability to the preserved source only; it does not change the official IEP or certify OCR accuracy."
  };
  return {
    ...review,
    anchorDigest: createSourceAnchorReviewDigest(section, review)
  };
}

function createSourceAnchorReviewDigest(section, review) {
  return createHash("sha256")
    .update(JSON.stringify({
      sectionId: section.id,
      sectionKey: section.key,
      sourceReference: section.sourceReference,
      precision: review.precision,
      pageNumber: review.pageNumber,
      segmentLabel: review.segmentLabel,
      boundingBox: review.boundingBox,
      reviewerNote: review.reviewerNote,
      actor: review.reviewedBy,
      role: review.reviewedByRole,
      reviewedAt: review.reviewedAt
    }))
    .digest("hex");
}

function createLegalReviewRouteDigest(route) {
  return createHash("sha256")
    .update(JSON.stringify({
      reviewId: route.reviewId,
      issue: route.issue,
      counselName: route.counselName,
      reviewScope: route.reviewScope,
      routingReason: route.routingReason,
      dueDate: route.dueDate,
      districtPolicyReference: route.districtPolicyReference,
      actor: route.actor,
      role: route.role,
      routedAt: route.routedAt
    }))
    .digest("hex");
}

function createLegalReviewOutcomeDigest(outcome) {
  return createHash("sha256")
    .update(JSON.stringify({
      routeId: outcome.routeId,
      status: outcome.status,
      counselSummary: outcome.counselSummary,
      recommendedAction: outcome.recommendedAction,
      reviewerNote: outcome.reviewerNote,
      actor: outcome.actor,
      role: outcome.role,
      reviewedAt: outcome.reviewedAt
    }))
    .digest("hex");
}

function createIepComparisonDigest({ comparison, status, reviewNote, familyVisible, studentVisible, actor, role, reviewedAt }) {
  return createHash("sha256")
    .update(JSON.stringify({
      id: comparison.id,
      studentId: comparison.studentId,
      previousIepId: comparison.previousIepId,
      currentIepId: comparison.currentIepId,
      section: comparison.section,
      changeType: comparison.changeType,
      title: comparison.title,
      previousText: comparison.previousText,
      currentText: comparison.currentText,
      implementationImpact: comparison.implementationImpact,
      familySummary: comparison.familySummary,
      amendmentReviewStatus: comparison.amendmentReviewStatus,
      amendmentNote: comparison.amendmentNote,
      versionIntake: comparison.versionIntake,
      status,
      reviewNote,
      familyVisible,
      studentVisible,
      sourceReference: comparison.sourceReference,
      actor,
      role,
      reviewedAt
    }))
    .digest("hex");
}

function createTeamCommentModerationDigest({ comment, visibility, moderationStatus, moderationNote, actor, role, moderatedAt }) {
  return createHash("sha256")
    .update(JSON.stringify({
      id: comment.id,
      studentId: comment.studentId,
      targetType: comment.targetType,
      targetId: comment.targetId,
      previousVisibility: comment.visibility,
      visibility,
      moderationStatus,
      moderationNote,
      actor,
      role,
      moderatedAt
    }))
    .digest("hex");
}

function createTeamCommentQueueReviewDigest(review) {
  return createHash("sha256")
    .update(JSON.stringify({
      studentId: review.studentId,
      queueStatus: review.queueStatus,
      notificationPlan: review.notificationPlan,
      retentionDecision: review.retentionDecision,
      retentionBoundary: review.retentionBoundary,
      reviewerNote: review.reviewerNote,
      nextReviewDate: review.nextReviewDate,
      pendingCount: review.pendingCount,
      needsFollowUpCount: review.needsFollowUpCount,
      staffOnlyCount: review.staffOnlyCount,
      familyVisibleCount: review.familyVisibleCount,
      studentVisibleCount: review.studentVisibleCount,
      latestCommentAt: review.latestCommentAt,
      commentsReviewed: review.commentsReviewed,
      reviewedByUserId: review.reviewedByUserId,
      reviewedAt: review.reviewedAt,
      sourceReference: review.sourceReference
    }))
    .digest("hex");
}

function createPortalAccessReviewDigest(review) {
  return createHash("sha256")
    .update(JSON.stringify({
      studentId: review.studentId,
      subjectRole: review.subjectRole,
      subjectName: review.subjectName,
      accessStatus: review.accessStatus,
      verificationMethod: review.verificationMethod,
      identityEvidence: review.identityEvidence,
      languageSupportNeeded: review.languageSupportNeeded,
      privacyNote: review.privacyNote,
      reviewedByUserId: review.reviewedByUserId,
      reviewedAt: review.reviewedAt,
      sourceReference: review.sourceReference
    }))
    .digest("hex");
}

function createPortalInvitationDigest(invitation) {
  return createHash("sha256")
    .update(JSON.stringify({
      studentId: invitation.studentId,
      subjectRole: invitation.subjectRole,
      subjectName: invitation.subjectName,
      status: invitation.status,
      deliveryChannel: invitation.deliveryChannel,
      expiresAt: invitation.expiresAt,
      scopeSummary: invitation.scopeSummary,
      identityVerificationSummary: invitation.identityVerificationSummary,
      languageSupportNote: invitation.languageSupportNote,
      privacyBoundary: invitation.privacyBoundary,
      providerReference: invitation.providerReference,
      preparedByUserId: invitation.preparedByUserId,
      preparedAt: invitation.preparedAt,
      sourceReference: invitation.sourceReference
    }))
    .digest("hex");
}

function createAccessSupportDigest({ support, actor, role }) {
  return createHash("sha256")
    .update(JSON.stringify({
      id: support.id,
      studentId: support.studentId,
      iepId: support.iepId,
      supportType: support.supportType,
      requirement: support.requirement,
      status: support.status,
      implementationPlan: support.implementationPlan,
      responsibleRole: support.responsibleRole,
      reviewNote: support.reviewNote,
      actor,
      role,
      reviewedAt: support.reviewedAt
    }))
    .digest("hex");
}

function createPlacementReviewDigest({ review, actor, role }) {
  return createHash("sha256")
    .update(JSON.stringify({
      id: review.id,
      studentId: review.studentId,
      iepId: review.iepId,
      setting: review.setting,
      rationale: review.rationale,
      status: review.status,
      lreConsideration: review.lreConsideration,
      implementationImpact: review.implementationImpact,
      followUpOwner: review.followUpOwner,
      nextReviewDate: review.nextReviewDate,
      reviewerNote: review.reviewerNote,
      sourceReference: review.sourceReference,
      actor,
      role,
      reviewedAt: review.reviewedAt
    }))
    .digest("hex");
}

function createOcrReviewDigest({ document, status, confidence, reviewedTextExcerpt, reviewerNote, actor, role, reviewedAt }) {
  return createHash("sha256")
    .update(JSON.stringify({
      documentId: document.id,
      sourceSha256: document.originalFile?.sha256 || null,
      sourceName: document.name,
      status,
      confidence,
      reviewedTextExcerpt,
      reviewerNote,
      actor,
      role,
      reviewedAt
    }))
    .digest("hex");
}

function aiGovernanceForWorkspace(workspace = {}) {
  const existing = workspace.aiGovernance || {};
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

function createAiGovernanceEvaluationRun(workspace, { evaluationScope, reviewerNote, actor, role, runAt }) {
  const governance = aiGovernanceForWorkspace(workspace);
  const profile = governance.modelProfile;
  const checks = aiGovernanceChecks(workspace, profile, reviewerNote);
  const passedCount = checks.filter((check) => check.status === "Passed").length;
  const score = Math.round((passedCount / checks.length) * 100);
  const threshold = Number(profile.evaluationThreshold || 90);
  const status = score >= threshold ? "Passed" : "Needs review";
  const run = {
    id: `ai-evaluation-${randomUUID()}`,
    evaluationScope,
    status,
    score,
    threshold,
    passedChecks: passedCount,
    totalChecks: checks.length,
    reviewerNote,
    runBy: actor,
    runByRole: role,
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
    evaluationDigest: createAiGovernanceEvaluationDigest(run)
  };
}

function aiGovernanceChecks(workspace = {}, profile = {}, reviewerNote = "") {
  const reviewFlags = workspace.reviewFlags || [];
  const summaries = Object.values(workspace.summaries || {});
  const documents = workspace.documents || [];
  const complianceReviews = workspace.complianceReviews || [];
  const draftSections = workspace.draft?.sections || [];
  const sourceAlignedFlags = reviewFlags.filter((flag) => flag.sourceReference && flag.sourceAlignment?.sourceId).length;
  const sourceAlignedSummaries = summaries.filter((summary) => summary.sourceAlignment?.sourceId).length;
  const sourceAlignedDocuments = documents.filter((document) => document.sourceAlignment?.sourceId).length;
  const humanReviewedDraftSections = draftSections.filter((section) =>
    /review|approved/i.test(`${section.status || ""} ${section.reviewedBy || ""}`)
  ).length;
  return [
    aiGovernanceCheck({
      id: "source-traceability",
      title: "Source traceability",
      passed:
        sourceAlignedFlags === reviewFlags.length &&
        sourceAlignedSummaries === summaries.length &&
        sourceAlignedDocuments === documents.length,
      requirement: "AI-assisted review, summary, and intake outputs remain traceable to official source metadata.",
      evidence: `${sourceAlignedFlags}/${reviewFlags.length} advisory flags, ${sourceAlignedSummaries}/${summaries.length} summaries, and ${sourceAlignedDocuments}/${documents.length} preserved documents include source alignment.`
    }),
    aiGovernanceCheck({
      id: "content-labeling",
      title: "Content labeling",
      passed: profile.contentLabelsRequired === true && Boolean(profile.promptVersion),
      requirement: "AI-generated suggestions are labeled as draft, explanatory, or advisory rather than official IEP content.",
      evidence: `${profile.promptVersion || "No prompt version"} requires content labels: ${profile.contentLabelsRequired === true ? "yes" : "no"}.`
    }),
    aiGovernanceCheck({
      id: "restricted-decisions",
      title: "Restricted decision guardrails",
      passed: profile.diagnosisBlocked === true && profile.legalDecisionBlocked === true && profile.finalPlacementBlocked === true,
      requirement: "The assistant refuses diagnosis, legal certification, and final placement decisions.",
      evidence: `Diagnosis blocked: ${yesNo(profile.diagnosisBlocked)}; legal certification blocked: ${yesNo(profile.legalDecisionBlocked)}; final placement blocked: ${yesNo(profile.finalPlacementBlocked)}.`
    }),
    aiGovernanceCheck({
      id: "human-review-boundary",
      title: "Human review boundary",
      passed:
        profile.humanReviewRequired === true &&
        reviewFlags.every((flag) => flag.humanReviewRequired === true) &&
        complianceReviews.every((review) => review.notLegalCertification === true),
      requirement: "Every AI-assisted advisory finding and formal review artifact preserves qualified human review.",
      evidence: `${reviewFlags.length} advisory findings require human review; ${complianceReviews.length} compliance reviews are marked not legal certification.`
    }),
    aiGovernanceCheck({
      id: "evaluation-evidence",
      title: "Evaluation evidence",
      passed: Boolean(String(reviewerNote || "").trim()) && (draftSections.length === 0 || humanReviewedDraftSections <= draftSections.length),
      requirement: "Governance reviews retain reviewer notes and evaluate draft sections without treating drafts as official content.",
      evidence: `${reviewerNote ? "Reviewer note recorded" : "Reviewer note missing"}; ${draftSections.length} draft sections inspected.`
    })
  ];
}

function aiGovernanceCheck({ id, title, passed, requirement, evidence }) {
  return {
    id,
    title,
    status: passed ? "Passed" : "Needs review",
    requirement,
    evidence
  };
}

function yesNo(value) {
  return value === true ? "yes" : "no";
}

function createAiGovernanceEvaluationDigest(run) {
  return createHash("sha256")
    .update(JSON.stringify({
      evaluationScope: run.evaluationScope,
      score: run.score,
      status: run.status,
      reviewerNote: run.reviewerNote,
      runBy: run.runBy,
      runByRole: run.runByRole,
      runAt: run.runAt,
      modelProfile: run.modelProfile,
      checks: run.checks
    }))
    .digest("hex");
}

function createAiCitationEvaluation(workspace, { outputLabel, outputText, citations, reviewerNote, actor, role, evaluatedAt }) {
  const governance = aiGovernanceForWorkspace(workspace);
  const sourceInventory = aiCitationSourceInventory(workspace);
  const matchedSources = citations
    .map((citation) => ({
      citation,
      source: sourceInventory.find((source) => sourceMatchesCitation(source, citation)) || null
    }))
    .filter((item) => item.source);
  const checks = aiCitationChecks({ outputText, citations, reviewerNote, sourceInventory, matchedSources });
  const passedCount = checks.filter((check) => check.status === "Passed").length;
  const score = Math.round((passedCount / checks.length) * 100);
  const status = score >= 80 ? "Passed" : "Needs review";
  const evaluation = {
    id: `ai-citation-evaluation-${randomUUID()}`,
    outputLabel,
    outputText,
    status,
    score,
    threshold: 80,
    passedChecks: passedCount,
    totalChecks: checks.length,
    citations,
    matchedSources: matchedSources.map((item) => ({
      citation: item.citation,
      sourceType: item.source.sourceType,
      label: item.source.label,
      sourceReference: item.source.sourceReference
    })),
    reviewerNote,
    evaluatedBy: actor,
    evaluatedByRole: role,
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
    citationDigest: createAiCitationEvaluationDigest(evaluation)
  };
}

function aiCitationChecks({ outputText, citations, reviewerNote, sourceInventory, matchedSources }) {
  return [
    aiGovernanceCheck({
      id: "citation-block-present",
      title: "Citation block present",
      passed: /source references?:|citations?:/i.test(outputText) && citations.length > 0,
      requirement: "AI-assisted outputs must name source references or citations before sharing.",
      evidence: `${citations.length} citation${citations.length === 1 ? "" : "s"} supplied; source-reference block ${/source references?:|citations?:/i.test(outputText) ? "found" : "missing"}.`
    }),
    aiGovernanceCheck({
      id: "citations-match-workspace",
      title: "Citations match workspace sources",
      passed: citations.length > 0 && matchedSources.length === citations.length,
      requirement: "Citations should match preserved source documents, source-aligned obligations, or reviewed workspace records.",
      evidence: `${matchedSources.length}/${citations.length} citations matched ${sourceInventory.length} available source references.`
    }),
    aiGovernanceCheck({
      id: "official-boundary-visible",
      title: "Official-record boundary visible",
      passed: /not official|does not change|human review|advisory|draft/i.test(outputText),
      requirement: "AI-assisted output must state that it is draft, explanatory, advisory, or subject to human review.",
      evidence: outputText ? "Boundary language inspected in output text." : "No output text supplied."
    }),
    aiGovernanceCheck({
      id: "reviewer-note-recorded",
      title: "Reviewer note recorded",
      passed: Boolean(String(reviewerNote || "").trim()),
      requirement: "Citation evaluations retain human reviewer notes.",
      evidence: reviewerNote ? "Reviewer note recorded." : "Reviewer note missing."
    })
  ];
}

function aiCitationSourceInventory(workspace = {}) {
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
  (workspace.documents || []).forEach((document) => {
    addSource("Document", document.name, document.name);
    addSource("Document", document.name, document.sourceReference);
  });
  (workspace.extractionSections || []).forEach((section) => addSource("Extraction section", section.title, section.sourceReference));
  (workspace.goals || []).forEach((goal) => addSource("Goal", goal.domain, goal.sourceReference || goal.sourceSection));
  (workspace.services || []).forEach((service) => addSource("Service", service.serviceType, service.sourceReference || service.sourceSection));
  (workspace.accommodations || []).forEach((item) => addSource("Accommodation", item.description, item.sourceReference || item.sourceSection));
  (workspace.tasks || []).forEach((task) => addSource("Implementation task", task.title, task.sourceReference || task.sourceSection));
  (workspace.reviewFlags || []).forEach((flag) => addSource("Review flag", flag.issue, flag.sourceReference));
  (workspace.iepComparisons || []).forEach((comparison) => addSource("IEP comparison", comparison.title, comparison.sourceReference));
  Object.values(workspace.summaries || {}).forEach((summary) => {
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

function createAiCitationEvaluationDigest(evaluation) {
  return createHash("sha256")
    .update(JSON.stringify({
      outputLabel: evaluation.outputLabel,
      score: evaluation.score,
      status: evaluation.status,
      citations: evaluation.citations,
      matchedSources: evaluation.matchedSources,
      reviewerNote: evaluation.reviewerNote,
      evaluatedBy: evaluation.evaluatedBy,
      evaluatedByRole: evaluation.evaluatedByRole,
      evaluatedAt: evaluation.evaluatedAt,
      checks: evaluation.checks
    }))
    .digest("hex");
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

function createMeetingSignatureHash({ signatureRequest, signerName, attestation, actor, role, signedAt }) {
  return createHash("sha256")
    .update(JSON.stringify({
      id: signatureRequest.id,
      meetingId: signatureRequest.meetingId,
      studentId: signatureRequest.studentId,
      packetTitle: signatureRequest.packetTitle,
      signatureScope: signatureRequest.signatureScope,
      requestedAt: signatureRequest.requestedAt,
      signerName,
      attestation,
      actor,
      role,
      signedAt
    }))
    .digest("hex");
}

function createMeetingTranscriptDigest({ transcriptSummary, actor, role }) {
  return createHash("sha256")
    .update(JSON.stringify({
      id: transcriptSummary.id,
      meetingId: transcriptSummary.meetingId,
      studentId: transcriptSummary.studentId,
      transcriptSource: transcriptSummary.transcriptSource,
      transcriptExcerpt: transcriptSummary.transcriptExcerpt,
      summary: transcriptSummary.summary,
      decisions: transcriptSummary.decisions,
      followUps: transcriptSummary.followUps,
      status: transcriptSummary.status,
      familyVisible: transcriptSummary.familyVisible,
      studentVisible: transcriptSummary.studentVisible,
      actor,
      role,
      reviewedAt: transcriptSummary.reviewedAt
    }))
    .digest("hex");
}

function createMeetingRecordingReviewDigest({ recordingReview, actor, role }) {
  return createHash("sha256")
    .update(JSON.stringify({
      id: recordingReview.id,
      meetingId: recordingReview.meetingId,
      studentId: recordingReview.studentId,
      recordingSource: recordingReview.recordingSource,
      status: recordingReview.status,
      participantConsentSummary: recordingReview.participantConsentSummary,
      transcriptHandlingPlan: recordingReview.transcriptHandlingPlan,
      storageLocation: recordingReview.storageLocation,
      retentionBoundary: recordingReview.retentionBoundary,
      familyVisible: recordingReview.familyVisible,
      studentVisible: recordingReview.studentVisible,
      actor,
      role,
      reviewedAt: recordingReview.reviewedAt
    }))
    .digest("hex");
}

function normalizeStaffContinuityStatus(value) {
  const status = String(value || "").trim();
  if (!status) throw badRequest("Continuity status is required.");
  return status;
}

function normalizeStaffContinuityRisk(value) {
  const risk = String(value || "").trim();
  if (!["Low", "Medium", "High"].includes(risk)) {
    throw badRequest("Continuity risk must be Low, Medium, or High.");
  }
  return risk;
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 3;
  return Math.max(1, Math.min(5, Math.round(numeric)));
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

function defaultGlossaryItems(workspace = {}) {
  const sourceAlignment = sourceAlignmentForWorkspace(workspace);
  return [
    {
      id: "glossary-accommodation",
      term: "Accommodation",
      plainLanguage: "A support that helps the student access the same work.",
      sourceReference: "IEP Section: Supplementary Aids, Services, and Program Modifications",
      sourceAlignment,
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
      sourceAlignment,
      clarityStatus: "Not reviewed",
      clarityNote: "",
      staffResponseStatus: "Not started",
      staffResponse: "",
      officialRecordImpact: "Glossary clarification supports understanding only; official progress-report decisions still require team review."
    },
    {
      id: "glossary-related-service",
      term: "Related service",
      plainLanguage: "A service that helps the student benefit from school.",
      sourceReference: "IEP Section: Special Education / Related Services Grid",
      sourceAlignment,
      clarityStatus: "Not reviewed",
      clarityNote: "",
      staffResponseStatus: "Not started",
      staffResponse: "",
      officialRecordImpact: "Glossary clarification supports understanding only; it does not create or revise service minutes."
    }
  ];
}

function normalizeGlossaryItems(glossary = [], workspace = {}) {
  const defaults = defaultGlossaryItems(workspace);
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
      sourceAlignment: item.sourceAlignment || match.sourceAlignment || sourceAlignmentForWorkspace(workspace),
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
  return ["Not reviewed", "Clear", "Needs explanation", "Interpreter explanation requested"].includes(status)
    ? status
    : "Not reviewed";
}

function normalizeGlossaryResponseStatus(status) {
  return ["Not started", "Explanation planned", "Explained by staff", "Needs team follow-up"].includes(status)
    ? status
    : "Not started";
}

function languageAccessDraft(language, parentSummary = {}) {
  const spanish = language === "Spanish";
  return {
    language,
    status: "Draft translation support - human review required",
    title: spanish ? "Resumen familiar en lenguaje sencillo" : `${language} family summary draft`,
    disclaimer: "Draft language support is for review and does not replace the official IEP or qualified interpretation.",
    sections: (parentSummary.sections || []).map((section) => ({
      heading: spanish ? translateSpanish(section.heading) : section.heading,
      text: section.text ? (spanish ? translateSpanish(section.text) : section.text) : null,
      bullets: section.bullets?.map((bullet) => (spanish ? translateSpanish(bullet) : bullet)) || null,
      sourceReference: section.sourceReference || null
    }))
  };
}

function translateSpanish(value) {
  const dictionary = [
    ["What the plan supports", "Lo que apoya el plan"],
    ["What the school should provide", "Lo que la escuela debe proporcionar"],
    ["What changed from the previous IEP", "Lo que cambio desde el IEP anterior"],
    ["What the family can ask", "Lo que la familia puede preguntar"],
    ["Jordan is working on understanding what is read, organizing written work, and completing classroom routines independently.", "Jordan esta trabajando en comprender lo que lee, organizar el trabajo escrito y completar rutinas de clase con mayor independencia."],
    ["Reading support three times each week.", "Apoyo de lectura tres veces por semana."],
    ["Speech-language support for 30 minutes once each week.", "Apoyo de habla y lenguaje por 30 minutos una vez por semana."],
    ["Written and visual directions, a graphic organizer, and extended time as written.", "Instrucciones escritas y visuales, un organizador grafico y tiempo extendido segun lo escrito."],
    ["The current reading goal names literal and inferential questions with an approved organizer, rather than only describing general comprehension support.", "La meta actual de lectura nombra preguntas literales e inferenciales con un organizador aprobado, en vez de describir solo apoyo general de comprension."],
    ["Implementation follow-up now tracks missed speech-language minutes and a recovery plan before the annual review.", "El seguimiento de implementacion ahora registra minutos perdidos de habla y lenguaje y un plan de recuperacion antes de la revision anual."],
    ["Extended time remains available, but the team needs to confirm the amount and trigger because the source IEP does not specify them.", "El tiempo extendido sigue disponible, pero el equipo necesita confirmar la cantidad y el momento de uso porque el IEP fuente no los especifica."],
    ["Ask how missed speech-language minutes will be recovered.", "Pregunte como se recuperaran los minutos perdidos de habla y lenguaje."],
    ["Ask how reading data will be shared before the next progress report.", "Pregunte como se compartiran los datos de lectura antes del proximo informe de progreso."]
  ];
  return dictionary.reduce((text, [source, target]) => text.replaceAll(source, target), String(value || ""));
}

function approvedStructuredIep(workspace, iep, sourceAlignment) {
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
  const normalizedRecord = normalizeStructuredIepRecord(workspace, approvedIep);
  const structuredRecord = mergeExtractionSectionsIntoStructuredRecord(workspace, normalizedRecord, sourceAlignment);
  return {
    ...approvedIep,
    structuredRecord: normalizeStructuredIepRecord(workspace, { ...approvedIep, structuredRecord })
  };
}

function mergeGeneratedReviewFlags(existingFlags = [], generatedFlags = []) {
  const generatedRules = new Set(generatedFlags.map((flag) => flag.generatedRule).filter(Boolean));
  return [
    ...generatedFlags,
    ...existingFlags.filter((flag) => !flag.generatedRule || !generatedRules.has(flag.generatedRule))
  ];
}

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  error.code = "NOT_FOUND";
  return error;
}

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "BAD_REQUEST";
  return error;
}

function requiredString(value, label) {
  const text = String(value || "").trim();
  if (!text) throw badRequest(`${label} is required.`);
  return text;
}

function forbidden(message) {
  const error = new Error(message);
  error.status = 403;
  error.code = "FORBIDDEN";
  return error;
}
