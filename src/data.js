import { createDefaultGapClosureWorkspace, normalizeGapClosureWorkspace } from "./gapClosure.js";

export { createDefaultGapClosureWorkspace, normalizeGapClosureWorkspace } from "./gapClosure.js";

export const schemaSections = [
  "studentInformation",
  "IEPTeam",
  "specialConsiderations",
  "currentPerformance",
  "goalsAndObjectives",
  "services",
  "supplementaryAidsAndServices",
  "accommodations",
  "educationalPlacement",
  "meetingInformation",
  "transitionServices",
  "stateAndLocalAssessments",
  "behaviorSupportPlan",
  "progressMonitoring",
  "additionalInformation"
];

export const roles = {
  caseManager: {
    label: "Special Education Teacher",
    can: [
      "View assigned students",
      "Upload IEP documents",
      "Review and edit extracted structured data",
      "Generate role-specific summaries",
      "Copy summaries and generate meeting handouts",
      "Review classroom-scale support rosters",
      "Track progress monitoring",
      "Prepare meeting materials",
      "Coordinate companion-document readiness",
      "Coordinate family resource guide readiness",
      "Coordinate language access and interpreter status",
      "Record parent/student portal access verification",
      "Prepare scoped portal invitation packages",
      "Post source-aware team collaboration comments",
      "Review collaboration moderation queues and retention boundaries",
      "Send reminder and packet notices",
      "Request scoped parent e-signatures",
      "Create meeting calendar holds",
      "Record meeting recording readiness and transcript recap summaries",
      "Add meeting preparation notes",
      "Review assistive technology and transportation access supports",
      "Review educational placement and LRE implementation rationale",
      "Record draft-to-final meeting decisions",
      "Revise draft sections with version history",
      "Approve draft sections before export",
      "Review family comprehension checks",
      "Request formal compliance review",
      "Review previous/current IEP comparison items",
      "Record concern decisions and next steps"
    ],
    cannot: ["Finalize legally binding IEP changes without the IEP team"]
  },
  generalEducation: {
    label: "General Education Teacher",
    can: [
      "Review classroom-scale support roster",
      "View assigned accommodations",
      "View relevant plan summaries",
      "Copy teacher summaries and generate teacher handouts",
      "Add implementation notes",
      "Post source-aware team collaboration comments",
      "Enter classroom observations",
      "Add meeting preparation notes",
      "Mark checklist items complete"
    ],
    cannot: ["Modify the official IEP record", "View unrelated sensitive sections"]
  },
  relatedServiceProvider: {
    label: "Related Service Provider",
    can: [
      "View assigned related-service obligations",
      "Log delivered service minutes",
      "Plan missed-service recovery",
      "Acknowledge related implementation responsibilities",
      "Post source-aware team collaboration comments",
      "Record service-session observations",
      "Add meeting preparation notes",
      "Enter relevant progress evidence"
    ],
    cannot: ["Upload or approve official IEP records", "Resolve advisory compliance findings"]
  },
  parent: {
    label: "Parent / Guardian",
    can: [
      "View parent-friendly summaries",
      "View goals and progress summaries",
      "Access meeting prep documents",
      "Copy family summaries and generate family handouts",
      "Submit questions or concerns",
      "Acknowledge family resource-guide materials",
      "Record understanding checks tied to summary sections",
      "Post family-visible team collaboration comments",
      "Acknowledge meeting pre-read packets",
      "Sign scoped meeting packet attestations",
      "Request language access support",
      "Add meeting preparation notes"
    ],
    cannot: ["Edit official IEP data directly"]
  },
  student: {
    label: "Student",
    can: [
      "View student-friendly goals and supports",
      "Prepare self-advocacy notes",
      "Copy student summaries and generate student handouts",
      "Submit strengths and preferences",
      "Post student-visible team collaboration comments",
      "Acknowledge meeting pre-read packets",
      "Add meeting preparation notes",
      "Request language support"
    ],
    cannot: ["Change official plan requirements"]
  },
  administrator: {
    label: "Administrator / Reviewer",
    can: [
      "View compliance dashboards",
      "Review plans across caseloads",
      "Review classroom-scale support rosters",
      "Review source registry versions",
      "Administer source registry entries",
      "Review and revoke demo sessions",
      "Send reminder and packet notices",
      "Create meeting calendar holds",
      "Copy summaries and generate meeting handouts",
      "Resolve advisory flags",
      "Coordinate language-access status",
      "Coordinate companion-document readiness",
      "Coordinate family resource guide readiness",
      "Post source-aware team collaboration comments",
      "Review collaboration moderation queues and retention boundaries",
      "Record parent/student portal access verification",
      "Prepare scoped portal invitation packages",
      "Record draft-to-final meeting decisions",
      "Review family comprehension checks",
      "Record meeting recording readiness and transcript recap summaries",
      "Add meeting preparation notes",
      "Review assistive technology and transportation access supports",
      "Review educational placement and LRE implementation rationale",
      "Revise draft sections with version history",
      "Approve draft sections before export",
      "Request and complete formal compliance review",
      "Route formal reviews to district counsel",
      "Review previous/current IEP comparison items",
      "Run AI guardrail evaluations",
      "Review district integration readiness",
      "Manage accessibility remediation evidence",
      "Resolve concern decision records",
      "Create audit hash anchors",
      "Seal local retention manifests",
      "Review district retention policy decisions",
      "Review district export template mappings",
      "Request scoped parent e-signatures",
      "Export reports"
    ],
    cannot: ["Treat AI review as legal certification"]
  },
  schoolAdministrator: {
    label: "School Administrator",
    can: [
      "View school-level compliance dashboards",
      "Review assigned plans across the school caseload",
      "Review classroom-scale support rosters",
      "Resolve advisory implementation flags",
      "Coordinate required participants and companion documents",
      "Review assistive technology and transportation access supports",
      "Review educational placement and LRE implementation rationale",
      "Request and complete formal compliance review",
      "Record draft-to-final meeting decisions",
      "Request scoped parent e-signatures",
      "Record parent/student portal access verification",
      "Prepare scoped portal invitation packages",
      "Update staff continuity coverage plans",
      "Send reminder and packet notices",
      "Export school-level review reports"
    ],
    cannot: [
      "Upload or approve official IEP source extraction",
      "Administer district source registries or integrations",
      "Manage security sessions, audit anchors, AI governance, or retention settings",
      "Treat AI review as legal certification"
    ]
  },
  districtAdministrator: {
    label: "District Administrator",
    can: [
      "View district compliance dashboards",
      "Review plans across district caseloads",
      "Review classroom-scale support rosters",
      "Administer source registry entries and active source versions",
      "Review district integration readiness",
      "Run AI guardrail evaluations",
      "Manage accessibility remediation evidence",
      "Route formal reviews to district counsel",
      "Coordinate language-access status",
      "Record parent/student portal access verification",
      "Prepare scoped portal invitation packages",
      "Update staff continuity coverage plans",
      "Review district retention policy decisions",
      "Review district export template mappings",
      "Resolve concern decision records",
      "Export district review reports"
    ],
    cannot: [
      "Upload or approve official IEP source extraction",
      "Revoke security sessions or seal audit-retention manifests",
      "Act as a system security administrator",
      "Treat AI review as legal certification"
    ]
  },
  systemAdministrator: {
    label: "System Administrator",
    can: [
      "Review platform security posture",
      "Review and revoke demo sessions",
      "Create audit hash anchors",
      "Seal local retention manifests",
      "Review district retention policy decisions",
      "Review district export template mappings",
      "Review district tenancy and integration readiness",
      "Run AI guardrail evaluations",
      "Manage accessibility remediation evidence"
    ],
    cannot: [
      "View student IEP records unless separately assigned",
      "Edit official IEP data or approve source extraction",
      "Resolve student compliance findings or make education decisions",
      "Treat AI review as legal certification"
    ]
  },
  readOnlyReviewer: {
    label: "Read-Only Reviewer",
    can: [
      "View assigned students and review dashboards",
      "Review classroom-scale support roster evidence",
      "Review source-aligned summaries, checklists, progress, services, meetings, and advisory findings",
      "Review audit history and access-lens evidence",
      "Review parent/student portal access verification evidence",
      "Review previous/current IEP comparison language",
      "Review formal compliance-review status without recording outcomes"
    ],
    cannot: [
      "Upload, edit, approve, or replace official IEP records",
      "Generate or share summaries and handouts",
      "Enter progress, service logs, implementation notes, or meeting responses",
      "Resolve advisory flags or certify compliance",
      "Export reports or manage district, security, source-registry, AI, or retention settings"
    ]
  }
};

export const defaultSourceAlignment = {
  jurisdiction: "Pennsylvania",
  programArea: "School Age",
  sourceForm: "Individualized Education Program",
  sourceFormType: "Non-Annotated",
  sourceId: "pa-school-age-iep-non-annotated",
  effectiveDate: "2026-06-22",
  languagesAvailable: ["English"],
  languageAvailabilityNote: "District must verify current translated source availability before sharing family-facing packets.",
  sourceRegistryVersion: "PA-demo-2026.06"
};

export const sourceRegistry = {
  sourceRegistryVersion: "PA-demo-2026.06",
  jurisdiction: "Pennsylvania",
  programArea: "School Age",
  activeSourceId: "pa-school-age-iep-non-annotated",
  retrievedDate: "2026-06-22",
  reviewStatus: "Current",
  lastReviewedAt: "2026-06-22T10:00:00",
  nextReviewDate: "2026-09-22",
  reviewedBy: "D. Nguyen",
  reviewedByRole: "administrator",
  reviewNote:
    "Initial MVP registry seeded from the FDS source appendix. District administrators should verify source versions before production use.",
  registryUse:
    "Demo registry based on the FDS source appendix. Production deployments should maintain district-approved source versions.",
  fieldGuidance: [
    {
      id: "guidance-present-levels",
      sourceId: "pa-school-age-iep-annotated",
      section: "Present levels",
      structuredFields: ["currentPerformance"],
      fieldHelp:
        "Capture current academic and functional performance with enough context to connect needs, strengths, baseline data, and classroom impact.",
      validationPrompts: [
        "Does the field include current data or observation evidence?",
        "Can the need be traced to services, accommodations, goals, or supports?",
        "Is the language descriptive rather than diagnostic?"
      ],
      reviewPrompt:
        "Ask a qualified reviewer to confirm the present-level statement supports the selected goals and services without adding unstated conclusions.",
      draftingGuardrail:
        "Do not invent evaluation results, disability labels, or needs that are not in the preserved source."
    },
    {
      id: "guidance-goals-progress",
      sourceId: "pa-school-age-iep-annotated",
      section: "Goals and progress monitoring",
      structuredFields: ["goalsAndObjectives", "progressMonitoring"],
      fieldHelp:
        "Goals should expose condition, observable behavior, baseline, measurement method, mastery criterion, and reporting schedule for implementation.",
      validationPrompts: [
        "Is there a baseline and measurable criterion?",
        "Is the data-collection method clear enough for staff to collect evidence?",
        "Is the progress-reporting schedule visible to the team?"
      ],
      reviewPrompt:
        "Flag goals that are vague, lack baseline/method/criterion, or do not connect to progress-monitoring reminders.",
      draftingGuardrail:
        "Draft examples must remain advisory until a qualified team member reviews the measure and schedule."
    },
    {
      id: "guidance-services-supports",
      sourceId: "pa-school-age-iep-annotated",
      section: "Services, aids, and accommodations",
      structuredFields: ["services", "supplementaryAidsAndServices", "accommodations"],
      fieldHelp:
        "Implementation fields should make service type, frequency, duration, location, provider role, and accommodation conditions visible to responsible staff.",
      validationPrompts: [
        "Are frequency, duration, location, and provider role documented?",
        "Can each accommodation be assigned to a responsible role?",
        "Is there a way to document delivery, gaps, and recovery planning?"
      ],
      reviewPrompt:
        "Escalate missing service-grid details or supports that cannot be turned into an implementation task.",
      draftingGuardrail:
        "Do not change minutes, location, or service responsibility without IEP team review."
    },
    {
      id: "guidance-placement-assessments",
      sourceId: "pa-school-age-iep-annotated",
      section: "Special considerations, assessments, and placement",
      structuredFields: ["specialConsiderations", "stateAndLocalAssessments", "educationalPlacement", "behaviorSupportPlan"],
      fieldHelp:
        "Review special factors, assessment participation, accommodations, behavior supports, and placement rationale as separate source-grounded decisions.",
      validationPrompts: [
        "Are assessment accommodations tied to documented need and approved conditions?",
        "If behavior affects learning, is the support plan or absence of a plan clear?",
        "Does placement rationale cite the reviewed source rather than an assistant conclusion?"
      ],
      reviewPrompt:
        "Route ambiguous assessment, behavior, or placement language to human review before summaries or exports are treated as official.",
      draftingGuardrail:
        "The assistant may prepare questions or compare language, but it cannot make a final placement or service decision."
    }
  ],
  entries: [
    {
      sourceId: "pa-school-age-iep-non-annotated",
      title: "Individualized Education Program (IEP), School Age",
      issuingOrganization: "PaTTAN / Pennsylvania Department of Education",
      sourceType: "Form",
      sourceFormType: "Non-Annotated",
      programArea: "School Age",
      jurisdiction: "Pennsylvania",
      effectiveDate: "2026-06-22",
      retrievedDate: "2026-06-22",
      url: "https://www.pattan.net/Forms/Individualized-Education-Program-IEP-1-1",
      fileTypesAvailable: ["PDF", "DOCX"],
      languagesAvailable: ["English"],
      languageAvailabilityNote:
        "Track translated form availability from the PaTTAN forms hub before preparing family-facing packets.",
      productUse: ["Schema", "Extraction", "Validation", "Review", "Export"],
      reviewStatus: "Current",
      reviewNote: "Baseline school-age IEP form for structured records.",
      nextReviewDate: "2026-09-22",
      reviewedBy: "D. Nguyen",
      reviewedByRole: "administrator",
      reviewedAt: "2026-06-22T10:00:00"
    },
    {
      sourceId: "pa-school-age-iep-annotated",
      title: "Individualized Education Program (IEP) Annotated, School Age",
      issuingOrganization: "PaTTAN / Pennsylvania Department of Education",
      sourceType: "Annotated Form",
      sourceFormType: "Annotated",
      programArea: "School Age",
      jurisdiction: "Pennsylvania",
      effectiveDate: "2026-06-22",
      retrievedDate: "2026-06-22",
      url: "https://www.pattan.net/Forms/Individualized-Education-Program-IEP-1-1-1",
      fileTypesAvailable: ["PDF", "DOCX"],
      languagesAvailable: ["English"],
      languageAvailabilityNote:
        "Annotated guidance is tracked for field help; districts should verify any translated guidance before use.",
      productUse: ["Field Help", "Review", "Training", "Plain-Language Explanation"],
      reviewStatus: "Current",
      reviewNote: "Guidance source for field help, review prompts, and training.",
      nextReviewDate: "2026-09-22",
      reviewedBy: "D. Nguyen",
      reviewedByRole: "administrator",
      reviewedAt: "2026-06-22T10:00:00"
    },
    {
      sourceId: "pattan-special-education-gifted-forms-hub",
      title: "Special Education and Gifted Forms Hub",
      issuingOrganization: "PaTTAN",
      sourceType: "Guidance",
      sourceFormType: "Forms Hub",
      programArea: "School Age",
      jurisdiction: "Pennsylvania",
      effectiveDate: "2026-06-22",
      retrievedDate: "2026-06-22",
      url: "https://www.pattan.net/Special-Education-Forms/Special-Education-and-Gifted",
      fileTypesAvailable: ["HTML"],
      languagesAvailable: ["English", "Spanish"],
      languageAvailabilityNote:
        "Forms hub is the source-discovery checkpoint for multilingual availability and related packet documents.",
      productUse: ["Source Discovery", "Companion Resource Tracking", "Version Review"],
      reviewStatus: "Current",
      reviewNote: "Forms hub tracked for related notices and companion resource discovery.",
      nextReviewDate: "2026-08-22",
      reviewedBy: "D. Nguyen",
      reviewedByRole: "administrator",
      reviewedAt: "2026-06-22T10:00:00"
    },
    {
      sourceId: "pa-early-intervention-forms",
      title: "Pennsylvania Early Intervention Forms",
      issuingOrganization: "Pennsylvania Department of Education",
      sourceType: "Form",
      sourceFormType: "Early Intervention",
      programArea: "Preschool Early Intervention",
      jurisdiction: "Pennsylvania",
      effectiveDate: "2026-06-22",
      retrievedDate: "2026-06-22",
      url: "https://www.pa.gov/agencies/education/programs-and-services/instruction/early-learning/early-intervention/forms",
      fileTypesAvailable: ["PDF", "DOCX", "HTML"],
      languagesAvailable: ["English"],
      languageAvailabilityNote:
        "Early-intervention language availability is tracked separately from school-age source alignment.",
      productUse: ["Future Schema Extension", "Future Form Recognition"],
      reviewStatus: "Future expansion",
      reviewNote: "Tracked separately so early intervention forms do not get forced into the school-age schema.",
      nextReviewDate: "2026-12-01",
      reviewedBy: "D. Nguyen",
      reviewedByRole: "administrator",
      reviewedAt: "2026-06-22T10:00:00"
    }
  ]
};

