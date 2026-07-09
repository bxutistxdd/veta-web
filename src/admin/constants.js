/* VETA admin · definición de las pestañas del panel (orden, etiquetas, iconos).
   Compartida entre el shell (sidebar/menú móvil) y el selector de la pestaña
   Chats. */

export const ADMIN_TABS = [
  { id: "inicio", label: "Inicio", desc: "Resumen general", icon: "▦" },
  { id: "chats", label: "Chats", desc: "Mensajes de clientes", icon: "✉" },
  { id: "despachos", label: "Despachos", desc: "Pedidos y envíos", icon: "⬡" },
  { id: "productos", label: "Productos", desc: "Catálogo y visibilidad", icon: "◈" },
  { id: "categorias", label: "Categorías", desc: "Categorías y referencias", icon: "❏" },
  { id: "stock", label: "Stock", desc: "Inventario por talla", icon: "◫" },
  { id: "descuentos", label: "Descuentos", desc: "Códigos promocionales", icon: "◎" },
  { id: "config", label: "Config.", desc: "Ajustes del sistema", icon: "◉" },
];
