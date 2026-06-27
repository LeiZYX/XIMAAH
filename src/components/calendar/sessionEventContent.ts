import type { EventContentArg, EventMountArg } from "@fullcalendar/core";
import { levelCategoryAbbrev } from "@/lib/calendar-events";
import { isLevelCategory } from "@/lib/level-categories";

function sessionLabels(event: EventContentArg["event"]) {
  const levelCategory = event.extendedProps.levelCategory;
  const subject = event.extendedProps.subject;
  const paperCode = event.extendedProps.paperCode;
  const calendarTimeLabel = event.extendedProps.calendarTimeLabel;
  const boardLabel = event.extendedProps.boardLabel;

  const levelAbbrev = levelCategoryAbbrev(
    typeof levelCategory === "string" && isLevelCategory(levelCategory)
      ? levelCategory
      : null,
  );
  const subjectLabel = typeof subject === "string" ? subject : "";
  const paperLabel = typeof paperCode === "string" ? paperCode : "";
  const timeLabel = typeof calendarTimeLabel === "string" ? calendarTimeLabel : "";
  const detailLabel = [levelAbbrev, subjectLabel, paperLabel].filter(Boolean).join(" ");
  const examBoardLabel = typeof boardLabel === "string" ? boardLabel : "";

  return { examBoardLabel, timeLabel, detailLabel };
}

export function sessionEventContent(arg: EventContentArg) {
  const { event } = arg;
  if (event.extendedProps.entityType !== "session") {
    return true;
  }

  const boardAccent = event.extendedProps.boardAccent;
  const { examBoardLabel, timeLabel, detailLabel } = sessionLabels(event);

  const wrapper = document.createElement("div");
  wrapper.className = "fc-session-event";

  const boardRow = document.createElement("div");
  boardRow.className = "fc-board-row";

  const badge = document.createElement("span");
  badge.className = "fc-board-badge";
  badge.textContent = examBoardLabel || "?";
  if (typeof boardAccent === "string") {
    badge.style.backgroundColor = boardAccent;
  }

  boardRow.append(badge);

  const timeLine = document.createElement("div");
  timeLine.className = "fc-event-time-line";
  timeLine.textContent = timeLabel;

  const detailLine = document.createElement("div");
  detailLine.className = "fc-event-detail-line";
  detailLine.textContent = detailLabel;

  wrapper.append(boardRow, timeLine, detailLine);
  return { domNodes: [wrapper] };
}

export function sessionEventDidMount(info: EventMountArg) {
  if (info.event.extendedProps.entityType !== "session") return;

  const boardAccent = info.event.extendedProps.boardAccent;
  if (typeof boardAccent === "string") {
    info.el.style.borderColor = boardAccent;
  }

  const { examBoardLabel, timeLabel, detailLabel } = sessionLabels(info.event);
  info.el.title = [examBoardLabel, timeLabel, detailLabel].filter(Boolean).join("\n");
}
