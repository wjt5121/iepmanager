import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { initialWorkspace, normalizeWorkspaceStructuredRecords } from "../src/data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = join(__dirname, "..", "data");
const WORKSPACE_FILE = "workspace.json";
const AUDIT_FILE = "audit-log.ndjson";

export class WorkspaceStore {
  constructor({ dataDir = DEFAULT_DATA_DIR } = {}) {
    this.dataDir = dataDir;
    this.workspacePath = join(dataDir, WORKSPACE_FILE);
    this.auditPath = join(dataDir, AUDIT_FILE);
    this.pendingWrite = Promise.resolve();
  }

  async init({ locked = false } = {}) {
    await mkdir(this.dataDir, { recursive: true });
    const storedWorkspace = await this.readWorkspace().catch(async (error) => {
      if (error.code !== "ENOENT") throw error;
      const seedWorkspace = async () => {
        const existing = await this.readWorkspace().catch((readError) => {
          if (readError.code === "ENOENT") return null;
          throw readError;
        });
        if (existing) return existing;
        if ((await this.readLegacyAuditEvents()).length) {
          throw new Error("Workspace is missing but legacy audit history exists; restore the matching workspace before continuing.");
        }
        const seed = clone(initialWorkspace);
        await this.writeWorkspace(seed, auditFromSeed(seed));
        return seed;
      };
      return locked ? seedWorkspace() : this.withWriteLock(seedWorkspace);
    });
    const workspace = normalizeWorkspaceStructuredRecords(storedWorkspace);
    if (!Array.isArray(workspace.auditLog)) workspace.auditLog = [];
    return workspace;
  }

  async reset() {
    return this.withWriteLock(async () => {
      await mkdir(this.dataDir, { recursive: true });
      const seed = clone(initialWorkspace);
      await this.writeWorkspace(seed, auditFromSeed(seed));
      return seed;
    });
  }

  async readSnapshot() {
    const stored = JSON.parse(await readFile(this.workspacePath, "utf8"));
    if (stored.storeFormatVersion !== undefined) {
      if (stored.storeFormatVersion !== 1 || !stored.workspace || !Array.isArray(stored.auditEvents)) {
        throw new Error("Unsupported or malformed workspace store snapshot.");
      }
      return stored;
    }
    // Legacy files remain untouched until a successful mutation publishes the new snapshot.
    return { storeFormatVersion: 0, workspace: stored, auditEvents: await this.readLegacyAuditEvents() };
  }

  async readWorkspace() {
    return (await this.readSnapshot()).workspace;
  }

