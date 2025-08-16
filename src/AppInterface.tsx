import React, { useState } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import './appInterface.css';

interface AppViewProps {
  runData: any;
  videoFiles: VIAM.dataApi.BinaryData[];
  videoStoreClient?: VIAM.GenericComponentClient | null;
  sanderClient: VIAM.GenericComponentClient | null;
}

// Sample data for the runs table - updated to match new JSON structure
const sampleRunsData = [
  {
    "start": "2025-01-21T20:45:00.000Z",
    "end": "2025-01-21T21:15:00.000Z",
    "steps": [
      {
        "start": "2025-01-21T20:45:00.000Z",
        "end": "2025-01-21T20:47:00.000Z",
        "name": "Imaging"
      },
      {
        "start": "2025-01-21T20:47:00.000Z",
        "end": "2025-01-21T20:50:00.000Z",
        "name": "GeneratingLobes"
      },
      {
        "start": "2025-01-21T20:50:00.000Z",
        "end": "2025-01-21T21:15:00.000Z",
        "name": "Execution"
      }
    ],
    "success": true,
    "pass_id": "a1b2c3d4-5e6f-7890-abcd-ef1234567890",
    "err_string": null
  },
  {
    "start": "2025-01-21T21:20:00.000Z",
    "end": "2025-01-21T21:32:00.000Z",
    "steps": [
      {
        "start": "2025-01-21T21:20:00.000Z",
        "end": "2025-01-21T21:22:00.000Z",
        "name": "Imaging"
      },
      {
        "start": "2025-01-21T21:22:00.000Z",
        "end": "2025-01-21T21:25:00.000Z",
        "name": "GeneratingLobes"
      }
    ],
    "success": false,
    "pass_id": "b2c3d4e5-6f78-9012-bcde-f23456789012",
    "err_string": "rpc error: code = Unavailable desc = not connected to remote robot"
  },
  {
    "start": "2025-01-21T19:30:00.000Z",
    "end": "2025-01-21T19:48:00.000Z",
    "steps": [
      {
        "start": "2025-01-21T19:30:00.000Z",
        "end": "2025-01-21T19:32:00.000Z",
        "name": "Imaging"
      },
      {
        "start": "2025-01-21T19:32:00.000Z",
        "end": "2025-01-21T19:35:00.000Z",
        "name": "GeneratingLobes"
      },
      {
        "start": "2025-01-21T19:35:00.000Z",
        "end": "2025-01-21T19:48:00.000Z",
        "name": "Execution"
      }
    ],
    "success": true,
    "pass_id": "c3d4e5f6-7890-1234-cdef-345678901234",
    "err_string": null
  },
  {
    "start": "2025-01-21T18:15:00.000Z",
    "end": "2025-01-21T18:25:00.000Z",
    "steps": [
      {
        "start": "2025-01-21T18:15:00.000Z",
        "end": "2025-01-21T18:17:00.000Z",
        "name": "Imaging"
      },
      {
        "start": "2025-01-21T18:17:00.000Z",
        "end": "2025-01-21T18:25:00.000Z",
        "name": "GeneratingLobes"
      }
    ],
    "success": false,
    "pass_id": "d4e5f6a7-8901-2345-defa-456789012345",
    "err_string": "generating lobes failed: rpc error: code = Unknown desc = getting inputs failed: No points found in region of interest after filtering"
  }
];

const exampleRunData = {
  readings: {
    start: "2025-08-15T18:34:13.877418758Z",
    end: "2025-08-15T18:34:15.497700711Z",
    steps: [
      {
        start: "2025-08-15T18:34:13.877418758Z",
        end: "2025-08-15T18:34:13.877696724Z",
        name: "Imaging",
      },
      {
        start: "2025-08-15T18:34:13.877696794Z",
        end: "2025-08-15T18:34:15.497700711Z",
        name: "GeneratingLobes",
      },
    ],
    success: false,
    pass_id: "d0e0fc7c-9b8f-4706-abfb-96c6c517bcac",
    err_string:
      "generating lobes failed: rpc error: code = Unknown desc = getting inputs failed: No points found in region of interest after filtering",
  },
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

  const displayData = runData || exampleRunData;

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
                    {sampleRunsData.map((run, index) => (
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
                                        return (
                                          <div key={stepName} className="step-card">
                                            <div className="step-name">{stepName}</div>
                                            <div className="step-timeline">
                                              <div className="step-time">
                                                <span className="time-label">Start</span>
                                                <span className="time-value">{formatTime(step.start)}</span>
                                              </div>
                                              <div className="timeline-arrow">→</div>
                                              <div className="step-time">
                                                <span className="time-label">End</span>
                                                <span className="time-value">{formatTime(step.end)}</span>
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