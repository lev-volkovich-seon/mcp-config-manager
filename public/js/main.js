import { detectClientsApi, listClientsApi } from './api.js';
import { initClientView, renderClientList, selectClient, loadClientServers } from './clientView.js';
import { initKanbanView, renderKanbanBoard } from './kanbanView.js';
import { initServerView, renderAllServers } from './serverView.js';
import { showServerModal, showImportModal, exportConfig, initModals } from './modals.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentClient = null;
    let clients = [];
    let currentView = 'list';

    const listViewBtn = document.getElementById('listViewBtn');
    const kanbanViewBtn = document.getElementById('kanbanViewBtn');
    const serverViewBtn = document.getElementById('serverViewBtn');

    const listViewContainer = document.getElementById('listViewContainer');
    const kanbanViewContainer = document.getElementById('kanbanViewContainer');
    const serverViewContainer = document.getElementById('serverViewContainer');

    async function refreshClients() {
        try {
            await detectClientsApi();
            await loadClients();
        } catch (error) {
            console.error('Failed to refresh clients:', error);
            alert('Failed to refresh clients. Make sure the server is running.');
        }
    }

    async function loadClients() {
        try {
            clients = await listClientsApi();
            
            // Initialize modules with current client data
            initClientView(clients, currentClient, loadClients);
            initKanbanView(clients, loadClients);
            initServerView(clients, loadClients);
            initModals(clients, currentClient, window.loadClients);

            renderClientList();
            if (currentView === 'kanban') {
                renderKanbanBoard();
            } else if (currentView === 'server') {
                renderAllServers();
            }
        } catch (error) {
            console.error('Failed to load clients:', error);
            alert('Failed to load clients. Make sure the server is running.');
        }
    }
    window.loadClients = loadClients; // Make loadClients globally accessible
    window.setCurrentClient = (clientId) => { currentClient = clientId; }; // Make setCurrentClient globally accessible

    // View switching
    function switchView(view) {
        currentView = view;

        listViewBtn.classList.toggle('active', view === 'list');
        kanbanViewBtn.classList.toggle('active', view === 'kanban');
        serverViewBtn.classList.toggle('active', view === 'server');

        listViewContainer.style.display = view === 'list' ? 'block' : 'none';
        kanbanViewContainer.style.display = view === 'kanban' ? 'block' : 'none';
        serverViewContainer.style.display = view === 'server' ? 'block' : 'none';

        if (view === 'kanban') {
            renderKanbanBoard();
        } else if (view === 'server') {
            renderAllServers();
        }
    }

    // Global Event Listeners
    listViewBtn.addEventListener('click', () => switchView('list'));
    kanbanViewBtn.addEventListener('click', () => switchView('kanban'));
    serverViewBtn.addEventListener('click', () => switchView('server'));

    document.getElementById('refreshBtn').addEventListener('click', refreshClients);
    document.getElementById('addServerBtn').addEventListener('click', () => {
        // For global add server button, we need to prompt user to select a client first
        if (!currentClient) {
            alert('Please select a client from the sidebar first, then use the Add Server button in the client view.');
            return;
        }
        showServerModal(null, null, loadClientServers, renderKanbanBoard, currentClient, window.loadClients);
    });
    document.getElementById('exportConfigBtn').addEventListener('click', exportConfig);
    document.getElementById('importConfigBtn').addEventListener('click', () => showImportModal(loadClientServers, renderKanbanBoard, window.loadClients));

    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    document.getElementById('cancelModal').addEventListener('click', () => {
        document.getElementById('serverModal').style.display = 'none';
    });

    document.getElementById('cancelCopy').addEventListener('click', () => {
        document.getElementById('copyModal').style.display = 'none';
    });

    document.getElementById('cancelImport').addEventListener('click', () => {
        document.getElementById('importModal').style.display = 'none';
    });

    document.getElementById('cancelEditServerEnv').addEventListener('click', () => {
        document.getElementById('editServerEnvModal').style.display = 'none';
    });

    document.getElementById('cancelAddServerToClients').addEventListener('click', () => {
        document.getElementById('addServerToClientsModal').style.display = 'none';
    });

    // Load clients on page load
    loadClients();
});