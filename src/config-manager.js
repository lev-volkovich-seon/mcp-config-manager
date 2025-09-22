import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const CLIENTS = {
  claude: {
    name: 'Claude Desktop',
    configPaths: {
      darwin: path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json'),
      win32: path.join(process.env.APPDATA || '', 'Claude/claude_desktop_config.json'),
      linux: path.join(os.homedir(), '.config/Claude/claude_desktop_config.json')
    },
    format: 'mcpServers'
  },
  'claude-code': {
    name: 'Claude Code',
    configPaths: {
      darwin: '.mcp.json',
      win32: '.mcp.json',
      linux: '.mcp.json'
    },
    format: 'mcpServers'
  },
  vscode: {
    name: 'VS Code',
    configPaths: {
      darwin: '.vscode/mcp.json',
      win32: '.vscode/mcp.json',
      linux: '.vscode/mcp.json'
    },
    format: 'mcp.servers'
  },
  cursor: {
    name: 'Cursor',
    configPaths: {
      darwin: '.cursor/mcp.json',
      win32: '.cursor/mcp.json',
      linux: '.cursor/mcp.json'
    },
    format: 'mcpServers'
  },
  gemini: {
    name: 'Gemini',
    configPaths: {
      darwin: path.join(os.homedir(), '.gemini/settings.json'),
      win32: path.join(os.homedir(), '.gemini/settings.json'),
      linux: path.join(os.homedir(), '.gemini/settings.json')
    },
    format: 'mcpServers'
  },
  windsurf: {
    name: 'Windsurf',
    configPaths: {
      darwin: path.join(os.homedir(), '.codeium/windsurf/mcp_config.json'),
      win32: path.join(os.homedir(), '.codeium/windsurf/mcp_config.json'),
      linux: path.join(os.homedir(), '.codeium/windsurf/mcp_config.json')
    },
    format: 'mcpServers'
  },
  amazonq: {
    name: 'Amazon Q Developer',
    configPaths: {
      darwin: path.join(os.homedir(), '.aws/amazonq/mcp.json'),
      win32: path.join(os.homedir(), '.aws/amazonq/mcp.json'),
      linux: path.join(os.homedir(), '.aws/amazonq/mcp.json')
    },
    format: 'mcpServers'
  }
};

export class MCPConfigManager {
  constructor() {
    this.platform = os.platform();
  }

  getConfigPath(client) {
    const clientConfig = CLIENTS[client];
    if (!clientConfig) {
      throw new Error(`Unknown client: ${client}`);
    }

    const platformKey = this.platform === 'darwin' ? 'darwin' :
                       this.platform === 'win32' ? 'win32' : 'linux';

    return clientConfig.configPaths[platformKey];
  }

