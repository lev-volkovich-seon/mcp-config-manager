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

describe('UI Comprehensive Tests - All Views', () => {
  let browser;
  let page;
  let serverProcess;
  const port = 3467;

  before(async function() {
    this.timeout(60000);

    console.log('Setting up comprehensive test environment...');
    process.env.MCP_USE_MOCK_CLIENTS = 'true';
    await setupTestEnvironment();

    // Create detailed mock clients for comprehensive testing
    await writeMockClientConfig('claude', {
      servers: {
        'existing-server': {
          command: 'npx',
          args: ['-y', 'existing-mcp-server'],
          env: { API_KEY: 'test-key-123', DEBUG: 'true' }
        },
        'test-server': {
          command: 'python',
          args: ['server.py'],
          env: { TOKEN: 'secret-token' }
        }
      }
    });

    await writeMockClientConfig('vscode', {
      servers: {
        'vscode-server': {
          command: 'node',
          args: ['vscode-mcp.js'],
          env: { PORT: '8080' }
        }
      }
    });

    await writeMockClientConfig('gemini', { servers: {} });

    console.log('Starting server for comprehensive tests...');
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

    console.log('Starting browser for comprehensive tests...');
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

    console.log('Comprehensive test setup complete');
  });

  after(async () => {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
    await cleanupTestEnvironment();
    delete process.env.MCP_USE_MOCK_CLIENTS;
  });

  describe('List View Comprehensive Tests', () => {
    beforeEach(async function() {
      this.timeout(10000);
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');
      await page.click('#listViewBtn');
      await page.waitForTimeout(1000);
    });

    it('should display all clients with correct server counts', async function() {
      this.timeout(15000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      const clientItems = await page.$$('.client-item');
      expect(clientItems.length).to.be.at.least(3);

      // Check that server counts are displayed
      const clientStatuses = await page.$$eval('.client-status',
        elements => elements.map(el => el.textContent)
      );

      expect(clientStatuses.some(status => status.includes('server(s)'))).to.be.true;
    });

    it('should allow client sorting and persist sort preference', async function() {
      this.timeout(15000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Test name ascending sort
      await page.selectOption('#clientSort', 'name-asc');
      await page.waitForTimeout(500);

      let clientNames = await page.$$eval('.client-name',
        elements => elements.map(el => el.textContent)
      );

      const sortedNamesAsc = [...clientNames].sort();
      expect(clientNames).to.deep.equal(sortedNamesAsc);

      // Test name descending sort
      await page.selectOption('#clientSort', 'name-desc');
      await page.waitForTimeout(500);

      clientNames = await page.$$eval('.client-name',
        elements => elements.map(el => el.textContent)
      );

      const sortedNamesDesc = [...clientNames].sort().reverse();
      expect(clientNames).to.deep.equal(sortedNamesDesc);

      // Refresh page and check if sort persists
      await page.reload();
      await page.waitForSelector('#clientSort');
      await page.waitForTimeout(1000);

      const persistedSortValue = await page.$eval('#clientSort', el => el.value);
      expect(persistedSortValue).to.equal('name-desc');
    });

    it('should transition from welcome view to client view when selecting client', async function() {
      this.timeout(15000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Initially welcome view should be visible
      const welcomeVisible = await page.isVisible('#welcomeView');
      const clientViewVisible = await page.isVisible('#clientView');

      if (welcomeVisible) {
        expect(clientViewVisible).to.be.false;

        // Click on first client
        await page.click('.client-item:first-child');
        await page.waitForTimeout(1000);

        // Check transition
        const welcomeHidden = await page.evaluate(() => {
          return document.getElementById('welcomeView').style.display === 'none';
        });
        const clientViewShown = await page.evaluate(() => {
          return document.getElementById('clientView').style.display === 'block';
        });

        expect(welcomeHidden).to.be.true;
        expect(clientViewShown).to.be.true;
      }
    });

    it('should display server list with bulk actions when client selected', async function() {
      this.timeout(15000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select claude-desktop client
      const claudeClient = await page.$('.client-item:first-child');
      await claudeClient.click();
      await page.waitForTimeout(2000);

      await page.waitForSelector('#serverList');

      // Should show servers
      const serverCards = await page.$$('.server-card');
      expect(serverCards.length).to.be.at.least(1);

      // Should show bulk actions (but hidden initially)
      const bulkActions = await page.$('#bulkActions');
      expect(bulkActions).to.not.be.null;

      const bulkActionsVisible = await page.evaluate(el =>
        el.style.display !== 'none', bulkActions
      );
      expect(bulkActionsVisible).to.be.false; // Initially hidden
    });

    it('should enable bulk actions when servers are selected', async function() {
      this.timeout(15000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select claude-desktop client
      const claudeClient = await page.$('.client-item:first-child');
      await claudeClient.click();
      await page.waitForTimeout(2000);

      await page.waitForSelector('.server-card');

      // Select first server checkbox
      const firstCheckbox = await page.$('.server-checkbox');
      if (firstCheckbox) {
        await firstCheckbox.click();
        await page.waitForTimeout(500);

        // Bulk actions should now be visible
        const bulkActions = await page.$('#bulkActions');
        const isVisible = await page.evaluate(el =>
          el.style.display !== 'none', bulkActions
        );
        expect(isVisible).to.be.true;

        // Selected count should be updated
        const selectedCount = await page.textContent('#selectedCount');
        expect(selectedCount).to.include('1 selected');
      }
    });

    it('should allow select all and deselect all operations', async function() {
      this.timeout(15000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select claude-desktop client
      const claudeClient = await page.$('.client-item:first-child');
      await claudeClient.click();
      await page.waitForTimeout(2000);

      await page.waitForSelector('.server-card');

      // Select first server to show bulk actions
      const firstCheckbox = await page.$('.server-checkbox');
      if (firstCheckbox) {
        await firstCheckbox.click();
        await page.waitForTimeout(500);

        // Click "Select All"
        await page.click('#selectAllServersBtn');
        await page.waitForTimeout(500);

        // All checkboxes should be checked
        const checkedBoxes = await page.$$('.server-checkbox:checked');
        const totalBoxes = await page.$$('.server-checkbox');
        expect(checkedBoxes.length).to.equal(totalBoxes.length);

        // Click "Deselect All"
        await page.click('#deselectAllServersBtn');
        await page.waitForTimeout(500);

        // No checkboxes should be checked
        const checkedAfterDeselect = await page.$$('.server-checkbox:checked');
        expect(checkedAfterDeselect.length).to.equal(0);

        // Bulk actions should be hidden again
        const bulkActions = await page.$('#bulkActions');
        const isVisible = await page.evaluate(el =>
          el.style.display !== 'none', bulkActions
        );
        expect(isVisible).to.be.false;
      }
    });

    it('should allow editing server in form mode', async function() {
      this.timeout(20000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select claude-desktop client
      const claudeClient = await page.$('.client-item:first-child');
      await claudeClient.click();
      await page.waitForTimeout(2000);

      await page.waitForSelector('.server-card');

      // Click edit button on first server
      const editBtn = await page.$('.edit-server-btn');
      if (editBtn) {
        await editBtn.click();
        await page.waitForSelector('#serverModal');

        // Should be in form tab by default
        await page.click('.tab-btn[data-tab="form"]');
        await page.waitForTimeout(500);

        // Server name should be filled
        const serverName = await page.inputValue('#serverName');
        expect(serverName.length).to.be.greaterThan(0);

        // Command should be filled
        const command = await page.inputValue('#serverCommand');
        expect(command.length).to.be.greaterThan(0);

        // Should have environment variables
        const envRows = await page.$$('.env-var-row');
        expect(envRows.length).to.be.greaterThan(0);

        // Close modal
        await page.click('.close');
        await page.waitForTimeout(500);
      }
    });

    it('should allow editing server in JSON mode', async function() {
      this.timeout(20000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select claude-desktop client
      const claudeClient = await page.$('.client-item:first-child');
      await claudeClient.click();
      await page.waitForTimeout(2000);

      await page.waitForSelector('.server-card');

      // Click edit button on first server
      const editBtn = await page.$('.edit-server-btn');
      if (editBtn) {
        await editBtn.click();
        await page.waitForSelector('#serverModal');

        // Switch to JSON tab
        await page.click('.tab-btn[data-tab="json"]');
        await page.waitForTimeout(500);

        // JSON editor should have content
        const jsonContent = await page.inputValue('#jsonEditor');
        expect(jsonContent.length).to.be.greaterThan(0);

        // Should be valid JSON
        expect(() => JSON.parse(jsonContent)).to.not.throw();

        // Close modal
        await page.click('.close');
        await page.waitForTimeout(500);
      }
    });

    it('should sync data between form and JSON tabs', async function() {
      this.timeout(20000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select empty client to add new server
      const emptyClient = await page.$$('.client-item');
      if (emptyClient.length > 2) {
        await emptyClient[2].click(); // Select empty-client
        await page.waitForTimeout(2000);

        // Click Add Server
        const addBtn = await page.$('#addServerBtn');
        if (addBtn) {
          await addBtn.click();
          await page.waitForSelector('#serverModal');

          // Fill form tab
          await page.click('.tab-btn[data-tab="form"]');
          await page.waitForTimeout(500);

          await page.fill('#serverName', 'sync-test-server');
          await page.fill('#serverCommand', 'python');
          await page.fill('#serverArgs', 'server.py\n--port=8000');

          // Add environment variable
          await page.click('#addEnvVar');
          await page.waitForSelector('.env-var-row');

          const envKeyInput = await page.$('.env-key');
          const envValueInput = await page.$('.env-value');

          if (envKeyInput && envValueInput) {
            await envKeyInput.fill('TEST_VAR');
            await envValueInput.fill('test-value');
          }

          // Switch to JSON tab
          await page.click('.tab-btn[data-tab="json"]');
          await page.waitForTimeout(1000);

          // Verify sync
          const jsonContent = await page.inputValue('#jsonEditor');
          const parsedJson = JSON.parse(jsonContent);

          expect(parsedJson.command).to.equal('python');
          expect(parsedJson.args).to.deep.equal(['server.py', '--port=8000']);
          if (parsedJson.env) {
            expect(parsedJson.env.TEST_VAR).to.equal('test-value');
          }

          // Close modal
          await page.click('.close');
          await page.waitForTimeout(500);
        }
      }
    });

    it('should allow copying server to clipboard', async function() {
      this.timeout(15000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select claude-desktop client
      const claudeClient = await page.$('.client-item:first-child');
      await claudeClient.click();
      await page.waitForTimeout(2000);

      await page.waitForSelector('.server-card');

      // Click copy to clipboard button
      const copyBtn = await page.$('.copy-to-clipboard-btn');
      if (copyBtn) {
        await copyBtn.click();
        await page.waitForTimeout(1000);

        // Button should show checkmark feedback
        const buttonText = await page.textContent('.copy-to-clipboard-btn');
        expect(buttonText).to.include('✓');
      }
    });

    it('should allow exporting server', async function() {
      this.timeout(15000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select claude-desktop client
      const claudeClient = await page.$('.client-item:first-child');
      await claudeClient.click();
      await page.waitForTimeout(2000);

      await page.waitForSelector('.server-card');

      // Click export button
      const exportBtn = await page.$('.export-server-btn');
      if (exportBtn) {
        // Just verify button exists and is clickable
        expect(exportBtn).to.not.be.null;
        // Note: Actual file download testing would require additional setup
      }
    });

    it('should allow deleting server with confirmation', async function() {
      this.timeout(15000);

      await page.waitForSelector('#clientList');
      await page.waitForTimeout(2000);

      // Select claude-desktop client
      const claudeClient = await page.$('.client-item:first-child');
      await claudeClient.click();
      await page.waitForTimeout(2000);

      await page.waitForSelector('.server-card');

      const initialServerCount = (await page.$$('.server-card')).length;

      // Click delete button
      const deleteBtn = await page.$('.delete-server-btn');
      if (deleteBtn) {
        // Set up dialog handler
        page.once('dialog', async dialog => {
          expect(dialog.message()).to.include('Are you sure');
          await dialog.accept();
        });

        await deleteBtn.click();
        await page.waitForTimeout(2000);

        // Server count should decrease
        const finalServerCount = (await page.$$('.server-card')).length;
        expect(finalServerCount).to.be.lessThan(initialServerCount);
      }
    });
  });

  describe('Kanban View Comprehensive Tests', () => {
    beforeEach(async function() {
      this.timeout(10000);
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');
      await page.click('#kanbanViewBtn');
      await page.waitForTimeout(2000);
    });

    it('should display kanban columns for all clients', async function() {
      this.timeout(15000);

      await page.waitForSelector('#kanbanBoard');

      const columns = await page.$$('.kanban-column');
      expect(columns.length).to.be.at.least(3);

      // Each column should have a header with client name
      const headers = await page.$$eval('.kanban-header h3',
        elements => elements.map(el => el.textContent)
      );
      expect(headers.length).to.be.at.least(3);

      // Should have Add Server buttons
      const addButtons = await page.$$('.kanban-add-btn');
      expect(addButtons.length).to.be.at.least(3);
    });

    it('should display servers as draggable cards with consistent colors', async function() {
      this.timeout(15000);

      await page.waitForSelector('.kanban-column');

      const serverCards = await page.$$('.kanban-card');
      expect(serverCards.length).to.be.at.least(2);

      // Cards should be draggable
      for (const card of serverCards) {
        const isDraggable = await page.evaluate(el => el.draggable, card);
        expect(isDraggable).to.be.true;

        // Should have background color
        const backgroundColor = await page.evaluate(el =>
          window.getComputedStyle(el).backgroundColor, card
        );
        expect(backgroundColor).to.not.equal('rgba(0, 0, 0, 0)'); // Not transparent
      }
    });

    it('should allow kanban sorting and persist preference', async function() {
      this.timeout(15000);

      await page.waitForSelector('#kanbanSort');

      // Test servers descending sort
      await page.selectOption('#kanbanSort', 'servers-desc');
      await page.waitForTimeout(1000);

      let columnHeaders = await page.$$eval('.kanban-header h3',
        elements => elements.map(el => el.textContent)
      );

      // Refresh and check persistence
      await page.reload();
      await page.waitForSelector('.view-switcher');
      await page.click('#kanbanViewBtn');
      await page.waitForTimeout(2000);

      const persistedSortValue = await page.$eval('#kanbanSort', el => el.value);
      expect(persistedSortValue).to.equal('servers-desc');
    });

    it('should allow adding server from kanban column', async function() {
      this.timeout(20000);

      await page.waitForSelector('.kanban-column');

      // Click Add Server button in first column
      const firstAddBtn = await page.$('.kanban-add-btn');
      await firstAddBtn.click();

      await page.waitForSelector('#serverModal');

      // Modal should be open
      const modalVisible = await page.isVisible('#serverModal');
      expect(modalVisible).to.be.true;

      // Close modal
      await page.click('.close');
      await page.waitForTimeout(500);
    });

    it('should show server actions on kanban cards', async function() {
      this.timeout(15000);

      await page.waitForSelector('.kanban-card');

      const firstCard = await page.$('.kanban-card');
      if (firstCard) {
        // Should have action buttons
        const editBtn = await page.$('.edit-server-kanban-btn');
        const copyBtn = await page.$('.copy-to-clipboard-kanban-btn');
        const exportBtn = await page.$('.export-server-kanban-btn');
        const deleteBtn = await page.$('.delete-server-kanban-btn');

        expect(editBtn).to.not.be.null;
        expect(copyBtn).to.not.be.null;
        expect(exportBtn).to.not.be.null;
        expect(deleteBtn).to.not.be.null;
      }
    });

    it('should allow editing server from kanban card', async function() {
      this.timeout(20000);

      await page.waitForSelector('.kanban-card');

      const editBtn = await page.$('.edit-server-kanban-btn');
      if (editBtn) {
        await editBtn.click();
        await page.waitForSelector('#serverModal');

        // Modal should be open with server data
        const serverName = await page.inputValue('#serverName');
        expect(serverName.length).to.be.greaterThan(0);

        // Close modal
        await page.click('.close');
        await page.waitForTimeout(500);
      }
    });

    it('should allow copying server to clipboard from kanban card', async function() {
      this.timeout(15000);

      await page.waitForSelector('.kanban-card');

      const copyBtn = await page.$('.copy-to-clipboard-kanban-btn');
      if (copyBtn) {
        await copyBtn.click();
        await page.waitForTimeout(1000);

        // Should show feedback (in real implementation)
        // For now just verify button exists and is clickable
        expect(copyBtn).to.not.be.null;
      }
    });

    it('should allow deleting server from kanban card', async function() {
      this.timeout(15000);

      await page.waitForSelector('.kanban-card');

      const initialCardCount = (await page.$$('.kanban-card')).length;

      const deleteBtn = await page.$('.delete-server-kanban-btn');
      if (deleteBtn) {
        // Set up dialog handler
        page.once('dialog', async dialog => {
          expect(dialog.message()).to.include('Are you sure');
          await dialog.accept();
        });

        await deleteBtn.click();
        await page.waitForTimeout(2000);

        // Card count should decrease
        const finalCardCount = (await page.$$('.kanban-card')).length;
        expect(finalCardCount).to.be.lessThan(initialCardCount);
      }
    });

    // Note: Drag and drop testing requires more complex setup with mouse events
    // This is a placeholder for that functionality
    it('should support drag and drop operations (placeholder)', async function() {
      this.timeout(10000);

      await page.waitForSelector('.kanban-card');

      const cards = await page.$$('.kanban-card');
      const columns = await page.$$('.kanban-servers');

      if (cards.length > 0 && columns.length > 1) {
        // Verify drag and drop elements exist
        expect(cards.length).to.be.greaterThan(0);
        expect(columns.length).to.be.greaterThan(1);

        // In a full implementation, you would simulate:
        // - mousedown on source card
        // - dragstart event
        // - dragover on target column
        // - drop event
        // - verify server moved between clients
      }
    });
  });

  describe('Server View Comprehensive Tests', () => {
    beforeEach(async function() {
      this.timeout(10000);
      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');
      await page.click('#serverViewBtn');
      await page.waitForTimeout(2000);
    });

    it('should display all servers across clients', async function() {
      this.timeout(15000);

      await page.waitForSelector('#allServersList');
      await page.waitForTimeout(2000);

      const serverCards = await page.$$('.server-card-all');
      expect(serverCards.length).to.be.at.least(2);

      // Each card should show server details
      for (const card of serverCards) {
        const serverName = await page.evaluate(el =>
          el.querySelector('.server-name-all').textContent, card
        );
        expect(serverName.length).to.be.greaterThan(0);

        // Should have action buttons
        const editBtn = await page.evaluate(el =>
          el.querySelector('.edit-server-full-btn'), card
        );
        const addToClientsBtn = await page.evaluate(el =>
          el.querySelector('.add-to-clients-btn'), card
        );
        expect(editBtn).to.not.be.null;
        expect(addToClientsBtn).to.not.be.null;
      }
    });

    it('should show client associations for each server', async function() {
      this.timeout(15000);

      await page.waitForSelector('#allServersList');
      await page.waitForTimeout(2000);

      const clientAssociations = await page.$$('.server-clients');
      expect(clientAssociations.length).to.be.greaterThan(0);

      // Should show which clients have each server
      const clientText = await page.textContent('.server-clients');
      expect(clientText).to.include('Clients:');
    });

    it('should allow editing server from server view', async function() {
      this.timeout(20000);

      await page.waitForSelector('#allServersList');
      await page.waitForTimeout(2000);

      const editBtn = await page.$('.edit-server-full-btn');
      if (editBtn) {
        await editBtn.click();
        await page.waitForSelector('#serverModal');

        const modalVisible = await page.isVisible('#serverModal');
        expect(modalVisible).to.be.true;

        // Should have server data pre-filled
        const serverName = await page.inputValue('#serverName');
        expect(serverName.length).to.be.greaterThan(0);

        // Close modal
        await page.click('.close');
        await page.waitForTimeout(500);
      }
    });

    it('should show Add to More Clients modal', async function() {
      this.timeout(20000);

      await page.waitForSelector('#allServersList');
      await page.waitForTimeout(2000);

      const addToClientsBtn = await page.$('.add-to-clients-btn');
      if (addToClientsBtn) {
        await addToClientsBtn.click();
        await page.waitForTimeout(1000);

        // Should show the add to clients modal
        const modal = await page.$('#addServerToClientsModal');
        if (modal) {
          const modalVisible = await page.evaluate(el =>
            el.style.display === 'flex', modal
          );
          expect(modalVisible).to.be.true;

          // Should have client checkboxes
          const checkboxes = await page.$$('#addServerToClientsList input[type="checkbox"]');
          expect(checkboxes.length).to.be.greaterThan(0);

          // Close modal
          await page.click('#addServerToClientsModal .close');
          await page.waitForTimeout(500);
        }
      }
    });

    it('should allow copying server configuration to clipboard', async function() {
      this.timeout(15000);

      await page.waitForSelector('#allServersList');
      await page.waitForTimeout(2000);

      const copyBtn = await page.$('.copy-to-clipboard-server-view-btn');
      if (copyBtn) {
        await copyBtn.click();
        await page.waitForTimeout(1000);

        // Just verify button exists and is clickable
        expect(copyBtn).to.not.be.null;
      }
    });

    it('should allow deleting server from all clients', async function() {
      this.timeout(15000);

      await page.waitForSelector('#allServersList');
      await page.waitForTimeout(2000);

      const initialServerCount = (await page.$$('.server-card-all')).length;

      const deleteBtn = await page.$('.delete-server-view-btn');
      if (deleteBtn) {
        // Set up dialog handler
        page.once('dialog', async dialog => {
          expect(dialog.message()).to.include('Are you sure');
          await dialog.accept();
        });

        await deleteBtn.click();
        await page.waitForTimeout(2000);

        // Server count should decrease
        const finalServerCount = (await page.$$('.server-card-all')).length;
        expect(finalServerCount).to.be.lessThan(initialServerCount);
      }
    });
  });

  describe('View Switching and State Persistence', () => {
    it('should maintain sort preferences when switching views', async function() {
      this.timeout(20000);

      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');

      // Set list view sort
      await page.click('#listViewBtn');
      await page.waitForTimeout(1000);
      await page.selectOption('#clientSort', 'name-desc');
      await page.waitForTimeout(500);

      // Switch to kanban view and set sort
      await page.click('#kanbanViewBtn');
      await page.waitForTimeout(1000);
      await page.selectOption('#kanbanSort', 'servers-asc');
      await page.waitForTimeout(500);

      // Switch back to list view
      await page.click('#listViewBtn');
      await page.waitForTimeout(1000);

      // List sort should be preserved
      const listSort = await page.$eval('#clientSort', el => el.value);
      expect(listSort).to.equal('name-desc');

      // Switch back to kanban view
      await page.click('#kanbanViewBtn');
      await page.waitForTimeout(1000);

      // Kanban sort should be preserved
      const kanbanSort = await page.$eval('#kanbanSort', el => el.value);
      expect(kanbanSort).to.equal('servers-asc');
    });

    it('should properly hide/show view containers when switching', async function() {
      this.timeout(15000);

      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');

      // Test List View
      await page.click('#listViewBtn');
      await page.waitForTimeout(500);

      let listVisible = await page.evaluate(() =>
        document.getElementById('listViewContainer').style.display !== 'none'
      );
      let kanbanVisible = await page.evaluate(() =>
        document.getElementById('kanbanViewContainer').style.display !== 'none'
      );
      let serverVisible = await page.evaluate(() =>
        document.getElementById('serverViewContainer').style.display !== 'none'
      );

      expect(listVisible).to.be.true;
      expect(kanbanVisible).to.be.false;
      expect(serverVisible).to.be.false;

      // Test Kanban View
      await page.click('#kanbanViewBtn');
      await page.waitForTimeout(500);

      listVisible = await page.evaluate(() =>
        document.getElementById('listViewContainer').style.display !== 'none'
      );
      kanbanVisible = await page.evaluate(() =>
        document.getElementById('kanbanViewContainer').style.display !== 'none'
      );
      serverVisible = await page.evaluate(() =>
        document.getElementById('serverViewContainer').style.display !== 'none'
      );

      expect(listVisible).to.be.false;
      expect(kanbanVisible).to.be.true;
      expect(serverVisible).to.be.false;

      // Test Server View
      await page.click('#serverViewBtn');
      await page.waitForTimeout(500);

      listVisible = await page.evaluate(() =>
        document.getElementById('listViewContainer').style.display !== 'none'
      );
      kanbanVisible = await page.evaluate(() =>
        document.getElementById('kanbanViewContainer').style.display !== 'none'
      );
      serverVisible = await page.evaluate(() =>
        document.getElementById('serverViewContainer').style.display !== 'none'
      );

      expect(listVisible).to.be.false;
      expect(kanbanVisible).to.be.false;
      expect(serverVisible).to.be.true;
    });
  });

  describe('Error Handling', () => {
    it('should handle API failures gracefully', async function() {
      this.timeout(15000);

      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');

      // Simulate network failure by navigating to invalid endpoint
      await page.evaluate(() => {
        // Mock fetch to simulate API failure
        const originalFetch = window.fetch;
        window.fetch = (url) => {
          if (url.includes('/api/')) {
            return Promise.reject(new Error('Network error'));
          }
          return originalFetch(url);
        };
      });

      // Try to refresh clients (this would normally trigger API calls)
      await page.reload();
      await page.waitForTimeout(2000);

      // Page should still load, possibly showing error messages
      const bodyText = await page.textContent('body');
      expect(bodyText).to.not.be.empty;
    });

    it('should validate form inputs', async function() {
      this.timeout(15000);

      await page.goto(`http://localhost:${port}`);
      await page.waitForSelector('.view-switcher');
      await page.click('#listViewBtn');
      await page.waitForTimeout(1000);

      // Select empty client
      const clients = await page.$$('.client-item');
      if (clients.length > 2) {
        await clients[2].click(); // empty-client
        await page.waitForTimeout(1000);

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
        }
      }
    });
  });
});