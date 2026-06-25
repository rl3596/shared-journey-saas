import {
  Home,
  Heart,
  Images,
  Calendar,
  Users,
  type LucideIcon,
} from "lucide-react";

// Routes are grouped into sections; the sidebar draws a thin divider between
// sections. "social" intentionally has room beside Friends for a future
// "Chats" entry (Friend Direct Messaging) — just add it to this array.
export type NavSection = "main" | "social";

export type NavRoute = {
  path: string;
  label: string;
  icon: LucideIcon;
  section: NavSection;
};

// Add a new tab by appending a route object here — the navigation renders from
// this array and groups by `section`.
export const navRoutes: NavRoute[] = [
  { path: "/", label: "Home", icon: Home, section: "main" },
  { path: "/love-journey", label: "Journey", icon: Heart, section: "main" },
  { path: "/gallery", label: "Gallery", icon: Images, section: "main" },
  { path: "/schedule", label: "Schedule", icon: Calendar, section: "main" },
  { path: "/friends", label: "Friends", icon: Users, section: "social" },
  // Future: { path: "/chats", label: "Chats", icon: MessageCircle, section: "social" },
];
