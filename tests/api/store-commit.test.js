import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { WorkspaceStore } from '../../server/store.js';

const moduleUrl = new URL('../../server/store.js', import.meta.url).href;
const context = {type:'QA',title:'Synthetic committed change',detail:'Synthetic store regression'};
async function fixture(t) {
  const dataDir = await mkdtemp(join(tmpdir(), 'iep-store-commit-'));
  t.after(() => rm(dataDir, {recursive:true, force:true}));
  const store = new WorkspaceStore({dataDir});
  await store.init();
  return {dataDir,store};
}
function child(dataDir, body) {
  const script = `import {WorkspaceStore} from ${JSON.stringify(moduleUrl)};
import {rename} from 'node:fs/promises';
const store = new WorkspaceStore({dataDir:${JSON.stringify(dataDir)}});
${body}`;
  return spawnSync(process.execPath, ['--input-type=module','-e',script], {encoding:'utf8'});
}

test('failed workspace write publishes neither state nor successful-looking audit; queue recovers', async t => {
  const {store} = await fixture(t);
  const before = await readFile(store.workspacePath, 'utf8');
  const realWrite = store.writeWorkspace.bind(store);
  store.writeWorkspace = async () => {throw new Error('Synthetic disk write failure');};
  await assert.rejects(store.mutate(w => {w.syntheticMarker='uncommitted';},context), /Synthetic disk write failure/);
  assert.equal(await readFile(store.workspacePath,'utf8'),before);
  assert.equal((await store.readAuditEvents()).some(e=>e.title===context.title),false);
  assert.equal((await store.verifyAuditChain()).valid,true);
  store.writeWorkspace=realWrite;
  await store.mutate(w=>{w.syntheticMarker='committed';},context);
  assert.equal((await store.readWorkspace()).syntheticMarker,'committed');
  assert.equal((await store.readAuditEvents()).at(-1).title,context.title);
  assert.equal((await store.verifyAuditChain()).valid,true);
});

test('failure after staging but before publish leaves prior snapshot authoritative', async t => {
  const {store} = await fixture(t);
  const before = await readFile(store.workspacePath,'utf8');
  store.publishSnapshot=async()=>{throw new Error('Synthetic rename failure');};
  await assert.rejects(store.mutate(w=>{w.syntheticMarker='staged';},context),/Synthetic rename failure/);
  assert.equal(await readFile(store.workspacePath,'utf8'),before);
  assert.equal((await store.readWorkspace()).syntheticMarker,undefined);
  assert.equal((await store.verifyAuditChain()).valid,true);
});

for (const afterRename of [false,true]) {
  test(`genuine process exit ${afterRename?'after':'before'} rename restarts with a consistent snapshot`, async t => {
    const {dataDir} = await fixture(t);
    const crash = child(dataDir, `store.publishSnapshot=async tmp=>{${afterRename?'await rename(tmp,store.workspacePath);':''}process.exit(73);};
await store.mutate(w=>{w.syntheticMarker='crash-commit';},${JSON.stringify(context)});`);
    assert.equal(crash.status,73,crash.stderr);
    const restart=child(dataDir, `const w=await store.init(); console.log(JSON.stringify({marker:w.syntheticMarker??null, events:await store.readAuditEvents(), verification:await store.verifyAuditChain()}));`);
    assert.equal(restart.status,0,restart.stderr);
    const result=JSON.parse(restart.stdout);
    assert.equal(result.marker,afterRename?'crash-commit':null);
    assert.equal(result.events.some(e=>e.title===context.title),afterRename);
    assert.equal(result.verification.valid,true);
    const success=child(dataDir, `await store.mutate(w=>{w.syntheticMarker='after-restart';},${JSON.stringify(context)});`);
    assert.equal(success.status,0,success.stderr);
    const secondRestart=child(dataDir, `console.log(JSON.stringify({workspace:await store.init(),verification:await store.verifyAuditChain()}));`);
    const saved=JSON.parse(secondRestart.stdout);
    assert.equal(saved.workspace.syntheticMarker,'after-restart');
    assert.equal(saved.verification.valid,true);
  });
}