  async writeWorkspace(workspace, auditEvents) {
    const events = auditEvents ?? await this.readAuditEvents();
    const snapshot = { storeFormatVersion: 1, workspace, auditEvents: events };
    const tmp = `${this.workspacePath}.tmp`;
    const handle = await open(tmp, "w");
    try {
      await handle.writeFile(`${JSON.stringify(snapshot, null, 2)}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await this.publishSnapshot(tmp);
  }

  async publishSnapshot(tmp) {
    // The single rename is the commit point for BOTH workspace and audit history.
    await rename(tmp, this.workspacePath);
    try {
      await this.syncDirectory();
    } catch (cause) {
      const error = new Error("Workspace and audit were committed, but durability confirmation failed. Reload and verify before retrying.", { cause });
      error.code = "STORE_COMMIT_DURABILITY_UNCERTAIN";
      throw error;
    }
  }

  async syncDirectory() {
    const directory = await open(this.dataDir, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }

  async saveDocumentFile(documentId, originalName, buffer) {
    const fileName = safeFileName(originalName || "uploaded-source.bin");
    const relativePath = join("documents", safeFileName(documentId), fileName);
    const absolutePath = join(this.dataDir, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);
    return {
      preservedPath: relativePath,
      sizeBytes: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex")
    };
  }

  async saveExportFile(exportId, fileName, buffer) {
    const relativePath = join("exports", safeFileName(exportId), safeFileName(fileName || "export.bin"));
    const absolutePath = join(this.dataDir, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);
    return {
      preservedPath: relativePath,
      sizeBytes: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex")
    };
  }

  async saveRetentionPackage(packageId, fileName, buffer) {
    const relativePath = join("retention", safeFileName(packageId), safeFileName(fileName || "retention-manifest.json"));
    const absolutePath = join(this.dataDir, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer, { flag: "wx" });
    return {
      preservedPath: relativePath,
      sizeBytes: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex")
    };
  }

  async readStoredFile(relativePath) {
    const base = resolve(this.dataDir);
    const target = resolve(this.dataDir, relativePath);
    if (target !== base && !target.startsWith(`${base}${sep}`)) {
      const error = new Error("Stored file path is outside the data directory.");
      error.status = 400;
      error.code = "INVALID_FILE_PATH";
      throw error;
    }
    return readFile(target);
  }

  async mutate(mutator, auditContext) {
    return this.withWriteLock(async () => {
      const workspace = await this.init({ locked: true });
      const events = await this.readAuditEvents();
      const verification = verifySnapshot(workspace, events);
      if (!verification.valid) throw new Error(`Store integrity check failed: ${verification.reason}`);
      const result = await mutator(workspace);
      const auditContexts = Array.isArray(auditContext) ? auditContext : auditContext ? [auditContext] : [];
      for (const context of auditContexts) {
        const event = auditEntry(events, {
          ...context,
          actor: context.actor || "Local API",
          role: context.role || "system"
        });
        events.push(event);
        workspace.auditLog = [toWorkspaceAuditEvent(event), ...(workspace.auditLog || [])];
      }
      await this.writeWorkspace(workspace, events);
      return { workspace, result };
    });
  }

  async readAuditEvents() {
    try {
      return (await this.readSnapshot()).auditEvents;
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async readLegacyAuditEvents() {
    try {
      const raw = await readFile(this.auditPath, "utf8");
      return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async verifyAuditChain() {
    await this.pendingWrite.catch(() => {});
    const snapshot = await this.readSnapshot();
    return verifySnapshot(snapshot.workspace, snapshot.auditEvents);
  }

  async withWriteLock(work) {
    const run = this.pendingWrite.then(work, work);
    this.pendingWrite = run.catch(() => {});
    return run;
  }
}

export function hashEvent(event) {
  const copy = { ...event };
  delete copy.hash;
  return createHash("sha256").update(stableStringify(copy)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function toWorkspaceAuditEvent(entry) {
  return {
    id: `audit-${entry.sequence}`,
    type: entry.type,
    title: entry.title,
    detail: entry.detail,
    actor: entry.actor,
    timestamp: entry.timestamp,
    hash: entry.hash,
    previousHash: entry.previousHash
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeFileName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "source";
}

function auditEntry(current, event) {
  const entry = {
    sequence: current.length + 1,
    timestamp: new Date().toISOString(),
    type: event.type, title: event.title, detail: event.detail,
    actor: event.actor, role: event.role, subjectId: event.subjectId || null,
    previousHash: current.at(-1)?.hash || "GENESIS"
  };
  entry.hash = hashEvent(entry);
  return entry;
}

function auditFromSeed(seed) {
  const events = [];
  for (const event of seed.auditLog || []) {
    events.push(auditEntry(events, { ...event, role: "seed", subjectId: event.id }));
  }
  return events;
}

function verifySnapshot(workspace, events) {
  const log = workspace.auditLog || [];
  if (events.length !== log.length) return { valid: false, reason: "Workspace/audit event count mismatch", checked: 0 };
  let previousHash = "GENESIS";
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.sequence !== index + 1) return { valid: false, reason: `Sequence mismatch at ${index + 1}`, checked: index };
    if (event.previousHash !== previousHash) return { valid: false, reason: `Previous hash mismatch at ${event.sequence}`, checked: index };
    if (hashEvent(event) !== event.hash) return { valid: false, reason: `Hash mismatch at ${event.sequence}`, checked: index };
    const matching = log.find(item => event.role === "seed" ? item.id === event.subjectId : item.hash === event.hash);
    if (!matching || ['type', 'title', 'detail', 'actor'].some(key => matching[key] !== event[key])) {
      return { valid: false, reason: `Workspace/audit correspondence mismatch at ${event.sequence}`, checked: index };
    }
    previousHash = event.hash;
  }
  return { valid: true, checked: events.length, latestHash: previousHash };
}
