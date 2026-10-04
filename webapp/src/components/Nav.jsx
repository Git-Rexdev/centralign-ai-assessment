"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Nav.module.css";

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/app/invoices", label: "Invoice Inbox" },
  { href: "/app/entry", label: "Data Entry" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav>
      <div className="container nav-inner">
        <span className="nav-logo">AI Task Worker</span>
        <div className="nav-links">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link${pathname === l.href ? " active" : ""}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
