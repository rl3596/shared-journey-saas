export type EventOwner = "Rui" | "Wanyun" | "Joint";

export type ScheduleEvent = {
  id: string;
  owner: EventOwner;
  title: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM" (24-hour)
  notes: string;
};

// Mock events used as a fallback when Supabase isn't configured.
export const scheduleEvents: ScheduleEvent[] = [
  {
    id: "ev-movie",
    owner: "Joint",
    title: "Movie night at home",
    date: "2026-05-28",
    time: "21:00",
    notes: "Wanyun's pick this time — popcorn ready.",
  },
  {
    id: "ev-sushi",
    owner: "Joint",
    title: "Date night — sushi",
    date: "2026-05-29",
    time: "19:30",
    notes: "Reservation at Sushi Saito. Dress up a little.",
  },
  {
    id: "ev-dentist",
    owner: "Rui",
    title: "Dentist appointment",
    date: "2026-05-30",
    time: "09:00",
    notes: "Cleaning and checkup.",
  },
  {
    id: "ev-yoga",
    owner: "Wanyun",
    title: "Morning yoga class",
    date: "2026-05-31",
    time: "08:00",
    notes: "Trying the new studio downtown.",
  },
  {
    id: "ev-gym",
    owner: "Rui",
    title: "Gym — leg day",
    date: "2026-06-01",
    time: "07:00",
    notes: "Don't skip stretching.",
  },
  {
    id: "ev-mom",
    owner: "Wanyun",
    title: "Call Mom for her birthday",
    date: "2026-06-02",
    time: "18:00",
    notes: "Send the gift card beforehand.",
  },
  {
    id: "ev-napa",
    owner: "Joint",
    title: "Weekend trip to Napa",
    date: "2026-06-06",
    time: "10:00",
    notes: "Pack an overnight bag; wine tasting booked at 2pm.",
  },
  {
    id: "ev-anniv",
    owner: "Joint",
    title: "Plan anniversary dinner",
    date: "2026-06-10",
    time: "20:00",
    notes: "Pick a restaurant for August.",
  },
];
