"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

const POSTER_URL =
  "https://yyxfjcgqhttcjkfzwbvm.supabase.co/storage/v1/object/public/gallery/special%20dates/IMG_4344.jpeg";

export default function SpecialDesign() {
  const [isOpen, setIsOpen] = useState(false);

  // Lock background scroll + bind Escape while the modal is open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-1 inline-flex items-center gap-1 font-serif text-sm italic text-rose-500 transition-colors hover:text-rose-600 sm:text-base dark:text-rose-400 dark:hover:text-rose-300"
      >
        ✨ First month special design
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="First-month anniversary poster"
          className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center p-4"
        >
          {/* Backdrop: semi-transparent black with a soft blur. Click anywhere
              that isn't the poster to close. */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />

          {/* 9:16 poster container. The `height` resolves to the smaller of
              90 % of the viewport height and the height the 9:16 ratio
              demands when width is capped at 90 % of the viewport — so the
              poster grows as large as it can on phones and stays sized on
              desktop without overflowing. */}
          <div
            className="relative overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10"
            style={{
              aspectRatio: "9 / 16",
              height: "min(90vh, calc(90vw * 16 / 9))",
            }}
          >
            <Image
              src={POSTER_URL}
              alt="First-month anniversary poster"
              fill
              priority
              sizes="(max-width: 768px) 90vw, 50vh"
              className="object-cover"
            />

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close poster"
              className="absolute right-3 top-3 inline-flex items-center justify-center rounded-full bg-black/55 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
