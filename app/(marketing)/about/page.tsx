export default function About() {
  return (
    <div className="mx-auto max-w-xl py-20">
      <h1 className="text-3xl font-semibold tracking-tight">About OneLink</h1>
      <div className="mt-6 grid gap-4 leading-relaxed text-muted-foreground">
        <p>
          Every app lives in at least two stores, but a tweet, a poster, or a podcast
          description only has room for one link. OneLink turns that single URL into a smart,
          device-aware redirect: iPhones land in the App Store, Androids in Google Play, and
          everyone else on your website.
        </p>
        <p>
          Each link comes with a branded QR code and analytics, so you can put it anywhere —
          and know exactly where your installs come from.
        </p>
      </div>
    </div>
  );
}
