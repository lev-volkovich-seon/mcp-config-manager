import path from 'path';
import os from 'os';

export const CLIENTS = {
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