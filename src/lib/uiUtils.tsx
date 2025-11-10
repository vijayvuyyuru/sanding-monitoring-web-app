/**
 * Formats a duration from milliseconds to a string like "Xh Ym" or "Ym".
 * Includes a tooltip showing the duration in minutes.
 * @param ms - The duration in milliseconds.
 * @returns A JSX element with the formatted duration.
 */
export const formatDurationMs = (ms: number): JSX.Element => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  let displayText: string;
  if (hours > 0) {
    displayText = `${hours}h ${minutes}m`;
  } else {
    displayText = `${minutes}m`;
  }

  return (
    <span title={`${Math.floor(ms / 60000)} minutes`}>
      {displayText}
    </span>
  );
};