const initialWorkspaceSeed = {
  ...createDefaultGapClosureWorkspace(),
  user: {
    id: "user-case-manager",
    name: "BJ Tarves",
    role: "caseManager",
    district: "Riverbend School District"
  },
  currentStudentId: "student-001",
  students: [
    {
      id: "student-001",
      firstName: "Jordan",
      lastName: "Lee",
      grade: "7",
      school: "Riverbend Middle School",
      caseManagerId: "user-case-manager",
      status: "Active",
      supportAreas: ["Reading", "Executive function"],
      annualReviewDate: "2026-07-01"
    },
    {
      id: "student-002",
      firstName: "Maya",
      lastName: "Chen",
      grade: "5",
      school: "Oakview Elementary",
      caseManagerId: "user-case-manager",
      status: "Active",
      supportAreas: ["Written expression"],
      annualReviewDate: "2026-07-07"
    },
    {
      id: "student-003",
      firstName: "Avery",
      lastName: "Brooks",
      grade: "3",
      school: "Pinecrest Elementary",
      caseManagerId: "user-case-manager",
      status: "Draft review",
      supportAreas: ["Speech-language"],
      annualReviewDate: "2026-07-18"
    },
    {
      id: "student-004",
      firstName: "Elijah",
      lastName: "Reed",
      grade: "10",
      school: "Riverbend High",
      caseManagerId: "user-case-manager",
      status: "Active",
      supportAreas: ["Transition planning"],
      annualReviewDate: "2026-07-10"
    }
  ],
  teacherClassroomRoster: [
    {
      id: "classroom-roster-001",
      linkedStudentId: "student-001",
      studentName: "Jordan Lee",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Active IEP linked",
      priority: "High",
      supportSummary: "Graphic organizer, extended time, chunked reading directions, and weekly reading evidence check.",
      accommodationCount: 4,
      taskCount: 3,
      overdueProgressCount: 1,
      serviceAlertCount: 1,
      nextAction: "Confirm the graphic organizer and extended-time routine before the Friday passage assessment.",
      sourceTrace: "Linked structured IEP record and teacher summary",
      officialRecordStatus: "Linked to approved source extraction",
      lastReviewedAt: "2026-06-21T09:20:00"
    },
    {
      id: "classroom-roster-002",
      linkedStudentId: "",
      studentName: "Sofia Alvarez",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Teacher summary imported",
      priority: "Medium",
      supportSummary: "Preferential seating, preview vocabulary, and shortened written response checkpoints.",
      accommodationCount: 3,
      taskCount: 1,
      overdueProgressCount: 0,
      serviceAlertCount: 0,
      nextAction: "Add vocabulary preview to Monday's lesson materials.",
      sourceTrace: "Teacher-facing implementation summary",
      officialRecordStatus: "Official IEP source not imported in demo",
      lastReviewedAt: "2026-06-20T14:10:00"
    },
    {
      id: "classroom-roster-003",
      linkedStudentId: "",
      studentName: "Noah Bennett",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Accommodation check due",
      priority: "High",
      supportSummary: "Reduced-copy notes, assessment breaks, and quiet-space option for longer writing tasks.",
      accommodationCount: 4,
      taskCount: 2,
      overdueProgressCount: 0,
      serviceAlertCount: 1,
      nextAction: "Confirm quiet-space availability with team before the unit essay.",
      sourceTrace: "Teacher-facing implementation summary",
      officialRecordStatus: "Official IEP source not imported in demo",
      lastReviewedAt: "2026-06-18T11:30:00"
    },
    {
      id: "classroom-roster-004",
      linkedStudentId: "",
      studentName: "Priya Shah",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Progress check due",
      priority: "Medium",
      supportSummary: "Sentence frames, verbal rehearsal before discussion, and rubric preview.",
      accommodationCount: 3,
      taskCount: 2,
      overdueProgressCount: 1,
      serviceAlertCount: 0,
      nextAction: "Collect short written-response sample for progress evidence.",
      sourceTrace: "Teacher-facing implementation summary",
      officialRecordStatus: "Official IEP source not imported in demo",
      lastReviewedAt: "2026-06-19T10:15:00"
    },
    {
      id: "classroom-roster-005",
      linkedStudentId: "",
      studentName: "Marcus Hill",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Active supports",
      priority: "Low",
      supportSummary: "Check for understanding, written directions, and peer discussion partner.",
      accommodationCount: 3,
      taskCount: 1,
      overdueProgressCount: 0,
      serviceAlertCount: 0,
      nextAction: "Keep written directions attached to the classwork packet.",
      sourceTrace: "Teacher-facing implementation summary",
      officialRecordStatus: "Official IEP source not imported in demo",
      lastReviewedAt: "2026-06-17T12:05:00"
    },
    {
      id: "classroom-roster-006",
      linkedStudentId: "",
      studentName: "Lina Patel",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Meeting prep needed",
      priority: "High",
      supportSummary: "Alternative response format, reduced copying, and teacher check-in at assignment launch.",
      accommodationCount: 4,
      taskCount: 3,
      overdueProgressCount: 1,
      serviceAlertCount: 0,
      nextAction: "Add classroom observation note before the team meeting packet is finalized.",
      sourceTrace: "Teacher-facing implementation summary",
      officialRecordStatus: "Official IEP source not imported in demo",
      lastReviewedAt: "2026-06-16T13:45:00"
    },
    {
      id: "classroom-roster-007",
      linkedStudentId: "",
      studentName: "Owen Garcia",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Active supports",
      priority: "Medium",
      supportSummary: "Chunked independent reading, read-aloud access for directions, and frequent task checks.",
      accommodationCount: 3,
      taskCount: 2,
      overdueProgressCount: 0,
      serviceAlertCount: 0,
      nextAction: "Flag any missed task checks in the daily support log.",
      sourceTrace: "Teacher-facing implementation summary",
      officialRecordStatus: "Official IEP source not imported in demo",
      lastReviewedAt: "2026-06-20T09:05:00"
    },
    {
      id: "classroom-roster-008",
      linkedStudentId: "",
      studentName: "Zoe Turner",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Accommodation verified",
      priority: "Low",
      supportSummary: "Extended time, organizer access, and assignment checklist for multi-step work.",
      accommodationCount: 3,
      taskCount: 0,
      overdueProgressCount: 0,
      serviceAlertCount: 0,
      nextAction: "Maintain checklist routine during the next reading project.",
      sourceTrace: "Teacher-facing implementation summary",
      officialRecordStatus: "Official IEP source not imported in demo",
      lastReviewedAt: "2026-06-22T08:55:00"
    },
    {
      id: "classroom-roster-009",
      linkedStudentId: "",
      studentName: "Camila Rivera",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Progress check due",
      priority: "Medium",
      supportSummary: "Model response, sentence starters, and comprehension-check conference.",
      accommodationCount: 3,
      taskCount: 2,
      overdueProgressCount: 1,
      serviceAlertCount: 0,
      nextAction: "Record comprehension conference note after Thursday small group.",
      sourceTrace: "Teacher-facing implementation summary",
      officialRecordStatus: "Official IEP source not imported in demo",
      lastReviewedAt: "2026-06-19T15:25:00"
    },
    {
      id: "classroom-roster-010",
      linkedStudentId: "",
      studentName: "Ethan Moore",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Service coordination",
      priority: "High",
      supportSummary: "Small-group reteach, visual timer, and speech-language carryover prompt.",
      accommodationCount: 4,
      taskCount: 3,
      overdueProgressCount: 0,
      serviceAlertCount: 1,
      nextAction: "Coordinate carryover language with related-service provider before Friday lesson.",
      sourceTrace: "Teacher-facing implementation summary",
      officialRecordStatus: "Official IEP source not imported in demo",
      lastReviewedAt: "2026-06-18T09:40:00"
    },
    {
      id: "classroom-roster-011",
      linkedStudentId: "",
      studentName: "Amina Johnson",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Teacher summary imported",
      priority: "Low",
      supportSummary: "Preview agenda, check-in during transitions, and alternate demonstration option.",
      accommodationCount: 3,
      taskCount: 1,
      overdueProgressCount: 0,
      serviceAlertCount: 0,
      nextAction: "Keep transition check-in visible on the class support list.",
      sourceTrace: "Teacher-facing implementation summary",
      officialRecordStatus: "Official IEP source not imported in demo",
      lastReviewedAt: "2026-06-21T10:20:00"
    },
    {
      id: "classroom-roster-012",
      linkedStudentId: "",
      studentName: "Caleb Smith",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Accommodation check due",
      priority: "Medium",
      supportSummary: "Text-to-speech access, reduced visual clutter, and step-by-step assignment launch.",
      accommodationCount: 4,
      taskCount: 2,
      overdueProgressCount: 0,
      serviceAlertCount: 0,
      nextAction: "Verify text-to-speech access on classroom devices.",
      sourceTrace: "Teacher-facing implementation summary",
      officialRecordStatus: "Official IEP source not imported in demo",
      lastReviewedAt: "2026-06-17T14:30:00"
    },
    {
      id: "classroom-roster-013",
      linkedStudentId: "",
      studentName: "Harper Nguyen",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Active supports",
      priority: "Low",
      supportSummary: "Organizer prompt, previewed questions, and flexible seating option.",
      accommodationCount: 3,
      taskCount: 0,
      overdueProgressCount: 0,
      serviceAlertCount: 0,
      nextAction: "Continue previewed question routine for Socratic seminar.",
      sourceTrace: "Teacher-facing implementation summary",
      officialRecordStatus: "Official IEP source not imported in demo",
      lastReviewedAt: "2026-06-22T11:00:00"
    },
    {
      id: "classroom-roster-014",
      linkedStudentId: "",
      studentName: "Miles Carter",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Progress check due",
      priority: "Medium",
      supportSummary: "Read-aloud for directions, guided notes, and quick response accuracy probe.",
      accommodationCount: 3,
      taskCount: 2,
      overdueProgressCount: 1,
      serviceAlertCount: 0,
      nextAction: "Enter quick accuracy probe after the independent reading block.",
      sourceTrace: "Teacher-facing implementation summary",
      officialRecordStatus: "Official IEP source not imported in demo",
      lastReviewedAt: "2026-06-18T15:10:00"
    },
    {
      id: "classroom-roster-015",
      linkedStudentId: "",
      studentName: "Elise Brown",
      grade: "7",
      school: "Riverbend Middle School",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      course: "Grade 7 English Language Arts",
      iepStatus: "Meeting prep needed",
      priority: "High",
      supportSummary: "Advance organizer, reduced writing volume, and alternate oral response option.",
      accommodationCount: 4,
      taskCount: 3,
      overdueProgressCount: 1,
      serviceAlertCount: 0,
      nextAction: "Prepare teacher feedback note for upcoming IEP-team meeting.",
      sourceTrace: "Teacher-facing implementation summary",
      officialRecordStatus: "Official IEP source not imported in demo",
      lastReviewedAt: "2026-06-16T10:45:00"
    }
  ],
  teacherClassroomReviews: [
    {
      id: "classroom-review-001",
      teacherUserId: "user-general-education",
      teacherName: "Leah Kim",
      classPeriod: "Period 2 ELA",
      reviewFocus: "Weekly accommodation scan",
      reviewedRosterIds: [
        "classroom-roster-001",
        "classroom-roster-002",
        "classroom-roster-003",
        "classroom-roster-004",
        "classroom-roster-005",
        "classroom-roster-006",
        "classroom-roster-007",
        "classroom-roster-008",
        "classroom-roster-009",
        "classroom-roster-010",
        "classroom-roster-011",
        "classroom-roster-012",
        "classroom-roster-013",
        "classroom-roster-014",
        "classroom-roster-015"
      ],
      reviewedCount: 15,
      highPriorityCount: 5,
      actionPlan:
        "Prioritize five high-need rows for assessment accommodations, service carryover, and meeting-prep notes before Friday.",
      followUpDate: "2026-06-28",
      sourceBoundary:
        "Classroom review summarizes teacher-facing implementation supports only; linked official IEP records remain the controlling source.",
      reviewedBy: "Leah Kim",
      reviewedByRole: "generalEducation",
      reviewedByUserId: "user-general-education",
      reviewedAt: "2026-06-21T09:30:00",
      reviewDigest: "seed-demo-classroom-roster-review"
    }
  ],
  sourceRegistry,
  documents: [
    {
      id: "doc-001",
      studentId: "student-001",
      name: "Jordan_Lee_IEP_2025-2026.pdf",
      type: "PDF",
      uploadedAt: "2026-06-12T08:42:00",
      uploadedBy: "A. Rivera",
      preserved: true,
      sourceAlignment: defaultSourceAlignment,
      ocrReview: {
        status: "Embedded text accepted",
        confidence: 92,
        reviewedTextExcerpt:
          "Present levels, goal, service, and accommodation language were readable from embedded text.",
        reviewerNote:
          "Seed source text is readable for demo extraction. Production scanned PDFs still require approved OCR and source-anchor review.",
        reviewedBy: "A. Rivera",
        reviewedByRole: "caseManager",
        reviewedAt: "2026-06-12T09:10:00",
        sourceAlignment: defaultSourceAlignment,
        officialRecordImpact:
          "OCR/source-quality review supports extraction fidelity only; it does not change the official IEP or replace the preserved source.",
        ocrDigest: "seed-ocr-review-digest"
      },
      sourceText:
        "Present levels: Jordan answers inferential questions with 55% accuracy independently and 72% with a graphic organizer and one verbal prompt. Goal: Given a grade-level passage and approved organizer, Jordan will answer literal and inferential questions with at least 80% accuracy across three consecutive weekly probes. Service: Speech-language support 30 minutes one time per week in a small group with the speech-language pathologist. Accommodation: Extended time for classroom assessments and written assignments, provided as needed."
    }
  ],
  ieps: [
    {
      id: "iep-001",
      studentId: "student-001",
      documentId: "doc-001",
      meetingDate: "2026-07-01",
      startDate: "2025-07-02",
      endDate: "2026-07-01",
      status: "Active",
      extractionApproved: true,
      sourceAlignment: defaultSourceAlignment,
      structuredRecord: {
        sourceAlignment: defaultSourceAlignment,
        studentInformation: {
          studentId: "student-001",
          name: "Jordan Lee",
          grade: "7",
          school: "Riverbend Middle School"
        },
        IEPTeam: [
          "Parent/guardian",
          "Jordan Lee",
          "Special education teacher",
          "General education teacher",
          "LEA representative",
          "Speech-language pathologist",
          "Reading specialist"
        ],
        specialConsiderations: {
          assistiveTechnology: "No dedicated device listed",
          behavior: "Executive-function routines require classroom support"
        },
        currentPerformance: {
          reading:
            "Jordan answers inferential questions with 55% accuracy independently and 72% with a graphic organizer and one verbal prompt.",
          executiveFunction:
            "Jordan independently completes three of five expected classroom routines."
        },
        educationalPlacement: {
          setting: "General education with supplemental supports",
          rationale: "Services can be delivered in general education and small-group settings."
        },
        transitionServices: {},
        stateAndLocalAssessments: {
          accommodations: ["Extended time", "Written directions", "Graphic organizer where permitted"]
        },
        behaviorSupportPlan: {},
        additionalInformation: {}
      }
    }
  ],
  extractionSections: [
    {
      id: "extract-present",
      studentId: "student-001",
      documentId: "doc-001",
      key: "currentPerformance.reading",
      title: "Present levels - Reading",
      sourceSection: "III. Present Levels",
      sourceReference: "Page 8, paragraph 2",
      confidence: 98,
      status: "Confirmed",
      sourceAlignment: defaultSourceAlignment,
      content:
        "Jordan answers inferential questions with 55% accuracy independently and 72% with a graphic organizer and one verbal prompt."
    },
    {
      id: "extract-goal",
      studentId: "student-001",
      documentId: "doc-001",
      key: "goalsAndObjectives[0]",
      title: "Annual goal - Reading comprehension",
      sourceSection: "V. Goals and Objectives",
      sourceReference: "Page 12, goal 1",
      confidence: 99,
      status: "Confirmed",
      sourceAlignment: defaultSourceAlignment,
      content:
        "Given a grade-level passage and approved organizer, Jordan will answer literal and inferential questions with at least 80% accuracy across three consecutive weekly probes."
    },
    {
      id: "extract-service",
      studentId: "student-001",
      documentId: "doc-001",
      key: "services[0]",
      title: "Related service - Speech-language",
      sourceSection: "VI. Services and Supplementary Aids",
      sourceReference: "Page 15, service grid",
      confidence: 97,
      status: "Confirmed",
      sourceAlignment: defaultSourceAlignment,
      content: "30 minutes, one time per week, small group, speech-language pathologist."
    },
    {
      id: "extract-accommodation",
      studentId: "student-001",
      documentId: "doc-001",
      key: "accommodations[0]",
      title: "Accommodation - Extended time",
      sourceSection: "VI. Services and Supplementary Aids",
      sourceReference: "Page 16, accommodations",
      confidence: 74,
      status: "Needs review",
      sourceAlignment: defaultSourceAlignment,
      content: "Extended time for classroom assessments and written assignments, provided as needed.",
      warning:
        "The source does not state the amount of additional time or the trigger. Do not infer a multiplier."
    }
  ],
  goals: [
    {
      id: "goal-001",
      iepId: "iep-001",
      domain: "Reading",
      presentLevelReference: "currentPerformance.reading",
      baseline: "55% independent accuracy",
      annualGoal:
        "Jordan will answer literal and inferential questions with at least 80% accuracy across three consecutive weekly probes.",
      measurementMethod: "Weekly comprehension probe",
      frequency: "Weekly",
      criteriaForMastery: "80% accuracy across 3 consecutive probes",
      responsibleStaff: ["Reading Specialist", "Case Manager"],
      status: "On track",
      sourceReference: "Page 12, goal 1",
      progressSchedule: {
        frequency: "Weekly",
        nextDueDate: "2026-06-19",
        lastCollectedDate: "2026-06-12",
        status: "Overdue",
        evidenceType: "Comprehension probe",
        evidenceRequired: true,
        responsibleRole: "Reading Specialist"
      },
      progressEntries: [
        { id: "progress-001", date: "2026-05-15", value: 62, notes: "Organizer used with one prompt", enteredBy: "A. Rivera" },
        { id: "progress-002", date: "2026-05-22", value: 65, notes: "Literal questions stronger than inferential", enteredBy: "A. Rivera" },
        { id: "progress-003", date: "2026-05-29", value: 68, notes: "Improved evidence use", enteredBy: "M. Gomez" },
        { id: "progress-004", date: "2026-06-05", value: 70, notes: "Used organizer independently", enteredBy: "M. Gomez" },
        {
          id: "progress-005",
          date: "2026-06-12",
          value: 72,
          notes: "Two inferential errors",
          enteredBy: "M. Gomez",
          evidenceDocumentId: "doc-001",
          evidenceLabel: "Weekly reading comprehension probe",
          evidenceType: "Comprehension probe"
        }
      ]
    },
    {
      id: "goal-002",
      iepId: "iep-001",
      domain: "Written expression",
      presentLevelReference: "currentPerformance.writing",
      baseline: "2.4 organization rubric",
      annualGoal:
        "Jordan will plan and write a multi-paragraph response scoring at least 4.0 on the approved organization rubric.",
      measurementMethod: "Monthly writing sample scored with rubric",
      frequency: "Monthly",
      criteriaForMastery: "4.0 rubric score on 2 consecutive samples",
      responsibleStaff: ["English Teacher", "Case Manager"],
      status: "Monitor closely",
      sourceReference: "Page 13, goal 2",
      progressSchedule: {
        frequency: "Monthly",
        nextDueDate: "2026-06-30",
        lastCollectedDate: "2026-05-30",
        status: "Due soon",
        evidenceType: "Writing sample scored with rubric",
        evidenceRequired: true,
        responsibleRole: "English Teacher"
      },
      progressEntries: [
        { id: "progress-006", date: "2026-04-30", value: 2.8, notes: "Prompted outline", enteredBy: "A. Rivera" },
        { id: "progress-007", date: "2026-05-30", value: 3.1, notes: "Better topic sentences", enteredBy: "A. Patel" }
      ]
    },
    {
      id: "goal-003",
      iepId: "iep-001",
      domain: "Executive function",
      presentLevelReference: "currentPerformance.executiveFunction",
      baseline: "3 of 5 routines",
      annualGoal: "Jordan will complete four of five classroom routines independently across two consecutive weeks.",
      measurementMethod: "Weekly five-routine teacher rating",
      frequency: "Weekly",
      criteriaForMastery: "4 of 5 routines across 2 consecutive weeks",
      responsibleStaff: ["General Education Teachers", "Case Manager"],
      status: "Insufficient data",
      sourceReference: "Page 14, goal 3",
      progressSchedule: {
        frequency: "Weekly",
        nextDueDate: "2026-06-14",
        lastCollectedDate: "2026-06-07",
        status: "Overdue",
        evidenceType: "Five-routine teacher rating",
        evidenceRequired: true,
        responsibleRole: "General Education Teacher"
      },
      progressEntries: [
        { id: "progress-008", date: "2026-06-07", value: 3, notes: "Planner setup still needs prompt", enteredBy: "L. Kim" }
      ]
    }
  ],
  services: [
    {
      id: "service-001",
      iepId: "iep-001",
      serviceType: "Speech-language support",
      frequency: "1x/week",
      duration: 30,
      location: "Small group",
      providerRole: "Speech-Language Pathologist",
      provider: "R. Coleman",
      startDate: "2025-07-02",
      endDate: "2026-07-01",
      evidenceRequired: true,
      loggingRequirement: "Service delivery minutes must be logged monthly; missed minutes require recovery planning.",
      sourceReference: "Page 15, service grid",
      deliveredMinutes: 90,
      scheduledMinutes: 120,
      recoveryStatus: "Recovery needed",
      recoveryPlan: {
        status: "Needed",
        missedMinutes: 30,
        recoveryDate: "",
        provider: "",
        familyCommunication: "",
        plannedBy: "",
        plannedAt: ""
      }
    },
    {
      id: "service-002",
      iepId: "iep-001",
      serviceType: "Reading support",
      frequency: "3x/week",
      duration: 30,
      location: "Small group",
      providerRole: "Reading Specialist",
      provider: "A. Rivera",
      startDate: "2025-07-02",
      endDate: "2026-07-01",
      evidenceRequired: true,
      loggingRequirement: "Service delivery minutes must be logged monthly.",
      sourceReference: "Page 15, service grid",
      deliveredMinutes: 120,
      scheduledMinutes: 120,
      recoveryStatus: "On schedule",
      recoveryPlan: {
        status: "Not needed",
        missedMinutes: 0,
        recoveryDate: "",
        provider: "",
        familyCommunication: "",
        plannedBy: "",
        plannedAt: ""
      }
    },
    {
      id: "service-003",
      iepId: "iep-001",
      serviceType: "Executive-function coaching",
      frequency: "2x/week",
      duration: 15,
      location: "Individual",
      providerRole: "Case Manager",
      provider: "A. Rivera",
      startDate: "2025-07-02",
      endDate: "2026-07-01",
      evidenceRequired: true,
      loggingRequirement: "Service delivery minutes and coaching notes must be logged monthly.",
      sourceReference: "Page 15, support grid",
      deliveredMinutes: 60,
      scheduledMinutes: 60,
      recoveryStatus: "On schedule",
      recoveryPlan: {
        status: "Not needed",
        missedMinutes: 0,
        recoveryDate: "",
        provider: "",
        familyCommunication: "",
        plannedBy: "",
        plannedAt: ""
      }
    }
  ],
  accommodations: [
    {
      id: "acc-001",
      iepId: "iep-001",
      description: "Provide written directions with verbal directions for multi-step tasks.",
      setting: "Classroom",
      responsibleRole: "General Education Teacher",
      frequency: "Daily",
      startDate: "2025-07-02",
      endDate: "2026-07-01",
      evidenceRequired: false,
      sourceReference: "Page 16, accommodations"
    },
    {
      id: "acc-002",
      iepId: "iep-001",
      description: "Make the approved graphic organizer available for reading tasks.",
      setting: "Classroom reading activities",
      responsibleRole: "General Education Teacher",
      frequency: "As needed",
      startDate: "2025-07-02",
      endDate: "2026-07-01",
      evidenceRequired: true,
      sourceReference: "Page 16, accommodations"
    },
    {
      id: "acc-003",
      iepId: "iep-001",
      description: "Provide extended time for classroom assessments and written assignments as written.",
      setting: "Classroom and assessment",
      responsibleRole: "General Education Teacher",
      frequency: "As needed",
      startDate: "2025-07-02",
      endDate: "2026-07-01",
      evidenceRequired: false,
      sourceReference: "Page 16, accommodations",
      ambiguity: "Amount and trigger are not specified in source text."
    }
  ],
  accessSupportPlans: [
    {
      id: "access-at-organizer",
      studentId: "student-001",
      iepId: "iep-001",
      supportType: "Assistive technology",
      requirement: "Graphic organizer and written directions are available for reading and multi-step classroom tasks.",
      implementationPlan:
        "Confirm the organizer format, storage location, and staff prompt routine before the annual review.",
      responsibleRole: "Case Manager",
      status: "Needs review",
      reviewNote:
        "The source names organizer access but does not list a dedicated device; confirm whether any assistive-technology consideration should be documented.",
      sourceReference: "Special considerations and accommodations",
      sourceAlignment: defaultSourceAlignment,
      reviewedBy: "A. Rivera",
      reviewedByRole: "caseManager",
      reviewedAt: "2026-06-21T11:00:00",
      supportDigest: "seed-access-support-at-digest",
      officialRecordImpact:
        "Access-support review note only; official IEP AT decisions remain controlled by the reviewed source document and IEP team."
    },
    {
      id: "access-transportation",
      studentId: "student-001",
      iepId: "iep-001",
      supportType: "Transportation",
      requirement: "No specialized transportation service is documented in the current school-age IEP record.",
      implementationPlan:
        "Keep transportation marked not required unless the IEP team documents a transportation need or related service.",
      responsibleRole: "Case Manager",
      status: "Not required",
      reviewNote:
        "Transportation remains visible so teams do not confuse absence of a documented service with an unresolved extraction gap.",
      sourceReference: "Related services and additional information",
      sourceAlignment: defaultSourceAlignment,
      reviewedBy: "A. Rivera",
      reviewedByRole: "caseManager",
      reviewedAt: "2026-06-21T11:05:00",
      supportDigest: "seed-access-support-transport-digest",
      officialRecordImpact:
        "Access-support review note only; official IEP transportation decisions remain controlled by the reviewed source document and IEP team."
    }
  ],
  placementReviews: [
    {
      id: "placement-review-001",
      studentId: "student-001",
      iepId: "iep-001",
      setting: "General education with supplemental supports",
      rationale: "Services can be delivered in general education and small-group settings.",
      lreConsideration:
        "Small-group service delivery is documented alongside continued access to general education routines and accommodations.",
      implementationImpact:
        "Coordinate reading, speech-language, and executive-function supports so pull-out minutes do not obscure classroom accommodation responsibilities.",
      followUpOwner: "Case Manager",
      nextReviewDate: "2026-07-01",
      status: "Needs review",
      reviewerNote:
        "Review whether the placement rationale is clear enough for staff and family meeting preparation without making a new placement decision.",
      sourceReference: "Educational placement",
      sourceAlignment: defaultSourceAlignment,
      reviewedBy: "A. Rivera",
      reviewedByRole: "caseManager",
      reviewedAt: "2026-06-21T11:10:00",
      placementDigest: "seed-placement-review-digest",
      officialRecordImpact:
        "Placement review note only; official placement and LRE decisions remain controlled by the reviewed source document and IEP team."
    }
  ],
  portalAccessReviews: [
    {
      id: "portal-access-review-001",
      studentId: "student-001",
      subjectRole: "Parent/Guardian",
      subjectName: "Robin Lee",
      accessStatus: "Access verified",
      verificationMethod: "District portal check",
      identityEvidence:
        "Guardian account matched student assignment, preferred language, and family packet visibility scope.",
      languageSupportNeeded: "No",
      privacyNote:
        "Family-visible materials reviewed; internal staff notes and staff-only collaboration threads remain restricted.",
      reviewedBy: "A. Rivera",
      reviewedByRole: "caseManager",
      reviewedByUserId: "user-case-manager",
      reviewedAt: "2026-06-21T11:15:00",
      sourceReference: "Parent/student portal access and privacy review",
      sourceAlignment: defaultSourceAlignment,
      reviewDigest: "seed-portal-access-review-digest",
      officialRecordImpact:
        "Portal access review controls workspace account readiness only; it does not change the official IEP or replace district identity proofing."
    }
  ],
  portalInvitationPackages: [
    {
      id: "portal-invitation-001",
      studentId: "student-001",
      subjectRole: "Parent/Guardian",
      subjectName: "Robin Lee",
      status: "Prepared for review",
      deliveryChannel: "District portal invite",
      expiresAt: "2026-06-30",
      scopeSummary:
        "Family summary, goals, progress summaries, meeting packet acknowledgments, and family-visible collaboration only.",
      identityVerificationSummary:
        "Prepared from staff portal access review; production identity-provider verification is still required before sending.",
      languageSupportNote: "No additional language support requested.",
      privacyBoundary:
        "Internal identity evidence, staff-only collaboration, compliance review, and unrelated student records remain restricted.",
      providerReference: "demo-provider-queue-001",
      preparedBy: "A. Rivera",
      preparedByRole: "caseManager",
      preparedByUserId: "user-case-manager",
      preparedAt: "2026-06-21T11:20:00",
      sourceReference: "Parent/student portal invitation readiness package",
      sourceAlignment: defaultSourceAlignment,
      invitationDigest: "seed-portal-invitation-digest",
      officialRecordImpact:
        "Portal invitation package documents local access readiness only; it does not send a production invitation, prove identity, or change the official IEP."
    }
  ],
  tasks: [
    {
      id: "task-001",
      studentId: "student-001",
      sourceSection: "Services",
      title: "Assign speech-language service recovery plan",
      description: "Document how 30 missed minutes will be recovered and notify the case manager.",
      responsibleRole: "Related Service Provider",
      frequency: "One time",
      evidenceRequired: true,
      status: "Active",
      dueDate: "2026-06-23",
      assignedTo: "R. Coleman",
      category: "related",
      sourceAlignment: defaultSourceAlignment
    },
    {
      id: "task-002",
      studentId: "student-001",
      sourceSection: "Accommodations",
      title: "Provide written directions with verbal directions",
      description: "Use for multi-step classroom tasks and check for understanding before independent work.",
      responsibleRole: "General Education Teacher",
      frequency: "Daily",
      evidenceRequired: false,
      status: "Active",
      dueDate: "Ongoing",
      assignedTo: "Core teachers",
      category: "generalEducation",
      sourceAlignment: defaultSourceAlignment,
      acknowledgments: [
        {
          acknowledgedBy: "Anika Patel",
          acknowledgedByRole: "generalEducation",
          acknowledgedAt: "2026-06-20T09:10:00",
          note: "English class routines updated."
        },
        {
          acknowledgedBy: "Marco Gomez",
          acknowledgedByRole: "generalEducation",
          acknowledgedAt: "2026-06-19T14:30:00",
          note: "Math directions template adjusted."
        }
      ]
    },
    {
      id: "task-003",
      studentId: "student-001",
      sourceSection: "Progress Monitoring",
      title: "Collect executive-function teacher rating",
      description: "Complete the five-routine rating form and attach one observation note.",
      responsibleRole: "General Education Teacher",
      frequency: "Weekly",
      evidenceRequired: true,
      status: "Active",
      dueDate: "2026-06-27",
      assignedTo: "L. Kim",
      category: "generalEducation",
      sourceAlignment: defaultSourceAlignment,
      acknowledgments: [],
      observations: [
        {
          id: "observation-001",
          observedAt: "2026-06-18",
          context: "Science lab routine",
          note: "Jordan started after seeing the first two steps modeled and used the checklist for cleanup.",
          supportUsed: "Visual checklist and first-step model",
          enteredBy: "Leah Kim",
          enteredByRole: "generalEducation",
          enteredAt: "2026-06-18T15:20:00"
        }
      ]
    },
    {
      id: "task-004",
      studentId: "student-001",
      sourceSection: "Family Communication",
      title: "Send family progress update",
      description: "Share current reading trend and next data collection point.",
      responsibleRole: "Case Manager",
      frequency: "Each grading period",
      evidenceRequired: true,
      status: "Completed",
      dueDate: "2026-06-14",
      assignedTo: "A. Rivera",
      category: "caseManager",
      sourceAlignment: defaultSourceAlignment,
      completionEvidence: {
        completedBy: "A. Rivera",
        completedByRole: "caseManager",
        completedAt: "2026-06-14T12:05:00",
        note: "Family update sent with current reading trend.",
        evidenceDocumentId: "doc-001",
        evidenceLabel: "Family progress update sent"
      },
      acknowledgments: [
        {
          acknowledgedBy: "A. Rivera",
          acknowledgedByRole: "caseManager",
          acknowledgedAt: "2026-06-14T12:05:00",
          note: "Family update sent with current reading trend."
        }
      ]
    }
  ],
  meetings: [
    {
      id: "meeting-001",
      studentId: "student-001",
      type: "Annual IEP",
      date: "2026-07-01",
      time: "10:00 AM",
      readiness: 78,
      participants: [
        "Parent/guardian",
        "Jordan Lee",
        "Case manager",
        "General education teacher",
        "LEA representative",
        "SLP"
      ],
      requiredParticipants: [
        {
          id: "participant-parent",
          role: "Parent/guardian",
          name: "Robin Lee",
          required: true,
          status: "Confirmed",
          mode: "In person",
          note: "Family confirmed attendance.",
          confirmedBy: "A. Rivera",
          confirmedAt: "2026-06-21T12:00:00"
        },
        {
          id: "participant-student",
          role: "Student",
          name: "Jordan Lee",
          required: false,
          status: "Confirmed",
          mode: "In person",
          note: "Student plans to share self-advocacy note.",
          confirmedBy: "A. Rivera",
          confirmedAt: "2026-06-21T12:05:00"
        },
        {
          id: "participant-case-manager",
          role: "Special education teacher / case manager",
          name: "A. Rivera",
          required: true,
          status: "Confirmed",
          mode: "In person",
          note: "Will facilitate goals, services, and progress review.",
          confirmedBy: "BJ Tarves",
          confirmedAt: "2026-06-21T13:00:00"
        },
        {
          id: "participant-general-education",
          role: "General education teacher",
          name: "L. Kim",
          required: true,
          status: "Invited",
          mode: "Video option",
          note: "Needs confirmation for core-content accommodation discussion.",
          confirmedBy: "",
          confirmedAt: ""
        },
        {
          id: "participant-lea",
          role: "LEA representative",
          name: "D. Nguyen",
          required: true,
          status: "Invited",
          mode: "In person",
          note: "Required for placement and resource decisions.",
          confirmedBy: "",
          confirmedAt: ""
        },
        {
          id: "participant-slp",
          role: "Speech-language pathologist",
          name: "R. Coleman",
          required: false,
          status: "Invited",
          mode: "Video option",
          note: "Needed for missed-service recovery discussion.",
          confirmedBy: "",
          confirmedAt: ""
        }
      ],
      agenda: [
        "Family priorities and communication needs",
        "Student strengths and self-advocacy",
        "Current performance, progress evidence, and services delivered",
        "Proposed goals, services, accommodations, and placement",
        "Next steps and unresolved questions"
      ],
      familyQuestions: [
        {
          id: "question-001",
          text: "How will recent reading data change the support plan?",
          status: "Open",
          assignedTo: "A. Rivera"
        },
        {
          id: "question-002",
          text: "Can Jordan use the organizer in science and social studies?",
          status: "Answered",
          assignedTo: "L. Kim"
        }
      ],
      meetingPrepNotes: [
        {
          id: "prep-note-parent-001",
          topic: "Parent notes area",
          body: "Family wants the team to explain the missed speech-language recovery plan and how progress will be shared after the meeting.",
          audience: "IEP team",
          submittedBy: "Robin Lee",
          submittedByRole: "parent",
          submittedAt: "2026-06-21T15:35:00",
          sourceReference: "Parent pre-meeting notes area",
          sourceAlignment: defaultSourceAlignment,
          officialRecordImpact:
            "Meeting preparation note only; does not change official IEP obligations or final team decisions."
        }
      ],
      concerns: [
        {
          id: "concern-001",
          title: "Missed speech-language minutes",
          concern: "Family wants to know when the missed June 18 speech-language minutes will be recovered.",
          status: "Open",
          submittedBy: "Robin Lee",
          submittedByRole: "parent",
          submittedAt: "2026-06-21T15:30:00",
          owner: "A. Rivera",
          response: "",
          decision: "",
          nextStep: "Assign recovery date and communicate the plan before the meeting.",
          priorWrittenNotice: "Not triggered by this concern alone; staff should review if service changes are proposed."
        }
      ],
      draftDiffs: [
        {
          id: "diff-001",
          section: "Services",
          sourceReference: "Page 15, service grid + service delivery log",
          proposedBy: "A. Rivera",
          proposedAt: "2026-06-21T16:10:00",
          draftText: "Discuss how the missed June 18 speech-language minutes will be recovered before the annual review.",
          finalText: "",
          decisionRationale: "",
          status: "Needs decision",
          finalizedBy: "",
          finalizedAt: ""
        },
        {
          id: "diff-002",
          section: "Accommodations",
          sourceReference: "Page 16, accommodations",
          proposedBy: "L. Kim",
          proposedAt: "2026-06-20T14:00:00",
          draftText: "Clarify that Jordan may use the graphic organizer in science and social studies reading tasks.",
          finalText: "Team will review cross-content organizer use during the annual meeting and preserve current accommodation language until agreed.",
          decisionRationale: "Family question is answered in the pre-read packet; any official change remains a team decision.",
          status: "Finalized",
          finalizedBy: "BJ Tarves",
          finalizedAt: "2026-06-21T17:00:00"
        }
      ],
      packetAcknowledgments: [
        {
          id: "packet-parent-robin",
          audienceRole: "parent",
          label: "Parent/guardian pre-read packet",
          packetTitle: "Annual IEP pre-read packet",
          participantName: "Robin Lee",
          status: "Sent",
          sentAt: "2026-06-22T09:00:00",
          responseNote: "Awaiting family review of the meeting packet.",
          sourceReference: "Meeting invitation, family summary handout, and draft-to-final change log",
          sourceAlignment: defaultSourceAlignment,
          acknowledgedBy: "",
          acknowledgedByRole: "",
          acknowledgedAt: ""
        },
        {
          id: "packet-student-jordan",
          audienceRole: "student",
          label: "Student pre-read packet",
          packetTitle: "Student-friendly goals and self-advocacy prep",
          participantName: "Jordan Lee",
          status: "Reviewed",
          sentAt: "2026-06-22T09:05:00",
          responseNote: "Jordan reviewed the goals and wants to practice the organizer request.",
          sourceReference: "Student summary and self-advocacy agenda item",
          sourceAlignment: defaultSourceAlignment,
          acknowledgedBy: "Jordan Lee",
          acknowledgedByRole: "student",
          acknowledgedAt: "2026-06-22T12:30:00"
        }
      ],
      eSignatureRequests: [],
      studentVoice:
        "I understand more when I can see the steps and know what finished work should look like.",
      selfAdvocacyPlan: {
        preferredSupport: "Graphic organizer and written directions",
        participationGoal: "Explain which support helps me start reading tasks before the team discusses accommodations.",
        requestScript: "I can say, 'Can I use my organizer and see the written directions before I start?'",
        confidence: 3,
        barrier: "I sometimes forget to ask before the assignment starts.",
        nextStep: "Practice the request with the case manager before the meeting.",
        sourceReference: "Student strengths and self-advocacy agenda item",
        sourceAlignment: defaultSourceAlignment,
        updatedBy: "Jordan Lee",
        updatedByRole: "student",
        updatedAt: "2026-06-21T12:05:00"
      },
      languageAccess: {
        preferredLanguage: "English",
        interpreterNeeded: false,
        translationStatus: "Not requested",
        interpreterStatus: "Not needed",
        requestedBy: null,
        requestedAt: null,
        requestNote: "",
        coordinatorNote: "No language support request is active for this meeting.",
        translatedSummary: null,
        glossary: [
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
        ]
      },
      companionDocuments: [
        {
          id: "companion-invitation",
          title: "Meeting invitation",
          documentType: "Invitation to Participate",
          purpose: "Documents meeting date, format, and required participation planning.",
          status: "Sent",
          owner: "A. Rivera",
          dueDate: "2026-06-17",
          sourceReference: "PaTTAN forms hub · meeting invitation",
          sourceAlignment: defaultSourceAlignment,
          productUse: ["Meeting Preparation", "Family Participation"],
          reviewedBy: "A. Rivera",
          reviewedAt: "2026-06-17T09:00:00",
          note: "Invitation sent with in-person and video participation options."
        },
        {
          id: "companion-procedural-safeguards",
          title: "Procedural safeguards notice",
          documentType: "Procedural Safeguards",
          purpose: "Confirms family access to rights information before the IEP meeting.",
          status: "Available",
          owner: "A. Rivera",
          dueDate: "2026-06-24",
          sourceReference: "PaTTAN forms hub · procedural safeguards",
          sourceAlignment: defaultSourceAlignment,
          productUse: ["Family Participation", "Companion Resource Tracking"],
          reviewedBy: "",
          reviewedAt: "",
          note: "Confirm whether the family needs another copy before the meeting."
        },
        {
          id: "companion-norep-pwn",
          title: "NOREP/PWN support check",
          documentType: "Notice of Recommended Educational Placement / Prior Written Notice",
          purpose: "Flags when proposed or refused changes may need formal notice support.",
          status: "Review if change proposed",
          owner: "BJ Tarves",
          dueDate: "2026-07-01",
          sourceReference: "PaTTAN forms hub · NOREP/PWN",
          sourceAlignment: defaultSourceAlignment,
          productUse: ["Decision Record", "PWN Support"],
          reviewedBy: "",
          reviewedAt: "",
          note: "Concern responses are not a NOREP/PWN by themselves; review if the team proposes or refuses a formal IEP change."
        }
      ],
      familyResources: [
        {
          id: "resource-procedural-safeguards",
          audienceRole: "parent",
          title: "Procedural safeguards and rights overview",
          category: "Rights and safeguards",
          purpose: "Helps the family know where rights, notice, consent, and dispute-resolution protections are explained before the IEP meeting.",
          status: "Available",
          owner: "A. Rivera",
          dueDate: "2026-06-24",
          sourceReference: "PaTTAN forms hub · procedural safeguards and Pennsylvania family resources",
          sourceAlignment: defaultSourceAlignment,
          suggestedQuestions: [
            "Which notices or consent steps should we expect after the meeting?",
            "Who can explain dispute-resolution options if we disagree?"
          ],
          familyStatus: "Not reviewed",
          familyNote: "Awaiting family review before the annual meeting.",
          acknowledgedBy: "",
          acknowledgedByRole: "",
          acknowledgedAt: "",
          reviewedBy: "A. Rivera",
          reviewedByRole: "caseManager",
          reviewedAt: "2026-06-22T09:10:00",
          note: "Offer another copy and interpreter-supported explanation if requested.",
          officialRecordImpact:
            "Resource-guide tracking confirms access and questions only; it does not replace procedural safeguards, legal advice, consent, or IEP team decisions."
        },
        {
          id: "resource-parent-questions",
          audienceRole: "parent",
          title: "Parent meeting question guide",
          category: "Meeting preparation",
          purpose: "Turns the plain-language summary, progress data, and service logs into questions the family may want to raise.",
          status: "Sent",
          owner: "BJ Tarves",
          dueDate: "2026-06-25",
          sourceReference: "Family summary, progress schedules, service delivery log, and meeting agenda",
          sourceAlignment: defaultSourceAlignment,
          suggestedQuestions: [
            "How will missed service minutes be recovered?",
            "How will reading progress be shared after the meeting?",
            "Which supports should carry over into science and social studies?"
          ],
          familyStatus: "Needs explanation",
          familyNote: "Family wants help prioritizing questions before the meeting.",
          acknowledgedBy: "Robin Lee",
          acknowledgedByRole: "parent",
          acknowledgedAt: "2026-06-23T18:45:00",
          reviewedBy: "BJ Tarves",
          reviewedByRole: "caseManager",
          reviewedAt: "2026-06-22T09:20:00",
          note: "Use during the pre-meeting check-in and connect unanswered questions to the family question log.",
          officialRecordImpact:
            "Question guide supports meeting preparation only; it does not amend services, placement, or required notices."
        },
        {
          id: "resource-student-participation",
          audienceRole: "student",
          title: "Student participation script",
          category: "Student voice",
          purpose: "Helps Jordan practice how to share strengths, supports, and questions during the meeting.",
          status: "Available",
          owner: "A. Rivera",
          dueDate: "2026-06-26",
          sourceReference: "Student summary and self-advocacy agenda item",
          sourceAlignment: defaultSourceAlignment,
          suggestedQuestions: [
            "Which support helps me start reading tasks?",
            "When should I ask to use my organizer?"
          ],
          familyStatus: "Reviewed",
          familyNote: "Jordan wants to practice the organizer request.",
          acknowledgedBy: "Jordan Lee",
          acknowledgedByRole: "student",
          acknowledgedAt: "2026-06-22T12:30:00",
          reviewedBy: "A. Rivera",
          reviewedByRole: "caseManager",
          reviewedAt: "2026-06-22T09:25:00",
          note: "Practice before the meeting and preserve final decisions in the meeting record.",
          officialRecordImpact:
            "Student participation script supports self-advocacy preparation only; final IEP decisions remain with the IEP team."
        }
      ]
    }
  ],
  reviewFlags: [
    {
      id: "flag-001",
      studentId: "student-001",
      severity: "High",
      section: "Services",
      issue: "Missed service minutes do not have a recovery plan",
      whyItMatters:
        "Thirty speech-language minutes were missed on June 18. No recovery date, provider, or family communication has been recorded.",
      suggestedRevision:
        "Assign a recovery date, provider, and family communication note.",
      sourceReference: "Service requirement + delivery log",
      humanReviewRequired: true,
      status: "Open",
      sourceAlignment: defaultSourceAlignment
    },
    {
      id: "flag-002",
      studentId: "student-001",
      severity: "Medium",
      section: "Accommodations",
      issue: "Extended-time accommodation lacks implementation specificity",
      whyItMatters:
        "The source says extended time as needed but does not specify an amount or operational trigger.",
      suggestedRevision:
        "Clarify the implementation note through the IEP team. Do not infer a multiplier.",
      sourceReference: "Page 16, accommodations",
      humanReviewRequired: true,
      status: "Open",
      sourceAlignment: defaultSourceAlignment
    },
    {
      id: "flag-003",
      studentId: "student-001",
      severity: "Medium",
      section: "Progress Monitoring",
      issue: "Executive-function progress evidence is stale",
      whyItMatters:
        "The plan calls for weekly observation data. The most recent confirmed rating is more than one week old.",
      suggestedRevision: "Collect the current teacher rating or document why data is unavailable.",
      sourceReference: "Goal 3 + progress schedule",
      humanReviewRequired: true,
      status: "Open",
      sourceAlignment: defaultSourceAlignment
    }
  ],
  complianceReviews: [
    {
      id: "compliance-review-001",
      studentId: "student-001",
      flagId: "flag-001",
      reviewType: "Implementation compliance review",
      issue: "Missed service minutes do not have a recovery plan",
      assignedReviewer: "D. Nguyen",
      dueDate: "2026-06-27",
      status: "Requested",
      requestedBy: "BJ Tarves",
      requestedByRole: "caseManager",
      requestedAt: "2026-06-22T13:45:00",
      rationale: "High-severity missed-service finding needs administrator review before meeting materials are finalized.",
      reviewerNote: "",
      outcome: "",
      nextAction: "Confirm recovery plan and family communication before annual review.",
      reviewedBy: "",
      reviewedByRole: "",
      reviewedAt: "",
      notLegalCertification: true,
      sourceReference: "Service requirement + delivery log",
      sourceAlignment: defaultSourceAlignment
    }
  ],
  legalReviewRoutes: [],
  aiGovernance: {
    modelProfile: {
      provider: "Local deterministic demo",
      model: "iep-fds-guardrails-v1",
      modelMode: "Rules-based simulation",
      promptVersion: "fds-ai-guardrails-2026.06",
      retrievalPolicy: "Use preserved source documents, normalized IEP fields, source-aligned notes, and cited review records only.",
      citationRequired: true,
      contentLabelsRequired: true,
      humanReviewRequired: true,
      diagnosisBlocked: true,
      legalDecisionBlocked: true,
      finalPlacementBlocked: true,
      evaluationThreshold: 90,
      reviewStatus: "Ready for local evaluation",
      lastReviewedBy: "D. Nguyen",
      lastReviewedAt: "2026-06-22T10:00:00"
    },
    evaluationRuns: []
  },
  districtConfiguration: {
    districtId: "riverbend-demo",
    districtName: "Riverbend School District",
    jurisdiction: "Pennsylvania",
    configurationVersion: "RBSD-demo-2026.06",
    tenancyMode: "Single-district demo tenant",
    dataResidency: "Local development JSON store",
    registryGovernanceStatus: "District source registry configured for demo review",
    lastReviewedBy: "D. Nguyen",
    lastReviewedAt: "2026-06-22T10:30:00",
    integrationReadiness: [
      {
        id: "identity-provider",
        name: "District identity provider",
        category: "Security",
        provider: "Demo Auth",
        status: "Demo only",
        owner: "Technology director",
        nextReviewDate: "2026-08-15",
        note: "Production requires district IdP, account lifecycle, MFA policy, and role provisioning review.",
        productUse: ["Authentication", "Role-aware access", "Session governance"],
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T10:30:00"
      },
      {
        id: "sis",
        name: "Student information system",
        category: "Roster and enrollment",
        provider: "Manual demo roster",
        status: "Readiness review",
        owner: "Data services lead",
        nextReviewDate: "2026-08-30",
        note: "Map student identifiers, school assignments, guardian relationships, and enrollment changes before live sync.",
        productUse: ["Student roster", "Caseload scope", "Guardian access"],
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T10:30:00"
      },
      {
        id: "notifications",
        name: "Notification delivery provider",
        category: "Communication",
        provider: "Simulated outbox",
        status: "Demo only",
        owner: "Family engagement coordinator",
        nextReviewDate: "2026-09-05",
        note: "Production delivery needs district-approved email, SMS, language access, opt-out, and message retention controls.",
        productUse: ["Reminder notices", "Meeting packet follow-up"],
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T10:30:00"
      },
      {
        id: "calendar",
        name: "Calendar provider",
        category: "Scheduling",
        provider: "District calendar (simulated)",
        status: "Readiness review",
        owner: "Special education operations",
        nextReviewDate: "2026-09-12",
        note: "Live calendar integration must preserve meeting invitation source context and participant privacy.",
        productUse: ["Meeting holds", "Required participant readiness"],
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T10:30:00"
      },
      {
        id: "e-signature",
        name: "E-signature identity proofing",
        category: "Family portal",
        provider: "Scoped typed attestation",
        status: "Demo only",
        owner: "Compliance coordinator",
        nextReviewDate: "2026-09-20",
        note: "Production signatures require identity proofing, provider audit trail, consent boundaries, and district retention policy.",
        productUse: ["Meeting packet receipt", "Procedural safeguards receipt"],
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T10:30:00"
      },
      {
        id: "worm-retention",
        name: "WORM retention storage",
        category: "Audit retention",
        provider: "Local write-once manifest",
        status: "Readiness review",
        owner: "Records officer",
        nextReviewDate: "2026-10-01",
        note: "District must choose immutable storage, retention schedules, legal hold process, and external timestamping.",
        productUse: ["Audit packet", "Retention manifest"],
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T10:30:00"
      },
      {
        id: "ocr",
        name: "OCR and document parsing",
        category: "Document intake",
        provider: "Embedded text extraction",
        status: "Production blocked",
        owner: "Document services lead",
        nextReviewDate: "2026-08-22",
        note: "Scanned PDFs need approved OCR, confidence review, and bounding-box source anchors before production use.",
        productUse: ["IEP intake", "Source-to-field mapping"],
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T10:30:00"
      },
      {
        id: "source-lifecycle",
        name: "Source lifecycle governance",
        category: "State forms",
        provider: "Local source registry",
        status: "Pilot approved",
        owner: "Special education compliance lead",
        nextReviewDate: "2026-09-01",
        note: "Pilot registry supports activation and review; production needs approval workflow, release notes, and district sign-off.",
        productUse: ["Source registry", "Extraction", "Validation", "Review prompts"],
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T10:30:00"
      }
    ],
    dataProtectionReadiness: [
      {
        id: "encryption-at-rest",
        name: "Encryption at rest",
        category: "Data protection",
        control: "Local development files; production KMS not connected",
        status: "Production blocked",
        owner: "Information security lead",
        nextReviewDate: "2026-08-28",
        evidenceNote: "Production deployment must select district-approved database encryption, key rotation, backup encryption, and key access logging.",
        productionBoundary: "Local demo storage is not a production encryption control.",
        productUse: ["Structured IEP records", "Source documents", "Export artifacts"],
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T10:30:00"
      },
      {
        id: "backup-restore",
        name: "Backup and restore",
        category: "Operational resilience",
        control: "Manual local workspace reset fixtures",
        status: "Readiness review",
        owner: "Data services lead",
        nextReviewDate: "2026-09-04",
        evidenceNote: "District needs recovery point objective, recovery time objective, restore testing, and backup access review before live student records.",
        productionBoundary: "Local JSON snapshots are demo fixtures, not district backup policy.",
        productUse: ["Workspace persistence", "Audit chain", "Retention evidence"],
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T10:30:00"
      },
      {
        id: "schema-migrations",
        name: "Schema migrations",
        category: "Release governance",
        control: "Versioned normalized IEP schema in source code",
        status: "Readiness review",
        owner: "Product engineering lead",
        nextReviewDate: "2026-09-18",
        evidenceNote: "Production needs reversible migrations, district pilot validation, import/export compatibility checks, and legacy source-version preservation.",
        productionBoundary: "The local schema demonstrates shape and source alignment, but does not run production migrations.",
        productUse: ["Structured records", "District-system JSON package", "Historical IEP versions"],
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T10:30:00"
      },
      {
        id: "concurrency-controls",
        name: "Concurrency controls",
        category: "Data integrity",
        control: "Serialized local write lock",
        status: "Pilot approved",
        owner: "Platform engineering lead",
        nextReviewDate: "2026-09-25",
        evidenceNote: "Local writes are serialized to protect the demo audit chain; production needs optimistic locking, conflict review, and multi-user edit resolution.",
        productionBoundary: "Single-process write locking does not represent multi-district production concurrency.",
        productUse: ["Human review edits", "Progress entries", "Audit chain"],
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T10:30:00"
      },
      {
        id: "deployment-hardening",
        name: "Deployment hardening",
        category: "Security operations",
        control: "Local Vite and Node demo server",
        status: "Production blocked",
        owner: "Technology director",
        nextReviewDate: "2026-10-02",
        evidenceNote: "Production needs TLS, secrets management, vulnerability scanning, environment separation, monitoring, incident response, and district change approval.",
        productionBoundary: "The local server is for concept validation only.",
        productUse: ["All authenticated workspaces", "Exports", "Administrative governance"],
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T10:30:00"
      }
    ],
    configurationReviews: []
  },
  accessibilityCertification: {
    standard: "WCAG 2.2 AA / Section 508",
    conformanceTarget: "VPAT-style local evidence packet",
    auditMode: "Internal accessibility remediation workflow",
    externalAuditStatus: "External audit not yet connected",
    assistiveTechnologyStatus: "Screen-reader and keyboard retest scheduled",
    vpatVersion: "VPAT-demo-2026.06",
    lastReviewedBy: "D. Nguyen",
    lastReviewedAt: "2026-06-22T11:00:00",
    findings: [
      {
        id: "focus-order",
        title: "Confirm focus order across dense dashboards",
        criterion: "WCAG 2.4.3 Focus Order",
        severity: "Medium",
        status: "Remediation planned",
        owner: "UX engineering",
        dueDate: "2026-08-15",
        assistiveTechnology: "Keyboard-only navigation",
        evidence: "Smoke tests cover skip link, main region, named controls, and mobile overflow; full task-flow focus order still needs manual review.",
        remediationPlan: "Run keyboard-only passes through intake, meetings, audit, and leadership surfaces after each major workflow addition.",
        verificationNote: "Manual keyboard pass required before external accessibility certification.",
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T11:00:00"
      },
      {
        id: "screen-reader-announcements",
        title: "Validate live-region announcements with screen readers",
        criterion: "WCAG 4.1.3 Status Messages",
        severity: "High",
        status: "Open",
        owner: "Accessibility reviewer",
        dueDate: "2026-08-22",
        assistiveTechnology: "NVDA, VoiceOver",
        evidence: "The UI exposes a polite status region and automated tests verify visible live status text.",
        remediationPlan: "Schedule assistive-technology testing for save, blocked-action, export, role-switch, and API fallback announcements.",
        verificationNote: "Needs screen-reader transcript evidence.",
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T11:00:00"
      },
      {
        id: "language-access-accessibility",
        title: "Document language-access and accessibility interaction",
        criterion: "WCAG 3.1.5 Reading Level / District language-access policy",
        severity: "Medium",
        status: "Ready for retest",
        owner: "Family engagement coordinator",
        dueDate: "2026-08-30",
        assistiveTechnology: "Plain-language review and interpreter workflow",
        evidence: "Family summaries, translated-summary drafts, glossary terms, and interpreter coordination are visible in meeting prep.",
        remediationPlan: "Retest translated family-summary drafts for clear labels, source fidelity, and human interpreter review boundaries.",
        verificationNote: "Ready for family-facing plain-language retest.",
        reviewedBy: "D. Nguyen",
        reviewedByRole: "administrator",
        reviewedAt: "2026-06-22T11:00:00"
      }
    ],
    reviews: []
  },
  summaries: {
    teacher: {
      label: "Teacher view",
      title: "Jordan's classroom implementation summary",
      sourceAlignment: defaultSourceAlignment,
      sections: [
        {
          heading: "Required classroom supports",
          bullets: [
            "Provide written directions with verbal directions for multi-step tasks.",
            "Make the approved graphic organizer available for reading tasks.",
            "Provide extended time as written in the approved implementation note.",
            "Check for understanding before independent work."
          ]
        },
        {
          heading: "Services and staff obligations",
          bullets: [
            "Speech-language support: 1x/week, 30 minutes, small group.",
            "Reading support: 3x/week, 30 minutes, small group.",
            "Executive-function coaching: 2x/week, 15 minutes, individual."
          ],
          sourceReference: "Page 15, service grid"
        },
        {
          heading: "Goal areas and data collection",
          bullets: [
            "Reading comprehension: collect weekly comprehension probe data.",
            "Written expression: collect monthly rubric-scored writing samples.",
            "Executive functioning: collect weekly five-routine teacher ratings."
          ],
          sourceReference: "Goals 1-3 and progress schedules"
        },
        {
          heading: "Assessment accommodations",
          bullets: [
            "Extended time",
            "Written directions",
            "Graphic organizer where permitted"
          ],
          sourceReference: "State and local assessments"
        },
        {
          heading: "Behavior supports",
          text:
            "Executive-function routines require classroom support; no separate behavior support plan details are documented.",
          sourceReference: "Special considerations and behavior support plan"
        },
        {
          heading: "Important dates",
          bullets: [
            "IEP term: 2025-07-02 to 2026-07-01.",
            "Annual IEP meeting: 2026-07-01 at 10:00 AM.",
            "Next reading progress data due: 2026-06-30."
          ],
          sourceReference: "IEP dates, meeting invitation, and progress schedule"
        }
      ]
    },
    parent: {
      label: "Family view",
      title: "Jordan's IEP in plain language",
      sourceAlignment: defaultSourceAlignment,
      sections: [
        {
          heading: "What the plan supports",
          text:
            "Jordan is working on understanding what is read, organizing written work, and completing classroom routines independently."
        },
        {
          heading: "What the school should provide",
          bullets: [
            "Reading support three times each week.",
            "Speech-language support for 30 minutes once each week.",
            "Written and visual directions, a graphic organizer, and extended time as written.",
            "Progress reports each grading period."
          ]
        },
        {
          heading: "What each goal means",
          bullets: [
            "Reading comprehension: Jordan is working on answering questions about a passage with an approved organizer.",
            "Written expression: Jordan is working on planning and organizing multi-paragraph writing.",
            "Executive functioning: Jordan is working on completing classroom routines with more independence."
          ],
          sourceReference: "Goals 1-3"
        },
        {
          heading: "How progress will be measured",
          bullets: [
            "Reading is checked with weekly comprehension probes.",
            "Writing is checked with monthly rubric-scored samples.",
            "Classroom routines are checked with weekly teacher ratings."
          ],
          sourceReference: "Progress monitoring schedules"
        },
        {
          heading: "Services required",
          bullets: [
            "Speech-language support: 30 minutes once each week.",
            "Reading support: 30 minutes three times each week.",
            "Executive-function coaching: 15 minutes two times each week."
          ],
          sourceReference: "Page 15, service grid"
        },
        {
          heading: "Questions for next meeting",
          bullets: [
            "How will recent reading data change the support plan?",
            "How will missed speech-language minutes be recovered?"
          ],
          sourceReference: "Family questions and meeting agenda"
        },
        {
          heading: "What changed from the previous IEP",
          bullets: [
            "The current reading goal names literal and inferential questions with an approved organizer, rather than only describing general comprehension support.",
            "Implementation follow-up now tracks missed speech-language minutes and a recovery plan before the annual review.",
            "Extended time remains available, but the team needs to confirm the amount and trigger because the source IEP does not specify them."
          ],
          sourceReference:
            "Prior IEP comparison note, current Goal 1 progress data, service delivery log, and accommodation ambiguity flag"
        }
      ]
    },
    student: {
      label: "Student view",
      title: "My plan and supports",
      sourceAlignment: defaultSourceAlignment,
      sections: [
        {
          heading: "My goals",
          bullets: [
            "Use reading evidence to answer questions with at least 80% accuracy.",
            "Plan and organize a multi-paragraph response.",
            "Complete more classroom routines independently."
          ]
        },
        {
          heading: "Supports I can ask for",
          bullets: [
            "Can I have the written directions?",
            "Can I use my graphic organizer?",
            "Can we check the first step?",
            "What should finished work look like?"
          ]
        },
        {
          heading: "What I am working on",
          text:
            "I am practicing using evidence from reading, organizing my writing before I start, and using classroom routines with less prompting.",
          sourceReference: "Present levels, goals, and student voice"
        },
        {
          heading: "Transition activities",
          text:
            "Transition services are not documented for this grade-level record; the meeting still includes student voice and self-advocacy preparation.",
          sourceReference: "Transition services and meeting agenda"
        }
      ]
    },
    administrator: {
      label: "Reviewer view",
      title: "Jordan Lee implementation and review brief",
      sourceAlignment: defaultSourceAlignment,
      sections: [
        {
          heading: "Implementation risk",
          bullets: [
            "30 speech-language minutes missed with recovery open.",
            "Extended time lacks an amount in the source.",
            "Executive-function evidence is stale."
          ]
        },
        {
          heading: "Missing sections",
          bullets: [
            "Behavior need is identified, but no behavior support plan details are documented.",
            "Transition services are not documented for this grade-level record."
          ],
          sourceReference: "Completeness review flags and structured record"
        },
        {
          heading: "Ambiguous services and supports",
          bullets: [
            "Extended time lacks an amount and implementation trigger in the source.",
            "Speech-language support has missed minutes with recovery still open."
          ],
          sourceReference: "Accommodation ambiguity flag and service delivery log"
        },
        {
          heading: "Unclear progress monitoring",
          bullets: [
            "Executive-function evidence is stale and needs a current teacher rating.",
            "Progress schedules should be checked before progress reports are shared."
          ],
          sourceReference: "Goal 3 and progress schedule"
        },
        {
          heading: "Timeline issues",
          bullets: [
            "Annual IEP meeting is scheduled for 2026-07-01.",
            "Formal compliance review is due 2026-06-27.",
            "Recovery plan should be confirmed before meeting materials are finalized."
          ],
          sourceReference: "Meeting invitation, compliance review, and recovery reminder"
        },
        {
          heading: "Placement rationale",
          text:
            "Services can be delivered in general education and small-group settings; reviewer notes must not make a final placement decision.",
          sourceReference: "Educational placement and placement review"
        },
        {
          heading: "Compliance flags",
          bullets: [
            "Missed service minutes do not have a recovery plan.",
            "Extended time accommodation is ambiguous.",
            "Executive-function progress evidence is stale."
          ],
          sourceReference: "Advisory review flags"
        },
        {
          heading: "Required human decisions",
          text:
            "Determine recovery, confirm the accommodation implementation note, and decide whether acknowledgment gaps require escalation."
        }
      ]
    }
  },
  staffContinuity: [
    {
      id: "continuity-slp-vacancy",
      school: "Riverbend Middle School",
      role: "Speech-Language Pathologist",
      providerName: "Vacant / contractor coverage",
      status: "Coverage needed",
      riskLevel: "High",
      vacancyStartDate: "2026-06-01",
      coverageOwner: "D. Nguyen",
      nextReviewDate: "2026-06-26",
      affectedStudentIds: ["student-001"],
      affectedServices: ["Speech-language support"],
      coveragePlan: "Assign contract SLP coverage and confirm recovery minutes with the family.",
      sourceReference: "Service delivery log and staffing continuity review",
      sourceAlignment: defaultSourceAlignment,
      reviewedBy: "",
      reviewedByRole: "",
      reviewedAt: ""
    },
    {
      id: "continuity-reading-specialist",
      school: "Riverbend Middle School",
      role: "Reading Specialist",
      providerName: "A. Rivera",
      status: "Covered",
      riskLevel: "Low",
      vacancyStartDate: "",
      coverageOwner: "A. Rivera",
      nextReviewDate: "2026-07-01",
      affectedStudentIds: ["student-001"],
      affectedServices: ["Reading support"],
      coveragePlan: "Coverage stable; monitor weekly progress evidence and teacher handoff notes.",
      sourceReference: "Caseload continuity review",
      sourceAlignment: defaultSourceAlignment,
      reviewedBy: "A. Rivera",
      reviewedByRole: "caseManager",
      reviewedAt: "2026-06-20T12:30:00"
    }
  ],
  teamComments: [
    {
      id: "team-comment-001",
      studentId: "student-001",
      targetType: "Implementation task",
      targetId: "task-001",
      targetTitle: "Assign speech-language service recovery plan",
      visibility: "IEP team",
      body:
        "Please connect the recovery date to the service log before the annual meeting packet is finalized.",
      postedBy: "A. Rivera",
      postedByRole: "caseManager",
      postedByUserId: "user-case-manager",
      postedAt: "2026-06-22T09:20:00",
      sourceReference: "Service delivery log and missed-service recovery reminder",
      sourceAlignment: defaultSourceAlignment,
      officialRecordImpact:
        "Team collaboration note only; does not change official IEP obligations."
    },
    {
      id: "team-comment-002",
      studentId: "student-001",
      targetType: "Accommodation",
      targetId: "acc-003",
      targetTitle: "Provide extended time for classroom assessments and written assignments as written.",
      visibility: "Staff only",
      body:
        "General education staff need the team to clarify the extended-time amount before assessment routines are shared.",
      postedBy: "Leah Kim",
      postedByRole: "generalEducation",
      postedByUserId: "user-general-education",
      postedAt: "2026-06-21T14:10:00",
      sourceReference: "Accommodation ambiguity flag and state/local assessment accommodations",
      sourceAlignment: defaultSourceAlignment,
      officialRecordImpact:
        "Team collaboration note only; does not change official IEP obligations."
    }
  ],
  teamCommentQueueReviews: [
    {
      id: "team-comment-queue-review-001",
      studentId: "student-001",
      queueStatus: "Needs moderation",
      notificationPlan:
        "Use in-app team follow-up for the accommodation clarification; no live external threaded notifications are connected in the local demo.",
      retentionDecision: "Retain with staff-only visibility",
      retentionBoundary:
        "Staff-only collaboration and moderation notes remain in the local audit trail; production retention schedule and legal hold rules require district approval.",
      reviewerNote:
        "Queue review confirms the staff-only accommodation thread still needs visibility review before any family-facing packet language is prepared.",
      nextReviewDate: "2026-06-29",
      commentsReviewed: [
        {
          id: "team-comment-002",
          targetTitle: "Provide extended time for classroom assessments and written assignments as written.",
          visibility: "Staff only",
          moderationStatus: "Pending review",
          postedAt: "2026-06-21T14:10:00",
          replyCount: 0
        },
        {
          id: "team-comment-001",
          targetTitle: "Assign speech-language service recovery plan",
          visibility: "IEP team",
          moderationStatus: "Pending review",
          postedAt: "2026-06-22T09:20:00",
          replyCount: 0
        }
      ],
      pendingCount: 2,
      needsFollowUpCount: 0,
      staffOnlyCount: 1,
      familyVisibleCount: 0,
      studentVisibleCount: 0,
      latestCommentAt: "2026-06-22T09:20:00",
      reviewedBy: "A. Rivera",
      reviewedByRole: "caseManager",
      reviewedByUserId: "user-case-manager",
      reviewedAt: "2026-06-22T10:00:00",
      sourceReference: "Student workspace collaboration moderation queue",
      sourceAlignment: defaultSourceAlignment,
      queueDigest: "seed-team-comment-queue-review-digest",
      officialRecordImpact:
        "Collaboration queue review documents local moderation, notification, and retention readiness only; it does not change official IEP obligations."
    }
  ],
  iepComparisons: [
    {
      id: "comparison-reading-goal",
      studentId: "student-001",
      previousIepId: "iep-previous-001",
      currentIepId: "iep-001",
      section: "Goals and progress monitoring",
      changeType: "Modified goal",
      title: "Reading goal now names the comprehension skill and measure",
      previousText: "Previous IEP described general reading-comprehension support without naming the question type or mastery evidence.",
      currentText: "Current IEP names literal and inferential questions, an approved organizer, weekly probes, and an 80% mastery target.",
      implementationImpact:
        "Teachers can align data collection to weekly probes instead of relying on general classroom impressions.",
      familySummary:
        "The reading goal is more specific, so the family can see what skill is being measured and how progress will be checked.",
      status: "Shared in family summary",
      reviewNote: "Keep this comparison visible in the family handout and meeting packet.",
      reviewedBy: "A. Rivera",
      reviewedByRole: "caseManager",
      reviewedAt: "2026-06-21T10:30:00",
      familyVisible: true,
      studentVisible: true,
      sourceReference: "Prior IEP comparison note and current Goal 1 progress data",
      sourceAlignment: defaultSourceAlignment,
      officialRecordImpact:
        "Comparison explanation only; official IEP obligations remain controlled by the approved source document."
    },
    {
      id: "comparison-service-recovery",
      studentId: "student-001",
      previousIepId: "iep-previous-001",
      currentIepId: "iep-001",
      section: "Services",
      changeType: "Implementation follow-up added",
      title: "Speech-language service gap now has a recovery follow-up",
      previousText: "Previous implementation notes did not preserve a recovery date or family communication for missed speech-language minutes.",
      currentText: "Current workspace tracks missed minutes, responsible provider, family communication, and recovery planning before the annual review.",
      implementationImpact:
        "The case manager and related service provider can document recovery planning before the meeting rather than relying on memory.",
      familySummary:
        "The team is tracking missed speech-language minutes and should explain the recovery plan before the annual meeting.",
      status: "Needs team review",
      reviewNote: "Confirm recovery date and provider before sharing final packet language.",
      reviewedBy: "",
      reviewedByRole: "",
      reviewedAt: "",
      familyVisible: true,
      studentVisible: false,
      sourceReference: "Service delivery log and missed-service recovery reminder",
      sourceAlignment: defaultSourceAlignment,
      officialRecordImpact:
        "Comparison explanation only; official IEP obligations remain controlled by the approved source document."
    },
    {
      id: "comparison-extended-time",
      studentId: "student-001",
      previousIepId: "iep-previous-001",
      currentIepId: "iep-001",
      section: "Accommodations",
      changeType: "Clarification needed",
      title: "Extended-time wording remains available but needs implementation clarity",
      previousText: "Previous IEP listed extended time without a clear amount or trigger.",
      currentText: "Current plan still includes extended time, and the workspace flags the missing amount and trigger for team review.",
      implementationImpact:
        "General education staff need the IEP team to confirm how extended time should be implemented during classroom and assessment routines.",
      familySummary:
        "Extended time remains available, but the team should clarify the amount and when it applies.",
      status: "Needs source follow-up",
      reviewNote: "Do not invent an amount; bring this to the IEP team if the source document remains unclear.",
      reviewedBy: "",
      reviewedByRole: "",
      reviewedAt: "",
      familyVisible: true,
      studentVisible: true,
      sourceReference: "Accommodation ambiguity flag and state/local assessment accommodations",
      sourceAlignment: defaultSourceAlignment,
      officialRecordImpact:
        "Comparison explanation only; official IEP obligations remain controlled by the approved source document."
    }
  ],
  meetingRecordingReviews: [
    {
      id: "meeting-recording-review-001",
      meetingId: "meeting-001",
      studentId: "student-001",
      recordingSource: "Case-manager recap notes",
      status: "Transcript source only",
      participantConsentSummary:
        "No audio or video recording is attached; the recap uses staff notes and family-visible meeting-prep questions.",
      transcriptHandlingPlan:
        "Human reviewer summarizes only meeting-prep topics and separates proposed follow-ups from official IEP decisions.",
      storageLocation: "Local demo workspace; no production recording provider connected.",
      retentionBoundary:
        "Do not upload recordings containing sensitive student information until district consent, retention, and access rules are confirmed.",
      familyVisible: false,
      studentVisible: false,
      reviewedBy: "A. Rivera",
      reviewedByRole: "caseManager",
      reviewedAt: "2026-06-22T09:40:00",
      recordingReviewDigest: "seed-meeting-recording-review-digest",
      sourceReference: "Meeting recording/transcript source readiness",
      sourceAlignment: defaultSourceAlignment,
      officialRecordImpact:
        "Recording readiness review documents local consent and transcript-source handling only; it does not create a recording, replace consent, or amend the official IEP."
    }
  ],
  meetingTranscriptSummaries: [
    {
      id: "transcript-summary-001",
      meetingId: "meeting-001",
      studentId: "student-001",
      transcriptSource: "Case-manager recap notes",
      transcriptExcerpt:
        "Parent asked how missed speech-language minutes will be recovered. Team noted the recovery plan still needs provider/date confirmation. Student wants to ask for written directions.",
      summary:
        "Team needs to clarify missed-service recovery and extended-time implementation before the annual IEP meeting.",
      decisions: [
        "No official IEP changes were finalized in the recap.",
        "Recovery plan remains an implementation follow-up."
      ],
      followUps: [
        "Confirm recovery date and provider.",
        "Clarify extended-time amount and trigger.",
        "Add student self-advocacy prompt to agenda."
      ],
      familyVisible: true,
      studentVisible: false,
      status: "Draft recap for review",
      reviewedBy: "A. Rivera",
      reviewedByRole: "caseManager",
      reviewedAt: "2026-06-22T09:45:00",
      transcriptDigest: "seed-transcript-summary-digest",
      sourceReference: "Meeting prep notes and family question log",
      sourceAlignment: defaultSourceAlignment,
      officialRecordImpact:
        "Transcript summary is a meeting-prep recap only; it does not amend the official IEP or replace team decisions."
    }
  ],
  summaryComprehensionChecks: [
    {
      id: "comprehension-001",
      studentId: "student-001",
      audience: "parent",
      summaryTitle: "Jordan's IEP in plain language",
      summaryLabel: "Family view",
      sectionHeading: "What changed from the previous IEP",
      understandingStatus: "Needs explanation",
      language: "English",
      questionOrNote: "Please explain how the missed speech-language minutes will be recovered before the annual review.",
      preferredFollowUp: "Discuss during meeting prep and include the recovery owner in the packet.",
      reviewStatus: "Awaiting team response",
      staffResponse: "",
      nextStep: "Case manager follow-up pending.",
      submittedBy: "Robin Lee",
      submittedByRole: "parent",
      submittedAt: "2026-06-23T18:30:00",
      reviewedBy: "",
      reviewedByRole: "",
      reviewedAt: "",
      sourceReference: "Prior IEP comparison note, service delivery log, and family summary",
      sourceAlignment: defaultSourceAlignment,
      officialRecordImpact:
        "Understanding check documents family questions and follow-up only; it does not amend the official IEP or replace IEP team decisions."
    }
  ],
  notificationDeliveries: [
    {
      id: "notification-family-packet-001",
      studentId: "student-001",
      sourceId: "meeting-001",
      sourceType: "Meeting prep",
      sourceTitle: "Annual IEP pre-read packet",
      audience: "family",
      channel: "In-app",
      status: "Sent",
      message:
        "The annual IEP pre-read packet is available for review. Please add questions before the July 1 meeting.",
      sentBy: "A. Rivera",
      sentByRole: "caseManager",
      sentAt: "2026-06-22T09:30:00",
      deliveryNote: "Demo in-app notice only; production delivery would use district-approved communication channels.",
      sourceAlignment: defaultSourceAlignment
    }
  ],
  calendarEvents: [
    {
      id: "calendar-meeting-001",
      meetingId: "meeting-001",
      studentId: "student-001",
      title: "Jordan Lee - Annual IEP review",
      startDate: "2026-07-01",
      startTime: "9:00 AM",
      provider: "District calendar (simulated)",
      attendanceMode: "In person with video option",
      status: "Hold created",
      calendarUid: "iep-meeting-001@riverbend-demo",
      attendees: [
        "Parent/guardian",
        "Jordan Lee",
        "Special education teacher",
        "General education teacher",
        "LEA representative"
      ],
      note: "Initial meeting hold created from the meeting invitation; live calendar sync is not connected in the MVP.",
      createdBy: "A. Rivera",
      createdByRole: "caseManager",
      createdAt: "2026-06-22T09:15:00",
      sourceReference: "Meeting invitation and participant readiness list",
      sourceAlignment: defaultSourceAlignment
    }
  ],
  securityPosture: {
    districtId: "riverbend",
    identityProvider: "Demo username/password",
    sessionTtlHours: 8,
    mfaPolicy: "Required before production launch",
    mfaStatus: "Demo sessions are password-only and flagged for administrator review.",
    tenantBoundaryStatus: "Single-district demo tenant",
    roleProvisioningStatus: "Manual demo roles",
    accountLifecyclePlan: "Demo accounts are manually provisioned for role-aware testing; production requires district IdP provisioning and deprovisioning.",
    tenantBoundaryEvidence: "Seed data is scoped to Riverbend demo records; production multi-tenant isolation is not enforced by this local workspace.",
    reviewStatus: "Needs production identity provider",
    lastReviewedAt: "2026-06-22T10:00:00",
    nextReviewDate: "2026-07-15",
    reviewedBy: "D. Nguyen",
    reviewedByRole: "administrator",
    retentionNote:
      "Session review records are retained in the audit trail; production deployments require district identity-provider, MFA, and retention controls."
  },
  securityReviews: [
    {
      id: "security-review-001",
      action: "Session policy reviewed",
      sessionId: "",
      userName: "All demo accounts",
      role: "all",
      status: "Needs production hardening",
      identityProvider: "Demo username/password",
      lifecycleStatus: "Needs production identity provider",
      mfaStatus: "Demo password only",
      tenantBoundaryStatus: "Single-district demo tenant",
      roleProvisioningStatus: "Manual demo roles",
      accountLifecyclePlan: "Demo accounts are manually maintained for local role testing.",
      tenantBoundaryEvidence: "Seed workspace contains Riverbend demo data only.",
      roleProvisioningNote: "Production launch requires mapped district groups, account deprovisioning, and role review.",
      note: "Demo sessions are useful for role-aware testing but must be replaced by district SSO, MFA, and lifecycle controls before production.",
      reviewedBy: "D. Nguyen",
      reviewedByRole: "administrator",
      reviewedAt: "2026-06-22T10:00:00",
      productionBoundary:
        "Seed review documents local assumptions only; production deployments require district IdP, MFA, tenant isolation, and lifecycle enforcement."
    }
  ],
  auditAnchors: [
    {
      id: "audit-anchor-seed-001",
      status: "Seed anchor",
      anchorScope: "Local NDJSON audit chain",
      anchoredSequence: 5,
      anchoredHash: "seed-audit-chain-rebuilt-on-api-start",
      anchorDigest: "seed-demo-anchor",
      externalReference: "Demo seed anchor; rebuild the API audit log for a live hash.",
      note: "Initial seed marker shows where production deployments would retain an external notarization reference.",
      createdBy: "D. Nguyen",
      createdByRole: "administrator",
      createdAt: "2026-06-22T10:00:00",
      verificationStatus: "Seed marker"
    }
  ],
  auditRetentionPackages: [],
  retentionPolicyReviews: [
    {
      id: "retention-policy-review-001",
      policyScope: "Audit trail and retention manifests",
      policySource: "Riverbend draft records schedule RBSD-RET-2026",
      disposition: "District schedule needed",
      retentionPeriod: "Retain local audit-chain evidence until the district approves a records schedule, legal-hold process, and immutable storage location.",
      legalHoldStatus: "Counsel review needed",
      archiveDecision: "Archive blocked",
      evidenceSummary:
        "Seed review links local audit anchors, timestamp receipt readiness, retention manifest sealing, export metadata, and WORM integration readiness for district review.",
      nextReviewDate: "2026-10-15",
      retentionPackageId: "",
      anchorId: "audit-anchor-seed-001",
      packageDigest: "",
      anchorDigest: "seed-demo-anchor",
      auditVerificationStatus: "Seed marker only",
      reviewedBy: "D. Nguyen",
      reviewedByRole: "administrator",
      reviewedByUserId: "user-administrator",
      reviewedAt: "2026-06-22T10:10:00",
      policyDigest: "seed-retention-policy-review-digest",
      productionBoundary:
        "Retention policy review documents local readiness and district policy questions only; it does not enforce production retention, archive, purge, or legal-hold rules."
    }
  ],
  auditLog: [
    {
      id: "audit-001",
      type: "Document upload",
      title: "IEP source uploaded",
      detail: "Jordan_Lee_IEP_2025-2026.pdf added as preserved source document.",
      actor: "A. Rivera",
      timestamp: "2026-06-12T08:42:00"
    },
    {
      id: "audit-002",
      type: "Extraction completed",
      title: "AI extraction completed",
      detail: "Major IEP sections detected with confidence scores and source references.",
      actor: "IEP Assistant",
      timestamp: "2026-06-12T08:45:00"
    },
    {
      id: "audit-003",
      type: "Human review",
      title: "Structured record approved",
      detail: "Case manager confirmed goals, services, accommodations, and team information.",
      actor: "A. Rivera",
      timestamp: "2026-06-13T14:10:00"
    },
    {
      id: "audit-004",
      type: "AI-generated summary",
      title: "Family summary generated",
      detail: "Parent-friendly summary drafted from approved fields and labeled for human review.",
      actor: "IEP Assistant",
      timestamp: "2026-06-21T09:18:00"
    },
    {
      id: "audit-005",
      type: "Progress data entered",
      title: "Progress evidence entered",
      detail: "Weekly reading probe added with observation note and measurement method.",
      actor: "M. Gomez",
      timestamp: "2026-06-19T15:12:00"
    }
  ],
  exportTemplateReviews: [
    {
      id: "export-template-review-001",
      exportId: "",
      targetSystem: "District IEP system compatible JSON interchange",
      templateName: "District system package",
      templateVersion: "IEP-IW-district-json-0.1",
      format: "json",
      validationStatus: "Template review needed",
      mappingStatus: "Mapping draft",
      submissionMode: "Local review package only",
      requiredSections: schemaSections.length,
      mappedSections: schemaSections.length,
      mappingEvidence:
        "Seed template includes normalized FDS section coverage, source registry metadata, student profile fields, goals, services, accommodations, implementation tasks, and audit context.",
      validationEvidence:
        "Production import validation has not been performed; generated packages are marked review-ready and not official submissions.",
      reviewNote:
        "District staff must validate field mappings against the live IEP/SIS schema before any production import or official submission workflow.",
      packageFileName: "",
      packageSha256: "",
      reviewedBy: "D. Nguyen",
      reviewedByRole: "administrator",
      reviewedAt: "2026-06-22T10:00:00",
      nextReviewDate: "2026-08-15",
      productionBoundary:
        "Template review records local mapping readiness only; production deployments still require district-approved templates, live integration validation, and official submission controls.",
      templateDigest: "seed-demo-export-template-review"
    }
  ],
  exports: []
};

