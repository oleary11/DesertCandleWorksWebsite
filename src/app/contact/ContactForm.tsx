"use client";

import { useState } from "react";
import { useModal } from "@/hooks/useModal";

export default function ContactForm() {
  const { showAlert } = useModal();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("https://formspree.io/f/mvgwvzjy", {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        setIsSuccess(true);
        form.reset();
        setTimeout(() => setIsSuccess(false), 5000);
      } else {
        await showAlert("Oops! There was a problem submitting your form. Please try again.", "Error");
      }
    } catch {
      await showAlert("Oops! There was a problem submitting your form. Please try again.", "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-[0_8px_30px_rgba(20,16,12,0.06)] p-8 border border-[color-mix(in_oklab,var(--color-ink)_10%,transparent)]">
        <div className="text-center">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold mb-3 text-[var(--color-ink)]">
            Message Sent!
          </h2>
          <p className="text-neutral-600 mb-6">
            Thank you for reaching out! We&apos;ll get back to you as soon as possible.
          </p>
          <button
            onClick={() => setIsSuccess(false)}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg bg-white rounded-2xl shadow-[0_8px_30px_rgba(20,16,12,0.06)] p-8 border border-[color-mix(in_oklab,var(--color-ink)_10%,transparent)]">
      <h1 className="text-3xl font-bold mb-6 text-center text-[var(--color-ink)]">
        Contact Us
      </h1>
      <p className="text-center text-neutral-600 mb-8">
        Have a question or custom request? We&apos;d love to hear from you.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
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
          disabled={isSubmitting}
          className="w-full py-2.5 rounded-lg font-medium text-white bg-[var(--color-ink)] hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </span>
          ) : (
            "Send Message"
          )}
        </button>
      </form>

      <p className="text-xs text-center text-neutral-500 mt-6">
        Or email us directly at{" "}
        <a
          href="mailto:contact@desertcandleworks.com"
          className="underline hover:text-[var(--color-ink)]"
        >
          contact@desertcandleworks.com
        </a>
      </p>
    </div>
  );
}
