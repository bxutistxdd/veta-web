/* VETA · nuestra historia (contenido estático, sin backend). */

import { Reveal } from "../components/primitives.jsx";

export function Story() {
  const steps = [
    {
      n: "01",
      title: "Recién empezamos",
      body: "VETA nació hace poco. Hoy seleccionamos con cuidado cada pieza en plata 925 y oro laminado, y trabajamos para tener, muy pronto, producción propia.",
    },
    {
      n: "02",
      title: "El cliente, siempre primero",
      body: "Crecer no es apurarse. Cada mensaje, cada pedido y cada pieza que sale de acá recibe la misma atención — la llevemos haciendo un año o un minuto.",
    },
    {
      n: "03",
      title: "Lujo sin importar el precio",
      body: "Sentirte bien con lo que llevas puesto no debería depender de cuánto pagaste. Cuidamos el empaque, el trato y el después de la compra en cada pieza, sin excepción.",
    },
  ];
  return (
    <main className="page-enter">
      <section className="care-hero">
        <Reveal>
          <span className="eyebrow">— Nuestra historia</span>
        </Reveal>
        <Reveal delay={100}>
          <h1 className="h-1">
            Recién nacidos,
            <br />
            <em>con toda la intención.</em>
          </h1>
        </Reveal>
        <Reveal delay={300}>
          <p className="body-lg" style={{ maxWidth: "60ch" }}>
            Somos una joyería que apenas empieza. Elegimos crecer despacio, cuidando cada
            detalle, para construir algo que valga la pena sostener.
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
