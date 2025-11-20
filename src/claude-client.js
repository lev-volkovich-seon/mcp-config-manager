import fs from 'fs/promises';
import path from 'path';
import os from 'os';

async function getProjectConfig(projectPath) {
  const configPath = path.join(projectPath, '.mcp.json');
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File not found
    }
    throw error;
  }
}

async function getUserConfig() {
  const homeDir = os.homedir();
  const configPath = path.join(homeDir, '.mcp.json');
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File not found
    }
    throw error;
  }
}

export {
  getProjectConfig,
  getUserConfig,
};
