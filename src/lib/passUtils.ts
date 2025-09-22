import * as VIAM from "@viamrobotics/sdk";
import { Pass, Step } from "../AppInterface";

/**
 * Get before and after images for a given pass from a list of image files.
 * @param pass - The pass object.
 * @param imageFiles - A map of all available image files.
 * @param selectedCamera - The name of the camera to filter images by.
 * @returns An object containing the before and after image, or null.
 */
export const getBeforeAfterImages = (
  pass: Pass,
  imageFiles: Map<string, VIAM.dataApi.BinaryData>,
  selectedCamera: string
): { beforeImage: VIAM.dataApi.BinaryData | null; afterImage: VIAM.dataApi.BinaryData | null } => {
  const passStart = new Date(pass.start);
  const passEnd = new Date(pass.end);

  const allCameraImages = Array.from(imageFiles.values()).filter(file => {
    if (file.metadata?.captureMetadata?.componentName !== selectedCamera || !file.metadata?.timeRequested) {
      return false;
    }

    const imgTime = file.metadata.timeRequested.toDate();
    // Only consider images within the pass time range
    return imgTime >= passStart && imgTime <= passEnd;
  }).sort((a, b) => a.metadata!.timeRequested!.toDate().getTime() - b.metadata!.timeRequested!.toDate().getTime());

  // Get the first image in the pass (closest to start)
  const beforeImage = allCameraImages[0];

  // Get the last image in the pass (closest to end)
  const afterImage = allCameraImages[allCameraImages.length - 1];

  return {
    beforeImage: beforeImage || null,
    afterImage: afterImage || null
  };
};

/**
 * Get all videos associated with a specific step.
 * @param step - The step object.
 * @param videoFiles - A map of all available video files.
 * @returns An array of binary data for the step's videos.
 */
export const getStepVideos = (step: Step, videoFiles: Map<string, VIAM.dataApi.BinaryData>): VIAM.dataApi.BinaryData[] => {
  if (!videoFiles || videoFiles.size === 0) return [];

  let stepVideos: VIAM.dataApi.BinaryData[] = [];

  videoFiles.forEach((file) => {
    if (!file.metadata || !file.metadata.fileName) return;

    const isMatchingStep = file.metadata.fileName.includes(step.pass_id) &&
      file.metadata.fileName.includes(step.name);

    if (isMatchingStep) {
      stepVideos.push(file);
    }
  });

  return stepVideos;
};