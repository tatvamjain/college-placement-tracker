import type { DriveStatus, RoundStatus } from "@/lib/api";
import { DRIVE_BOARD_STATUS, ROUND_BOARD_STATUS } from "@/lib/format";

const DRIVE_TONE: Record<DriveStatus, string> = {
  announced: "tag-scheduled",
  ongoing: "tag-boarding",
  completed: "tag-departed",
  cancelled: "tag-cancelled",
};

const ROUND_TONE: Record<RoundStatus, string> = {
  scheduled: "tag-scheduled",
  ongoing: "tag-boarding",
  completed: "tag-departed",
};

export function DriveStatusTag({ status }: { status: DriveStatus }) {
  const { label, hint } = DRIVE_BOARD_STATUS[status];
  return (
    <span className={`tag ${DRIVE_TONE[status]}`} title={hint}>
      {label}
    </span>
  );
}

export function RoundStatusTag({ status }: { status: RoundStatus }) {
  return <span className={`tag ${ROUND_TONE[status]}`}>{ROUND_BOARD_STATUS[status]}</span>;
}