export const initialWorkspace = normalizeWorkspaceStructuredRecords(initialWorkspaceSeed);

export function normalizeWorkspaceStructuredRecords(workspace) {
  const normalizedWorkspace = normalizeGapClosureWorkspace(workspace);
  return {
    ...normalizedWorkspace,
    ieps: (workspace.ieps || []).map((iep) => ({
      ...iep,
      structuredRecord: normalizeStructuredIepRecord(workspace, iep)
    }))
  };
}

export function mergeExtractionSectionsIntoStructuredRecord(workspace, structuredRecord = {}, sourceAlignment = alignmentFromRegistry(workspace.sourceRegistry)) {
  const next = {
    ...structuredRecord,
    sourceAlignment
  };
  const activeStudentId = workspace.currentStudentId;
  const reviewedSections = (workspace.extractionSections || []).filter(
    (section) => section.status !== "Rejected" && (!section.studentId || !activeStudentId || section.studentId === activeStudentId)
  );

  for (const section of reviewedSections) {
    const key = String(section.key || "");
    const content = String(section.content || "").trim();
    if (!content) continue;
    const metadata = extractionMetadata(section, sourceAlignment);

    if (key.startsWith("currentPerformance")) {
      const [, field] = key.split(".");
      next.currentPerformance = {
        ...(next.currentPerformance || {}),
        extractedSections: upsertByExtractionSection(next.currentPerformance?.extractedSections, {
          ...metadata,
          text: content
        })
      };
      if (field && field !== "detected") {
        next.currentPerformance[field] = content;
      }
    } else if (key.startsWith("goalsAndObjectives")) {
      next.goalsAndObjectives = upsertByExtractionSection(next.goalsAndObjectives, {
        ...metadata,
        domain: section.title || "Extracted annual goal",
        annualGoal: content,
        measurementMethod: "Review confirmed from extracted source text",
        criteriaForMastery: "See extracted annual goal text"
      });
      next.progressMonitoring = upsertByExtractionSection(next.progressMonitoring, {
        ...metadata,
        domain: goalDomainFromText(content, section.title),
        measurementMethod: measurementMethodFromGoalText(content),
        frequency: frequencyFromText(content) || "Weekly",
        criteriaForMastery: criteriaFromGoalText(content),
        progressSchedule: {
          frequency: frequencyFromText(content) || "Weekly",
          nextDueDate: "2026-06-30",
          lastCollectedDate: "",
          status: "Due soon",
          evidenceType: "Progress monitoring evidence",
          evidenceRequired: true,
          responsibleRole: "Case Manager"
        },
        entries: []
      });
    } else if (key.startsWith("services")) {
      next.services = upsertByExtractionSection(next.services, {
        ...metadata,
        serviceType: section.title || "Extracted service",
        description: content,
        frequency: "See extracted service text",
        duration: "See extracted service text",
        location: "See extracted service text",
        startDate: next.meetingInformation?.startDate || "",
        endDate: next.meetingInformation?.endDate || "",
        evidenceRequired: true,
        loggingRequirement: "Service delivery minutes must be logged and reviewed against the approved IEP."
      });
    } else if (key.startsWith("accommodations")) {
      next.accommodations = upsertByExtractionSection(next.accommodations, {
        ...metadata,
        description: content,
        setting: section.sourceSection || "Extracted accommodation",
        frequency: "See extracted accommodation text",
        responsibleRole: "Team review required",
        startDate: next.meetingInformation?.startDate || "",
        endDate: next.meetingInformation?.endDate || "",
        evidenceRequired: Boolean(section.warning),
        ambiguity: section.warning || ""
      });
    }
  }

  return next;
}

