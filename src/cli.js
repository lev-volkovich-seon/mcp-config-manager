#!/usr/bin/env node

import { program } from 'commander';
import { MCPConfigManager } from './config-manager.js';

const manager = new MCPConfigManager();

program
  .name('mcp-config-manager')
  .description('CLI to manage MCP configurations across different AI clients')
  .version('1.0.6', '-v, --version', 'output the current version');

program
  .command('list')
  .description('List all supported clients and their config status')
  .action(async () => {
    try {
      const clients = await manager.listClients();
      console.log('\nSupported MCP Clients:\n');

      for (const client of clients) {
        const status = client.exists ? `✓ ${client.serverCount || 0} server(s)` : '✗ No config';
        console.log(`  ${client.name.padEnd(20)} ${status.padEnd(20)} ${client.configPath}`);
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('show <client>')
  .description('Show MCP servers for a client')
  .action(async (client) => {
    try {
      const config = await manager.readConfig(client);
      console.log(`\nMCP Servers for ${client}:\n`);

      if (Object.keys(config.servers).length === 0) {
        console.log('  No servers configured');
      } else {
        for (const [name, server] of Object.entries(config.servers)) {
          console.log(`  ${name}:`);
          console.log(`    Command: ${server.command || 'N/A'}`);
          if (server.args) console.log(`    Args: ${server.args.join(' ')}`);
          if (server.env) {
            console.log(`    Environment variables:`);
            for (const [key, value] of Object.entries(server.env)) {
              const displayValue = value.includes('KEY') || value.includes('SECRET')
                ? value.substring(0, 4) + '***'
                : value;
              console.log(`      ${key}: ${displayValue}`);
            }
          }
          console.log();
        }
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('add <client> <serverName>')
  .description('Add a new MCP server to a client')
  .option('-c, --command <cmd>', 'Command to run the server')
  .option('-a, --args <args...>', 'Arguments for the command')
  .option('-e, --env <env...>', 'Environment variables (key=value)')
  .action(async (client, serverName, options) => {
    try {
      const serverConfig = {};

      if (options.command) serverConfig.command = options.command;
      if (options.args) serverConfig.args = options.args;
      if (options.env) {
        serverConfig.env = {};
        for (const envVar of options.env) {
          const [key, ...valueParts] = envVar.split('=');
          serverConfig.env[key] = valueParts.join('=');
        }
      }

      await manager.addServer(client, serverName, serverConfig);
      console.log(`✓ Added server '${serverName}' to ${client}`);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('remove <client> <serverName>')
  .description('Remove an MCP server from a client (use "all" for client to remove from all)')
  .action(async (client, serverName) => {
    try {
      if (client === 'all') {
        const clients = manager.getSupportedClients();
        let removedCount = 0;

        for (const targetClient of clients) {
          try {
            const config = await manager.readConfig(targetClient.id);
            if (config.servers[serverName]) {
              await manager.removeServer(targetClient.id, serverName);
              console.log(`  ✓ Removed from ${targetClient.name}`);
              removedCount++;
            }
          } catch (err) {
            // Server doesn't exist in this client, skip
          }
        }

        console.log(`\n✓ Removed '${serverName}' from ${removedCount} client(s)`);
      } else {
        await manager.removeServer(client, serverName);
        console.log(`✓ Removed server '${serverName}' from ${client}`);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('copy <fromClient> <serverName> <toClient>')
  .description('Copy an MCP server from one client to another (use "all" for toClient to copy to all)')
  .option('-n, --new-name <name>', 'New name for the copied server')
  .action(async (fromClient, serverName, toClient, options) => {
    try {
      if (toClient === 'all') {
        const clients = manager.getSupportedClients();
        let copiedCount = 0;
        for (const client of clients) {
          if (client.id !== fromClient) {
            try {
              await manager.copyServer(fromClient, serverName, client.id, options.newName);
              console.log(`  ✓ Copied to ${client.name}`);
              copiedCount++;
            } catch (err) {
              console.log(`  ✗ Failed to copy to ${client.name}: ${err.message}`);
            }
          }
        }
        console.log(`\n✓ Copied '${serverName}' to ${copiedCount} client(s)`);
      } else {
        await manager.copyServer(fromClient, serverName, toClient, options.newName);
        const targetName = options.newName || serverName;
        console.log(`✓ Copied '${serverName}' from ${fromClient} to ${toClient} as '${targetName}'`);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('env <client> <serverName> <action> [key] [value]')
  .description('Manage environment variables (action: set|unset|list)')
  .action(async (client, serverName, action, key, value) => {
    try {
      const config = await manager.readConfig(client);
      const server = config.servers[serverName];

      if (!server) {
        console.error(`Server '${serverName}' not found in ${client}`);
        process.exit(1);
      }

      if (action === 'list') {
        console.log(`\nEnvironment variables for ${serverName}:\n`);
        if (server.env) {
          for (const [k, v] of Object.entries(server.env)) {
            const displayValue = v.includes('KEY') || v.includes('SECRET')
              ? v.substring(0, 4) + '***'
              : v;
            console.log(`  ${k}: ${displayValue}`);
          }
        } else {
          console.log('  No environment variables set');
        }
      } else if (action === 'set') {
        if (!key || !value) {
          console.error('Both key and value required for set action');
          process.exit(1);
        }
        await manager.updateServerEnv(client, serverName, key, value);
        console.log(`✓ Set ${key} for server '${serverName}' in ${client}`);
      } else if (action === 'unset') {
        if (!key) {
          console.error('Key required for unset action');
          process.exit(1);
        }
        await manager.updateServerEnv(client, serverName, key, null);
        console.log(`✓ Unset ${key} for server '${serverName}' in ${client}`);
      } else {
        console.error('Invalid action. Use: set, unset, or list');
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('export <client> [output]')
  .description('Export configuration for a client')
  .option('-s, --server <name>', 'Export only a specific server')
  .action(async (client, output, options) => {
    try {
      let result;
      if (options.server) {
        result = await manager.exportServer(client, options.server, output);
      } else {
        result = await manager.exportConfig(client, output);
      }

      if (output) {
        console.log(`✓ Exported to ${output}`);
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('import <client> <file>')
  .description('Import configuration to a client')
  .action(async (client, file) => {
    try {
      await manager.importConfig(client, file);
      console.log(`✓ Imported configuration to ${client}`);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('env-view')
  .description('View all environment variables across all configs (reverse view)')
  .option('-k, --key <key>', 'Filter by specific environment variable key')
  .option('-v, --show-values', 'Show actual values (default: masked)')
  .action(async (options) => {
    try {
      const allEnvVars = await manager.getAllEnvironmentVariables();

      if (allEnvVars.length === 0) {
        console.log('\nNo environment variables found in any configuration.\n');
        return;
      }

      const filteredVars = options.key
        ? allEnvVars.filter(v => v.key.toLowerCase().includes(options.key.toLowerCase()))
        : allEnvVars;

      if (filteredVars.length === 0) {
        console.log(`\nNo environment variables found matching '${options.key}'.\n`);
        return;
      }

      console.log('\nEnvironment Variables Across All Configs:\n');

      for (const envVar of filteredVars) {
        console.log(`  ${envVar.key}:`);

        // Group by value to see which configs share the same value
        const valueGroups = new Map();
        for (const location of envVar.locations) {
          const displayValue = options.showValues
            ? location.value
            : (location.value.includes('KEY') || location.value.includes('SECRET')
              ? location.value.substring(0, 4) + '***'
              : location.value);

          if (!valueGroups.has(displayValue)) {
            valueGroups.set(displayValue, []);
          }
          valueGroups.get(displayValue).push(location);
        }

        // Display grouped by value
        for (const [value, locations] of valueGroups.entries()) {
          console.log(`    Value: ${value}`);
          for (const loc of locations) {
            console.log(`      - ${loc.clientName} / ${loc.server}`);
          }
        }
        console.log();
      }

      console.log(`Total: ${filteredVars.length} environment variable(s)\n`);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('env-update-all <key> [value]')
  .description('Update an environment variable across all configs where it exists')
  .option('-c, --clients <clients...>', 'Only update in specific clients')
  .option('-s, --servers <servers...>', 'Only update in specific servers')
  .option('-d, --dry-run', 'Show what would be updated without making changes')
  .option('--unset', 'Remove the environment variable instead of updating')
  .action(async (key, value, options) => {
    try {
      // First, get all environment variables to see where this key exists
      const allEnvVars = await manager.getAllEnvironmentVariables();
      const targetEnvVar = allEnvVars.find(v => v.key === key);

      if (!targetEnvVar) {
        console.log(`\nEnvironment variable '${key}' not found in any configuration.\n`);
        return;
      }

      // Filter targets based on options
      let targets = targetEnvVar.locations;

      if (options.clients) {
        targets = targets.filter(t => options.clients.includes(t.client));
      }

      if (options.servers) {
        targets = targets.filter(t => options.servers.includes(t.server));
      }

      if (targets.length === 0) {
        console.log('\nNo matching configurations found with the specified filters.\n');
        return;
      }

      // Show what will be updated
      console.log(`\n${options.dryRun ? '[DRY RUN] ' : ''}Updating '${key}':\n`);
      console.log('  Affected configurations:');
      for (const target of targets) {
        const oldDisplay = target.value.includes('KEY') || target.value.includes('SECRET')
          ? target.value.substring(0, 4) + '***'
          : target.value;
        const newDisplay = options.unset ? '(removed)' : value;
        console.log(`    - ${target.clientName} / ${target.server}: ${oldDisplay} → ${newDisplay}`);
      }

      if (options.dryRun) {
        console.log('\n[DRY RUN] No changes were made.\n');
        return;
      }

      // Perform the update
      const actualValue = options.unset ? null : value;
      const results = await manager.updateEnvironmentVariableAcrossConfigs(key, actualValue, targets);

      // Show results
      console.log('\nUpdate Results:');
      let successCount = 0;
      let errorCount = 0;

      for (const result of results) {
        if (result.success) {
          successCount++;
          console.log(`  ✓ ${result.clientName} / ${result.server}`);
        } else {
          errorCount++;
          console.log(`  ✗ ${result.clientName}: ${result.error}`);
        }
      }

      console.log(`\n✓ Updated ${successCount} configuration(s)`);
      if (errorCount > 0) {
        console.log(`✗ Failed to update ${errorCount} configuration(s)`);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('web')
  .description('Start the web UI server')
  .option('-p, --port <port>', 'Port to run the server on', '3456')
  .option('-d, --daemon', 'Run in background as daemon')
  .action(async (options) => {
    if (options.daemon) {
      const { spawn } = await import('child_process');
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const pidFile = path.join(os.tmpdir(), 'mcp-config-manager.pid');

      try {
        // Check if daemon is already running
        const existingPid = await fs.readFile(pidFile, 'utf8');
        const { execSync } = await import('child_process');
        try {
          execSync(`kill -0 ${existingPid}`, { stdio: 'ignore' });
          console.log(`Web UI server already running on port ${options.port} (PID: ${existingPid})`);
          console.log(`Open http://localhost:${options.port} in your browser`);
          return;
        } catch {
          // Process not running, remove stale pid file
          await fs.unlink(pidFile);
        }
      } catch {
        // PID file doesn't exist
      }

      // Start daemon
      const daemon = spawn(process.execPath, [process.argv[1], 'web', '--port', options.port], {
        detached: true,
        stdio: 'ignore'
      });

      daemon.unref();
      await fs.writeFile(pidFile, daemon.pid.toString());

      console.log(`Web UI server started as daemon on port ${options.port} (PID: ${daemon.pid})`);
      console.log(`Open http://localhost:${options.port} in your browser`);
      console.log(`Use 'mcp-config-manager stop' to stop the server`);
    } else {
      console.log(`Starting web UI server on port ${options.port}...`);
      console.log(`Open http://localhost:${options.port} in your browser`);

      const { startServer } = await import('./server.js');
      startServer(parseInt(options.port));
    }
  });

program
  .command('start')
  .description('Start the web UI server in background')
  .option('-p, --port <port>', 'Port to run the server on', '3456')
  .action(async (options) => {
    // Call web command with daemon option
    program.parse([process.argv[0], process.argv[1], 'web', '--daemon', '--port', options.port]);
  });

program
  .command('stop')
  .description('Stop the background web UI server')
  .action(async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    const { execSync } = await import('child_process');

    const pidFile = path.join(os.tmpdir(), 'mcp-config-manager.pid');

    try {
      const pid = await fs.readFile(pidFile, 'utf8');
      execSync(`kill ${pid}`);
      await fs.unlink(pidFile);
      console.log(`Web UI server stopped (PID: ${pid})`);
    } catch (error) {
      console.log('No running web UI server found');
    }
  });

program
  .command('status')
  .description('Check status of background web UI server')
  .action(async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    const { execSync } = await import('child_process');

    const pidFile = path.join(os.tmpdir(), 'mcp-config-manager.pid');

    try {
      const pid = await fs.readFile(pidFile, 'utf8');
      try {
        execSync(`kill -0 ${pid}`, { stdio: 'ignore' });
        console.log(`Web UI server is running (PID: ${pid})`);
        console.log(`Open http://localhost:3456 in your browser`);
      } catch {
        console.log('Web UI server is not running (stale PID file found)');
        await fs.unlink(pidFile);
      }
    } catch {
      console.log('Web UI server is not running');
    }
  });

program.parse();