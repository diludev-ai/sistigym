# Guia de Instalacion - SistiGym

## Requisitos Previos

- **Node.js** 20.x o superior
- **pnpm** 8.x o superior
- **PostgreSQL** 14.x o superior
- **Git**

## Instalacion Local

### 1. Clonar el Repositorio

```bash
git clone <url-repositorio>
cd sistigym
```

### 2. Instalar Dependencias

```bash
pnpm install
```

### 3. Configurar Variables de Entorno

Crea un archivo `.env` en la raiz del proyecto:

```env
# Base de datos PostgreSQL
DATABASE_URL="postgresql://usuario:password@localhost:5432/sistigym"

# Secreto para las sesiones (genera uno seguro para produccion)
SESSION_SECRET="tu-secreto-super-seguro-aqui"

# Entorno
NODE_ENV="development"
```

### 4. Configurar la Base de Datos

Genera las migraciones y ejecutalas:

```bash
# Generar migraciones desde el schema
pnpm db:generate

# Ejecutar migraciones
pnpm db:migrate

# Cargar datos iniciales (admin y planes)
pnpm db:seed
```

### 5. Iniciar el Servidor de Desarrollo

```bash
pnpm dev
```

El servidor estara disponible en `http://localhost:5173`

## Credenciales Iniciales

Despues de ejecutar el seed, tendras acceso a:

**Panel Admin:**
- URL: `/admin/login`
- Email: `admin@gym.com`
- Password: `admin123`

**Recepcion:**
- URL: `/admin/login`
- Email: `recepcion@gym.com`
- Password: `recepcion123`

## Verificar Instalacion

1. Abre `http://localhost:5173/admin/login`
2. Ingresa con las credenciales de admin
3. Verifica que puedes acceder al dashboard

## Problemas Comunes

### Error de conexion a la base de datos

Verifica que:
- PostgreSQL esta corriendo
- Las credenciales en `DATABASE_URL` son correctas
- La base de datos existe

```bash
# Crear base de datos manualmente
psql -U postgres
CREATE DATABASE sistigym;
```

### Error de migraciones

```bash
# Eliminar migraciones existentes y regenerar
rm -rf db/migrations
pnpm db:generate
pnpm db:migrate
```

### Puerto en uso

Cambia el puerto en el archivo de configuracion o termina el proceso que lo esta usando:

```bash
# En Linux/Mac
lsof -i :5173
kill -9 <PID>

# En Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```
