import { Wordmark } from "./Wordmark";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <Wordmark />
          <div className="footer-ship">
            <span>Free shipping over ₹1,499</span>
            <span>7-day easy returns</span>
            <span>Made in India</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>a·lor·a·VEE — a life full of light</span>
          <span>© {new Date().getFullYear()} Aloravie · Women&rsquo;s clothing &amp; accessories</span>
        </div>
      </div>
    </footer>
  );
}
