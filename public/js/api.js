const API_URL = 'http://localhost:3456/api';

export async function detectClientsApi() {
    const response = await fetch(`${API_URL}/clients/detect`);
    return response.json();
}

export async function listClientsApi() {
    const response = await fetch(`${API_URL}/clients`);
    return response.json();
}

export async function getClientConfigApi(clientId) {
    const response = await fetch(`${API_URL}/clients/${clientId}`);
    return response.json();
}

export async function addServerApi(clientId, serverName, serverConfig) {
    const response = await fetch(`${API_URL}/clients/${clientId}/servers/${serverName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverConfig)
    });
    return response.json();
}

export async function updateServerApi(clientId, serverName, serverConfig) {
    const response = await fetch(`${API_URL}/clients/${clientId}/servers/${serverName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverConfig)
    });
    return response.json();
}

export async function deleteServerApi(clientId, serverName) {
    const response = await fetch(`${API_URL}/clients/${clientId}/servers/${serverName}`, {
        method: 'DELETE'
    });
    return response.json();
}

export async function copyServerApi(fromClient, fromServer, toClient, toServer) {
    const response = await fetch(`${API_URL}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromClient, fromServer, toClient, toServer })
    });
    return response.json();
}

export async function exportConfigApi(clientId) {
    const response = await fetch(`${API_URL}/export/${clientId}`);
    return response.json();
}

export async function exportServerApi(clientId, serverName) {
    const response = await fetch(`${API_URL}/export/${clientId}?server=${serverName}`);
    return response.json();
}

export async function importConfigApi(clientId, importData) {
    const response = await fetch(`${API_URL}/import/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importData)
    });
    return response.json();
}

export async function getAllServersApi() {
    const response = await fetch(`${API_URL}/servers`);
    return response.json();
}

export async function addServerToMultipleClientsApi(serverName, serverConfig, clientIds) {
    const response = await fetch(`${API_URL}/servers/add-to-clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverName, serverConfig, clientIds })
    });
    return response.json();
}

export async function updateServerEnvApi(serverName, envKey, envValue, clientIds) {
    const response = await fetch(`${API_URL}/servers/${serverName}/env`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envKey, envValue, clientIds })
    });
    return response.json();
}

export async function renameServerApi(oldName, newName) {
    const response = await fetch(`${API_URL}/servers/${oldName}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName })
    });
    return response.json();
}
