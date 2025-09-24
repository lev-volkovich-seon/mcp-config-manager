import { addEnvVarRow, switchTab, buildConfigFromForm, updateFormFromConfig } from './utils.js';
import {
    addServerApi, updateServerApi, deleteServerApi, copyServerApi,
    exportConfigApi, exportServerApi, importConfigApi, getClientConfigApi, renameServerApi, updateServerEnvApi
} from './api.js';

let clients = []; // This will be passed from main.js
let currentClient = null; // This will be passed from main.js
let loadClientsCallback = null; // Callback to main.js to reload all clients

export function initModals(clientData, currentClientData, loadClientsFn) {
    clients = clientData;
    currentClient = currentClientData;
    loadClientsCallback = loadClientsFn;
}

export function showServerModal(serverName = null, serverConfig = null, loadClientServers, renderKanbanBoard, clientId = null, loadClientsFn) {
    const modal = document.getElementById('serverModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('serverForm');

    // Store the client ID in the modal's data attribute to preserve it
    if (clientId) {
        currentClient = clientId;
        modal.dataset.clientId = clientId;
    } else if (!currentClient && modal.dataset.clientId) {
        // Restore from modal's data attribute if currentClient is null
        currentClient = modal.dataset.clientId;
    }

    title.textContent = serverName ? 'Edit Server' : 'Add Server';

    document.getElementById('serverName').value = serverName || '';
    document.getElementById('serverName').disabled = false; // Always editable


    document.getElementById('serverCommand').value = serverConfig?.command || '';
    document.getElementById('serverArgs').value = serverConfig?.args?.join('\n') || '';

    // Set JSON editor content
    document.getElementById('jsonEditor').value = JSON.stringify(serverConfig || {}, null, 2);

    const envVarsDiv = document.getElementById('envVars');
    envVarsDiv.innerHTML = '';
    const loadedEnvKeys = [];

    if (serverConfig?.env) {
        for (const entry of Object.entries(serverConfig.env)) {
            const key = entry[0];
            const value = entry[1];
            addEnvVarRow(envVarsDiv, key, value);
            loadedEnvKeys.push(key);
        }
    }
    envVarsDiv.dataset.initialKeys = JSON.stringify(loadedEnvKeys);

    document.getElementById('addEnvVar').removeEventListener('click', addEnvVarRow);
    const addEnvVarButton = document.getElementById('addEnvVar');
    addEnvVarButton.onclick = null; // Clear any previous handlers
    addEnvVarButton.onclick = () => addEnvVarRow(envVarsDiv);


    // Attach event listeners to dynamically added 'Copy' buttons for individual env vars
    envVarsDiv.addEventListener('click', async (e) => {
        if (e.target.classList.contains('copy-env-var-btn')) {
            const envKey = e.target.dataset.key;
            const envValue = e.target.dataset.value;
            // Get the latest clients list
            const { listClientsApi } = await import('./api.js');
            const allClients = await listClientsApi();
            await showCopySingleEnvVarModal(serverName, envKey, envValue, clientId, allClients, loadClientsCallback || loadClientsFn);
        }
    });

    // Client selection for applying changes (removed as per user request)
    // const serverModalClientSelectionDiv = document.getElementById('serverModalClientSelection');
    // const serverModalClientsDiv = document.getElementById('serverModalClients');
    // const selectAllServerModalClientsBtn = document.getElementById('selectAllServerModalClients');
    // const selectNoneServerModalClientsBtn = document.getElementById('selectNoneServerModalClients');

    // if (serverName) { // Only show client selection when editing an existing server
    //     serverModalClientSelectionDiv.style.display = 'block';
    //     serverModalClientsDiv.innerHTML = '';
    //     clients.forEach(client => {
    //         const item = document.createElement('div');
    //         item.className = 'checkbox-item';
    //         const isChecked = (clientId && client.id === clientId); // Pre-select current client if editing
    //         item.innerHTML = `
    //             <input type="checkbox" id="serverModalClient-${client.id}" value="${client.id}" ${isChecked ? 'checked' : ''}>
    //             <label for="serverModalClient-${client.id}">${client.name}</label>
    //         `;
    //         serverModalClientsDiv.appendChild(item);
    //     });

    //     selectAllServerModalClientsBtn.onclick = () => {
    //         serverModalClientsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    //     };
    //     selectNoneServerModalClientsBtn.onclick = () => {
    //         serverModalClientsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    //     };
    // } else { // Hide client selection when adding a new server
    //     serverModalClientSelectionDiv.style.display = 'none';
    // }

    // Setup tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => switchTab(btn.dataset.tab);
    });

    modal.style.display = 'flex';
    document.getElementById('serverName').focus();

    form.onsubmit = async (e) => {
        e.preventDefault();
        // Double-check we have a valid client before saving
        const modalClient = modal.dataset.clientId || currentClient;
        if (!modalClient) {
            alert('No client selected. Please close this modal and select a client first.');
            return;
        }
        await saveServer(serverName, loadClientServers, renderKanbanBoard, loadClientsFn);
    };
}

