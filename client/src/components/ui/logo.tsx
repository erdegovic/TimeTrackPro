import { Link } from "wouter";
import tickdLogoFull from "@/assets/tickd-logo-full.svg";

export function Logo() {
  return (
    <Link href="/" className="flex items-center group">
      <img
        src={tickdLogoFull}
        alt="Tickd"
        className="h-9 w-auto max-w-[150px] transition-transform group-hover:scale-105"
      />
    </Link>
  );
}
