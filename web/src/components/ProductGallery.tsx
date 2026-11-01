"use client";

import { useRef, useState } from "react";
import { Product3DViewer } from "./Product3DViewer";
import type { ProductImage } from "@/lib/types";

type View = { kind: "3d" } | { kind: "img"; img: ProductImage };

export function ProductGallery({
  images,
  model3dUrl,
  title,
  tone,
}: {
  images: ProductImage[];
  model3dUrl?: string | null;
  title: string;
  tone: string;
}) {
  // Views: the 3D model (if any) first, then every photo.
  const views: View[] = [
    ...(model3dUrl ? [{ kind: "3d" as const }] : []),
    ...images.map((img) => ({ kind: "img" as const, img })),
  ];
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);

  if (views.length === 0) {
    return <div className="pdp-image" style={{ background: tone }} />;
  }

  const current = views[Math.min(active, views.length - 1)]!;
  const go = (d: number) => setActive((a) => (a + d + views.length) % views.length);

  return (
    <div className="pdp-gallery">
      <div
        className="pdp-image"
        onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
          if (Math.abs(dx) > 40 && views.length > 1) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {current.kind === "3d" ? (
          <>
            <span className="badge-3d">3D · drag to rotate</span>
            <Product3DViewer src={model3dUrl!} alt={title} />
          </>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={current.img.url} alt={current.img.alt ?? title} />
        )}

        {views.length > 1 && (
          <>
            <button className="pdp-arrow prev" aria-label="Previous image" onClick={() => go(-1)}>‹</button>
            <button className="pdp-arrow next" aria-label="Next image" onClick={() => go(1)}>›</button>
          </>
        )}
      </div>

      {views.length > 1 && (
        <div className="pdp-thumbs" role="tablist" aria-label="Product images">
          {views.map((v, i) => (
            <button
              key={i}
              className={`pdp-thumb ${i === active ? "active" : ""}`}
              aria-label={`View ${i + 1} of ${views.length}`}
              aria-selected={i === active}
              onClick={() => setActive(i)}
            >
              {v.kind === "3d" ? (
                <span className="thumb-3d">3D</span>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={v.img.url} alt="" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
