# Guia de Despliegue - SistiGym

## Opciones de Despliegue

### 1. Docker Compose (Recomendado)

La forma mas sencilla de desplegar SistiGym es usando Docker Compose.

#### Requisitos

- Docker 20.x o superior
- Docker Compose 2.x o superior

#### Pasos

1. **Configura las variables de entorno:**

```bash
# Crea un archivo .env para produccion
cp .env.example .env.production

# Edita las variables
nano .env.production
```

Variables requeridas:
```env
DATABASE_URL=postgresql://postgres:tu-password-seguro@db:5432/sistigym
SESSION_SECRET=genera-un-secreto-seguro-de-32-caracteres
NODE_ENV=production
```

2. **Construye y levanta los contenedores:**

```bash
docker-compose up -d --build
```

3. **Ejecuta las migraciones:**

```bash
docker-compose exec app pnpm db:migrate
docker-compose exec app pnpm db:seed
```

4. **Verifica que todo funciona:**

```bash
docker-compose logs -f app
```

La aplicacion estara disponible en `http://localhost:3000`

### 2. VPS/Servidor Dedicado

#### Requisitos

- Ubuntu 20.04+ o similar
- Node.js 20.x
- PostgreSQL 14+
- Nginx (como reverse proxy)
- PM2 (process manager)

#### Pasos

1. **Instala dependencias del sistema:**

```bash
# Actualiza el sistema
sudo apt update && sudo apt upgrade -y

# Instala Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instala pnpm
npm install -g pnpm

# Instala PM2
npm install -g pm2

# Instala PostgreSQL
sudo apt install -y postgresql postgresql-contrib
```

2. **Configura PostgreSQL:**

```bash
sudo -u postgres psql

CREATE DATABASE sistigym;
CREATE USER gymadmin WITH ENCRYPTED PASSWORD 'tu-password-seguro';
GRANT ALL PRIVILEGES ON DATABASE sistigym TO gymadmin;
\q
```

3. **Clona y configura la aplicacion:**

```bash
cd /var/www
git clone <url-repositorio> sistigym
cd sistigym

# Instala dependencias
pnpm install

# Configura variables de entorno
cp .env.example .env
nano .env
```

4. **Construye la aplicacion:**

```bash
pnpm build
```

5. **Ejecuta migraciones:**

```bash
pnpm db:migrate
pnpm db:seed
```

6. **Configura PM2:**

```bash
# Inicia la aplicacion
pm2 start pnpm --name "sistigym" -- start

# Guarda la configuracion
pm2 save

# Configura inicio automatico
pm2 startup
```

7. **Configura Nginx:**

```nginx
# /etc/nginx/sites-available/sistigym
server {
    listen 80;
    server_name tudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Habilita el sitio
sudo ln -s /etc/nginx/sites-available/sistigym /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

8. **Configura SSL con Let's Encrypt:**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com
```

### 3. Railway/Render/Fly.io

Estas plataformas PaaS simplifican el despliegue:

#### Railway

1. Conecta tu repositorio
2. Agrega el addon de PostgreSQL
3. Configura las variables de entorno
4. Railway detectara automaticamente el proyecto

#### Render

1. Crea un Web Service
2. Conecta el repositorio
3. Configura Build Command: `pnpm install && pnpm build`
4. Configura Start Command: `pnpm start`
5. Agrega PostgreSQL database

## Configuracion de Subdominios

Para configurar subdominios (admin.gym.com, cliente.gym.com):

### Nginx

```nginx
# Admin panel
server {
    listen 80;
    server_name admin.tugym.com;

    location / {
        proxy_pass http://localhost:3000;
        # ... resto de configuracion
    }
}

# Client PWA
server {
    listen 80;
    server_name cliente.tugym.com;

    location / {
        proxy_pass http://localhost:3000;
        # ... resto de configuracion
    }
}
```

La aplicacion maneja las rutas internamente:
- `/admin/*` - Panel administrativo
- `/app/*` - PWA de clientes

## Backups

### Backup de PostgreSQL

```bash
# Backup manual
pg_dump -U postgres sistigym > backup_$(date +%Y%m%d).sql

# Restore
psql -U postgres sistigym < backup_20240115.sql
```

### Backup automatizado con cron

```bash
# Edita crontab
crontab -e

# Agrega backup diario a las 3 AM
0 3 * * * pg_dump -U postgres sistigym > /backups/sistigym_$(date +\%Y\%m\%d).sql
```

## Monitoreo

### PM2

```bash
# Ver estado
pm2 status

# Ver logs
pm2 logs sistigym

# Monitoreo en tiempo real
pm2 monit
```

### Docker

```bash
# Ver logs
docker-compose logs -f

# Estado de contenedores
docker-compose ps
```

## Actualizaciones

```bash
# Detener la aplicacion
pm2 stop sistigym

# Actualizar codigo
git pull origin main

# Instalar dependencias nuevas
pnpm install

# Ejecutar migraciones
pnpm db:migrate

# Reconstruir
pnpm build

# Reiniciar
pm2 restart sistigym
```
