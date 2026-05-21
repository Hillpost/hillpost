export function formatDateForInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function parseDateInputToTimestamp(dateInput: string): number {
  const [year, month, day] = dateInput.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}
