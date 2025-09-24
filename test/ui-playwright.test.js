import { expect } from 'chai';
import { chromium } from 'playwright';
import { startServer, stopServer, setupTestEnvironment, cleanupTestEnvironment, writeMockClientConfig } from './test-utils.js';

describe('Web UI - Playwright', () => {
  let browser;
  let page;
  let serverProcess;
  const port = 3459; // Use a different port for UI tests

  before(async function() {
    this.timeout(30000);

    process.env.MCP_USE_MOCK_CLIENTS = 'true';

    console.log('Setting up test environment...');
    await setupTestEnvironment();

    console.log('Creating mock client configs...');
    await writeMockClientConfig('test-client-1', { servers: { 'server1': { command: 'echo hello' } } });
    await writeMockClientConfig('test-client-2', { servers: { 'serverA': { command: 'echo world' } } });
    await writeMockClientConfig('test-client-3', { servers: { 'server3': { command: 'echo test' } } });

    console.log('Starting server...');
    serverProcess = await startServer(port);
    console.log('Server started, waiting for it to be ready...');

    // Give the server a moment to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Server should be ready, launching browser...');

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('Browser launched, creating page...');
    page = await browser.newPage();
    console.log('Setup complete');
  });

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

  it('should display the main page title', async function() {
    this.timeout(10000);

    console.log(`Navigating to http://localhost:${port}...`);
    await page.goto(`http://localhost:${port}`);

    const title = await page.title();
    console.log(`Page title: "${title}"`);
    expect(title).to.equal('MCP Config Manager');
  });

  it('should display client cards', async function() {
    this.timeout(15000);

    // Listen for console messages to debug
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', err => console.error('Page error:', err.message));

    await page.goto(`http://localhost:${port}`);

    // Wait a bit for JavaScript to load and execute
    await page.waitForTimeout(3000);

    console.log('Checking for client cards...');

    // Try to wait for client cards with a longer timeout
    try {
      await page.waitForSelector('.client-card', { timeout: 8000 });
      console.log('Client cards found!');
    } catch (error) {
      console.log('No client cards found, checking page content...');
      const bodyText = await page.textContent('body');
      console.log('Body text (first 200 chars):', bodyText.slice(0, 200));

      // Check if the API call is working by checking network requests
      const clientsResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/clients');
          return await response.json();
        } catch (err) {
          return { error: err.message };
        }
      });
      console.log('API /api/clients response:', JSON.stringify(clientsResponse, null, 2));

      throw error;
    }

    const clientCards = await page.$$('.client-card');
    expect(clientCards.length).to.be.at.least(2);

    const client1Title = await page.textContent('#client-test-client-1 .card-title');
    expect(client1Title).to.include('Test Client 1');

    const client2Title = await page.textContent('#client-test-client-2 .card-title');
    expect(client2Title).to.include('Test Client 2');
  });

  it('should be able to open add server modal', async function() {
    this.timeout(10000);

    await page.goto(`http://localhost:${port}`);
    await page.waitForSelector('.client-card', { timeout: 5000 });

    // Click on first client's add server button
    await page.click('#client-test-client-1 .btn-add-server');

    // Wait for modal to appear
    await page.waitForSelector('#addServerModal', { timeout: 5000 });

    const modalVisible = await page.isVisible('#addServerModal');
    expect(modalVisible).to.be.true;
  });
});