export function addEnvVarRow(envVarsDiv, key = '', value = '') {
    const row = document.createElement('div');
    row.className = 'env-var-row';

    row.innerHTML = `
        <input type="text" placeholder="Key" value="${key}" class="env-key">
        <input type="text" placeholder="Value" value="${value}" class="env-value">
        <button type="button" class="icon-btn secondary copy-env-var-btn" data-key="${key}" data-value="${value}" title="Copy">➡️</button>
        <button type="button" class="icon-btn danger" onclick="this.parentElement.remove()" title="Remove">🗑️</button>
    `;

    envVarsDiv.appendChild(row);
}

export function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    document.getElementById('formTab').style.display = tab === 'form' ? 'block' : 'none';
    document.getElementById('jsonTab').style.display = tab === 'json' ? 'block' : 'none';

    // Disable/enable form validation based on active tab
    const formControls = document.querySelectorAll('#formTab input, #formTab textarea');
    const jsonControls = document.querySelectorAll('#jsonTab textarea');

    if (tab === 'json') {
        // Disable validation on form tab controls when JSON tab is active
        formControls.forEach(control => {
            control.setAttribute('data-original-required', control.hasAttribute('required'));
            control.removeAttribute('required');
        });
        // Ensure JSON editor doesn't have required attribute either
        jsonControls.forEach(control => {
            control.removeAttribute('required');
        });
    } else {
        // Restore validation on form tab controls when form tab is active
        formControls.forEach(control => {
            if (control.getAttribute('data-original-required') === 'true') {
                control.setAttribute('required', '');
            }
            control.removeAttribute('data-original-required');
        });
        // Disable validation on JSON tab controls
        jsonControls.forEach(control => {
            control.removeAttribute('required');
        });
    }

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

export function buildConfigFromForm() {
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

export function updateFormFromConfig(config) {
    document.getElementById('serverCommand').value = config.command || '';
    document.getElementById('serverArgs').value = config.args?.join('\n') || '';

    const envVarsDiv = document.getElementById('envVars');
    envVarsDiv.innerHTML = '';
    if (config.env) {
        for (const [key, value] of Object.entries(config.env)) {
            addEnvVarRow(envVarsDiv, key, value);
        }
    }
}
