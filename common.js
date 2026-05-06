const API_BASE = '';

function getToken() {
    return localStorage.getItem('token') || '';
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('darkMode');
}

function showLoading(text = 'Cargando...') {
    let overlay = document.getElementById('loading-overlay');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-card">
                <div class="loading-spinner"></div>
                <p id="loading-text">${text}</p>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        document.getElementById('loading-text').textContent = text;
        overlay.classList.remove('hidden');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

function handleUnauthorized() {
    clearSession();
    window.location.href = 'onboarding1.html';
}

function showPopup(message = 'Operación completada') {
    let popup = document.getElementById('popup-overlay');

    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'popup-overlay';
        popup.className = 'popup-overlay';
        popup.innerHTML = `
            <div class="popup-card">
                <p id="popup-message"></p>
                <button type="button" class="popup-btn" id="popup-close-btn">Aceptar</button>
            </div>
        `;
        document.body.appendChild(popup);
        document.getElementById('popup-close-btn').addEventListener('click', () => {
            popup.classList.add('hidden');
        });
        popup.addEventListener('click', (event) => {
            if (event.target === popup) {
                popup.classList.add('hidden');
            }
        });
    }

    document.getElementById('popup-message').textContent = message;
    popup.classList.remove('hidden');
}

async function apiRequest(url, method = 'GET', body = null, withAuth = true) {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (withAuth) {
        headers['Authorization'] = getToken();
    }

    const response = await fetch(`${API_BASE}${url}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
    });

    let data = {};
    try {
        data = await response.json();
    } catch (error) {
        data = {};
    }

    if (response.status === 401) {
        if (withAuth) {
            handleUnauthorized();
        }
        throw new Error(data.message || 'No autorizado');
    }

    if (!response.ok) {
        throw new Error(data.message || 'Ocurrió un error en la solicitud');
    }

    return data;
}

function requireAuth() {
    if (!getToken()) {
        window.location.href = 'onboarding1.html';
    }
}

function litersText(value) {
    if (value == null || Number.isNaN(Number(value))) return 'N/A';
    return `${Number(value).toFixed(2)}L`;
}

function setDarkModeState(enabled) {
    if (enabled) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'true');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'false');
    }
}

function applyDarkModeFromStorage() {
    const enabled = localStorage.getItem('darkMode') === 'true';
    if (enabled) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

document.addEventListener('DOMContentLoaded', applyDarkModeFromStorage);
