"use client";

import { Pencil, Check } from "lucide-react";
import { useJourneyAdmin } from "@/components/journey-admin-context";

/**
 * Obvious Edit/Done toggle for the Our Journey page. Flips the same
 * `isJourneyAdmin` state that the timeline uses to show its edit/delete
 * controls and the add (+) button.
 */
export default function JourneyEditToggle() {
  const { isJourneyAdmin, toggleJourneyAdmin, showToast } = useJourneyAdmin();

  return (
    <button
      type="button"
      onClick={() => {
        const willEnable = !isJourneyAdmin;
        toggleJourneyAdmin();
        showToast(
          willEnable ? "Editing on — add or change milestones" : "Editing off",
        );
      }}
      aria-pressed={isJourneyAdmin}
      className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium shadow-sm transition-colors ${
        isJourneyAdmin
          ? "bg-rose-500 text-white hover:bg-rose-600"
          : "border border-zinc-300 bg-white/90 text-zinc-700 backdrop-blur hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }`}
    >
      {isJourneyAdmin ? (
        <>
          <Check className="size-4" />
          Done
        </>
      ) : (
        <>
          <Pencil className="size-4" />
          Edit journey
        </>
      )}
    </button>
  );
}
