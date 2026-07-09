/* VETA · tarjeta de producto para grillas de catálogo y destacados. */

import { VETA_DATA } from "../lib/data.js";
import { isProductSoldOut } from "../lib/stock.js";
import { Reveal, Placeholder } from "./primitives.jsx";

export function ProductCard({ product, onOpen, delay = 0 }) {
  const shape = VETA_DATA.shapes[product.cat]?.kind || "ring";
  const img = VETA_DATA.productImages(product)[0] || null;
  const soldOut = isProductSoldOut(product);
  return (
    <Reveal delay={delay}>
      <button
        className={`product-card${soldOut ? " product-card--out" : ""}`}
        onClick={() => onOpen(product)}
      >
        <Placeholder
          shape={shape}
          label={`${product.material.toLowerCase()} / ${product.finish.toLowerCase()}`}
          tag={product.id.toUpperCase()}
          img={img}
        />
        {soldOut && <span className="product-card-soldout">Agotado</span>}
        <div className="product-card-meta">
          <div>
            <h4>{product.name}</h4>
            <span className="product-card-sub">{product.material}</span>
          </div>
          <span className="price">{VETA_DATA.fmtPrice(product.price)}</span>
        </div>
      </button>
    </Reveal>
  );
}
