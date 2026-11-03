import React, { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Bot,
  Check,
  Database,
  FileCheck2,
  Gauge,
  Save,
  ShieldCheck,
  Users
} from "lucide-react";

const tabs = [
  { id: "overview", label: "Overview", icon: ShieldCheck },
  { id: "roles", label: "Roles & records", icon: Users },
  { id: "integrations", label: "Integrations", icon: Database },
  { id: "alerts", label: "Alerts & metrics", icon: Gauge },
  { id: "ai", label: "AI & compliance", icon: Bot }
];

const readinessStatuses = [
  "In readiness review",
  "Covered in local MVP",
  "Design control implemented",
  "Local control implemented",
  "Policy documented",
  "District controlled",
  "Workspace boundary enforced",
  "Active in local rules",
  "Measurement design ready",
  "Readiness review",
  "Pilot approved",
  "District validation required",
  "Production blocked"
];

const integrationStatuses = ["No live integration", "Readiness review", "Pilot approved", "Production blocked", "Production approved"];

const roleFields = [
  field("studentScope", "Student scope"),
  field("defaultAccess", "Default access", "textarea"),
  field("visibleInformation", "Visible information", "textarea"),
  field("status", "Policy status", "select", readinessStatuses),
  field("owner", "Policy owner"),
  field("nextReviewDate", "Next review", "date"),
  field("note", "Review note", "textarea")
];

const lifecycleFields = [
  field("draftStatus", "Draft status"),
  field("reviewedStatus", "Reviewed status"),
  field("officialReady", "Official-ready", "checkbox"),
  field("exportable", "Exportable", "checkbox"),
  field("requiredReviewRole", "Required reviewer"),
  field("boundaryLabel", "Boundary label", "textarea"),
  field("status", "Lifecycle status", "select", readinessStatuses),
  field("reviewNote", "Review note", "textarea")
];

const integrationFields = [
  field("sourceOfTruth", "Source of truth", "textarea"),
  field("direction", "Exchange direction"),
  field("provider", "Provider"),
  field("owner", "Integration owner"),
  field("status", "Readiness status", "select", integrationStatuses),
  field("nextReviewDate", "Next review", "date"),
  field("boundary", "Integration boundary", "textarea"),
  field("reviewNote", "Review note", "textarea")
];

const alertFields = [
  field("enabled", "Rule enabled", "checkbox"),
  field("triggerDays", "Trigger window (days)", "number"),
  field("priority", "Priority", "select", ["Normal", "High", "Critical"]),
  field("escalationRole", "Escalation owner"),
  field("status", "Rule status", "select", readinessStatuses),
  field("reviewNote", "Review note", "textarea")
];

const metricFields = [
  field("baseline", "Baseline"),
  field("target", "Target"),
  field("reviewCadence", "Review cadence"),
  field("owner", "Metric owner"),
  field("status", "Measurement status", "select", readinessStatuses),
  field("evidenceSource", "Evidence source", "textarea"),
  field("reviewNote", "Review note", "textarea")
];

export function GapClosurePanel({ state, dispatch, canManage = false }) {
  const [activeTab, setActiveTab] = useState("overview");
  const workflowAcceptance = state.gapClosure?.workflowAcceptance || [];
  const complianceChecklist = state.gapClosure?.complianceChecklist || [];
  const latestReview = state.gapClosure?.reviewHistory?.[0] || null;
  const coveredWorkflows = workflowAcceptance.filter((item) => /covered/i.test(item.status)).length;
  const blockedIntegrations = (state.integrationSources || []).filter((item) => /blocked|no live/i.test(item.status)).length;
  const activeAlerts = (state.alertRules || []).filter((item) => item.enabled).length;
  const measurableOutcomes = (state.successMetrics || []).filter((item) => item.target && item.target !== "Not measured").length;

  return (
    <section className="gap-closure-panel" aria-labelledby="gap-closure-title" data-testid="gap-closure-panel">
      <div className="gap-closure-head">
        <div>
          <span className="eyebrow">FDS readiness governance</span>
          <h2 id="gap-closure-title">Gap Closure / Readiness</h2>
          <p>Operational ownership, record boundaries, integration assumptions, alert policy, and measurable pilot outcomes.</p>
        </div>
        <StatusPill status={state.gapClosure?.status || "Restricted"} />
      </div>

      <div className="gap-metrics" aria-label="Readiness summary">
        <GapMetric label="Daily flows covered" value={`${coveredWorkflows}/${workflowAcceptance.length || 6}`} icon={Check} />
        <GapMetric label="Roles documented" value={state.rolePolicyMatrix?.length || 0} icon={Users} />
        <GapMetric label="Integration blockers" value={blockedIntegrations} icon={Database} tone={blockedIntegrations ? "red" : "green"} />
        <GapMetric label="Active alert rules" value={activeAlerts} icon={BellRing} />
        <GapMetric label="Outcome targets" value={measurableOutcomes} icon={Gauge} />
      </div>

      <div className="gap-tabs" role="tablist" aria-label="Gap closure readiness areas">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "active" : ""}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="gap-tab-content" role="tabpanel">
        {activeTab === "overview" ? (
          <OverviewTab
            state={state}
            workflows={workflowAcceptance}
            latestReview={latestReview}
            canManage={canManage}
          />
        ) : null}
        {activeTab === "roles" ? <RolesTab state={state} dispatch={dispatch} canManage={canManage} /> : null}
        {activeTab === "integrations" ? <IntegrationsTab state={state} dispatch={dispatch} canManage={canManage} /> : null}
        {activeTab === "alerts" ? <AlertsMetricsTab state={state} dispatch={dispatch} canManage={canManage} /> : null}
        {activeTab === "ai" ? (
          <AiComplianceTab state={state} checklist={complianceChecklist} canManage={canManage} />
        ) : null}
      </div>
    </section>
  );
}

