import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { MCPConfigManager } from './config-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manager = new MCPConfigManager();

export function startServer(port = 3456) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // API Routes
  app.get('/api/clients/detect', async (req, res) => {
    try {
      const clients = await manager.detectClients();
      res.json(Object.keys(clients));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/clients', async (req, res) => {
    try {
      const clients = await manager.listClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/servers', async (req, res) => {
    try {
      const servers = await manager.getServersInClients();
      res.json(servers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/clients/:client', async (req, res) => {
    try {
      const config = await manager.readConfig(req.params.client);
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/clients/:client/servers/:server', async (req, res) => {
    try {
      await manager.addServer(req.params.client, req.params.server, req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/servers/add-to-clients', async (req, res) => {
    try {
      const { serverName, serverConfig, clientIds } = req.body;
      if (!serverName || !serverConfig || !clientIds || !Array.isArray(clientIds)) {
        return res.status(400).json({ error: 'Missing serverName, serverConfig, or clientIds' });
      }
      const results = await manager.addServerToMultipleClients(serverName, serverConfig, clientIds);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/clients/:client/servers/:server', async (req, res) => {
    try {
      await manager.removeServer(req.params.client, req.params.server);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/clients/:client/servers/:server', async (req, res) => {
    try {
      const config = await manager.readConfig(req.params.client);
      config.servers[req.params.server] = req.body;
      await manager.writeConfig(req.params.client, config);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/servers/:serverName/env', async (req, res) => {
    try {
      const { envKey, envValue, clientIds } = req.body;
      const serverName = req.params.serverName;

      if (!envKey) {
        return res.status(400).json({ error: 'Missing envKey' });
      }

      let targetServers = null;
      if (clientIds && Array.isArray(clientIds) && clientIds.length > 0) {
        targetServers = clientIds.map(clientId => ({ client: clientId, server: serverName }));
      }

      const results = await manager.updateEnvironmentVariableAcrossConfigs(envKey, envValue, targetServers);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/servers/:oldName/rename', async (req, res) => {
    try {
      const { newName } = req.body;
      const oldName = req.params.oldName;

      if (!newName) {
        return res.status(400).json({ error: 'Missing newName' });
      }

      const results = await manager.renameServerAcrossClients(oldName, newName);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/copy', async (req, res) => {
    try {
      const { fromClient, fromServer, toClient, toServer } = req.body;
      await manager.copyServer(fromClient, fromServer, toClient, toServer);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/export/:client', async (req, res) => {
    try {
      const serverName = req.query.server;
      let result;

      if (serverName) {
        result = await manager.exportServer(req.params.client, serverName);
      } else {
        result = await manager.exportConfig(req.params.client);
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/import/:client', async (req, res) => {
    try {
      const { servers, config, serverName } = req.body;

      if (servers) {
        await manager.writeConfig(req.params.client, { servers });
      } else if (config && serverName) {
        await manager.addServer(req.params.client, serverName, config);
      } else {
        throw new Error('Invalid import data');
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(port, () => {
    console.log(`MCP Config Manager server running on http://localhost:${port}`);
  });

  process.on('uncaughtException', (err) => {
    console.error('Unhandled Exception:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}