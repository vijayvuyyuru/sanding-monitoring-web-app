import React, { useState, useEffect } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import './AppInterface.css';
import StepVideosGrid from './StepVideosGrid';
import VideoStoreSelector from './VideoStoreSelector';
import { 
  formatDurationToMinutesSeconds,
} from './lib/videoUtils';

interface AppViewProps {
  passSummaries?: any[];
  files: Map<string, VIAM.dataApi.BinaryData>;
  videoFiles: Map<string, VIAM.dataApi.BinaryData>;
  imageFiles: Map<string, VIAM.dataApi.BinaryData>;
  viamClient: VIAM.ViamClient;
  robotClient?: VIAM.RobotClient | null;
  fetchVideos: (start: Date) => Promise<void>;
  machineName: string | null;
  loadingPasses: Set<string>;
  fetchTimestamp: Date | null;
}

export interface Step {
  name: string;
  start: Date;
  end: Date;
  pass_id: string;
}

export interface Pass {
  start: Date;
  end: Date;
  steps: Step[];
  success: boolean;
  pass_id: string;
  err_string?: string | null;
}

const ImageDisplay: React.FC<{ binaryData: VIAM.dataApi.BinaryData, viamClient: VIAM.ViamClient }> = ({ binaryData, viamClient }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    let currentObjectUrl: string | null = null;

    const getImageUrl = async (binaryData: VIAM.dataApi.BinaryData): Promise<void> => {
      try {
        let data = binaryData.binary;
        const binaryId = binaryData.metadata?.binaryDataId;

        // If binary data is not present, fetch it by ID
        if ((!data || data.length === 0) && binaryId) {
          console.log('Fetching binary data by ID:', binaryId);
          const results = await viamClient.dataClient.binaryDataByIds([binaryId]);
          if (results && results.length > 0 && results[0].binary && results[0].binary.length > 0) {
            console.log(`Retrieved binary data for ID ${binaryId}, size:`, results[0].binary.length);
            data = results[0].binary;
          } else {
            console.error(`Failed to retrieve binary data for ID ${binaryId}`);
          }
        }

        if (!data || data.length === 0) {
          const errMsg = `No binary data available for image ${binaryData.metadata?.fileName || binaryId}`;
          console.error(errMsg);
          throw new Error(errMsg);
        }

        console.log('Binary data size:', data.length);

        // Determine MIME type based on file extension or metadata
        let mimeType = 'image/jpeg'; // default
        const fileName = binaryData.metadata?.fileName?.toLowerCase();
        const fileExt = binaryData.metadata?.fileExt?.toLowerCase();
        
        if (fileName?.endsWith('.png') || fileExt === 'png') {
          mimeType = 'image/png';
        } else if (fileName?.endsWith('.jpg') || fileName?.endsWith('.jpeg') || fileExt === 'jpg' || fileExt === 'jpeg') {
          mimeType = 'image/jpeg';
        }

        console.log('Using MIME type:', mimeType);

        // Don't try to create a blob with empty data
        if (data.length === 0) {
          throw new Error('Cannot create image from empty data');
        }

        // Convert Uint8Array to blob
        const buffer = new ArrayBuffer(data.length);
        const view = new Uint8Array(buffer);
        view.set(data);
        
        const blob = new Blob([buffer], { type: mimeType });
        currentObjectUrl = URL.createObjectURL(blob);
        
        console.log('Created blob URL:', currentObjectUrl);
        
        if (isMounted) {
          setImageUrl(currentObjectUrl);
          setIsLoading(false);
          setHasError(false);
          setErrorMessage('');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error("Error creating image URL:", errorMsg);
        if (isMounted) {
          setImageUrl(null);
          setIsLoading(false);
          setHasError(true);
          setErrorMessage(errorMsg);
        }
      }
    };

    getImageUrl(binaryData);

    return () => {
      isMounted = false;
      // Clean up the object URL when component unmounts
      if (currentObjectUrl) {
        console.log('Revoking blob URL:', currentObjectUrl);
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [binaryData, viamClient]);

  if (isLoading) {
    return (
      <div style={{ 
        width: '300px', 
        height: '225px', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6b7280'
      }}>
        Loading...
      </div>
    );
  }

  if (hasError || !imageUrl) {
    return (
      <div style={{ 
        width: '300px', 
        height: '225px', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ef4444',
        fontSize: '14px',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>Failed to load image</div>
        {errorMessage && (
          <div style={{ fontSize: '12px', marginTop: '8px', color: '#9ca3af', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {errorMessage}
          </div>
        )}
        {binaryData.metadata?.fileName && (
          <div style={{ fontSize: '12px', marginTop: '8px', color: '#9ca3af' }}>
            {binaryData.metadata.fileName.split('/').pop()}
          </div>
        )}
      </div>
    );
  }

  return (
    <img 
      src={imageUrl} 
      alt="Pass capture" 
      style={{ 
        width: '100%',
        maxWidth: '100%',
        maxHeight: '225px',
        borderRadius: '4px',
        objectFit: 'contain',
        display: 'block'
      }} 
      onLoad={() => {
        console.log('Image loaded successfully');
      }}
      onError={() => {
        console.error("Image failed to render, URL:", imageUrl);
        setHasError(true);
        setErrorMessage('Image failed to render after loading');
      }}
    />
  );
};

const AppInterface: React.FC<AppViewProps> = ({ 
  machineName,
  viamClient,
  passSummaries = [],
  files, 
  videoFiles,
  imageFiles,
  robotClient,
  fetchVideos,
  fetchTimestamp,
}) => {
  const [activeRoute, setActiveRoute] = useState('live');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [videoStoreClient, setVideoStoreClient] = useState<VIAM.GenericComponentClient | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<string>('');

  const cameraComponentNames = Array.from(
    new Set(
      Array.from(imageFiles.values())
        .map(file => file.metadata?.captureMetadata?.componentName)
        .filter((name): name is string => !!name)
    )
  );

  const activeTabStyle = "bg-blue-600 text-white";
  const inactiveTabStyle = "bg-gray-200 text-gray-700 hover:bg-gray-300";

  const toggleRowExpansion = (index: number) => {
    const newExpandedRows = new Set(expandedRows);
    const isExpanding = !newExpandedRows.has(index);

    if (isExpanding) {
      newExpandedRows.add(index);
    } else {
      newExpandedRows.delete(index);
    }
    setExpandedRows(newExpandedRows);
  };

  const getStepVideos = (step: Step) => {
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
              Pass summary
            </button>
          </div>
        </div>

        <div className="w-1/3"></div>
      </header>
      
      <main className="mainContent">
        {activeRoute === 'live' && (
          <section>
            <h2 className="text-xl font-semibold text-zinc-900 mb-4">Passes
              {machineName ? ` for ${machineName}` : ''}
            </h2>
            
            <VideoStoreSelector
              robotClient={robotClient || null}
              onVideoStoreSelected={setVideoStoreClient}
            />

            {cameraComponentNames.length > 0 && (
              <div className="mb-4">
                <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Camera for Before/After Images
                </label>
                <select
                  id="camera-select"
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Select a Camera --</option>
                  {cameraComponentNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}
            
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
                          {pass.pass_id ? (
                            <button
                              onClick={() => navigator.clipboard.writeText(pass.pass_id)}
                              className="hover:bg-blue-100 hover:text-blue-700 px-1 py-0.5 rounded cursor-pointer transition-colors"
                              title={`Click to copy full pass ID: ${pass.pass_id}`}
                            >
                              {pass.pass_id.substring(0, 8)}
                            </button>
                          ) : (
                            '—'
                          )}
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
                          <td colSpan={9}>
                            <div className="pass-details">
                              <div className="passes-container">
                                <div className="steps-grid">
                                  {/* Before Image - with time threshold */}
                                  {selectedCamera && (() => {
                                    const passStart = new Date(pass.start);
                                    
                                    const allCameraImages = Array.from(imageFiles.values()).filter(file => 
                                      file.metadata?.captureMetadata?.componentName === selectedCamera && file.metadata?.timeRequested
                                    ).sort((a, b) => a.metadata!.timeRequested!.toDate().getTime() - b.metadata!.timeRequested!.toDate().getTime());
                                    
                                    const beforeImage = allCameraImages
                                      .filter(img => {
                                        const imgTime = img.metadata!.timeRequested!.toDate();
                                        return imgTime < passStart; // No minimum time restriction
                                      })
                                      .pop(); // Get the last one (most recent before pass start)
                                    
                                    // If no image within threshold, show a message instead
                                    if (!beforeImage) {
                                      return (
                                        <div className="step-card" style={{ order: -1 }}>
                                          <div className="step-name">Before Image</div>
                                          <div className="step-duration" style={{ color: '#6b7280' }}>No recent image available</div>
                                          <div style={{ 
                                            height: '225px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: '#f3f4f6',
                                            borderRadius: '4px',
                                            marginTop: '12px',
                                            color: '#9ca3af',
                                            fontSize: '14px'
                                          }}>
                                            No image captured within 30 minutes before pass start
                                          </div>
                                        </div>
                                      );
                                    }
                                    
                                    return (
                                      <div className="step-card" style={{ order: -1 }}>
                                        <div className="step-name">Before Image</div>
                                        <div className="step-duration">
                                          {beforeImage.metadata?.timeRequested?.toDate().toLocaleTimeString()}
                                          <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                                            ({Math.round((passStart.getTime() - (beforeImage.metadata?.timeRequested?.toDate()?.getTime() || passStart.getTime())) / 60000)}m before pass)
                                          </span>
                                        </div>
                                        
                                        <div className="step-image-container" style={{ marginTop: "12px", width: "100%", overflow: "hidden" }}>
                                          <ImageDisplay binaryData={beforeImage} viamClient={viamClient} />
                                        </div>
                                      </div>
                                    );
                                  })()}
                                  
                                  {/* Regular step cards */}
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
                                          videoFiles={videoFiles}
                                          fetchTimestamp={fetchTimestamp}
                                          videoStoreClient={videoStoreClient}
                                          viamClient={viamClient}
                                          fetchVideos={fetchVideos}
                                        />
                                      </div>
                                    );
                                  })}

                                  {/* After Image - with time threshold */}
                                  {selectedCamera && (() => {
                                    const passEnd = new Date(pass.end);
                                    
                                    const allCameraImages = Array.from(imageFiles.values()).filter(file => 
                                      file.metadata?.captureMetadata?.componentName === selectedCamera && file.metadata?.timeRequested
                                    ).sort((a, b) => a.metadata!.timeRequested!.toDate().getTime() - b.metadata!.timeRequested!.toDate().getTime());
                                    
                                    // Only consider images taken after pass end, with no maximum time restriction
                                    const afterImage = allCameraImages.find(img => {
                                      const imgTime = img.metadata!.timeRequested!.toDate();
                                      return imgTime > passEnd; // No maximum time restriction
                                    });
                                    
                                    // If no image within threshold, show a message instead
                                    if (!afterImage) {
                                      return (
                                        <div className="step-card" style={{ order: 999 }}>
                                          <div className="step-name">After Image</div>
                                          <div className="step-duration" style={{ color: '#6b7280' }}>No recent image available</div>
                                          <div style={{ 
                                            height: '225px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: '#f3f4f6',
                                            borderRadius: '4px',
                                            marginTop: '12px',
                                            color: '#9ca3af',
                                            fontSize: '14px'
                                          }}>
                                            No image captured within 30 minutes after pass end
                                          </div>
                                        </div>
                                      );
                                    }
                                    
                                    return (
                                      <div className="step-card" style={{ order: 999 }}>
                                        <div className="step-name">After Image</div>
                                        <div className="step-duration">
                                          {afterImage.metadata?.timeRequested?.toDate().toLocaleTimeString()}
                                          <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                                            ({Math.round(((afterImage.metadata?.timeRequested?.toDate()?.getTime() || passEnd.getTime()) - passEnd.getTime()) / 60000)}m after pass)
                                          </span>
                                        </div>
                                        
                                        <div className="step-image-container" style={{ marginTop: "12px", width: "100%", overflow: "hidden" }}>
                                          <ImageDisplay binaryData={afterImage} viamClient={viamClient} />
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              
                                {/* Keep the "all files in pass time range" section unchanged */}
                                {(() => {
                                  const passStart = new Date(pass.start);
                                  const passEnd = new Date(pass.end);
                                  
                                  // Always include files that fall within the pass time range (this includes .pcd files)
                                  const passTimeRangeFileIDS: string[] = [];
                                  files.forEach((file, binaryDataId) => {
                                    if (file.metadata?.timeRequested) {
                                      const fileTime = file.metadata.timeRequested.toDate();
                                      if (fileTime >= passStart && fileTime <= passEnd) {
                                        passTimeRangeFileIDS.push(binaryDataId);
                                      }
                                    }
                                  });
                                  

                                  // Additionally include pass-specific files if pass_id is not blank
                                  const passFileIDs: string[] = [];
                                  if (pass.pass_id && pass.pass_id.trim() !== '') {
                                    files.forEach((file, binaryDataId) => {
                                      if (file.metadata?.fileName && file.metadata.fileName.split("/").filter((y) => y == pass.pass_id).length > 0) {
                                        passFileIDs.push(binaryDataId);
                                      }
                                    });
                                  }
                                  

                                  const ids = new Set([...passFileIDs, ...passTimeRangeFileIDS]);
                                  const passFiles = Array.from(files.values()).filter((x) => ids.has(x.metadata!.binaryDataId)).sort((a, b) => {
                                    const timeA = a.metadata!.timeRequested!.toDate().getTime();
                                    const timeB = b.metadata!.timeRequested!.toDate().getTime();
                                    return timeA - timeB;
                                  })

                                  // Determine if we are in a loading state for this specific row.
                                  const isLoading = fetchTimestamp && fetchTimestamp > pass.start;

                                  // Show a loading indicator inside the expanded row while fetching files for this pass.
                                  if (isLoading && passFiles.length === 0) {
                                    return (
                                      <div className="pass-files-section" style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '20px',
                                        minHeight: '100px',
                                      }}>
                                        <span style={{ 
                                          display: 'inline-block',
                                          width: '28px',
                                          height: '28px',
                                          border: '3px solid rgba(59, 130, 246, 0.2)',
                                          borderTopColor: '#3b82f6',
                                          borderRadius: '50%',
                                          animation: 'spin 1s linear infinite'
                                        }}></span>
                                        <p style={{ marginTop: '12px', color: '#6b7280', fontSize: '14px' }}>
                                          Loading files...
                                        </p>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="pass-files-section">
                                      <h4>
                                        Files captured during this pass
                                      </h4>
                                      
                                      {passFiles.length > 0 && (
                                        <div style={{ 
                                          display: 'flex',
                                          flexWrap: 'wrap',
                                          gap: '8px',
                                          overflowY: 'auto',
                                          padding: '4px',
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
                                                  transition: 'all 0.2s ease',
                                                  flex: '1 0 calc(50% - 8px)',
                                                  minWidth: '280px',
                                                  maxWidth: 'calc(50% - 8px)',
                                                  boxSizing: 'border-box'
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
                                                <div style={{ 
                                                  display: 'flex', 
                                                  alignItems: 'center', 
                                                  gap: '8px',
                                                  flex: 1, 
                                                  minWidth: 0,
                                                  overflow: 'hidden'
                                                }}>
                                                  <span style={{ 
                                                    color: '#374151',
                                                    textOverflow: 'ellipsis',
                                                    overflow: 'hidden',
                                                    whiteSpace: 'nowrap',
                                                    flex: 1
                                                  }} title={fileName}>
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
                                                <a 
                                                  href={file.metadata?.uri}
                                                  download={file.metadata?.fileName?.split('/').pop() || 'download'}
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
                                                    flexShrink: 0,
                                                    cursor: 'pointer',
                                                    display: 'inline-block'
                                                  }}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                  }}
                                                  onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#2563eb';
                                                  }}
                                                  onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#3b82f6';
                                                  }}
                                                >
                                                  Download
                                                </a>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      
                                      {/* Show message if no files are found in the current view */}
                                      {passFiles.length === 0 && !isLoading && (
                                        <p>
                                          No files found for this pass.
                                        </p>
                                      )}
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
        )}
      </main>
    </div>
  );
};

export default AppInterface;