export function applyApprovedExtractionObligations(
  workspace,
  { studentId = workspace.currentStudentId, sourceAlignment = alignmentFromRegistry(workspace.sourceRegistry), approvedAt = new Date().toISOString() } = {}
) {
  const activeIep = (workspace.ieps || []).find((iep) => iep.studentId === studentId);
  if (!activeIep) return workspace;

  const approvedSections = (workspace.extractionSections || []).filter(
    (section) =>
      section.status === "Confirmed" &&
      String(section.content || "").trim() &&
      (!section.studentId || section.studentId === studentId)
  );
  let nextGoals = workspace.goals || [];
  let nextServices = workspace.services || [];
  let nextAccommodations = workspace.accommodations || [];
  let nextTasks = workspace.tasks || [];

  for (const section of approvedSections) {
    const key = String(section.key || "");
    if (key.startsWith("goalsAndObjectives")) {
      const goal = goalFromExtractionSection(section, activeIep, sourceAlignment, approvedAt);
      nextGoals = upsertByIdPreserving(nextGoals, goal, ["progressEntries", "status"]);
      nextTasks = upsertByIdPreserving(nextTasks, progressTaskFromGoal(goal, section, sourceAlignment), [
        "acknowledgments",
        "completionEvidence",
        "observations",
        "status"
      ]);
    } else if (key.startsWith("services")) {
      const service = serviceFromExtractionSection(section, activeIep, sourceAlignment, approvedAt);
      nextServices = upsertByIdPreserving(nextServices, service, ["deliveredMinutes", "scheduledMinutes", "recoveryStatus", "recoveryPlan"]);
      nextTasks = upsertByIdPreserving(nextTasks, serviceTaskFromService(service, section, sourceAlignment), [
        "acknowledgments",
        "completionEvidence",
        "observations",
        "status"
      ]);
    } else if (key.startsWith("accommodations")) {
      const accommodation = accommodationFromExtractionSection(section, activeIep, sourceAlignment, approvedAt);
      nextAccommodations = upsertByIdPreserving(nextAccommodations, accommodation);
      nextTasks = upsertByIdPreserving(nextTasks, accommodationTaskFromAccommodation(accommodation, section, sourceAlignment), [
        "acknowledgments",
        "completionEvidence",
        "observations",
        "status"
      ]);
    }
  }

  return {
    ...workspace,
    goals: nextGoals,
    services: nextServices,
    accommodations: nextAccommodations,
    tasks: nextTasks
  };
}