async function saveServer(originalName, loadClientServers, renderKanbanBoard, loadClientsFn) {
    // Get the client ID from modal's data attribute or currentClient
    const modal = document.getElementById('serverModal');
    const clientToUse = modal.dataset.clientId || currentClient;

    if (!clientToUse) {
        alert('No client selected. Please close this modal and try again.');
        return;
    }

    let newServerName;
    let serverConfig;
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;

    if (activeTab === 'json') {
        try {
            serverConfig = JSON.parse(document.getElementById('jsonEditor').value);
            newServerName = document.getElementById('serverName').value;

            if (!newServerName) {
                alert('Server name cannot be empty.');
                return;
            }
        } catch (e) {
            alert('Invalid JSON format');
            return;
        }
    } else {
        const nameInput = document.getElementById('serverName');
        newServerName = nameInput.value;

        if (!newServerName) {
            alert('Server name cannot be empty.');
            return;
        }

        try {
            const existingJson = JSON.parse(document.getElementById('jsonEditor').value);
            const formConfig = buildConfigFromForm();
            const mergedConfig = { ...existingJson };

            if (formConfig.command) {
                mergedConfig.command = formConfig.command;
            } else if (document.getElementById('serverCommand').value === '') {
                delete mergedConfig.command;
            }

            if (formConfig.args && formConfig.args.length > 0) {
                mergedConfig.args = formConfig.args;
            } else if (document.getElementById('serverArgs').value === '') {
                delete mergedConfig.args;
            }

            if (mergedConfig.env || formConfig.env) {
                const updatedEnv = { ...(mergedConfig.env || {}) };
                const initialFormKeys = document.getElementById('envVars').dataset.initialKeys;
                const initialKeys = initialFormKeys ? JSON.parse(initialFormKeys) : [];
                const initialKeysSet = new Set(initialKeys);
                const currentFormEnvs = {};
                const currentFormKeys = new Set();
                document.querySelectorAll('.env-var-row').forEach(row => {
                    const key = row.querySelector('.env-key').value;
                    const value = row.querySelector('.env-value').value;
                    if (key) {
                        currentFormKeys.add(key);
                        currentFormEnvs[key] = value;
                    }
                });

                initialKeys.forEach(key => {
                    if (currentFormKeys.has(key)) {
                        updatedEnv[key] = currentFormEnvs[key];
                    } else {
                        delete updatedEnv[key];
                    }
                });

                currentFormKeys.forEach(key => {
                    if (!initialKeysSet.has(key)) {
                        updatedEnv[key] = currentFormEnvs[key];
                    }
                });

                if (Object.keys(updatedEnv).length > 0) {
                    mergedConfig.env = updatedEnv;
                } else {
                    delete mergedConfig.env;
                }
            }
            serverConfig = mergedConfig;
        } catch (e) {
            alert('Could not merge configurations. Please check the JSON tab for errors.');
            return;
        }
    }

    if (originalName && newServerName !== originalName) {
        // Rename operation
        try {
            const renameResponse = await renameServerApi(originalName, newServerName);
            if (!renameResponse.success) {
                throw new Error('Failed to rename server');
            }
        } catch (error) {
            alert('Failed to rename server: ' + error.message);
            return;
        }
    }

    const serverToSaveName = newServerName;

    try {
        let response;
        if (originalName) {
            // If originalName exists, it's an edit. Use the (potentially new) serverToSaveName.
            response = await updateServerApi(clientToUse, serverToSaveName, serverConfig);
        } else {
            // If originalName doesn't exist, it's an add. Use the serverToSaveName.
            response = await addServerApi(clientToUse, serverToSaveName, serverConfig);
        }

        if (!response.success) {
            throw new Error(`Failed to save server to client ${clientToUse}`);
        }

        document.getElementById('serverModal').style.display = 'none';
        await loadClientServers();
        if (renderKanbanBoard) {
            await renderKanbanBoard();
        }
        loadClientsFn();
    } catch (error) {
        alert('Failed to save server: ' + error.message);
    }
}

