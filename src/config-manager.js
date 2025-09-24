import * as fs from 'fs/promises';
import path from 'path';
import os from 'os';

import { CLIENTS as PROD_CLIENTS } from './clients.js';
import { MOCK_CLIENTS, MOCK_GLOBAL_SERVERS_PATH } from '../test/mock-clients.js';

const USE_MOCK_CLIENTS = process.env.MCP_USE_MOCK_CLIENTS === 'true';
const CLIENTS = USE_MOCK_CLIENTS ? MOCK_CLIENTS : PROD_CLIENTS;
const GLOBAL_SERVERS_PATH = USE_MOCK_CLIENTS ? MOCK_GLOBAL_SERVERS_PATH : path.join(os.homedir(), '.mcp-global-servers.json');

export class MCPConfigManager {
  constructor() {
    this.platform = os.platform();
    this.availableClients = {};
  }

  async readGlobalServers() {
    try {
      const content = await fs.readFile(GLOBAL_SERVERS_PATH, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // If file doesn't exist, return empty object
      return {};
    }
  }

  async writeGlobalServers(globalServers) {
    await fs.writeFile(GLOBAL_SERVERS_PATH, JSON.stringify(globalServers, null, 2));
  }

  async addGlobalServer(serverName, serverConfig) {
    const globalServers = await this.readGlobalServers();
    globalServers[serverName] = serverConfig;
    await this.writeGlobalServers(globalServers);
  }

  async removeGlobalServer(serverName) {
    const globalServers = await this.readGlobalServers();
    delete globalServers[serverName];
    await this.writeGlobalServers(globalServers);
  }

  async updateGlobalServerEnv(serverName, envKey, envValue) {
    const globalServers = await this.readGlobalServers();
    if (!globalServers[serverName]) {
      throw new Error(`Global server ${serverName} not found`);
    }

    if (!globalServers[serverName].env) {
      globalServers[serverName].env = {};
    }

    if (envValue === null || envValue === undefined) {
      delete globalServers[serverName].env[envKey];
    } else {
      globalServers[serverName].env[envKey] = envValue;
    }

    await this.writeGlobalServers(globalServers);
  }

  async getAllServers() {
    return this.readGlobalServers();
  }

  // Helper to generate a consistent hash for a server config
  getServerConfigHash(config) {
    // Exclude env for now, or handle it specially if exact env matching is needed
    const { env, ...rest } = config;
    return JSON.stringify(rest);
  }

  async getServersInClients() {
    const allServers = {}; // serverName: { clients: [{id, name, configPath}], global: boolean, config: {}, configHash: string }
    const globalServers = await this.readGlobalServers();

    // Add global servers first
    for (const [serverName, serverConfig] of Object.entries(globalServers)) {
      allServers[serverName] = {
        clients: [],
        global: true,
        config: serverConfig,
        configHash: this.getServerConfigHash(serverConfig)
      };
    }

    const availableClients = await this.getAvailableClients();

    for (const [clientId, clientInfo] of Object.entries(availableClients)) {
      try {
        const clientConfig = await this.readConfig(clientId);

        for (const [serverName, serverConfig] of Object.entries(clientConfig.servers)) {
          if (!allServers[serverName]) {
            allServers[serverName] = {
              clients: [],
              global: false, // Will be true if it's also in globalServers
              config: serverConfig || {}, // Ensure config is an object
              configHash: this.getServerConfigHash(serverConfig || {})
            };
          }
          allServers[serverName].clients.push({
            id: clientId,
            name: clientInfo.name,
            configPath: this.getConfigPath(clientId)
          });
          // If a server exists globally and in a client, mark it as global
          if (globalServers[serverName]) {
            allServers[serverName].global = true;
          }
        }
      } catch (error) {
        console.error(`Error in getServersInClients for client ${clientId}:`, error);
        // Client config might not exist, or other read error, skip
        console.warn(`Could not read config for client ${clientId}: ${error.message}`);
      }
    }
    return allServers;
  }

  async detectClients() {
    const detectedClients = {};
    for (const [id, client] of Object.entries(CLIENTS)) {
      const configPath = client.configPaths[os.platform()];
      const absoluteConfigPath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
      try {
        await fs.access(absoluteConfigPath, fs.constants.F_OK);
        detectedClients[id] = client;
      } catch (error) {
        // File does not exist or is not accessible, skip this client
      }
    }
    this.availableClients = detectedClients;
    return detectedClients;
  }

  async getAvailableClients() {
    if (Object.keys(this.availableClients).length === 0) {
      await this.detectClients();
    }
    return this.availableClients;
  }

  async listClients() {
    const clientsWithConfigs = [];
    const availableClients = await this.getAvailableClients();

    for (const [key, client] of Object.entries(availableClients)) {
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
        console.error(`Error processing client ${key}:`, error.message);
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

  getConfigPath(client) {
    const clientConfig = CLIENTS[client];
    if (!clientConfig) {
      throw new Error(`Unknown client: ${client}`);
    }

    const platformKey = this.platform === 'darwin' ? 'darwin' :
                       this.platform === 'win32' ? 'win32' : 'linux';

    const configPath = clientConfig.configPaths[platformKey];
    return configPath;
  }

  async readConfig(client) {
    const configPath = this.getConfigPath(client);
    let clientConfig = { servers: {} };

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const parsedContent = JSON.parse(content);
      clientConfig = this.normalizeConfig(parsedContent, CLIENTS[client].format);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // If file doesn't exist, clientConfig remains { servers: {} }
    }

    const globalServers = await this.readGlobalServers();

    // Merge global servers into clientConfig, client-specific overrides global
    const mergedServers = { ...globalServers };
    for (const [serverName, serverDetails] of Object.entries(clientConfig.servers)) {
      mergedServers[serverName] = { ...mergedServers[serverName], ...serverDetails };
    }

    return { servers: mergedServers };
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



  async addServer(client, serverName, serverConfig) {
    const config = await this.readConfig(client);
    config.servers[serverName] = serverConfig;
    await this.writeConfig(client, config);
  }

  async addServerToMultipleClients(serverName, serverConfig, clientIds) {
    const results = [];
    for (const clientId of clientIds) {
      try {
        await this.addServer(clientId, serverName, serverConfig);
        results.push({ client: clientId, server: serverName, success: true });
      } catch (error) {
        results.push({ client: clientId, server: serverName, success: false, error: error.message });
      }
    }
    return results;
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
    }
    else {
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
    }
    else {
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
    }
    else {
      return exportData;
    }
  }

  async importConfig(client, importPath) {
    const content = await fs.readFile(importPath, 'utf-8');
    const importData = JSON.parse(content);

    if (importData.servers) {
      await this.writeConfig(client, { servers: importData.servers });
    }
    else if (importData.config) {
      await this.addServer(client, importData.serverName, importData.config);
    }
    else {
      throw new Error('Invalid import file format');
    }
  }

  async getSupportedClients() {
    const availableClients = await this.getAvailableClients();
    return Object.entries(availableClients).map(([id, client]) => ({
      id,
      name: client.name,
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
            }
            else {
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

  async renameServerAcrossClients(oldName, newName) {
    if (oldName === newName) {
      return { success: true, message: "Server name is the same, no action taken." };
    }

    const results = { global: false, clients: [] };

    // Handle global servers
    const globalServers = await this.readGlobalServers();
    if (globalServers[oldName]) {
      globalServers[newName] = globalServers[oldName];
      delete globalServers[oldName];
      await this.writeGlobalServers(globalServers);
      results.global = true;
    }

    // Handle clients
    const availableClients = await this.getAvailableClients();
    for (const [clientId, clientInfo] of Object.entries(availableClients)) {
      try {
        const config = await this.readConfig(clientId);
        if (config.servers[oldName]) {
          config.servers[newName] = config.servers[oldName];
          delete config.servers[oldName];
          await this.writeConfig(clientId, config);
          results.clients.push({ id: clientId, name: clientInfo.name, success: true });
        } else {
          results.clients.push({ id: clientId, name: clientInfo.name, success: false, message: "Server not found in client config." });
        }
      } catch (error) {
        results.clients.push({ id: clientId, name: clientInfo.name, success: false, error: error.message });
      }
    }
    return results;
  }
}