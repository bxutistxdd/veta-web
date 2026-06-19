/* VETA · catálogo simulado (Colombia)
   Precios en COP. Migrar a CMS/headless en Claude Code. */

window.VETA_DATA = (function () {
  const products = [
    // ── ANILLOS ──────────────────────────────────────────────
    { id: "an-01", name: "Anillo Vena",        cat: "anillos",   material: "Plata 925",     finish: "Pulido",   price: 180000, sizes: ["5","6","7","8","9"], blurb: "Una línea sobre la piel, fina y precisa. La idea reducida a su esencia.", desc: "Inspirado en la veta natural de la roca. Anillo de banda continua, fundido y pulido a mano.", images: { main: "assets/images/an-01.jpg" } },
    { id: "an-02", name: "Anillo Oráculo",     cat: "anillos",   material: "Oro laminado",  finish: "Mate",     price: 280000, sizes: ["6","7","8"],         blurb: "Sello discreto, presencia firme.", desc: "Sello bajo con grabado interior personalizable. Oro laminado 18k sobre plata 925.", images: { main: "assets/images/an-02.jpg" } },
    { id: "an-03", name: "Anillo Doble Río",   cat: "anillos",   material: "Plata 925",     finish: "Pulido",   price: 220000, sizes: ["5","6","7","8"],     blurb: "Dos líneas paralelas, un solo cuerpo.", desc: "Anillo doble en plata maciza, contornos suavizados.", images: { main: "assets/images/an-03.jpg" } },
    { id: "an-04", name: "Anillo Soldado",     cat: "anillos",   material: "Plata 925",     finish: "Texturizado", price: 250000, sizes: ["6","7","8","9"], blurb: "Marca del fuego sobre el metal.", desc: "Textura forjada irrepetible. Cada pieza única en su acabado.", images: { main: "assets/images/an-04.jpg" } },

    // ── COLLARES ─────────────────────────────────────────────
    { id: "co-01", name: "Collar Caligrafía",  cat: "collares",  material: "Plata 925",     finish: "Pulido",   price: 290000, sizes: ["40cm","45cm","50cm"], blurb: "Un trazo sobre el cuello.", desc: "Pendiente vertical en plata, eslabón fino veneciano. Personalizable en largo.", images: { main: "assets/images/co-01.jpg" } },
    { id: "co-02", name: "Collar Luna Hueca",  cat: "collares",  material: "Oro laminado",  finish: "Pulido",   price: 380000, sizes: ["42cm","45cm"], blurb: "Volumen sin peso.", desc: "Medallón hueco trabajado a martillo. Acabado en oro laminado 18k.", images: { main: "assets/images/co-02.jpg" } },
    { id: "co-03", name: "Collar Hebra",       cat: "collares",  material: "Plata 925",     finish: "Satinado", price: 210000, sizes: ["40cm","45cm"], blurb: "Una hebra que se cierra sin nudo.", desc: "Cadena ligera tipo serpentina, broche imantado.", images: { main: "assets/images/co-03.jpg" } },
    { id: "co-04", name: "Collar Mompox",      cat: "collares",  material: "Plata 925",     finish: "Pulido",   price: 420000, sizes: ["50cm"], blurb: "Filigrana, herencia viva.", desc: "Collar inspirado en la filigrana momposina. Pieza statement trabajada a mano.", images: { main: "assets/images/co-04.jpg" } },

    // ── ARETES ───────────────────────────────────────────────
    { id: "ar-01", name: "Aretes Espiga",      cat: "aretes",    material: "Plata 925",     finish: "Pulido",   price: 150000, sizes: ["S","M","L"], blurb: "Largos como una palabra contenida.", desc: "Aretes alargados con caída sutil. Cierre de presión.", images: { main: "assets/images/ar-01.jpg" } },
    { id: "ar-02", name: "Aretes Sol",         cat: "aretes",    material: "Oro laminado",  finish: "Pulido",   price: 190000, sizes: ["10mm","14mm","18mm"], blurb: "Círculo. Sin metáfora.", desc: "Aros redondos con tubo interior. Oro laminado 18k sobre plata 925.", images: { main: "assets/images/ar-02.jpg" } },
    { id: "ar-03", name: "Aretes Punto",       cat: "aretes",    material: "Plata 925",     finish: "Pulido",   price: 80000,  sizes: ["3mm","4mm","5mm"], blurb: "Lo mínimo que existe.", desc: "Topos de plata maciza. Cierre de mariposa.", images: { main: "assets/images/ar-03.jpg" } },
    { id: "ar-04", name: "Aretes Cascada",     cat: "aretes",    material: "Plata 925",     finish: "Satinado", price: 220000, sizes: ["único"], blurb: "El gesto del agua al caer.", desc: "Aretes en cascada de tres niveles, fundidos en pieza única.", images: { main: "assets/images/ar-04.jpg" } },

    // ── PULSERAS ─────────────────────────────────────────────
    { id: "pu-01", name: "Pulsera Cordel",     cat: "pulseras",  material: "Plata 925",     finish: "Pulido",   price: 170000, sizes: ["16cm","18cm","20cm"], blurb: "Anuda lo que importa.", desc: "Pulsera tipo cordel trenzado, ajustable con nudos corredizos.", images: { main: "assets/images/pu-01.jpg" } },
    { id: "pu-02", name: "Pulsera Eslabón",    cat: "pulseras",  material: "Oro laminado",  finish: "Pulido",   price: 290000, sizes: ["17cm","19cm"], blurb: "Tradición que vuelve.", desc: "Eslabones rectangulares, peso medio. Oro laminado 18k.", images: { main: "assets/images/pu-02.jpg" } },
    { id: "pu-03", name: "Pulsera Hilo",       cat: "pulseras",  material: "Plata 925",     finish: "Pulido",   price: 110000, sizes: ["único"], blurb: "Tan fina que olvidas que está.", desc: "Pulsera de hilo de plata 1mm. Cierre de mosquetón mínimo.", images: { main: "assets/images/pu-03.jpg" } },
    { id: "pu-04", name: "Pulsera Banda",      cat: "pulseras",  material: "Plata 925",     finish: "Mate",     price: 230000, sizes: ["S","M","L"], blurb: "Brazalete que abraza.", desc: "Pulsera tipo manilla abierta, ajustable suavemente.", images: { main: "assets/images/pu-04.jpg" } },

    // ── PIERCINGS ────────────────────────────────────────────
    { id: "pi-01", name: "Piercing Punto",     cat: "piercings", material: "Plata 925",     finish: "Pulido",   price: 65000,  sizes: ["1.2mm","1.6mm"], blurb: "El detalle que cierra una frase.", desc: "Piercing flat de rosca interna. Plata 925 grado quirúrgico.", images: { main: "assets/images/pi-01.jpg" } },
    { id: "pi-02", name: "Piercing Aro Mini",  cat: "piercings", material: "Oro laminado",  finish: "Pulido",   price: 95000,  sizes: ["6mm","8mm","10mm"], blurb: "Curva mínima.", desc: "Argolla micro hoop, bisagra integrada para abrir sin pinzas.", images: { main: "assets/images/pi-02.jpg" } },
    { id: "pi-03", name: "Piercing Línea",     cat: "piercings", material: "Plata 925",     finish: "Pulido",   price: 80000,  sizes: ["6mm","8mm"], blurb: "Barra horizontal, geometría pura.", desc: "Barbell helix con bolas planas. Acabado espejo.", images: { main: "assets/images/pi-03.jpg" } },
    { id: "pi-04", name: "Piercing Gota",      cat: "piercings", material: "Oro laminado",  finish: "Pulido",   price: 130000, sizes: ["único"], blurb: "Una pausa que cuelga.", desc: "Piercing con colgante en forma de gota. Oro laminado 18k.", images: { main: "assets/images/pi-04.jpg" } },
  ];

  const categories = [
    { id: "anillos",   label: "Anillos",   blurb: "Banda, sello, doble. Pieza única o stackable." },
    { id: "collares",  label: "Collares",  blurb: "De cadena fina a filigrana momposina." },
    { id: "aretes",    label: "Aretes",    blurb: "Topo, aro, caída. Cierre seguro de presión." },
    { id: "pulseras",  label: "Pulseras",  blurb: "Trenzadas, eslabón, hilo o brazalete abierto." },
    { id: "piercings", label: "Piercings", blurb: "Grado quirúrgico. Rosca interna." },
  ];

  const materials = ["Plata 925", "Oro laminado"];
  const finishes  = ["Pulido", "Mate", "Satinado", "Texturizado"];

  // Forma SVG por categoría — placeholder iconográfico, no figurativo.
  const shapes = {
    anillos:   { kind: "ring" },
    collares:  { kind: "necklace" },
    aretes:    { kind: "earring" },
    pulseras:  { kind: "bracelet" },
    piercings: { kind: "piercing" },
  };

  // Formato Colombia: $180.000 (punto como separador de miles, sin decimales)
  const fmtPrice = (n) => "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return { products, categories, materials, finishes, shapes, fmtPrice };
})();

