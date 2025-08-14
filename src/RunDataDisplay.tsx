import React, { useState } from 'react';

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
  videoFiles?: any[];
}

const RunDataDisplay: React.FC<RunDataDisplayProps> = ({ runData, videoFiles }) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

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
      return b.metadata.timeRequested.toDate().getTime() - a.metadata.timeRequested.toDate().getTime();
    });
  };

  // Get all .mp4 files for debugging
  const mp4Files = videoFiles?.filter(f => f.metadata?.fileName?.endsWith('.mp4')) || [];

  if (!runData) return null;

  return (
    <div className="run-data-section">
      <h2>Latest Run Summary</h2>
      <div className="run-summary">
        <div className={`status ${runData.success ? 'success' : 'error'}`}>
          Status: {runData.success ? 'Success' : 'Failed'}
        </div>
        {runData.err_string && (
          <div className="error-message">Error: {runData.err_string}</div>
        )}
        <div className="run-times">
          <div>
            Start: {formatTimestamp(runData.start)}
            <div className="placeholder"></div>
          </div>
          <div>
            End: {formatTimestamp(runData.end)}
            <div className="placeholder"></div>
          </div>
          <div>Duration: {formatDuration(runData.duration_ms)}</div>
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
                          <div className="camera-name">📹 {extractCameraName(video.metadata?.fileName)}</div>
                          <div className="video-time">
                            {formatShortTimestamp(video.metadata.timeRequested.toDate().toISOString())}
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
    </div>
  );
};

export default RunDataDisplay;