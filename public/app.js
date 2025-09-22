const API_URL = 'http://localhost:3456/api';

let currentClient = null;
let clients = [];
let currentView = 'list';
let draggedServer = null;
let draggedFromClient = null;

async function loadClients() {
    try {
        const response = await fetch(`${API_URL}/clients`);
        clients = await response.json();
        renderClientList();
        if (currentView === 'kanban') {
            renderKanbanBoard();
        }
    } catch (error) {
        console.error('Failed to load clients:', error);
        alert('Failed to load clients. Make sure the server is running.');
    }
}

function renderClientList() {
    const clientList = document.getElementById('clientList');
    clientList.innerHTML = '';

    clients.forEach(client => {
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

        item.onclick = () => selectClient(client.id);
        clientList.appendChild(item);
    });
}

async function selectClient(clientId) {
    currentClient = clientId;
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

async function loadClientServers() {
    try {
        const response = await fetch(`${API_URL}/clients/${currentClient}`);
        const config = await response.json();
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
            <button class="btn btn-small btn-danger" onclick="deleteSelected()">Delete Selected</button>
            <button class="btn btn-small btn-secondary" onclick="selectAllServers()">Select All</button>
            <button class="btn btn-small btn-secondary" onclick="deselectAllServers()">Deselect All</button>
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
                <input type="checkbox" class="server-checkbox" data-server="${name}" onchange="updateBulkActions()">
                <span class="server-name">${name}</span>
                <div class="server-actions">
                    <button class="btn btn-small btn-secondary" onclick="editServer('${name}')">Edit</button>
                    <button class="btn btn-small btn-secondary" onclick="copyServer('${name}')">Copy</button>
                    <button class="btn btn-small btn-secondary" onclick="copyToClipboard('${name}', event)">📋</button>
                    <button class="btn btn-small btn-secondary" onclick="exportServer('${name}')">Export</button>
                    <button class="btn btn-small btn-danger" onclick="deleteServer('${name}')">Delete</button>
                    <button class="btn btn-small btn-danger" onclick="removeFromAll('${name}')">Remove from All</button>
                </div>
            </div>
            <div class="server-details">
                ${server.command ? `<div class="detail-row"><strong>Command:</strong> ${server.command}</div>` : ''}
                ${server.args ? `<div class="detail-row"><strong>Args:</strong> ${server.args.join(' ')}</div>` : ''}
                ${envHtml}
            </div>
        `;

        serverList.appendChild(card);
    }
}

function showServerModal(serverName = null, serverConfig = null) {
    const modal = document.getElementById('serverModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('serverForm');

    title.textContent = serverName ? 'Edit Server' : 'Add Server';

    document.getElementById('serverName').value = serverName || '';
    document.getElementById('serverName').disabled = !!serverName;
    document.getElementById('serverCommand').value = serverConfig?.command || '';
    document.getElementById('serverArgs').value = serverConfig?.args?.join('\n') || '';

    // Set JSON editor content
    document.getElementById('jsonEditor').value = JSON.stringify(serverConfig || {}, null, 2);

    const envVarsDiv = document.getElementById('envVars');
    envVarsDiv.innerHTML = '';

    if (serverConfig?.env) {
        for (const [key, value] of Object.entries(serverConfig.env)) {
            addEnvVarRow(key, value);
        }
    }

    // Setup tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => switchTab(btn.dataset.tab);
    });

    modal.style.display = 'flex';

    form.onsubmit = async (e) => {
        e.preventDefault();
        await saveServer(serverName);
    };
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    document.getElementById('formTab').style.display = tab === 'form' ? 'block' : 'none';
    document.getElementById('jsonTab').style.display = tab === 'json' ? 'block' : 'none';

    // Sync data between tabs
    if (tab === 'json') {
        const config = buildConfigFromForm();
        document.getElementById('jsonEditor').value = JSON.stringify(config, null, 2);
    } else {
        try {
            const config = JSON.parse(document.getElementById('jsonEditor').value);
            updateFormFromConfig(config);
        } catch (e) {
            // Invalid JSON, don't update form
        }
    }
}

function buildConfigFromForm() {
    const config = {};
    const command = document.getElementById('serverCommand').value;
    const argsText = document.getElementById('serverArgs').value;
    const args = argsText ? argsText.split('\n').filter(a => a.trim()) : [];

    if (command) config.command = command;
    if (args.length > 0) config.args = args;

    const envVarRows = document.querySelectorAll('.env-var-row');
    const env = {};
    envVarRows.forEach(row => {
        const key = row.querySelector('.env-key').value;
        const value = row.querySelector('.env-value').value;
        if (key && value) {
            env[key] = value;
        }
    });
    if (Object.keys(env).length > 0) config.env = env;

    return config;
}

function updateFormFromConfig(config) {
    document.getElementById('serverCommand').value = config.command || '';
    document.getElementById('serverArgs').value = config.args?.join('\n') || '';

    const envVarsDiv = document.getElementById('envVars');
    envVarsDiv.innerHTML = '';
    if (config.env) {
        for (const [key, value] of Object.entries(config.env)) {
            addEnvVarRow(key, value);
        }
    }
}

function addEnvVarRow(key = '', value = '') {
    const envVarsDiv = document.getElementById('envVars');
    const row = document.createElement('div');
    row.className = 'env-var-row';

    row.innerHTML = `
        <input type="text" placeholder="Key" value="${key}" class="env-key">
        <input type="text" placeholder="Value" value="${value}" class="env-value">
        <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.remove()">Remove</button>
    `;

    envVarsDiv.appendChild(row);
}

async function saveServer(originalName) {
    const name = originalName || document.getElementById('serverName').value;

    let serverConfig;
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;

    if (activeTab === 'json') {
        try {
            serverConfig = JSON.parse(document.getElementById('jsonEditor').value);
        } catch (e) {
            alert('Invalid JSON format');
            return;
        }
    } else {
        serverConfig = buildConfigFromForm();
    }

    try {
        const method = originalName ? 'PUT' : 'POST';
        const response = await fetch(`${API_URL}/clients/${currentClient}/servers/${name}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serverConfig)
        });

        if (response.ok) {
            document.getElementById('serverModal').style.display = 'none';
            await loadClientServers();
            if (currentView === 'kanban') {
                await renderKanbanBoard();
            }
        } else {
            throw new Error('Failed to save server');
        }
    } catch (error) {
        alert('Failed to save server: ' + error.message);
    }
}

