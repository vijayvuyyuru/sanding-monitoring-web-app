import * as VIAM from "@viamrobotics/sdk";
import { Step } from "../AppInterface";

export const createVideoStreamFromBase64 = (base64Data: Uint8Array): string | null => {
  try {
    console.log("Creating video stream from base64...");

    const blob = new Blob([new Uint8Array(base64Data)], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);

    console.log("Video stream URL created successfully");
    return url;
  } catch (error) {
    console.error("Error creating video stream:", error);
    return null;
  }
};

export const formatDuration = (durationMs?: number, start?: string, end?: string): string => {
  let ms = durationMs;

  if (!ms && start && end) {
    ms = new Date(end).getTime() - new Date(start).getTime();
  }

  if (!ms) return '0:00';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Formats the time difference between two timestamps into a short string (e.g., "30s", "5m").
 * @param time1 - The first time in milliseconds.
 * @param time2 - The second time in milliseconds.
 * @returns A string representing the time difference.
 */
export const formatTimeDifference = (time1: number, time2: number): string => {
  const minutes = Math.abs(time1 - time2) / 60000;
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}s`;
  }
  return `${Math.round(minutes)}m`;
};

export const formatDurationToMinutesSeconds = (start: Date, end: Date): string => {
  const ms = end.getTime() - start.getTime();
  if (isNaN(ms) || ms < 0) return '0m 0s';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
};

// export const formatTimestamp = (timestamp: string): string => {
//   return new Date(timestamp).toLocaleString();
// };

// export const formatShortTimestamp = (timestamp: string): string => {
//   return new Date(timestamp).toLocaleTimeString();
// };

export const extractCameraName = (filename: string): string => {
  const match = filename.match(/video_([^/]+)/);
  return match ? `${match[1]}` : 'Unknown Camera';
};

const formatDateToVideoStoreFormat = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
};

// 10 seconds in milliseconds
const VIDEO_LENGTH_BUFFER = 10000;

const getVideoTimeWithBuffer = (date: Date, isStart: boolean): Date => {
  const offset = isStart ? -VIDEO_LENGTH_BUFFER : VIDEO_LENGTH_BUFFER;
  const bufferedDate = new Date(date.getTime() + offset);

  // If adding buffer to end time would put us in the future, cap it at current time
  if (!isStart) {
    const now = new Date();
    if (bufferedDate > now) {
      return now;
    }
  }

  return bufferedDate;
};


export const generateVideo = async (
  videoStoreClient: VIAM.GenericComponentClient,
  step: Step) => {
  console.log("generateVideo called for step", step);

  const videoStart = getVideoTimeWithBuffer(step.start, true);
  const videoEnd = getVideoTimeWithBuffer(step.end, false);

  console.log("formatDateToVideoStoreFormat(step.end)",
    formatDateToVideoStoreFormat(videoEnd));
  console.log("formatDateToVideoStoreFormat(step.start)",
    formatDateToVideoStoreFormat(videoStart));
  const command = VIAM.Struct.fromJson({
    "command": "save",
    "to": formatDateToVideoStoreFormat(videoEnd),
    "from": formatDateToVideoStoreFormat(videoStart),
    "metadata": `${step.pass_id}${step.name}`,
  });

  return await videoStoreClient.doCommand(command);
};
