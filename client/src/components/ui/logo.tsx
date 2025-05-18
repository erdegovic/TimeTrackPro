import { Clock } from "lucide-react";
import { Link } from "wouter";

export function Logo() {
  return (
    <Link href="/">
      <a className="flex items-center">
        <div className="bg-primary rounded-md p-1.5 mr-2">
          <Clock className="h-4 w-4 text-white" />
        </div>
        <span className="text-xl font-semibold text-gray-900">TimeTrack<span className="text-primary">Pro</span></span>
      </a>
    </Link>
  );
}