export function refreshRoleSummariesFromWorkspace(
  workspace,
  { studentId = workspace.currentStudentId, sourceAlignment = alignmentFromRegistry(workspace.sourceRegistry) } = {}
) {
  const student = (workspace.students || []).find((item) => item.id === studentId);
  const iep = (workspace.ieps || []).find((item) => item.studentId === studentId);
  if (!student || !iep) return workspace;

  const record = normalizeStructuredIepRecord(workspace, iep);
  const studentName = `${student.firstName} ${student.lastName}`.trim() || "The student";
  const firstName = student.firstName || "The student";
  const goals = (workspace.goals || []).filter((goal) => goal.iepId === iep.id);
  const services = (workspace.services || []).filter((service) => service.iepId === iep.id);
  const accommodations = (workspace.accommodations || []).filter((accommodation) => accommodation.iepId === iep.id);
  const meeting = (workspace.meetings || []).find((item) => item.studentId === studentId);
  const openFlags = (workspace.reviewFlags || []).filter((flag) => flag.studentId === studentId && flag.status !== "Resolved");
  const existingParentSections = workspace.summaries?.parent?.sections || [];
  const changeSection =
    existingParentSections.find((section) => section.heading === "What changed from the previous IEP") ||
    defaultPreviousIepChangeSection();

  return {
    ...workspace,
    summaries: {
      ...(workspace.summaries || {}),
      teacher: {
        label: "Teacher view",
        title: `${firstName}'s classroom implementation summary`,
        sourceAlignment,
        coverageItems: summaryCoverageItemsForWorkspace(workspace, "teacher", { studentId }),
        sections: [
          {
            heading: "Required classroom supports",
            bullets: nonEmptyBullets(
              accommodations.map((accommodation) => `${accommodation.description} (${accommodation.setting || "setting to confirm"}; ${accommodation.frequency || "frequency to confirm"}).`)
            ),
            sourceReference: sourceReferenceList(accommodations)
          },
          {
            heading: "Data responsibilities",
            bullets: nonEmptyBullets(
              goals.map((goal) => `${goal.domain}: collect ${goal.measurementMethod || "the source-aligned measure"} ${goal.frequency || "as scheduled"} for ${goal.criteriaForMastery || "the approved mastery criterion"}.`)
            ),
            sourceReference: sourceReferenceList(goals)
          },
          {
            heading: "Services and staff obligations",
            bullets: nonEmptyBullets(services.map(serviceSummaryBullet)),
            sourceReference: sourceReferenceList(services)
          },
          {
            heading: "Assessment accommodations",
            bullets: nonEmptyBullets(assessmentAccommodationItems(record), ["No assessment accommodations are documented in the structured record."]),
            sourceReference: "State and local assessments"
          },
          {
            heading: "Behavior supports",
            bullets: nonEmptyBullets(behaviorSupportItems(record), ["No behavior support plan details are documented in the structured record."]),
            sourceReference: "Special considerations and behavior support plan"
          },
          {
            heading: "Important dates",
            bullets: summaryImportantDateItems({ iep, meeting, goals }),
            sourceReference: "IEP dates, meeting information, and progress schedules"
          }
        ]
      },
      parent: {
        label: "Family view",
        title: `${firstName}'s IEP in plain language`,
        sourceAlignment,
        coverageItems: summaryCoverageItemsForWorkspace(workspace, "parent", { studentId }),
        sections: [
          {
            heading: "What the plan supports",
            text: plainPlanSupportText(firstName, record, goals)
          },
          {
            heading: "What the school should provide",
            bullets: nonEmptyBullets([...services.map(serviceSummaryBullet), ...accommodations.map((item) => item.description)]),
            sourceReference: sourceReferenceList([...services, ...accommodations])
          },
          {
            heading: "What each goal means",
            bullets: nonEmptyBullets(goals.map(parentGoalMeaningBullet)),
            sourceReference: sourceReferenceList(goals)
          },
          {
            heading: "How progress will be measured",
            bullets: nonEmptyBullets(goals.map(parentGoalBullet)),
            sourceReference: sourceReferenceList(goals)
          },
          {
            heading: "Services required",
            bullets: nonEmptyBullets(services.map(serviceSummaryBullet)),
            sourceReference: sourceReferenceList(services)
          },
          {
            heading: "Questions for next meeting",
            bullets: meetingQuestionItems(meeting),
            sourceReference: "Family questions and meeting agenda"
          },
          changeSection
        ]
      },
      student: {
        label: "Student view",
        title: "My plan and supports",
        sourceAlignment,
        coverageItems: summaryCoverageItemsForWorkspace(workspace, "student", { studentId }),
        sections: [
          {
            heading: "My goals",
            bullets: nonEmptyBullets(goals.map((goal) => `${goal.domain}: ${studentGoalText(goal)}`)),
            sourceReference: sourceReferenceList(goals)
          },
          {
            heading: "Supports I can ask for",
            bullets: nonEmptyBullets(accommodations.map(studentSupportPrompt)),
            sourceReference: sourceReferenceList(accommodations)
          },
          {
            heading: "What I am working on",
            bullets: studentWorkingOnItems(record, goals),
            sourceReference: "Present levels and goals"
          },
          {
            heading: "Transition activities",
            bullets: transitionActivityItems(record, student, meeting),
            sourceReference: "Transition services and meeting agenda"
          },
          {
            heading: "How I can participate",
            text: "Share what is helping, what feels hard, and which support you want teachers to understand before the meeting."
          }
        ]
      },
      administrator: {
        label: "Reviewer view",
        title: `${studentName} implementation and review brief`,
        sourceAlignment,
        coverageItems: summaryCoverageItemsForWorkspace(workspace, "administrator", { studentId }),
        sections: [
          {
            heading: "Implementation risk",
            bullets: nonEmptyBullets(openFlags.map((flag) => `${flag.severity}: ${flag.issue}`)),
            sourceReference: sourceReferenceList(openFlags)
          },
          {
            heading: "Missing sections",
            bullets: missingSectionItems(record, student),
            sourceReference: "Completeness review and structured record"
          },
          {
            heading: "Ambiguous services and supports",
            bullets: ambiguousImplementationItems(services, accommodations),
            sourceReference: sourceReferenceList([...services, ...accommodations])
          },
          {
            heading: "Unclear progress monitoring",
            bullets: unclearProgressMonitoringItems(goals, openFlags),
            sourceReference: sourceReferenceList(goals)
          },
          {
            heading: "Timeline issues",
            bullets: timelineIssueItems({ student, iep, meeting, workspace }),
            sourceReference: "IEP dates, meeting readiness, compliance reviews, and reminders"
          },
          {
            heading: "Placement rationale",
            bullets: placementRationaleItems(record, workspace, studentId),
            sourceReference: "Educational placement and placement review"
          },
          {
            heading: "Compliance flags",
            bullets: nonEmptyBullets(openFlags.map((flag) => `${flag.severity}: ${flag.issue}`)),
            sourceReference: sourceReferenceList(openFlags)
          },
          {
            heading: "Required human decisions",
            bullets: nonEmptyBullets([
              ...services
                .filter((service) => service.recoveryStatus && service.recoveryStatus !== "On schedule")
                .map((service) => `Confirm ${service.serviceType} delivery logs and recovery plan.`),
              ...accommodations
                .filter((accommodation) => accommodation.ambiguity)
                .map((accommodation) => `Clarify implementation details for: ${accommodation.description}`),
              ...goals
                .filter((goal) => /Needs review|Insufficient data/i.test(`${goal.status || ""} ${goal.progressSchedule?.status || ""}`))
                .map((goal) => `Review progress evidence for ${goal.domain}.`)
            ]),
            sourceReference: sourceReferenceList([...services, ...accommodations, ...goals])
          }
        ]
      }
    }
  };
}

