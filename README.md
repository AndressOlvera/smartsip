# SmartSip 💧

**SmartSip** es una aplicación web (diseñada como app móvil) para controlar tu hidratación diaria. Te ayuda a definir una meta de consumo de agua, registrar lo que tomas —escaneando el código QR de tu termo o agregándolo manualmente— y ver tu avance del día y de la semana.

## Funcionalidades

- **Cuenta de usuario**: registro e inicio de sesión con contraseña cifrada (bcrypt) y sesión con token JWT válido por 7 días.
- **Onboarding**: pantallas de bienvenida que presentan la app antes de crear cuenta o iniciar sesión.
- **Meta diaria de agua**, con cuatro formas de calcularla:
  | Opción | Cómo se calcula |
  |---|---|
  | Cantidad objetivo básica | peso (kg) × 0.035 L |
  | Hago actividad física | peso (kg) × 0.035 L + 0.25 / 0.5 / 0.75 L según minutos de ejercicio al día (<30, 30–60, >60) |
  | Ya tengo una cantidad objetivo | el usuario la escribe en L o ml |
  | Personalizar con IA | chat con **SmartSip IA** (Google Gemini), que recomienda una meta entre 1 y 6 L según peso, actividad, clima y hábitos |

  El peso se puede capturar en kg o lb.
- **Inicio**: consumo de hoy, cuánto falta para la meta, y botones para agregar o quitar consumo (desayuno, comida u otro).
- **Escaneo de termo por QR**: con la cámara del dispositivo se lee el QR de la botella y se suma el agua consumida al día; se guarda un historial de los últimos escaneos.
- **Consumo**: porcentaje de la meta alcanzado hoy y gráfica de barras de los últimos 7 días.
- **Ajustes**: editar información personal (nombre, correo, contraseña), foto de perfil y modo oscuro.

## Tecnologías

- **Frontend**: HTML, CSS y JavaScript sin frameworks; [html5-qrcode](https://github.com/mebjas/html5-qrcode) para leer QR con la cámara.
- **Backend**: Node.js con Express 5.
- **Base de datos**: MongoDB Atlas con Mongoose.
- **Autenticación**: JSON Web Tokens (`jsonwebtoken`) y `bcrypt`.
- **IA**: API de Google Gemini (`gemini-2.5-flash-lite`).

## Estructura del repositorio

La versión completa y lista para ejecutar está dentro de **`SmartSip-backend-integrado_FINAL_2.zip`**:

```
SmartSip-backend-integrado FINAL 2/
├── server.js            # Servidor Express + API REST
├── package.json
├── models/              # Esquemas de Mongoose
│   ├── User.js
│   ├── DailyConsumption.js
│   └── BottleScan.js
└── Frontend/            # Pantallas de la app (servidas por Express)
    ├── onboarding1-4.html, login.html, register.html, terms.html
    ├── home.html, consumo.html, agregar.html, objetivos.html, ajustes.html
    ├── *.js, style1.css, styles.css
    └── imgs/
```

Los archivos sueltos en la raíz del repositorio son una copia del mismo código (servidor, modelos, pantallas e imágenes) para poder consultarlo directamente en GitHub. Las imágenes `Botella1__1_.png` … `Botella5__1_.png` son **códigos QR de ejemplo** de termos para probar el escáner.

## Cómo ejecutarlo

Requisitos: [Node.js](https://nodejs.org/) 20.19 o superior y una base de datos de MongoDB (por ejemplo, un clúster gratuito de MongoDB Atlas).

1. Descomprime `SmartSip-backend-integrado_FINAL_2.zip` y entra a la carpeta:
   ```bash
   cd "SmartSip-backend-integrado FINAL 2"
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura en `server.js`:
   - `mongoConnection`: la cadena de conexión de tu base de datos de MongoDB.
   - `geminiApiKey`: tu API key de Google Gemini (se obtiene en [Google AI Studio](https://aistudio.google.com/)); solo es necesaria para "Personalizar con IA".
   - `secretKey`: la clave con la que se firman los tokens JWT.
4. Inicia el servidor:
   ```bash
   node server.js
   ```
5. Abre <http://localhost:3000> en el navegador. Para usar la cámara y escanear QR, entra desde `localhost` y acepta el permiso del navegador.

## Formato del código QR de la botella

El QR puede contener directamente un JSON o una URL que devuelva un JSON. Ejemplo:

```json
{
  "bottleName": "Termo SmartSip",
  "totalCapacityLiters": 1,
  "consumedLiters": 0.5,
  "color": "Azul",
  "material": "Acero inoxidable"
}
```

También se aceptan los nombres de campo en español: `nombre`, `capacidad` / `capacidadLitros` y `aguaConsumida` / `aguaConsumidaL`.

## API

Todas las rutas, excepto registro e inicio de sesión, requieren el encabezado `Authorization` con el token JWT.

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Crear cuenta |
| POST | `/api/auth/login` | Iniciar sesión y obtener token |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET | `/api/users/me` | Datos del usuario |
| PATCH | `/api/users/me` | Actualizar nombre, correo o contraseña |
| PATCH | `/api/users/dark-mode` | Activar o desactivar modo oscuro |
| PATCH | `/api/users/profile-image` | Cambiar foto de perfil |
| GET | `/api/home/summary` | Resumen del día para la pantalla de inicio |
| POST | `/api/consumption/add` | Agregar consumo manual |
| POST | `/api/consumption/remove` | Quitar consumo |
| GET | `/api/consumption/today` | Consumo de hoy vs. meta |
| GET | `/api/consumption/weekly` | Consumo de los últimos 7 días |
| GET | `/api/goals/current` | Meta actual |
| POST | `/api/goals/basic` | Calcular meta básica |
| POST | `/api/goals/activity` | Calcular meta con actividad física |
| POST | `/api/goals/manual` | Guardar meta manual |
| POST | `/api/goals/ai/chat` | Conversar con SmartSip IA |
| POST | `/api/goals/ai/finalize` | Guardar la meta acordada con la IA |
| POST | `/api/bottles/scan` | Registrar el escaneo del QR de una botella |
| GET | `/api/bottles/scans` | Últimos 10 escaneos |
