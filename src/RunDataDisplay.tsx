import React, { useState } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import './App.css';
interface RunStep {
  name: string;
  start: string;
  end: string;
  duration_ms: number;
}

interface RunData {
  success: boolean;
  err_string?: string;
  start: string;
  end: string;
  duration_ms: number;
  runs: RunStep[][];
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
      
      console.log("Creating fetch command...");
      // Then fetch videos for a specific time range
      const fetchCommand = VIAM.Struct.fromJson({
        "command": "fetch",
        "from": "2025-08-14_20-50-26Z",
        "to": "2025-08-14_20-50-56Z"
      });
      console.log("Fetch command created:", fetchCommand);
      
      console.log("Executing fetch command...");
      const fetchResponse = await videoStoreClient.doCommand(fetchCommand);
      console.log("Fetch command response:", fetchResponse);
      
      // Convert base64 video data to downloadable MP4
      // Type cast the response to access the video property
      const responseObj = fetchResponse as { video?: string };
      if (responseObj && responseObj.video) {
        convertBase64ToMp4(responseObj.video, 'fetched_video.mp4');
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

  const formatDuration = (durationMs: number): string => {
    const seconds = Math.floor(durationMs / 1000);
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
    }).sort((a, b) => {
      // Sort by timestamp, newest first
      const aTime = a.metadata?.timeRequested?.toDate().getTime() || 0;
      const bTime = b.metadata?.timeRequested?.toDate().getTime() || 0;
      return bTime - aTime;
    });
  };

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
            <span>Start: {formatTimestamp(runData.start)}</span>
            <div className="video-placeholder">
              📹 Video
            </div>
          </div>
          <div className="time-column">
            <span>End: {formatTimestamp(runData.end)}</span>
            <div className="video-placeholder">
              📹 Video
            </div>
          </div>
          <div className="duration-center">
            Duration: {formatDuration(runData.duration_ms)}
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
      <div className="run-steps-container">
        {runData.runs[0]?.map((step, index) => {
          const stepVideos = getStepVideos(step);
          const isExpanded = expandedSteps.has(index);

          return (
            <div key={index} className="run-step-card">
              <div className="step-header" onClick={() => toggleStep(index)}>
                <div className="step-info">
                  <div className="step-name">{step.name}</div>
                  <div className="step-timing">
                    {formatTimestamp(step.start)} → {formatTimestamp(step.end)}
                  </div>
                  <div className="step-duration">{formatDuration(step.duration_ms)}</div>
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