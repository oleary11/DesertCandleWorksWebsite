export const metadata = {
  title: "Privacy Policy",
  description: "How Desert Candle Works collects, uses and protects your information when you shop with us.",
  alternates: { canonical: "/privacy" },
};

const EMAIL = "contact@desertcandleworks.com";

export default function Privacy() {
  return (
    <section className="prose prose-neutral max-w-none px-6 sm:px-10 py-12">
      <h1>Privacy Policy</h1>
      <p><em>Last updated: September 27, 2026</em></p>

      <p>
        Desert Candle Works (&ldquo;we,&rdquo; &ldquo;us&rdquo; or &ldquo;our&rdquo;) is a small candle business in Scottsdale,
        Arizona. This policy explains what information we collect when you visit desertcandleworks.com, shop with us or
        contact us, and what we do with it.
      </p>

      <h2>Information We Collect</h2>
      <ul>
        <li>
          <strong>Orders:</strong> your name, email address, phone number, billing and shipping addresses, the items you
          buy and any discount code you use.
        </li>
        <li>
          <strong>Payments:</strong> card payments are handled by Stripe online and Square in person. We never see or
          store your full card number.
        </li>
        <li>
          <strong>Your account:</strong> if you create one, your name, email address and a securely hashed password, plus
          your order history.
        </li>
        <li>
          <strong>Mailing list:</strong> your email address, if you sign up for our emails.
        </li>
        <li>
          <strong>Messages:</strong> your name, email and message when you use our contact form or email us.
        </li>
        <li>
          <strong>Website visits:</strong> the pages you view, the site that referred you, your browser and device type,
          and your approximate location (city, state and country, worked out from your IP address). We use this only to
          see how the site is used. It isn&rsquo;t used to identify you or to show you ads.
        </li>
      </ul>

      <h2>How We Use It</h2>
      <ul>
        <li>To process, ship and deliver your order, and to contact you about it</li>
        <li>To handle returns, refunds and customer service</li>
        <li>To run your account and keep it secure</li>
        <li>To send our emails, if you signed up. Every email has an unsubscribe link.</li>
        <li>To calculate sales tax and prevent fraud</li>
        <li>To understand which pages and products people visit, so we can improve the shop</li>
      </ul>
      <p>
        <strong>We don&rsquo;t sell your personal information, and we don&rsquo;t share it for advertising.</strong>
      </p>

      <h2>Who We Share It With</h2>
      <p>We share information only with the services that help us run the shop:</p>
      <ul>
        <li><strong>Stripe</strong>: online payments and sales tax calculation</li>
        <li><strong>Square</strong>: in-person payments at markets and events</li>
        <li><strong>Shippo</strong> and the shipping carrier (such as USPS or UPS): shipping labels and delivery</li>
        <li><strong>Resend</strong>: order confirmation and account emails</li>
        <li><strong>Buttondown</strong>: our mailing list</li>
        <li><strong>Formspree</strong>: delivering contact form messages to us</li>
        <li><strong>Vercel and Neon</strong>: website hosting and our order database</li>
        <li><strong>TikTok Shop</strong>: if you buy from us on TikTok, TikTok shares your order details with us</li>
        <li>
          <strong>Instagram</strong>: our homepage shows our latest Instagram posts, which your browser loads from
          Instagram
        </li>
      </ul>
      <p>We may also share information if the law requires it, or to protect against fraud.</p>

      <h2>Cookies and Browser Storage</h2>
      <p>We use a small amount of storage in your browser to run the shop:</p>
      <ul>
        <li>A cookie that keeps you signed in to your account</li>
        <li>Your cart, saved in your browser so it&rsquo;s still there when you come back</li>
        <li>A random visit ID for our own page-view statistics, which isn&rsquo;t linked to your name or email</li>
      </ul>
      <p>
        We don&rsquo;t use advertising cookies or third-party trackers. You can clear cookies and site data in your
        browser settings at any time. The shop will still work, but you&rsquo;ll need to sign in again and your cart will
        be emptied.
      </p>

      <h2>How Long We Keep It</h2>
      <p>
        We keep order records for as long as we need them for tax, accounting and warranty purposes. We keep account
        information until you ask us to delete your account, and mailing list details until you unsubscribe.
      </p>

      <h2>Your Choices and Rights</h2>
      <ul>
        <li>Unsubscribe from our emails using the link at the bottom of any email.</li>
        <li>
          Ask us for a copy of your information, to correct it, or to delete it. Email{" "}
          <a href={`mailto:${EMAIL}?subject=Privacy%20request`}>{EMAIL}</a> with the subject &ldquo;Privacy
          request&rdquo;. We&rsquo;ll confirm it&rsquo;s you and reply within 30 days. We may need to keep some order
          records to meet tax law.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        The site uses HTTPS, passwords are stored as secure hashes, and payments are handled by Stripe and Square. No
        method of sending or storing data is completely secure, but we limit what we collect and who can access it.
      </p>

      <h2>Children</h2>
      <p>
        Our shop isn&rsquo;t directed at children under 13, and we don&rsquo;t knowingly collect their information. If you
        believe a child has given us personal information, email us and we&rsquo;ll delete it.
      </p>

      <h2>Changes to This Policy</h2>
      <p>If we change this policy, we&rsquo;ll post the new version here and update the date at the top.</p>

      <h2>Contact Us</h2>
      <p>
        Desert Candle Works, Scottsdale, Arizona
        <br />
        <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
      </p>
    </section>
  );
}
