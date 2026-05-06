document.addEventListener('DOMContentLoaded', () => {
    if (getToken()) {
        window.location.href = 'home.html';
        return;
    }

    const form = document.getElementById('login-form');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        try {
            showLoading('Iniciando sesión...');
            const data = await apiRequest('/api/auth/login', 'POST', { email, password }, false);
            setToken(data.token);
            hideLoading();
            window.location.href = 'home.html';
        } catch (error) {
            hideLoading();
            alert(error.message);
        }
    });
});
