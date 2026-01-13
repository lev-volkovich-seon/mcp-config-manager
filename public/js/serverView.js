import { getAllServersApi, updateServerEnvApi, addServerToMultipleClientsApi } from './api.js';
import { addEnvVarRow } from './utils.js';
import { showServerModal, deleteServer, copyToClipboard, exportServer, removeFromAll } from './modals.js'; // Import from modals.js

let clients = []; // This will be passed from main.js
let loadClientsCallback = null; // Callback to main.js to reload all clients

export function initServerView(allClients, loadClientsFn) {
    clients = allClients;
    loadClientsCallback = loadClientsFn;
}

export async function renderAllServers() {
    const allServersList = document.getElementById('allServersList');
    allServersList.innerHTML = '<p>Loading servers...</p>';
    try {
        const allServers = await getAllServersApi();
        allServersList.innerHTML = ''; // Clear loading message

        if (Object.keys(allServers).length === 0) {
            allServersList.innerHTML = '<p class="no-servers">No servers found across all clients.</p>';
            return;
        }

        for (const [serverName, serverData] of Object.entries(allServers)) {
            const card = document.createElement('div');
            card.className = 'server-card-all';

            let clientsHtml = '';
            if (serverData.clients && serverData.clients.length > 0) {
                clientsHtml = '<div class="server-clients"><span class="client-badges-label">Clients:</span><div class="client-badges">';
                clientsHtml += serverData.clients.map(c => `<span class="client-badge client-badge-${c.id}">${c.name}</span>`).join('');
                clientsHtml += '</div></div>';
            }

            let envHtml = '';
            if (serverData.config && serverData.config.env && Object.keys(serverData.config.env).length > 0) {
                envHtml = '<div class="env-list"><strong>Environment:</strong><br>';
                for (const [key, value] of Object.entries(serverData.config.env)) {
                    const displayValue = value.includes('KEY') || value.includes('SECRET')
                        ? value.substring(0, 4) + '***'
                        : value;
                    envHtml += `${key}: ${displayValue}<br>`;
                }
                envHtml += '</div>';
            }

            // Build transport info for remote servers (type/url)
            let transportHtml = '';
            if (serverData.config && serverData.config.type) {
                const transportType = serverData.config.type.toUpperCase();
                transportHtml = `<div class="detail-row"><strong>Type:</strong> <span class="transport-badge transport-${serverData.config.type}">${transportType}</span></div>`;
                if (serverData.config.url) {
                    transportHtml += `<div class="detail-row"><strong>URL:</strong> ${serverData.config.url}</div>`;
                }
            }

            card.innerHTML = `
                <div class="server-header-all">
                    <div class="server-name-row">
                        <span class="server-name-all">${serverName}</span>
                        ${serverData.global ? '<span class="global-tag">Global</span>' : ''}
                    </div>
                    <div class="server-actions-all">
                        <button class="btn btn-small btn-secondary edit-server-full-btn" data-server-name="${serverName}" data-clients='${JSON.stringify(serverData.clients)}' data-server-config='${JSON.stringify(serverData.config)}'>Edit</button>
                        <button class="btn btn-small btn-secondary add-to-clients-btn" data-server-name="${serverName}" data-server-config='${JSON.stringify(serverData.config)}'>Add to Clients</button>
                        <button class="icon-btn copy-to-clipboard-server-view-btn" data-server-name="${serverName}" data-server-config='${JSON.stringify(serverData.config)}' title="Copy">📋</button>
                        <button class="icon-btn export-server-view-btn" data-server-name="${serverName}" title="Export">💾</button>
                        <button class="icon-btn icon-btn-danger delete-server-view-btn" data-server-name="${serverName}" title="Delete">🗑️</button>
                    </div>
                </div>
                <div class="server-details-all">
                    ${transportHtml}
                    ${serverData.config && serverData.config.command ? `<div class="detail-row"><span class="detail-label">Command</span><span class="detail-value">${serverData.config.command}</span></div>` : ''}
                    ${serverData.config && serverData.config.args ? `<div class="detail-row"><span class="detail-label">Args</span><span class="detail-value">${serverData.config.args.join(' ')}</span></div>` : ''}
                    ${envHtml}
                    ${clientsHtml}
                </div>
            `;
            allServersList.appendChild(card);
        }
        attachServerViewEventListeners();
    } catch (error) {
        console.error('Failed to load all servers:', error);
        allServersList.innerHTML = '<p class="error-state">Error loading servers.</p>';
    }
}

function attachServerViewEventListeners() {
    document.querySelectorAll('.edit-server-full-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const serverName = e.currentTarget.dataset.serverName;
            const serverConfig = JSON.parse(e.currentTarget.dataset.serverConfig);
            const clients = JSON.parse(e.currentTarget.dataset.clients);
            const clientIds = clients.map(c => c.id);
            showServerModal(serverName, serverConfig, renderAllServers, null, clientIds, loadClientsCallback);
        });
    });

    document.querySelectorAll('.add-to-clients-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const serverName = e.target.dataset.serverName;
            const serverConfig = JSON.parse(e.target.dataset.serverConfig);
            showAddServerToClientsModal(serverName, serverConfig);
        });
    });

    document.querySelectorAll('.copy-to-clipboard-server-view-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const serverName = e.target.dataset.serverName;
            const serverConfig = JSON.parse(e.target.dataset.serverConfig);
            copyToClipboard(serverName, e, serverConfig); // Pass serverConfig
        });
    });

    document.querySelectorAll('.export-server-view-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const serverName = e.target.dataset.serverName;
            exportServer(serverName);
        });
    });

    document.querySelectorAll('.delete-server-view-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const serverName = e.target.dataset.serverName;
            if (!confirm(`Are you sure you want to delete the server "${serverName}" from ALL clients?`)) {
                return;
            }
            removeFromAll(serverName, null, renderAllServers, loadClientsCallback); // Pass renderAllServers to re-render
        });
    });
}

