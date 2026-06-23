"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";

type Suggestion = {
  displayName: string;
  lat: number;
  lon: number;
};

type Value = {
  location: string;
  latitude?: number;
  longitude?: number;
};

type Props = {
  value: string;
  onChange: (next: Value) => void;
  placeholder?: string;
};

const INPUT_CLASS =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-rose-500 dark:focus:ring-rose-900/50";

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSearched, setLastSearched] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  // Remember the display name the user just picked so typing into the field
  // that exactly matches it doesn't immediately re-fetch and re-open.
  const [lastPick, setLastPick] = useState("");
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced Nominatim fetch. All setState happens inside the timeout's async
  // callback, so we never set state synchronously inside the effect body.
  useEffect(() => {
    const q = value.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (q.length < 2 || q === lastPick) return;
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data: Array<{ display_name: string; lat: string; lon: string }> =
          await res.json();
        setSuggestions(
          data
            .map((d) => ({
              displayName: d.display_name,
              lat: parseFloat(d.lat),
              lon: parseFloat(d.lon),
            }))
            .filter((s) => !Number.isNaN(s.lat) && !Number.isNaN(s.lon)),
        );
        setLastSearched(q);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setSuggestions([]);
          setLastSearched(q);
        }
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [value, lastPick]);

  // Close the dropdown on a click outside.
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDocMouseDown);
    return () => window.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const select = (s: Suggestion) => {
    setLastPick(s.displayName);
    onChange({ location: s.displayName, latitude: s.lat, longitude: s.lon });
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      select(suggestions[activeIndex]);
    }
  };

  const trimmed = value.trim();
  const isReadyToSearch = trimmed.length >= 2 && trimmed !== lastPick;
  const showDropdown = open && isReadyToSearch;
  // While the latest fetch for the current input hasn't completed yet.
  const searchingNow = isReadyToSearch && lastSearched !== trimmed;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange({
            location: e.target.value,
            latitude: undefined,
            longitude: undefined,
          });
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder={placeholder ?? "e.g. Eiffel Tower, Paris"}
        autoComplete="off"
        className={INPUT_CLASS}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
      />
      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        >
          {searchingNow ? (
            <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
              Searching…
            </li>
          ) : suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
              No matches — try adding the city or country.
            </li>
          ) : (
            suggestions.map((s, i) => (
              <li key={`${s.lat},${s.lon},${i}`}>
                <button
                  type="button"
                  onClick={() => select(s)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    i === activeIndex
                      ? "bg-rose-50 text-zinc-900 dark:bg-rose-950/40 dark:text-zinc-50"
                      : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-700/50"
                  }`}
                >
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-rose-400" />
                  <span className="line-clamp-2">{s.displayName}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