export function summaryCoverageItemsForWorkspace(
  workspace = {},
  audience,
  { studentId = workspace.currentStudentId } = {}
) {
  const student = (workspace.students || []).find((item) => item.id === studentId);
  const iep = (workspace.ieps || []).find((item) => item.studentId === studentId);
  if (!student || !iep) return [];

  const record = normalizeStructuredIepRecord(workspace, iep);
  const goals = (workspace.goals || []).filter((goal) => goal.iepId === iep.id);
  const services = (workspace.services || []).filter((service) => service.iepId === iep.id);
  const accommodations = (workspace.accommodations || []).filter((accommodation) => accommodation.iepId === iep.id);
  const meeting = (workspace.meetings || []).find((item) => item.studentId === studentId);
  const openFlags = (workspace.reviewFlags || []).filter((flag) => flag.studentId === studentId && flag.status !== "Resolved");
  const comparisons = (workspace.iepComparisons || []).filter((comparison) => comparison.studentId === studentId);
  const grade = Number(student.grade);

  if (audience === "teacher") {
    return [
      coverageItem("Required accommodations", accommodations.map((item) => item.description), {
        sourceReference: sourceReferenceList(accommodations)
      }),
      coverageItem("Service obligations", services.map(serviceSummaryBullet), {
        sourceReference: sourceReferenceList(services)
      }),
      coverageItem("Classroom supports", accommodations.filter((item) => /classroom/i.test(item.setting || item.description)).map((item) => item.description), {
        sourceReference: sourceReferenceList(accommodations)
      }),
      coverageItem("Goal areas", goals.map((goal) => `${goal.domain}: ${goal.annualGoal}`), {
        sourceReference: sourceReferenceList(goals)
      }),
      coverageItem("Data collection responsibilities", goals.map((goal) => `${goal.domain}: ${goal.measurementMethod || "measure to confirm"} ${goal.frequency || "schedule to confirm"}.`), {
        sourceReference: sourceReferenceList(goals),
        status: goals.some((goal) => !goal.measurementMethod || !goal.frequency) ? "Needs review" : "Covered"
      }),
      coverageItem("Assessment accommodations", assessmentAccommodationItems(record), {
        sourceReference: "State and local assessments",
        fallback: "No assessment accommodations are documented in the structured record."
      }),
      coverageItem("Behavior supports", behaviorSupportItems(record), {
        sourceReference: "Special considerations and behavior support plan",
        status: record.specialConsiderations?.behavior && !hasStructuredValue(record.behaviorSupportPlan) ? "Needs review" : undefined,
        fallback: "No behavior support plan details are documented in the structured record."
      }),
      coverageItem("Important dates", summaryImportantDateItems({ iep, meeting, goals }), {
        sourceReference: "IEP dates, meeting information, and progress schedules"
      })
    ];
  }

  if (audience === "parent") {
    return [
      coverageItem("What the school provides", [...services.map(serviceSummaryBullet), ...accommodations.map((item) => item.description)], {
        sourceReference: sourceReferenceList([...services, ...accommodations])
      }),
      coverageItem("What each goal means", goals.map(parentGoalMeaningBullet), {
        sourceReference: sourceReferenceList(goals)
      }),
      coverageItem("How progress is measured", goals.map(parentGoalBullet), {
        sourceReference: sourceReferenceList(goals)
      }),
      coverageItem("Services required", services.map(serviceSummaryBullet), {
        sourceReference: sourceReferenceList(services)
      }),
      coverageItem("Questions for next meeting", meetingQuestionItems(meeting), {
        sourceReference: "Family questions and meeting agenda"
      }),
      coverageItem("What changed from the previous IEP", comparisons.map((comparison) => comparison.familySummary || comparison.title), {
        sourceReference: sourceReferenceList(comparisons.length ? comparisons : [{ sourceReference: "Prior IEP comparison note" }]),
        fallback: "No prior/current IEP comparison is documented yet."
      })
    ];
  }

  if (audience === "student") {
    return [
      coverageItem("My goals", goals.map((goal) => `${goal.domain}: ${studentGoalText(goal)}`), {
        sourceReference: sourceReferenceList(goals)
      }),
      coverageItem("My supports", accommodations.map(studentSupportPrompt), {
        sourceReference: sourceReferenceList(accommodations)
      }),
      coverageItem("How to ask for help", accommodations.map(studentSupportPrompt), {
        sourceReference: sourceReferenceList(accommodations)
      }),
      coverageItem("What I am working on", studentWorkingOnItems(record, goals), {
        sourceReference: "Present levels and goals"
      }),
      coverageItem("Transition activities", transitionActivityItems(record, student, meeting), {
        sourceReference: "Transition services and meeting agenda",
        status: grade < 8 && !hasStructuredValue(record.transitionServices) ? "Not applicable" : undefined
      })
    ];
  }

  if (audience === "administrator") {
    return [
      coverageItem("Missing sections", missingSectionItems(record, student), {
        sourceReference: "Completeness review and structured record",
        status: missingSectionItems(record, student)[0]?.startsWith("No missing") ? "Covered" : "Needs review"
      }),
      coverageItem("Ambiguous services", ambiguousImplementationItems(services, accommodations), {
        sourceReference: sourceReferenceList([...services, ...accommodations]),
        status: ambiguousImplementationItems(services, accommodations)[0]?.startsWith("No ambiguous") ? "Covered" : "Needs review"
      }),
      coverageItem("Unclear progress monitoring", unclearProgressMonitoringItems(goals, openFlags), {
        sourceReference: sourceReferenceList(goals),
        status: unclearProgressMonitoringItems(goals, openFlags)[0]?.startsWith("No unclear") ? "Covered" : "Needs review"
      }),
      coverageItem("Timeline issues", timelineIssueItems({ student, iep, meeting, workspace }), {
        sourceReference: "IEP dates, meeting readiness, compliance reviews, and reminders"
      }),
      coverageItem("Placement rationale", placementRationaleItems(record, workspace, studentId), {
        sourceReference: "Educational placement and placement review",
        status: hasStructuredValue(record.educationalPlacement) ? "Covered" : "Needs review"
      }),
      coverageItem("Compliance flags", openFlags.map((flag) => `${flag.severity}: ${flag.issue}`), {
        sourceReference: sourceReferenceList(openFlags),
        status: openFlags.length ? "Needs review" : "Covered",
        fallback: "No open advisory compliance flags are visible for this student."
      })
    ];
  }

  return [];
}

