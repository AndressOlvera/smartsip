const express = require('express');

const dns = require('node:dns/promises');
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const http = require('http');
const https = require('https');

const User = require('./models/User');
const DailyConsumption = require('./models/DailyConsumption');
const BottleScan = require('./models/BottleScan');

const app = express();
const port = 3000;
const secretKey = '<JWT_SECRET>';
const geminiApiKey = '<GEMINI_API_KEY>';
const geminiModel = 'gemini-2.5-flash';
/*
'gemini-2.5-flash'; - Masomenos
'gemini-3-flash'; - No
'gemini-3.1-flash-lite'; - Masomenos
'gemini-2.5-flash-lite'; - Bueno
'gemini-2.5-flash-native-audio-dialog'; - No
'gemini-3-flash-live'; - No
Peso 80kg, mido 1.90m, hace mucho calor en mi colonia, hago muchísimo ejercicio, dame una cantidad de consumo. Por cierto que modelo de IA eres
*/

app.use(cors({
    methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'Frontend')));

let mongoConnection = 'mongodb+srv://admin:<PASSWORD>@myapp.mvlzjeq.mongodb.net/test';
let db = mongoose.connection;

db.on('connecting', () => {
    console.log('Conectando...');
    console.log(mongoose.connection.readyState);
});

db.on('connected', () => {
    console.log('¡Conectado exitosamente!');
    console.log(mongoose.connection.readyState);
});

db.on('error', (error) => {
    console.log('Error de conexión:', error.message);
});

mongoose.connect(mongoConnection);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'onboarding1.html'));
});

function getAuthorizationToken(headerValue) {
    if (!headerValue) return null;
    if (headerValue.startsWith('Bearer ')) {
        return headerValue.substring(7);
    }
    return headerValue;
}

function verifyToken(req, res, next) {
    const token = getAuthorizationToken(req.headers.authorization || '');

    if (!token) {
        return res.status(401).json({ message: 'No autorizado. Token no enviado.' });
    }

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Token inválido o expirado.' });
        }
        req.user = decoded;
        next();
    });
}

function getTodayKey() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTodayLabel() {
    const date = new Date();
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function parseDateKeyToDate(dateKey) {
    const parts = String(dateKey || '').split('-');
    if (parts.length !== 3) return null;

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return null;
    }

    return new Date(year, month - 1, day);
}

function getWeekdayLabelFromDateKey(dateKey) {
    const date = parseDateKeyToDate(dateKey);
    if (!date || Number.isNaN(date.getTime())) return String(dateKey || '');

    const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return labels[date.getDay()];
}

function roundTo2(numberValue) {
    return Math.round(numberValue * 100) / 100;
}

async function getOrCreateTodayConsumption(userId) {
    const todayKey = getTodayKey();
    let document = await DailyConsumption.findOne({ userId, dateKey: todayKey });

    if (!document) {
        document = await DailyConsumption.create({
            userId,
            dateKey: todayKey,
            consumedLiters: 0,
            actions: []
        });
    }

    return document;
}

function buildHomeSummary(user, todayConsumption) {
    const todayLiters = roundTo2(todayConsumption ? todayConsumption.consumedLiters : 0);
    const goalLiters = user.dailyGoalLiters;
    const remainingLiters = goalLiters == null ? null : Math.max(roundTo2(goalLiters - todayLiters), 0);

    return {
        firstName: user.firstName,
        currentDate: getTodayLabel(),
        todayLiters,
        goalLiters,
        remainingLiters,
        remainingText: remainingLiters == null ? 'N/A' : `${remainingLiters.toFixed(2)}L`,
        todayText: `${todayLiters.toFixed(2)}L`,
        profileImage: user.profileImage || ''
    };
}


