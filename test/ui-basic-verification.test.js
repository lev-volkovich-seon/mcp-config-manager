import { expect } from 'chai';
import { chromium } from 'playwright';
import { setupTestEnvironment, cleanupTestEnvironment, writeMockClientConfig } from './test-utils.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const SERVER_PATH = path.join(PROJECT_ROOT, 'src', 'server.js');

describe('Basic UI Verification Test', () => {
  let browser;
  let page;
  let serverProcess;
  const port = 3469;

  before(async function() {
    this.timeout(45000);

    console.log('Setting up basic verification test...');
    process.env.MCP_USE_MOCK_CLIENTS = 'true';
    await setupTestEnvironment();

    await writeMockClientConfig('claude', {
      servers: {
        'test-server': {
          command: 'npx',
          args: ['-y', 'test-server'],
          env: { API_KEY: 'test-key' }
        }
      }
    });

    await writeMockClientConfig('vscode', { servers: {} });

    console.log('Starting server...');
    serverProcess = spawn('node', [SERVER_PATH], {
      env: { ...process.env, PORT: port, MCP_USE_MOCK_CLIENTS: 'true' },
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    await new Promise((resolve, reject) => {
      let serverReady = false;

      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`Server: ${output.trim()}`);
        if (output.includes(`server running on http://localhost:${port}`) && !serverReady) {
          serverReady = true;
          resolve();
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.error(`Server error: ${data.toString()}`);
      });

      serverProcess.on('error', reject);

      setTimeout(() => {
        if (!serverReady) reject(new Error('Server startup timeout'));
      }, 15000);
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Starting browser...');
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    console.log('Basic verification setup complete');
  });

  after(async () => {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
    await cleanupTestEnvironment();
    delete process.env.MCP_USE_MOCK_CLIENTS;
  });

  it('should load the main page', async function() {
    this.timeout(15000);

    await page.goto(`http://localhost:${port}`);
    const title = await page.title();
    console.log(`Page title: "${title}"`);
    expect(title).to.equal('MCP Config Manager');
  });

  it('should show view switcher buttons', async function() {
    this.timeout(15000);

    await page.goto(`http://localhost:${port}`);
    await page.waitForSelector('.view-switcher');

    const listBtn = await page.$('#listViewBtn');
    const kanbanBtn = await page.$('#kanbanViewBtn');
    const serverBtn = await page.$('#serverViewBtn');

    expect(listBtn).to.not.be.null;
    expect(kanbanBtn).to.not.be.null;
    expect(serverBtn).to.not.be.null;
  });

  it('should load API data successfully', async function() {
    this.timeout(15000);

    await page.goto(`http://localhost:${port}`);
    await page.waitForTimeout(3000);

    const apiResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/clients');
        const data = await response.json();
        return { success: true, data, error: null };
      } catch (err) {
        return { success: false, data: null, error: err.message };
      }
    });

    console.log('API result:', apiResult);
    expect(apiResult.success).to.be.true;
    expect(apiResult.data).to.be.an('array');
    expect(apiResult.data.length).to.be.greaterThan(0);
  });

  it('should switch between views', async function() {
    this.timeout(15000);

    await page.goto(`http://localhost:${port}`);
    await page.waitForSelector('.view-switcher');

    // Test switching to Kanban view
    await page.click('#kanbanViewBtn');
    await page.waitForTimeout(1000);

    const kanbanContainer = await page.$('#kanbanViewContainer');
    const kanbanVisible = await page.evaluate(el =>
      window.getComputedStyle(el).display !== 'none', kanbanContainer
    );
    expect(kanbanVisible).to.be.true;

    // Test switching to Server view
    await page.click('#serverViewBtn');
    await page.waitForTimeout(1000);

    const serverContainer = await page.$('#serverViewContainer');
    const serverVisible = await page.evaluate(el =>
      window.getComputedStyle(el).display !== 'none', serverContainer
    );
    expect(serverVisible).to.be.true;

    // Test switching back to List view
    await page.click('#listViewBtn');
    await page.waitForTimeout(1000);

    const listContainer = await page.$('#listViewContainer');
    const listVisible = await page.evaluate(el =>
      window.getComputedStyle(el).display !== 'none', listContainer
    );
    expect(listVisible).to.be.true;
  });
});