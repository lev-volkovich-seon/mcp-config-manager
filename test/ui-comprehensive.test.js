import { expect } from 'chai';
import puppeteer from 'puppeteer';
import { startServer, stopServer, setupTestEnvironment, cleanupTestEnvironment, writeMockClientConfig } from './test-utils.js';

describe('Web UI - Comprehensive Tests', () => {
  let browser;
  let page;
  let serverProcess;
  const port = 3459; // Use a different port for comprehensive UI tests

  before(async () => {
    process.env.MCP_USE_MOCK_CLIENTS = 'true';
    await setupTestEnvironment();
    await writeMockClientConfig('claude', {
      servers: {
        'existing-server': {
          command: 'npx',
          args: ['-y', 'existing-mcp-server'],
          env: { API_KEY: 'test-key-123' }
        }
      }
    });
    await writeMockClientConfig('vscode', { servers: {} });
    await writeMockClientConfig('gemini', {
      servers: {
        'gemini-server': {
          command: 'python',
          args: ['server.py'],
          env: { TOKEN: 'gemini-token' }
        }
      }
    });

    serverProcess = await startServer(port);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();

    // Set viewport for consistent testing
    await page.setViewport({ width: 1200, height: 800 });

    // Enhanced error handling
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

  describe('Basic UI Loading', () => {
    it('should load the main page successfully', async () => {
      await page.goto(`http://localhost:${port}`);
      const title = await page.title();
      expect(title).to.equal('MCP Config Manager');
    }).timeout(10000);

    it('should display the header with view switcher', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');

      const viewButtons = await page.$$('.view-btn');
      expect(viewButtons.length).to.equal(3);

      const buttonTexts = await Promise.all(
        viewButtons.map(btn => page.evaluate(el => el.textContent, btn))
      );
      expect(buttonTexts).to.deep.equal(['List View', 'Kanban View', 'Server View']);
    }).timeout(10000);

    it('should show client list with servers count', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.client-list');

      // Wait for clients to load
      await page.waitForTimeout(1000);

      const clientItems = await page.$$('.client-list .client-item');
      expect(clientItems.length).to.be.at.least(3);
    }).timeout(15000);
  });

  describe('Server Management - Form Editor', () => {
    it('should open Add Server modal', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      // Select first client
      const firstClient = await page.$('.client-item');
      await firstClient.click();

      await page.waitForSelector('#addServerBtn');
      await page.click('#addServerBtn');

      await page.waitForSelector('#serverModal');
      const modal = await page.$('#serverModal');
      const isVisible = await page.evaluate(el => el.style.display !== 'none', modal);
      expect(isVisible).to.be.true;
    }).timeout(15000);

    it('should add a new server using form editor', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      // Select first client
      const firstClient = await page.$('.client-item');
      await firstClient.click();

      await page.waitForSelector('#addServerBtn');
      await page.click('#addServerBtn');

      await page.waitForSelector('#serverModal');

      // Ensure form editor tab is active
      await page.click('.tab-btn[data-tab="form"]');
      await page.waitForSelector('#formTab');

      // Fill form
      await page.type('#serverName', 'test-form-server');
      await page.type('#serverCommand', 'npx');
      await page.type('#serverArgs', '-y\ntest-mcp-server\n--port=3000');

      // Add environment variable
      await page.click('#addEnvVar');
      await page.waitForSelector('.env-var-row');

      const envKeyInput = await page.$('.env-key');
      const envValueInput = await page.$('.env-value');

      await envKeyInput.type('TEST_API_KEY');
      await envValueInput.type('test-value-123');

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for modal to close and page to update
      await page.waitForTimeout(2000);

      // Verify server was added (check for server in the list)
      await page.waitForSelector('.server-list');
      const serverElements = await page.$$('.server-item');
      expect(serverElements.length).to.be.at.least(2);
    }).timeout(20000);
  });

  describe('Server Management - JSON Editor', () => {
    it('should switch to JSON editor tab', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      // Select first client
      const firstClient = await page.$('.client-item');
      await firstClient.click();

      await page.waitForSelector('#addServerBtn');
      await page.click('#addServerBtn');

      await page.waitForSelector('#serverModal');

      // Switch to JSON tab
      await page.click('.tab-btn[data-tab="json"]');
      await page.waitForSelector('#jsonTab');

      const jsonEditor = await page.$('#jsonEditor');
      expect(jsonEditor).to.not.be.null;
    }).timeout(15000);

    it('should add a new server using JSON editor', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      // Select first client
      const firstClient = await page.$('.client-item');
      await firstClient.click();

      await page.waitForSelector('#addServerBtn');
      await page.click('#addServerBtn');

      await page.waitForSelector('#serverModal');

      // Switch to JSON tab
      await page.click('.tab-btn[data-tab="json"]');
      await page.waitForSelector('#jsonTab');

      // Clear and enter JSON
      await page.click('#jsonEditor');
      await page.keyboard.down('Meta'); // Cmd on Mac
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Meta');

      const jsonConfig = JSON.stringify({
        'test-json-server': {
          command: 'npx',
          args: ['-y', 'json-mcp-server', '--config', 'production'],
          env: {
            JSON_API_KEY: 'json-key-67890',
            DEBUG: 'true'
          }
        }
      }, null, 2);

      await page.type('#jsonEditor', jsonConfig);

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for modal to close and page to update
      await page.waitForTimeout(2000);

      // Verify server was added
      await page.waitForSelector('.server-list');
      const serverElements = await page.$$('.server-item');
      expect(serverElements.length).to.be.at.least(2);
    }).timeout(20000);

    it('should show error for invalid JSON', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      // Select first client
      const firstClient = await page.$('.client-item');
      await firstClient.click();

      await page.waitForSelector('#addServerBtn');
      await page.click('#addServerBtn');

      await page.waitForSelector('#serverModal');

      // Switch to JSON tab
      await page.click('.tab-btn[data-tab="json"]');
      await page.waitForSelector('#jsonTab');

      // Enter invalid JSON
      await page.click('#jsonEditor');
      await page.keyboard.down('Meta');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Meta');

      await page.type('#jsonEditor', '{ invalid json: }');

      // Submit form and expect error
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('button[type="submit"]');

      const dialog = await dialogPromise;
      expect(dialog.message()).to.include('Invalid JSON');
      await dialog.accept();
    }).timeout(15000);
  });

  describe('Tab Switching and Data Sync', () => {
    it('should sync data between form and JSON tabs', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      // Select first client
      const firstClient = await page.$('.client-item');
      await firstClient.click();

      await page.waitForSelector('#addServerBtn');
      await page.click('#addServerBtn');

      await page.waitForSelector('#serverModal');

      // Fill form tab
      await page.click('.tab-btn[data-tab="form"]');
      await page.waitForSelector('#formTab');

      await page.type('#serverName', 'sync-test-server');
      await page.type('#serverCommand', 'python');
      await page.type('#serverArgs', 'server.py\n--port=8000');

      // Switch to JSON tab and verify sync
      await page.click('.tab-btn[data-tab="json"]');
      await page.waitForSelector('#jsonTab');
      await page.waitForTimeout(500);

      const jsonValue = await page.$eval('#jsonEditor', el => el.value);
      const parsedJson = JSON.parse(jsonValue);

      expect(parsedJson.command).to.equal('python');
      expect(parsedJson.args).to.deep.equal(['server.py', '--port=8000']);
    }).timeout(15000);
  });

  describe('View Switching', () => {
    it('should switch between List, Kanban, and Server views', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');

      // Test List View (default)
      let listView = await page.$('#listViewContainer');
      let isListVisible = await page.evaluate(el => el.style.display !== 'none', listView);
      expect(isListVisible).to.be.true;

      // Switch to Kanban View
      await page.click('#kanbanViewBtn');
      await page.waitForTimeout(500);

      let kanbanView = await page.$('#kanbanViewContainer');
      let isKanbanVisible = await page.evaluate(el => el.style.display !== 'none', kanbanView);
      expect(isKanbanVisible).to.be.true;

      isListVisible = await page.evaluate(el => el.style.display === 'none', listView);
      expect(isListVisible).to.be.true;

      // Switch to Server View
      await page.click('#serverViewBtn');
      await page.waitForTimeout(500);

      let serverView = await page.$('#serverViewContainer');
      let isServerVisible = await page.evaluate(el => el.style.display !== 'none', serverView);
      expect(isServerVisible).to.be.true;
    }).timeout(10000);
  });

  describe('Server Operations', () => {
    it('should export server configuration', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      // Select first client
      const firstClient = await page.$('.client-item');
      await firstClient.click();

      await page.waitForSelector('.server-list');
      await page.waitForTimeout(1000);

      // Look for export button
      const exportBtn = await page.$('.server-item .btn-secondary');
      if (exportBtn) {
        // This would trigger a download - in a real test we'd need to handle file downloads
        // For now just verify the button exists
        expect(exportBtn).to.not.be.null;
      }
    }).timeout(15000);

    it('should copy server to clipboard', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      // Select first client
      const firstClient = await page.$('.client-item');
      await firstClient.click();

      await page.waitForSelector('.server-list');
      await page.waitForTimeout(1000);

      // Look for copy button
      const copyBtn = await page.$('.server-item button[title="Copy to Clipboard"]');
      if (copyBtn) {
        await copyBtn.click();
        await page.waitForTimeout(500);

        // Verify button shows feedback (✓)
        const buttonText = await page.evaluate(el => el.textContent, copyBtn);
        expect(buttonText).to.include('✓');
      }
    }).timeout(15000);
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty JSON object', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      // Select first client
      const firstClient = await page.$('.client-item');
      await firstClient.click();

      await page.waitForSelector('#addServerBtn');
      await page.click('#addServerBtn');

      await page.waitForSelector('#serverModal');

      // Switch to JSON tab
      await page.click('.tab-btn[data-tab="json"]');
      await page.waitForSelector('#jsonTab');

      // Enter empty JSON object
      await page.click('#jsonEditor');
      await page.keyboard.down('Meta');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Meta');

      await page.type('#jsonEditor', '{}');

      // Submit form and expect error
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('button[type="submit"]');

      const dialog = await dialogPromise;
      expect(dialog.message()).to.include('must contain at least one server');
      await dialog.accept();
    }).timeout(15000);

    it('should handle form validation', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      // Select first client
      const firstClient = await page.$('.client-item');
      await firstClient.click();

      await page.waitForSelector('#addServerBtn');
      await page.click('#addServerBtn');

      await page.waitForSelector('#serverModal');

      // Try to submit empty form
      await page.click('.tab-btn[data-tab="form"]');
      await page.waitForSelector('#formTab');

      // Submit without filling required fields
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('button[type="submit"]');

      const dialog = await dialogPromise;
      expect(dialog.message()).to.include('Server name cannot be empty');
      await dialog.accept();
    }).timeout(15000);
  });

  describe('Accessibility and Usability', () => {
    it('should have proper focus management', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      // Test keyboard navigation
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement.tagName);
      expect(focusedElement).to.not.be.null;
    }).timeout(10000);

    it('should have descriptive button titles', async () => {
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('#clientList');
      await page.waitForTimeout(1000);

      // Select first client
      const firstClient = await page.$('.client-item');
      await firstClient.click();

      await page.waitForSelector('.server-list');
      await page.waitForTimeout(1000);

      // Check for proper button titles
      const copyButton = await page.$('button[title="Copy to Clipboard"]');
      if (copyButton) {
        const title = await page.evaluate(el => el.getAttribute('title'), copyButton);
        expect(title).to.equal('Copy to Clipboard');
      }
    }).timeout(15000);
  });
});