function OverviewTab({ state, workflows, latestReview, canManage }) {
  return (
    <div className="gap-stack">
      <BoundaryBand boundary={state.officialRecordBoundary} />
      {!canManage ? <RestrictedNotice /> : null}
      <section className="gap-section" aria-labelledby="workflow-acceptance-title">
        <div className="gap-section-head">
          <div>
            <h3 id="workflow-acceptance-title">Daily workflow acceptance</h3>
            <p>Concrete evidence for the morning-to-end-of-day operating loop.</p>
          </div>
          <StatusPill status={`${workflows.length} acceptance paths`} />
        </div>
        {workflows.length ? (
          <div className="gap-workflow-list">
            {workflows.map((workflow) => (
              <article key={workflow.id}>
                <div>
                  <strong>{workflow.name}</strong>
                  <span>{workflow.entryPoint}</span>
                </div>
                <p>{workflow.expectedOutcome}</p>
                <small>{workflow.evidence}</small>
                <StatusPill status={workflow.status} />
              </article>
            ))}
          </div>
        ) : (
          <Empty text="Workflow acceptance evidence is restricted to governance roles." />
        )}
      </section>
      <section className="gap-section gap-review-strip" aria-label="Latest governance review">
        <FileCheck2 size={20} />
        <div>
          <strong>{latestReview?.subjectLabel || "No governance review recorded yet"}</strong>
          <span>{latestReview ? `${latestReview.reviewType} · ${latestReview.status}` : "Save a readiness review to create digest-bound evidence."}</span>
        </div>
        {latestReview ? <small>{shortDigest(latestReview.reviewDigest)} · {formatDateTime(latestReview.reviewedAt)}</small> : null}
      </section>
    </div>
  );
}

function RolesTab({ state, dispatch, canManage }) {
  return (
    <div className="gap-columns">
      <section className="gap-section">
        <div className="gap-section-head">
          <div><h3>Role and student-scope policy</h3><p>Governance evidence for least-privilege access. Runtime permissions remain server-enforced.</p></div>
          <StatusPill status={`${state.rolePolicyMatrix?.length || 0} roles`} />
        </div>
        <RecordList
          items={state.rolePolicyMatrix}
          title={(item) => item.roleLabel}
          meta={(item) => item.studentScope}
          detail={(item) => item.defaultAccess}
        />
        <GovernanceEditor
          title="Review role policy"
          items={state.rolePolicyMatrix}
          itemIdKey="roleId"
          actionIdKey="roleId"
          actionType="updateRolePolicy"
          fields={roleFields}
          disabled={!canManage}
          dispatch={dispatch}
          saveLabel="Save role review"
          testId="role-policy-editor"
        />
      </section>
      <section className="gap-section">
        <div className="gap-section-head">
          <div><h3>Record lifecycle rules</h3><p>Transitions between working content, human-reviewed evidence, exports, and official district records.</p></div>
          <StatusPill status={`${state.recordLifecycleRules?.length || 0} rules`} />
        </div>
        <RecordList
          items={state.recordLifecycleRules}
          title={(item) => item.name}
          meta={(item) => `${item.draftStatus} → ${item.reviewedStatus}`}
          detail={(item) => item.boundaryLabel}
        />
        <GovernanceEditor
          title="Review lifecycle rule"
          items={state.recordLifecycleRules}
          actionIdKey="ruleId"
          actionType="updateRecordLifecycle"
          fields={lifecycleFields}
          disabled={!canManage}
          dispatch={dispatch}
          saveLabel="Save lifecycle review"
          testId="record-lifecycle-editor"
        />
      </section>
    </div>
  );
}

