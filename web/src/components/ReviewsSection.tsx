"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import type { ReviewSummary } from "@/lib/types";
import { ApiRequestError, getReviews, postReview } from "@/lib/client";

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const rounded = Math.round(value);
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rounded ? "star on" : "star"}>★</span>
      ))}
    </span>
  );
}

export function ReviewsSection({ slug }: { slug: string }) {
  const { customer, loading } = useAuth();
  const [data, setData] = useState<ReviewSummary | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function refresh() {
    try {
      setData(await getReviews(slug));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postReview(slug, { rating, title: title || undefined, body: body || undefined });
      setDone(true);
      setTitle("");
      setBody("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't post your review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="reviews">
      <div className="reviews-head">
        <h2>Reviews</h2>
        {data && data.count > 0 && (
          <div className="reviews-avg">
            <Stars value={data.average} size={18} />
            <span className="strong">{data.average.toFixed(1)}</span>
            <span className="muted">({data.count})</span>
          </div>
        )}
      </div>

      {data && data.reviews.length === 0 && <p className="muted">No reviews yet — be the first.</p>}

      <div className="review-list">
        {data?.reviews.map((r) => (
          <div key={r.id} className="review">
            <div className="review-top">
              <Stars value={r.rating} />
              <span className="strong">{r.authorName}</span>
              {r.verifiedPurchase && <span className="verified">Verified purchase</span>}
            </div>
            {r.title && <div className="review-title">{r.title}</div>}
            {r.body && <p className="review-body">{r.body}</p>}
          </div>
        ))}
      </div>

      {!loading && (
        customer ? (
          done ? (
            <p className="muted">Thanks for your review!</p>
          ) : (
            <form className="review-form" onSubmit={submit}>
              <h3>Write a review</h3>
              <div className="star-pick" role="radiogroup" aria-label="Your rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} className={`star-btn ${n <= rating ? "on" : ""}`}
                    aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setRating(n)}>★</button>
                ))}
              </div>
              <input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea rows={3} placeholder="Tell others what you think (optional)" value={body} onChange={(e) => setBody(e.target.value)} />
              {error && <p className="form-error">{error}</p>}
              <button className="btn primary" type="submit" disabled={busy}>{busy ? "Posting…" : "Post review"}</button>
            </form>
          )
        ) : (
          <p className="muted"><Link href={`/account?next=/product/${slug}`} className="section-link">Sign in</Link> to write a review.</p>
        )
      )}
    </section>
  );
}
