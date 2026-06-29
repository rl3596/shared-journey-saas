"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

/** App-wide toast host, themed to match the active light/dark theme. */
export default function AppToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-center"
      richColors
      closeButton
    />
  );
}
