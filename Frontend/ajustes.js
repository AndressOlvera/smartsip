let cachedProfile = null;
let pendingProfileImage = '';

requireAuth();

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnGuardar').addEventListener('click', guardarInformacion);
    document.getElementById('logout-btn').addEventListener('click', cerrarSesion);
    document.getElementById('btn-select-image').addEventListener('click', () => {
        document.getElementById('profile-image-input').click();
    });
    document.getElementById('profile-image-input').addEventListener('change', previewProfileImage);
    document.getElementById('btn-save-image').addEventListener('click', guardarImagenPerfil);
    loadProfile();
});

function ocultarVistas() {
    document.getElementById('vista-ajustes').classList.add('hidden');
    document.getElementById('vista-informacion').classList.add('hidden');
    document.getElementById('vista-imagen').classList.add('hidden');
}

function mostrarInformacion() {
    ocultarVistas();
    document.getElementById('vista-informacion').classList.remove('hidden');
}

function mostrarImagenPerfil() {
    ocultarVistas();
    document.getElementById('vista-imagen').classList.remove('hidden');
}

function volverAjustes() {
    ocultarVistas();
    document.getElementById('vista-ajustes').classList.remove('hidden');
}

async function loadProfile() {
    try {
        showLoading('Cargando información...');
        const data = await apiRequest('/api/users/me');
        cachedProfile = data;
        document.getElementById('info-first-name').value = data.firstName || '';
        document.getElementById('info-second-name').value = data.secondName || '';
        document.getElementById('info-last-name').value = data.lastName || '';
        document.getElementById('info-email').value = data.email || '';
        document.getElementById('info-password').value = data.passwordMask || '********';
        document.getElementById('profile-preview').src = data.profileImage || 'imgs/User.jpg';
        document.getElementById('profile-image-note').textContent = data.profileImage ? 'Tu imagen de perfil actual está cargada.' : 'Actualmente estás usando la imagen por defecto.';
        const toggle = document.getElementById('dark-mode-toggle');
        toggle.classList.toggle('active', !!data.darkMode);
        setDarkModeState(!!data.darkMode);
        hideLoading();
    } catch (error) {
        hideLoading();
        alert(error.message);
    }
}

function toggleEditar() {
    const inputs = document.querySelectorAll('.info-input');
    const btnEditar = document.getElementById('btnEditar');
    const btnGuardar = document.getElementById('btnGuardar');
    let editando = btnEditar.dataset.editando === 'true';

    if (!editando) {
        inputs.forEach(input => input.disabled = false);
        btnEditar.textContent = 'Cancelar';
        btnEditar.dataset.editando = 'true';
        btnGuardar.classList.remove('hidden');
    } else {
        inputs.forEach(input => input.disabled = true);
        btnEditar.textContent = 'Cambiar información';
        btnEditar.dataset.editando = 'false';
        btnGuardar.classList.add('hidden');
        if (cachedProfile) {
            document.getElementById('info-first-name').value = cachedProfile.firstName || '';
            document.getElementById('info-second-name').value = cachedProfile.secondName || '';
            document.getElementById('info-last-name').value = cachedProfile.lastName || '';
            document.getElementById('info-email').value = cachedProfile.email || '';
            document.getElementById('info-password').value = '********';
        }
    }
}

async function guardarInformacion() {
    const payload = {
        firstName: document.getElementById('info-first-name').value.trim(),
        secondName: document.getElementById('info-second-name').value.trim(),
        lastName: document.getElementById('info-last-name').value.trim(),
        email: document.getElementById('info-email').value.trim(),
        password: document.getElementById('info-password').value
    };

    try {
        showLoading('Guardando cambios...');
        const data = await apiRequest('/api/users/me', 'PATCH', payload);
        hideLoading();
        showPopup(data.message);
        document.getElementById('btnEditar').dataset.editando = 'true';
        toggleEditar();
        loadProfile();
    } catch (error) {
        hideLoading();
        alert(error.message);
    }
}

function previewProfileImage(event) {
    const file = event.target.files && event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Selecciona un archivo de imagen válido.');
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        alert('La imagen debe pesar máximo 2 MB.');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(loadEvent) {
        pendingProfileImage = loadEvent.target.result || '';
        document.getElementById('profile-preview').src = pendingProfileImage || 'imgs/User.jpg';
        document.getElementById('btn-save-image').classList.remove('hidden');
        document.getElementById('profile-image-note').textContent = 'Vista previa lista. Guarda la imagen para aplicarla.';
    };
    reader.readAsDataURL(file);
}

async function guardarImagenPerfil() {
    if (!pendingProfileImage) {
        alert('Selecciona una imagen antes de guardarla.');
        return;
    }

    try {
        showLoading('Guardando imagen...');
        const data = await apiRequest('/api/users/profile-image', 'PATCH', { profileImage: pendingProfileImage });
        hideLoading();
        pendingProfileImage = '';
        document.getElementById('btn-save-image').classList.add('hidden');
        document.getElementById('profile-image-input').value = '';
        document.getElementById('profile-image-note').textContent = 'Imagen de perfil actualizada correctamente.';
        document.getElementById('profile-preview').src = data.profileImage || 'imgs/User.jpg';
        showPopup(data.message);
        loadProfile();
    } catch (error) {
        hideLoading();
        alert(error.message);
    }
}

async function toggleModoOscuro(boton) {
    const enabled = !boton.classList.contains('active');
    boton.classList.toggle('active', enabled);
    setDarkModeState(enabled);

    try {
        await apiRequest('/api/users/dark-mode', 'PATCH', { darkMode: enabled });
    } catch (error) {
        alert(error.message);
    }
}

async function cerrarSesion() {
    try {
        showLoading('Cerrando sesión...');
        await apiRequest('/api/auth/logout', 'POST', {}, true);
    } catch (error) {
        console.log(error.message);
    }
    hideLoading();
    clearSession();
    window.location.href = 'onboarding1.html';
}
