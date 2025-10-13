export const metadata = { title: "Contact" };

export default function Contact() {
  return (
    <section className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-[0_8px_30px_rgba(20,16,12,0.06)] p-8 border border-[color-mix(in_oklab,var(--color-ink)_10%,transparent)]">
        <h1 className="text-3xl font-bold mb-6 text-center text-[var(--color-ink)]">
          Contact Us
        </h1>
        <p className="text-center text-neutral-600 mb-8">
          Have a question or custom request? We’d love to hear from you.
        </p>

        {/* Contact Form (Formspree) */}
        <form
          action="https://formspree.io/f/mvgwvzjy"
          method="POST"
          className="space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Name
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:ring-2 focus:ring-[var(--color-ink)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:ring-2 focus:ring-[var(--color-ink)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Message
            </label>
            <textarea
              name="message"
              rows={5}
              required
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 focus:ring-2 focus:ring-[var(--color-ink)] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg font-medium text-white bg-[var(--color-ink)] hover:opacity-90 transition"
          >
            Send Message
          </button>
        </form>

        <p className="text-xs text-center text-neutral-500 mt-6">
          Or email us directly at{" "}
          <a
            href="mailto:desertcandleworks@gmail.com"
            className="underline hover:text-[var(--color-ink)]"
          >
            desertcandleworks@gmail.com
          </a>
        </p>
      </div>
    </section>
  );
}