async function editServer(name) {
    try {
        const response = await fetch(`${API_URL}/clients/${currentClient}`);
        const config = await response.json();
        showServerModal(name, config.servers[name]);
    } catch (error) {
        alert('Failed to load server config');
    }
}

async function deleteServer(name) {
    if (!confirm(`Are you sure you want to delete the server "${name}"?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/clients/${currentClient}/servers/${name}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadClientServers();
            if (currentView === 'kanban') {
                await renderKanbanBoard();
            }
        } else {
            throw new Error('Failed to delete server');
        }
    } catch (error) {
        alert('Failed to delete server: ' + error.message);
    }
}

function copyServer(serverName) {
    const modal = document.getElementById('copyModal');
    const form = document.getElementById('copyForm');
    const targetClientsDiv = document.getElementById('targetClients');

    targetClientsDiv.innerHTML = '';
    clients.forEach(client => {
        if (client.id !== currentClient) {
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            item.innerHTML = `
                <input type="checkbox" id="target-${client.id}" value="${client.id}">
                <label for="target-${client.id}">${client.name}</label>
            `;
            targetClientsDiv.appendChild(item);
        }
    });

    modal.style.display = 'flex';

    form.onsubmit = async (e) => {
        e.preventDefault();
        const targetClients = [];
        targetClientsDiv.querySelectorAll('input:checked').forEach(input => {
            targetClients.push(input.value);
        });

        if (targetClients.length === 0) {
            alert('Please select at least one target client');
            return;
        }

        const targetName = document.getElementById('targetServerName').value || serverName;

        try {
            for (const targetClient of targetClients) {
                const response = await fetch(`${API_URL}/copy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fromClient: currentClient,
                        fromServer: serverName,
                        toClient: targetClient,
                        toServer: targetName
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to copy to ${targetClient}`);
                }
            }

            modal.style.display = 'none';
            alert(`Server copied successfully to ${targetClients.length} client(s)`);
            await loadClients();
        } catch (error) {
            alert('Failed to copy server: ' + error.message);
        }
    };
}

async function copyToClipboard(serverName, event) {
    try {
        const response = await fetch(`${API_URL}/clients/${currentClient}`);
        const config = await response.json();
        const serverConfig = config.servers[serverName];

        const text = JSON.stringify({
            name: serverName,
            config: serverConfig
        }, null, 2);

        await navigator.clipboard.writeText(text);

        // Visual feedback
        const btn = event ? event.target : document.activeElement;
        const originalText = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = originalText, 1000);
    } catch (error) {
        alert('Failed to copy to clipboard: ' + error.message);
    }
}

async function exportServer(serverName) {
    try {
        const response = await fetch(`${API_URL}/export/${currentClient}?server=${serverName}`);
        const data = await response.json();

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentClient}-${serverName}.json`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        alert('Failed to export server: ' + error.message);
    }
}

async function exportConfig() {
    try {
        const response = await fetch(`${API_URL}/export/${currentClient}`);
        const data = await response.json();

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentClient}-config.json`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        alert('Failed to export config: ' + error.message);
    }
}

function showImportModal() {
    const modal = document.getElementById('importModal');
    const form = document.getElementById('importForm');

    modal.style.display = 'flex';
    document.getElementById('importData').value = '';

    form.onsubmit = async (e) => {
        e.preventDefault();

        try {
            const importData = JSON.parse(document.getElementById('importData').value);

            const response = await fetch(`${API_URL}/import/${currentClient}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(importData)
            });

            if (response.ok) {
                modal.style.display = 'none';
                await loadClientServers();
                if (currentView === 'kanban') {
                    await renderKanbanBoard();
                }
                alert('Configuration imported successfully');
            } else {
                throw new Error('Failed to import configuration');
            }
        } catch (error) {
            alert('Failed to import: ' + error.message);
        }
    };
}

