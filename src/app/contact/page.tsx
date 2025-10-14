import ContactForm from "./ContactForm";

export const metadata = { title: "Contact" };

export default function Contact() {
  return (
    <section className="flex items-center justify-center bg-[var(--color-bg)] py-12 px-6">
      <ContactForm />
    </section>
  );
}