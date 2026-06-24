import { startServer } from "./api.js";
import { WorkspaceStore } from "./store.js";

const port = Number(process.env.PORT || 8787);
const store = process.env.DATA_DIR ? new WorkspaceStore({ dataDir: process.env.DATA_DIR }) : undefined;
const server = await startServer({
  port,
  store,
  enableTestReset: process.env.ENABLE_TEST_RESET === "1"
});

console.log(`IEP API listening on http://127.0.0.1:${port}`);

process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
