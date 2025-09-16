import React, { useState } from 'react';
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
  videoFiles,
  robotClient,
  fetchVideos,
  fetchTimestamp,
}) => {
  const [activeRoute, setActiveRoute] = useState('live');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [videoStoreClient, setVideoStoreClient] = useState<VIAM.GenericComponentClient | null>(null);

  const activeTabStyle = "bg-blue-600 text-white";
  const inactiveTabStyle = "bg-gray-200 text-gray-700 hover:bg-gray-300";

  const groupedPasses = passSummaries.reduce((acc: Record<string, Pass[]>, pass) => {
    const dateKey = pass.start.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(pass);
    return acc;
  }, {});

  // Helper function to format duration from milliseconds
  const formatDurationMs = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

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
                  {Object.entries(groupedPasses).map(([date, passes], dayIndex) => {
                    // Calculate totals for this day
                    let totalExecutionTime = 0;
                    let totalOtherStepsTime = 0;
                    let totalPassCount = passes.length;

                    passes.forEach(pass => {
                      pass.steps.forEach(step => {
                        const stepDuration = step.end.getTime() - step.start.getTime();
                        
                        // More precise execution step detection
                        if (step.name.toLowerCase() === 'executing') {
                          totalExecutionTime += stepDuration;
                        } else {
                          totalOtherStepsTime += stepDuration;
                        }
                      });
                    });

                    const totalStepsTime = totalExecutionTime + totalOtherStepsTime;
                    const executionPercentage = totalStepsTime > 0 ? (totalExecutionTime / totalStepsTime) * 100 : 0;

                    return (
                      <React.Fragment key={date}>
                        <tr className="day-summary-header">
                          <td colSpan={9}>
                            <div className="day-summary-content">
                              <div className="day-summary-date">{date}</div>
                              <div className="day-summary-stats">
                                <div className="day-summary-item">
                                  <span className="day-summary-label">Total Passes</span>
                                  <span className="day-summary-value">{totalPassCount}</span>
                                </div>
                                <div className="day-summary-item">
                                  <span className="day-summary-label">Execution Time</span>
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
                          // Create unique index for each pass across all days
                          const globalIndex = `${dayIndex}-${passIndex}`;
                          
                          return (
                            <React.Fragment key={pass.pass_id || globalIndex}>
                              <tr 
                                className="expandable-row"
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
                                aria-label={`${expandedRows.has(globalIndex) ? 'Collapse' : 'Expand'} details for pass from ${pass.start.toLocaleTimeString()}`}
                              >
                                <td>
                                  <span className={`expand-icon ${expandedRows.has(globalIndex) ? 'expanded' : ''}`} aria-hidden="true">
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
                              {expandedRows.has(globalIndex) && (
                                <tr className="expanded-content">
                                  <td colSpan={9}>
                                    <div className="pass-details">
                                      <div className="build-info-section">
                                        <h4>Build information</h4>
                                        {pass.build_info && (pass.build_info.version || pass.build_info.git_revision || pass.build_info.date_compiled) ? (
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
    </div>
  );
};

export default AppInterface;