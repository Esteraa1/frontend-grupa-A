export function getBookingTimes(duration) {
  const minutes = Number(duration);
  const opening = 9 * 60;
  const lastStart = 19 * 60 - minutes;
  if (!Number.isInteger(minutes) || minutes <= 0 || lastStart < opening) return [];

  const starts = [];
  for (let start = opening; start <= lastStart; start += minutes) starts.push(start);
  // Include the final appointment ending at closing time, even off the regular interval.
  if (starts.at(-1) !== lastStart) starts.push(lastStart);
  return starts.map(start => `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`);
}
