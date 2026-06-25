export type ScheduleEvent = {
  id: string;
  creatorId: string;
  creatorName: string;
  /** Other members included (a joint event when non-empty). */
  participantIds: string[];
  participantNames: string[];
  isJoint: boolean;
  title: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM" (24-hour)
  notes: string;
};
