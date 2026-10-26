import UnsubscribeForm from "./UnsubscribeForm";

export const metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string }>;
}) {
  const { e = "", t = "" } = await searchParams;
  return (
    <section className="mx-auto max-w-lg px-6 py-20 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Unsubscribe</h1>
      {e && t ? (
        <UnsubscribeForm email={e} token={t} />
      ) : (
        <p className="mt-4 text-neutral-600">
          This unsubscribe link is incomplete. Email us at{" "}
          <a className="underline" href="mailto:contact@desertcandleworks.com">
            contact@desertcandleworks.com
          </a>{" "}
          and we&apos;ll take you off the list.
        </p>
      )}
    </section>
  );
}