function downloadJsonFromUrl(urlValue, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 5) {
            reject(new Error('Demasiadas redirecciones al intentar leer el JSON del QR.'));
            return;
        }

        const client = urlValue.startsWith('https://') ? https : http;

        client.get(urlValue, (response) => {
            if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
                const redirectedUrl = new URL(response.headers.location, urlValue).toString();
                resolve(downloadJsonFromUrl(redirectedUrl, redirects + 1));
                return;
            }

            if (response.statusCode < 200 || response.statusCode >= 300) {
                reject(new Error('No se pudo obtener el JSON de la botella desde la URL del QR.'));
                return;
            }

            let rawData = '';
            response.on('data', (chunk) => {
                rawData += chunk;
            });
            response.on('end', () => {
                try {
                    const parsed = JSON.parse(rawData);
                    resolve(parsed);
                } catch (error) {
                    reject(new Error('La URL del QR no regresó un JSON válido.'));
                }
            });
        }).on('error', () => {
            reject(new Error('No se pudo leer la URL del QR.'));
        });
    });
}

function normalizeUnitValue(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function parseNumber(value) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : NaN;
}
function extractJsonObject(text) {
    if (typeof text !== 'string') return null;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch (error) {
        return null;
    }
}

function extractLitersFromText(text) {
    if (typeof text !== 'string') return null;
    const regex = /(\d+(?:[.,]\d+)?)\s*(?:l|litros?)/i;
    const match = text.match(regex);
    if (!match) return null;
    const value = Number(String(match[1]).replace(',', '.'));
    return Number.isFinite(value) ? roundTo2(value) : null;
}

function clampGoalLiters(value) {
    if (!Number.isFinite(value)) return null;
    return Math.min(Math.max(roundTo2(value), 1), 6);
}

function sanitizeAiHistory(history) {
    if (!Array.isArray(history)) return [];

    return history
        .filter((item) => item && typeof item.text === 'string' && item.text.trim())
        .slice(-20)
        .map((item) => ({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.text.trim().slice(0, 4000) }]
        }));
}

function postJsonHttpsRequest(options, payload) {
    return new Promise((resolve, reject) => {
        const request = https.request(options, (response) => {
            let rawData = '';

            response.on('data', (chunk) => {
                rawData += chunk;
            });

            response.on('end', () => {
                let parsedData = {};

                try {
                    parsedData = rawData ? JSON.parse(rawData) : {};
                } catch (error) {
                    parsedData = {};
                }

                if (response.statusCode < 200 || response.statusCode >= 300) {
                    const apiErrorMessage = parsedData?.error?.message || `Gemini respondió con código ${response.statusCode}.`;
                    reject(new Error(apiErrorMessage));
                    return;
                }

                resolve(parsedData);
            });
        });

        request.on('error', (error) => {
            reject(error);
        });

        request.write(JSON.stringify(payload));
        request.end();
    });
}

