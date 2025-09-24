import React, { useState, useMemo, useEffect } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import './AppInterface.css';
import StepVideosGrid from './StepVideosGrid';
import VideoStoreSelector from './VideoStoreSelector';
import ImageDisplay from './ImageDisplay';
import BeforeAfterModal from './BeforeAfterModal';
import {
  formatDurationToMinutesSeconds,
  formatTimeDifference,
} from './lib/videoUtils';
import { getBeforeAfterImages, getStepVideos } from './lib/passUtils';
import { formatDurationMs } from './lib/uiUtils';
import { PassNote, createNotesManager } from './lib/notesManager';

interface AppViewProps {
  passSummaries?: any[];
  files: Map<string, VIAM.dataApi.BinaryData>;
  videoFiles: Map<string, VIAM.dataApi.BinaryData>;
  imageFiles: Map<string, VIAM.dataApi.BinaryData>;
  viamClient: VIAM.ViamClient;
  robotClient?: VIAM.RobotClient | null;
  fetchVideos: (start: Date) => Promise<void>;
  machineName: string | null;
  fetchTimestamp: Date | null;
  machineId: string;
  partId: string;
  passNotes: Map<string, PassNote[]>;
  onNotesUpdate: React.Dispatch<React.SetStateAction<Map<string, PassNote[]>>>;
  fetchingNotes: boolean;
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
  build_info?: {
    version?: string;
    git_revision?: string;
    date_compiled?: string;
  };
}

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
  machineId,
  partId,
  passNotes,
  onNotesUpdate,
  fetchingNotes,
}) => {
  const [activeRoute, setActiveRoute] = useState('live');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [videoStoreClient, setVideoStoreClient] = useState<VIAM.GenericComponentClient | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [beforeAfterModal, setBeforeAfterModal] = useState<{
    beforeImage: VIAM.dataApi.BinaryData | null;
    afterImage: VIAM.dataApi.BinaryData | null;
  } | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<Set<string>>(new Set());
  const [noteSuccess, setNoteSuccess] = useState<Set<string>>(new Set());

  // Initialize note inputs from existing notes
  useEffect(() => {
    const initialInputs: Record<string, string> = {};
    passNotes.forEach((notes, passId) => {
      if (notes.length > 0) {
        initialInputs[passId] = notes[0].note_text;
      }
    });
    setNoteInputs(initialInputs);
  }, [passNotes]);

  const handleNoteChange = (passId: string, value: string) => {
    setNoteInputs(prev => ({
      ...prev,
      [passId]: value
    }));

    // Clear success state when editing
    if (noteSuccess.has(passId)) {
      const newSuccess = new Set(noteSuccess);
      newSuccess.delete(passId);
      setNoteSuccess(newSuccess);
    }
  };

  const saveNote = async (passId: string) => {
    if (!viamClient || !passId || !partId) return;

    const noteText = noteInputs[passId]?.trim() || '';

    // Show saving indicator
    setSavingNotes(prev => new Set(prev).add(passId));

    try {
      const notesManager = createNotesManager(viamClient, machineId);
      await notesManager.savePassNote(passId, noteText, partId);

      // Create new note object
      const newNote: PassNote = {
        pass_id: passId,
        note_text: noteText,
        created_at: new Date().toISOString(),
        created_by: "web-app"
      };

      // Update notes in state
      onNotesUpdate(prevNotes => {
        const newNotesMap = new Map(prevNotes);
        const existingNotes = newNotesMap.get(passId) || [];
        const updatedNotes = [newNote, ...existingNotes];
        newNotesMap.set(passId, updatedNotes);
        return newNotesMap;
      });

      // Show success state
      setNoteSuccess(prev => new Set(prev).add(passId));

      // Clear success state after a delay
      setTimeout(() => {
        setNoteSuccess(prev => {
          const newSuccess = new Set(prev);
          newSuccess.delete(passId);
          return newSuccess;
        });
      }, 2000);
    } catch (error) {
      console.error("Failed to save note:", error);
    } finally {
      // Hide saving indicator
      setSavingNotes(prev => {
        const newSaving = new Set(prev);
        newSaving.delete(passId);
        return newSaving;
      });
    }
  };

  const cameraComponentNames = Array.from(
    new Set(
      Array.from(imageFiles.values())
        .filter(file => file.metadata?.captureMetadata?.componentType === 'rdk:component:camera')
        .map(file => file.metadata?.captureMetadata?.componentName)
        .filter((name): name is string => !!name)
    )
  );

  const openBeforeAfterModal = (beforeImage: VIAM.dataApi.BinaryData | null, afterImage: VIAM.dataApi.BinaryData | null) => {
    setBeforeAfterModal({ beforeImage, afterImage });
  };

  const closeBeforeAfterModal = () => {
    setBeforeAfterModal(null);
  };

  // Helper function to get before/after images for a pass
  const passImages = (pass: Pass) => getBeforeAfterImages(pass, imageFiles, selectedCamera);

  const activeTabStyle = "bg-blue-600 text-white";
  const inactiveTabStyle = "bg-gray-200 text-gray-700 hover:bg-gray-300";

  // Memoize the grouped passes calculation with consistent date formatting
  const groupedPasses = useMemo(() => {
    return passSummaries.reduce((acc: Record<string, Pass[]>, pass) => {
      // Use a consistent date key (YYYY-MM-DD)
      const dateKey = pass.start.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(pass);
      return acc;
    }, {});
  }, [passSummaries]);

  // Memoize day aggregates calculation - calculate both execution percentage AND total time
  const dayAggregates = useMemo(() => {
    return Object.entries(groupedPasses).reduce((acc: Record<string, {
      totalFactoryTime: number;
      totalExecutionTime: number;
      totalOtherStepsTime: number;
      totalPassCount: number;
      executionPercentage: number;
      formattedDate: string;
    }>, [dateKey, passes]) => {
      let totalFactoryTime = 0;
      let totalExecutionTime = 0;
      let totalOtherStepsTime = 0;

      // Calculate both time and execution metrics
      passes.forEach(pass => {
        // Add pass duration to total time
        const passDuration = pass.end.getTime() - pass.start.getTime();
        totalFactoryTime += passDuration;

        // Calculate execution time for percentage
        if (pass.steps && Array.isArray(pass.steps)) {
          pass.steps.forEach(step => {
            const stepDuration = step.end.getTime() - step.start.getTime();

            // Look for the specific "executing" step (exact match or case-insensitive)
            if (step.name.toLowerCase() === 'executing') {
              totalExecutionTime += stepDuration;
            } else {
              totalOtherStepsTime += stepDuration;
            }
          });
        }
      });

      const totalStepsTime = totalExecutionTime + totalOtherStepsTime;
      const executionPercentage = totalStepsTime > 0 ? (totalExecutionTime / totalStepsTime) * 100 : 0;

      // Format the date for display using the dateKey (which is already YYYY-MM-DD)
      const [year, month, day] = dateKey.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const formattedDate = date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });

      acc[dateKey] = {
        totalFactoryTime,
        totalExecutionTime,
        totalOtherStepsTime,
        totalPassCount: passes.length,
        executionPercentage,
        formattedDate
      };

      return acc;
    }, {});
  }, [groupedPasses]);

  const toggleRowExpansion = (index: string) => {
    const newExpandedRows = new Set(expandedRows);
    const isExpanding = !newExpandedRows.has(index);

    if (isExpanding) {
      newExpandedRows.add(index);
    } else {
      newExpandedRows.delete(index);
    }
    setExpandedRows(newExpandedRows);
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

  const getSaveButtonStyles = (passId: string) => {
    const isSaving = savingNotes.has(passId);
    const isSuccess = noteSuccess.has(passId);
    const noteText = noteInputs[passId] || '';
    const existingNotes = passNotes.get(passId) || [];
    const latestNoteText = existingNotes.length > 0 ? existingNotes[0].note_text : '';
    const hasChanges = noteText.trim() !== latestNoteText.trim();

    let backgroundColor = '#3b82f6'; // Default blue
    let cursor = 'pointer';

    if (isSuccess) {
      backgroundColor = '#10b981'; // Success green
      cursor = 'not-allowed';
    } else if (isSaving) {
      backgroundColor = '#9ca3af'; // Loading gray
      cursor = 'not-allowed';
    } else if (!hasChanges) {
      backgroundColor = '#9ca3af'; // Disabled gray
      cursor = 'not-allowed';
    }

    return {
      padding: '6px 8px',
      fontSize: '12px',
      backgroundColor,
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor,
      transition: 'background-color 0.2s'
    };
  };

  const getSaveButtonText = (passId: string) => {
    if (noteSuccess.has(passId)) return 'Saved!';
    if (savingNotes.has(passId)) {
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            border: '2px solid transparent',
            borderTop: '2px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          Saving...
        </span>
      );
    }
    return 'Save note';
  };

  return (
    <div className="appInterface">
      <header className="flex items-center sticky top-0 z-10 mb-4 px-4 py-3 border-b bg-zinc-50 shadow-none md:shadow-xs">
        <div className="w-1/3 h-5 font-semibold text-zinc-900">Sanding history</div>

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
            <div className='flex gap-8'>
              {machineName && (
                <div className="video-store-selector">
                  <div className="video-store-selector-label" style={{ marginBottom: '0.75rem' }}>Machine name</div>
                  <div className="text-sm font-semibold text-zinc-900 py-2">
                    <span style={{
                      backgroundColor: '#f3f3f3',
                      color: 'rgb(37 37 37)',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}>
                      {machineName}
                    </span>
                  </div>
                </div>
              )}

              <VideoStoreSelector
                robotClient={robotClient || null}
                onVideoStoreSelected={setVideoStoreClient}
              />

              <div className="video-store-selector">
                <label htmlFor="camera-select" className="video-store-selector-label">
                  Select camera resource
                </label>
                {cameraComponentNames.length > 0 ? (
                  <select
                    id="camera-select"
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="video-store-selector-select"
                  >
                    <option value="">Select a camera resource</option>
                    {cameraComponentNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <p>
                    No camera resources found.
                  </p>
                )}
              </div>
            </div>

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
                  {Object.entries(groupedPasses).map(([dateKey, passes], dayIndex) => {
                    const {
                      totalFactoryTime,
                      totalExecutionTime,
                      totalOtherStepsTime,
                      totalPassCount,
                      executionPercentage,
                      formattedDate
                    } = dayAggregates[dateKey];

                    return (
                      <React.Fragment key={dateKey}>
                        <tr className="day-summary-header">
                          <td colSpan={9}>
                            <div className="day-summary-content">
                              <div className="day-summary-date">{formattedDate}</div>
                              <div className="day-summary-stats">
                                <div className="day-summary-item">
                                  <span className="day-summary-label">Total Passes</span>
                                  <span className="day-summary-value">{totalPassCount}</span>
                                </div>
                                <div className="day-summary-item">
                                  <span className="day-summary-label">Total Time</span>
                                  <span className="day-summary-value">{formatDurationMs(totalFactoryTime)}</span>
                                </div>
                                <div className="day-summary-item">
                                  <span className="day-summary-label">Executing Time</span>
                                  <span className="day-summary-value">{formatDurationMs(totalExecutionTime)}</span>
                                </div>
                                <div className="day-summary-item">
                                  <span className="day-summary-label">Other Steps Time</span>
                                  <span className="day-summary-value">{formatDurationMs(totalOtherStepsTime)}</span>
                                </div>
                                <div className="day-summary-item">
                                  <span className="day-summary-label">Execution %</span>
                                  <span className="day-summary-value">{executionPercentage.toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {passes.map((pass: Pass, passIndex: number) => {
                          const globalIndex = `${dayIndex}-${passIndex}`;
                          const passId = pass.pass_id;
                          const passNotesData = passNotes.get(passId) || [];

                          return (
                            <React.Fragment key={pass.pass_id || globalIndex}>
                              <tr className="expandable-row"
                                onClick={() => toggleRowExpansion(globalIndex)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleRowExpansion(globalIndex);
                                  }
                                }}
                                aria-expanded={expandedRows.has(globalIndex)}
                                aria-label={`${expandedRows.has(globalIndex) ? 'Collapse' : 'Expand'} details for pass from ${pass.start.toLocaleTimeString()}`}>
                                <td>
                                  <span className={`expand-icon ${expandedRows.has(globalIndex) ? 'expanded' : ''}`} aria-hidden="true">
                                    ▶
                                  </span>
                                </td>
                                <td className="text-zinc-700">{pass.start.toLocaleDateString()}</td>
                                <td className="text-zinc-700 text-xs">
                                  {pass.pass_id ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <button
                                        onClick={() => navigator.clipboard.writeText(pass.pass_id)}
                                        className="hover:bg-blue-100 hover:text-blue-700 px-1 py-0.5 rounded cursor-pointer transition-colors"
                                        title={`Click to copy full pass ID: ${pass.pass_id}`}
                                      >
                                        {pass.pass_id.substring(0, 8)}
                                      </button>
                                      {passNotesData.length > 0 && passNotesData[0].note_text.trim() && (
                                        <span
                                          style={{
                                            fontSize: '18px',
                                            display: 'flex',
                                            alignItems: 'center'
                                          }}
                                          title="This pass has notes"
                                        >
                                          📝
                                        </span>
                                      )}
                                    </div>
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
                              </tr>{expandedRows.has(globalIndex) && (
                                <tr className="expanded-content">
                                  <td colSpan={9}>
                                    <div className="pass-details">
                                      {/* Build information section moved inside expanded row */}
                                      {pass.build_info && (
                                        <div className="build-info-section">
                                          <h4>Build information</h4>
                                          {(pass.build_info.version || pass.build_info.git_revision || pass.build_info.date_compiled) ? (
                                            <div className="build-info-grid">
                                              {/* Version */}
                                              {pass.build_info.version && (
                                                <div className="build-info-item">
                                                  <span className="build-info-label">Version</span>
                                                  <span className="build-info-value">{pass.build_info.version}</span>
                                                </div>
                                              )}

                                              {/* Git Revision */}
                                              {pass.build_info.git_revision && (
                                                <div className="build-info-item">
                                                  <span className="build-info-label">Git revision</span>
                                                  <span className="build-info-value">{pass.build_info.git_revision}</span>
                                                </div>
                                              )}

                                              {/* Date Compiled */}
                                              {pass.build_info.date_compiled && (
                                                <div className="build-info-item">
                                                  <span className="build-info-label">Date compiled</span>
                                                  <span className="build-info-value">{pass.build_info.date_compiled}</span>
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="build-info-notice">
                                              Build information not available for this run.
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      <div className="passes-container">
                                        <div className="steps-grid">
                                          {/* Camera Images */}
                                          {selectedCamera && (() => {
                                            const { beforeImage, afterImage } = passImages(pass);
                                            const passStart = pass.start;
                                            const passEnd = pass.end;

                                            // If no images at all, show a message
                                            if (!beforeImage && !afterImage) {
                                              return (
                                                <div className="step-card" style={{ order: 0 }}>
                                                  <div style={{
                                                    display: 'flex',
                                                    height: '100%',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: '#f3f4f6',
                                                    borderRadius: '4px',
                                                    padding: '12px',
                                                    color: '#9ca3af',
                                                    fontSize: '14px'
                                                  }}>
                                                    No images captured during this pass
                                                  </div>
                                                </div>
                                              );
                                            }

                                            return (
                                              <>
                                                {/* Start Image */}
                                                {beforeImage && (
                                                  <div className="step-card" style={{ order: -1 }}>
                                                    <div className="step-name">Start Image</div>
                                                    <div className="step-duration">
                                                      {beforeImage.metadata?.timeRequested?.toDate().toLocaleTimeString()}
                                                      <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                                                        ({formatTimeDifference(
                                                          beforeImage.metadata?.timeRequested?.toDate()?.getTime() || passStart.getTime(),
                                                          passStart.getTime()
                                                        )} from start)
                                                      </span>
                                                    </div>

                                                    <div
                                                      className="step-image-container clickable-image"
                                                      style={{ marginTop: "12px", width: "100%", overflow: "hidden" }}
                                                      onClick={() => openBeforeAfterModal(beforeImage, afterImage)}
                                                    >
                                                      <ImageDisplay binaryData={beforeImage} viamClient={viamClient} />
                                                    </div>
                                                  </div>
                                                )}

                                                {/* End Image */}
                                                {afterImage && afterImage !== beforeImage && (
                                                  <div className="step-card" style={{ order: 999 }}>
                                                    <div className="step-name">End Image</div>
                                                    <div className="step-duration">
                                                      {afterImage.metadata?.timeRequested?.toDate().toLocaleTimeString()}
                                                      <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                                                        ({formatTimeDifference(
                                                          passEnd.getTime(),
                                                          afterImage.metadata?.timeRequested?.toDate()?.getTime() || passEnd.getTime()
                                                        )} before end)
                                                      </span>
                                                    </div>

                                                    <div
                                                      className="step-image-container clickable-image"
                                                      style={{ marginTop: "12px", width: "100%", overflow: "hidden" }}
                                                      onClick={() => openBeforeAfterModal(beforeImage, afterImage)}
                                                    >
                                                      <ImageDisplay binaryData={afterImage} viamClient={viamClient} />
                                                    </div>
                                                  </div>
                                                )}
                                              </>
                                            );
                                          })()}

                                          {/* Regular step cards */}
                                          {pass.steps.map((step: Step) => {
                                            const stepVideos = getStepVideos(step, videoFiles);

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
                                        </div>

                                        {/* Parent container for Files and Notes columns */}
                                        <div style={{ display: 'flex', margin: '10px 3px 0 0' }}>
                                          {/* Column 1: Files captured during this pass */}
                                          <div style={{ flex: '2 1 0%', minWidth: 0 }}>
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
                                                                padding: '6px 8px',
                                                                backgroundColor: '#3b82f6',
                                                                color: 'white',
                                                                borderRadius: '4px',
                                                                textDecoration: 'none',
                                                                fontSize: '12px',
                                                                whiteSpace: 'nowrap',
                                                                transition: 'background-color 0.2s',
                                                                flexShrink: 0,
                                                                cursor: 'pointer',
                                                                display: 'inline-block',
                                                                border: 'none'
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

                                          {/* Column 2: Pass Notes */}
                                          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                                            {fetchingNotes && passNotesData.length === 0 ? (
                                              <div className="pass-notes-section">
                                                <label className="flex pass-notes-label">
                                                  <h4>Pass notes</h4>
                                                </label>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                                                  <span style={{
                                                    display: 'inline-block',
                                                    width: '24px',
                                                    height: '24px',
                                                    border: '3px solid rgba(59, 130, 246, 0.2)',
                                                    borderTopColor: '#3b82f6',
                                                    borderRadius: '50%',
                                                    animation: 'spin 1s linear infinite'
                                                  }}></span>
                                                  <span style={{ marginLeft: '12px', color: '#6b7280' }}>Loading notes...</span>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="pass-notes-section">
                                                <label htmlFor={`pass-notes-${passId}`} className="pass-notes-label">
                                                  <h4>Pass notes</h4>
                                                </label>

                                                <textarea
                                                  id={`pass-notes-${passId}`}
                                                  className="notes-textarea"
                                                  value={noteInputs[passId] || ''}
                                                  onChange={(e) => handleNoteChange(passId, e.target.value)}
                                                  placeholder="Add a note for this pass..."
                                                  style={{
                                                    width: '100%',
                                                    minHeight: '300px',
                                                    padding: '12px',
                                                    fontSize: '14px',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '3px',
                                                    resize: 'vertical',
                                                    fontFamily: 'inherit',
                                                    backgroundColor: '#ffffff',
                                                    boxSizing: 'border-box'
                                                  }}
                                                  aria-label={`Notes for pass ${passId}`}
                                                  aria-describedby={`pass-notes-help-${passId}`}
                                                />
                                                <div style={{
                                                  display: 'flex',
                                                  justifyContent: 'flex-end',
                                                  marginTop: '4px'
                                                }}>
                                                  <button
                                                    type="button"
                                                    onClick={() => saveNote(passId)}
                                                    disabled={
                                                      savingNotes.has(passId) ||
                                                      noteSuccess.has(passId) ||
                                                      (passNotesData.length > 0
                                                        ? passNotesData[0].note_text === (noteInputs[passId] || '').trim()
                                                        : !(noteInputs[passId] || '').trim())
                                                    }
                                                    style={getSaveButtonStyles(passId)}
                                                    onMouseEnter={(e) => {
                                                      if (!savingNotes.has(passId) && !noteSuccess.has(passId)) {
                                                        e.currentTarget.style.backgroundColor = '#2563eb';
                                                      }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                      if (!savingNotes.has(passId) && !noteSuccess.has(passId)) {
                                                        e.currentTarget.style.backgroundColor = getSaveButtonStyles(passId).backgroundColor;
                                                      }
                                                    }}
                                                  >
                                                    {getSaveButtonText(passId)}
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* Add the modal at the end */}
      {beforeAfterModal && (
        <BeforeAfterModal
          beforeImage={beforeAfterModal.beforeImage}
          afterImage={beforeAfterModal.afterImage}
          onClose={closeBeforeAfterModal}
          viamClient={viamClient}
        />
      )}
    </div>
  );
};

export default AppInterface;