function IntegrationsTab({ state, dispatch, canManage }) {
  return (
    <div className="gap-columns">
      <section className="gap-section">
        <div className="gap-section-head">
          <div><h3>Source-of-truth integrations</h3><p>Direction, ownership, reconciliation boundary, and pilot status for each external system.</p></div>
          <StatusPill status={`${state.integrationSources?.length || 0} sources`} />
        </div>
        <RecordList
          items={state.integrationSources}
          title={(item) => item.name}
          meta={(item) => `${item.direction} · ${item.provider}`}
          detail={(item) => item.sourceOfTruth}
        />
        <GovernanceEditor
          title="Review integration source"
          items={state.integrationSources}
          actionIdKey="integrationId"
          actionType="updateIntegrationSource"
          fields={integrationFields}
          disabled={!canManage}
          dispatch={dispatch}
          saveLabel="Save integration review"
          testId="integration-source-editor"
        />
      </section>
      <DistrictConfigurationEditor configuration={state.districtConfiguration} dispatch={dispatch} disabled={!canManage} />
    </div>
  );
}

function AlertsMetricsTab({ state, dispatch, canManage }) {
  return (
    <div className="gap-columns">
      <section className="gap-section">
        <div className="gap-section-head">
          <div><h3>Alert prioritization</h3><p>Urgency windows and escalation ownership keep reminders useful without flattening every item into one queue.</p></div>
          <StatusPill status={`${state.alertRules?.filter((rule) => rule.enabled).length || 0} enabled`} />
        </div>
        <RecordList
          items={state.alertRules}
          title={(item) => item.name}
          meta={(item) => `${item.priority} · ${item.triggerDays} day window`}
          detail={(item) => `Escalates to ${item.escalationRole}`}
        />
        <GovernanceEditor
          title="Review alert rule"
          items={state.alertRules}
          actionIdKey="ruleId"
          actionType="updateAlertRule"
          fields={alertFields}
          disabled={!canManage}
          dispatch={dispatch}
          saveLabel="Save alert review"
          testId="alert-rule-editor"
        />
      </section>
      <section className="gap-section">
        <div className="gap-section-head">
          <div><h3>Measurable success criteria</h3><p>Pilot baselines, targets, cadence, evidence, and operating owners for the original product outcomes.</p></div>
          <StatusPill status={`${state.successMetrics?.length || 0} metrics`} />
        </div>
        <RecordList
          items={state.successMetrics}
          title={(item) => item.name}
          meta={(item) => `${item.baseline} → ${item.target} ${item.unit}`}
          detail={(item) => item.definition}
        />
        <GovernanceEditor
          title="Review success metric"
          items={state.successMetrics}
          actionIdKey="metricId"
          actionType="updateSuccessMetric"
          fields={metricFields}
          disabled={!canManage}
          dispatch={dispatch}
          saveLabel="Save metric review"
          testId="success-metric-editor"
        />
      </section>
    </div>
  );
}

function AiComplianceTab({ state, checklist, canManage }) {
  const profile = state.aiGovernance?.modelProfile || {};
  return (
    <div className="gap-columns">
      <section className="gap-section">
        <div className="gap-section-head">
          <div><h3>AI content governance</h3><p>Generated content remains source-grounded, labeled, editable, and held for qualified human review.</p></div>
          <StatusPill status={profile.reviewStatus || "Restricted"} />
        </div>
        <dl className="gap-definition-grid">
          <Definition term="Model profile" value={`${profile.provider || "Restricted"} · ${profile.model || "Not visible"}`} />
          <Definition term="Prompt version" value={profile.promptVersion || "Restricted"} />
          <Definition term="Sources" value={profile.citationRequired ? "Citations required" : "Source policy restricted"} />
          <Definition term="Human review" value={profile.humanReviewRequired ? "Required" : "Policy restricted"} />
          <Definition term="Decision limits" value="No diagnosis, eligibility, placement, legal, or final IEP decision" />
          <Definition term="Evaluation threshold" value={profile.evaluationThreshold ? `${profile.evaluationThreshold}%` : "Restricted"} />
        </dl>
        <BoundaryBand boundary={state.officialRecordBoundary} compact />
      </section>
      <section className="gap-section">
        <div className="gap-section-head">
          <div><h3>Compliance and privacy checklist</h3><p>Design evidence with explicit district validation and production-security boundaries.</p></div>
          <StatusPill status={`${checklist.length} controls`} />
        </div>
        {checklist.length ? (
          <div className="gap-checklist">
            {checklist.map((item) => (
              <article key={item.id}>
                <ShieldCheck size={17} />
                <div><strong>{item.requirement}</strong><span>{item.evidence}</span><small>{item.owner} · review {formatDate(item.nextReviewDate)}</small></div>
                <StatusPill status={item.status} />
              </article>
            ))}
          </div>
        ) : (
          <Empty text={canManage ? "No compliance controls configured." : "Detailed compliance evidence is restricted to governance roles."} />
        )}
      </section>
    </div>
  );
}

