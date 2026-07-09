/* VETA · guía de cuidado de la joya (contenido estático en 6 pasos). */

import { Reveal } from "../components/primitives.jsx";

export function Care() {
  const steps = [
    {
      n: "01",
      title: "Guarda separada",
      body: "Cada pieza en su bolsa de tela o estuche. El roce entre joyas es la primera causa de microrayas en la plata.",
    },
    {
      n: "02",
      title: "Última en ponerse, primera en quitarse",
      body: "Aplica perfume, crema y maquillaje antes de vestir la pieza. Quítala antes de dormir, nadar o entrenar.",
    },
    {
      n: "03",
      title: "Limpieza semanal suave",
      body: "Paño de microfibra seco y movimientos circulares. Para sulfuros visibles: agua tibia, jabón neutro y secado inmediato.",
    },
    {
      n: "04",
      title: "Oro laminado: trato extra",
      body: "Evita contacto directo con químicos. No uses pasta de dientes ni productos abrasivos: el laminado es delgado y se desgasta.",
    },
    {
      n: "05",
      title: "Limpieza profesional anual",
      body: "Tu pieza VETA tiene una limpieza profunda gratuita al año. Escríbenos por WhatsApp para coordinar.",
    },
    {
      n: "06",
      title: "Si pierde brillo",
      body: "Es normal: la plata se oxida con el aire. Una pulida con paño especializado (incluido en tu pedido) la devuelve a fábrica.",
    },
  ];
  return (
    <main className="page-enter">
      <section className="care-hero">
        <Reveal>
          <span className="eyebrow">— Guía</span>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="h-1">
            Cuidar la pieza
            <br />
            <em>es prolongar la historia.</em>
          </h1>
        </Reveal>
        <Reveal delay={300}>
          <p className="body-lg" style={{ maxWidth: "60ch" }}>
            Una joya bien tratada conserva su acabado durante décadas. Estos seis pasos cubren el
            95% de lo que necesitas saber para mantener tu VETA como el día uno.
          </p>
        </Reveal>
      </section>
      <div className="care-steps">
        {steps.map((s, i) => (
          <Reveal key={i} delay={i * 60} className="care-step">
            <div className="care-step-n">{s.n}</div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </Reveal>
        ))}
      </div>
    </main>
  );
}
