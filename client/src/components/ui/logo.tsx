import { Link } from "wouter";
import tickdLogo from "@/assets/tickd-logo.png";

export function Logo() {
  return (
    <Link href="/">
      <a className="flex items-center group">
        <img 
          src={tickdLogo} 
          alt="Tickd Logo" 
          className="h-8 w-8 mr-3 transition-transform group-hover:scale-105" 
        />
        <span className="text-xl font-bold tickd-primary">
          Tickd
        </span>
      </a>
    </Link>
  );
}
