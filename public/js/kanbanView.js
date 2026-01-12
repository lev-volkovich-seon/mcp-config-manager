import { getClientConfigApi, copyServerApi, deleteServerApi } from './api.js';
import { showServerModal, editServer, copyToClipboard, exportServer } from './modals.js';

let clients = []; // This will be passed from main.js
let draggedServer = null;
let draggedFromClient = null;
let loadClientsCallback = null; // Callback to main.js to reload all clients
let listenersAttached = false; // Track if event listeners have been attached

export function initKanbanView(allClients, loadClientsFn) {
    clients = allClients;
    loadClientsCallback = loadClientsFn;
    if (!listenersAttached) {
        attachKanbanViewEventListeners();
        listenersAttached = true;
    }
}

// Simple hash function to generate a consistent color from a string
function getServerColor(serverName) {
    let hash = 0;
    for (let i = 0; i < serverName.length; i++) {
        hash = serverName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 85%)`; // Light, saturated color
}

export async function renderKanbanBoard() {
    const board = document.getElementById('kanbanBoard');
    board.innerHTML = '';

    const kanbanSort = document.getElementById('kanbanSort');
    let sortBy = localStorage.getItem('kanbanSortBy') || 'name-asc';
    if (kanbanSort) {
        kanbanSort.value = sortBy;
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

    for (const client of sortedClients) {
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
            const config = await getClientConfigApi(client.id);

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
        addBtn.addEventListener('click', () => {
            // Pass client.id as the clientId parameter to showServerModal
            showServerModal(null, null, () => window.loadClients(), renderKanbanBoard, client.id, loadClientsCallback); // Pass client.id and renderKanbanBoard as callback
        });

        column.appendChild(header);
        column.appendChild(serversContainer);
        column.appendChild(addBtn);
        board.appendChild(column);
    }

    if (kanbanSort) {
        kanbanSort.onchange = () => {
            localStorage.setItem('kanbanSortBy', kanbanSort.value);
            renderKanbanBoard();
        };
    }
}

function createKanbanCard(clientId, serverName, server) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.dataset.server = serverName;
    card.dataset.client = clientId;
    card.style.backgroundColor = getServerColor(serverName);

    let details = '';
    // Show transport type for remote servers
    if (server.type) {
        details += `type: ${server.type.toUpperCase()}\n`;
        if (server.url) details += `url: ${server.url}\n`;
    }
    if (server.command) details += `cmd: ${server.command}\n`;
    if (server.args) details += `args: ${server.args.join(' ')}\n`;
    if (server.env) details += `env: ${Object.keys(server.env).length} var(s)`;

    card.innerHTML = `
        <div class="kanban-card-header">
            <span class="kanban-card-title">${serverName}</span>
            <div class="kanban-card-actions">
                <button class="icon-btn edit-server-kanban-btn" title="Edit" data-client-id="${clientId}" data-server-name="${serverName}">✏️</button>
                <button class="icon-btn copy-to-clipboard-kanban-btn" title="Copy to clipboard" data-client-id="${clientId}" data-server-name="${serverName}">📋</button>
                <button class="icon-btn export-server-kanban-btn" title="Export" data-client-id="${clientId}" data-server-name="${serverName}">💾</button>
                <button class="icon-btn delete delete-server-kanban-btn" title="Delete" data-client-id="${clientId}" data-server-name="${serverName}">🗑️</button>
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

function attachKanbanViewEventListeners() {
    const kanbanBoard = document.getElementById('kanbanBoard');
    kanbanBoard.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-server-kanban-btn')) {
            editServerKanban(e.target.dataset.clientId, e.target.dataset.serverName, e);
        } else if (e.target.classList.contains('rename-server-kanban-btn')) {
            renameServerKanban(e.target.dataset.clientId, e.target.dataset.serverName, e);
        } else if (e.target.classList.contains('copy-to-clipboard-kanban-btn')) {
            copyToClipboardKanban(e.target.dataset.clientId, e.target.dataset.serverName, e);
        } else if (e.target.classList.contains('export-server-kanban-btn')) {
            exportServerKanban(e.target.dataset.clientId, e.target.dataset.serverName, e);
        } else if (e.target.classList.contains('delete-server-kanban-btn')) {
            deleteServerKanban(e.target.dataset.clientId, e.target.dataset.serverName, e);
        }
    });
}

const handleDrop = async (targetClient) => {
    if (!draggedServer || !draggedFromClient) return;

    try {
        const response = await copyServerApi(draggedFromClient, draggedServer, targetClient, draggedServer);

        if (response.success) {
            await renderKanbanBoard();
        } else {
            throw new Error('Failed to copy server');
        }
    } catch (error) {
        alert('Failed to copy server: ' + error.message);
    }
};

export const editServerKanban = (clientId, serverName, event) => {
    event.stopPropagation();
    editServer(serverName, renderKanbanBoard, clientId, loadClientsCallback);
};

export const deleteServerKanban = async (clientId, serverName, event) => {
    event.stopPropagation();
    if (!confirm(`Are you sure you want to delete the server "${serverName}" from ${clients.find(c => c.id === clientId).name}?`)) {
        return;
    }

    try {
        const response = await deleteServerApi(clientId, serverName);
        if (response.success) {
            await window.loadClients();
        } else {
            throw new Error('Failed to delete server');
        }
    } catch (error) {
        alert('Failed to delete server: ' + error.message);
    }
};

export const exportServerKanban = (clientId, serverName, event) => {
    event.stopPropagation();
    exportServer(serverName, clientId);
};

export const copyToClipboardKanban = (clientId, serverName, event) => {
    event.stopPropagation();
    copyToClipboard(serverName, event, null, clientId);
};

export const renameServerKanban = (clientId, serverName, event) => {
    event.stopPropagation();
    showRenameServerModal(serverName, () => window.loadClients(), clientId); // Pass clientId
};