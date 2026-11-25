# Planificador Ejecutivo — Dirección Controller

Tablero de trabajo de Colbeef (dashboard, Gantt, lista, calendario y fechas límite). Los datos y las claves viven en **MySQL del servidor**, no en Firebase ni en el navegador.

## Estructura

```
server.js                 API y página (Express)
db.js                     Conexión MySQL y carga inicial
routes/                   Login y tareas
sql/crear-planner-mysql.sql   Script para Workbench
frontend/                 Pantalla
```

## En este equipo

1. Ejecuta `sql/crear-planner-mysql.sql` en MySQL Workbench con un usuario administrador (root).
2. Copia `.env.example` a `.env` y deja la misma `DB_PASSWORD` del script.
3. `npm install`
4. `npm start` o `scripts\start.bat`

Abre **http://localhost:4173**

La primera vez el servidor crea tres usuarios con la clave `INITIAL_PASSWORD` y las 12 tareas de ejemplo.

| Correo | Quién ve |
|---|---|
| director.controller@colbeef.com | Todo el equipo (administrador) |
| control.interno@colbeef.com | Solo sus tareas |
| lider.proyectos@colbeef.com | Solo sus tareas |

`director.controller@colbeef.com` es quien gestiona usuarios: en la pestaña **Usuarios** puede crear, editar, eliminar y restablecer la clave a la estándar (`STANDARD_PASSWORD`). Los demás entran con esa clave y la cambian con el botón de la llave. La cuenta del director no se puede eliminar.

## En el servidor 205

1. Copia la carpeta (sin `node_modules` y sin `.env`).
2. En MySQL Workbench del 205 ejecuta `sql/crear-planner-mysql.sql`. Cambia la contraseña del usuario `planner` antes de ejecutarlo.
3. Crea el `.env` en el 205 con esa misma contraseña, un `JWT_SECRET` distinto y la misma clave en `INITIAL_PASSWORD` y `STANDARD_PASSWORD`.
4. `npm install` y `npm start`.
5. Node escucha en `0.0.0.0`. Quien esté en la red abre `http://IP-DEL-205:4173`. Abre ese puerto en el firewall de Windows solo para la red interna.

La página no se publica en internet. MySQL solo acepta al usuario `planner` desde la misma máquina.