// Kanban View Functions
async function renderKanbanBoard() {
    const board = document.getElementById('kanbanBoard');
    board.innerHTML = '';

    for (const client of clients) {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.dataset.client = client.id;

        const header = document.createElement('div');
        header.className = 'kanban-header';
        header.innerHTML = `
            <h3>${client.name}</h3>
            <div class="kanban-config-path">${client.configPath}</div>
        `;

        const serversContainer = document.createElement('div');
        serversContainer.className = 'kanban-servers';
        serversContainer.dataset.client = client.id;

        // Load servers for this client
        try {
            const response = await fetch(`${API_URL}/clients/${client.id}`);
            const config = await response.json();

            for (const [name, server] of Object.entries(config.servers || {})) {
                const card = createKanbanCard(client.id, name, server);
                serversContainer.appendChild(card);
            }
        } catch (error) {
            console.error(`Failed to load servers for ${client.id}:`, error);
        }

        // Add drop zone events
        serversContainer.ondragover = (e) => {
            e.preventDefault();
            serversContainer.classList.add('drag-over');
        };

        serversContainer.ondragleave = () => {
            serversContainer.classList.remove('drag-over');
        };

        serversContainer.ondrop = async (e) => {
            e.preventDefault();
            serversContainer.classList.remove('drag-over');

            if (draggedServer && draggedFromClient && draggedFromClient !== client.id) {
                await handleDrop(client.id);
            }
        };

        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-primary kanban-add-btn';
        addBtn.textContent = 'Add Server';
        addBtn.onclick = () => {
            currentClient = client.id;
            showServerModal();
        };

        column.appendChild(header);
        column.appendChild(serversContainer);
        column.appendChild(addBtn);
        board.appendChild(column);
    }
}

