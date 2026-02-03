# SistiGym - Sistema de Gestion para Gimnasios

Sistema completo para la gestion de gimnasios con control de acceso QR, membresias, pagos y PWA para clientes.

## Caracteristicas

### Panel Administrativo (/admin)
- Dashboard con metricas en tiempo real
- Gestion de miembros (CRUD completo)
- Gestion de planes y membresias
- Control de acceso (QR + manual)
- Registro de pagos
- Reportes y estadisticas
- Deteccion de morosidad
- Configuracion del gimnasio

### PWA para Clientes (/app)
- Login seguro
- Perfil con estado de membresia
- Generacion de codigo QR dinamico
- Historial de accesos y pagos
- Instalable como app nativa

## Stack Tecnologico

- **Frontend**: React Router v7 (full-stack)
- **Styling**: Tailwind CSS v4
- **Base de Datos**: PostgreSQL
- **ORM**: Drizzle ORM
- **Validacion**: Zod
- **Autenticacion**: Cookies httpOnly + bcrypt
- **QR**: qrcode + html5-qrcode

## Inicio Rapido

### Con Docker

```bash
# Clona el repositorio
git clone <url>
cd sistigym

# Levanta con Docker Compose
docker-compose up -d

# Ejecuta migraciones
docker-compose exec app pnpm db:migrate
docker-compose exec app pnpm db:seed
```

### Sin Docker

```bash
# Instala dependencias
pnpm install

# Configura variables de entorno
cp .env.example .env
# Edita .env con tu configuracion

# Ejecuta migraciones
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Inicia el servidor de desarrollo
pnpm dev
```

## Credenciales por Defecto

**Admin:**
- URL: http://localhost:5173/admin/login
- Email: admin@gym.com
- Password: admin123

**Recepcion:**
- Email: recepcion@gym.com
- Password: recepcion123

## Documentacion

- [Guia de Instalacion](docs/INSTALL.md)
- [Guia de Despliegue](docs/DEPLOY.md)
- [Guia de Configuracion](docs/CONFIG.md)
- [Guia de Administracion](docs/ADMIN_GUIDE.md)

## Estructura del Proyecto

```
sistigym/
├── app/
│   ├── components/       # Componentes reutilizables
│   ├── lib/             # Utilidades y servicios
│   │   ├── services/    # Logica de negocio (.server.ts)
│   │   └── validations.ts
│   └── routes/
│       ├── admin/       # Rutas del panel admin
│       └── app/         # Rutas de la PWA
├── db/
│   ├── schema.ts        # Schema de Drizzle
│   └── seed.ts          # Datos iniciales
├── public/
│   ├── icons/           # Iconos PWA
│   ├── manifest.json    # Manifest PWA
│   └── sw.js           # Service Worker
└── docs/               # Documentacion
```

## Scripts Disponibles

```bash
pnpm dev          # Servidor de desarrollo
pnpm build        # Build de produccion
pnpm start        # Iniciar en produccion
pnpm typecheck    # Verificar tipos TypeScript
pnpm db:generate  # Generar migraciones
pnpm db:migrate   # Ejecutar migraciones
pnpm db:seed      # Cargar datos iniciales
pnpm db:studio    # Abrir Drizzle Studio
```

## Seguridad

- Passwords hasheados con bcrypt (12 rounds)
- Sesiones con cookies httpOnly, secure, sameSite
- Tokens QR con hash SHA256, expiracion corta, un solo uso
- Validacion de entrada con Zod

## Licencia

MIT
