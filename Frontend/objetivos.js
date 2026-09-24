let opcionSeleccionada = 'actividad';
let aiConversation = [];

requireAuth();

document.addEventListener('DOMContentLoaded', () => {
    setupToggleGroup('basic-unit-group', 'unit-btn');
    setupToggleGroup('activity-unit-group', 'unit-btn');
    setupToggleGroup('manual-unit-group', 'unit-btn');
    setupToggleGroup('exercise-level-group', 'mini-option');

    document.getElementById('btn-calc-basic').addEventListener('click', guardarObjetivoBasico);
    document.getElementById('btn-calc-activity').addEventListener('click', guardarObjetivoActividad);
    document.getElementById('btn-save-manual').addEventListener('click', guardarObjetivoManual);

    const aiSendBtn = document.getElementById('ai-send-btn');
    const aiChatInput = document.getElementById('ai-chat-input');
    const aiFinalizeBtn = document.getElementById('ai-finalize-btn');

    if (aiSendBtn) aiSendBtn.addEventListener('click', enviarMensajeIA);
    if (aiFinalizeBtn) aiFinalizeBtn.addEventListener('click', finalizarObjetivoIA);
    if (aiChatInput) {
        aiChatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                enviarMensajeIA();
            }
        });
    }

    renderAiConversation();
    loadCurrentGoal();
});

function setupToggleGroup(groupId, className) {
    const group = document.getElementById(groupId);
    if (!group) return;
    const buttons = group.querySelectorAll(`.${className}`);
    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            buttons.forEach((item) => item.classList.remove('active'));
            button.classList.add('active');
        });
    });
}

function getActiveDataValue(groupId, className) {
    const activeButton = document.querySelector(`#${groupId} .${className}.active`);
    return activeButton ? activeButton.dataset.value : '';
}

function seleccionar(boton) {
    let opciones = document.querySelectorAll('.goal-item');
    opciones.forEach(opcion => opcion.classList.remove('active'));
    boton.classList.add('active');
    opcionSeleccionada = boton.dataset.opcion;
}

function ocultarTodasLasVistas() {
    document.getElementById('vista-principal').classList.add('hidden');
    document.getElementById('vista-basica').classList.add('hidden');
    document.getElementById('vista-actividad').classList.add('hidden');
    document.getElementById('vista-manual').classList.add('hidden');
    document.getElementById('vista-ia').classList.add('hidden');
}

function continuarObjetivos() {
    ocultarTodasLasVistas();

    if (opcionSeleccionada === 'basica') {
        document.getElementById('vista-basica').classList.remove('hidden');
    } else if (opcionSeleccionada === 'actividad') {
        document.getElementById('vista-actividad').classList.remove('hidden');
    } else if (opcionSeleccionada === 'manual') {
        document.getElementById('vista-manual').classList.remove('hidden');
    } else {
        document.getElementById('vista-ia').classList.remove('hidden');
        renderAiConversation();
    }
}

function volverObjetivos() {
    ocultarTodasLasVistas();
    document.getElementById('vista-principal').classList.remove('hidden');
    loadCurrentGoal();
}

async function loadCurrentGoal() {
    try {
        const data = await apiRequest('/api/goals/current');
        const box = document.getElementById('current-goal-box');
        if (data.dailyGoalLiters == null) {
            box.classList.add('hidden');
            return;
        }
        box.classList.remove('hidden');
        box.textContent = `Objetivo actual: ${litersText(data.dailyGoalLiters)}`;
    } catch (error) {
        console.log(error.message);
    }
}

async function guardarObjetivoBasico() {
    const weight = Number(document.getElementById('basic-weight').value);
    const unit = getActiveDataValue('basic-unit-group', 'unit-btn');

    try {
        showLoading('Calculando objetivo...');
        const data = await apiRequest('/api/goals/basic', 'POST', { weight, unit });
        document.getElementById('result-basic').textContent = `Tu cantidad objetivo es ${litersText(data.goalLiters)}`;
        hideLoading();
    } catch (error) {
        hideLoading();
        alert(error.message);
    }
}

