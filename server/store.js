import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { initialWorkspace } from "../src/data.js";

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
    const workspace = await this.readWorkspace().catch(async (error) => {
      if (error.code !== "ENOENT") throw error;
      const seedWorkspace = async () => {
        const existing = await this.readWorkspace().catch((readError) => {
          if (readError.code === "ENOENT") return null;
          throw readError;
        });
        if (existing) return existing;
        const seed = clone(initialWorkspace);
        await this.writeWorkspace(seed);
        await this.rebuildAuditFromSeed(seed);
        return seed;
      };
      return locked ? seedWorkspace() : this.withWriteLock(seedWorkspace);
    });
    if (!Array.isArray(workspace.auditLog)) workspace.auditLog = [];
    return workspace;
  }

  async reset() {
    return this.withWriteLock(async () => {
      await mkdir(this.dataDir, { recursive: true });
      const seed = clone(initialWorkspace);
      await this.writeWorkspace(seed);
      await this.rebuildAuditFromSeed(seed);
      return seed;
    });
  }

  async readWorkspace() {
    const raw = await readFile(this.workspacePath, "utf8");
    return JSON.parse(raw);
  }

  async writeWorkspace(workspace) {
    const tmp = `${this.workspacePath}.tmp`;
    await writeFile(tmp, `${JSON.stringify(workspace, null, 2)}\n`);
    await rename(tmp, this.workspacePath);
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
      const result = await mutator(workspace);
      const auditContexts = Array.isArray(auditContext) ? auditContext : auditContext ? [auditContext] : [];
      for (const context of auditContexts) {
        const event = await this.appendAudit({
          ...context,
          actor: context.actor || "Local API",
          role: context.role || "system"
        });
        workspace.auditLog = [toWorkspaceAuditEvent(event), ...(workspace.auditLog || [])];
      }
      await this.writeWorkspace(workspace);
      return { workspace, result };
    });
  }

  async appendAudit(event) {
    const current = await this.readAuditEvents();
    const previous = current[current.length - 1];
    const entry = {
      sequence: current.length + 1,
      timestamp: new Date().toISOString(),
      type: event.type,
      title: event.title,
      detail: event.detail,
      actor: event.actor,
      role: event.role,
      subjectId: event.subjectId || null,
      previousHash: previous?.hash || "GENESIS"
    };
    entry.hash = hashEvent(entry);
    await writeFile(this.auditPath, `${JSON.stringify(entry)}\n`, { flag: "a" });
    return entry;
  }

  async readAuditEvents() {
    try {
      const raw = await readFile(this.auditPath, "utf8");
      return raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async verifyAuditChain() {
    await this.pendingWrite.catch(() => {});
    const events = await this.readAuditEvents();
    const workspace = await this.readWorkspace().catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (events.length === 0 && (workspace?.auditLog || []).length > 0) {
      return { valid: false, reason: "Audit log missing or empty", checked: 0 };
    }

    let previousHash = "GENESIS";
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      if (event.sequence !== index + 1) {
        return { valid: false, reason: `Sequence mismatch at ${index + 1}`, checked: index };
      }
      if (event.previousHash !== previousHash) {
        return { valid: false, reason: `Previous hash mismatch at ${event.sequence}`, checked: index };
      }
      if (hashEvent(event) !== event.hash) {
        return { valid: false, reason: `Hash mismatch at ${event.sequence}`, checked: index };
      }
      previousHash = event.hash;
    }
    return { valid: true, checked: events.length, latestHash: previousHash };
  }

  async rebuildAuditFromSeed(seed) {
    await writeFile(this.auditPath, "");
    for (const event of seed.auditLog || []) {
      await this.appendAudit({
        type: event.type,
        title: event.title,
        detail: event.detail,
        actor: event.actor,
        role: "seed",
        subjectId: event.id
      });
    }
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
