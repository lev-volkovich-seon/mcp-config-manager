import { getClientConfigApi, copyServerApi, deleteServerApi } from './api.js';
import { showServerModal, editServer, copyToClipboard, exportServer } from './modals.js';

let clients = [];
let loadClientsCallback = null;
let listenersAttached = false;

export function initKanbanView(allClients, loadClientsFn) {
    clients = allClients;
    loadClientsCallback = loadClientsFn;
    if (!listenersAttached) {
        attachGridEventListeners();
        listenersAttached = true;
    }
}

function getServerColor(serverName) {
    let hash = 0;
    for (let i = 0; i < serverName.length; i++) {
        hash = serverName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    const isDark = document.body.classList.contains('dark-theme');
    // Use lighter backgrounds for better text visibility
    const lightness = isDark ? 20 : 92;
    const saturation = isDark ? 30 : 50;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export async function renderKanbanGrid() {
    const container = document.getElementById('kanbanViewContainer');
    container.innerHTML = ''; // Clear previous content

    const grid = document.createElement('div');
    grid.className = 'kanban-grid';

    for (const client of clients) {
        const clientSection = document.createElement('div');
        clientSection.className = 'client-tile-section';

        const header = document.createElement('div');
        header.className = 'client-tile-header';
        header.innerHTML = `<h3>${client.name}</h3>`;
        clientSection.appendChild(header);

        const serverGrid = document.createElement('div');
        serverGrid.className = 'server-grid';
        serverGrid.dataset.client = client.id;

        try {
            const config = await getClientConfigApi(client.id);
            if (config.servers && Object.keys(config.servers).length > 0) {
                for (const [name, server] of Object.entries(config.servers)) {
                    const tile = createServerCard(client.id, name, server);
                    serverGrid.appendChild(tile);
                }
            } else {
                serverGrid.innerHTML = '<p class="no-servers">No servers configured.</p>';
            }
        } catch (error) {
            console.error(`Failed to load servers for ${client.id}:`, error);
            serverGrid.innerHTML = '<p class="no-servers">Error loading servers.</p>';
        }
        
        clientSection.appendChild(serverGrid);
        grid.appendChild(clientSection);
    }
    container.appendChild(grid);
}

function createServerCard(clientId, serverName, server) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.dataset.server = serverName;
    card.dataset.client = clientId;
    card.style.backgroundColor = getServerColor(serverName);

    const isRemote = server.type && (server.type === 'http' || server.type === 'sse');
    const transportType = isRemote ? server.type.toUpperCase() : '';

    let envDetails = '';
    if (server.env) {
        const hiddenKeys = Object.keys(server.env).filter(key => key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret'));
        const visibleKeys = Object.keys(server.env).filter(key => !hiddenKeys.includes(key));
        if(visibleKeys.length > 0) {
            envDetails += `<strong>Env:</strong> ${visibleKeys.join(', ')}`;
        }
        if(hiddenKeys.length > 0) {
            envDetails += `${visibleKeys.length > 0 ? ', ' : '<strong>Env:</strong> '}${hiddenKeys.length} hidden key(s)`;
        }
    }
    
    card.innerHTML = `
        <div class="kanban-card-header">
            <span class="kanban-card-title">${serverName}</span>
            <div class="kanban-card-actions">
                <button class="icon-btn edit-server-kanban-btn" title="Edit" data-client-id="${clientId}" data-server-name="${serverName}">✏️</button>
                <button class="icon-btn delete-server-kanban-btn" title="Delete" data-client-id="${clientId}" data-server-name="${serverName}">🗑️</button>
            </div>
        </div>
        <div class="kanban-card-details">
            ${isRemote ? `<span class="transport-badge transport-${server.type}">${transportType}</span>` : ''}
            ${server.command ? `<strong>Cmd:</strong> ${server.command}` : ''}
            <div class="env-details">${envDetails}</div>
        </div>
    `;

    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, clientId, serverName);
    });

    return card;
}

function showContextMenu(event, clientId, serverName) {
    hideContextMenu(); // Hide any existing menu

    const menu = document.createElement('div');
    menu.id = 'customContextMenu';
    menu.className = 'custom-context-menu';

    const otherClients = clients.filter(c => c.id !== clientId);

    let menuContent = '<ul>';
    if (otherClients.length > 0) {
        menuContent += '<li><strong>Copy to:</strong></li>';
        otherClients.forEach(client => {
            menuContent += `<li data-action="copy" data-target-client-id="${client.id}">${client.name}</li>`;
        });
    } else {
        menuContent += '<li>No other clients to copy to.</li>';
    }
    menuContent += '</ul>';

    menu.innerHTML = menuContent;
    document.body.appendChild(menu);

    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;
    menu.style.display = 'block';

    menu.addEventListener('click', async (e) => {
        if (e.target.dataset.action === 'copy') {
            const targetClientId = e.target.dataset.targetClientId;
            await handleCopy(clientId, serverName, targetClientId);
        }
        hideContextMenu();
    });

    document.addEventListener('click', hideContextMenu, { once: true });
}

function hideContextMenu() {
    const menu = document.getElementById('customContextMenu');
    if (menu) {
        menu.remove();
    }
}

async function handleCopy(sourceClientId, serverName, targetClientId) {
    try {
        const response = await copyServerApi(sourceClientId, serverName, targetClientId, serverName);
        if (response.success) {
            await renderKanbanGrid();
        } else {
            throw new Error(response.message || 'Failed to copy server');
        }
    } catch (error) {
        alert('Failed to copy server: ' + error.message);
    }
}

function attachGridEventListeners() {
    const container = document.getElementById('kanbanViewContainer');
    container.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const serverCard = e.target.closest('.kanban-card');
        if (!serverCard) return;

        const clientId = serverCard.dataset.client;
        const serverName = serverCard.dataset.server;

        if (target.classList.contains('edit-server-kanban-btn')) {
            editServer(serverName, renderKanbanGrid, clientId, loadClientsCallback);
        } else if (target.classList.contains('delete-server-kanban-btn')) {
            deleteServerKanban(clientId, serverName, e);
        }
    });
}

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