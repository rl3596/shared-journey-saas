export type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  contentRui: string;
  contentWanyun: string;
  location: string;
  image?: string;
};

// Mock relationship milestones — replace these with your real moments and photos.
// Each milestone now holds two perspectives: one from Rui and one from Wanyun.
// Leaving a perspective empty triggers a gentle placeholder in the UI.
export const timelineEvents: TimelineEvent[] = [
  {
    id: "met",
    date: "March 14, 2021",
    title: "The Day We Met",
    contentRui:
      "A chance introduction through mutual friends that neither of us saw coming. We talked until the café closed, and it still felt too soon to leave.",
    contentWanyun:
      "I almost didn't go that afternoon. One coffee turned into three and I forgot to check my phone for hours — that hasn't happened before or since.",
    location: "Blue Bottle Coffee, San Francisco",
    image: "https://picsum.photos/seed/met/800/450",
  },
  {
    id: "first-date",
    date: "March 28, 2021",
    title: "Our First Date",
    contentRui:
      "Dinner that turned into a long walk across the city. The conversation never ran out, and we both quietly knew this was the start of something.",
    contentWanyun: "",
    location: "The Ferry Building, San Francisco",
    image: "https://picsum.photos/seed/firstdate/800/450",
  },
  {
    id: "first-trip",
    date: "July 9, 2021",
    title: "First Trip Together",
    contentRui:
      "A spontaneous weekend down the coast — foggy mornings, winding cliffs, and a playlist we still come back to.",
    contentWanyun:
      "The fog rolled in and we just drove into it. I remember thinking: this person is calm in a way I want to learn.",
    location: "Big Sur, California",
    image: "https://picsum.photos/seed/bigsur/800/450",
  },
  {
    id: "moved-in",
    date: "June 1, 2022",
    title: "Moving In Together",
    contentRui:
      "We traded two apartments for one home. Boxes everywhere, a single chair for a week, and the happiest kind of chaos.",
    contentWanyun: "",
    location: "Our first apartment, Oakland",
  },
  {
    id: "mochi",
    date: "October 22, 2022",
    title: "We Adopted Mochi",
    contentRui:
      "One look at those ears and the decision made itself. Our little family grew by four paws.",
    contentWanyun: "",
    location: "SF SPCA",
    image: "https://picsum.photos/seed/mochi/800/450",
  },
  {
    id: "proposal",
    date: "December 23, 2023",
    title: "The Proposal",
    contentRui:
      "Under a sky full of stars, one question and one very easy answer. The beginning of forever.",
    contentWanyun: "",
    location: "Lake Tahoe, California",
    image: "https://picsum.photos/seed/tahoe/800/450",
  },
];
