import React, { useState } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import './App.css';
import { 
  handleVideoStoreCommand, 
  formatDuration, 
  formatTimestamp, 
  formatShortTimestamp, 
  extractCameraName 
} from './lib/videoUtils';

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

  const handleVideoStoreCommandWrapper = async () => {
    if (!videoStoreClient) return;
    await handleVideoStoreCommand(videoStoreClient, runData);
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
              onClick={handleVideoStoreCommandWrapper}
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