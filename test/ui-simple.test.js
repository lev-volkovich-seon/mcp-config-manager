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

describe('Simple UI Test', () => {
  let browser;
  let page;
  let serverProcess;
  const port = 3465;

  before(async function() {
    this.timeout(45000);

    console.log('Setting up environment...');
    process.env.MCP_USE_MOCK_CLIENTS = 'true';
    await setupTestEnvironment();

    console.log('Creating mock configs...');
    await writeMockClientConfig('test-client-1', { servers: { 'server1': { command: 'echo hello' } } });
    await writeMockClientConfig('test-client-2', { servers: { 'serverA': { command: 'echo world' } } });

    console.log('Starting server directly...');
    serverProcess = spawn('node', [SERVER_PATH], {
      env: { ...process.env, PORT: port, MCP_USE_MOCK_CLIENTS: 'true' },
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Wait for server to start
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

    // Additional delay to ensure server is ready
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Testing server directly...');
    try {
      const testResponse = await fetch(`http://localhost:${port}/api/clients`);
      const testData = await testResponse.json();
      console.log('Direct API test successful, clients:', testData.length);
    } catch (error) {
      console.error('Direct API test failed:', error);
      throw new Error('Server not responding to API calls');
    }

    console.log('Starting browser...');
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    console.log('Setup complete');
  });

  after(async () => {
    if (browser) await browser.close();
    if (serverProcess) serverProcess.kill();
    await cleanupTestEnvironment();
    delete process.env.MCP_USE_MOCK_CLIENTS;
  });

  it('should display the page title', async function() {
    this.timeout(15000);

    console.log('Navigating to page...');
    await page.goto(`http://localhost:${port}`);

    console.log('Getting title...');
    const title = await page.title();
    console.log(`Title: "${title}"`);

    expect(title).to.equal('MCP Config Manager');
  });

  it('should load clients via API call in browser', async function() {
    this.timeout(15000);

    await page.goto(`http://localhost:${port}`);

    // Wait for page to load
    await page.waitForTimeout(2000);

    console.log('Testing API call from browser...');
    const clientsData = await page.evaluate(async () => {
      try {
        console.log('Making fetch request...');
        const response = await fetch('/api/clients');
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('API response:', data);
        return { success: true, data, error: null };
      } catch (err) {
        console.log('API error:', err.message);
        return { success: false, data: null, error: err.message };
      }
    });

    console.log('Browser API result:', clientsData);
    expect(clientsData.success).to.be.true;
    expect(clientsData.data).to.be.an('array');
    expect(clientsData.data.length).to.be.at.least(2);
  });
});