  async readConfig(client) {
    const configPath = this.getConfigPath(client);

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);
      return this.normalizeConfig(config, CLIENTS[client].format);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { servers: {} };
      }
      throw error;
    }
  }

  normalizeConfig(config, format) {
    if (format === 'mcpServers') {
      return { servers: config.mcpServers || {} };
    } else if (format === 'mcp.servers') {
      return { servers: config.mcp?.servers || {} };
    }
    return { servers: {} };
  }

  denormalizeConfig(normalizedConfig, format, originalConfig = {}) {
    if (format === 'mcpServers') {
      return { ...originalConfig, mcpServers: normalizedConfig.servers };
    } else if (format === 'mcp.servers') {
      return {
        ...originalConfig,
        mcp: {
          ...(originalConfig.mcp || {}),
          servers: normalizedConfig.servers
        }
      };
    }
    return originalConfig;
  }

  async writeConfig(client, config) {
    const configPath = this.getConfigPath(client);
    const clientConfig = CLIENTS[client];

    let originalConfig = {};
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      originalConfig = JSON.parse(content);
    } catch (error) {
      // File doesn't exist, that's OK
    }

    const finalConfig = this.denormalizeConfig(config, clientConfig.format, originalConfig);

    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(finalConfig, null, 2));
  }

  async listClients() {
    const clientsWithConfigs = [];

    for (const [key, client] of Object.entries(CLIENTS)) {
      try {
        const config = await this.readConfig(key);
        const serverCount = Object.keys(config.servers).length;
        clientsWithConfigs.push({
          id: key,
          name: client.name,
          configPath: this.getConfigPath(key),
          serverCount,
          exists: true
        });
      } catch (error) {
        clientsWithConfigs.push({
          id: key,
          name: client.name,
          configPath: this.getConfigPath(key),
          serverCount: 0,
          exists: false
        });
      }
    }

    return clientsWithConfigs;
  }

  async addServer(client, serverName, serverConfig) {
    const config = await this.readConfig(client);
    config.servers[serverName] = serverConfig;
    await this.writeConfig(client, config);
  }

  async removeServer(client, serverName) {
    const config = await this.readConfig(client);
    delete config.servers[serverName];
    await this.writeConfig(client, config);
  }

  async updateServerEnv(client, serverName, envKey, envValue) {
    const config = await this.readConfig(client);
    if (!config.servers[serverName]) {
      throw new Error(`Server ${serverName} not found in ${client}`);
    }

    if (!config.servers[serverName].env) {
      config.servers[serverName].env = {};
    }

    if (envValue === null || envValue === undefined) {
      delete config.servers[serverName].env[envKey];
    } else {
      config.servers[serverName].env[envKey] = envValue;
    }

    await this.writeConfig(client, config);
  }

  async copyServer(fromClient, fromServerName, toClient, toServerName = null) {
    const fromConfig = await this.readConfig(fromClient);
    const serverConfig = fromConfig.servers[fromServerName];

    if (!serverConfig) {
      throw new Error(`Server ${fromServerName} not found in ${fromClient}`);
    }

    const targetName = toServerName || fromServerName;
    await this.addServer(toClient, targetName, serverConfig);
  }

  async exportConfig(client, outputPath = null) {
    const config = await this.readConfig(client);
    const exportData = {
      client,
      timestamp: new Date().toISOString(),
      servers: config.servers
    };

    if (outputPath) {
      await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
      return outputPath;
    } else {
      return exportData;
    }
  }

  async exportServer(client, serverName, outputPath = null) {
    const config = await this.readConfig(client);
    const serverConfig = config.servers[serverName];

    if (!serverConfig) {
      throw new Error(`Server ${serverName} not found in ${client}`);
    }

    const exportData = {
      client,
      serverName,
      timestamp: new Date().toISOString(),
      config: serverConfig
    };

    if (outputPath) {
      await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
      return outputPath;
    } else {
      return exportData;
    }
  }

  async importConfig(client, importPath) {
    const content = await fs.readFile(importPath, 'utf-8');
    const importData = JSON.parse(content);

    if (importData.servers) {
      await this.writeConfig(client, { servers: importData.servers });
    } else if (importData.config) {
      await this.addServer(client, importData.serverName, importData.config);
    } else {
      throw new Error('Invalid import file format');
    }
  }

  getSupportedClients() {
    return Object.entries(CLIENTS).map(([id, client]) => ({
      id,
      name: client.name,
      configPath: this.getConfigPath(id)
    }));
  }

  async getAllEnvironmentVariables() {
    const envVarMap = new Map();

    for (const [clientId, clientInfo] of Object.entries(CLIENTS)) {
      try {
        const config = await this.readConfig(clientId);

        for (const [serverName, serverConfig] of Object.entries(config.servers)) {
          if (serverConfig.env) {
            for (const [envKey, envValue] of Object.entries(serverConfig.env)) {
              if (!envVarMap.has(envKey)) {
                envVarMap.set(envKey, {
                  key: envKey,
                  locations: []
                });
              }

              envVarMap.get(envKey).locations.push({
                client: clientId,
                clientName: clientInfo.name,
                server: serverName,
                value: envValue
              });
            }
          }
        }
      } catch (error) {
        // Skip clients without configs
      }
    }

    return Array.from(envVarMap.values()).sort((a, b) => a.key.localeCompare(b.key));
  }

  async updateEnvironmentVariableAcrossConfigs(envKey, newValue, targetServers = null) {
    const results = [];

    for (const [clientId, clientInfo] of Object.entries(CLIENTS)) {
      try {
        const config = await this.readConfig(clientId);
        let configModified = false;

        for (const [serverName, serverConfig] of Object.entries(config.servers)) {
          if (serverConfig.env && serverConfig.env.hasOwnProperty(envKey)) {
            // If targetServers is specified, only update those
            if (targetServers && !targetServers.some(t =>
              t.client === clientId && t.server === serverName)) {
              continue;
            }

            const oldValue = serverConfig.env[envKey];

            if (newValue === null || newValue === undefined) {
              delete serverConfig.env[envKey];
            } else {
              serverConfig.env[envKey] = newValue;
            }

            configModified = true;

            results.push({
              client: clientId,
              clientName: clientInfo.name,
              server: serverName,
              oldValue,
              newValue,
              success: true
            });
          }
        }

        if (configModified) {
          await this.writeConfig(clientId, config);
        }
      } catch (error) {
        results.push({
          client: clientId,
          clientName: clientInfo.name,
          error: error.message,
          success: false
        });
      }
    }

    return results;
  }
}