function createKanbanCard(clientId, serverName, server) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.dataset.server = serverName;
    card.dataset.client = clientId;

    let details = '';
    if (server.command) details += `cmd: ${server.command}\n`;
    if (server.args) details += `args: ${server.args.join(' ')}\n`;
    if (server.env) details += `env: ${Object.keys(server.env).length} var(s)`;

    card.innerHTML = `
        <div class="kanban-card-header">
            <span class="kanban-card-title">${serverName}</span>
            <div class="kanban-card-actions">
                <button class="icon-btn" title="Edit" onclick="editServerKanban('${clientId}', '${serverName}', event)">✏️</button>
                <button class="icon-btn" title="Copy to clipboard" onclick="copyToClipboardKanban('${clientId}', '${serverName}', event)">📋</button>
                <button class="icon-btn" title="Export" onclick="exportServerKanban('${clientId}', '${serverName}', event)">💾</button>
                <button class="icon-btn delete" title="Delete" onclick="deleteServerKanban('${clientId}', '${serverName}', event)">🗑️</button>
            </div>
        </div>
        <div class="kanban-card-details">${details}</div>
    `;

    card.ondragstart = (e) => {
        // Don't start drag if clicking on buttons
        if (e.target.tagName === 'BUTTON') {
            e.preventDefault();
            return;
        }
        draggedServer = serverName;
        draggedFromClient = clientId;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'copy';
    };

    card.ondragend = () => {
        card.classList.remove('dragging');
        draggedServer = null;
        draggedFromClient = null;
    };

    return card;
}

async function handleDrop(targetClient) {
    if (!draggedServer || !draggedFromClient) return;

    try {
        const response = await fetch(`${API_URL}/copy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromClient: draggedFromClient,
                fromServer: draggedServer,
                toClient: targetClient,
                toServer: draggedServer
            })
        });

        if (response.ok) {
            await renderKanbanBoard();
        } else {
            throw new Error('Failed to copy server');
        }
    } catch (error) {
        alert('Failed to copy server: ' + error.message);
    }
}

async function editServerKanban(clientId, serverName, event) {
    event.stopPropagation();
    try {
        currentClient = clientId;
        const response = await fetch(`${API_URL}/clients/${clientId}`);
        const config = await response.json();
        showServerModal(serverName, config.servers[serverName]);
    } catch (error) {
        alert('Failed to load server config');
    }
}

async function deleteServerKanban(clientId, serverName, event) {
    event.stopPropagation();
    if (!confirm(`Are you sure you want to delete the server "${serverName}" from ${clients.find(c => c.id === clientId).name}?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/clients/${clientId}/servers/${serverName}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await renderKanbanBoard();
        } else {
            throw new Error('Failed to delete server');
        }
    } catch (error) {
        alert('Failed to delete server: ' + error.message);
    }
}

