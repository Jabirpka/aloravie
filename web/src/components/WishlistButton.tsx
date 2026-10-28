"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useWishlist } from "./WishlistProvider";

// Heart toggle. `overlay` styles it for the top-right of a product card.
export function WishlistButton({
  productId,
  overlay = false,
  slug,
}: {
  productId: string;
  overlay?: boolean;
  slug?: string;
}) {
  const { customer } = useAuth();
  const { has, toggle } = useWishlist();
  const router = useRouter();
  const saved = has(productId);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!customer) {
      router.push(`/account?next=${encodeURIComponent(slug ? `/product/${slug}` : "/account/wishlist")}`);
      return;
    }
    void toggle(productId);
  }

  return (
    <button
      type="button"
      className={`wishlist-btn ${overlay ? "overlay" : ""} ${saved ? "saved" : ""}`}
      aria-pressed={saved}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      title={saved ? "Saved" : "Save to wishlist"}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 1 1 19.4 13z"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
