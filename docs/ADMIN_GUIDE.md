# Guia de Administracion - SistiGym

## Acceso al Panel

1. Navega a `/admin/login`
2. Ingresa con tus credenciales de administrador
3. Seras redirigido al Dashboard

## Dashboard

El dashboard muestra un resumen general:

- **Miembros Activos**: Total de clientes con membresia vigente
- **Ingresos del Mes**: Total recaudado en el mes actual
- **Accesos Hoy**: Cantidad de check-ins del dia
- **Por Vencer**: Membresias que vencen en los proximos 7 dias
- **Morosos**: Clientes con pagos pendientes

## Gestion de Miembros

### Ver Miembros

Accede a `/admin/members` para ver la lista completa de miembros.

**Funciones disponibles:**
- Busqueda por nombre o email
- Filtrar por estado (activo/inactivo)
- Ordenar por fecha de registro

### Crear Nuevo Miembro

1. Click en "Nuevo Miembro"
2. Completa el formulario:
   - Nombre y Apellido
   - Email (sera su usuario de acceso)
   - Telefono
   - Password inicial
3. Guarda el registro

### Editar Miembro

1. Click en el miembro en la lista
2. Modifica los campos necesarios
3. Guarda los cambios

### Desactivar Miembro

1. Abre el detalle del miembro
2. Click en "Desactivar"
3. El miembro no podra acceder hasta ser reactivado

## Gestion de Planes

### Ver Planes

Accede a `/admin/plans` para gestionar los planes de membresia.

### Crear Plan

1. Click en "Nuevo Plan"
2. Define:
   - Nombre
   - Precio
   - Duracion en dias
   - Descripcion (opcional)
3. Guarda el plan

### Desactivar Plan

Los planes desactivados no apareceran como opcion al crear nuevas membresias, pero las membresias existentes con ese plan seguiran funcionando.

## Gestion de Membresias

### Crear Membresia

1. Accede a `/admin/memberships`
2. Click en "Nueva Membresia"
3. Selecciona:
   - Miembro
   - Plan
   - Fecha de inicio
4. La fecha de fin se calcula automaticamente

### Renovar Membresia

1. Abre el detalle del miembro
2. Click en "Renovar"
3. Selecciona el nuevo plan
4. La nueva membresia comenzara al terminar la actual

### Congelar Membresia

Permite pausar una membresia temporalmente (vacaciones, lesiones, etc.):

1. Abre el detalle de la membresia
2. Click en "Congelar"
3. Indica los dias de congelamiento
4. La fecha de fin se extendera automaticamente

### Descongelar Membresia

1. Abre la membresia congelada
2. Click en "Descongelar"
3. La membresia vuelve a estar activa

### Cancelar Membresia

1. Abre el detalle de la membresia
2. Click en "Cancelar"
3. Confirma la cancelacion
4. El miembro no podra acceder

## Registro de Pagos

### Ver Pagos

Accede a `/admin/payments` para ver el historial de pagos.

**Filtros disponibles:**
- Por miembro
- Por rango de fechas
- Por metodo de pago

### Registrar Pago

1. Click en "Nuevo Pago"
2. Selecciona:
   - Miembro
   - Membresia
   - Monto
   - Metodo (efectivo, tarjeta, transferencia)
   - Notas (opcional)
3. Guarda el pago

### Eliminar Pago

Solo disponible para administradores:
1. Abre el detalle del pago
2. Click en "Eliminar"
3. Confirma la eliminacion

## Control de Acceso

### Acceso Manual

1. Accede a `/admin/access`
2. En la seccion "Check-in Manual":
   - Busca al miembro
   - Seleccionalo
   - Click en "Registrar Entrada"
3. Veras el resultado (aprobado/denegado)

### Escaneo QR

1. En `/admin/access`, cambia a modo "Camara"
2. Activa la camara
3. Escanea el codigo QR del cliente
4. El sistema validara automaticamente

### Historial de Accesos

El panel derecho muestra los accesos recientes con:
- Nombre del miembro
- Hora de acceso
- Metodo (QR/manual)
- Estado (aprobado/denegado)
- Motivo del rechazo (si aplica)

## Reportes

### Resumen General

Accede a `/admin/reports` para ver estadisticas:

- **Membresias**: Activas, expiradas, congeladas
- **Ingresos**: Total del mes, por metodo de pago
- **Asistencia**: Accesos por hora, dias mas concurridos

### Morosos

La seccion de morosos muestra:
- Lista de clientes con membresia vencida
- Dias de atraso
- Monto pendiente
- Contacto

### Exportar Datos

Proximamente: Exportacion a Excel/CSV

## Configuracion

### Datos del Gimnasio

En `/admin/settings` puedes configurar:

- **Nombre del gimnasio**: Se muestra en el PWA del cliente
- **Tolerancia de morosidad**: Dias antes de bloquear acceso
- **Duracion del QR**: Segundos de validez del codigo

### Usuarios Staff

Gestiona los usuarios que pueden acceder al panel:

- **Admin**: Acceso total
- **Recepcion**: Acceso limitado a operaciones diarias

## Flujos de Trabajo Comunes

### Alta de Nuevo Cliente

1. Crear miembro (`/admin/members` > Nuevo)
2. Crear membresia (`/admin/memberships` > Nueva)
3. Registrar pago (`/admin/payments` > Nuevo)
4. Entregar credenciales al cliente

### Renovacion

1. Buscar al miembro
2. Crear nueva membresia
3. Registrar pago
4. La nueva membresia inicia al vencer la anterior

### Cliente Moroso

1. Revisar lista de morosos en reportes
2. Contactar al cliente
3. Si paga:
   - Registrar pago
   - Renovar membresia
4. El acceso se restaura automaticamente

### Cancelacion

1. Buscar membresia activa
2. Cancelar membresia
3. El cliente no podra generar QR ni acceder

## Preguntas Frecuentes

**¿Como reseteo el password de un miembro?**
Desde el detalle del miembro, usa la opcion "Cambiar Password".

**¿Puedo dar acceso temporal sin membresia?**
Crea un plan "Pase Diario" y asigna una membresia de 1 dia.

**¿Que pasa si se cae el internet?**
El sistema requiere conexion para validar accesos. En emergencias, usa check-in manual verificando identidad del cliente.

**¿Como veo los accesos de un miembro especifico?**
En el detalle del miembro hay una seccion de "Historial de Accesos".
