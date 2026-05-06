let qrScanner = null;
let scanning = false;
let scanHandled = false;

requireAuth();

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-start-scan').addEventListener('click', iniciarCamara);
    document.getElementById('btn-stop-scan').addEventListener('click', detenerCamara);
    updateScanButtons();
    loadScanHistory();
});

function updateScanButtons() {
    const startButton = document.getElementById('btn-start-scan');
    const stopButton = document.getElementById('btn-stop-scan');

    startButton.disabled = scanning;
    stopButton.disabled = !scanning;
    startButton.classList.toggle('active', scanning);
}

async function iniciarCamara() {
    if (scanning) return;

    if (typeof Html5Qrcode === 'undefined') {
        alert('La librería del lector QR no está disponible.');
        return;
    }

    try {
        showLoading('Iniciando cámara...');
        scanHandled = false;
        const cameras = await Html5Qrcode.getCameras();

        if (!cameras || !cameras.length) {
            throw new Error('No se encontró una cámara disponible en este dispositivo.');
        }

        const preferredCamera = cameras[cameras.length - 1].id;
        qrScanner = new Html5Qrcode('reader');

        await qrScanner.start(
            preferredCamera,
            { fps: 10, qrbox: { width: 220, height: 220 } },
            async (decodedText) => {
                if (scanHandled) return;
                scanHandled = true;
                await detenerCamara();
                await procesarQr(decodedText);
            },
            () => {}
        );

        scanning = true;
        updateScanButtons();
        hideLoading();
    } catch (error) {
        hideLoading();
        scanning = false;
        updateScanButtons();
        alert(error.message || 'No se pudo iniciar la cámara. Usa localhost y acepta el permiso del navegador.');
    }
}

async function detenerCamara() {
    if (!qrScanner || !scanning) {
        scanning = false;
        updateScanButtons();
        return;
    }

    try {
        await qrScanner.stop();
        await qrScanner.clear();
    } catch (error) {
        console.log(error.message);
    }

    qrScanner = null;
    scanning = false;
    updateScanButtons();
}

async function procesarQr(qrData) {
    if (!qrData) {
        alert('No se pudo leer un contenido válido del QR.');
        return;
    }

    try {
        showLoading('Procesando QR...');
        const data = await apiRequest('/api/bottles/scan', 'POST', { qrData });
        hideLoading();
        document.getElementById('scan-result-text').textContent = `${data.bottle.bottleName} | Capacidad: ${litersText(data.bottle.totalCapacityLiters)} | Agua consumida: ${litersText(data.bottle.consumedLiters)}`;
        showPopup(data.message);
        loadScanHistory();
    } catch (error) {
        hideLoading();
        alert(error.message);
    }
}

async function loadScanHistory() {
    try {
        const data = await apiRequest('/api/bottles/scans');
        const list = document.getElementById('scan-history-list');
        list.innerHTML = '';

        if (!data.length) {
            list.innerHTML = '<p class="scan-empty-text">Aún no hay escaneos registrados.</p>';
            return;
        }

        data.forEach((scan) => {
            const item = document.createElement('div');
            item.className = 'scan-history-item';
            item.innerHTML = `
                <strong>${scan.bottleName || 'Botella'}</strong>
                <span>${litersText(scan.consumedLiters)} agregados</span>
            `;
            list.appendChild(item);
        });
    } catch (error) {
        console.log(error.message);
    }
}