export async function editServer(name, loadClientServers, clientId = null) {
    try {
        // Use the provided clientId, or fallback to currentClient
        const clientToUse = clientId || currentClient;
        if (!clientToUse) {
            throw new Error('No client selected for editing.');
        }
        const config = await getClientConfigApi(clientToUse);
        showServerModal(name, config.servers[name], loadClientServers, null, clientToUse);
    } catch (error) {
        alert('Failed to load server config: ' + error.message);
    }
}

export async function deleteServer(name, loadClientServers, renderKanbanBoard, loadClientsFn, clientId = null) {
    if (!confirm(`Are you sure you want to delete the server "${name}"?`)) {
        return;
    }

    try {
        const clientToDeleteFrom = clientId || currentClient;
        const response = await deleteServerApi(clientToDeleteFrom, name);

        if (response.success) {
            await loadClientServers();
            if (renderKanbanBoard) {
                await renderKanbanBoard();
            }
            loadClientsFn();
            loadClientsFn();
        } else {
            throw new Error('Failed to delete server');
        }
    } catch (error) {
        alert('Failed to delete server: ' + error.message);
    }
}

export function copyServer(serverName, loadClientsFn) {
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
                const response = await copyServerApi(currentClient, serverName, targetClient, targetName);

                if (!response.success) {
                    throw new Error(`Failed to copy to ${targetClient}`);
                }
            }

            modal.style.display = 'none';
            loadClientsFn();
        } catch (error) {
            alert('Failed to copy server: ' + error.message);
        }
    };
}

