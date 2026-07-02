export function formatEventDate(isoDateString) {
  if (!isoDateString) return "-";
  const date = new Date(isoDateString);
  if (Number.isNaN(date.getTime())) return isoDateString;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
