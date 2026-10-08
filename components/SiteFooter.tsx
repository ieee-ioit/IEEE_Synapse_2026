import Link from "next/link";
import { event } from "@/lib/event";

export default function SiteFooter({ dates }: { dates?: string }) {
  return (
    <footer className="site-foot">
      <span>
        {event.name}
        {dates ? ` · ${dates}` : ""} · {event.venue}
      </span>
      <nav aria-label="Footer">
        <Link href="/team/login">Team Login</Link>
        <a href={event.whatsappUrl} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      </nav>
    </footer>
  );
}
