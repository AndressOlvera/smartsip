requireAuth();

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnHoy').addEventListener('click', mostrarHoy);
    document.getElementById('btnSemana').addEventListener('click', mostrarSemana);
    loadTodayConsumption();
    loadWeeklyConsumption();
});

function mostrarHoy() {
    document.getElementById('vistaHoy').classList.remove('hidden');
    document.getElementById('vistaSemana').classList.add('hidden');
    document.getElementById('btnHoy').classList.add('active');
    document.getElementById('btnSemana').classList.remove('active');
}

function mostrarSemana() {
    document.getElementById('vistaHoy').classList.add('hidden');
    document.getElementById('vistaSemana').classList.remove('hidden');
    document.getElementById('btnHoy').classList.remove('active');
    document.getElementById('btnSemana').classList.add('active');
}

async function loadTodayConsumption() {
    try {
        showLoading('Cargando consumo de hoy...');
        const data = await apiRequest('/api/consumption/today');
        document.getElementById('today-goal').textContent = data.goalLiters == null ? 'N/A' : litersText(data.goalLiters);
        document.getElementById('today-current').textContent = litersText(data.currentLiters);
        document.getElementById('today-percent').textContent = `${data.percentage}% del objetivo`;
        document.getElementById('progress-fill').style.width = `${data.percentage}%`;
        hideLoading();
    } catch (error) {
        hideLoading();
        alert(error.message);
    }
}

async function loadWeeklyConsumption() {
    try {
        const data = await apiRequest('/api/consumption/weekly');
        const chart = document.getElementById('weekly-chart');
        chart.innerHTML = '';

        if (!data.bars || !data.bars.length) {
            chart.innerHTML = '<p class="weekly-empty-text">Aún no hay suficientes registros semanales para mostrar la gráfica.</p>';
            return;
        }

        const maxValue = Math.max(...data.bars.map(bar => Number(bar.liters)), 3);

        data.bars.forEach((barData) => {
            const column = document.createElement('div');
            column.className = 'bar-column';

            const value = document.createElement('div');
            value.className = 'bar-value';
            value.textContent = litersText(barData.liters);

            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = `${Math.max((Number(barData.liters) / maxValue) * 210, 10)}px`;

            const label = document.createElement('div');
            label.className = 'bar-label';
            label.textContent = barData.label;
            label.title = barData.dateKey || '';

            column.appendChild(value);
            column.appendChild(bar);
            column.appendChild(label);
            chart.appendChild(column);
        });
    } catch (error) {
        alert(error.message);
    }
}