test('legacy files stay intact on failed migration and migrate on successful mutation', async t => {
  const {store,dataDir}=await fixture(t);
  const snapshot=JSON.parse(await readFile(store.workspacePath,'utf8'));
  const legacyWorkspace=JSON.stringify(snapshot.workspace);
  const legacyAudit=snapshot.auditEvents.map(e=>JSON.stringify(e)).join('\n')+'\n';
  await writeFile(store.workspacePath,legacyWorkspace);
  await writeFile(store.auditPath,legacyAudit);
  const legacy=new WorkspaceStore({dataDir});
  assert.equal((await legacy.verifyAuditChain()).valid,true);
  const publish=legacy.publishSnapshot.bind(legacy);
  legacy.publishSnapshot=async()=>{throw new Error('Synthetic migration failure');};
  await assert.rejects(legacy.mutate(w=>{w.syntheticMarker='failed';},context));
  assert.equal(await readFile(store.workspacePath,'utf8'),legacyWorkspace);
  assert.equal(await readFile(store.auditPath,'utf8'),legacyAudit);
  legacy.publishSnapshot=publish;
  await legacy.mutate(w=>{w.syntheticMarker='migrated';},context);
  assert.equal(JSON.parse(await readFile(store.workspacePath,'utf8')).storeFormatVersion,1);
  assert.equal(await readFile(store.auditPath,'utf8'),legacyAudit);
  const restart=child(dataDir,`console.log(JSON.stringify({w:await store.init(),v:await store.verifyAuditChain()}));`);
  const result=JSON.parse(restart.stdout);
  assert.equal(result.w.syntheticMarker,'migrated');
  assert.equal(result.v.valid,true);
});

test('valid hash chain with an unmatched event is invalid and cannot be silently migrated', async t=>{
  const {store}=await fixture(t);
  const snapshot=JSON.parse(await readFile(store.workspacePath,'utf8'));
  const oldWorkspace=JSON.stringify(snapshot.workspace);
  await store.mutate(w=>{w.syntheticMarker='discarded';},context);
  const events=await store.readAuditEvents();
  await writeFile(store.workspacePath,oldWorkspace);
  await writeFile(store.auditPath,events.map(e=>JSON.stringify(e)).join('\n')+'\n');
  assert.equal((await store.verifyAuditChain()).valid,false);
  await assert.rejects(store.mutate(w=>{w.syntheticMarker='new';},context),/integrity check failed/);
  assert.equal(await readFile(store.workspacePath,'utf8'),oldWorkspace);
});

test('missing legacy workspace never seeds over existing audit history', async t=>{
  const {store}=await fixture(t);
  const audit=(await store.readAuditEvents()).map(e=>JSON.stringify(e)).join('\n')+'\n';
  await writeFile(store.auditPath,audit);
  await rm(store.workspacePath);
  await assert.rejects(store.init(),/Workspace is missing/);
  assert.equal(await readFile(store.auditPath,'utf8'),audit);
  await assert.rejects(readFile(store.workspacePath), {code:'ENOENT'});
});

test('post-commit durability failure is explicit and reload exposes matching state and audit', async t=>{
  const {store,dataDir}=await fixture(t);
  store.syncDirectory=async()=>{throw new Error('Synthetic directory sync failure');};
  await assert.rejects(store.mutate(w=>{w.syntheticMarker='committed-but-sync-uncertain';},context),
    error=>error.code==='STORE_COMMIT_DURABILITY_UNCERTAIN' && /were committed/.test(error.message));
  const restart=child(dataDir,`console.log(JSON.stringify({w:await store.init(),events:await store.readAuditEvents(),v:await store.verifyAuditChain()}));`);
  assert.equal(restart.status,0,restart.stderr);
  const result=JSON.parse(restart.stdout);
  assert.equal(result.w.syntheticMarker,'committed-but-sync-uncertain');
  assert.equal(result.events.at(-1).title,context.title);
  assert.equal(result.v.valid,true);
});
