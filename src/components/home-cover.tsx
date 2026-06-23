"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

const COVER_IMAGE =
  "https://yyxfjcgqhttcjkfzwbvm.supabase.co/storage/v1/object/public/gallery/backgrounds/Gemini_Generated_Image_x66p89x66p89x66p.png";

// Cinematic intro: pure black → image fades in → overlay dims it slightly →
// title reveals → subtitle reveals → bottom hint slides up. Each phase is
// expressed as an `animation` shorthand with a delay so the whole sequence
// is data-only and stays in sync regardless of CPU load.
const ANIM_IMAGE =
  "cover-image-reveal 1400ms cubic-bezier(0.16, 1, 0.3, 1) both";
const ANIM_OVERLAY =
  "cover-overlay-reveal 700ms ease-out 1400ms both";
const ANIM_TITLE =
  "cover-title-reveal 1100ms cubic-bezier(0.16, 1, 0.3, 1) 2100ms both";
const ANIM_HINT =
  "cover-hint-reveal 800ms ease-out 3200ms both";

export default function HomeCover() {
  const [isCoverVisible, setIsCoverVisible] = useState(true);
  // Stays mounted (with `pointer-events-none`) during the slide-up; once the
  // transform transition ends we fully remove it so nothing can ever intercept
  // clicks on the dashboard below.
  const [mounted, setMounted] = useState(true);

  // Lock body scroll while the cover is over the dashboard.
  useEffect(() => {
    if (!isCoverVisible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isCoverVisible]);

  // Keyboard accessibility: Enter or Space also dismisses the cover.
  useEffect(() => {
    if (!isCoverVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsCoverVisible(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCoverVisible]);

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (
      e.target === e.currentTarget &&
      e.propertyName === "transform" &&
      !isCoverVisible
    ) {
      setMounted(false);
    }
  };

  if (!mounted) return null;

  return (
    <div
      onClick={() => setIsCoverVisible(false)}
      onTransitionEnd={handleTransitionEnd}
      aria-hidden={!isCoverVisible}
      className={`fixed inset-0 z-50 cursor-pointer overflow-hidden bg-black transition-transform duration-700 ease-in-out ${
        isCoverVisible
          ? "translate-y-0"
          : "pointer-events-none -translate-y-full"
      }`}
    >
      {/* Background image — fades up from full black with a slight Ken-Burns
          scale-down for a cinematic open. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- cover image hosted on Supabase Storage */}
      <img
        src={COVER_IMAGE}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
        style={{ animation: ANIM_IMAGE }}
      />

      {/* Subtle dark overlay — fades in after the image is fully visible so
          the photo gets to breathe first, then dims just enough to make the
          serif title legible without burying the picture. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-black/55"
        style={{ animation: ANIM_OVERLAY }}
      />

      {/* Center — single Playfair title that resolves into place. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <h1
          className="font-serif text-4xl font-medium leading-[1.1] text-amber-50 drop-shadow-[0_2px_18px_rgba(0,0,0,0.65)] sm:text-6xl lg:text-7xl"
          style={{ animation: ANIM_TITLE }}
        >
          Welcome to our Secret House
        </h1>
      </div>

      {/* Bottom hint — outer wrapper does the slide-up reveal; inner div
          keeps the existing bounce so the chevron beckons after it lands. */}
      <div
        className="absolute inset-x-0 bottom-10"
        style={{ animation: ANIM_HINT }}
      >
        <div className="flex animate-bounce flex-col items-center gap-1.5 text-white drop-shadow">
          <ChevronUp className="size-6" />
          <span className="text-sm font-medium tracking-wider">
            tap/click to open your gift
          </span>
        </div>
      </div>
    </div>
  );
}
