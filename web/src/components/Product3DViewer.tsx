"use client";

import { createElement, useEffect } from "react";

// Loads Google's <model-viewer> web component once, then renders a 3D view of
// the product's glTF/GLB model. Rendered via createElement so the custom element
// doesn't need a JSX type declaration.
export function Product3DViewer({ src, alt }: { src: string; alt: string }) {
  useEffect(() => {
    const id = "model-viewer-script";
    if (!document.getElementById(id)) {
      const s = document.createElement("script");
      s.id = id;
      s.type = "module";
      s.src = "https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js";
      document.body.appendChild(s);
    }
  }, []);

  return createElement("model-viewer", {
    src,
    alt,
    "camera-controls": true,
    "auto-rotate": true,
    "shadow-intensity": "1",
    ar: true,
    loading: "eager",
    style: { width: "100%", height: "100%", backgroundColor: "transparent" },
  });
}
