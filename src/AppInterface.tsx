import React, { useState } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import './appInterface.css';

interface AppViewProps {
  runData: any;
  videoFiles: VIAM.dataApi.BinaryData[];
  videoStoreClient?: VIAM.GenericComponentClient | null;
  sanderClient: VIAM.GenericComponentClient | null;
}

// Sample data for the runs table - updated to show passes concept
const sampleRunsData = [
  {
    "success": true,
    "err_string": null,
    "start": "2025-01-21T20:45:00.000Z",
    "end": "2025-01-21T21:15:00.000Z",
    "duration_ms": 1800000,
    "passes": [
      {
        "pass_number": 1,
        "success": true,
        "start": "2025-01-21T20:45:00.000Z",
        "end": "2025-01-21T20:55:00.000Z",
        "duration_ms": 600000,
        "steps": [
          {
            "name": "Imaging",
            "start": "2025-01-21T20:45:00.000Z",
            "end": "2025-01-21T20:47:00.000Z",
            "duration_ms": 120000
          },
          {
            "name": "Planning",
            "start": "2025-01-21T20:47:00.000Z",
            "end": "2025-01-21T20:50:00.000Z",
            "duration_ms": 180000
          },
          {
            "name": "Execution",
            "start": "2025-01-21T20:50:00.000Z",
            "end": "2025-01-21T20:55:00.000Z",
            "duration_ms": 300000
          }
        ]
      }
    ]
  },
  {
    "success": false,
    "err_string": "rpc error: code = Unavailable desc = not connected to remote robot",
    "start": "2025-01-21T21:20:00.000Z",
    "end": "2025-01-21T21:32:00.000Z",
    "duration_ms": 720000,
    "passes": [
      {
        "pass_number": 1,
        "success": false,
        "start": "2025-01-21T21:20:00.000Z",
        "end": "2025-01-21T21:32:00.000Z",
        "duration_ms": 720000,
        "steps": [
          {
            "name": "Imaging",
            "start": "2025-01-21T21:20:00.000Z",
            "end": "2025-01-21T21:22:00.000Z",
            "duration_ms": 120000
          },
          {
            "name": "Planning",
            "start": "2025-01-21T21:22:00.000Z",
            "end": "2025-01-21T21:25:00.000Z",
            "duration_ms": 180000
          },
          {
            "name": "Execution",
            "start": "2025-01-21T21:25:00.000Z",
            "end": "2025-01-21T21:32:00.000Z",
            "duration_ms": 420000
          }
        ]
      }
    ]
  },
  {
    "success": true,
    "err_string": null,
    "start": "2025-01-21T19:30:00.000Z",
    "end": "2025-01-21T19:48:00.000Z",
    "duration_ms": 1080000,
    "passes": [
      {
        "pass_number": 1,
        "success": true,
        "start": "2025-01-21T19:30:00.000Z",
        "end": "2025-01-21T19:48:00.000Z",
        "duration_ms": 1080000,
        "steps": [
          {
            "name": "Imaging",
            "start": "2025-01-21T19:30:00.000Z",
            "end": "2025-01-21T19:32:00.000Z",
            "duration_ms": 120000
          },
          {
            "name": "Planning",
            "start": "2025-01-21T19:32:00.000Z",
            "end": "2025-01-21T19:35:00.000Z",
            "duration_ms": 180000
          },
          {
            "name": "Execution",
            "start": "2025-01-21T19:35:00.000Z",
            "end": "2025-01-21T19:48:00.000Z",
            "duration_ms": 780000
          }
        ]
      }
    ]
  },
  {
    "success": false,
    "err_string": "timeout error: operation exceeded maximum duration",
    "start": "2025-01-21T18:15:00.000Z",
    "end": "2025-01-21T18:25:00.000Z",
    "duration_ms": 600000,
    "passes": [
      {
        "pass_number": 1,
        "success": false,
        "start": "2025-01-21T18:15:00.000Z",
        "end": "2025-01-21T18:25:00.000Z",
        "duration_ms": 600000,
        "steps": [
          {
            "name": "Imaging",
            "start": "2025-01-21T18:15:00.000Z",
            "end": "2025-01-21T18:17:00.000Z",
            "duration_ms": 120000
          },
          {
            "name": "Planning",
            "start": "2025-01-21T18:17:00.000Z",
            "end": "2025-01-21T18:25:00.000Z",
            "duration_ms": 480000
          }
        ]
      }
    ]
  }
];

const AppInterface: React.FC<AppViewProps> = ({ runData, videoFiles, sanderClient, videoStoreClient }) => {
  const [activeRoute, setActiveRoute] = useState('live');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

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

  const formatDuration = (ms: number) => {
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
                          <td className="text-zinc-700">{formatDuration(run.duration_ms)}</td>
                          <td className="text-zinc-700">
                            {run.passes.filter(pass => pass.success).length} / {run.passes.length}
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
                                {/* Steps header - shown once above all passes */}
                                <div className="steps-header-container">
                                  <div className="pass-header-spacer"></div>
                                  <div className="steps-header">
                                    <div className='step-spacer'></div>
                                    <div className="step-header-label">Imaging</div>
                                    <div className="step-header-label">Planning</div>
                                    <div className="step-header-label">Execution</div>
                                  </div>
                                </div>
                                
                                <div className="passes-container">
                                  {run.passes.map((pass, passIndex) => (
                                    <div key={passIndex} className="pass-section">
                                      <div className="pass-header">
                                        <span className="pass-duration">{formatDuration(pass.duration_ms)}</span>
                                      </div>
                                      <div className="steps-row">
                                        {pass.steps.map((step, stepIndex) => (
                                          <div key={stepIndex} className="step-inline">
                                            <div className="step-content">
                                              <div className="step-timeline">
                                                <div className="step-moment">
                                                  <div className="placeholder-image before"></div>
                                                  <div className="step-time">
                                                    <span className="time-label">Start</span>
                                                    <span className="time-value">{formatTime(step.start)}</span>
                                                  </div>
                                                </div>
                                                
                                                <div className="timeline-arrow">→</div>
                                                
                                                <div className="step-moment">
                                                  <div className="placeholder-image after"></div>
                                                  <div className="step-time">
                                                    <span className="time-label">End</span>
                                                    <span className="time-value">{formatTime(step.end)}</span>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="step-duration-inline">{formatDuration(step.duration_ms)}</div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
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