async function guardarObjetivoActividad() {
    const weight = Number(document.getElementById('activity-weight').value);
    const unit = getActiveDataValue('activity-unit-group', 'unit-btn');
    const exerciseLevel = getActiveDataValue('exercise-level-group', 'mini-option');

    try {
        showLoading('Calculando objetivo...');
        const data = await apiRequest('/api/goals/activity', 'POST', { weight, unit, exerciseLevel });
        document.getElementById('result-activity').textContent = `Tu cantidad objetivo es ${litersText(data.goalLiters)}`;
        hideLoading();
    } catch (error) {
        hideLoading();
        alert(error.message);
    }
}

async function guardarObjetivoManual() {
    const amount = Number(document.getElementById('manual-amount').value);
    const unit = getActiveDataValue('manual-unit-group', 'unit-btn');

    try {
        showLoading('Guardando objetivo...');
        const data = await apiRequest('/api/goals/manual', 'POST', { amount, unit });
        document.getElementById('result-manual').textContent = `Cantidad objetivo establecida: ${litersText(data.goalLiters)}`;
        document.getElementById('result-manual').classList.remove('hidden');
        hideLoading();
        showPopup(`Cantidad objetivo establecida: ${litersText(data.goalLiters)}`);
    } catch (error) {
        hideLoading();
        alert(error.message);
    }
}

function getInitialAiBubble() {
    return 'Hola, soy SmartSip IA. Cuéntame tu peso, si haces ejercicio, tu rutina diaria, el clima donde vives o cualquier detalle que consideres importante, y te ayudaré a acordar una cantidad objetivo de agua.';
}

function renderAiConversation() {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;

    container.innerHTML = '';

    const initialBubble = document.createElement('div');
    initialBubble.className = 'chat-bubble assistant';
    initialBubble.textContent = getInitialAiBubble();
    container.appendChild(initialBubble);

    aiConversation.forEach((message) => {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${message.role === 'user' ? 'user' : 'assistant'}`;
        bubble.textContent = message.text;
        container.appendChild(bubble);
    });

    container.scrollTop = container.scrollHeight;
}

function setAiControlsDisabled(disabled) {
    const sendBtn = document.getElementById('ai-send-btn');
    const input = document.getElementById('ai-chat-input');
    const finalizeBtn = document.getElementById('ai-finalize-btn');

    if (sendBtn) sendBtn.disabled = disabled;
    if (input) input.disabled = disabled;
    if (finalizeBtn) finalizeBtn.disabled = disabled;
}

async function enviarMensajeIA() {
    const input = document.getElementById('ai-chat-input');
    const text = input.value.trim();

    if (!text) return;

    aiConversation.push({ role: 'user', text });
    renderAiConversation();
    input.value = '';

    try {
        setAiControlsDisabled(true);
        showLoading('Consultando SmartSip IA...');
        const data = await apiRequest('/api/goals/ai/chat', 'POST', { history: aiConversation });
        aiConversation.push({ role: 'model', text: data.reply });
        renderAiConversation();

        if (data.recommendedGoalLiters != null) {
            document.getElementById('ai-final-goal').value = data.recommendedGoalLiters;
            const resultBox = document.getElementById('result-ia');
            resultBox.textContent = `Recomendación actual del chatbot: ${litersText(data.recommendedGoalLiters)}`;
            resultBox.classList.remove('hidden');
        }

        hideLoading();
        setAiControlsDisabled(false);
        input.focus();
    } catch (error) {
        hideLoading();
        setAiControlsDisabled(false);
        alert(error.message);
    }
}

async function finalizarObjetivoIA() {
    const goalLiters = Number(document.getElementById('ai-final-goal').value);

    try {
        showLoading('Guardando objetivo con IA...');
        const data = await apiRequest('/api/goals/ai/finalize', 'POST', { goalLiters });
        const resultBox = document.getElementById('result-ia');
        resultBox.textContent = `Cantidad objetivo establecida: ${litersText(data.goalLiters)}`;
        resultBox.classList.remove('hidden');
        hideLoading();
        showPopup(`Cantidad objetivo establecida: ${litersText(data.goalLiters)}`);
        loadCurrentGoal();
    } catch (error) {
        hideLoading();
        alert(error.message);
    }
}