async function exportServerKanban(clientId, serverName, event) {
    event.stopPropagation();
    try {
        const response = await fetch(`${API_URL}/export/${clientId}?server=${serverName}`);
        const data = await response.json();

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${clientId}-${serverName}.json`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        alert('Failed to export server: ' + error.message);
    }
}

async function copyToClipboardKanban(clientId, serverName, event) {
    event.stopPropagation();
    try {
        const response = await fetch(`${API_URL}/clients/${clientId}`);
        const config = await response.json();
        const serverConfig = config.servers[serverName];

        const text = JSON.stringify({
            name: serverName,
            config: serverConfig
        }, null, 2);

        await navigator.clipboard.writeText(text);

        // Visual feedback
        const btn = event ? event.target : document.activeElement;
        const originalText = btn.textContent;
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = originalText, 1000);
    } catch (error) {
        alert('Failed to copy to clipboard: ' + error.message);
    }
}

// Bulk actions functions
function updateBulkActions() {
    const checkboxes = document.querySelectorAll('.server-checkbox:checked');
    const bulkActions = document.getElementById('bulkActions');
    const selectedCount = document.getElementById('selectedCount');

    if (checkboxes.length > 0) {
        bulkActions.style.display = 'flex';
        selectedCount.textContent = `${checkboxes.length} selected`;
    } else {
        bulkActions.style.display = 'none';
    }
}

function selectAllServers() {
    document.querySelectorAll('.server-checkbox').forEach(cb => cb.checked = true);
    updateBulkActions();
}

function deselectAllServers() {
    document.querySelectorAll('.server-checkbox').forEach(cb => cb.checked = false);
    updateBulkActions();
}

async function deleteSelected() {
    const checkboxes = document.querySelectorAll('.server-checkbox:checked');
    const serverNames = Array.from(checkboxes).map(cb => cb.dataset.server);

    if (serverNames.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${serverNames.length} server(s)?`)) {
        return;
    }

    let deletedCount = 0;
    for (const serverName of serverNames) {
        try {
            const response = await fetch(`${API_URL}/clients/${currentClient}/servers/${serverName}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                deletedCount++;
            }
        } catch (error) {
            console.error(`Failed to delete ${serverName}:`, error);
        }
    }

    alert(`Deleted ${deletedCount} server(s)`);
    await loadClientServers();
}

async function removeFromAll(serverName) {
    if (!confirm(`Are you sure you want to remove "${serverName}" from ALL clients?`)) {
        return;
    }

    let removedCount = 0;
    const errors = [];

    for (const client of clients) {
        try {
            // Check if server exists in this client
            const response = await fetch(`${API_URL}/clients/${client.id}`);
            const config = await response.json();

            if (config.servers && config.servers[serverName]) {
                const deleteResponse = await fetch(`${API_URL}/clients/${client.id}/servers/${serverName}`, {
                    method: 'DELETE'
                });

                if (deleteResponse.ok) {
                    removedCount++;
                    console.log(`✓ Removed from ${client.name}`);
                } else {
                    errors.push(client.name);
                }
            }
        } catch (error) {
            errors.push(client.name);
            console.error(`Failed to remove from ${client.id}:`, error);
        }
    }

    if (errors.length > 0) {
        alert(`Removed "${serverName}" from ${removedCount} client(s).\nFailed for: ${errors.join(', ')}`);
    } else {
        alert(`Successfully removed "${serverName}" from ${removedCount} client(s)`);
    }

    await loadClients();
    await loadClientServers();
}

// View switching
function switchView(view) {
    currentView = view;

    document.getElementById('listViewBtn').classList.toggle('active', view === 'list');
    document.getElementById('kanbanViewBtn').classList.toggle('active', view === 'kanban');

    document.getElementById('listViewContainer').style.display = view === 'list' ? 'block' : 'none';
    document.getElementById('kanbanViewContainer').style.display = view === 'kanban' ? 'block' : 'none';

    if (view === 'kanban') {
        renderKanbanBoard();
    }
}

// Event listeners
document.getElementById('listViewBtn').onclick = () => switchView('list');
document.getElementById('kanbanViewBtn').onclick = () => switchView('kanban');
document.getElementById('refreshBtn').onclick = loadClients;
document.getElementById('addServerBtn').onclick = () => showServerModal();
document.getElementById('exportConfigBtn').onclick = exportConfig;
document.getElementById('importConfigBtn').onclick = showImportModal;
document.getElementById('addEnvVar').onclick = () => addEnvVarRow();

document.getElementById('selectAllBtn').onclick = () => {
    document.querySelectorAll('#targetClients input[type="checkbox"]').forEach(cb => cb.checked = true);
};

document.getElementById('selectNoneBtn').onclick = () => {
    document.querySelectorAll('#targetClients input[type="checkbox"]').forEach(cb => cb.checked = false);
};

document.getElementById('cancelModal').onclick = () => {
    document.getElementById('serverModal').style.display = 'none';
};

document.getElementById('cancelCopy').onclick = () => {
    document.getElementById('copyModal').style.display = 'none';
};

document.getElementById('cancelImport').onclick = () => {
    document.getElementById('importModal').style.display = 'none';
};

// Close modals when clicking outside
document.querySelectorAll('.modal').forEach(modal => {
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
});

// Load clients on page load
loadClients();