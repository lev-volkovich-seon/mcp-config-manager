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

describe('Environment Variable Preservation Tests', () => {
  let browser;
  let page;
  let serverProcess;
  const port = 3471;

  before(async function() {
    this.timeout(45000);

    console.log('Setting up env preservation test...');
    process.env.MCP_USE_MOCK_CLIENTS = 'true';
    await setupTestEnvironment();

    await writeMockClientConfig('claude', { servers: {} });

    console.log('Starting server for env preservation tests...');
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

    console.log('Starting browser for env preservation tests...');
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    page.on('pageerror', error => console.error('Page error:', error.message));
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('Console error:', msg.text());
    });

    console.log('Env preservation test setup complete');
  });

  after(async () => {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
    await cleanupTestEnvironment();
    delete process.env.MCP_USE_MOCK_CLIENTS;
  });

  it('should preserve custom JSON properties when editing env vars in form', async function() {
    this.timeout(30000);

    await page.goto(`http://localhost:${port}`);
    await page.waitForSelector('.view-switcher');
    await page.click('#listViewBtn');
    await page.waitForTimeout(1000);

    // Select claude client
    await page.waitForSelector('#clientList');
    await page.waitForTimeout(2000);

    const claudeClient = await page.$('.client-item:first-child');
    await claudeClient.click();
    await page.waitForTimeout(2000);

    // Open add server modal
    const addBtn = await page.$('#addServerBtn');
    await addBtn.click();
    await page.waitForSelector('#serverModal');

    await page.fill('#serverName', 'env-preserve-test');

    // Start with JSON containing custom properties and env vars
    await page.click('.tab-btn[data-tab="json"]');
    await page.waitForTimeout(500);

    const complexJson = {
      command: 'python',
      args: ['server.py'],
      env: {
        API_KEY: 'original-key',
        DB_HOST: 'original-host',
        SECRET_TOKEN: 'should-be-preserved', // This one won't be shown in form initially
        HIDDEN_VAR: 'also-preserved'
      },
      // Custom properties that must be preserved
      customField: 'must-be-preserved',
      metadata: {
        version: '1.0.0',
        author: 'test-user'
      },
      advanced: {
        timeout: 30000,
        retries: 5
      }
    };

    await page.click('#jsonEditor');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.type('#jsonEditor', JSON.stringify(complexJson, null, 2));

    // Switch to form - this will only load some env vars
    await page.click('.tab-btn[data-tab="form"]');
    await page.waitForTimeout(1000);

    // The form now shows API_KEY, DB_HOST, SECRET_TOKEN, HIDDEN_VAR
    // Let's modify one and add a new one
    const envRows = await page.$$('.env-var-row');
    expect(envRows.length).to.equal(4);

    // Modify the first env var value (API_KEY)
    const firstValue = await envRows[0].$('.env-value');
    await firstValue.click({ clickCount: 3 });
    await firstValue.fill('modified-key');

    // Add a new environment variable
    await page.click('#addEnvVar');
    await page.waitForTimeout(500);

    const newEnvRows = await page.$$('.env-var-row');
    const lastRow = newEnvRows[newEnvRows.length - 1];
    const keyInput = await lastRow.$('.env-key');
    const valueInput = await lastRow.$('.env-value');

    await keyInput.fill('NEW_ENV_VAR');
    await valueInput.fill('new-value');

    // Delete one env var (DB_HOST) by clicking its delete button
    const secondRowDeleteBtn = await envRows[1].$('button.danger');
    await secondRowDeleteBtn.click();
    await page.waitForTimeout(500);

    // Switch back to JSON and verify preservation
    await page.click('.tab-btn[data-tab="json"]');
    await page.waitForTimeout(1000);

    const jsonContent = await page.inputValue('#jsonEditor');
    const resultJson = JSON.parse(jsonContent);

    // Verify custom properties are preserved
    expect(resultJson.customField).to.equal('must-be-preserved');
    expect(resultJson.metadata.version).to.equal('1.0.0');
    expect(resultJson.metadata.author).to.equal('test-user');
    expect(resultJson.advanced.timeout).to.equal(30000);
    expect(resultJson.advanced.retries).to.equal(5);

    // Verify env var changes
    expect(resultJson.env.API_KEY).to.equal('modified-key'); // Modified
    expect(resultJson.env.DB_HOST).to.be.undefined; // Deleted
    expect(resultJson.env.SECRET_TOKEN).to.equal('should-be-preserved'); // Unchanged
    expect(resultJson.env.HIDDEN_VAR).to.equal('also-preserved'); // Unchanged
    expect(resultJson.env.NEW_ENV_VAR).to.equal('new-value'); // Added

    // Verify command and args are unchanged
    expect(resultJson.command).to.equal('python');
    expect(resultJson.args).to.deep.equal(['server.py']);

    await page.click('.close');
  });

  it('should not lose custom env vars that are not displayed in form', async function() {
    this.timeout(30000);

    await page.goto(`http://localhost:${port}`);
    await page.waitForSelector('.view-switcher');
    await page.click('#listViewBtn');
    await page.waitForTimeout(1000);

    await page.waitForSelector('#clientList');
    await page.waitForTimeout(2000);

    const claudeClient = await page.$('.client-item:first-child');
    await claudeClient.click();
    await page.waitForTimeout(2000);

    const addBtn = await page.$('#addServerBtn');
    await addBtn.click();
    await page.waitForSelector('#serverModal');

    await page.fill('#serverName', 'hidden-env-test');

    // Create JSON with many env vars
    await page.click('.tab-btn[data-tab="json"]');
    await page.waitForTimeout(500);

    const jsonWithManyEnvs = {
      command: 'node',
      env: {
        VISIBLE_1: 'value1',
        VISIBLE_2: 'value2',
        VISIBLE_3: 'value3',
        HIDDEN_1: 'hidden-value1',
        HIDDEN_2: 'hidden-value2',
        SECRET_KEY: 'secret-123',
        API_TOKEN: 'token-456',
        DATABASE_URL: 'postgres://localhost'
      },
      customProperty: 'test'
    };

    await page.click('#jsonEditor');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.type('#jsonEditor', JSON.stringify(jsonWithManyEnvs, null, 2));

    // Switch to form (this loads all env vars initially)
    await page.click('.tab-btn[data-tab="form"]');
    await page.waitForTimeout(1000);

    // Delete a few visible env vars from form
    const envRows = await page.$$('.env-var-row');

    // Delete VISIBLE_2 (index 1)
    const deleteBtn2 = await envRows[1].$('button.danger');
    await deleteBtn2.click();
    await page.waitForTimeout(200);

    // Delete HIDDEN_1 (was index 3, now index 2 after deletion)
    const updatedRows = await page.$$('.env-var-row');
    const deleteBtn4 = await updatedRows[3].$('button.danger');
    await deleteBtn4.click();
    await page.waitForTimeout(200);

    // Switch back to JSON
    await page.click('.tab-btn[data-tab="json"]');
    await page.waitForTimeout(1000);

    const resultJsonContent = await page.inputValue('#jsonEditor');
    const result = JSON.parse(resultJsonContent);

    // Verify deletions happened
    expect(result.env.VISIBLE_2).to.be.undefined;
    expect(result.env.HIDDEN_1).to.be.undefined;

    // Verify everything else is preserved
    expect(result.env.VISIBLE_1).to.equal('value1');
    expect(result.env.VISIBLE_3).to.equal('value3');
    expect(result.env.HIDDEN_2).to.equal('hidden-value2');
    expect(result.env.SECRET_KEY).to.equal('secret-123');
    expect(result.env.API_TOKEN).to.equal('token-456');
    expect(result.env.DATABASE_URL).to.equal('postgres://localhost');
    expect(result.customProperty).to.equal('test');

    await page.click('.close');
  });

  it('should handle empty env vars correctly without losing custom properties', async function() {
    this.timeout(25000);

    await page.goto(`http://localhost:${port}`);
    await page.waitForSelector('.view-switcher');
    await page.click('#listViewBtn');
    await page.waitForTimeout(1000);

    await page.waitForSelector('#clientList');
    await page.waitForTimeout(2000);

    const claudeClient = await page.$('.client-item:first-child');
    await claudeClient.click();
    await page.waitForTimeout(2000);

    const addBtn = await page.$('#addServerBtn');
    await addBtn.click();
    await page.waitForSelector('#serverModal');

    await page.fill('#serverName', 'empty-env-test');

    // Start with JSON that has custom properties but no env vars
    await page.click('.tab-btn[data-tab="json"]');
    await page.waitForTimeout(500);

    const jsonNoEnv = {
      command: 'python',
      args: ['app.py'],
      metadata: {
        description: 'Test server',
        port: 8080
      },
      features: ['logging', 'metrics']
    };

    await page.click('#jsonEditor');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.type('#jsonEditor', JSON.stringify(jsonNoEnv, null, 2));

    // Switch to form
    await page.click('.tab-btn[data-tab="form"]');
    await page.waitForTimeout(1000);

    // Add one env var in form
    await page.click('#addEnvVar');
    await page.waitForTimeout(500);

    const envRow = await page.$('.env-var-row');
    const keyInput = await envRow.$('.env-key');
    const valueInput = await envRow.$('.env-value');

    await keyInput.fill('ADDED_VAR');
    await valueInput.fill('added-value');

    // Switch back to JSON
    await page.click('.tab-btn[data-tab="json"]');
    await page.waitForTimeout(1000);

    const resultJson = await page.inputValue('#jsonEditor');
    const parsed = JSON.parse(resultJson);

    // Verify env var was added
    expect(parsed.env.ADDED_VAR).to.equal('added-value');

    // Verify all custom properties are preserved
    expect(parsed.metadata.description).to.equal('Test server');
    expect(parsed.metadata.port).to.equal(8080);
    expect(parsed.features).to.deep.equal(['logging', 'metrics']);
    expect(parsed.command).to.equal('python');
    expect(parsed.args).to.deep.equal(['app.py']);

    await page.click('.close');
  });
});