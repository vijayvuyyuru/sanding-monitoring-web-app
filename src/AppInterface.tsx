import React, { useState } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import './appInterface.css';

interface AppViewProps {
  runData: any;
  videoFiles: VIAM.dataApi.BinaryData[];
  videoStoreClient?: VIAM.GenericComponentClient | null;
  sanderClient: VIAM.GenericComponentClient | null;
}

// Sample data for the runs table
const sampleRunsData = [
  {
    "success": true,
    "err_string": null,
    "start": "2025-01-21T20:45:00.000Z",
    "end": "2025-01-21T21:05:00.000Z",
    "duration_ms": 1200000,
    "runs": [
      [
        {
          "name": "Imaging",
          "start": "2025-01-21T20:45:00.000Z",
          "end": "2025-01-21T20:48:00.000Z",
          "duration_ms": 180000
        },
        {
          "name": "GenerateLobes",
          "start": "2025-01-21T20:48:00.000Z",
          "end": "2025-01-21T20:52:00.000Z",
          "duration_ms": 240000
        },
        {
          "name": "GenerateWaypoints",
          "start": "2025-01-21T20:52:00.000Z",
          "end": "2025-01-21T21:02:00.000Z",
          "duration_ms": 600000
        },
        {
          "name": "Execute",
          "start": "2025-01-21T21:02:00.000Z",
          "end": "2025-01-21T21:05:00.000Z",
          "duration_ms": 180000
        }
      ]
    ]
  },
  {
    "success": false,
    "err_string": "rpc error: code = Unavailable desc = not connected to remote robot",
    "start": "2025-01-21T21:11:00.000Z",
    "end": "2025-01-21T21:32:00.000Z",
    "duration_ms": 1260000,
    "runs": [
      [
        {
          "name": "Imaging",
          "start": "2025-01-21T21:11:00.000Z",
          "end": "2025-01-21T21:15:00.000Z",
          "duration_ms": 240000
        },
        {
          "name": "GenerateLobes",
          "start": "2025-01-21T21:15:00.000Z",
          "end": "2025-01-21T21:20:00.000Z",
          "duration_ms": 300000
        },
        {
          "name": "GenerateWaypoints",
          "start": "2025-01-21T21:20:00.000Z",
          "end": "2025-01-21T21:30:00.000Z",
          "duration_ms": 600000
        },
        {
          "name": "Execute",
          "start": "2025-01-21T21:30:00.000Z",
          "end": "2025-01-21T21:32:00.000Z",
          "duration_ms": 120000
        }
      ]
    ]
  },
  {
    "success": true,
    "err_string": null,
    "start": "2025-01-21T19:30:00.000Z",
    "end": "2025-01-21T19:48:00.000Z",
    "duration_ms": 1080000,
    "runs": [
      [
        {
          "name": "Imaging",
          "start": "2025-01-21T19:30:00.000Z",
          "end": "2025-01-21T19:33:00.000Z",
          "duration_ms": 180000
        },
        {
          "name": "GenerateLobes",
          "start": "2025-01-21T19:33:00.000Z",
          "end": "2025-01-21T19:37:00.000Z",
          "duration_ms": 240000
        },
        {
          "name": "GenerateWaypoints",
          "start": "2025-01-21T19:37:00.000Z",
          "end": "2025-01-21T19:45:00.000Z",
          "duration_ms": 480000
        },
        {
          "name": "Execute",
          "start": "2025-01-21T19:45:00.000Z",
          "end": "2025-01-21T19:48:00.000Z",
          "duration_ms": 180000
        }
      ]
    ]
  },
  {
    "success": false,
    "err_string": "timeout error: operation exceeded maximum duration",
    "start": "2025-01-21T18:15:00.000Z",
    "end": "2025-01-21T18:35:00.000Z",
    "duration_ms": 1200000,
    "runs": [
      [
        {
          "name": "Imaging",
          "start": "2025-01-21T18:15:00.000Z",
          "end": "2025-01-21T18:18:00.000Z",
          "duration_ms": 180000
        },
        {
          "name": "GenerateLobes",
          "start": "2025-01-21T18:18:00.000Z",
          "end": "2025-01-21T18:22:00.000Z",
          "duration_ms": 240000
        },
        {
          "name": "GenerateWaypoints",
          "start": "2025-01-21T18:22:00.000Z",
          "end": "2025-01-21T18:35:00.000Z",
          "duration_ms": 780000
        }
      ]
    ]
  }
];

const AppInterface: React.FC<AppViewProps> = ({ runData, videoFiles, sanderClient, videoStoreClient }) => {
  const [activeRoute, setActiveRoute] = useState('live');

  const activeTabStyle = "bg-blue-600 text-white";
  const inactiveTabStyle = "bg-gray-200 text-gray-700 hover:bg-gray-300";

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
        <span className="inline-flex items-center justify-center py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 status-badge-width">
          Success
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center justify-center py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 status-badge-width">
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
              Latest run summary
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
              <h2 className="text-xl font-semibold text-zinc-900 mb-4">Latest runs</h2>
              
              <div className="viam-table-container">
                <table className="viam-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Start Time</th>
                      <th>Duration</th>
                      <th>Steps Completed</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRunsData.map((run, index) => (
                      <tr key={index}>
                        <td className="moveleft">{getStatusBadge(run.success)}</td>
                        <td className="text-zinc-700">{formatTime(run.start)}</td>
                        <td className="text-zinc-700">{formatDuration(run.duration_ms)}</td>
                        <td className="text-zinc-700">
                          {run.runs[0]?.length || 0} / 4
                        </td>
                        <td className="text-zinc-700">
                          {run.err_string ? (
                            <span className="text-red-600 text-xs font-mono error-text" title={run.err_string}>
                              {run.err_string}
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                      </tr>
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