function GovernanceEditor({
  title,
  items = [],
  itemIdKey = "id",
  actionIdKey,
  actionType,
  fields,
  disabled,
  dispatch,
  saveLabel,
  testId
}) {
  const [selectedId, setSelectedId] = useState(items[0]?.[itemIdKey] || "");
  const selected = useMemo(
    () => items.find((item) => item[itemIdKey] === selectedId) || items[0] || null,
    [items, itemIdKey, selectedId]
  );
  const [draft, setDraft] = useState(() => editorValues(selected, fields));

  useEffect(() => {
    if (!items.length) {
      setSelectedId("");
      return;
    }
    if (!items.some((item) => item[itemIdKey] === selectedId)) setSelectedId(items[0][itemIdKey]);
  }, [items, itemIdKey, selectedId]);

  useEffect(() => {
    setDraft(editorValues(selected, fields));
  }, [selected, fields]);

  const ready = selected && fields.every((item) => item.type === "checkbox" || String(draft[item.name] ?? "").trim());

  return (
    <form
      className="gap-editor"
      data-testid={testId}
      onSubmit={(event) => {
        event.preventDefault();
        if (!selected || !ready || disabled) return;
        dispatch(
          { type: actionType, [actionIdKey]: selected[itemIdKey], ...draft },
          { title: `${title} saved`, detail: `${selected.roleLabel || selected.name} now has digest-bound review evidence.` }
        );
      }}
    >
      <div className="gap-editor-head"><strong>{title}</strong><span>Changes create an audit event and review digest.</span></div>
      <label className="field gap-editor-selector">
        <span>Record</span>
        <select
          aria-label={`${title} record`}
          value={selected?.[itemIdKey] || ""}
          disabled={disabled || !items.length}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {items.length ? items.map((item) => (
            <option value={item[itemIdKey]} key={item[itemIdKey]}>{item.roleLabel || item.name}</option>
          )) : <option value="">No records available</option>}
        </select>
      </label>
      <div className="gap-editor-grid">
        {fields.map((item) => (
          <EditorField
            field={item}
            value={draft[item.name]}
            disabled={disabled || !selected}
            key={item.name}
            onChange={(value) => setDraft((current) => ({ ...current, [item.name]: value }))}
          />
        ))}
      </div>
      <button className="btn primary gap-save" type="submit" disabled={disabled || !ready}>
        <Save size={15} />
        <span>{saveLabel}</span>
      </button>
    </form>
  );
}

function EditorField({ field: item, value, disabled, onChange }) {
  if (item.type === "checkbox") {
    return (
      <label className="gap-toggle">
        <input type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span>{item.label}</span>
      </label>
    );
  }
  const common = {
    "aria-label": item.label,
    value: value ?? "",
    disabled,
    onChange: (event) => onChange(item.type === "number" ? Number(event.target.value) : event.target.value)
  };
  return (
    <label className={`field ${item.type === "textarea" ? "wide" : ""}`}>
      <span>{item.label}</span>
      {item.type === "select" ? (
        <select {...common}>{item.options.map((option) => <option key={option}>{option}</option>)}</select>
      ) : item.type === "textarea" ? (
        <textarea {...common} />
      ) : (
        <input {...common} type={item.type} min={item.type === "number" ? 0 : undefined} max={item.type === "number" ? 365 : undefined} />
      )}
    </label>
  );
}

