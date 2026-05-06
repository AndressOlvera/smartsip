document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('register-form');
    const password = document.getElementById('register-password');
    const confirmPassword = document.getElementById('register-confirm-password');

    function validatePasswords() {
        confirmPassword.setCustomValidity('');
        if (password.value !== confirmPassword.value) {
            confirmPassword.setCustomValidity('Las contraseñas no coinciden');
        }
    }

    password.addEventListener('input', validatePasswords);
    confirmPassword.addEventListener('input', validatePasswords);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        validatePasswords();

        if (!form.reportValidity()) {
            return;
        }

        const payload = {
            firstName: document.getElementById('register-first-name').value.trim(),
            secondName: document.getElementById('register-second-name').value.trim(),
            lastName: document.getElementById('register-last-name').value.trim(),
            email: document.getElementById('register-email').value.trim(),
            password: password.value
        };

        try {
            showLoading('Creando cuenta...');
            const data = await apiRequest('/api/auth/register', 'POST', payload, false);
            hideLoading();
            alert(data.message);
            window.location.href = 'login.html';
        } catch (error) {
            hideLoading();
            alert(error.message);
        }
    });
});