export async function copyToClipboard(serverName, event, serverConfig = null, clientId = null) {
    try {
        let configToCopy = serverConfig;
        if (!configToCopy) {
            // Use the passed clientId if available, otherwise fall back to currentClient
            const clientToUse = clientId || currentClient;
            if (!clientToUse) {
                throw new Error('No client specified for copy operation');
            }
            const response = await getClientConfigApi(clientToUse);
            configToCopy = response.servers[serverName];
        }

        if (!configToCopy) {
            throw new Error('Server configuration not found.');
        }

        const text = JSON.stringify({
            name: serverName,
            config: configToCopy
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

export async function exportServer(serverName, clientId = null) {
    try {
        const clientToExportFrom = clientId || currentClient;
        const data = await exportServerApi(clientToExportFrom, serverName);

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

export async function exportConfig() {
    try {
        const data = await exportConfigApi(currentClient);

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

export function showImportModal(loadClientServers, renderKanbanBoard, loadClientsFn) {
    const modal = document.getElementById('importModal');
    const form = document.getElementById('importForm');

    modal.style.display = 'flex';
    document.getElementById('importData').value = '';

    form.onsubmit = async (e) => {
        e.preventDefault();

        try {
            const importData = JSON.parse(document.getElementById('importData').value);

            const response = await importConfigApi(currentClient, importData);

            if (response.success) {
                modal.style.display = 'none';
                await loadClientServers();
                loadClientsFn();
            } else {
                throw new Error('Failed to import configuration');
            }
        } catch (error) {
            alert('Failed to import: ' + error.message);
        }
    };
}

// Bulk actions functions
export function updateBulkActions() {
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

export function selectAllServers() {
    document.querySelectorAll('.server-checkbox').forEach(cb => cb.checked = true);
    updateBulkActions();
}

export function deselectAllServers() {
    document.querySelectorAll('.server-checkbox').forEach(cb => cb.checked = false);
    updateBulkActions();
}

export async function deleteSelected(loadClientServers, renderKanbanBoard, loadClientsFn) {
    const checkboxes = document.querySelectorAll('.server-checkbox:checked');
    const serverNames = Array.from(checkboxes).map(cb => cb.dataset.server);

    if (serverNames.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${serverNames.length} server(s)?`)) {
        return;
    }

    let deletedCount = 0;
    for (const serverName of serverNames) {
        try {
            const response = await deleteServerApi(currentClient, serverName);

            if (response.success) {
                deletedCount++;
            }
        } catch (error) {
            // Silently continue with other deletions
        }
    }

    await loadClientServers();
    if (renderKanbanBoard) {
        await renderKanbanBoard();
    }
    loadClientsFn();
}

export async function removeFromAll(serverName, loadClients, loadClientServers, loadClientsFn) {
    if (!confirm(`Are you sure you want to remove "${serverName}" from ALL clients?`)) {
        return;
    }

    let removedCount = 0;
    const errors = [];

    for (const client of clients) {
        try {
            // Check if server exists in this client
            const config = await getClientConfigApi(client.id);

            if (config.servers && config.servers[serverName]) {
                const deleteResponse = await deleteServerApi(client.id, serverName);

                if (deleteResponse.success) {
                    removedCount++;
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
    }

    loadClientsFn();
    await loadClientServers();
}

export const showAddServerToClientsModal = (serverName, serverConfig) => {
    const modal = document.getElementById('addServerToClientsModal');
    document.getElementById('addServerToClientsTitle').textContent = `Add Server ${serverName} to Clients`;
    document.getElementById('addServerToClientsName').textContent = serverName;
    document.getElementById('addServerToClientsConfig').value = JSON.stringify(serverConfig, null, 2);

    const addServerToClientsListDiv = document.getElementById('addServerToClientsList');
    addServerToClientsListDiv.innerHTML = '';
    clients.forEach(client => {
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        item.innerHTML = `
            <input type="checkbox" id="addServerClient-${client.id}" value="${client.id}" checked>
            <label for="addServerClient-${client.id}">${client.name}</label>
        `;
        addServerToClientsListDiv.appendChild(item);
    });

    document.getElementById('selectAllAddServerClients').onclick = () => {
        addServerToClientsListDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    };
    document.getElementById('selectNoneAddServerClients').onclick = () => {
        addServerToClientsListDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    };

    modal.style.display = 'flex';

    document.getElementById('addServerToClientsForm').onsubmit = async (e) => {
        e.preventDefault();
        await addServerToSelectedClients(serverName, serverConfig);
    };
};

const addServerToSelectedClients = async (serverName, serverConfig) => {
    const selectedClientIds = Array.from(document.querySelectorAll('#addServerToClientsList input[type="checkbox"]:checked'))
                                .map(cb => cb.value);

    if (selectedClientIds.length === 0) {
        alert('Please select at least one client to add the server to.');
        return;
    }

    try {
        const response = await addServerToMultipleClientsApi(serverName, serverConfig, selectedClientIds);

        if (response.success) {
            document.getElementById('addServerToClientsModal').style.display = 'none';
            loadClientsCallback(); // Re-render to show changes
        } else {
            throw new Error('Failed to add server to clients');
        }
    } catch (error) {
        alert('Failed to add server to clients: ' + error.message);
    }
};

export const showCopyEnvVarsModal = async (sourceServerName, sourceClientId, allClients, loadClientsFn) => {
    const modal = document.getElementById('copyEnvVarsModal');
    document.getElementById('copyEnvVarsSourceServer').textContent = sourceServerName;
    document.getElementById('copyEnvVarsSourceClient').textContent = allClients.find(c => c.id === sourceClientId).name;

    const sourceClientConfig = await getClientConfigApi(sourceClientId);
    const sourceServerConfig = sourceClientConfig.servers[sourceServerName];
    const envVars = sourceServerConfig.env || {};

    const copyEnvVarSelect = document.getElementById('copyEnvVarSelect');
    copyEnvVarSelect.innerHTML = '';
    for (const key of Object.keys(envVars)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = key;
        copyEnvVarSelect.appendChild(option);
    }

    const copyEnvVarsTargetClientsDiv = document.getElementById('copyEnvVarsTargetClients');
    copyEnvVarsTargetClientsDiv.innerHTML = '';
    clients.forEach(client => {
        if (client.id !== sourceClientId) {
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            item.innerHTML = `
                <input type="checkbox" id="copyEnvClient-${client.id}" value="${client.id}" checked>
                <label for="copyEnvClient-${client.id}">${client.name}</label>
            `;
            copyEnvVarsTargetClientsDiv.appendChild(item);
        }
    });

    document.getElementById('selectAllCopyEnvVarsClients').onclick = () => {
        copyEnvVarsTargetClientsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    };
    document.getElementById('selectNoneCopyEnvVarsClients').onclick = () => {
        copyEnvVarsTargetClientsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    };

    modal.style.display = 'flex';

    document.getElementById('copyEnvVarsForm').onsubmit = async (e) => {
        e.preventDefault();
        const selectedEnvVarKey = copyEnvVarSelect.value;
        const selectedEnvVarValue = envVars[selectedEnvVarKey];
        const targetClientIds = Array.from(document.querySelectorAll('#copyEnvVarsTargetClients input[type="checkbox"]:checked'))
                                    .map(cb => cb.value);

        if (!selectedEnvVarKey) {
            alert('Please select an environment variable to copy.');
            return;
        }
        if (targetClientIds.length === 0) {
            alert('Please select at least one target client.');
            return;
        }

        try {
            for (const clientId of targetClientIds) {
                // Assuming updateServerEnvApi can handle adding new env vars if they don't exist
                await updateServerEnvApi(sourceServerName, selectedEnvVarKey, selectedEnvVarValue, [clientId]);
            }
            document.getElementById('copyEnvVarsModal').style.display = 'none';
            if (typeof loadClientsFn === 'function') {
                loadClientsFn(); // Refresh all clients to show changes
            } else if (typeof loadClientsCallback === 'function') {
                loadClientsCallback(); // Use global callback if loadClientsFn is not available
            }
        } catch (error) {
            alert('Failed to copy environment variable: ' + error.message);
        }
    };
};

    document.getElementById('cancelCopyEnvVars').onclick = () => {
        document.getElementById('copyEnvVarsModal').style.display = 'none';
    };

export const showCopySingleEnvVarModal = async (serverName, envKey, envValue, sourceClientId, allClients, loadClientsFn) => {
    const modal = document.getElementById('copySingleEnvVarModal');
    document.getElementById('copySingleEnvVarKey').textContent = envKey;
    document.getElementById('copySingleEnvVarValue').textContent = envValue;

    // Clear any existing event listeners by cloning the form
    const oldForm = document.getElementById('copySingleEnvVarForm');
    const newForm = oldForm.cloneNode(true);
    oldForm.parentNode.replaceChild(newForm, oldForm);

    // Get reference to the div AFTER cloning the form
    const copySingleEnvVarTargetClientsDiv = document.getElementById('copySingleEnvVarTargetClients');
    copySingleEnvVarTargetClientsDiv.innerHTML = '';

    for (const client of allClients) {
        // Only skip if sourceClientId is valid and matches current client
        if (sourceClientId && client.id === sourceClientId) {
            continue;
        }

        try {
            const clientConfig = await getClientConfigApi(client.id);
            if (clientConfig.servers && clientConfig.servers[serverName]) {
                const item = document.createElement('div');
                item.className = 'checkbox-item';
                item.innerHTML = `
                    <input type="checkbox" id="copySingleEnvClient-${client.id}" value="${client.id}" checked>
                    <label for="copySingleEnvClient-${client.id}">${client.name}</label>
                `;
                copySingleEnvVarTargetClientsDiv.appendChild(item);
            }
        } catch (error) {
            console.warn(`Could not read config for client ${client.id}:`, error);
            // Skip clients that cannot be read
        }
    }

    // Re-attach event handlers after form cloning
    document.getElementById('selectAllCopySingleEnvVarClients').onclick = () => {
        copySingleEnvVarTargetClientsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    };
    document.getElementById('selectNoneCopySingleEnvVarClients').onclick = () => {
        copySingleEnvVarTargetClientsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    };

    modal.style.display = 'flex';

    // Set up cancel button handler when modal is shown
    document.getElementById('cancelCopySingleEnvVar').onclick = () => {
        modal.style.display = 'none';
    };

    // Re-attach form submission handler after cloning
    document.getElementById('copySingleEnvVarForm').onsubmit = async (e) => {
        e.preventDefault();
        const targetClientIds = Array.from(document.querySelectorAll('#copySingleEnvVarTargetClients input[type="checkbox"]:checked'))
                                    .map(cb => cb.value);

        if (targetClientIds.length === 0) {
            alert('Please select at least one target client.');
            return;
        }

        try {
            for (const clientId of targetClientIds) {
                await updateServerEnvApi(serverName, envKey, envValue, [clientId]);
            }
            document.getElementById('copySingleEnvVarModal').style.display = 'none';
            if (typeof loadClientsFn === 'function') {
                loadClientsFn(); // Refresh all clients to show changes
            } else if (typeof loadClientsCallback === 'function') {
                loadClientsCallback(); // Use global callback if loadClientsFn is not available
            }
        } catch (error) {
            alert('Failed to copy environment variable: ' + error.message);
        }
    };
};