async function askGeminiForHydrationChat(history) {
    if (!geminiApiKey || geminiApiKey.includes('PEGA_AQUI')) {
        throw new Error('Configura tu API key de Gemini en server.js antes de usar Personalizar con IA.');
    }

    const contents = sanitizeAiHistory(history);

    if (contents.length === 0) {
        return {
            reply: 'Hola, soy SmartSip IA. Cuéntame tu rutina, tu peso, si haces ejercicio, el clima donde vives o cualquier detalle que te ayude a definir tu meta diaria de agua.',
            recommendedGoalLiters: null,
            readyToFinalize: false
        };
    }

    const systemInstruction = `
Eres SmartSip IA, un chatbot conversacional en español para ayudar al usuario a acordar una cantidad objetivo diaria de agua en litros.

Reglas importantes:
- Habla siempre en español.
- Sé natural, breve y útil.
- Enfócate solamente en recomendar una meta diaria de agua.
- Puedes hacer preguntas de seguimiento si falta información.
- Considera factores como peso, actividad física, clima, sudoración, rutina diaria y hábitos.
- No des consejos médicos ni diagnostiques. Si algo parece médico, aclara que es una recomendación general y no sustituye a un profesional.
- Cuando ya tengas suficiente información, recomienda una cantidad entre 1.0 y 6.0 litros al día.
- Si todavía no tienes suficiente información, recommendedGoalLiters debe ser null y readyToFinalize debe ser false.
- Si ya tienes una recomendación razonable, readyToFinalize debe ser true.

Responde SIEMPRE y SOLO en JSON con este formato exacto:
{
  "reply": "respuesta natural del chatbot para el usuario",
  "recommendedGoalLiters": 2.8,
  "readyToFinalize": true
}

Si aún no hay una recomendación clara, usa:
{
  "reply": "...",
  "recommendedGoalLiters": null,
  "readyToFinalize": false
}
`;

    const payload = {
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        },
        contents,
        generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 500,
            responseMimeType: 'application/json'
        }
    };

    const response = await postJsonHttpsRequest({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/${geminiModel}:generateContent`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiApiKey
        }
    }, payload);

    const rawText = response?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('')
        .trim();

    if (!rawText) {
        throw new Error('Gemini no devolvió texto en la respuesta.');
    }

    let parsed = null;

    try {
        parsed = JSON.parse(rawText);
    } catch (error) {
        parsed = extractJsonObject(rawText);
    }

    let reply = rawText;
    let recommendedGoalLiters = null;
    let readyToFinalize = false;

    if (parsed && typeof parsed === 'object') {
        reply = typeof parsed.reply === 'string' ? parsed.reply : rawText;
        recommendedGoalLiters = clampGoalLiters(parseNumber(parsed.recommendedGoalLiters));
        readyToFinalize = Boolean(parsed.readyToFinalize || recommendedGoalLiters != null);
    } else {
        recommendedGoalLiters = clampGoalLiters(extractLitersFromText(rawText));
        readyToFinalize = recommendedGoalLiters != null;
    }

    return {
        reply,
        recommendedGoalLiters,
        readyToFinalize
    };
}


function normalizeBottlePayload(rawPayload) {
    const payload = rawPayload || {};

    const bottleName = payload.bottleName || payload.nombre || payload.name || payload.botella || 'Botella escaneada';
    const totalCapacityLiters = parseNumber(
        payload.totalCapacityLiters ?? payload.capacidadTotalLiters ?? payload.capacidadTotalL ?? payload.capacidadLitros ?? payload.capacidad ?? payload.capacityLiters
    );
    const consumedLiters = parseNumber(
        payload.consumedLiters ?? payload.aguaConsumidaLiters ?? payload.aguaConsumidaL ?? payload.aguaConsumida ?? payload.consumedWaterLiters ?? payload.waterConsumedLiters
    );

    return {
        bottleName,
        totalCapacityLiters: Number.isFinite(totalCapacityLiters) ? totalCapacityLiters : 0,
        consumedLiters: Number.isFinite(consumedLiters) ? consumedLiters : 0,
        color: payload.color || '',
        material: payload.material || '',
        rawPayload: payload
    };
}

async function resolveBottleFromQr(qrData) {
    const trimmedValue = String(qrData || '').trim();

    if (!trimmedValue) {
        throw new Error('El QR no contiene información.');
    }

    if (trimmedValue.startsWith('{')) {
        const parsedPayload = JSON.parse(trimmedValue);
        return normalizeBottlePayload(parsedPayload);
    }

    if (trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://')) {
        const payload = await downloadJsonFromUrl(trimmedValue);
        return normalizeBottlePayload(payload);
    }

    throw new Error('El QR debe contener una URL o un JSON válido de la botella.');
}

// AUTH
app.post('/api/auth/register', async (req, res) => {
    try {
        const {
            firstName,
            secondName,
            lastName,
            email,
            password
        } = req.body;

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' });
        }

        if (String(password).length < 8) {
            return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres.' });
        }

        const existingUser = await User.findOne({ email: String(email).trim().toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'Ya existe un usuario con ese correo.' });
        }

        const hash = bcrypt.hashSync(password, 10);

        await User.create({
            firstName: String(firstName).trim(),
            secondName: String(secondName || '').trim(),
            lastName: String(lastName).trim(),
            email: String(email).trim().toLowerCase(),
            password: hash,
            dailyGoalLiters: null,
            goalType: '',
            weightKg: null,
            exerciseLevel: '',
            darkMode: false,
            profileImage: ''
        });

        return res.json({ message: 'Registro exitoso.' });
    } catch (error) {
        return res.status(500).json({ message: 'Error al registrar usuario.', error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });
        }

        const user = await User.findOne({ email: String(email).trim().toLowerCase() });
        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        const token = jwt.sign({ userId: user._id, email: user.email }, secretKey, { expiresIn: '7d' });

        return res.json({
            message: 'Inicio de sesión exitoso.',
            token,
            user: {
                firstName: user.firstName,
                secondName: user.secondName,
                lastName: user.lastName,
                email: user.email,
                profileImage: user.profileImage || ''
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error al iniciar sesión.', error: error.message });
    }
});

app.post('/api/auth/logout', (req, res) => {
    return res.json({ message: 'Sesión cerrada.' });
});

// USERS / SETTINGS
app.get('/api/users/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        return res.json({
            firstName: user.firstName,
            secondName: user.secondName,
            lastName: user.lastName,
            email: user.email,
            passwordMask: '********',
            darkMode: user.darkMode,
            dailyGoalLiters: user.dailyGoalLiters,
            goalType: user.goalType,
            weightKg: user.weightKg,
            exerciseLevel: user.exerciseLevel,
            profileImage: user.profileImage || ''
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error al consultar usuario.', error: error.message });
    }
});

app.patch('/api/users/me', verifyToken, async (req, res) => {
    try {
        const {
            firstName,
            secondName,
            lastName,
            email,
            password
        } = req.body;

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        if (email && String(email).trim().toLowerCase() !== user.email) {
            const existingUser = await User.findOne({ email: String(email).trim().toLowerCase() });
            if (existingUser) {
                return res.status(400).json({ message: 'Ya existe un usuario con ese correo.' });
            }
            user.email = String(email).trim().toLowerCase();
        }

        if (firstName) user.firstName = String(firstName).trim();
        user.secondName = String(secondName || '').trim();
        if (lastName) user.lastName = String(lastName).trim();

        if (password && password !== '********') {
            if (String(password).length < 8) {
                return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres.' });
            }
            user.password = bcrypt.hashSync(password, 10);
        }

        await user.save();

        return res.json({ message: 'Información actualizada correctamente.' });
    } catch (error) {
        return res.status(500).json({ message: 'Error al actualizar usuario.', error: error.message });
    }
});

app.patch('/api/users/dark-mode', verifyToken, async (req, res) => {
    try {
        const { darkMode } = req.body;
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        user.darkMode = Boolean(darkMode);
        await user.save();

        return res.json({ message: 'Modo oscuro actualizado.', darkMode: user.darkMode });
    } catch (error) {
        return res.status(500).json({ message: 'Error al actualizar modo oscuro.', error: error.message });
    }
});

app.patch('/api/users/profile-image', verifyToken, async (req, res) => {
    try {
        const { profileImage } = req.body;
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        if (!profileImage || typeof profileImage !== 'string' || !profileImage.startsWith('data:image/')) {
            return res.status(400).json({ message: 'La imagen de perfil no tiene un formato válido.' });
        }

        if (profileImage.length > 2_800_000) {
            return res.status(400).json({ message: 'La imagen de perfil es demasiado grande.' });
        }

        user.profileImage = profileImage;
        await user.save();

        return res.json({ message: 'Imagen de perfil actualizada correctamente.', profileImage: user.profileImage });
    } catch (error) {
        return res.status(500).json({ message: 'Error al actualizar imagen de perfil.', error: error.message });
    }
});

// HOME / CONSUMPTION
app.get('/api/home/summary', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const todayConsumption = await getOrCreateTodayConsumption(user._id);
        return res.json(buildHomeSummary(user, todayConsumption));
    } catch (error) {
        return res.status(500).json({ message: 'Error al obtener resumen de inicio.', error: error.message });
    }
});

app.post('/api/consumption/add', verifyToken, async (req, res) => {
    try {
        const { amountLiters, category } = req.body;
        const amount = parseNumber(amountLiters);

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ message: 'La cantidad a agregar debe ser mayor que 0.' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        if (user.dailyGoalLiters == null) {
            return res.status(400).json({ message: 'Debes establecer una cantidad objetivo antes de agregar consumo.' });
        }

        const todayConsumption = await getOrCreateTodayConsumption(user._id);
        todayConsumption.consumedLiters = roundTo2(todayConsumption.consumedLiters + amount);
        todayConsumption.actions.push({
            actionType: 'manual-add',
            amountLiters: amount,
            category: category || 'otro',
            createdAt: new Date()
        });
        await todayConsumption.save();

        return res.json({
            message: 'Consumo agregado correctamente.',
            summary: buildHomeSummary(user, todayConsumption)
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error al agregar consumo.', error: error.message });
    }
});

app.post('/api/consumption/remove', verifyToken, async (req, res) => {
    try {
        const { amountLiters } = req.body;
        const amount = parseNumber(amountLiters);

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ message: 'La cantidad a eliminar debe ser mayor que 0.' });
        }

        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        if (user.dailyGoalLiters == null) {
            return res.status(400).json({ message: 'Debes establecer una cantidad objetivo antes de eliminar consumo.' });
        }

        const todayConsumption = await getOrCreateTodayConsumption(user._id);

        if (amount > todayConsumption.consumedLiters) {
            return res.status(400).json({ message: 'No puedes eliminar más agua de la que llevas consumida hoy.' });
        }

        todayConsumption.consumedLiters = roundTo2(todayConsumption.consumedLiters - amount);
        todayConsumption.actions.push({
            actionType: 'manual-remove',
            amountLiters: amount,
            category: 'otro',
            createdAt: new Date()
        });
        await todayConsumption.save();

        return res.json({
            message: 'Consumo eliminado correctamente.',
            summary: buildHomeSummary(user, todayConsumption)
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error al eliminar consumo.', error: error.message });
    }
});

app.get('/api/consumption/today', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const todayConsumption = await getOrCreateTodayConsumption(user._id);
        const goalLiters = user.dailyGoalLiters;
        const currentLiters = roundTo2(todayConsumption.consumedLiters);
        const percentage = goalLiters && goalLiters > 0 ? Math.min(Math.round((currentLiters / goalLiters) * 100), 100) : 0;

        return res.json({
            goalLiters,
            currentLiters,
            percentage
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error al consultar consumo de hoy.', error: error.message });
    }
});

app.get('/api/consumption/weekly', verifyToken, async (req, res) => {
    try {
        const todayKey = getTodayKey();
        const records = await DailyConsumption.find({
            userId: req.user.userId,
            dateKey: { $ne: todayKey }
        })
            .sort({ dateKey: -1 })
            .limit(7);

        const orderedRecords = records.reverse();

        return res.json({
            bars: orderedRecords.map((record) => ({
                label: getWeekdayLabelFromDateKey(record.dateKey),
                liters: roundTo2(record.consumedLiters),
                dateKey: record.dateKey
            }))
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error al consultar consumo semanal.', error: error.message });
    }
});

// GOALS
app.get('/api/goals/current', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        return res.json({
            goalType: user.goalType,
            dailyGoalLiters: user.dailyGoalLiters,
            weightKg: user.weightKg,
            exerciseLevel: user.exerciseLevel
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error al obtener objetivo actual.', error: error.message });
    }
});

app.post('/api/goals/basic', verifyToken, async (req, res) => {
    try {
        const unit = normalizeUnitValue(req.body.unit);
        const weight = parseNumber(req.body.weight);

        if (!Number.isFinite(weight) || weight <= 0) {
            return res.status(400).json({ message: 'Ingresa un peso válido.' });
        }

        let weightKg = weight;
        if (unit === 'lb') {
            weightKg = weight * 0.453592;
        }

        const goalLiters = roundTo2(weightKg * 0.035);
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        user.goalType = 'basica';
        user.weightKg = roundTo2(weightKg);
        user.exerciseLevel = '';
        user.dailyGoalLiters = goalLiters;
        await user.save();

        return res.json({ message: 'Cantidad objetivo calculada.', goalLiters });
    } catch (error) {
        return res.status(500).json({ message: 'Error al calcular objetivo básico.', error: error.message });
    }
});

app.post('/api/goals/activity', verifyToken, async (req, res) => {
    try {
        const unit = normalizeUnitValue(req.body.unit);
        const weight = parseNumber(req.body.weight);
        const exerciseLevel = normalizeUnitValue(req.body.exerciseLevel);

        if (!Number.isFinite(weight) || weight <= 0) {
            return res.status(400).json({ message: 'Ingresa un peso válido.' });
        }

        if (!['menos_30', '30_60', 'mas_60'].includes(exerciseLevel)) {
            return res.status(400).json({ message: 'Selecciona un tiempo de ejercicio válido.' });
        }

        let weightKg = weight;
        if (unit === 'lb') {
            weightKg = weight * 0.453592;
        }

        let extraLiters = 0.25;
        if (exerciseLevel === '30_60') extraLiters = 0.5;
        if (exerciseLevel === 'mas_60') extraLiters = 0.75;

        const goalLiters = roundTo2((weightKg * 0.035) + extraLiters);
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        user.goalType = 'actividad';
        user.weightKg = roundTo2(weightKg);
        user.exerciseLevel = exerciseLevel;
        user.dailyGoalLiters = goalLiters;
        await user.save();

        return res.json({ message: 'Cantidad objetivo calculada.', goalLiters });
    } catch (error) {
        return res.status(500).json({ message: 'Error al calcular objetivo por actividad física.', error: error.message });
    }
});

app.post('/api/goals/manual', verifyToken, async (req, res) => {
    try {
        const unit = normalizeUnitValue(req.body.unit);
        const amount = parseNumber(req.body.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ message: 'Ingresa una cantidad válida.' });
        }

        let goalLiters = amount;
        if (unit === 'ml') {
            goalLiters = amount / 1000;
        }

        goalLiters = roundTo2(goalLiters);
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        user.goalType = 'manual';
        user.dailyGoalLiters = goalLiters;
        user.weightKg = null;
        user.exerciseLevel = '';
        await user.save();

        return res.json({ message: 'Cantidad objetivo establecida.', goalLiters });
    } catch (error) {
        return res.status(500).json({ message: 'Error al guardar objetivo manual.', error: error.message });
    }
});

// GOALS / IA
app.post('/api/goals/ai/chat', verifyToken, async (req, res) => {
    try {
        const history = Array.isArray(req.body.history) ? req.body.history : [];
        const aiResponse = await askGeminiForHydrationChat(history);
        return res.json(aiResponse);
    } catch (error) {
        return res.status(500).json({ message: 'Error al consultar SmartSip IA.', error: error.message });
    }
});

app.post('/api/goals/ai/finalize', verifyToken, async (req, res) => {
    try {
        const goalLiters = roundTo2(parseNumber(req.body.goalLiters));

        if (!Number.isFinite(goalLiters) || goalLiters <= 0) {
            return res.status(400).json({ message: 'Ingresa una cantidad objetivo válida en litros.' });
        }

        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        user.goalType = 'ia';
        user.dailyGoalLiters = goalLiters;
        await user.save();

        return res.json({
            message: 'Cantidad objetivo establecida desde SmartSip IA.',
            goalLiters
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error al finalizar objetivo con IA.', error: error.message });
    }
});

// BOTTLES / QR
app.post('/api/bottles/scan', verifyToken, async (req, res) => {
    try {
        const { qrData } = req.body;
        const normalizedBottle = await resolveBottleFromQr(qrData);
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const todayConsumption = await getOrCreateTodayConsumption(user._id);
        todayConsumption.consumedLiters = roundTo2(todayConsumption.consumedLiters + normalizedBottle.consumedLiters);
        todayConsumption.actions.push({
            actionType: 'bottle-scan',
            amountLiters: normalizedBottle.consumedLiters,
            category: 'botella',
            bottleName: normalizedBottle.bottleName,
            qrRaw: String(qrData || ''),
            createdAt: new Date()
        });
        await todayConsumption.save();

        await BottleScan.create({
            userId: user._id,
            qrRaw: String(qrData || ''),
            bottleName: normalizedBottle.bottleName,
            totalCapacityLiters: normalizedBottle.totalCapacityLiters,
            consumedLiters: normalizedBottle.consumedLiters,
            color: normalizedBottle.color,
            material: normalizedBottle.material,
            rawPayload: normalizedBottle.rawPayload
        });

        return res.json({
            message: 'Botella escaneada correctamente.',
            bottle: normalizedBottle,
            summary: buildHomeSummary(user, todayConsumption)
        });
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Error al procesar el QR.' });
    }
});

app.get('/api/bottles/scans', verifyToken, async (req, res) => {
    try {
        const scans = await BottleScan.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(10);
        return res.json(scans);
    } catch (error) {
        return res.status(500).json({ message: 'Error al consultar historial de escaneos.', error: error.message });
    }
});

app.listen(port, () => {
    console.log('localhost' + port);
});
