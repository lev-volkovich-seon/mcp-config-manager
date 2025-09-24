import { spawn } from 'child_process';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs/promises';
import { setupTestEnvironment, cleanupTestEnvironment, writeMockClientConfig, readMockClientConfig } from './test-utils.js';
import { MOCK_CLIENTS } from './mock-clients.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.join(__dirname, '..', 'src', 'cli.js');

describe('CLI Commands', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    // Ensure some mock client configs exist for listing and other operations
    await writeMockClientConfig('test-client-1', { servers: { 'server1': { command: 'echo hello', env: { 'API_KEY': '123', 'DEBUG': 'true' } } } });
    await writeMockClientConfig('test-client-2', { servers: { 'serverA': { command: 'echo world', env: { 'API_KEY': '456', 'NODE_ENV': 'development' } } } });
    await writeMockClientConfig('test-client-3', { servers: { 'serverB': { command: 'npm test', env: { 'TEST_VAR': 'abc' } } } });
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  it('should list supported clients', (done) => {
    const cliProcess = spawn('node', [CLI_PATH, 'list'], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', (code) => {
      expect(code).to.equal(0);
      expect(output).to.include('Supported MCP Clients:');
      expect(output).to.include('Test Client 1');
      expect(output).to.include('Test Client 2');
      expect(output).to.include('Test Client 3');
      expect(output).to.include('✓ 1 server(s)');
      done();
    });
  }).timeout(5000);

  it('should show MCP servers for a client', (done) => {
    const cliProcess = spawn('node', [CLI_PATH, 'show', 'test-client-1'], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', (code) => {
      expect(code).to.equal(0);
      expect(output).to.include('MCP Servers for test-client-1:');
      expect(output).to.include('server1:');
      expect(output).to.include('Command: echo hello');
      expect(output).to.include('API_KEY: 123');
      expect(output).to.include('DEBUG: true');
      done();
    });
  }).timeout(5000);

  it('should add a new MCP server to a client', (done) => {
    const cliProcess = spawn('node', [CLI_PATH, 'add', 'test-client-1', 'newServer', '--command', 'npm start', '--args', '--port', '8080', '--env', 'API_KEY=123', 'DEBUG=true'], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', async (code) => {
      expect(code).to.equal(0);
      expect(output).to.include('✓ Added server \'newServer\' to test-client-1');

      const config = await readMockClientConfig('test-client-1');
      expect(config.servers).to.have.property('newServer');
      expect(config.servers.newServer.command).to.equal('npm start');
      expect(config.servers.newServer.args).to.deep.equal(['--port', '8080']);
      expect(config.servers.newServer.env).to.deep.equal({ API_KEY: '123', DEBUG: 'true' });
      done();
    });
  }).timeout(5000);

  it('should remove an MCP server from a client', (done) => {
    const cliProcess = spawn('node', [CLI_PATH, 'remove', 'test-client-1', 'server1'], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', async (code) => {
      expect(code).to.equal(0);
      expect(output).to.include('✓ Removed server \'server1\' from test-client-1');

      const config = await readMockClientConfig('test-client-1');
      expect(config.servers).to.not.have.property('server1');
      done();
    });
  }).timeout(5000);

  it('should copy an MCP server from one client to another', (done) => {
    const cliProcess = spawn('node', [CLI_PATH, 'copy', 'test-client-1', 'server1', 'test-client-2', '--new-name', 'copiedServer'], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', async (code) => {
      expect(code).to.equal(0);
      expect(output).to.include('✓ Copied \'server1\' from test-client-1 to test-client-2 as \'copiedServer\'');

      const config1 = await readMockClientConfig('test-client-1');
      const config2 = await readMockClientConfig('test-client-2');

      expect(config1.servers).to.have.property('server1');
      expect(config2.servers).to.have.property('copiedServer');
      expect(config2.servers.copiedServer.command).to.equal(config1.servers.server1.command);
      done();
    });
  }).timeout(5000);

  it('should list environment variables for a server', (done) => {
    const cliProcess = spawn('node', [CLI_PATH, 'env', 'test-client-1', 'server1', 'list'], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', (code) => {
      expect(code).to.equal(0);
      expect(output).to.include('Environment variables for server1:');
      expect(output).to.include('API_KEY: 123');
      expect(output).to.include('DEBUG: true');
      done();
    });
  }).timeout(5000);

  it('should set an environment variable for a server', (done) => {
    const cliProcess = spawn('node', [CLI_PATH, 'env', 'test-client-1', 'server1', 'set', 'NEW_VAR', 'newValue'], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', async (code) => {
      expect(code).to.equal(0);
      expect(output).to.include('✓ Set NEW_VAR for server \'server1\' in test-client-1');

      const config = await readMockClientConfig('test-client-1');
      expect(config.servers.server1.env).to.have.property('NEW_VAR').that.equals('newValue');
      done();
    });
  }).timeout(5000);

  it('should unset an environment variable for a server', (done) => {
    const cliProcess = spawn('node', [CLI_PATH, 'env', 'test-client-1', 'server1', 'unset', 'API_KEY'], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', async (code) => {
      expect(code).to.equal(0);
      expect(output).to.include('✓ Unset API_KEY for server \'server1\' in test-client-1');

      const config = await readMockClientConfig('test-client-1');
      expect(config.servers.server1.env).to.not.have.property('API_KEY');
      expect(config.servers.server1.env).to.have.property('DEBUG'); // Ensure other vars are untouched
      done();
    });
  }).timeout(5000);

  it('should export client configuration to stdout', (done) => {
    const cliProcess = spawn('node', [CLI_PATH, 'export', 'test-client-1'], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', (code) => {
      expect(code).to.equal(0);
      const exportedConfig = JSON.parse(output);
      expect(exportedConfig).to.have.property('client').that.equals('test-client-1');
      expect(exportedConfig).to.have.property('servers');
      expect(exportedConfig.servers).to.have.property('server1');
      done();
    });
  }).timeout(5000);

  it('should export client configuration to a file', (done) => {
    const exportFilePath = path.join(__dirname, 'temp-export.json');
    const cliProcess = spawn('node', [CLI_PATH, 'export', 'test-client-1', exportFilePath], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', async (code) => {
      expect(code).to.equal(0);
      expect(output).to.include(`✓ Exported to ${exportFilePath}`);

      const content = await fs.readFile(exportFilePath, 'utf-8');
      const exportedConfig = JSON.parse(content);
      expect(exportedConfig).to.have.property('client').that.equals('test-client-1');
      expect(exportedConfig.servers).to.have.property('server1');

      await fs.unlink(exportFilePath); // Clean up the exported file
      done();
    });
  }).timeout(5000);

  it('should export a specific server configuration to stdout', (done) => {
    const cliProcess = spawn('node', [CLI_PATH, 'export', 'test-client-1', '--server', 'server1'], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', (code) => {
      expect(code).to.equal(0);
      const exportedServer = JSON.parse(output);
      expect(exportedServer).to.have.property('client').that.equals('test-client-1');
      expect(exportedServer).to.have.property('serverName').that.equals('server1');
      expect(exportedServer).to.have.property('config');
      expect(exportedServer.config).to.have.property('command').that.equals('echo hello');
      done();
    });
  }).timeout(5000);

  it('should import configuration from a file', (done) => {
    const importFilePath = path.join(__dirname, 'temp-import.json');
    const importContent = {
      client: 'test-client-1',
      servers: {
        'importedServer': {
          command: 'imported command',
          env: { 'IMPORTED_VAR': 'true' }
        }
      }
    };

    fs.writeFile(importFilePath, JSON.stringify(importContent, null, 2))
      .then(() => {
        const cliProcess = spawn('node', [CLI_PATH, 'import', 'test-client-1', importFilePath], {
          env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
        });
        let output = '';

        cliProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        cliProcess.stderr.on('data', (data) => {
          // console.error(`stderr: ${data}`);
        });

        cliProcess.on('close', async (code) => {
          expect(code).to.equal(0);
          expect(output).to.include('✓ Imported configuration to test-client-1');

          const config = await readMockClientConfig('test-client-1');
          expect(config.servers).to.have.property('importedServer');
          expect(config.servers.importedServer.command).to.equal('imported command');
          expect(config.servers.importedServer.env).to.have.property('IMPORTED_VAR').that.equals('true');

          await fs.unlink(importFilePath); // Clean up the imported file
          done();
        });
      })
      .catch(done);
  }).timeout(5000);

  it('should view all environment variables across all configs', (done) => {
    const cliProcess = spawn('node', [CLI_PATH, 'env-view'], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', (code) => {
      expect(code).to.equal(0);
      expect(output).to.include('Environment Variables Across All Configs:');
      expect(output).to.include('API_KEY:');
      expect(output).to.include('Value: 123');
      expect(output).to.include('Value: 456');
      expect(output).to.include('DEBUG:');
      expect(output).to.include('Value: true');
      expect(output).to.include('NODE_ENV:');
      expect(output).to.include('Value: development');
      expect(output).to.include('TEST_VAR:');
      expect(output).to.include('Value: abc');
      done();
    });
  }).timeout(5000);

  it('should view filtered environment variables across all configs', (done) => {
    const cliProcess = spawn('node', [CLI_PATH, 'env-view', '--key', 'API_KEY'], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', (code) => {
      expect(code).to.equal(0);
      expect(output).to.include('Environment Variables Across All Configs:');
      expect(output).to.include('API_KEY:');
      expect(output).to.include('Value: 123');
      expect(output).to.include('Value: 456');
      expect(output).to.not.include('DEBUG:');
      expect(output).to.not.include('NODE_ENV:');
      expect(output).to.not.include('TEST_VAR:');
      done();
    });
  }).timeout(5000);

  it('should update an environment variable across all configs', (done) => {
    const cliProcess = spawn('node', [CLI_PATH, 'env-update-all', 'API_KEY', 'NEW_API_KEY'], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', async (code) => {
      expect(code).to.equal(0);
      expect(output).to.include('✓ Updated 2 configuration(s)');

      const config1 = await readMockClientConfig('test-client-1');
      const config2 = await readMockClientConfig('test-client-2');

      expect(config1.servers.server1.env.API_KEY).to.equal('NEW_API_KEY');
      expect(config2.servers.serverA.env.API_KEY).to.equal('NEW_API_KEY');
      done();
    });
  }).timeout(5000);

  it('should unset an environment variable across all configs', (done) => {
    const cliProcess = spawn('node', [CLI_PATH, 'env-update-all', 'API_KEY', '--unset'], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    cliProcess.on('close', async (code) => {
      expect(code).to.equal(0);
      expect(output).to.include('✓ Updated 2 configuration(s)');

      const config1 = await readMockClientConfig('test-client-1');
      const config2 = await readMockClientConfig('test-client-2');

      expect(config1.servers.server1.env).to.not.have.property('API_KEY');
      expect(config2.servers.serverA.env).to.not.have.property('API_KEY');
      done();
    });
  }).timeout(5000);

  it('should start the web UI server', (done) => {
    const port = 3457; // Use a different port to avoid conflicts
    const cliProcess = spawn('node', [CLI_PATH, 'web', '--port', port.toString()], {
      env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
    });
    let output = '';
    let serverStarted = false;

    cliProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes(`server running on http://localhost:${port}`)) {
        serverStarted = true;
      }
    });

    cliProcess.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`);
    });

    const checkServer = () => {
      if (serverStarted) {
        // Server started, now try to make a request
        fetch(`http://localhost:${port}/api/clients`)
          .then(res => {
            expect(res.status).to.equal(200);
            return res.json();
          })
          .then(data => {
            expect(data).to.be.an('array');
            expect(data.length).to.be.at.least(2); // Expect at least test-client-1 and test-client-2
            cliProcess.kill(); // Stop the server
            done();
          })
          .catch(err => {
            cliProcess.kill(); // Stop the server
            done(err);
          });
      } else {
        setTimeout(checkServer, 500); // Check again after 500ms
      }
    };

    checkServer();

    cliProcess.on('close', (code) => {
      if (code !== 0 && code !== null) {
        // If the process exited with an error before server started, fail the test
        if (!serverStarted) {
          done(new Error(`Web server exited with code ${code} before starting.`));
        }
      }
    });
  }).timeout(10000); // Increased timeout for web server test
});