/* ─────────────────────────────────────────────
   VETA_IMG — mapeo de imágenes por id de producto.
   Fotos de referencia libres de licencia (Unsplash, uso comercial
   sin atribución) mientras no hay fotografía propia del producto.
   Reemplazar cada ruta por la foto real cuando esté disponible.
   ───────────────────────────────────────────── */
window.VETA_IMG = window.VETA_IMG || {
  "an-01": "assets/images/an-01.jpg",
  "an-02": "assets/images/an-02.jpg",
  "an-03": "assets/images/an-03.jpg",
  "an-04": "assets/images/an-04.jpg",
  "co-01": "assets/images/co-01.jpg",
  "co-02": "assets/images/co-02.jpg",
  "co-03": "assets/images/co-03.jpg",
  "co-04": "assets/images/co-04.jpg",
  "ar-01": "assets/images/ar-01.jpg",
  "ar-02": "assets/images/ar-02.jpg",
  "ar-03": "assets/images/ar-03.jpg",
  "ar-04": "assets/images/ar-04.jpg",
  "pu-01": "assets/images/pu-01.jpg",
  "pu-02": "assets/images/pu-02.jpg",
  "pu-03": "assets/images/pu-03.jpg",
  "pu-04": "assets/images/pu-04.jpg",
  "pi-01": "assets/images/pi-01.jpg",
  "pi-02": "assets/images/pi-02.jpg",
  "pi-03": "assets/images/pi-03.jpg",
  "pi-04": "assets/images/pi-04.jpg",
};
