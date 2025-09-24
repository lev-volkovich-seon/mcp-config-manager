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
        // When switching to JSON tab, update only the fields that form controls
        try {
            const existingJson = JSON.parse(document.getElementById('jsonEditor').value);
            const formConfig = buildConfigFromForm();

            // Merge form data into existing JSON, preserving other properties
            const mergedConfig = { ...existingJson };

            // Update command - if empty in form, remove from JSON
            if (formConfig.command) {
                mergedConfig.command = formConfig.command;
            } else if (document.getElementById('serverCommand').value === '') {
                delete mergedConfig.command;
            }

            // Update args - if empty in form, remove from JSON
            if (formConfig.args && formConfig.args.length > 0) {
                mergedConfig.args = formConfig.args;
            } else if (document.getElementById('serverArgs').value === '') {
                delete mergedConfig.args;
            }

            // For env vars, only update/remove the ones that were shown in form
            // Preserve any env vars that weren't displayed in the form
            if (mergedConfig.env || formConfig.env) {
                // Start with ALL existing env vars (including ones not shown in form)
                const updatedEnv = { ...(mergedConfig.env || {}) };

                // Get the keys that were initially loaded into the form
                const initialFormKeys = document.getElementById('envVars').dataset.initialKeys;
                const initialKeys = initialFormKeys ? JSON.parse(initialFormKeys) : [];

                // Create a set of initial keys for quick lookup
                const initialKeysSet = new Set(initialKeys);

                // Get the current state of form env vars
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

                // Update or remove only the env vars that were initially shown in the form
                initialKeys.forEach(key => {
                    if (currentFormKeys.has(key)) {
                        // Key still exists in form, update its value
                        updatedEnv[key] = currentFormEnvs[key];
                    } else {
                        // Key was removed from form, delete it
                        delete updatedEnv[key];
                    }
                });

                // Add any NEW env vars that were added in the form
                currentFormKeys.forEach(key => {
                    if (!initialKeysSet.has(key)) {
                        // This is a new key added in the form
                        updatedEnv[key] = currentFormEnvs[key];
                    }
                });

                if (Object.keys(updatedEnv).length > 0) {
                    mergedConfig.env = updatedEnv;
                } else {
                    delete mergedConfig.env;
                }
            }

            document.getElementById('jsonEditor').value = JSON.stringify(mergedConfig, null, 2);
        } catch (e) {
            // If existing JSON is invalid, just use form data
            const config = buildConfigFromForm();
            document.getElementById('jsonEditor').value = JSON.stringify(config, null, 2);
        }
    } else {
        // When switching to form tab, only update form with supported fields
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
    // Only sync the supported fields to the form, ignore any other JSON properties
    document.getElementById('serverCommand').value = config.command || '';
    document.getElementById('serverArgs').value = config.args?.join('\n') || '';

    const envVarsDiv = document.getElementById('envVars');
    envVarsDiv.innerHTML = '';

    // Track which env keys we're loading into the form
    const loadedEnvKeys = [];
    if (config.env && typeof config.env === 'object') {
        for (const [key, value] of Object.entries(config.env)) {
            addEnvVarRow(envVarsDiv, key, value);
            loadedEnvKeys.push(key);
        }
    }

    // Store the initially loaded keys so we know what to update later
    envVarsDiv.dataset.initialKeys = JSON.stringify(loadedEnvKeys);
}
