import { spawn } from 'child_process';
import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs/promises';
import { setupTestEnvironment, cleanupTestEnvironment, writeMockClientConfig, readMockClientConfig } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.join(__dirname, '..', 'src', 'cli.js');

describe('CLI Commands - Comprehensive Tests', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
    // Set up comprehensive test data
    await writeMockClientConfig('claude', {
      servers: {
        'miro': {
          command: 'npx',
          args: ['-y', '@k-jarzyna/mcp-miro'],
          env: { MIRO_ACCESS_TOKEN: 'test-miro-token' }
        },
        'weather': {
          command: 'npx',
          args: ['-y', 'weather-mcp-server'],
          env: { API_KEY: 'weather-key-123' }
        }
      }
    });
    await writeMockClientConfig('vscode', {
      servers: {
        'puppeteer': {
          command: 'npx',
          args: ['-y', 'puppeteer-mcp-server'],
          env: { HEADLESS: 'true' }
        }
      }
    });
    await writeMockClientConfig('gemini', { servers: {} });
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  function runCommand(args, env = {}) {
    return new Promise((resolve, reject) => {
      const cliProcess = spawn('node', [CLI_PATH, ...args], {
        env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true', ...env }
      });

      let stdout = '';
      let stderr = '';

      cliProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      cliProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      cliProcess.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      cliProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  describe('List Command Comprehensive', () => {
    it('should list all clients with detailed server information', async () => {
      const result = await runCommand(['list']);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Supported MCP Clients:');
      expect(result.stdout).to.include('Claude');
      expect(result.stdout).to.include('2 server(s)');
      expect(result.stdout).to.include('VS Code');
      expect(result.stdout).to.include('1 server(s)');
      expect(result.stdout).to.include('Gemini');
      expect(result.stdout).to.include('0 server(s)');
    }).timeout(5000);

    it('should show detailed server information with --verbose flag', async () => {
      const result = await runCommand(['list', '--verbose']);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('miro');
      expect(result.stdout).to.include('weather');
      expect(result.stdout).to.include('puppeteer');
    }).timeout(5000);
  });

  describe('Show Command Comprehensive', () => {
    it('should display detailed server configuration for claude', async () => {
      const result = await runCommand(['show', 'claude']);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Claude Servers:');
      expect(result.stdout).to.include('miro');
      expect(result.stdout).to.include('Command: npx');
      expect(result.stdout).to.include('Args: -y @k-jarzyna/mcp-miro');
      expect(result.stdout).to.include('Environment:');
      expect(result.stdout).to.include('MIRO_ACCESS_TOKEN: ***');

      expect(result.stdout).to.include('weather');
      expect(result.stdout).to.include('weather-mcp-server');
      expect(result.stdout).to.include('API_KEY: ***');
    }).timeout(5000);

    it('should handle non-existent client gracefully', async () => {
      const result = await runCommand(['show', 'non-existent']);

      expect(result.code).to.equal(1);
      expect(result.stderr).to.include('Client "non-existent" not found');
    }).timeout(5000);

    it('should show empty servers message for client with no servers', async () => {
      const result = await runCommand(['show', 'gemini']);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Gemini has no servers configured');
    }).timeout(5000);
  });

  describe('Add Command Comprehensive', () => {
    it('should add a server with command, args, and environment variables', async () => {
      const result = await runCommand([
        'add', 'gemini', 'test-server',
        '-c', 'npx',
        '-a', '-y', 'test-mcp-server',
        '-e', 'API_KEY=test123', 'DEBUG=true'
      ]);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Added server "test-server" to Gemini');

      // Verify server was added
      const config = await readMockClientConfig('gemini');
      expect(config.servers).to.have.property('test-server');
      expect(config.servers['test-server'].command).to.equal('npx');
      expect(config.servers['test-server'].args).to.deep.equal(['-y', 'test-mcp-server']);
      expect(config.servers['test-server'].env).to.deep.equal({
        API_KEY: 'test123',
        DEBUG: 'true'
      });
    }).timeout(5000);

    it('should add a server with minimal configuration', async () => {
      const result = await runCommand([
        'add', 'gemini', 'minimal-server',
        '-c', 'python',
        '-a', 'server.py'
      ]);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Added server "minimal-server" to Gemini');

      const config = await readMockClientConfig('gemini');
      expect(config.servers['minimal-server'].command).to.equal('python');
      expect(config.servers['minimal-server'].args).to.deep.equal(['server.py']);
      expect(config.servers['minimal-server'].env).to.be.undefined;
    }).timeout(5000);

    it('should handle duplicate server names', async () => {
      const result = await runCommand([
        'add', 'claude', 'miro',
        '-c', 'node',
        '-a', 'duplicate.js'
      ]);

      expect(result.code).to.equal(1);
      expect(result.stderr).to.include('Server "miro" already exists');
    }).timeout(5000);

    it('should handle non-existent client', async () => {
      const result = await runCommand([
        'add', 'non-existent', 'test-server',
        '-c', 'echo',
        '-a', 'hello'
      ]);

      expect(result.code).to.equal(1);
      expect(result.stderr).to.include('Client "non-existent" not found');
    }).timeout(5000);
  });

  describe('Remove Command Comprehensive', () => {
    it('should remove a server from a specific client', async () => {
      const result = await runCommand(['remove', 'claude', 'miro']);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Removed server "miro" from Claude');

      const config = await readMockClientConfig('claude');
      expect(config.servers).to.not.have.property('miro');
      expect(config.servers).to.have.property('weather'); // Other servers remain
    }).timeout(5000);

    it('should remove a server from ALL clients', async () => {
      // First add the same server to multiple clients
      await runCommand(['add', 'vscode', 'weather', '-c', 'npx', '-a', '-y', 'weather-server']);

      const result = await runCommand(['remove', 'all', 'weather']);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Removed "weather" from');

      // Verify server was removed from both clients
      const claudeConfig = await readMockClientConfig('claude');
      const vscodeConfig = await readMockClientConfig('vscode');

      expect(claudeConfig.servers).to.not.have.property('weather');
      expect(vscodeConfig.servers).to.not.have.property('weather');
    }).timeout(5000);

    it('should handle non-existent server gracefully', async () => {
      const result = await runCommand(['remove', 'claude', 'non-existent']);

      expect(result.code).to.equal(1);
      expect(result.stderr).to.include('Server "non-existent" not found in Claude');
    }).timeout(5000);
  });

  describe('Copy Command Comprehensive', () => {
    it('should copy a server between specific clients', async () => {
      const result = await runCommand(['copy', 'claude', 'miro', 'gemini']);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Copied server "miro" from Claude to Gemini');

      const geminiConfig = await readMockClientConfig('gemini');
      expect(geminiConfig.servers).to.have.property('miro');
      expect(geminiConfig.servers.miro.command).to.equal('npx');
      expect(geminiConfig.servers.miro.env.MIRO_ACCESS_TOKEN).to.equal('test-miro-token');
    }).timeout(5000);

    it('should copy a server to ALL other clients', async () => {
      const result = await runCommand(['copy', 'claude', 'weather', 'all']);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Copied server "weather" from Claude to all other clients');

      const vscodeConfig = await readMockClientConfig('vscode');
      const geminiConfig = await readMockClientConfig('gemini');

      expect(vscodeConfig.servers).to.have.property('weather');
      expect(geminiConfig.servers).to.have.property('weather');

      expect(vscodeConfig.servers.weather.env.API_KEY).to.equal('weather-key-123');
      expect(geminiConfig.servers.weather.env.API_KEY).to.equal('weather-key-123');
    }).timeout(5000);

    it('should handle copying non-existent server', async () => {
      const result = await runCommand(['copy', 'claude', 'non-existent', 'gemini']);

      expect(result.code).to.equal(1);
      expect(result.stderr).to.include('Server "non-existent" not found in Claude');
    }).timeout(5000);

    it('should handle copying to same client', async () => {
      const result = await runCommand(['copy', 'claude', 'miro', 'claude']);

      expect(result.code).to.equal(1);
      expect(result.stderr).to.include('Cannot copy server to the same client');
    }).timeout(5000);
  });

  describe('Environment Variable Management', () => {
    it('should set environment variables for a server', async () => {
      const result = await runCommand(['env', 'claude', 'miro', 'set', 'NEW_VAR', 'new-value']);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Set NEW_VAR=new-value for server "miro" in Claude');

      const config = await readMockClientConfig('claude');
      expect(config.servers.miro.env.NEW_VAR).to.equal('new-value');
      expect(config.servers.miro.env.MIRO_ACCESS_TOKEN).to.equal('test-miro-token'); // Existing vars remain
    }).timeout(5000);

    it('should unset environment variables from a server', async () => {
      const result = await runCommand(['env', 'claude', 'miro', 'unset', 'MIRO_ACCESS_TOKEN']);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Unset MIRO_ACCESS_TOKEN for server "miro" in Claude');

      const config = await readMockClientConfig('claude');
      expect(config.servers.miro.env).to.not.have.property('MIRO_ACCESS_TOKEN');
    }).timeout(5000);

    it('should list environment variables for a server', async () => {
      const result = await runCommand(['env', 'claude', 'weather', 'list']);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Environment variables for "weather" in Claude:');
      expect(result.stdout).to.include('API_KEY: ***');
    }).timeout(5000);

    it('should handle non-existent server for env commands', async () => {
      const result = await runCommand(['env', 'claude', 'non-existent', 'list']);

      expect(result.code).to.equal(1);
      expect(result.stderr).to.include('Server "non-existent" not found in Claude');
    }).timeout(5000);
  });

  describe('Export/Import Commands', () => {
    it('should export client configuration', async () => {
      const exportPath = path.join(__dirname, 'test-export.json');
      const result = await runCommand(['export', 'claude', exportPath]);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Exported Claude configuration to');

      // Verify export file exists and contains correct data
      const exportData = JSON.parse(await fs.readFile(exportPath, 'utf8'));
      expect(exportData.servers).to.have.property('miro');
      expect(exportData.servers).to.have.property('weather');

      // Cleanup
      await fs.unlink(exportPath);
    }).timeout(5000);

    it('should export specific server configuration', async () => {
      const exportPath = path.join(__dirname, 'test-server-export.json');
      const result = await runCommand(['export', 'claude', '--server', 'miro', exportPath]);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Exported server "miro" configuration to');

      // Verify export contains only the specified server
      const exportData = JSON.parse(await fs.readFile(exportPath, 'utf8'));
      expect(exportData).to.have.property('name', 'miro');
      expect(exportData.config.command).to.equal('npx');

      // Cleanup
      await fs.unlink(exportPath);
    }).timeout(5000);

    it('should import client configuration', async () => {
      // First, create an export file
      const importData = {
        servers: {
          'imported-server': {
            command: 'python',
            args: ['imported.py'],
            env: { IMPORT_KEY: 'imported-value' }
          }
        }
      };

      const importPath = path.join(__dirname, 'test-import.json');
      await fs.writeFile(importPath, JSON.stringify(importData, null, 2));

      const result = await runCommand(['import', 'gemini', importPath]);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Imported configuration to Gemini');

      // Verify import
      const config = await readMockClientConfig('gemini');
      expect(config.servers).to.have.property('imported-server');
      expect(config.servers['imported-server'].command).to.equal('python');

      // Cleanup
      await fs.unlink(importPath);
    }).timeout(5000);

    it('should handle invalid import file', async () => {
      const invalidPath = path.join(__dirname, 'non-existent.json');
      const result = await runCommand(['import', 'claude', invalidPath]);

      expect(result.code).to.equal(1);
      expect(result.stderr).to.include('Error importing');
    }).timeout(5000);
  });

  describe('Web Server Command', () => {
    it('should start web server with custom port', async () => {
      const webProcess = spawn('node', [CLI_PATH, 'web', '--port', '3461'], {
        env: { ...process.env, MCP_USE_MOCK_CLIENTS: 'true' }
      });

      let output = '';
      webProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      // Wait for server to start
      await new Promise((resolve) => {
        webProcess.stdout.on('data', (data) => {
          if (data.toString().includes('Server running')) {
            resolve();
          }
        });
      });

      expect(output).to.include('Server running on http://localhost:3461');

      // Cleanup
      webProcess.kill('SIGTERM');
    }).timeout(10000);
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle unknown commands gracefully', async () => {
      const result = await runCommand(['unknown-command']);

      expect(result.code).to.equal(1);
      expect(result.stderr).to.include('unknown command');
    }).timeout(5000);

    it('should handle missing required arguments', async () => {
      const result = await runCommand(['add']);

      expect(result.code).to.equal(1);
      // Should show help or error about missing arguments
    }).timeout(5000);

    it('should handle invalid client names', async () => {
      const result = await runCommand(['show', '']);

      expect(result.code).to.equal(1);
      expect(result.stderr).to.include('not found');
    }).timeout(5000);

    it('should handle corrupted config files gracefully', async () => {
      // Write invalid JSON to a mock config
      const mockConfigDir = path.join(__dirname, '..', '.test-configs');
      const corruptedConfigPath = path.join(mockConfigDir, 'corrupted.json');
      await fs.writeFile(corruptedConfigPath, '{ invalid json }');

      // This should not crash the CLI
      const result = await runCommand(['list']);
      expect(result.code).to.equal(0); // Should still work for valid configs
    }).timeout(5000);
  });

  describe('Help and Version Commands', () => {
    it('should display help information', async () => {
      const result = await runCommand(['--help']);

      expect(result.code).to.equal(0);
      expect(result.stdout).to.include('Usage:');
      expect(result.stdout).to.include('Commands:');
      expect(result.stdout).to.include('list');
      expect(result.stdout).to.include('add');
      expect(result.stdout).to.include('remove');
    }).timeout(5000);

    it('should display version information', async () => {
      const result = await runCommand(['--version']);

      expect(result.code).to.equal(0);
      // Should contain version number
      expect(result.stdout).to.match(/\d+\.\d+\.\d+/);
    }).timeout(5000);
  });
});