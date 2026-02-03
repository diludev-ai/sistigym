# Guia de Configuracion - SistiGym

## Variables de Entorno

### Requeridas

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | URL de conexion a PostgreSQL | `postgresql://user:pass@localhost:5432/sistigym` |
| `SESSION_SECRET` | Secreto para firmar cookies de sesion | `mi-secreto-de-32-caracteres-minimo` |
| `NODE_ENV` | Entorno de ejecucion | `development` o `production` |

### Opcionales

| Variable | Descripcion | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `3000` |

## Archivo .env

Ejemplo completo:

```env
# Base de datos
DATABASE_URL="postgresql://postgres:password@localhost:5432/sistigym"

# Sesiones
SESSION_SECRET="cambia-esto-por-un-valor-seguro-y-largo"

# Entorno
NODE_ENV="development"
```

## Configuracion del Gimnasio

La configuracion del gimnasio se guarda en la base de datos en la tabla `gym_settings`. Se puede modificar desde el panel de administracion en `/admin/settings`.

### Configuraciones Disponibles

| Clave | Descripcion | Valor Default |
|-------|-------------|---------------|
| `gym_name` | Nombre del gimnasio | `Mi Gimnasio` |
| `morosity_tolerance_days` | Dias de tolerancia antes de marcar como moroso | `5` |
| `qr_duration_seconds` | Duracion del codigo QR en segundos | `30` |
| `timezone` | Zona horaria del gimnasio | `America/Mexico_City` |

### Modificar desde Panel Admin

1. Accede a `/admin/settings`
2. Modifica los valores deseados
3. Guarda los cambios

### Modificar desde Base de Datos

```sql
-- Cambiar duracion del QR a 60 segundos
UPDATE gym_settings SET value = '60' WHERE key = 'qr_duration_seconds';

-- Cambiar nombre del gimnasio
UPDATE gym_settings SET value = 'Power Gym' WHERE key = 'gym_name';

-- Cambiar tolerancia de morosidad a 7 dias
UPDATE gym_settings SET value = '7' WHERE key = 'morosity_tolerance_days';
```

## Configuracion de Planes

Los planes se configuran desde `/admin/plans`. Cada plan tiene:

- **Nombre**: Nombre descriptivo del plan
- **Precio**: Precio en la moneda local
- **Duracion**: Duracion en dias
- **Descripcion**: Descripcion opcional
- **Activo**: Si el plan esta disponible para nuevas membresias

### Planes por Defecto

El seed inicial crea estos planes:

| Plan | Precio | Duracion |
|------|--------|----------|
| Mensual | $500.00 | 30 dias |
| Trimestral | $1,350.00 | 90 dias |
| Semestral | $2,500.00 | 180 dias |
| Anual | $4,500.00 | 365 dias |
| Pase Diario | $80.00 | 1 dia |

## Configuracion de Usuarios Staff

### Roles

- **admin**: Acceso completo a todas las funciones
- **reception**: Acceso a control de acceso, miembros y pagos

### Crear Usuario desde Panel

1. Accede como admin a `/admin/settings`
2. En la seccion de usuarios, haz clic en "Nuevo Usuario"
3. Completa el formulario con email, nombre y password
4. Selecciona el rol apropiado

### Crear Usuario desde Base de Datos

```sql
-- Primero, hashea el password con bcrypt (SALT_ROUNDS=12)
-- Usa una herramienta externa o el siguiente codigo Node.js:
-- const bcrypt = require('bcrypt');
-- const hash = await bcrypt.hash('password123', 12);

INSERT INTO staff_users (id, email, password_hash, name, role, active)
VALUES (
  gen_random_uuid(),
  'nuevo@gym.com',
  '$2b$12$...',  -- Hash del password
  'Nuevo Usuario',
  'reception',
  true
);
```

## Configuracion PWA

### Manifest

El archivo `public/manifest.json` configura la PWA:

```json
{
  "name": "Mi Gimnasio",
  "short_name": "Mi Gym",
  "start_url": "/app/me",
  "display": "standalone",
  "theme_color": "#10b981",
  "background_color": "#111827"
}
```

### Iconos

Los iconos de la PWA estan en `public/icons/`. Para cambiarlos:

1. Reemplaza los archivos SVG/PNG existentes
2. Mantén los mismos nombres y tamaños
3. Actualiza el manifest si cambias los formatos

### Service Worker

El service worker (`public/sw.js`) maneja:

- Cache de recursos estaticos
- Funcionamiento offline basico
- Actualizacion automatica

## Seguridad

### Passwords

- Hash con bcrypt (12 rounds)
- Minimo 6 caracteres en validacion

### Sesiones

- Cookies httpOnly, secure (en produccion), sameSite=lax
- Duracion: 30 dias para clientes, 7 dias para staff
- Firmadas con SESSION_SECRET

### Tokens QR

- Generados con crypto.randomBytes(32)
- Almacenados como hash SHA256 en DB
- Expiracion configurable (default 30s)
- Un solo uso

## Base de Datos

### Tablas Principales

| Tabla | Descripcion |
|-------|-------------|
| `staff_users` | Usuarios administrativos |
| `staff_sessions` | Sesiones de staff |
| `members` | Clientes del gimnasio |
| `member_sessions` | Sesiones de clientes |
| `plans` | Planes de membresia |
| `memberships` | Membresias activas/historicas |
| `payments` | Historial de pagos |
| `qr_tokens` | Tokens QR temporales |
| `access_logs` | Registro de accesos |
| `gym_settings` | Configuracion del gimnasio |

### Migraciones

```bash
# Generar migracion desde cambios en schema
pnpm db:generate

# Aplicar migraciones pendientes
pnpm db:migrate

# Ver estado de migraciones
pnpm db:status
```

## Personalizacion Visual

### Colores

Los colores se configuran en Tailwind CSS. Los principales son:

- Verde (`green-500`, `emerald-600`): Color primario
- Gris (`gray-800`, `gray-900`): Fondos oscuros
- Rojo (`red-400`, `red-500`): Errores y alertas

Para cambiar el esquema de colores, modifica:
- `app/app.css`: Estilos globales
- Componentes individuales en `app/routes/`

### Logo

Reemplaza los archivos en `public/icons/` y actualiza:
- `public/manifest.json`
- `app/root.tsx` (apple-touch-icon)
