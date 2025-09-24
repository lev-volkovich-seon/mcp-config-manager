import { expect } from 'chai';
import puppeteer from 'puppeteer';
import { startServer, stopServer, setupTestEnvironment, cleanupTestEnvironment, writeMockClientConfig } from './test-utils.js';

describe('Web UI', () => {
  let browser;
  let page;
  let serverProcess;
  const port = 3458; // Use a different port for UI tests

  before(async () => {
    process.env.MCP_USE_MOCK_CLIENTS = 'true'; // Ensure mock clients are used
    await setupTestEnvironment();
    await writeMockClientConfig('test-client-1', { servers: { 'server1': { command: 'echo hello' } } });
    await writeMockClientConfig('test-client-2', { servers: { 'serverA': { command: 'echo world' } } });

    serverProcess = await startServer(port);
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
  }).timeout(10000);

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

  it('should display the main page title', async () => {
    await page.goto(`http://localhost:${port}`);
    const title = await page.title();
    expect(title).to.equal('MCP Config Manager');
  }).timeout(10000);

  it('should display client cards', async () => {
    await page.goto(`http://localhost:${port}`);
    await page.waitForSelector('.client-card');

    const clientCards = await page.$$('.client-card');
    expect(clientCards.length).to.be.at.least(2);

    const client1Title = await page.$eval('#client-test-client-1 .card-title', el => el.textContent);
    expect(client1Title).to.include('Test Client 1');

    const client2Title = await page.$eval('#client-test-client-2 .card-title', el => el.textContent);
    expect(client2Title).to.include('Test Client 2');
  }).timeout(10000);
});