function DistrictConfigurationEditor({ configuration = {}, dispatch, disabled }) {
  const [draft, setDraft] = useState(() => districtValues(configuration));
  useEffect(() => setDraft(districtValues(configuration)), [configuration]);
  const required = ["districtName", "jurisdiction", "configurationVersion", "tenancyMode", "dataResidency", "registryGovernanceStatus", "reviewNote"];
  const ready = required.every((key) => String(draft[key] || "").trim());
  return (
    <section className="gap-section">
      <div className="gap-section-head"><div><h3>District governance profile</h3><p>Tenant, jurisdiction, residency, version, and source-registry assumptions.</p></div><StatusPill status={configuration.configurationVersion || "Restricted"} /></div>
      <form
        className="gap-editor district"
        data-testid="district-governance-editor"
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || !ready) return;
          dispatch(
            { type: "updateGapDistrictConfiguration", districtId: configuration.districtId, ...draft },
            { title: "District governance profile saved", detail: "District readiness assumptions were reviewed and digest-bound." }
          );
        }}
      >
        <div className="gap-editor-grid">
          {[
            field("districtName", "District name"),
            field("jurisdiction", "Jurisdiction"),
            field("configurationVersion", "Configuration version"),
            field("tenancyMode", "Tenancy mode"),
            field("dataResidency", "Data residency", "textarea"),
            field("registryGovernanceStatus", "Registry governance status", "textarea"),
            field("reviewNote", "Review note", "textarea")
          ].map((item) => (
            <EditorField field={item} value={draft[item.name]} disabled={disabled} key={item.name} onChange={(value) => setDraft((current) => ({ ...current, [item.name]: value }))} />
          ))}
        </div>
        <button className="btn primary gap-save" type="submit" disabled={disabled || !ready}><Save size={15} /><span>Save district review</span></button>
      </form>
    </section>
  );
}

function BoundaryBand({ boundary = {}, compact = false }) {
  return (
    <section className={`gap-boundary ${compact ? "compact" : ""}`} aria-label="Official record boundary">
      <ShieldCheck size={20} />
      <div><strong>{boundary.label || "Working workspace - not the official IEP record"}</strong><span>{boundary.controllingSource || "The district-approved IEP and district systems remain controlling."}</span></div>
      <StatusPill status={boundary.officialSubmission === false ? "Not an official submission" : "Boundary review needed"} />
    </section>
  );
}

function RecordList({ items = [], title, meta, detail }) {
  if (!items.length) return <Empty text="Detailed governance records are restricted to authorized administrators." />;
  return (
    <div className="gap-record-list">
      {items.map((item) => (
        <article key={item.id || item.roleId}>
          <div><strong>{title(item)}</strong><span>{meta(item)}</span><small>{detail(item)}</small></div>
          <StatusPill status={item.status} />
        </article>
      ))}
    </div>
  );
}

function GapMetric({ label, value, icon: Icon, tone = "blue" }) {
  return <div className={`gap-metric ${tone}`}><Icon size={17} /><strong>{value}</strong><span>{label}</span></div>;
}

function StatusPill({ status = "Needs review" }) {
  return <span className={`gap-status ${statusTone(status)}`}>{status}</span>;
}

function Definition({ term, value }) {
  return <div><dt>{term}</dt><dd>{value}</dd></div>;
}

function RestrictedNotice() {
  return <div className="gap-restricted"><ShieldCheck size={17} /><span>Detailed readiness policy is restricted to administrator governance roles. The official-record boundary remains visible to every role.</span></div>;
}

function Empty({ text }) {
  return <div className="gap-empty">{text}</div>;
}

function field(name, label, type = "text", options = []) {
  return { name, label, type, options };
}

function editorValues(selected, fields) {
  return Object.fromEntries(fields.map((item) => [item.name, selected?.[item.name] ?? (item.type === "checkbox" ? false : "")]));
}

function districtValues(configuration = {}) {
  return {
    districtName: configuration.districtName || "",
    jurisdiction: configuration.jurisdiction || "",
    configurationVersion: configuration.configurationVersion || "",
    tenancyMode: configuration.tenancyMode || "",
    dataResidency: configuration.dataResidency || "",
    registryGovernanceStatus: configuration.registryGovernanceStatus || "",
    reviewNote: "District administrator reviewed the readiness assumptions and official-record boundary."
  };
}

function statusTone(status = "") {
  if (/blocked|critical|restricted|not an official|validation required/i.test(status)) return "red";
  if (/implemented|approved|covered|active|ready|documented/i.test(status)) return "green";
  if (/review|pending|design/i.test(status)) return "amber";
  return "blue";
}

function shortDigest(value = "") {
  return value ? `Digest ${String(value).slice(0, 12)}` : "Digest pending";
}

function formatDate(value) {
  if (!value) return "not scheduled";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "not reviewed";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
