import { test, expect } from '@playwright/test';
import { createExportArtifact } from '../server/exportArtifacts.js';

const api = 'http://127.0.0.1:8789';
const nav = async (page, name) => {
  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.isVisible()) await menu.click();
  await page.locator('.navbtn').filter({ hasText: name }).click();
};

test('Neo synthetic intake errors recover, DOCX persists, and browser stays local', async ({ page }, info) => {
  const external = [], errors = [];
  await page.context().route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      external.push(url.origin); return route.abort();
    }
    return route.continue();
  });
  page.on('pageerror', e => errors.push(e.message));
  // Make a raster-only synthetic worksheet; PDF contains the raster, not selectable text.
  await page.setContent('<h1>SYNTHETIC WORKSHEET</h1><p>Student: Test Cedar</p><p>Reading probe: 6 / 10 correct</p>');
  const png = await page.screenshot();
  await page.setContent(`<img src="data:image/png;base64,${png.toString('base64')}" style="width:600px">`);
  const scan = await page.pdf();
  await page.request.post(`${api}/api/test/reset`);
  await page.goto('/');
  await expect(page).toHaveTitle(/IEP/);
  await expect(page.locator('.sync-pill strong')).toHaveText('API-backed workspace');
  await nav(page, 'IEP intake');
  await page.getByLabel('Student first name').fill('Synthetic');
  await page.getByLabel('Student last name').fill('Cedar');
  await page.getByLabel('Student grade').fill('5');
  await page.getByLabel('Student school').fill('Synthetic School');
  await page.getByRole('button', { name: 'Create student profile' }).click();
  await expect(page.getByText('Student profile created')).toBeVisible();
  const upload = page.locator('input[type=file]');
  for (const file of [
    { name:'worksheet.png', mimeType:'image/png', buffer:png },
    { name:'legacy.doc', mimeType:'application/msword', buffer:Buffer.from('unsupported legacy fixture') },
    { name:'worksheet-scan.pdf', mimeType:'application/pdf', buffer:scan },
    { name:'empty.txt', mimeType:'text/plain', buffer:Buffer.from('   ') }
  ]) {
    await upload.setInputFiles(file);
    await page.getByRole('button', { name:'Preserve source and extract' }).click();
    await expect(page.locator('.toast')).toContainText(/Unsupported file type|No readable source text/);
    await expect(page.getByText('No source document', {exact:true})).toBeVisible();
  }
  const docx = createExportArtifact({id:'neo-synthetic',label:'Synthetic Cedar',format:'docx',payload:{sections:[{heading:'Goals',bullets:['Goal: Synthetic Cedar will answer questions with 80% accuracy across three probes.']}]}});
  await upload.setInputFiles({name:'synthetic-cedar.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:docx.buffer});
  await page.getByRole('button', {name:'Preserve source and extract'}).click();
  await expect(page.locator('.toast')).toContainText('Source preserved');
  await expect(page.locator('.extract-card').filter({hasText:'Detected annual goal'})).toContainText('80%');
  await page.reload();
  await expect(page.locator('.sync-pill strong')).toHaveText('API-backed workspace');
  await nav(page, 'IEP intake');
  await expect(page.locator('.source-card').filter({hasText:'synthetic-cedar.docx'})).toBeVisible();
  const goal = page.locator('.extract-card').filter({hasText:'Detected annual goal'});
  await goal.getByRole('button', {name:'Edit',exact:true}).click();
  await goal.locator('textarea').fill('Goal: Synthetic Cedar will answer reading questions with 85% accuracy across three weekly probes.');
  await expect(goal).toContainText('Edited by');
  await page.getByRole('button', {name:'Approve extraction',exact:true}).click();
  await expect(page.locator('.toast')).toContainText('Extraction approved');
  await nav(page, 'Plan summary');
  await expect(page.locator('.summary-doc')).toContainText('85%');
  await nav(page, 'Progress');
  await page.getByLabel('Evidence label').fill('Synthetic weekly probe');
  await page.getByRole('button', {name:'Add data point',exact:true}).click();
  await expect(page.locator('.toast')).toContainText('Progress saved');
  await nav(page, 'IEP intake');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', {name:'Export PDF',exact:true}).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.pdf$/);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:`/tmp/iep-neo-${info.project.name}.png`,fullPage:false});
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
