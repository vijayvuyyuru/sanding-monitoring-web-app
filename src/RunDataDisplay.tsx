import React, { useState } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import './App.css';
interface RunStep {
  name: string;
  start: string;
  end: string;
  duration_ms?: number; // Make optional since new structure doesn't have this
}

interface Readings {
  start: string;
  end: string;
  steps: RunStep[];
  success: boolean;
  pass_id: string;
  err_string?: string | null;
}

interface RunData {
  success: boolean;
  err_string?: string;
  start: string;
  end: string;
  duration_ms: number;
  runs: RunStep[][];
  readings?: Readings; // Add support for old structure
}

interface RunDataDisplayProps {
  runData: RunData | null;
  videoFiles?: VIAM.dataApi.BinaryData[];
  videoStoreClient?: VIAM.GenericComponentClient | null;
  sanderClient?: VIAM.GenericComponentClient | null;
}

const RunDataDisplay: React.FC<RunDataDisplayProps> = ({ runData, videoFiles, sanderClient, videoStoreClient }) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [activeView, setActiveView] = useState<'summary' | 'files'>('summary');

  const handleVideoStoreCommand = async () => {
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

  const convertBase64ToMp4 = (base64Data: string, filename: string) => {
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

  const formatDuration = (durationMs?: number, start?: string, end?: string): string => {
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

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatShortTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const extractCameraName = (filename: string): string => {
    const match = filename.match(/video_([^/]+)/);
    return match ? `${match[1]}` : 'Unknown Camera';
  };

  const toggleStep = (stepIndex: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepIndex)) {
      newExpanded.delete(stepIndex);
    } else {
      newExpanded.add(stepIndex);
    }
    setExpandedSteps(newExpanded);
  };

  // Find video files that match a step's timeframe
  const getStepVideos = (step: RunStep) => {
    if (!videoFiles) return [];

    const stepStart = new Date(step.start);
    const stepEnd = new Date(step.end);

    return videoFiles.filter(file => {
      if (!file.metadata?.timeRequested || !file.metadata?.fileName?.endsWith('.mp4')) return false;
      const fileTime = file.metadata.timeRequested.toDate();
      return fileTime >= stepStart && fileTime <= stepEnd;
    });
  };

  // Handle both old and new data structures
  const getRunSteps = () => {
    if (!runData) return [];
    
    // New structure: runData.runs[0]
    if (runData.runs && runData.runs[0]) {
      return runData.runs[0];
    }
    
    // Old structure: runData.readings.steps
    if (runData.readings && runData.readings.steps) {
      return runData.readings.steps;
    }
    
    return [];
  };

  const runSteps = getRunSteps();

  if (!runData) return null;

  const renderSummaryView = () => (
    <>
      <div className="run-summary">
        <div className={`status ${runData.success ? 'success' : 'error'}`}>
          Status: {runData.success ? 'Success' : 'Failed'}
        </div>
        {runData.err_string && (
          <div className="error-message">Error: {runData.err_string}</div>
        )}
        <div className="run-times">
          <div className="time-column">
            <span>Duration: {formatDuration(runData.duration_ms)}</span>
          </div>
          <div className="time-column">
            <span>Start: {formatTimestamp(runData.start)}</span>
            <div className="video-placeholder">📹 Video</div>
          </div>
          <div className="time-column">
            <span>End: {formatTimestamp(runData.end)}</span>
            <div className="video-placeholder">📹 Video</div>
          </div>
          <div className="time-column">
            {/* Reserved for future content */}
          </div>
        </div>
        
        {/* Add test button for video store commands */}
        {videoStoreClient && (
          <div className="test-controls">
            <button
              onClick={handleVideoStoreCommand}
              className="test-video-store-btn"
            >
              Test Video Store Commands
            </button>
          </div>
        )}
      </div>

      <h3>Run Steps</h3>
      <div className="run-steps">
        {runSteps.map((step, index) => {
          const stepVideos = getStepVideos(step);
          const isExpanded = expandedSteps.has(index);

          return (
            <div key={index} className="run-step-card">
              <div className="step-header" onClick={() => toggleStep(index)}>
                <div className="step-info">
                  <div className="step-name">{step.name}</div>
                  <div className="step-timeline">
                    <div className="step-time">
                      <span className="time-label">Start</span>
                      <span className="time-value">{formatShortTimestamp(step.start)}</span>
                    </div>
                    <div className="timeline-arrow">→</div>
                    <div className="step-time">
                      <span className="time-label">End</span>
                      <span className="time-value">{formatShortTimestamp(step.end)}</span>
                    </div>
                  </div>
                  <div className="step-duration">{formatDuration(step.duration_ms, step.start, step.end)}</div>
                </div>
                <div className="step-videos-summary">
                  <span className="video-count">{stepVideos.length} videos</span>
                  <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
                </div>
              </div>

              {isExpanded && stepVideos.length > 0 && (
                <div className="step-videos-expanded">
                  <div className="videos-grid">
                    {stepVideos.map((video, videoIndex) => (
                      <div key={videoIndex} className="video-card">
                        <div className="video-info">
                          <div className="camera-name">📹 {extractCameraName(video.metadata?.fileName || '')}</div>
                          <div className="video-time">
                            {video.metadata?.timeRequested ?
                              formatShortTimestamp(video.metadata.timeRequested.toDate().toISOString()) :
                              'Unknown time'
                            }
                          </div>
                        </div>
                        <div className="video-actions">
                          <a
                            href={video.metadata?.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="video-link-btn"
                          >
                            View
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isExpanded && stepVideos.length === 0 && (
                <div className="no-videos-message">
                  No videos found for this step
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  const renderFilesView = () => (
    <div className="files-view">
      {sanderClient && (
        <div className="sander-controls">
          <button
            onClick={() => {
              console.log("sanding");
              // sanderClient.doCommand(command)
            }}
            className="start-sanding-btn"
          >
            Start Sanding
          </button>
        </div>
      )}
      <div className="files-grid">
        {videoFiles?.map((item: VIAM.dataApi.BinaryData, index: number) => (
          <div key={index} className="file-item">
            <div className="file-info">
              <div className="file-name">{item.metadata?.fileName || 'Unknown file'}</div>
              <div className="file-timestamp">
                {item.metadata?.timeRequested ?
                  formatTimestamp(item.metadata.timeRequested.toDate().toISOString()) :
                  'Unknown time'
                }
              </div>
            </div>
            <div className="file-actions">
              {item.metadata?.uri && (
                <a
                  href={item.metadata.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="file-link-btn"
                >
                  View
                </a>
              )}
            </div>
          </div>
        )) || <div className="no-files">No files available</div>}
      </div>
    </div>
  );

  return (
    <div className="run-data-section">
      <div className="section-nav">
        <button
          className={`section-nav-item ${activeView === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveView('summary')}
        >
          Latest Run Summary
        </button>
        <button
          className={`section-nav-item ${activeView === 'files' ? 'active' : ''}`}
          onClick={() => setActiveView('files')}
        >
          Robot operator
        </button>
      </div>

      <div className="section-content">
        {activeView === 'summary' && renderSummaryView()}
        {activeView === 'files' && renderFilesView()}
      </div>
    </div>
  );
};

export default RunDataDisplay;