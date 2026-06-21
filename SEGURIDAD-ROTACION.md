# Rotación de credenciales expuestas (B3)

El repositorio fue **público** y tuvo dos secretos committeados (commit `f0ca15b`,
todavía presentes en el historial de git). Ya se hizo: repo a privado + secretos
movidos a `process.env` (commit `4deef8d`). **Falta rotar ambos** y, opcionalmente,
limpiar el historial. Esto solo lo puedes hacer tú (acceso a los dashboards).

## 1. Password de Postgres de Railway (n8n)

Secreto expuesto: el password de Postgres de la base de datos de n8n (el valor
literal está en el commit `f0ca15b` del historial; no se reproduce aquí).

1. Railway → proyecto **veta-automation** → servicio **Postgres** → pestaña **Variables**.
2. Rota el password (Railway tiene opción de regenerar, o cambia `POSTGRES_PASSWORD`).
3. n8n se reconecta solo con la variable de referencia interna; si no, redeploy de n8n.
4. Actualiza tu `.env` local (`RAILWAY_PG_PASSWORD=`) para los scripts de deploy.
5. Avísame el nuevo valor por un canal seguro (no aquí) y actualizo la memoria.

## 2. Token de Meta / WhatsApp Cloud API

Secreto expuesto: el token de la app de Meta/WhatsApp (valor en el commit `f0ca15b`
del historial; no se reproduce aquí).

1. Meta for Developers → tu App → **WhatsApp → Configuración de la API**.
2. Si es un **token temporal**, genera un **token permanente de System User**
   (Business Settings → Usuarios del sistema → generar token con permisos
   `whatsapp_business_messaging` + `whatsapp_business_management`).
3. Actualiza `WA_TOKEN` en las **Variables del servicio n8n** en Railway.
4. Redeploy de n8n para que tome el nuevo token.

## 3. Variables que conviene añadir en Railway (servicio n8n)

Para que funcionen las plantillas (C1) y la firma del webhook (B1):

- `WABA_ID=999855739698017`
- `APP_SECRET=` (App Secret de Meta — App → Configuración → Básica → Mostrar)
- (B1) `WA_SIG_ENFORCE=false` al principio; se pone en `true` tras verificar en logs
  que las firmas reales validan correctamente.

## 4. (Opcional, "después") Limpiar el historial de git

Aunque el repo es privado, los secretos siguen en commits viejos. Para borrarlos del
historial: `git filter-repo` (o BFG Repo-Cleaner) sobre los archivos afectados, luego
`git push --force`. **Hacerlo solo después de rotar** (si ya rotaste, el valor viejo
en el historial deja de ser sensible). Lo coordino contigo cuando quieras.
