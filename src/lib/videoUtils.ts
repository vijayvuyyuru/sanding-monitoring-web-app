import * as VIAM from "@viamrobotics/sdk";
import { Step } from "../AppInterface";

interface RunData {
  success: boolean;
  err_string?: string;
  start: string;
  end: string;
  duration_ms: number;
  runs: any[][];
  readings?: any;
}

export const handleVideoStoreCommand = async (
  videoStoreClient: VIAM.GenericComponentClient,
  runData?: RunData | null
): Promise<{ videoUrl?: string; error?: string }> => {
  console.log("handleVideoStoreCommand called");

  if (!videoStoreClient) {
    console.log("No videoStoreClient available, returning early");
    return { error: "No video store client available" };
  }

  try {
    console.log("Creating storage state command...");
    const storageStateCommand = VIAM.Struct.fromJson({
      "command": "get-storage-state"
    });
    console.log("Storage state command created:", storageStateCommand);

    console.log("Executing storage state command...");
    const storageResponse = await videoStoreClient.doCommand(storageStateCommand);
    console.log("Storage state response:", storageResponse);

    const parseCustomTimeFormat = (timeStr: string): Date => {
      const isoString = timeStr.replace('_', 'T').replace(/-(\d{2})-(\d{2})Z$/, ':$1:$2Z');
      return new Date(isoString);
    };

    const formatToCustomTime = (date: Date): string => {
      return date.toISOString().replace('T', '_').replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
    };

    const storageData = storageResponse as any;
    let fromTime: string;
    let toTime: string;

    if (storageData && storageData.stored_video && storageData.stored_video.length > 0) {
      const firstVideo = storageData.stored_video[0];

      if (firstVideo.start && firstVideo.end) {
        fromTime = firstVideo.start;
        toTime = firstVideo.end;
      } else if (firstVideo.from && firstVideo.to) {
        fromTime = firstVideo.from;
        toTime = firstVideo.to;
      } else if (firstVideo.time_range) {
        fromTime = firstVideo.time_range.start || firstVideo.time_range.from;
        toTime = firstVideo.time_range.end || firstVideo.time_range.to;
      } else {
        throw new Error("No valid time range found in stored_video");
      }

      console.log("Full time range from stored_video:", fromTime, "to", toTime);

      const startTime = parseCustomTimeFormat(fromTime);
      const endTime = new Date(startTime.getTime() + 5 * 60 * 1000);

      const maxEndTime = parseCustomTimeFormat(toTime);
      if (endTime > maxEndTime) {
        toTime = formatToCustomTime(maxEndTime);
      } else {
        toTime = formatToCustomTime(endTime);
      }

      console.log("Using shortened time range for testing:", fromTime, "to", toTime);
    } else if (storageData && storageData.ranges && storageData.ranges.length > 0) {
      const firstRange = storageData.ranges[0];
      fromTime = firstRange.start || firstRange.from;
      toTime = firstRange.end || firstRange.to;
      console.log("Using time range from ranges:", fromTime, "to", toTime);
    } else {
      if (runData && runData.start && runData.end) {
        fromTime = runData.start;
        toTime = runData.end;
        console.log("Using time range from runData:", fromTime, "to", toTime);
      } else {
        throw new Error("No valid time ranges found in storage response and no runData available");
      }
    }

    console.log("Creating fetch command...");
    const fetchCommand = VIAM.Struct.fromJson({
      "command": "fetch",
      "from": fromTime,
      "to": toTime
    });
    console.log("Fetch command created:", fetchCommand);

    console.log("Executing fetch command with 30 second timeout...");

    const fetchPromise = videoStoreClient.doCommand(fetchCommand);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Fetch command timed out after 30 seconds')), 30000);
    });

    const fetchResponse = await Promise.race([fetchPromise, timeoutPromise]);
    console.log("Fetch command response:", fetchResponse);

    const responseObj = fetchResponse as { video?: string };
    if (responseObj && responseObj.video) {
      // Create video stream URL for playback
      // const videoUrl = createVideoStreamFromBase64(responseObj.video);
      const videoUrl = ""

      if (videoUrl) {
        return { videoUrl };
      } else {
        return { error: "Failed to create video stream" };
      }
    } else {
      console.log("No video data in response");
      return { error: "No video data in response" };
    }
  } catch (error) {
    console.error("Error executing video store commands:", error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

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
      "async": true
    });

    return await videoStoreClient.doCommand(command);
  };