import React, { useState } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import './AppInterface.css';
import RobotOperator from './RobotOperator';
import StepVideosGrid from './StepVideosGrid';
import { 
  formatDurationToMinutesSeconds,
} from './lib/videoUtils';

interface AppViewProps {
  passSummaries?: any[];
  files: VIAM.dataApi.BinaryData[];
  viamClient: VIAM.ViamClient;
  videoStoreClient?: VIAM.GenericComponentClient | null;
  // sanderClient: VIAM.GenericComponentClient | null;
  robotClient?: VIAM.RobotClient | null;
  // sanderWarning?: string | null;
}
export interface Step {
  name: string;
  start: Date;
  end: Date;
  pass_id: string;
  // duration_ms?: number;
}

export interface Pass {
  start: Date;
  end: Date;
  steps: Step[];
  success: boolean;
  pass_id: string;
  err_string?: string | null;
}



const AppInterface: React.FC<AppViewProps> = ({ 
  viamClient,
  passSummaries = [],
  files: files, 
  // sanderClient, 
  videoStoreClient, 
  robotClient,
  // sanderWarning
}) => {
  const [activeRoute, setActiveRoute] = useState('live');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());

  // Filter files to only include video files (.mp4)
  const videoFiles = files.filter((file: VIAM.dataApi.BinaryData) => 
    file.metadata?.fileName?.toLowerCase().endsWith('.mp4')
  );

  const filesByID = files.reduce((acc: any, file: VIAM.dataApi.BinaryData) => {
    acc[file.metadata!.binaryDataId] = file;
    return acc;
  }, {});

  // const expectedSteps = [
  //   "Imaging",
  //   "GeneratingLobes", 
  //   "GeneratingWaypoints",
  //   "Executing"
  // ];

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

  const getStepVideos = (step: Step) => {
    if (!videoFiles) return [];

    return videoFiles.filter(file => {
      if (!file.metadata || !file.metadata.fileName) return false;
      const isMatchingStep = file.metadata.fileName.includes(step.pass_id) && file.metadata.fileName.includes(step.name)
      return isMatchingStep
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

  const handleDownload = async (file: VIAM.dataApi.BinaryData) => {
    if (!file.metadata?.binaryDataId) return;
    
    const fileId = file.metadata.binaryDataId;
    
    // Set loading state
    setDownloadingFiles(prev => new Set(prev).add(fileId));
    
    try {
      const binaryData = await viamClient.dataClient.binaryDataByIds([fileId]);
      if (binaryData.length > 0) {
        const fileData = binaryData[0];

        const fileName = fileData.metadata?.fileName ?? "unknown";
        
        const fileObj = new File([fileData.binary], fileName, { 
          type: fileData.metadata?.fileExt || 'application/octet-stream' 
        });
        
        // Create object URL from the File
        const url = URL.createObjectURL(fileObj);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      // Clear loading state
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  }


  return (
    <div className="appInterface">
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <header className="flex items-center sticky top-0 z-10 mb-4 px-4 py-3 border-b bg-zinc-50 shadow-none md:shadow-xs">
        <div className="w-1/3 h-5 font-semibold text-zinc-900">Sanding Control Interface</div>
        
        <div className="w-1/3 flex justify-center">
          <div className="flex flex-row items-center gap-2">
            <button
              onClick={() => setActiveRoute('live')}
              className={`${activeRoute === 'live' ? activeTabStyle : inactiveTabStyle} h-9 sm:h-10 px-4 rounded`}
            >
              Pass summary
            </button>
            {/* <button
              onClick={() => setActiveRoute('past')}
              className={`${activeRoute === 'past' ? activeTabStyle : inactiveTabStyle} h-9 sm:h-10 px-4 rounded`}
            >
              Robot operator
            </button> */}
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
                      <th>Day</th>
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
                    {passSummaries.map((pass: Pass, index: number) => (
                      <React.Fragment key={pass.pass_id || index}>
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
                          aria-label={`${expandedRows.has(index) ? 'Collapse' : 'Expand'} details for pass from ${pass.start.toLocaleTimeString()}`}
                        >
                          <td>
                            <span className={`expand-icon ${expandedRows.has(index) ? 'expanded' : ''}`} aria-hidden="true">
                              ▶
                            </span>
                          </td>
                          <td className="text-zinc-700">{pass.start.toLocaleDateString()}</td>
                          <td className="text-zinc-700 text-xs">
                            {pass.pass_id ? pass.pass_id.substring(0, 8) : '—'}
                          </td>
                          <td>{getStatusBadge(pass.success)}</td>
                          <td className="text-zinc-700">{pass.start.toLocaleTimeString()}</td>
                          <td className="text-zinc-700">{pass.end.toLocaleTimeString()}</td>
                          <td className="text-zinc-700">{formatDurationToMinutesSeconds(pass.start, pass.end)}</td>
                          <td className="text-zinc-700">
                            {pass.steps ? `${pass.steps.length} steps` : '—'}
                          </td>
                          <td className="text-zinc-700">
                            {pass.err_string ? (
                              <span className="text-red-600 text-xxs font-mono error-text" title={pass.err_string}>
                                {pass.err_string}
                              </span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                        </tr>
                        {expandedRows.has(index) && (
                          <tr className="expanded-content">
                            <td colSpan={8}>
                              <div className="pass-details">
                                <div className="passes-container">
                                  <div className="steps-grid">
                                    {pass.steps.map((step: Step) => {
                                        const stepVideos = getStepVideos(step);

                                        return (
                                          <div key={step.name} className="step-card">
                                            <div className="step-name">{step.name}</div>
                                            <div className="step-timeline">
                                              <div className="step-time">
                                                <span className="time-label">Start</span>
                                                <span className="time-value">{step.start.toLocaleTimeString()}</span>
                                              </div>
                                              <div className="timeline-arrow">→</div>
                                              <div className="step-time">
                                                <span className="time-label">End</span>
                                                <span className="time-value">{step.end.toLocaleTimeString()}</span>
                                              </div>
                                            </div>
                                            <div className="step-duration">{formatDurationToMinutesSeconds(step.start, step.end)}</div>
                                            
                                            <StepVideosGrid
                                              step={step}
                                              stepVideos={stepVideos}
                                              videoStoreClient={videoStoreClient}
                                              viamClient={viamClient}
                                            />
                                          </div>
                                        );
                                    })}
                                  </div>
                                
                                  {/* New section for all files in pass time range */}
                                  {(() => {
                                    const passStart = new Date(pass.start);
                                    const passEnd = new Date(pass.end);
                                    
                                    // Always include files that fall within the pass time range (this includes .pcd files)
                                    const passTimeRangeFileIDS = files.filter((file: VIAM.dataApi.BinaryData) => {
                                      if (!file.metadata?.timeRequested) return false;
                                      const fileTime = file.metadata.timeRequested.toDate();
                                      return fileTime >= passStart && fileTime <= passEnd;
                                    }).map((x)=> x.metadata!.binaryDataId);
                                    
                                    // Additionally include pass-specific files if pass_id is not blank
                                    const passFileIDs: string[] = pass.pass_id && pass.pass_id.trim() !== '' 
                                      ? files.filter((x)=> x.metadata!.fileName?.split("/").filter((y) => y == pass.pass_id).length > 0).map((x)=> x.metadata!.binaryDataId)
                                      : [];
                                    
                                    const ids = new Set([...passFileIDs, ...passTimeRangeFileIDS]);
                                    const passFiles  = files.filter((x)=> ids.has(x.metadata!.binaryDataId)).sort((a, b) => {
                                      const timeA = a.metadata!.timeRequested!.toDate().getTime();
                                      const timeB = b.metadata!.timeRequested!.toDate().getTime();
                                      return timeA - timeB;
                                    })

                                    // Only render the section if there are files
                                    if (passFiles.length === 0) {
                                      return <div className="pass-files-section">
                                        <h4>
                                          Files captured during this pass
                                        </h4>
                                        <p>
                                          No files found
                                        </p>
                                        </div>
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
                                                    {file.metadata?.timeRequested?.toDate().toLocaleTimeString() || ''}
                                                  </span>
                                                </div>
                                                <button 
                                                  style={{
                                                    marginLeft: '12px',
                                                    padding: '4px 12px',
                                                    backgroundColor: downloadingFiles.has(file.metadata?.binaryDataId || '') ? '#9ca3af' : '#3b82f6',
                                                    color: 'white',
                                                    borderRadius: '4px',
                                                    textDecoration: 'none',
                                                    fontSize: '12px',
                                                    whiteSpace: 'nowrap',
                                                    transition: 'background-color 0.2s',
                                                    flexShrink: 0,
                                                    cursor: downloadingFiles.has(file.metadata?.binaryDataId || '') ? 'not-allowed' : 'pointer'
                                                  }}
                                                  onClick={async (e) => {
                                                    if (downloadingFiles.has(file.metadata?.binaryDataId || '')) return;
                                                    await handleDownload(file);
                                                    e.stopPropagation();
                                                  }}
                                                  onMouseEnter={(e) => {
                                                    if (!downloadingFiles.has(file.metadata?.binaryDataId || '')) {
                                                      e.currentTarget.style.backgroundColor = '#2563eb';
                                                    }
                                                  }}
                                                  onMouseLeave={(e) => {
                                                    if (!downloadingFiles.has(file.metadata?.binaryDataId || '')) {
                                                      e.currentTarget.style.backgroundColor = '#3b82f6';
                                                    }
                                                  }}
                                                >
                                                  {downloadingFiles.has(file.metadata?.binaryDataId || '') ? (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                      <span style={{ 
                                                        display: 'inline-block',
                                                        width: '12px',
                                                        height: '12px',
                                                        border: '2px solid transparent',
                                                        borderTop: '2px solid white',
                                                        borderRadius: '50%',
                                                        animation: 'spin 1s linear infinite'
                                                      }}></span>
                                                      Processing...
                                                    </span>
                                                  ) : (
                                                    'Download'
                                                  )}
                                                </button>
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
          null
          // <section>
          //   {/* Add warning banner here, only in Robot Operator tab */}
          //   {sanderWarning && (
          //     <div className="warning-banner" style={{
          //       backgroundColor: '#FEF3C7',
          //       color: '#92400E',
          //       padding: '12px 16px',
          //       borderRadius: '8px',
          //       display: 'flex',
          //       alignItems: 'center',
          //       gap: '8px',
          //       marginBottom: '16px'
          //     }}>
          //       <span>⚠️</span>
          //       <span>{sanderWarning}</span>
          //     </div>
          //   )}
          //   <RobotOperator sanderClient={sanderClient} robotClient={robotClient} />
          // </section>
        )}
      </main>
      
    </div>
  );
};

export default AppInterface;