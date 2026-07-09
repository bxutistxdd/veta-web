# VETA

Tienda web de joyería (plata 925 y oro laminado) con panel de administración
integrado. Incluye catálogo, carrito y cotizaciones, gestión de pedidos y
stock, chats de WhatsApp con control de asesor humano, cupones/descuentos y
automatizaciones vía n8n.

## Stack

- Frontend: React 18 + Vite (ESM, estructura modular en `src/`)
- Backend / datos: Supabase (Postgres + Auth)
- Automatización: n8n (Railway) para flujos de WhatsApp y pedidos
- Deploy: GitHub Actions → GitHub Pages

## Estructura

- `src/admin/` — panel de administración (chats, pedidos, stock, catálogo)
- `src/cart/` — carrito, cupones, búsqueda
- `src/components/` — componentes de UI compartidos
- `src/lib/` — acceso a datos, catálogo, descuentos, stock
- `src/screens/` — pantallas públicas (home, catálogo, PDP, cuidado)

## Autoría

Desarrollado y mantenido por **Juan Sebastian Galindo Bautista**
([bxutistxdd](https://github.com/bxutistxdd)).

Este proyecto fue desarrollado por el autor con asistencia de herramientas
de inteligencia artificial (Claude Code, de Anthropic) durante el proceso
de desarrollo, bajo su dirección y control. Ver [LICENSE](./LICENSE).