export function normalizeStructuredIepRecord(workspace, iep) {
  const record = iep?.structuredRecord || {};
  const student = (workspace.students || []).find((item) => item.id === iep?.studentId);
  const goals = (workspace.goals || []).filter((goal) => goal.iepId === iep?.id);
  const services = (workspace.services || []).filter((service) => service.iepId === iep?.id);
  const accommodations = (workspace.accommodations || []).filter((accommodation) => accommodation.iepId === iep?.id);
  const meeting = (workspace.meetings || []).find((item) => item.studentId === iep?.studentId);
  const sourceAlignment = record.sourceAlignment || iep?.sourceAlignment || alignmentFromRegistry(workspace.sourceRegistry);

  return {
    studentInformation: withFallback(record.studentInformation, {
      studentId: student?.id || iep?.studentId || "",
      name: student ? `${student.firstName} ${student.lastName}` : "",
      grade: student?.grade || "",
      school: student?.school || ""
    }),
    IEPTeam: withFallback(record.IEPTeam, []),
    specialConsiderations: withFallback(record.specialConsiderations, {}),
    currentPerformance: withFallback(record.currentPerformance, {}),
    goalsAndObjectives: withFallback(
      record.goalsAndObjectives,
      goals.map((goal) => ({
        domain: goal.domain,
        presentLevelReference: goal.presentLevelReference,
        annualGoal: goal.annualGoal,
        measurementMethod: goal.measurementMethod,
        frequency: goal.frequency,
        criteriaForMastery: goal.criteriaForMastery,
        responsibleStaff: goal.responsibleStaff,
        sourceReference: goal.sourceReference
      }))
    ),
    services: withFallback(
      record.services,
      services.map((service) => ({
        serviceType: service.serviceType,
        frequency: service.frequency,
        duration: service.duration,
        location: service.location,
        providerRole: service.providerRole,
        provider: service.provider,
        startDate: service.startDate,
        endDate: service.endDate,
        evidenceRequired: service.evidenceRequired,
        loggingRequirement: service.loggingRequirement,
        sourceReference: service.sourceReference
      }))
    ),
    supplementaryAidsAndServices: withFallback(
      record.supplementaryAidsAndServices,
      accommodations.map((accommodation) => ({
        support: accommodation.description,
        setting: accommodation.setting,
        frequency: accommodation.frequency,
        responsibleRole: accommodation.responsibleRole,
        startDate: accommodation.startDate,
        endDate: accommodation.endDate,
        sourceReference: accommodation.sourceReference
      }))
    ),
    accommodations: withFallback(
      record.accommodations,
      accommodations.map((accommodation) => ({
        description: accommodation.description,
        setting: accommodation.setting,
        frequency: accommodation.frequency,
        responsibleRole: accommodation.responsibleRole,
        startDate: accommodation.startDate,
        endDate: accommodation.endDate,
        evidenceRequired: accommodation.evidenceRequired,
        sourceReference: accommodation.sourceReference,
        ambiguity: accommodation.ambiguity || ""
      }))
    ),
    educationalPlacement: withFallback(record.educationalPlacement, {}),
    meetingInformation: withFallback(record.meetingInformation, {
      meetingDate: iep?.meetingDate || meeting?.date || "",
      startDate: iep?.startDate || "",
      endDate: iep?.endDate || "",
      meetingType: meeting?.type || "",
      participants: meeting?.participants || []
    }),
    transitionServices: withFallback(record.transitionServices, {}),
    stateAndLocalAssessments: withFallback(record.stateAndLocalAssessments, {}),
    behaviorSupportPlan: withFallback(record.behaviorSupportPlan, {}),
    progressMonitoring: withFallback(
      record.progressMonitoring,
      goals.map((goal) => ({
        goalId: goal.id,
        domain: goal.domain,
        measurementMethod: goal.measurementMethod,
        frequency: goal.frequency,
        progressSchedule: goal.progressSchedule,
        entries: goal.progressEntries
      }))
    ),
    additionalInformation: withFallback(record.additionalInformation, {}),
    sourceAlignment
  };
}

function extractionMetadata(section, sourceAlignment) {
  return {
    extractionSectionId: section.id,
    sourceReference: section.sourceReference,
    confidence: section.confidence,
    reviewStatus: section.status,
    sourceAlignment,
    sourceAnchorReview: section.sourceAnchorReview || null,
    editedBy: section.editedBy || "",
    editedByRole: section.editedByRole || "",
    editedAt: section.editedAt || ""
  };
}

function upsertByExtractionSection(items = [], nextItem) {
  const existing = Array.isArray(items) ? items : [];
  return [
    ...existing.filter((item) => item.extractionSectionId !== nextItem.extractionSectionId),
    nextItem
  ];
}

function goalFromExtractionSection(section, iep, sourceAlignment, approvedAt) {
  const content = String(section.content || "").trim();
  const domain = goalDomainFromText(content, section.title);
  return {
    id: derivedId("goal", section.id),
    iepId: iep.id,
    studentId: iep.studentId,
    domain,
    presentLevelReference: "currentPerformance.extractedSections",
    baseline: "Review present levels from the approved extraction.",
    annualGoal: content,
    measurementMethod: measurementMethodFromGoalText(content),
    frequency: frequencyFromText(content) || "Weekly",
    criteriaForMastery: criteriaFromGoalText(content),
    responsibleStaff: ["Case Manager"],
    status: "Needs review",
    sourceReference: section.sourceReference,
    extractionSectionId: section.id,
    sourceAlignment: section.sourceAlignment || sourceAlignment,
    approvedFromExtractionAt: approvedAt,
    progressSchedule: {
      frequency: frequencyFromText(content) || "Weekly",
      nextDueDate: "2026-06-30",
      lastCollectedDate: "",
      status: "Due soon",
      evidenceType: "Progress monitoring evidence",
      evidenceRequired: true,
      responsibleRole: "Case Manager"
    },
    progressEntries: []
  };
}

function serviceFromExtractionSection(section, iep, sourceAlignment, approvedAt) {
  const content = String(section.content || "").trim();
  const duration = durationFromText(content);
  return {
    id: derivedId("service", section.id),
    iepId: iep.id,
    studentId: iep.studentId,
    serviceType: serviceTypeFromText(content, section.title),
    description: content,
    frequency: frequencyFromText(content) || "See approved extraction",
    duration: duration || "See approved extraction",
    location: locationFromText(content),
    providerRole: providerRoleFromText(content),
    provider: "",
    startDate: iep.startDate || "",
    endDate: iep.endDate || "",
    evidenceRequired: true,
    loggingRequirement: "Service delivery minutes must be logged and reviewed against the approved frequency, duration, and location.",
    sourceReference: section.sourceReference,
    extractionSectionId: section.id,
    sourceAlignment: section.sourceAlignment || sourceAlignment,
    approvedFromExtractionAt: approvedAt,
    deliveredMinutes: 0,
    scheduledMinutes: duration || 0,
    recoveryStatus: "Log needed",
    recoveryPlan: {
      status: "Not reviewed",
      missedMinutes: 0,
      recoveryDate: "",
      provider: "",
      familyCommunication: "",
      plannedBy: "",
      plannedAt: ""
    }
  };
}

function accommodationFromExtractionSection(section, iep, sourceAlignment, approvedAt) {
  const content = String(section.content || "").trim();
  return {
    id: derivedId("acc", section.id),
    iepId: iep.id,
    studentId: iep.studentId,
    description: content,
    setting: accommodationSettingFromText(content, section.sourceSection),
    responsibleRole: "General Education Teacher",
    frequency: frequencyFromText(content) || "As written in approved extraction",
    startDate: iep.startDate || "",
    endDate: iep.endDate || "",
    evidenceRequired: Boolean(section.warning),
    sourceReference: section.sourceReference,
    extractionSectionId: section.id,
    sourceAlignment: section.sourceAlignment || sourceAlignment,
    approvedFromExtractionAt: approvedAt,
    ambiguity: section.warning || ""
  };
}

function progressTaskFromGoal(goal, section, sourceAlignment) {
  return {
    id: derivedId("task-progress", section.id),
    studentId: goal.studentId,
    sourceSection: "Progress Monitoring",
    title: `Confirm progress monitoring for ${goal.domain}`,
    description: `Review schedule, evidence, and data entry for this approved goal: ${goal.annualGoal}`,
    responsibleRole: "Case Manager",
    frequency: goal.frequency,
    evidenceRequired: true,
    status: "Active",
    dueDate: goal.progressSchedule.nextDueDate,
    assignedTo: "Case manager",
    category: "caseManager",
    sourceReference: section.sourceReference,
    extractionSectionId: section.id,
    sourceAlignment: section.sourceAlignment || sourceAlignment,
    acknowledgments: []
  };
}

function serviceTaskFromService(service, section, sourceAlignment) {
  const responsibleRole = taskRoleForProvider(service.providerRole);
  return {
    id: derivedId("task-service", section.id),
    studentId: service.studentId,
    sourceSection: "Services",
    title: `Log ${service.serviceType.toLowerCase()} delivery`,
    description: `Track minutes, location, provider, and missed-service recovery for this approved service: ${service.description}`,
    responsibleRole,
    frequency: service.frequency,
    evidenceRequired: true,
    status: "Active",
    dueDate: "Ongoing",
    assignedTo: service.providerRole,
    category: responsibleRole === "Related Service Provider" ? "related" : "caseManager",
    sourceReference: section.sourceReference,
    extractionSectionId: section.id,
    sourceAlignment: section.sourceAlignment || sourceAlignment,
    acknowledgments: []
  };
}

function accommodationTaskFromAccommodation(accommodation, section, sourceAlignment) {
  return {
    id: derivedId("task-accommodation", section.id),
    studentId: accommodation.studentId,
    sourceSection: "Accommodations",
    title: taskTitleFromAccommodation(accommodation.description),
    description: accommodation.description,
    responsibleRole: accommodation.responsibleRole,
    frequency: accommodation.frequency,
    evidenceRequired: accommodation.evidenceRequired,
    status: "Active",
    dueDate: "Ongoing",
    assignedTo: "Core teachers",
    category: "generalEducation",
    sourceReference: section.sourceReference,
    extractionSectionId: section.id,
    sourceAlignment: section.sourceAlignment || sourceAlignment,
    acknowledgments: []
  };
}

function upsertByIdPreserving(items = [], nextItem, preserveFields = []) {
  const existing = Array.isArray(items) ? items : [];
  const previous = existing.find((item) => item.id === nextItem.id);
  const merged = previous
    ? {
        ...previous,
        ...nextItem,
        ...Object.fromEntries(preserveFields.filter((field) => previous[field] !== undefined).map((field) => [field, previous[field]]))
      }
    : nextItem;
  return [...existing.filter((item) => item.id !== nextItem.id), merged];
}

