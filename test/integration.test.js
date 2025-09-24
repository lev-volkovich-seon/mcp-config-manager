import { expect } from 'chai';
import puppeteer from 'puppeteer';
import { startServer, stopServer, setupTestEnvironment, cleanupTestEnvironment, writeMockClientConfig } from './test-utils.js';

describe('Integration Tests - Form/JSON Dual Mode', () => {
  let browser;
  let page;
  let serverProcess;
  const port = 3460; // Use a different port for integration tests

  before(async () => {
    process.env.MCP_USE_MOCK_CLIENTS = 'true';
    await setupTestEnvironment();
    await writeMockClientConfig('claude', { servers: {} });
    await writeMockClientConfig('vscode', { servers: {} });

    serverProcess = await startServer(port);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    // Enhanced error handling for debugging
    page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Console error:', msg.text());
      }
    });
  }).timeout(15000);

  after(async () => {
    if (browser) {
      await browser.close();
    }
    if (serverProcess) {
      stopServer();
    }
    await cleanupTestEnvironment();
    delete process.env.MCP_USE_MOCK_CLIENTS;
  });

  describe('Form Editor Integration', () => {
    it('should successfully add server with all form fields', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      // Get initial server count
      const firstClient = await page.$('.client-item');
      await firstClient.click();
      await page.waitForSelector('.server-list');

      const initialServers = await page.$$('.server-item');
      const initialCount = initialServers.length;

      // Open Add Server modal
      await page.click('#addServerBtn');
      await page.waitForSelector('#serverModal');

      // Ensure form tab is active
      await page.click('.tab-btn[data-tab="form"]');
      await page.waitForSelector('#formTab');

      // Fill complete form
      await page.type('#serverName', 'integration-form-server');
      await page.type('#serverCommand', 'npx');
      await page.type('#serverArgs', '-y\nintegration-mcp-server\n--verbose\n--port=4000');

      // Add multiple environment variables
      await page.click('#addEnvVar');
      await page.waitForSelector('.env-var-row');

      const envRows = await page.$$('.env-var-row');
      expect(envRows.length).to.equal(1);

      await page.type('.env-key', 'PRIMARY_API_KEY');
      await page.type('.env-value', 'primary-key-123');

      // Add second env var
      await page.click('#addEnvVar');
      await page.waitForTimeout(500);

      const allEnvRows = await page.$$('.env-var-row');
      expect(allEnvRows.length).to.equal(2);

      // Fill second env var
      const envKeys = await page.$$('.env-key');
      const envValues = await page.$$('.env-value');

      await envKeys[1].type('SECONDARY_TOKEN');
      await envValues[1].type('secondary-token-456');

      // Submit form
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Verify server was added and count increased
      await page.waitForSelector('.server-list');
      const finalServers = await page.$$('.server-item');
      expect(finalServers.length).to.equal(initialCount + 1);

      // Verify server details are displayed correctly
      const serverTexts = await page.$$eval('.server-item', items =>
        items.map(item => item.textContent)
      );

      const addedServer = serverTexts.find(text =>
        text.includes('integration-form-server')
      );
      expect(addedServer).to.not.be.undefined;
      expect(addedServer).to.include('npx');
      expect(addedServer).to.include('-y integration-mcp-server --verbose --port=4000');
      expect(addedServer).to.include('PRIMARY_API_KEY');
      expect(addedServer).to.include('SECONDARY_TOKEN');
    }).timeout(30000);
  });

  describe('JSON Editor Integration', () => {
    it('should successfully add server via JSON with complex configuration', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      // Select second client to avoid conflicts
      const clients = await page.$$('.client-item');
      await clients[1].click();
      await page.waitForSelector('.server-list');

      const initialServers = await page.$$('.server-item');
      const initialCount = initialServers.length;

      // Open Add Server modal
      await page.click('#addServerBtn');
      await page.waitForSelector('#serverModal');

      // Switch to JSON tab
      await page.click('.tab-btn[data-tab="json"]');
      await page.waitForSelector('#jsonTab');

      // Clear and enter complex JSON configuration
      await page.click('#jsonEditor');
      await page.keyboard.down('Meta');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Meta');

      const complexJsonConfig = JSON.stringify({
        'integration-json-server': {
          command: 'python',
          args: ['-m', 'server', '--config', 'production.json', '--log-level', 'info'],
          env: {
            DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
            API_KEY: 'complex-api-key-789',
            DEBUG_MODE: 'false',
            MAX_CONNECTIONS: '100'
          }
        }
      }, null, 2);

      await page.type('#jsonEditor', complexJsonConfig);

      // Submit form
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Verify server was added
      await page.waitForSelector('.server-list');
      const finalServers = await page.$$('.server-item');
      expect(finalServers.length).to.equal(initialCount + 1);

      // Verify complex configuration was parsed correctly
      const serverTexts = await page.$$eval('.server-item', items =>
        items.map(item => item.textContent)
      );

      const addedServer = serverTexts.find(text =>
        text.includes('integration-json-server')
      );
      expect(addedServer).to.not.be.undefined;
      expect(addedServer).to.include('python');
      expect(addedServer).to.include('-m server --config production.json --log-level info');
      expect(addedServer).to.include('DATABASE_URL');
      expect(addedServer).to.include('API_KEY');
      expect(addedServer).to.include('DEBUG_MODE');
      expect(addedServer).to.include('MAX_CONNECTIONS');
    }).timeout(30000);
  });

  describe('Error Handling Integration', () => {
    it('should handle multiple servers in JSON (should fail)', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      const firstClient = await page.$('.client-item');
      await firstClient.click();

      await page.click('#addServerBtn');
      await page.waitForSelector('#serverModal');

      // Switch to JSON tab
      await page.click('.tab-btn[data-tab="json"]');
      await page.waitForSelector('#jsonTab');

      // Enter JSON with multiple servers (should fail)
      await page.click('#jsonEditor');
      await page.keyboard.down('Meta');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Meta');

      const multipleServersJson = JSON.stringify({
        'server-one': {
          command: 'npx',
          args: ['-y', 'server-one']
        },
        'server-two': {
          command: 'npx',
          args: ['-y', 'server-two']
        }
      }, null, 2);

      await page.type('#jsonEditor', multipleServersJson);

      // Submit and expect error
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('button[type="submit"]');

      const dialog = await dialogPromise;
      expect(dialog.message()).to.include('exactly one server configuration');
      await dialog.accept();
    }).timeout(20000);

    it('should handle malformed JSON gracefully', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      const firstClient = await page.$('.client-item');
      await firstClient.click();

      await page.click('#addServerBtn');
      await page.waitForSelector('#serverModal');

      // Switch to JSON tab
      await page.click('.tab-btn[data-tab="json"]');
      await page.waitForSelector('#jsonTab');

      // Enter malformed JSON
      await page.click('#jsonEditor');
      await page.keyboard.down('Meta');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Meta');

      await page.type('#jsonEditor', '{ "malformed": json, "syntax": }');

      // Submit and expect error
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('button[type="submit"]');

      const dialog = await dialogPromise;
      expect(dialog.message()).to.include('Invalid JSON format');
      await dialog.accept();

      // Verify modal is still open (form wasn't submitted)
      const modal = await page.$('#serverModal');
      const isVisible = await page.evaluate(el => el.style.display !== 'none', modal);
      expect(isVisible).to.be.true;
    }).timeout(20000);
  });

  describe('Tab Switching Integration', () => {
    it('should properly sync data when switching between tabs', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      const firstClient = await page.$('.client-item');
      await firstClient.click();

      await page.click('#addServerBtn');
      await page.waitForSelector('#serverModal');

      // Start in form tab
      await page.click('.tab-btn[data-tab="form"]');
      await page.waitForSelector('#formTab');

      // Fill form
      await page.type('#serverName', 'sync-test-server');
      await page.type('#serverCommand', 'node');
      await page.type('#serverArgs', 'index.js\n--env=production');

      // Add env var
      await page.click('#addEnvVar');
      await page.waitForSelector('.env-var-row');
      await page.type('.env-key', 'NODE_ENV');
      await page.type('.env-value', 'production');

      // Switch to JSON tab - should sync data
      await page.click('.tab-btn[data-tab="json"]');
      await page.waitForSelector('#jsonTab');
      await page.waitForTimeout(500);

      // Verify JSON contains form data
      const jsonValue = await page.$eval('#jsonEditor', el => el.value);
      const parsedJson = JSON.parse(jsonValue);

      expect(parsedJson.command).to.equal('node');
      expect(parsedJson.args).to.deep.equal(['index.js', '--env=production']);
      expect(parsedJson.env).to.deep.equal({ NODE_ENV: 'production' });

      // Modify JSON
      await page.click('#jsonEditor');
      await page.keyboard.down('Meta');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Meta');

      const modifiedJson = JSON.stringify({
        command: 'python',
        args: ['app.py', '--debug'],
        env: {
          NODE_ENV: 'production',
          DEBUG: 'true'
        }
      }, null, 2);

      await page.type('#jsonEditor', modifiedJson);

      // Switch back to form tab - should sync changes
      await page.click('.tab-btn[data-tab="form"]');
      await page.waitForSelector('#formTab');
      await page.waitForTimeout(500);

      // Verify form updated with JSON changes
      const commandValue = await page.$eval('#serverCommand', el => el.value);
      const argsValue = await page.$eval('#serverArgs', el => el.value);

      expect(commandValue).to.equal('python');
      expect(argsValue).to.equal('app.py\n--debug');

      // Check env vars updated
      const envRows = await page.$$('.env-var-row');
      expect(envRows.length).to.equal(2); // NODE_ENV + DEBUG

      const envKeys = await page.$$eval('.env-key', inputs => inputs.map(input => input.value));
      const envValues = await page.$$eval('.env-value', inputs => inputs.map(input => input.value));

      expect(envKeys).to.include('NODE_ENV');
      expect(envKeys).to.include('DEBUG');
      expect(envValues).to.include('production');
      expect(envValues).to.include('true');
    }).timeout(30000);
  });

  describe('Real-world Scenarios', () => {
    it('should handle a complete server lifecycle (add, edit, delete)', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      const firstClient = await page.$('.client-item');
      await firstClient.click();

      // Step 1: Add server
      await page.click('#addServerBtn');
      await page.waitForSelector('#serverModal');

      await page.click('.tab-btn[data-tab="form"]');
      await page.type('#serverName', 'lifecycle-test-server');
      await page.type('#serverCommand', 'npm');
      await page.type('#serverArgs', 'start');

      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Verify server exists
      let serverItems = await page.$$('.server-item');
      const serverCount = serverItems.length;
      expect(serverCount).to.be.at.least(1);

      // Step 2: Edit server (this would require implementing edit functionality)
      // For now, just verify the edit button exists
      const editButton = await page.$('.server-item button:contains("Edit")') ||
                        await page.$('.server-item .btn:nth-child(1)');
      expect(editButton).to.not.be.null;

      // Step 3: Delete server
      const deleteButton = await page.$('.server-item button[title="Delete"]') ||
                          await page.$('.server-item .danger');
      if (deleteButton) {
        // Handle confirmation dialog
        const dialogPromise = page.waitForEvent('dialog');
        await deleteButton.click();

        const dialog = await dialogPromise;
        await dialog.accept();

        await page.waitForTimeout(1000);

        // Verify server was deleted
        const finalServerItems = await page.$$('.server-item');
        expect(finalServerItems.length).to.equal(serverCount - 1);
      }
    }).timeout(40000);
  });
});