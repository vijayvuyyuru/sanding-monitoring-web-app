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
  sanderClient?: VIAM.GenericComponentClient | null;
}

const RunDataDisplay: React.FC<RunDataDisplayProps> = ({ runData, videoFiles, sanderClient }) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [activeView, setActiveView] = useState<'summary' | 'files'>('summary');

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