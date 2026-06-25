export type TimelineComment = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
};

export type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  location: string;
  image?: string;
  /** Per-member comments on this milestone (one per person). */
  comments: TimelineComment[];
};