function derivedId(prefix, sourceId) {
  return `${prefix}-from-${String(sourceId || "extraction").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function goalDomainFromText(content, title = "") {
  const combined = `${title} ${content}`.toLowerCase();
  if (/read|comprehension|fluency|inferential|literal/.test(combined)) return "Reading";
  if (/writ|paragraph|essay|composition/.test(combined)) return "Written expression";
  if (/speech|language|communication/.test(combined)) return "Communication";
  if (/routine|executive|organization|planner/.test(combined)) return "Executive function";
  return title && !/detected|annual goal/i.test(title) ? title : "Extracted goal";
}

function measurementMethodFromGoalText(content) {
  if (/probe/i.test(content)) return "Source-aligned probe";
  if (/rubric/i.test(content)) return "Rubric-scored work sample";
  if (/accuracy|percent|%/i.test(content)) return "Accuracy data collection";
  return "Review confirmed from extracted source text";
}

function criteriaFromGoalText(content) {
  const consecutive = content.match(/\d+\s+consecutive\s+[^.,;]+/i);
  if (consecutive) return consecutive[0];
  const accuracy = content.match(/\d+%?\s*accuracy/i);
  if (accuracy) return accuracy[0];
  const percent = content.match(/\d+%/);
  if (percent) return percent[0];
  return "See approved annual goal text";
}

function frequencyFromText(content) {
  if (/daily|each day/i.test(content)) return "Daily";
  if (/weekly|each week|per week|one time a week|one time per week|1x\/week/i.test(content)) return "Weekly";
  const timesPerWeek = content.match(/(\d+)\s*(x|times?)\s*(per|\/)?\s*week/i);
  if (timesPerWeek) return `${timesPerWeek[1]}x/week`;
  if (/monthly|each month/i.test(content)) return "Monthly";
  if (/as needed/i.test(content)) return "As needed";
  return "";
}

function durationFromText(content) {
  const match = content.match(/(\d+)\s*(min|minute|minutes)\b/i);
  return match ? Number(match[1]) : "";
}

function serviceTypeFromText(content, title = "") {
  const combined = `${title} ${content}`.toLowerCase();
  if (/speech|language/.test(combined)) return "Speech-language support";
  if (/read|comprehension|literacy/.test(combined)) return "Reading support";
  if (/occupational|fine motor|sensory/.test(combined)) return "Occupational therapy";
  if (/physical therapy|\bpt\b/.test(combined)) return "Physical therapy";
  if (/counsel/.test(combined)) return "Counseling support";
  return "Extracted service";
}

function providerRoleFromText(content) {
  if (/speech|language|slp/i.test(content)) return "Speech-Language Pathologist";
  if (/read|literacy/i.test(content)) return "Reading Specialist";
  if (/occupational|fine motor|sensory/i.test(content)) return "Occupational Therapist";
  if (/physical therapy|\bpt\b/i.test(content)) return "Physical Therapist";
  if (/counsel/i.test(content)) return "Counselor";
  return "Assigned provider";
}

function locationFromText(content) {
  if (/small group/i.test(content)) return "Small group";
  if (/general education|classroom/i.test(content)) return "General education classroom";
  if (/individual|one[- ]to[- ]one|1:1/i.test(content)) return "Individual";
  return "See approved extraction";
}

function accommodationSettingFromText(content, sourceSection = "") {
  if (/assessment|test|exam/i.test(content)) return "Classroom and assessment";
  if (/classroom/i.test(content)) return "Classroom";
  return sourceSection || "Approved accommodation";
}

function taskRoleForProvider(providerRole) {
  return /pathologist|therapist|counselor|provider/i.test(providerRole) ? "Related Service Provider" : "Case Manager";
}

function taskTitleFromAccommodation(description) {
  if (/extended time/i.test(description)) return "Provide extended time as written";
  if (/graphic organizer/i.test(description)) return "Provide approved graphic organizer";
  if (/written directions/i.test(description)) return "Provide written directions";
  return "Implement approved accommodation";
}

function nonEmptyBullets(items, fallback = ["No approved source-aligned items are documented yet."]) {
  const bullets = items.map((item) => String(item || "").trim()).filter(Boolean);
  return bullets.length ? bullets : fallback;
}

function sourceReferenceList(items = []) {
  const references = [
    ...new Set(
      items
        .map((item) => item?.sourceReference)
        .filter(Boolean)
    )
  ];
  return references.length ? references.join("; ") : "Approved structured IEP record";
}

function serviceSummaryBullet(service) {
  const duration = service.duration ? `${service.duration}${typeof service.duration === "number" ? " minutes" : ""}` : "duration to confirm";
  return `${service.serviceType || "Service"}: ${service.frequency || "frequency to confirm"}, ${duration}, ${service.location || "location to confirm"}.`;
}

function parentGoalBullet(goal) {
  return `${goal.domain}: ${goal.annualGoal} Progress is measured with ${goal.measurementMethod || "the approved measure"} ${goal.frequency || "as scheduled"}.`;
}

function parentGoalMeaningBullet(goal) {
  return `${goal.domain}: ${studentGoalText(goal)}`;
}

function studentGoalText(goal) {
  if (/^edited annual goal:/i.test(goal.annualGoal || "")) return goal.annualGoal.replace(/^edited annual goal:\s*/i, "");
  return goal.annualGoal || "Keep working toward the approved goal with your team.";
}

function studentSupportPrompt(accommodation) {
  const description = accommodation.description || "approved support";
  if (/extended time/i.test(description)) return "Can I have the extended time listed in my plan?";
  if (/graphic organizer/i.test(description)) return "Can I use my approved graphic organizer?";
  if (/written directions/i.test(description)) return "Can I have the written directions too?";
  return `Can I use this support: ${description}?`;
}

function coverageItem(label, items, { sourceReference, status, fallback = "No approved source-aligned items are documented yet." } = {}) {
  const bullets = nonEmptyBullets(Array.isArray(items) ? items : [items], [fallback]);
  const missing = bullets.length === 1 && bullets[0] === fallback;
  return {
    label,
    status: status || (missing ? "Needs review" : "Covered"),
    detail: bullets.slice(0, 3).join(" "),
    sourceReference: sourceReference || "Approved structured IEP record"
  };
}

function assessmentAccommodationItems(record) {
  return structuredValueItems(record.stateAndLocalAssessments?.accommodations);
}

function behaviorSupportItems(record) {
  const planItems = structuredValueItems(record.behaviorSupportPlan);
  if (planItems.length) return planItems;
  return nonEmptyBullets(
    [
      record.specialConsiderations?.behavior ? `Behavior need noted: ${record.specialConsiderations.behavior}` : "",
      record.specialConsiderations?.behavior ? "No separate behavior support plan details are documented." : ""
    ],
    []
  );
}

function summaryImportantDateItems({ iep, meeting, goals = [] }) {
  return nonEmptyBullets(
    [
      iep?.startDate || iep?.endDate ? `IEP term: ${summaryDate(iep.startDate)} to ${summaryDate(iep.endDate)}.` : "",
      meeting?.date ? `${meeting.type || "IEP meeting"}: ${summaryDate(meeting.date)}${meeting.time ? ` at ${meeting.time}` : ""}.` : "",
      ...goals.map((goal) =>
        goal.progressSchedule?.nextDueDate
          ? `${goal.domain} progress data due ${summaryDate(goal.progressSchedule.nextDueDate)}.`
          : ""
      )
    ],
    ["No important dates are documented yet."]
  );
}

function meetingQuestionItems(meeting) {
  return nonEmptyBullets(
    [
      ...(meeting?.familyQuestions || []).map((question) => question.text),
      ...(meeting?.agenda || []).filter((item) => /question|family|priority|next step/i.test(item)).map((item) => `Agenda item: ${item}`)
    ],
    ["No family questions are recorded yet; ask the team what should be addressed before the meeting."]
  );
}

function studentWorkingOnItems(record, goals = []) {
  const performanceItems = Object.entries(record.currentPerformance || {})
    .filter(([key, value]) => key !== "extractedSections" && hasStructuredValue(value))
    .map(([key, value]) => `${labelFromKey(key)}: ${value}`);
  return nonEmptyBullets(
    [
      ...goals.map((goal) => `${goal.domain}: ${studentGoalText(goal)}`),
      ...performanceItems
    ],
    ["No current goal or present-level language is documented yet."]
  );
}

function transitionActivityItems(record, student, meeting) {
  const transitionItems = structuredValueItems(record.transitionServices);
  if (transitionItems.length) return transitionItems;
  const grade = Number(student?.grade);
  if (grade >= 8) return ["Transition services need source review for this grade-level record."];
  return nonEmptyBullets(
    [
      "Transition services are not documented for this grade-level record.",
      ...(meeting?.agenda || []).filter((item) => /student|self-advocacy|strength/i.test(item)).map((item) => `Meeting prep: ${item}`)
    ],
    ["Transition activities are not applicable to this record yet."]
  );
}

function missingSectionItems(record, student) {
  const grade = Number(student?.grade);
  return nonEmptyBullets(
    [
      !hasStructuredValue(record.stateAndLocalAssessments) ? "State/local assessment information is missing." : "",
      record.specialConsiderations?.behavior && !hasStructuredValue(record.behaviorSupportPlan)
        ? "Behavior need is identified, but no behavior support plan details are documented."
        : "",
      grade >= 8 && !hasStructuredValue(record.transitionServices) ? "Transition services are missing for an age-appropriate student." : "",
      !hasStructuredValue(record.educationalPlacement) ? "Educational placement rationale is missing." : ""
    ],
    ["No missing required summary sections detected from the reviewed structured record."]
  );
}

function ambiguousImplementationItems(services = [], accommodations = []) {
  return nonEmptyBullets(
    [
      ...services
        .filter((service) => service.recoveryStatus && service.recoveryStatus !== "On schedule")
        .map((service) => `${service.serviceType}: ${service.recoveryStatus}.`),
      ...accommodations
        .filter((accommodation) => accommodation.ambiguity)
        .map((accommodation) => `${accommodation.description} ${accommodation.ambiguity}`)
    ],
    ["No ambiguous services or supports are currently flagged."]
  );
}

function unclearProgressMonitoringItems(goals = [], openFlags = []) {
  return nonEmptyBullets(
    [
      ...goals
        .filter((goal) => !goal.measurementMethod || !hasStructuredValue(goal.progressSchedule) || /needs review|insufficient|stale/i.test(`${goal.status || ""} ${goal.progressSchedule?.status || ""}`))
        .map((goal) => `${goal.domain}: ${goal.progressSchedule?.status || "monitoring plan needs review"}.`),
      ...openFlags
        .filter((flag) => /progress|data|evidence|monitor/i.test(`${flag.section || ""} ${flag.issue || ""}`))
        .map((flag) => `${flag.severity}: ${flag.issue}`)
    ],
    ["No unclear progress monitoring items are currently flagged."]
  );
}

function timelineIssueItems({ student, iep, meeting, workspace }) {
  const complianceReviews = (workspace.complianceReviews || []).filter((review) => review.studentId === student?.id);
  return nonEmptyBullets(
    [
      student?.annualReviewDate ? `Annual review due ${summaryDate(student.annualReviewDate)}.` : "",
      iep?.endDate ? `Current IEP ends ${summaryDate(iep.endDate)}.` : "",
      meeting?.date ? `${meeting.type || "IEP meeting"} scheduled ${summaryDate(meeting.date)}${meeting.time ? ` at ${meeting.time}` : ""}.` : "",
      ...complianceReviews.map((review) => `${review.reviewType || "Compliance review"} due ${summaryDate(review.dueDate)}: ${review.status}.`)
    ],
    ["No timeline issues are documented yet."]
  );
}

function placementRationaleItems(record, workspace, studentId) {
  const placement = record.educationalPlacement || {};
  const reviews = (workspace.placementReviews || []).filter((review) => review.studentId === studentId);
  return nonEmptyBullets(
    [
      placement.setting ? `Setting: ${placement.setting}.` : "",
      placement.rationale ? `Rationale: ${placement.rationale}` : "",
      ...reviews.map((review) => `${review.status}: ${review.reviewNote || review.rationale || "Placement review note recorded."}`)
    ],
    ["No educational placement rationale is documented yet."]
  );
}

function structuredValueItems(value) {
  if (Array.isArray(value)) return value.flatMap(structuredValueItems);
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([key, item]) => key !== "extractedSections" && hasStructuredValue(item))
      .flatMap(([key, item]) => {
        const nested = structuredValueItems(item);
        return nested.length === 1 && nested[0] === String(item)
          ? [`${labelFromKey(key)}: ${nested[0]}`]
          : nested.map((entry) => `${labelFromKey(key)}: ${entry}`);
      });
  }
  return hasStructuredValue(value) ? [String(value)] : [];
}

function labelFromKey(key = "") {
  return String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summaryDate(value) {
  return value || "not recorded";
}

function plainPlanSupportText(firstName, record, goals) {
  const goalDomains = goals.map((goal) => goal.domain).filter(Boolean);
  if (goalDomains.length) {
    return `${firstName} is working on ${goalDomains.join(", ").toLowerCase()} with supports and progress checks from the approved IEP.`;
  }
  const performanceAreas = Object.keys(record.currentPerformance || {}).filter((key) => key !== "extractedSections");
  return `${firstName} has approved IEP supports${performanceAreas.length ? ` connected to ${performanceAreas.join(", ")}` : ""}.`;
}

function defaultPreviousIepChangeSection() {
  return {
    heading: "What changed from the previous IEP",
    bullets: [
      "Review the prior IEP comparison with the team before sharing change language.",
      "Confirm whether any goals, services, accommodations, or progress-monitoring expectations changed."
    ],
    sourceReference: "Prior IEP comparison note"
  };
}

export function generateCompletenessReviewFlags(workspace, { studentId = workspace.currentStudentId, actor = "IEP Assistant", role = "assistant", generatedAt = new Date().toISOString() } = {}) {
  const student = (workspace.students || []).find((item) => item.id === studentId);
  const iep = (workspace.ieps || []).find((item) => item.studentId === studentId);
  if (!student || !iep) return [];
  const record = normalizeStructuredIepRecord(workspace, iep);
  const sourceAlignment = record.sourceAlignment || iep.sourceAlignment || alignmentFromRegistry(workspace.sourceRegistry);
  const flags = [];
  const addFlag = (rule, severity, section, issue, whyItMatters, suggestedRevision, sourceReference) => {
    flags.push({
      id: `generated-${studentId}-${rule}`,
      studentId,
      severity,
      section,
      issue,
      whyItMatters,
      suggestedRevision,
      sourceReference,
      humanReviewRequired: true,
      status: "Open",
      sourceAlignment,
      generatedBy: actor,
      generatedByRole: role,
      generatedAt,
      generatedRule: rule
    });
  };

  if (!hasStructuredValue(record.currentPerformance)) {
    addFlag(
      "missing-current-performance",
      "High",
      "Current Performance",
      "Present levels are missing from the structured record",
      "Goals and services should connect to current performance so the team can understand the student's needs and baseline.",
      "Review the source IEP and add present-level information before relying on downstream summaries or goals.",
      "currentPerformance"
    );
  }

  (record.goalsAndObjectives || []).forEach((goal, index) => {
    if (!goal.measurementMethod || !goal.criteriaForMastery) {
      addFlag(
        `goal-${index + 1}-missing-measurement`,
        "Medium",
        "Goals and Objectives",
        "Goal is missing measurement method or mastery criterion",
        "Staff may not know how progress should be measured or when the goal is considered met.",
        "Add or confirm the measurement method, frequency, and mastery criterion from the official IEP.",
        goal.sourceReference || "goalsAndObjectives"
      );
    }
  });

  (record.services || []).forEach((service, index) => {
    const missing = ["frequency", "duration", "location", "providerRole"].filter((field) => !hasStructuredValue(service[field]));
    if (missing.length) {
      addFlag(
        `service-${index + 1}-missing-grid-fields`,
        "High",
        "Services",
        "Service entry is missing frequency, duration, location, or provider role",
        "Incomplete service-grid fields make implementation and missed-minute tracking unreliable.",
        `Confirm the missing service field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
        service.sourceReference || "services"
      );
    }
  });

  (record.accommodations || []).forEach((accommodation, index) => {
    if (accommodation.ambiguity || !accommodation.setting || !accommodation.frequency) {
      addFlag(
        `accommodation-${index + 1}-implementation-specificity`,
        "Medium",
        "Accommodations",
        "Accommodation needs clearer implementation context",
        "Teachers may apply accommodations inconsistently when setting, frequency, trigger, or limits are unclear.",
        "Clarify implementation details through the IEP team without inventing terms not present in the official source.",
        accommodation.sourceReference || "accommodations"
      );
    }
  });

  if (!hasStructuredValue(record.stateAndLocalAssessments)) {
    addFlag(
      "missing-state-local-assessments",
      "Medium",
      "State and Local Assessments",
      "State/local assessment information is missing",
      "Assessment participation and accommodations should be visible so staff can prepare testing supports correctly.",
      "Confirm assessment participation and any assessment accommodations from the source IEP.",
      "stateAndLocalAssessments"
    );
  }

  const behaviorIdentified = Boolean(record.specialConsiderations?.behavior);
  if (behaviorIdentified && !hasStructuredValue(record.behaviorSupportPlan)) {
    addFlag(
      "behavior-need-without-plan",
      "Medium",
      "Behavior Support Plan",
      "Behavior need is identified but no behavior support plan details are documented",
      "When behavior needs are noted, staff need to know whether there is a plan, who owns it, and how supports should be implemented.",
      "Confirm whether a behavior support plan is required and document the source-aligned implementation details.",
      "specialConsiderations.behavior"
    );
  }

  const grade = Number(student.grade);
  if (grade >= 8 && !hasStructuredValue(record.transitionServices)) {
    addFlag(
      "age-appropriate-transition-missing",
      "Medium",
      "Transition Services",
      "Transition services are missing for an age-appropriate student",
      "Older students may need transition planning connected to post-school goals, services, and student participation.",
      "Review transition requirements for this student and add source-aligned transition services when applicable.",
      "transitionServices"
    );
  }

  (record.progressMonitoring || []).forEach((progress, index) => {
    if (!progress.measurementMethod || !hasStructuredValue(progress.progressSchedule)) {
      addFlag(
        `progress-${index + 1}-missing-monitoring-plan`,
        "Medium",
        "Progress Monitoring",
        "Progress monitoring plan is incomplete",
        "Progress reporting is harder to trust when the method, schedule, or responsible role is missing.",
        "Confirm the progress-monitoring method, schedule, and evidence expectations from the IEP.",
        progress.domain || "progressMonitoring"
      );
    }
  });

  if (!hasStructuredValue(record.meetingInformation) || !(record.IEPTeam || []).length) {
    addFlag(
      "missing-meeting-team-information",
      "Medium",
      "Meeting Information",
      "Meeting information or team members are missing",
      "Meeting preparation and required participation checks depend on accurate team and meeting information.",
      "Confirm meeting date, type, participants, and required IEP team roles.",
      "meetingInformation"
    );
  }

  return flags;
}

function withFallback(value, fallback) {
  return hasStructuredValue(value) ? value : fallback;
}

function hasStructuredValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.values(value).some(hasStructuredValue);
  return value !== undefined && value !== null && value !== "";
}

function alignmentFromRegistry(registry = {}) {
  const activeEntry = (registry.entries || []).find((entry) => entry.sourceId === registry.activeSourceId) || registry.entries?.[0];
  return {
    jurisdiction: registry.jurisdiction || activeEntry?.jurisdiction || defaultSourceAlignment.jurisdiction,
    programArea: registry.programArea || activeEntry?.programArea || defaultSourceAlignment.programArea,
    sourceForm: activeEntry?.title || defaultSourceAlignment.sourceForm,
    sourceFormType: activeEntry?.sourceFormType || defaultSourceAlignment.sourceFormType,
    sourceId: activeEntry?.sourceId || registry.activeSourceId || defaultSourceAlignment.sourceId,
    effectiveDate: activeEntry?.effectiveDate || defaultSourceAlignment.effectiveDate,
    languagesAvailable: activeEntry?.languagesAvailable || ["English"],
    languageAvailabilityNote: activeEntry?.languageAvailabilityNote || "",
    sourceRegistryVersion: registry.sourceRegistryVersion || defaultSourceAlignment.sourceRegistryVersion
  };
}

export function createAuditEvent(type, title, detail, actor = "BJ Tarves") {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    detail,
    actor,
    timestamp: new Date().toISOString()
  };
}

export function createDemoExtraction(sourceText, documentName) {
  const fallback = "Pasted or uploaded source content was preserved. Demo extraction populated review fields from the Pennsylvania school-age IEP structure.";
  return [
    {
      id: `extract-${Date.now()}-present`,
      key: "currentPerformance.demo",
      title: "Detected present levels",
      sourceSection: "Present Levels",
      sourceReference: documentName,
      confidence: sourceText ? 88 : 72,
      status: "Needs review",
      sourceAlignment: defaultSourceAlignment,
      content: sourceText?.slice(0, 260) || fallback
    },
    {
      id: `extract-${Date.now()}-goal`,
      key: "goalsAndObjectives.demo",
      title: "Detected goal or objective",
      sourceSection: "Goals and Objectives",
      sourceReference: documentName,
      confidence: 81,
      status: "Needs review",
      sourceAlignment: defaultSourceAlignment,
      content:
        "Demo extraction: review the source and confirm the measurable goal, method, frequency, and mastery criteria."
    },
    {
      id: `extract-${Date.now()}-services`,
      key: "services.demo",
      title: "Detected services and supports",
      sourceSection: "Services and Supplementary Aids",
      sourceReference: documentName,
      confidence: 79,
      status: "Needs review",
      sourceAlignment: defaultSourceAlignment,
      content:
        "Demo extraction: confirm frequency, duration, provider role, location, start date, and end date before activation."
    }
  ];
}
