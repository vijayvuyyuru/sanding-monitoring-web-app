import React, { useState } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import './appInterface.css';

interface AppViewProps {
  runData: any;
  videoFiles: VIAM.dataApi.BinaryData[];
  videoStoreClient?: VIAM.GenericComponentClient | null;
  sanderClient: VIAM.GenericComponentClient | null;
}

// Helper to generate dynamic sample data from video files
const generateSampleRunsFromVideos = (videoFiles: VIAM.dataApi.BinaryData[]) => {
  if (!videoFiles || videoFiles.length === 0) {
    return [];
  }

  // Sort videos by time
  const sortedVideos = [...videoFiles].sort((a, b) => {
    const timeA = a.metadata?.timeRequested?.toDate().getTime() || 0;
    const timeB = b.metadata?.timeRequested?.toDate().getTime() || 0;
    return timeA - timeB;
  });

  const runs = [];
  const videosPerRun = Math.max(1, Math.floor(sortedVideos.length / 4));

  for (let i = 0; i < 4; i++) {
    const runVideos = sortedVideos.slice(i * videosPerRun, (i + 1) * videosPerRun);
    if (runVideos.length === 0) continue;

    const firstVideoTime = runVideos[0].metadata!.timeRequested!.toDate();
    const lastVideoTime = runVideos[runVideos.length - 1].metadata!.timeRequested!.toDate();
    
    const runStart = new Date(firstVideoTime.getTime() - 10000); // 10s before first video
    const runEnd = new Date(lastVideoTime.getTime() + 10000); // 10s after last video

    const success = i % 2 === 0;
    const steps = [];
    const stepCount = success ? 3 : 2;
    const timePerStep = (runEnd.getTime() - runStart.getTime()) / stepCount;

    const stepNames = ["Imaging", "GeneratingLobes", "Execution"];

    for (let j = 0; j < stepCount; j++) {
      const stepStart = new Date(runStart.getTime() + j * timePerStep);
      const stepEnd = new Date(runStart.getTime() + (j + 1) * timePerStep);
      steps.push({
        name: stepNames[j],
        start: stepStart.toISOString(),
        end: stepEnd.toISOString(),
      });
    }

    runs.push({
      start: runStart.toISOString(),
      end: runEnd.toISOString(),
      steps: steps,
      success: success,
      pass_id: `generated-pass-${i}`,
      err_string: success ? null : "Generated failure example",
    });
  }
  return runs;
};


const AppInterface: React.FC<AppViewProps> = ({ runData, videoFiles, sanderClient, videoStoreClient }) => {
  const [activeRoute, setActiveRoute] = useState('live');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const expectedSteps = ["Imaging", "GeneratingLobes", "Execution"];

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

  const getStepVideos = (step: { start: string; end:string; }) => {
    if (!videoFiles) return [];

    const stepStart = new Date(step.start);
    const stepEnd = new Date(step.end);

    return videoFiles.filter(file => {
      if (!file.metadata?.timeRequested || !file.metadata?.fileName?.endsWith('.mp4')) return false;
      const fileTime = file.metadata.timeRequested.toDate();
      return fileTime >= stepStart && fileTime <= stepEnd;
    }).sort((a, b) => {
      const timeA = a.metadata!.timeRequested!.toDate().getTime();
      const timeB = b.metadata!.timeRequested!.toDate().getTime();
      return timeA - timeB;
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const ms = end.getTime() - start.getTime();
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
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

  const runsToDisplay = runData?.runs?.length > 0 
    ? runData.runs 
    : generateSampleRunsFromVideos(videoFiles);

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
                      <th>Status</th>
                      <th>Start Time</th>
                      <th>End Time</th>
                      <th>Duration</th>
                      <th>Completed</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runsToDisplay.map((run: any, index: number) => (
                      <React.Fragment key={index}>
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
                          aria-label={`${expandedRows.has(index) ? 'Collapse' : 'Expand'} details for run from ${formatTime(run.start)}`}
                        >
                          <td>
                            <span className={`expand-icon ${expandedRows.has(index) ? 'expanded' : ''}`} aria-hidden="true">
                              ▶
                            </span>
                          </td>
                          <td>{getStatusBadge(run.success)}</td>
                          <td className="text-zinc-700">{formatTime(run.start)}</td>
                          <td className="text-zinc-700">{formatTime(run.end)}</td>
                          <td className="text-zinc-700">{formatDuration(run.start, run.end)}</td>
                          <td className="text-zinc-700">
                            {run.success ? '1 / 1' : '0 / 1'}
                          </td>
                          <td className="text-zinc-700">
                            {run.err_string ? (
                              <span className="text-red-600 text-xs font-mono error-text" title={run.err_string}>
                                {run.err_string}
                              </span>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                        </tr>
                        {expandedRows.has(index) && (
                          <tr className="expanded-content">
                            <td colSpan={7}>
                              <div className="run-details">
                                <div className="passes-container">
                                  <div className="pass-info">
                                    <span className="pass-duration">{formatDuration(run.start, run.end)}</span>
                                  </div>
                                  <div className="steps-grid">
                                    {expectedSteps.map((stepName) => {
                                      const step = run.steps.find((s: any) => s.name === stepName);
                                      if (step) {
                                        const stepVideos = getStepVideos(step);
                                        const firstVideo = stepVideos.length > 0 ? stepVideos[0] : null;
                                        const lastVideo = stepVideos.length > 1 ? stepVideos[stepVideos.length - 1] : (stepVideos.length === 1 ? stepVideos[0] : null);

                                        if (firstVideo) {
                                          console.log(`Step "${step.name}" start video:`, firstVideo.metadata?.uri);
                                        }
                                        if (lastVideo) {
                                          console.log(`Step "${step.name}" end video:`, lastVideo.metadata?.uri);
                                        }

                                        const beforeImage = firstVideo ? (
                                          <a href={firstVideo.metadata?.uri} target="_blank" rel="noopener noreferrer" title={`View video: ${firstVideo.metadata?.fileName}`}>
                                            <div className="placeholder-image before"></div>
                                          </a>
                                        ) : (
                                          <div className="placeholder-image before"></div>
                                        );

                                        const afterImage = lastVideo ? (
                                          <a href={lastVideo.metadata?.uri} target="_blank" rel="noopener noreferrer" title={`View video: ${lastVideo.metadata?.fileName}`}>
                                            <div className="placeholder-image after"></div>
                                          </a>
                                        ) : (
                                          <div className="placeholder-image after"></div>
                                        );

                                        return (
                                          <div key={stepName} className="step-card">
                                            <div className="step-name">{stepName}</div>
                                            <div className="step-timeline">
                                              <div className="step-moment">
                                                {beforeImage}
                                                <div className="step-time">
                                                  <span className="time-label">Start</span>
                                                  <span className="time-value">{formatTime(step.start)}</span>
                                                </div>
                                              </div>
                                              <div className="timeline-arrow">→</div>
                                              <div className="step-moment">
                                                {afterImage}
                                                <div className="step-time">
                                                  <span className="time-label">End</span>
                                                  <span className="time-value">{formatTime(step.end)}</span>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="step-duration">{formatDuration(step.start, step.end)}</div>
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
            <h2>Robot operator</h2>
            <p>Not available yet.</p>
          </section>
        )}
      </main>
    </div>
  );
};

export default AppInterface;