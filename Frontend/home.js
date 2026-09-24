let selectedCategory = 'comida';

requireAuth();

document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('#home-category-buttons .segment-btn');
    const rangeAgregar = document.getElementById('range-agregar');
    const rangeEliminar = document.getElementById('range-eliminar');
    const agregarValor = document.getElementById('agregar-valor');
    const eliminarValor = document.getElementById('eliminar-valor');

    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            buttons.forEach((item) => item.classList.remove('active'));
            button.classList.add('active');
            selectedCategory = button.dataset.category;
        });
    });

    rangeAgregar.addEventListener('input', () => {
        agregarValor.textContent = Number(rangeAgregar.value).toFixed(1);
    });

    rangeEliminar.addEventListener('input', () => {
        eliminarValor.textContent = Number(rangeEliminar.value).toFixed(1);
    });

    document.getElementById('btn-agregar').addEventListener('click', addConsumption);
    document.getElementById('btn-eliminar').addEventListener('click', removeConsumption);

    loadHomeSummary();
});

async function loadHomeSummary() {
    try {
        showLoading('Cargando inicio...');
        const data = await apiRequest('/api/home/summary');
        document.getElementById('home-date').textContent = data.currentDate;
        document.getElementById('home-name').textContent = `Hola, ${data.firstName}`;
        document.getElementById('home-today').textContent = data.todayText;
        document.getElementById('home-remaining').textContent = data.remainingText;
        document.getElementById('home-avatar').src = data.profileImage || 'imgs/User.jpg';
        hideLoading();
    } catch (error) {
        hideLoading();
        alert(error.message);
    }
}

async function addConsumption() {
    const amountLiters = Number(document.getElementById('range-agregar').value);

    try {
        showLoading('Agregando consumo...');
        const data = await apiRequest('/api/consumption/add', 'POST', {
            amountLiters,
            category: selectedCategory
        });
        document.getElementById('range-agregar').value = 0;
        document.getElementById('agregar-valor').textContent = '0.0';
        updateHomeSummary(data.summary);
        hideLoading();
        alert(data.message);
    } catch (error) {
        hideLoading();
        alert(error.message);
    }
}

async function removeConsumption() {
    const amountLiters = Number(document.getElementById('range-eliminar').value);

    try {
        showLoading('Eliminando consumo...');
        const data = await apiRequest('/api/consumption/remove', 'POST', { amountLiters });
        document.getElementById('range-eliminar').value = 0;
        document.getElementById('eliminar-valor').textContent = '0.0';
        updateHomeSummary(data.summary);
        hideLoading();
        alert(data.message);
    } catch (error) {
        hideLoading();
        alert(error.message);
    }
}

function updateHomeSummary(summary) {
    document.getElementById('home-date').textContent = summary.currentDate;
    document.getElementById('home-name').textContent = `Hola, ${summary.firstName}`;
    document.getElementById('home-today').textContent = summary.todayText;
    document.getElementById('home-remaining').textContent = summary.remainingText;
    document.getElementById('home-avatar').src = summary.profileImage || 'imgs/User.jpg';
}
