/* VETA · pie de página con enlaces de tienda, marca y contacto. */

export function Footer({ onNavigate }) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-col">
          <div className="wordmark" style={{ fontSize: 16 }}>
            VETA
          </div>
          <p className="footer-tagline">
            Plata ley 925 y oro laminado, elegidos con cuidado para acompañar.
          </p>
        </div>
        <div className="footer-col">
          <h4>Tienda</h4>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate({ name: "catalog", filter: "anillos" });
            }}
          >
            Anillos
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate({ name: "catalog", filter: "collares" });
            }}
          >
            Collares
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate({ name: "catalog", filter: "aretes" });
            }}
          >
            Aretes
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate({ name: "catalog", filter: "pulseras" });
            }}
          >
            Pulseras
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate({ name: "catalog", filter: "piercings" });
            }}
          >
            Piercings
          </a>
        </div>
        <div className="footer-col">
          <h4>Marca</h4>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate({ name: "care" });
            }}
          >
            Cuidado de la joya
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate({ name: "story" });
            }}
          >
            Nuestra historia
          </a>
          <a href="#">Garantía</a>
          <a href="#">Envíos</a>
        </div>
        <div className="footer-col">
          <h4>Contacto</h4>
          <a href="https://wa.me/573243147031" target="_blank" rel="noopener">
            WhatsApp
          </a>
          <a href="https://www.instagram.com/vetajoyeria.co/" target="_blank" rel="noopener">
            Instagram
          </a>
          <a href="mailto:veyajoyeria.coloficial@gmail.com">veyajoyeria.coloficial@gmail.com</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 VETA</span>
        <span>Hecho con tiempo, no con prisa.</span>
      </div>
    </footer>
  );
}
