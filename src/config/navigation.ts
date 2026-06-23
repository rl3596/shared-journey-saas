import { Home, Heart, Images, Calendar, type LucideIcon } from "lucide-react";

export type NavRoute = {
  path: string;
  label: string;
  icon: LucideIcon;
};

// Add a new tab by appending a route object here — the navigation renders from this array.
export const navRoutes: NavRoute[] = [
  { path: "/", label: "Home", icon: Home },
  { path: "/love-journey", label: "Journey", icon: Heart },
  { path: "/gallery", label: "Gallery", icon: Images },
  { path: "/schedule", label: "Schedule", icon: Calendar },
];
