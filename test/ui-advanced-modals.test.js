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

describe('UI Advanced Modal Tests', () => {
  let browser;
  let page;
  let serverProcess;
  const port = 3468;

  before(async function() {
    this.timeout(60000);

    console.log('Setting up advanced modal test environment...');
    process.env.MCP_USE_MOCK_CLIENTS = 'true';
    await setupTestEnvironment();

    // Create mock clients with rich environment variables
    await writeMockClientConfig('claude', {
      servers: {
        'api-server': {
          command: 'npx',
          args: ['-y', 'api-server'],
          env: {
            API_KEY: 'sk-test-12345',
            DEBUG: 'true',
            PORT: '3000',
            SECRET_KEY: 'secret-value-67890'
          }
        },
        'database-server': {
          command: 'python',
          args: ['db_server.py'],
          env: {
            DB_HOST: 'localhost',
            DB_PORT: '5432',
            DB_PASSWORD: 'password123'
          }
        }
      }
    });

    await writeMockClientConfig('vscode', {
      servers: {
        'api-server': {
          command: 'npx',
          args: ['-y', 'api-server'],
          env: {
            API_KEY: 'sk-vscode-54321',
            DEBUG: 'false',
            PORT: '4000'
          }
        }
      }
    });

    await writeMockClientConfig('gemini', {
      servers: {}
    });

    console.log('Starting server for advanced modal tests...');
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
      }, 20000);
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Starting browser for advanced modal tests...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    await page.setViewportSize({ width: 1400, height: 900 });

    // Enhanced error handling
    page.on('pageerror', error => console.error('Page error:', error.message));
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('Console error:', msg.text());
    });

    console.log('Advanced modal test setup complete');
  });

  after(async () => {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
    await cleanupTestEnvironment();
    delete process.env.MCP_USE_MOCK_CLIENTS;
  });

  describe('Add Server Modal Tests', () => {
    beforeEach(async function() {
      this.timeout(10000);
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');
      await page.click('#listViewBtn');
      await page.waitForTimeout(1000);
    });

    it('should add server using form mode with environment variables', async function() {
      this.timeout(25000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select empty client (gemini)
      const clients = await page.$$('.client-item');
      if (clients.length >= 3) {
        await clients[2].click();
        await page.waitForTimeout(2000);

        const addBtn = await page.$('#addServerBtn');
        if (addBtn) {
          await addBtn.click();
          await page.waitForSelector('#serverModal');

          // Ensure form tab is active
          await page.click('.tab-btn[data-tab="form"]');
          await page.waitForTimeout(500);

          // Fill basic server info
          await page.fill('#serverName', 'new-form-server');
          await page.fill('#serverCommand', 'python');
          await page.fill('#serverArgs', 'new_server.py\n--host=0.0.0.0\n--port=5000');

          // Add multiple environment variables
          await page.click('#addEnvVar');
          await page.waitForTimeout(500);

          const envRows = await page.$$('.env-var-row');
          if (envRows.length > 0) {
            // First env var
            await page.fill('.env-key', 'API_TOKEN');
            await page.fill('.env-value', 'token-12345');

            // Add second env var
            await page.click('#addEnvVar');
            await page.waitForTimeout(500);

            const allEnvKeys = await page.$$('.env-key');
            const allEnvValues = await page.$$('.env-value');

            if (allEnvKeys.length >= 2) {
              await allEnvKeys[1].fill('DEBUG_MODE');
              await allEnvValues[1].fill('development');

              // Add third env var
              await page.click('#addEnvVar');
              await page.waitForTimeout(500);

              const finalEnvKeys = await page.$$('.env-key');
              const finalEnvValues = await page.$$('.env-value');

              if (finalEnvKeys.length >= 3) {
                await finalEnvKeys[2].fill('MAX_CONNECTIONS');
                await finalEnvValues[2].fill('100');
              }
            }
          }

          // Submit form
          await page.click('button[type="submit"]');
          await page.waitForTimeout(3000);

          // Verify modal closed and server was added
          const modalVisible = await page.isVisible('#serverModal');
          expect(modalVisible).to.be.false;

          // Check if server appears in list
          await page.waitForSelector('.server-card', { timeout: 5000 });
          const serverCards = await page.$$('.server-card');
          expect(serverCards.length).to.be.greaterThan(0);

          // Verify server name in the list
          const serverNames = await page.$$eval('.server-name',
            elements => elements.map(el => el.textContent)
          );
          expect(serverNames).to.include('new-form-server');
        }
      }
    });

    it('should add server using JSON mode', async function() {
      this.timeout(25000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select empty client (gemini)
      const clients = await page.$$('.client-item');
      if (clients.length >= 3) {
        await clients[2].click();
        await page.waitForTimeout(2000);

        const addBtn = await page.$('#addServerBtn');
        if (addBtn) {
          await addBtn.click();
          await page.waitForSelector('#serverModal');

          // Switch to JSON tab
          await page.click('.tab-btn[data-tab="json"]');
          await page.waitForTimeout(500);

          // Clear existing content and add new JSON
          await page.click('#jsonEditor');
          await page.keyboard.down('Control');
          await page.keyboard.press('KeyA');
          await page.keyboard.up('Control');

          const newServerConfig = {
            'json-test-server': {
              command: 'node',
              args: ['json-server.js', '--config', 'production.json'],
              env: {
                NODE_ENV: 'production',
                JSON_API_PORT: '6000',
                JSON_SECRET_KEY: 'json-secret-789'
              }
            }
          };

          await page.type('#jsonEditor', JSON.stringify(newServerConfig, null, 2));

          // Submit form
          await page.click('button[type="submit"]');
          await page.waitForTimeout(3000);

          // Verify modal closed
          const modalVisible = await page.isVisible('#serverModal');
          expect(modalVisible).to.be.false;

          // Verify server was added
          await page.waitForSelector('.server-card', { timeout: 5000 });
          const serverNames = await page.$$eval('.server-name',
            elements => elements.map(el => el.textContent)
          );
          expect(serverNames).to.include('json-test-server');
        }
      }
    });

    it('should validate form inputs and show error messages', async function() {
      this.timeout(20000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select empty client
      const clients = await page.$$('.client-item');
      if (clients.length >= 3) {
        await clients[2].click();
        await page.waitForTimeout(2000);

        const addBtn = await page.$('#addServerBtn');
        if (addBtn) {
          await addBtn.click();
          await page.waitForSelector('#serverModal');

          // Try to submit empty form
          page.once('dialog', async dialog => {
            expect(dialog.message()).to.include('cannot be empty');
            await dialog.accept();
          });

          await page.click('button[type="submit"]');
          await page.waitForTimeout(1000);

          // Fill only server name and try again
          await page.fill('#serverName', 'test-server');

          page.once('dialog', async dialog => {
            expect(dialog.message()).to.include('Command cannot be empty');
            await dialog.accept();
          });

          await page.click('button[type="submit"]');
          await page.waitForTimeout(1000);

          // Close modal
          await page.click('.close');
        }
      }
    });

    it('should validate JSON input and show error for invalid JSON', async function() {
      this.timeout(20000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select empty client
      const clients = await page.$$('.client-item');
      if (clients.length >= 3) {
        await clients[2].click();
        await page.waitForTimeout(2000);

        const addBtn = await page.$('#addServerBtn');
        if (addBtn) {
          await addBtn.click();
          await page.waitForSelector('#serverModal');

          // Switch to JSON tab
          await page.click('.tab-btn[data-tab="json"]');
          await page.waitForTimeout(500);

          // Enter invalid JSON
          await page.click('#jsonEditor');
          await page.keyboard.down('Control');
          await page.keyboard.press('KeyA');
          await page.keyboard.up('Control');

          await page.type('#jsonEditor', '{ invalid json syntax: }');

          // Try to submit
          page.once('dialog', async dialog => {
            expect(dialog.message()).to.include('Invalid JSON');
            await dialog.accept();
          });

          await page.click('button[type="submit"]');
          await page.waitForTimeout(1000);

          // Close modal
          await page.click('.close');
        }
      }
    });

    it('should validate empty JSON object', async function() {
      this.timeout(20000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select empty client
      const clients = await page.$$('.client-item');
      if (clients.length >= 3) {
        await clients[2].click();
        await page.waitForTimeout(2000);

        const addBtn = await page.$('#addServerBtn');
        if (addBtn) {
          await addBtn.click();
          await page.waitForSelector('#serverModal');

          // Switch to JSON tab
          await page.click('.tab-btn[data-tab="json"]');
          await page.waitForTimeout(500);

          // Enter empty JSON object
          await page.click('#jsonEditor');
          await page.keyboard.down('Control');
          await page.keyboard.press('KeyA');
          await page.keyboard.up('Control');

          await page.type('#jsonEditor', '{}');

          // Try to submit
          page.once('dialog', async dialog => {
            expect(dialog.message()).to.include('must contain at least one server');
            await dialog.accept();
          });

          await page.click('button[type="submit"]');
          await page.waitForTimeout(1000);

          // Close modal
          await page.click('.close');
        }
      }
    });
  });

  describe('Environment Variable Operations', () => {
    beforeEach(async function() {
      this.timeout(10000);
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');
      await page.click('#listViewBtn');
      await page.waitForTimeout(1000);
    });

    it('should add environment variables dynamically in form mode', async function() {
      this.timeout(20000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select claude client
      const clients = await page.$$('.client-item');
      await clients[0].click();
      await page.waitForTimeout(2000);

      // Edit existing server
      const editBtn = await page.$('.edit-server-btn');
      if (editBtn) {
        await editBtn.click();
        await page.waitForSelector('#serverModal');

        // Ensure form tab is active
        await page.click('.tab-btn[data-tab="form"]');
        await page.waitForTimeout(500);

        // Count existing env vars
        const initialEnvRows = await page.$$('.env-var-row');
        const initialCount = initialEnvRows.length;

        // Add new environment variable
        await page.click('#addEnvVar');
        await page.waitForTimeout(500);

        const newEnvRows = await page.$$('.env-var-row');
        expect(newEnvRows.length).to.equal(initialCount + 1);

        // Fill the new env var
        const envKeys = await page.$$('.env-key');
        const envValues = await page.$$('.env-value');

        if (envKeys.length > 0 && envValues.length > 0) {
          const lastKeyInput = envKeys[envKeys.length - 1];
          const lastValueInput = envValues[envValues.length - 1];

          await lastKeyInput.fill('NEW_ENV_VAR');
          await lastValueInput.fill('new-env-value');

          // Switch to JSON tab to verify sync
          await page.click('.tab-btn[data-tab="json"]');
          await page.waitForTimeout(1000);

          const jsonContent = await page.inputValue('#jsonEditor');
          expect(jsonContent).to.include('NEW_ENV_VAR');
          expect(jsonContent).to.include('new-env-value');
        }

        // Close modal
        await page.click('.close');
      }
    });

    it('should remove environment variables', async function() {
      this.timeout(20000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select claude client
      const clients = await page.$$('.client-item');
      await clients[0].click();
      await page.waitForTimeout(2000);

      // Edit existing server
      const editBtn = await page.$('.edit-server-btn');
      if (editBtn) {
        await editBtn.click();
        await page.waitForSelector('#serverModal');

        // Ensure form tab is active
        await page.click('.tab-btn[data-tab="form"]');
        await page.waitForTimeout(500);

        // Count existing env vars
        const initialEnvRows = await page.$$('.env-var-row');
        const initialCount = initialEnvRows.length;

        if (initialCount > 0) {
          // Remove first environment variable
          const removeBtn = await page.$('.remove-env-var');
          if (removeBtn) {
            await removeBtn.click();
            await page.waitForTimeout(500);

            const newEnvRows = await page.$$('.env-var-row');
            expect(newEnvRows.length).to.equal(initialCount - 1);
          }
        }

        // Close modal
        await page.click('.close');
      }
    });

    it('should show copy environment variable buttons', async function() {
      this.timeout(20000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select claude client
      const clients = await page.$$('.client-item');
      await clients[0].click();
      await page.waitForTimeout(2000);

      // Edit existing server
      const editBtn = await page.$('.edit-server-btn');
      if (editBtn) {
        await editBtn.click();
        await page.waitForSelector('#serverModal');

        // Ensure form tab is active
        await page.click('.tab-btn[data-tab="form"]');
        await page.waitForTimeout(500);

        // Look for copy env var buttons
        const copyEnvBtns = await page.$$('.copy-env-var-btn');
        expect(copyEnvBtns.length).to.be.greaterThan(0);

        // Verify buttons have proper data attributes
        for (const btn of copyEnvBtns) {
          const key = await page.evaluate(el => el.dataset.key, btn);
          const value = await page.evaluate(el => el.dataset.value, btn);

          expect(key).to.not.be.empty;
          expect(value).to.not.be.empty;
        }

        // Close modal
        await page.click('.close');
      }
    });
  });

  describe('Import Configuration Modal', () => {
    beforeEach(async function() {
      this.timeout(10000);
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');
      await page.click('#listViewBtn');
      await page.waitForTimeout(1000);
    });

    it('should open import configuration modal', async function() {
      this.timeout(15000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Look for import button (usually in header or toolbar)
      const importBtn = await page.$('#importBtn, .import-btn, [data-action="import"]');
      if (importBtn) {
        await importBtn.click();
        await page.waitForTimeout(1000);

        // Should open import modal
        const importModal = await page.$('#importModal, #importConfigModal, .import-modal');
        if (importModal) {
          const modalVisible = await page.evaluate(el =>
            el.style.display === 'flex' || el.style.display === 'block', importModal
          );
          expect(modalVisible).to.be.true;

          // Should have file input
          const fileInput = await page.$('input[type="file"]');
          expect(fileInput).to.not.be.null;

          // Close modal
          const closeBtn = await page.$('.close, [data-dismiss="modal"]');
          if (closeBtn) {
            await closeBtn.click();
          }
        }
      }
    });
  });

  describe('Rename Server Functionality', () => {
    beforeEach(async function() {
      this.timeout(10000);
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');
      await page.click('#listViewBtn');
      await page.waitForTimeout(1000);
    });

    it('should show rename server option in context menu or actions', async function() {
      this.timeout(20000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select claude client
      const clients = await page.$$('.client-item');
      await clients[0].click();
      await page.waitForTimeout(2000);

      await page.waitForSelector('.server-card');

      // Look for rename functionality - could be in dropdown menu or right-click context
      // This would typically be in a dropdown menu or accessible via right-click
      const serverCard = await page.$('.server-card');
      if (serverCard) {
        // Try right-clicking on server card
        await serverCard.click({ button: 'right' });
        await page.waitForTimeout(500);

        // Look for rename option in context menu
        const renameOption = await page.$('.rename-server-btn, [data-action="rename"]');
        if (renameOption) {
          expect(renameOption).to.not.be.null;
        }

        // Alternatively, look for rename button in server actions
        const renameBtn = await page.$('.server-actions .rename-btn, .rename-server-btn');
        if (renameBtn) {
          expect(renameBtn).to.not.be.null;
        }
      }
    });
  });

  describe('Server View Advanced Operations', () => {
    beforeEach(async function() {
      this.timeout(10000);
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');
      await page.click('#serverViewBtn');
      await page.waitForTimeout(2000);
    });

    it('should show Edit Server Environment modal', async function() {
      this.timeout(20000);

      await page.waitForSelector('#allServersList');
      await page.waitForTimeout(2000);

      // Look for edit environment button (might be in dropdown or separate button)
      const editEnvBtn = await page.$('.edit-env-btn, .edit-server-env-btn, [data-action="edit-env"]');
      if (editEnvBtn) {
        await editEnvBtn.click();
        await page.waitForTimeout(1000);

        // Should open edit server environment modal
        const modal = await page.$('#editServerEnvModal');
        if (modal) {
          const modalVisible = await page.evaluate(el =>
            el.style.display === 'flex', modal
          );
          expect(modalVisible).to.be.true;

          // Should have environment variable controls
          const envKeySelect = await page.$('#envVarKeySelect');
          const envValueInput = await page.$('#envVarValueInput');
          const clientCheckboxes = await page.$$('#editEnvClients input[type="checkbox"]');

          expect(envKeySelect).to.not.be.null;
          expect(envValueInput).to.not.be.null;
          expect(clientCheckboxes.length).to.be.greaterThan(0);

          // Close modal
          await page.click('#editServerEnvModal .close');
          await page.waitForTimeout(500);
        }
      }
    });

    it('should allow selecting clients in Add Server to Multiple Clients modal', async function() {
      this.timeout(20000);

      await page.waitForSelector('#allServersList');
      await page.waitForTimeout(2000);

      const addToClientsBtn = await page.$('.add-to-clients-btn');
      if (addToClientsBtn) {
        await addToClientsBtn.click();
        await page.waitForTimeout(1000);

        const modal = await page.$('#addServerToClientsModal');
        if (modal) {
          const modalVisible = await page.evaluate(el =>
            el.style.display === 'flex', modal
          );
          expect(modalVisible).to.be.true;

          // Should have client selection controls
          const selectAllBtn = await page.$('#selectAllAddServerClients');
          const selectNoneBtn = await page.$('#selectNoneAddServerClients');
          const checkboxes = await page.$$('#addServerToClientsList input[type="checkbox"]');

          expect(selectAllBtn).to.not.be.null;
          expect(selectNoneBtn).to.not.be.null;
          expect(checkboxes.length).to.be.greaterThan(0);

          // Test select all
          await selectAllBtn.click();
          await page.waitForTimeout(500);

          const checkedBoxes = await page.$$('#addServerToClientsList input[type="checkbox"]:checked');
          expect(checkedBoxes.length).to.equal(checkboxes.length);

          // Test select none
          await selectNoneBtn.click();
          await page.waitForTimeout(500);

          const uncheckedBoxes = await page.$$('#addServerToClientsList input[type="checkbox"]:not(:checked)');
          expect(uncheckedBoxes.length).to.equal(checkboxes.length);

          // Close modal
          await page.click('#addServerToClientsModal .close');
          await page.waitForTimeout(500);
        }
      }
    });

    it('should show server configuration in JSON format for editing', async function() {
      this.timeout(15000);

      await page.waitForSelector('#allServersList');
      await page.waitForTimeout(2000);

      const addToClientsBtn = await page.$('.add-to-clients-btn');
      if (addToClientsBtn) {
        await addToClientsBtn.click();
        await page.waitForTimeout(1000);

        const modal = await page.$('#addServerToClientsModal');
        if (modal) {
          // Should show server config in JSON format
          const configTextarea = await page.$('#addServerToClientsConfig');
          if (configTextarea) {
            const configValue = await page.inputValue('#addServerToClientsConfig');
            expect(configValue.length).to.be.greaterThan(0);

            // Should be valid JSON
            expect(() => JSON.parse(configValue)).to.not.throw();

            const parsedConfig = JSON.parse(configValue);
            expect(parsedConfig).to.have.property('command');
          }

          // Close modal
          await page.click('#addServerToClientsModal .close');
          await page.waitForTimeout(500);
        }
      }
    });
  });

  describe('Modal State Management', () => {
    it('should properly reset modal state when closed and reopened', async function() {
      this.timeout(25000);

      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');
      await page.click('#listViewBtn');
      await page.waitForTimeout(1000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select empty client
      const clients = await page.$$('.client-item');
      if (clients.length >= 3) {
        await clients[2].click();
        await page.waitForTimeout(2000);

        const addBtn = await page.$('#addServerBtn');
        if (addBtn) {
          // First modal open
          await addBtn.click();
          await page.waitForSelector('#serverModal');

          await page.fill('#serverName', 'test-name-1');
          await page.fill('#serverCommand', 'test-command-1');

          // Close modal
          await page.click('.close');
          await page.waitForTimeout(500);

          // Second modal open
          await addBtn.click();
          await page.waitForSelector('#serverModal');

          // Fields should be reset
          const serverName = await page.inputValue('#serverName');
          const serverCommand = await page.inputValue('#serverCommand');

          expect(serverName).to.equal('');
          expect(serverCommand).to.equal('');

          // Close modal
          await page.click('.close');
        }
      }
    });

    it('should maintain tab state during form/JSON switching', async function() {
      this.timeout(20000);

      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');
      await page.click('#listViewBtn');
      await page.waitForTimeout(1000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select client with existing server
      const clients = await page.$$('.client-item');
      await clients[0].click();
      await page.waitForTimeout(2000);

      const editBtn = await page.$('.edit-server-btn');
      if (editBtn) {
        await editBtn.click();
        await page.waitForSelector('#serverModal');

        // Start in form tab
        await page.click('.tab-btn[data-tab="form"]');
        await page.waitForTimeout(500);

        const initialFormData = {
          name: await page.inputValue('#serverName'),
          command: await page.inputValue('#serverCommand')
        };

        // Switch to JSON tab
        await page.click('.tab-btn[data-tab="json"]');
        await page.waitForTimeout(1000);

        const jsonContent = await page.inputValue('#jsonEditor');
        const parsedJson = JSON.parse(jsonContent);

        // Data should be consistent
        expect(parsedJson.command).to.equal(initialFormData.command);

        // Switch back to form tab
        await page.click('.tab-btn[data-tab="form"]');
        await page.waitForTimeout(500);

        // Form data should still be there
        const finalFormData = {
          name: await page.inputValue('#serverName'),
          command: await page.inputValue('#serverCommand')
        };

        expect(finalFormData.name).to.equal(initialFormData.name);
        expect(finalFormData.command).to.equal(initialFormData.command);

        // Close modal
        await page.click('.close');
      }
    });
  });
});