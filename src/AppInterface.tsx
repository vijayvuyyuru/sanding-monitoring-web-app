import React, { useState, useEffect } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import './AppInterface.css';
import RobotOperator from './RobotOperator';
import { 
  formatShortTimestamp, 
  formatDurationToMinutesSeconds,
  formatTimestamp,
  extractCameraName,
  handleVideoStoreCommand 
} from './lib/videoUtils';

interface AppViewProps {
  passSummaries?: any[];
  videoFiles: VIAM.dataApi.BinaryData[];
  videoStoreClient?: VIAM.GenericComponentClient | null;
  sanderClient: VIAM.GenericComponentClient | null;
  robotClient?: VIAM.RobotClient | null;
  sanderWarning?: string | null;
}

const AppInterface: React.FC<AppViewProps> = ({ 
  passSummaries = [],
  videoFiles, 
  sanderClient, 
  videoStoreClient, 
  robotClient,
  sanderWarning
}) => {
  const [activeRoute, setActiveRoute] = useState('live');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [selectedVideo, setSelectedVideo] = useState<VIAM.dataApi.BinaryData | null>(null);
  const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null);
  const [loadingModalVideo, setLoadingModalVideo] = useState(false);

  const expectedSteps = [
    "Imaging",
    "GeneratingLobes", 
    "GeneratingWaypoints",
    "Executing"
  ];

  const activeTabStyle = "bg-blue-600 text-white";
  const inactiveTabStyle = "bg-gray-200 text-gray-700 hover:bg-gray-300";

  const toggleRowExpansion = (index: number) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(index)) {
      newExpandedRows.delete(index);
    } else {
      newExpandedRows.add(index);
    }
    setExpandedRows(newExpandedRows);
  };

  const getStepVideos = (step: { start: string; end:string; name?: string }) => {
    if (!videoFiles) return [];

    const stepStart = new Date(step.start);
    const stepEnd = new Date(step.end);

    // Debug logging
    console.log(`Looking for videos in step ${step.name || 'unknown'}:`, {
      stepStart: stepStart.toISOString(),
      stepEnd: stepEnd.toISOString(),
      availableVideos: videoFiles.map(f => ({
        time: f.metadata?.timeRequested?.toDate().toISOString(),
        fileName: f.metadata?.fileName
      }))
    });

    return videoFiles.filter(file => {
      if (!file.metadata?.timeRequested || !file.metadata?.fileName?.endsWith('.mp4')) return false;
      const fileTime = file.metadata.timeRequested.toDate();
      const isInRange = fileTime >= stepStart && fileTime <= stepEnd;
      
      // Debug log for each video check
      if (step.name) {
        console.log(`Video ${file.metadata.fileName} at ${fileTime.toISOString()} is ${isInRange ? 'IN' : 'OUT OF'} range for step ${step.name}`);
      }
      
      return isInRange;
    }).sort((a, b) => {
      const timeA = a.metadata!.timeRequested!.toDate().getTime();
      const timeB = b.metadata!.timeRequested!.toDate().getTime();
      return timeA - timeB;
    });
  };

  const getStatusBadge = (success: boolean) => {
    if (success) {
      return (
        <span className="moveleft inline-flex items-center justify-center py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 status-badge-width">
          Success
        </span>
      );
    } else {
      return (
        <span className="moveleft inline-flex items-center justify-center py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 status-badge-width">
          Failed
        </span>
      );
    }
  };

  const runsToDisplay = passSummaries;

  const handleVideoClick = async (video: VIAM.dataApi.BinaryData) => {
    setSelectedVideo(video);
    
    if (videoStoreClient && video.metadata?.timeRequested) {
      setLoadingModalVideo(true);
      try {
        // Pass null as runData and let handleVideoStoreCommand use the time range from storage
        const result = await handleVideoStoreCommand(videoStoreClient, null);
        
        if (result.videoUrl) {
          setModalVideoUrl(result.videoUrl);
        }
      } catch (error) {
        console.error("Error fetching video:", error);
      } finally {
        setLoadingModalVideo(false);
      }
    }
  };

  const closeVideoModal = () => {
    // Clean up video URL if it exists
    if (modalVideoUrl && modalVideoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(modalVideoUrl);
    }
    setSelectedVideo(null);
    setModalVideoUrl(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (modalVideoUrl && modalVideoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(modalVideoUrl);
      }
    };
  }, [modalVideoUrl]);

  return (
    <div className="appInterface">
      <header className="flex items-center sticky top-0 z-10 mb-4 px-4 py-3 border-b bg-zinc-50 shadow-none md:shadow-xs">
        <div className="w-1/3 h-5 font-semibold text-zinc-900">Sanding Control Interface</div>
        
        <div className="w-1/3 flex justify-center">
          <div className="flex flex-row items-center gap-2">
            <button
              onClick={() => setActiveRoute('live')}
              className={`${activeRoute === 'live' ? activeTabStyle : inactiveTabStyle} h-9 sm:h-10 px-4 rounded`}
            >
              Run summary
            </button>
            <button
              onClick={() => setActiveRoute('past')}
              className={`${activeRoute === 'past' ? activeTabStyle : inactiveTabStyle} h-9 sm:h-10 px-4 rounded`}
            >
              Robot operator
            </button>
          </div>
        </div>

        <div className="w-1/3"></div>
      </header>
      
      <main className="mainContent">
        {activeRoute === 'live' ? (
          <>
            <section>
              <h2 className="text-xl font-semibold text-zinc-900 mb-4">Passes</h2>
              
              <div className="viam-table-container">
                <table className="viam-table">
                  <thead>
                    <tr>
                      <th style={{ width: '20px' }}></th>
                      <th>Pass ID</th>
                      <th>Status</th>
                      <th>Start Time</th>
                      <th>End Time</th>
                      <th>Duration</th>
                      <th>Steps</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runsToDisplay.map((run: any, index: number) => (
                      <React.Fragment key={run.pass_id || index}>
                        <tr 
                          className="expandable-row"
                          onClick={() => toggleRowExpansion(index)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleRowExpansion(index);
                            }
                          }}
                          aria-expanded={expandedRows.has(index)}
                          aria-label={`${expandedRows.has(index) ? 'Collapse' : 'Expand'} details for run from ${formatShortTimestamp(run.start)}`}
                        >
                          <td>
                            <span className={`expand-icon ${expandedRows.has(index) ? 'expanded' : ''}`} aria-hidden="true">
                              ▶
                            </span>
                          </td>
                          <td className="text-zinc-700 text-xs">
                            {run.pass_id ? run.pass_id.substring(0, 8) : '—'}
                          </td>
                          <td>{getStatusBadge(run.success)}</td>
                          <td className="text-zinc-700">{formatShortTimestamp(run.start)}</td>
                          <td className="text-zinc-700">{formatShortTimestamp(run.end)}</td>
                          <td className="text-zinc-700">{formatDurationToMinutesSeconds(run.start, run.end)}</td>
                          <td className="text-zinc-700">
                            {run.steps ? `${run.steps.length} steps` : '—'}
                          </td>
                          <td className="text-zinc-700">
                            {run.err_string ? (
                              <span className="text-red-600 text-xxs font-mono error-text" title={run.err_string}>
                                {run.err_string}
                              </span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                        </tr>
                        {expandedRows.has(index) && (
                          <tr className="expanded-content">
                            <td colSpan={8}>
                              <div className="run-details">
                                <div className="passes-container">
                                  <div className="steps-grid">
                                    {expectedSteps.map((stepName) => {
                                      console.log('Looking for step:', stepName, 'in steps:', run.steps);
                                      const step = run.steps?.find((s: any) => s.name === stepName);
                                      if (step) {
                                        const stepVideos = getStepVideos(step);

                                        return (
                                          <div key={stepName} className="step-card">
                                            <div className="step-name">{stepName}</div>
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
                                            <div className="step-duration">{formatDurationToMinutesSeconds(step.start, step.end)}</div>
                                            
                                            {stepVideos.length > 0 ? (
                                              <div className="step-videos-grid">
                                                {stepVideos.map((video, videoIndex) => (
                                                  <div 
                                                    key={videoIndex} 
                                                    className="step-video-item"
                                                    onClick={() => handleVideoClick(video)}
                                                  >
                                                    <div className="video-thumbnail-container">
                                                      <div className="video-thumbnail">
                                                        <span className="video-icon">🎬</span>
                                                      </div>
                                                    </div>
                                                    <div className="video-info">
                                                      <div className="camera-name" title={extractCameraName(video.metadata?.fileName || '')}>
                                                        {extractCameraName(video.metadata?.fileName || '')}
                                                      </div>
                                                      <div className="video-time">
                                                        {video.metadata?.timeRequested ?
                                                          formatShortTimestamp(video.metadata.timeRequested.toDate().toISOString()) :
                                                          'Unknown'
                                                        }
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <div className="no-videos-message">No videos found</div>
                                            )}
                                          </div>
                                        );
                                      }
                                      return (
                                        <div key={stepName} className="step-card step-missing">
                                          <div className="step-name">{stepName}</div>
                                          <div className="step-missing-text">Step not executed</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                
                                  {/* New section for all files in pass time range */}
                                  {(() => {
                                    const passStart = new Date(run.start);
                                    const passEnd = new Date(run.end);
                                    
                                    const passFiles = videoFiles.filter(file => {
                                      if (!file.metadata?.timeRequested) return false;
                                      const fileTime = file.metadata.timeRequested.toDate();
                                      return fileTime >= passStart && fileTime <= passEnd;
                                    }).sort((a, b) => {
                                      const timeA = a.metadata!.timeRequested!.toDate().getTime();
                                      const timeB = b.metadata!.timeRequested!.toDate().getTime();
                                      return timeA - timeB;
                                    });
                                    
                                    // Only render the section if there are files
                                    if (passFiles.length === 0) {
                                      return null;
                                    }
                                    
                                    return (
                                      <div className="pass-files-section">
                                        <h4>
                                          Files captured during this pass
                                        </h4>
                                        
                                        <div style={{ 
                                          display: 'grid',
                                          gridTemplateColumns: 'repeat(2, 1fr)',
                                          gap: '8px' 
                                        }}>
                                          {passFiles.map((file, fileIndex) => {
                                            const fileName = file.metadata?.fileName?.split('/').pop() || 'Unknown file';
                                            
                                            return (
                                              <div 
                                                key={fileIndex}
                                                style={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'space-between',
                                                  padding: '8px 12px',
                                                  backgroundColor: '#f9fafb',
                                                  border: '1px solid #e5e7eb',
                                                  borderRadius: '6px',
                                                  fontSize: '13px',
                                                  cursor: 'pointer',
                                                  transition: 'all 0.2s ease'
                                                }}
                                                onClick={() => {
                                                  if (file.metadata?.uri) {
                                                    window.open(file.metadata.uri, '_blank');
                                                  }
                                                }}
                                                onMouseEnter={(e) => {
                                                  e.currentTarget.style.backgroundColor = '#e5e7eb';
                                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                  e.currentTarget.style.backgroundColor = '#f9fafb';
                                                  e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                              >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                                  <span style={{ 
                                                    color: '#374151',
                                                    wordBreak: 'break-all',
                                                    flex: 1
                                                  }}>
                                                    {fileName}
                                                  </span>
                                                  <span style={{ 
                                                    color: '#9ca3af', 
                                                    fontSize: '12px',
                                                    whiteSpace: 'nowrap',
                                                    flexShrink: 0
                                                  }}>
                                                    {formatShortTimestamp(file.metadata?.timeRequested?.toDate().toISOString() || '')}
                                                  </span>
                                                </div>
                                                <a 
                                                  href={file.metadata?.uri}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  style={{
                                                    marginLeft: '12px',
                                                    padding: '4px 12px',
                                                    backgroundColor: '#3b82f6',
                                                    color: 'white',
                                                    borderRadius: '4px',
                                                    textDecoration: 'none',
                                                    fontSize: '12px',
                                                    whiteSpace: 'nowrap',
                                                    transition: 'background-color 0.2s',
                                                    flexShrink: 0
                                                  }}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                  }}
                                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                                                >
                                                  Download
                                                </a>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section>
            {/* Add warning banner here, only in Robot Operator tab */}
            {sanderWarning && (
              <div className="warning-banner" style={{
                backgroundColor: '#FEF3C7',
                color: '#92400E',
                padding: '12px 16px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px'
              }}>
                <span>⚠️</span>
                <span>{sanderWarning}</span>
              </div>
            )}
            <RobotOperator sanderClient={sanderClient} robotClient={robotClient} />
          </section>
        )}
      </main>

      {/* Video Modal */}
      {selectedVideo && (
        <div className="video-modal-overlay" onClick={closeVideoModal}>
          <div className="video-modal" onClick={(e) => e.stopPropagation()}>
            <div className="video-modal-header">
              <h3>{extractCameraName(selectedVideo.metadata?.fileName || '')}</h3>
              <button className="video-modal-close" onClick={closeVideoModal}>×</button>
            </div>
            <div className="video-modal-content">
              <div className="video-modal-player">
                {loadingModalVideo ? (
                  <>
                    <div className="loading-spinner">⏳</div>
                    <p>Loading video...</p>
                  </>
                ) : modalVideoUrl ? (
                  <video 
                    controls 
                    autoPlay
                    src={modalVideoUrl}
                    style={{ 
                      width: '100%', 
                      height: '100%',
                      borderRadius: '8px'
                    }}
                    onError={(e) => {
                      console.error("Video playback error:", e);
                      alert("Error playing video");
                    }}
                  />
                ) : (
                  <>
                    <span className="video-icon-large">🎬</span>
                    <p>Video Preview</p>
                    {videoStoreClient && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (selectedVideo) {
                            await handleVideoClick(selectedVideo);
                          }
                        }}
                        className="fetch-video-btn"
                        style={{
                          marginTop: '10px',
                          padding: '8px 16px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        Load Video from Store
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="video-modal-info">
                <p><strong>Time:</strong> {selectedVideo.metadata?.timeRequested ? 
                  formatTimestamp(selectedVideo.metadata.timeRequested.toDate().toISOString()) : 
                  'Unknown'
                }</p>
                <p><strong>File:</strong> {selectedVideo.metadata?.fileName || 'Unknown'}</p>
                {modalVideoUrl && (
                  <p style={{ fontSize: '12px', color: '#28a745', marginTop: '10px' }}>
                    ✅ Video loaded from base64 data
                  </p>
                )}
              </div>
              <div className="video-modal-actions">
                <a 
                  href={selectedVideo.metadata?.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="video-modal-button primary"
                >
                  Open in New Tab
                </a>
                <a 
                  href={selectedVideo.metadata?.uri} 
                  download={selectedVideo.metadata?.fileName || 'video.mp4'}
                  className="video-modal-button secondary"
                >
                  Download
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppInterface;