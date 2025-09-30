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

describe('JSON Flexibility Tests', () => {
  let browser;
  let page;
  let serverProcess;
  const port = 3470;

  before(async function() {
    this.timeout(45000);

    console.log('Setting up JSON flexibility test...');
    process.env.MCP_USE_MOCK_CLIENTS = 'true';
    await setupTestEnvironment();

    await writeMockClientConfig('claude', { servers: {} });

    console.log('Starting server for JSON flexibility tests...');
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

    console.log('Starting browser for JSON flexibility tests...');
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    page.on('pageerror', error => console.error('Page error:', error.message));
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('Console error:', msg.text());
    });

    console.log('JSON flexibility test setup complete');
  });

  after(async () => {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
    await cleanupTestEnvironment();
    delete process.env.MCP_USE_MOCK_CLIENTS;
  });

  it('should accept any valid JSON and only show supported fields in form', async function() {
    this.timeout(25000);

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

    // Fill in server name first
    await page.fill('#serverName', 'complex-server');

    // Switch to JSON tab
    await page.click('.tab-btn[data-tab="json"]');
    await page.waitForTimeout(500);

    // Enter complex JSON with custom properties
    const complexJson = {
      command: 'python',
      args: ['complex_server.py', '--mode=production'],
      env: {
        DB_HOST: 'localhost',
        API_KEY: 'secret-123',
        DEBUG: 'false'
      },
      // Custom properties that should be preserved
      customField: 'custom-value',
      metadata: {
        author: 'test-user',
        version: '2.1.0',
        description: 'Complex server configuration'
      },
      timeout: 30000,
      retries: 5,
      advanced: {
        scaling: {
          minInstances: 2,
          maxInstances: 10
        },
        monitoring: {
          enabled: true,
          endpoint: '/health'
        }
      },
      features: ['logging', 'metrics', 'tracing'],
      database: {
        type: 'postgresql',
        connection: {
          host: 'db.example.com',
          port: 5432
        }
      }
    };

    await page.click('#jsonEditor');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.type('#jsonEditor', JSON.stringify(complexJson, null, 2));

    // Switch to form tab to verify only supported fields are shown
    await page.click('.tab-btn[data-tab="form"]');
    await page.waitForTimeout(1000);

    // Verify form shows only supported fields
    const formCommand = await page.inputValue('#serverCommand');
    const formArgs = await page.inputValue('#serverArgs');

    expect(formCommand).to.equal('python');
    expect(formArgs).to.equal('complex_server.py\n--mode=production');

    // Verify environment variables are shown
    const envRows = await page.$$('.env-var-row');
    expect(envRows.length).to.equal(3); // DB_HOST, API_KEY, DEBUG

    // Switch back to JSON tab to verify all data is preserved
    await page.click('.tab-btn[data-tab="json"]');
    await page.waitForTimeout(1000);

    const jsonContent = await page.inputValue('#jsonEditor');
    const parsedJson = JSON.parse(jsonContent);

    // Verify all custom properties are preserved
    expect(parsedJson.customField).to.equal('custom-value');
    expect(parsedJson.metadata.author).to.equal('test-user');
    expect(parsedJson.timeout).to.equal(30000);
    expect(parsedJson.advanced.scaling.minInstances).to.equal(2);
    expect(parsedJson.database.type).to.equal('postgresql');

    // Verify supported fields are also correct
    expect(parsedJson.command).to.equal('python');
    expect(parsedJson.args).to.deep.equal(['complex_server.py', '--mode=production']);
    expect(parsedJson.env.DB_HOST).to.equal('localhost');

    // Close modal without saving (optional)
    await page.click('.close');
    await page.waitForTimeout(500);
  });

  it('should merge form changes with existing JSON properties', async function() {
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

    await page.fill('#serverName', 'merge-test-server');

    // Start with JSON containing custom properties
    await page.click('.tab-btn[data-tab="json"]');
    await page.waitForTimeout(500);

    const initialJson = {
      command: 'node',
      args: ['initial.js'],
      env: {
        INITIAL_VAR: 'initial-value'
      },
      customProperty: 'should-be-preserved',
      config: {
        nested: 'value'
      }
    };

    await page.click('#jsonEditor');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.type('#jsonEditor', JSON.stringify(initialJson, null, 2));

    // Switch to form and modify supported fields
    await page.click('.tab-btn[data-tab="form"]');
    await page.waitForTimeout(1000);

    // Modify command
    await page.fill('#serverCommand', 'python');

    // Modify args
    await page.fill('#serverArgs', 'modified.py\n--option=value');

    // Add new environment variable
    await page.click('#addEnvVar');
    await page.waitForTimeout(500);

    const envKeys = await page.$$('.env-key');
    const envValues = await page.$$('.env-value');

    // There should be 2 env vars now: INITIAL_VAR + new one
    if (envKeys.length >= 2) {
      await envKeys[envKeys.length - 1].fill('NEW_VAR');
      await envValues[envValues.length - 1].fill('new-value');
    }

    // Switch back to JSON and verify merge
    await page.click('.tab-btn[data-tab="json"]');
    await page.waitForTimeout(1000);

    const mergedJsonContent = await page.inputValue('#jsonEditor');
    const mergedJson = JSON.parse(mergedJsonContent);

    // Verify form changes are reflected
    expect(mergedJson.command).to.equal('python');
    expect(mergedJson.args).to.deep.equal(['modified.py', '--option=value']);
    expect(mergedJson.env.NEW_VAR).to.equal('new-value');

    // Verify custom properties are preserved
    expect(mergedJson.customProperty).to.equal('should-be-preserved');
    expect(mergedJson.config.nested).to.equal('value');

    await page.click('.close');
  });

  it('should save server with any valid JSON structure', async function() {
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

    await page.fill('#serverName', 'flexible-json-server');

    await page.click('.tab-btn[data-tab="json"]');
    await page.waitForTimeout(500);

    // Create JSON with many custom properties
    const flexibleJson = {
      command: 'npx',
      args: ['-y', 'flexible-server'],
      env: {
        API_TOKEN: 'token-123'
      },
      // Many custom properties
      version: '3.0.0',
      author: 'test-author',
      license: 'MIT',
      repository: {
        type: 'git',
        url: 'https://github.com/test/repo'
      },
      dependencies: ['express', 'lodash'],
      scripts: {
        start: 'node index.js',
        test: 'jest'
      },
      configuration: {
        host: '0.0.0.0',
        port: 8080,
        ssl: false,
        cors: true
      }
    };

    await page.click('#jsonEditor');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.type('#jsonEditor', JSON.stringify(flexibleJson, null, 2));

    // Submit the form (this should work now)
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Verify modal closed (indicating successful save)
    const modalVisible = await page.isVisible('#serverModal');
    expect(modalVisible).to.be.false;

    // Verify server appears in the list
    await page.waitForSelector('.server-card', { timeout: 5000 });
    const serverNames = await page.$$eval('.server-name',
      elements => elements.map(el => el.textContent)
    );
    expect(serverNames).to.include('flexible-json-server');
  });

  it('should validate JSON syntax but accept any valid structure', async function() {
    this.timeout(20000);

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

    await page.fill('#serverName', 'validation-test');

    await page.click('.tab-btn[data-tab="json"]');
    await page.waitForTimeout(500);

    // Test invalid JSON first
    await page.click('#jsonEditor');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.type('#jsonEditor', '{ invalid json }');

    page.once('dialog', async dialog => {
      expect(dialog.message()).to.include('Invalid JSON');
      await dialog.accept();
    });

    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    // Now test valid but unusual JSON structure
    await page.click('#jsonEditor');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');

    const unusualButValidJson = {
      // No command, args, or env - just custom stuff
      type: 'webhook-server',
      endpoints: ['/webhook1', '/webhook2'],
      middleware: ['cors', 'auth'],
      database: null,
      features: {
        logging: true,
        monitoring: false
      }
    };

    await page.type('#jsonEditor', JSON.stringify(unusualButValidJson, null, 2));

    // This should work - no validation error
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Should close successfully
    const modalVisible = await page.isVisible('#serverModal');
    expect(modalVisible).to.be.false;
  });
});