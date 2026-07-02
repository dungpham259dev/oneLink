import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="grid gap-6 py-12 text-center">
      <h1 className="text-4xl font-bold">One link to your app on every store</h1>
      <p className="text-muted-foreground">
        Detect the visitor&rsquo;s device and send them to the right app store — with a branded QR code.
      </p>
      <div>
        <Button asChild>
          <Link href="/app/links">Create your OneLink</Link>
        </Button>
      </div>
    </div>
  );
}
