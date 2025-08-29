import * as VIAM from "@viamrobotics/sdk";
import { Step } from "../AppInterface";

export const createVideoStreamFromBase64 = (base64Data: Uint8Array): string | null => {
  try {
    console.log("Creating video stream from base64...");

    const blob = new Blob([base64Data], { type: 'video/mp4' });
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

export const formatDurationToMinutesSeconds = (start: Date, end: Date): string => {
  const ms = end.getTime() - start.getTime();
  if (isNaN(ms) || ms < 0) return '0m 0s';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
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
  // Z means UTC
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}Z`;
};

export const generateVideo = async (
  videoStoreClient: VIAM.GenericComponentClient, 
  step: Step) => {
    console.log("generateVideo called for step", step);
    console.log("formatDateToVideoStoreFormat(step.end)", formatDateToVideoStoreFormat(step.end));
    console.log("formatDateToVideoStoreFormat(step.start)", formatDateToVideoStoreFormat(step.start));
    const command = VIAM.Struct.fromJson({
      "command": "save",
      "to": formatDateToVideoStoreFormat(step.end),
      "from": formatDateToVideoStoreFormat(step.start),
      "metadata": `${step.pass_id}${step.name}`,
    });

    return await videoStoreClient.doCommand(command);
  };