export const showEditServerEnvModal = (serverName, currentEnv) => {
    const modal = document.getElementById('editServerEnvModal');
    document.getElementById('editServerEnvTitle').textContent = `Edit Environment Variable for Server ${serverName}`;
    document.getElementById('editServerEnvName').textContent = serverName;

    const editEnvVarsDiv = document.getElementById('editEnvVars');
    editEnvVarsDiv.innerHTML = `
        <div class="form-group">
            <label for="envVarKeySelect">Environment Variable Key</label>
            <select id="envVarKeySelect">
                <option value="">-- Select or type new --</option>
                ${Object.keys(currentEnv).map(key => `<option value="${key}">${key}</option>`).join('')}
            </select>
            <input type="text" id="newEnvVarKeyInput" placeholder="Type new key if not in list" style="margin-top: 5px;">
        </div>
        <div class="form-group">
            <label for="envVarValueInput">Environment Variable Value</label>
            <input type="text" id="envVarValueInput">
        </div>
    `;

    // Pre-fill value if an existing key is selected
    document.getElementById('envVarKeySelect').onchange = (e) => {
        const selectedKey = e.target.value;
        document.getElementById('newEnvVarKeyInput').value = selectedKey;
        document.getElementById('envVarValueInput').value = currentEnv[selectedKey] || '';
    };

    // Sync new key input with select
    document.getElementById('newEnvVarKeyInput').oninput = (e) => {
        const inputVal = e.target.value;
        const select = document.getElementById('envVarKeySelect');
        let found = false;
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === inputVal) {
                select.value = inputVal;
                found = true;
                break;
            }
        }
        if (!found) {
            select.value = ""; // Reset select if input doesn't match an option
        }
    };

    const editEnvClientsDiv = document.getElementById('editEnvClients');
    editEnvClientsDiv.innerHTML = '';
    clients.forEach(client => {
        const item = document.createElement('div');
        item.className = 'checkbox-item';
        item.innerHTML = `
            <input type="checkbox" id="editEnvClient-${client.id}" value="${client.id}" checked>
            <label for="editEnvClient-${client.id}">${client.name}</label>
        `;
        editEnvClientsDiv.appendChild(item);
    });

    document.getElementById('selectAllEditEnvClients').onclick = () => {
        editEnvClientsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    };
    document.getElementById('selectNoneEditEnvClients').onclick = () => {
        editEnvClientsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    };

    // Add 'Apply to all servers' checkbox
    const applyToAllServersDiv = document.createElement('div');
    applyToAllServersDiv.className = 'form-group checkbox-item';
    applyToAllServersDiv.innerHTML = `
        <input type="checkbox" id="applyToAllServers" value="true">
        <label for="applyToAllServers">Apply to all servers in selected clients</label>
    `;
    editEnvClientsDiv.parentNode.insertBefore(applyToAllServersDiv, editEnvClientsDiv.nextSibling);

    modal.style.display = 'flex';

    document.getElementById('editServerEnvForm').onsubmit = async (e) => {
        e.preventDefault();
        const envKey = document.getElementById('newEnvVarKeyInput').value;
        const envValue = document.getElementById('envVarValueInput').value;
        const applyToAll = document.getElementById('applyToAllServers').checked;
        await saveEditedServerEnv(serverName, envKey, envValue, applyToAll);
    };
};

const saveEditedServerEnv = async (serverName, envKey, envValue, applyToAll) => {
    if (!envKey) {
        alert('Environment variable key cannot be empty.');
        return;
    }

    const selectedClientIds = Array.from(document.querySelectorAll('#editEnvClients input[type="checkbox"]:checked'))
                                .map(cb => cb.value);

    if (selectedClientIds.length === 0) {
        alert('Please select at least one client to apply changes.');
        return;
    }

    try {
        if (applyToAll) {
            // Apply to all servers in selected clients
            for (const clientId of selectedClientIds) {
                const clientConfig = await getClientConfigApi(clientId);
                for (const sName of Object.keys(clientConfig.servers)) {
                    await updateServerEnvApi(sName, envKey, envValue, [clientId]);
                }
            }
        } else {
            // Apply only to the specific server in selected clients
            const response = await updateServerEnvApi(serverName, envKey, envValue, selectedClientIds);
            if (!response.success) {
                throw new Error(`Failed to update ${envKey}`);
            }
        }

        document.getElementById('editServerEnvModal').style.display = 'none';
        alert('Environment variable updated successfully!');
        renderAllServers(); // Re-render to show changes
    } catch (error) {
        alert('Failed to save environment variable: ' + error.message);
    }
};

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
            alert(`Server ${serverName} added to selected clients successfully!`);
            renderAllServers(); // Re-render to show changes
        } else {
            throw new Error('Failed to add server to clients');
        }
    } catch (error) {
        alert('Failed to add server to clients: ' + error.message);
    }
};