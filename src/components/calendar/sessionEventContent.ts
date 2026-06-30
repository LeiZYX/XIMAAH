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
  const detailFromProps = event.extendedProps.calendarDetailLabel;
  const detailLabel =
    typeof detailFromProps === "string" && detailFromProps
      ? detailFromProps
      : [levelAbbrev, subjectLabel, paperLabel].filter(Boolean).join(" ");
  const examBoardLabel = typeof boardLabel === "string" ? boardLabel : "";

  return { examBoardLabel, timeLabel, detailLabel };
}

function isListView(viewType: string) {
  return viewType === "listDay" || viewType === "listWeek" || viewType === "listMonth";
}

type FcSegHost = HTMLElement & {
  fcSeg?: {
    eventRange: {
      def: { publicId: string };
    };
  };
};

export function listRowFromMountEl(el: HTMLElement) {
  return el.classList.contains("fc-list-event")
    ? el
    : el.closest<HTMLElement>("tr.fc-list-event");
}

export function eventIdFromListRow(row: HTMLElement) {
  const segId = (row as FcSegHost).fcSeg?.eventRange?.def?.publicId;
  if (segId) return segId;
  return row.dataset.ximaEventId ?? null;
}

export function sessionEventContent(arg: EventContentArg) {
  const { event, view } = arg;
  if (event.extendedProps.entityType !== "session") {
    return true;
  }

  // List view needs FullCalendar's default <a> title link for reliable row clicks.
  if (isListView(view.type)) {
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
  const listRow = listRowFromMountEl(info.el);

  if (listRow) {
    listRow.style.cursor = "pointer";
    listRow.dataset.ximaEventId = info.event.id;
  }

  if (info.event.extendedProps.entityType !== "session") return;

  const mountEl = listRow ?? info.el;

  const boardAccent = info.event.extendedProps.boardAccent;
  if (typeof boardAccent === "string") {
    mountEl.style.borderColor = boardAccent;
  }

  const { examBoardLabel, timeLabel, detailLabel } = sessionLabels(info.event);
  mountEl.title = [examBoardLabel, timeLabel, detailLabel].filter(Boolean).join("\n");
}
