import React from 'react';
import * as VIAM from "@viamrobotics/sdk";
import RunDataDisplay from './RunDataDisplay';

interface MonitoringViewProps {
  runData: any;
  videoFiles: VIAM.dataApi.BinaryData[];
  sanderClient: VIAM.GenericComponentClient | null;
}

const MonitoringView: React.FC<MonitoringViewProps> = ({ runData, videoFiles, sanderClient }) => {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Sanding Monitoring Web App</h1>
      </header>
      
      <main className="main-content">
        <RunDataDisplay runData={runData} videoFiles={videoFiles} sanderClient={sanderClient} />
      </main>
    </div>
  );
};

export default MonitoringView;