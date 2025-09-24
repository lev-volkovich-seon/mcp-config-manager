import { listClientsApi, getClientConfigApi, deleteServerApi } from './api.js';
import { showServerModal, copyServer, copyToClipboard, exportServer, deleteServer, removeFromAll, updateBulkActions, selectAllServers, deselectAllServers, deleteSelected } from './modals.js';

let currentClient = null;
let clients = [];
let loadClientsCallback = null; // Callback to main.js to reload all clients

export function initClientView(allClients, currentClientId, loadClientsFn) {
    clients = allClients;
    currentClient = currentClientId;
    loadClientsCallback = loadClientsFn;
}

export function renderClientList() {
    const clientList = document.getElementById('clientList');
    clientList.innerHTML = '';

    const clientSort = document.getElementById('clientSort');
    let sortBy = localStorage.getItem('clientSortBy') || 'name-asc';
    if (clientSort) {
        clientSort.value = sortBy;
    }

    const sortedClients = [...clients].sort((a, b) => {
        if (sortBy === 'name-asc') {
            return a.name.localeCompare(b.name);
        } else if (sortBy === 'name-desc') {
            return b.name.localeCompare(a.name);
        } else if (sortBy === 'servers-asc') {
            return (a.serverCount || 0) - (b.serverCount || 0);
        } else if (sortBy === 'servers-desc') {
            return (b.serverCount || 0) - (a.serverCount || 0);
        }
        return 0;
    });

    sortedClients.forEach(client => {
        const item = document.createElement('div');
        item.className = 'client-item';
        if (client.id === currentClient) {
            item.classList.add('active');
        }

        item.innerHTML = `
            <div class="client-name">${client.name}</div>
            <div class="client-status">
                ${client.exists ? `${client.serverCount} server(s)` : 'No config'}
            </div>
        `;

        item.addEventListener('click', () => selectClient(client.id));
        clientList.appendChild(item);
    });

    if (clientSort) {
        clientSort.onchange = () => {
            localStorage.setItem('clientSortBy', clientSort.value);
            renderClientList();
        };
    }
}

export async function selectClient(clientId) {
    currentClient = clientId;
    // Update the global currentClient in main.js
    if (window.setCurrentClient) {
        window.setCurrentClient(clientId);
    }
    renderClientList();

    const welcomeView = document.getElementById('welcomeView');
    const clientView = document.getElementById('clientView');

    welcomeView.style.display = 'none';
    clientView.style.display = 'block';

    const client = clients.find(c => c.id === clientId);
    document.getElementById('clientName').textContent = client.name;
    document.getElementById('configPath').textContent = client.configPath;

    await loadClientServers();
}

export async function loadClientServers() {
    try {
        const config = await getClientConfigApi(currentClient);
        renderServerList(config.servers || {});
    } catch (error) {
        console.error('Failed to load servers:', error);
        renderServerList({});
    }
}

function renderServerList(servers) {
    const serverList = document.getElementById('serverList');

    if (Object.keys(servers).length === 0) {
        serverList.innerHTML = '<p style="color: #7f8c8d;">No servers configured</p>';
        return;
    }

    // Add bulk actions toolbar
    serverList.innerHTML = `
        <div id="bulkActions" class="bulk-actions" style="display: none;">
            <span id="selectedCount">0 selected</span>
            <button class="btn btn-small btn-danger" id="deleteSelectedBtn">Delete Selected</button>
            <button class="btn btn-small btn-secondary" id="selectAllServersBtn">Select All</button>
            <button class="btn btn-small btn-secondary" id="deselectAllServersBtn">Deselect All</button>
        </div>
    `;

    for (const [name, server] of Object.entries(servers)) {
        const card = document.createElement('div');
        card.className = 'server-card';
        card.dataset.serverName = name;

        let envHtml = '';
        if (server.env && Object.keys(server.env).length > 0) {
            envHtml = '<div class="env-list"><strong>Environment:</strong><br>';
            for (const [key, value] of Object.entries(server.env)) {
                const displayValue = value.includes('KEY') || value.includes('SECRET')
                    ? value.substring(0, 4) + '***'
                    : value;
                envHtml += `${key}: ${displayValue}<br>`;
            }
            envHtml += '</div>';
        }

        card.innerHTML = `
            <div class="server-header">
                <input type="checkbox" class="server-checkbox" data-server="${name}">
                <span class="server-name">${name}</span>
                <div class="server-actions">
                    <button class="btn btn-small btn-secondary edit-server-btn" data-server-name="${name}">Edit</button>
                    <button class="btn btn-small btn-secondary export-server-btn" data-server-name="${name}">Export</button>
                    <button class="btn btn-small btn-danger delete-server-btn" data-server-name="${name}">Delete</button>
                </div>
            </div>
            <div class="server-details">
                ${server.command ? `<div class="detail-row"><strong>Command:</strong> ${server.command}</div>` : ''}
                ${server.args ? `<div class="detail-row"><strong>Args:</strong> ${server.args.join(' ')}</div>` : ''}
                ${envHtml}
                <div class="detail-row"><button class="icon-btn secondary copy-to-clipboard-btn" data-server-name="${name}" title="Copy to Clipboard">📋</button></div>
            </div>
        `;

        serverList.appendChild(card);
    }

    attachClientViewEventListeners();
}

function attachClientViewEventListeners() {
    document.querySelectorAll('.server-checkbox').forEach(checkbox => {
        checkbox.onchange = updateBulkActions;
    });

    document.getElementById('deleteSelectedBtn').onclick = () => deleteSelected(loadClientServers, null, window.loadClients); // Call deleteSelected from modals.js
    document.getElementById('selectAllServersBtn').onclick = selectAllServers;
    document.getElementById('deselectAllServersBtn').onclick = deselectAllServers;

    const serverList = document.getElementById('serverList');
    serverList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-server-btn')) {
            deleteServerFromClientView(e.target.dataset.serverName);
        } else if (e.target.classList.contains('edit-server-btn')) {
            editServerFromClientView(e.target.dataset.serverName);
        } else if (e.target.classList.contains('copy-server-btn')) {
            copyServerFromClientView(e.target.dataset.serverName);
        } else if (e.target.classList.contains('copy-to-clipboard-btn')) {
            copyToClipboardFromClientView(e.target.dataset.serverName, e);
        } else if (e.target.classList.contains('export-server-btn')) {
            exportServerFromClientView(e.target.dataset.serverName);
        }
    });
}

// Wrapper functions to pass callbacks
export const editServerFromClientView = async (name) => {
    try {
        const config = await getClientConfigApi(currentClient);
        const serverConfig = config.servers[name];
        showServerModal(name, serverConfig, loadClientServers, null, currentClient, loadClientsCallback);
    } catch (error) {
        alert('Failed to load server config for editing: ' + error.message);
    }
};

export const copyServerFromClientView = (serverName) => {
    copyServer(serverName, window.loadClients);
};

export const copyToClipboardFromClientView = (serverName, event) => {
    copyToClipboard(serverName, event);
};

export const exportServerFromClientView = (serverName) => {
    exportServer(serverName, currentClient);
};

export const deleteServerFromClientView = (name) => {
    deleteServer(name, loadClientServers, null, loadClientsCallback, currentClient);
};

export const removeFromAllFromClientView = (serverName) => {
    removeFromAll(serverName, window.loadClients, loadClientServers, window.loadClients);
};

export const renameServerFromClientView = (serverName) => {
    showRenameServerModal(serverName, loadClientsCallback, currentClient);
};
