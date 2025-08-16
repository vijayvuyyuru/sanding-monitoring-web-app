import React from 'react';
import * as VIAM from "@viamrobotics/sdk";
import RunDataDisplay from './RunDataDisplay';

interface MonitoringViewProps {
  runData: any;
  videoFiles: VIAM.dataApi.BinaryData[];
  videoStoreClient?: VIAM.GenericComponentClient | null;
  sanderClient: VIAM.GenericComponentClient | null;
}

const MonitoringView: React.FC<MonitoringViewProps> = ({ runData, videoFiles, sanderClient, videoStoreClient }) => {
  // Use provided runData or fallback to example data
  const exampleRunData = {
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
  };

  const displayData = runData || exampleRunData;

  return (
    <div className="App">
      <header className="App-header">
        <h1>Sanding Monitoring Web App</h1>
      </header>
      
      <main className="main-content">
        <RunDataDisplay videoStoreClient={videoStoreClient} runData={displayData} videoFiles={videoFiles} sanderClient={sanderClient} />
      </main>
    </div>
  );
};

export default MonitoringView;