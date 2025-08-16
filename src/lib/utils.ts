import * as VIAM from "@viamrobotics/sdk";

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
) => {
  console.log("handleVideoStoreCommand called");

  if (!videoStoreClient) {
    console.log("No videoStoreClient available, returning early");
    return;
  }

  try {
    console.log("Creating storage state command...");
    // First get storage state
    const storageStateCommand = VIAM.Struct.fromJson({
      "command": "get-storage-state"
    });
    console.log("Storage state command created:", storageStateCommand);

    console.log("Executing storage state command...");
    const storageResponse = await videoStoreClient.doCommand(storageStateCommand);
    console.log("Storage state response:", storageResponse);

    // Helper function to convert custom time format to Date
    const parseCustomTimeFormat = (timeStr: string): Date => {
      // Convert "2025-08-15_11-31-26Z" to "2025-08-15T11:31:26Z"
      const isoString = timeStr.replace('_', 'T').replace(/-(\d{2})-(\d{2})Z$/, ':$1:$2Z');
      return new Date(isoString);
    };

    // Helper function to convert Date back to custom format
    const formatToCustomTime = (date: Date): string => {
      return date.toISOString().replace('T', '_').replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
    };

    // Extract available time ranges from storage response
    const storageData = storageResponse as any;
    let fromTime: string;
    let toTime: string;

    // Check if storage response has stored_video array with time ranges
    if (storageData && storageData.stored_video && storageData.stored_video.length > 0) {
      const firstVideo = storageData.stored_video[0];

      // Try different possible property names for time ranges
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

      // For testing, use a much smaller time range (just 5 minutes from the start)
      const startTime = parseCustomTimeFormat(fromTime);
      const endTime = new Date(startTime.getTime() + 5 * 60 * 1000); // Add 5 minutes

      // Ensure we don't go beyond the available range
      const maxEndTime = parseCustomTimeFormat(toTime);
      if (endTime > maxEndTime) {
        // Use original end time if 5 minutes exceeds available range
        toTime = toTime;
      } else {
        toTime = formatToCustomTime(endTime);
      }

      console.log("Using shortened time range for testing:", fromTime, "to", toTime);
    } else if (storageData && storageData.ranges && storageData.ranges.length > 0) {
      // Fallback to ranges array if available
      const firstRange = storageData.ranges[0];
      fromTime = firstRange.start || firstRange.from;
      toTime = firstRange.end || firstRange.to;
      console.log("Using time range from ranges:", fromTime, "to", toTime);
    } else {
      // If we have runData, try to use its time range
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

    // Add timeout to prevent hanging
    const fetchPromise = videoStoreClient.doCommand(fetchCommand);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Fetch command timed out after 30 seconds')), 30000);
    });

    const fetchResponse = await Promise.race([fetchPromise, timeoutPromise]);
    console.log("Fetch command response:", fetchResponse);

    // Convert base64 video data to downloadable MP4
    // Type cast the response to access the video property
    const responseObj = fetchResponse as { video?: string };
    if (responseObj && responseObj.video) {
      convertBase64ToMp4(responseObj.video, 'fetched_video.mp4');
    } else {
      console.log("No video data in response");
    }

    console.log("handleVideoStoreCommand completed successfully");
  } catch (error) {
    console.error("Error executing video store commands:", error);
    console.log("Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
};

export const convertBase64ToMp4 = (base64Data: string, filename: string) => {
  try {
    console.log("Converting base64 to MP4...");

    // Remove data URL prefix if present (e.g., "data:video/mp4;base64,")
    const base64String = base64Data.includes(',')
      ? base64Data.split(',')[1]
      : base64Data;

    // Convert base64 to binary
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create blob with MP4 MIME type
    const blob = new Blob([bytes], { type: 'video/mp4' });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log(`MP4 file "${filename}" downloaded successfully`);
  } catch (error) {
    console.error("Error converting base64 to MP4:", error);
  }
};

export const formatDuration = (durationMs?: number, start?: string, end?: string): string => {
  let ms = durationMs;

  // If no duration_ms provided, calculate from start/end times
  if (!ms && start && end) {
    ms = new Date(end).getTime() - new Date(start).getTime();
  }

  if (!ms) return '0:00';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString();
};

export const formatShortTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleTimeString();
};

export const extractCameraName = (filename: string): string => {
  const match = filename.match(/video_([^/]+)/);
  return match ? `${match[1]}` : 'Unknown Camera';
};
