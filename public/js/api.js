export async function detectClientsApi() {
    const response = await fetch('/api/clients/detect');
    return response.json();
}

export async function listClientsApi() {
    const response = await fetch('/api/clients');
    return response.json();
}

export async function getAllServersApi() {
    const response = await fetch('/api/servers');
    return response.json();
}

export async function getClientConfigApi(client) {
    const response = await fetch(`/api/clients/${client}`);
    return response.json();
}

export async function addServerApi(client, server, config) {
    const response = await fetch(`/api/clients/${client}/servers/${server}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    });
    return response.json();
}

export async function addServerToMultipleClientsApi(serverName, serverConfig, clientIds) {
    const response = await fetch('/api/servers/add-to-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverName, serverConfig, clientIds }),
    });
    return response.json();
}

export async function deleteServerApi(client, server) {
    const response = await fetch(`/api/clients/${client}/servers/${server}`, {
        method: 'DELETE',
    });
    return response.json();
}

export async function updateServerApi(client, server, config) {
    const response = await fetch(`/api/clients/${client}/servers/${server}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    });
    return response.json();
}

export async function updateServerInClientsApi(serverName, serverConfig, clientIds) {
    const response = await fetch(`/api/servers/${serverName}/update-in-clients`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverConfig, clientIds }),
    });
    return response.json();
}

export async function updateServerEnvApi(serverName, envKey, envValue, clientIds) {
    const response = await fetch(`/api/servers/${serverName}/env`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envKey, envValue, clientIds }),
    });
    return response.json();
}

export async function renameServerApi(oldName, newName) {
    const response = await fetch(`/api/servers/${oldName}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName }),
    });
    return response.json();
}

export async function copyServerApi(fromClient, fromServer, toClient, toServer) {
    const response = await fetch('/api/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromClient, fromServer, toClient, toServer }),
    });
    return response.json();
}

export async function exportConfigApi(client) {
    const response = await fetch(`/api/export/${client}`);
    return response.json();
}

export async function exportServerApi(client, server) {
    const response = await fetch(`/api/export/${client}?server=${server}`);
    return response.json();
}

export async function importConfigApi(client, data) {
    const response = await fetch(`/api/import/${client}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return response.json();
}
