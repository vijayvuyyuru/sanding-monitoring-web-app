import { useEffect, useState } from 'react';
import './App.css';
import * as VIAM from "@viamrobotics/sdk";
import RunDataDisplay from './RunDataDisplay';
import Cookies from "js-cookie";

/*
TODO:
- detect if there is a sanding resource
    - if so show a button to stat sanding
    - if not, show a warning that there is no sanding resource
- detect if there is a video-store resource
    - if so show request a video from the past 1 minute and show the video
- display runtime start and end and the length of each substep
- add pagination

*/

interface RunStep {
  name: string;
  start: string;
  end: string;
  duration_ms: number;
}

interface RunData {
  success: boolean;
  err_string?: string;
  start: string;
  end: string;
  duration_ms: number;
  runs: RunStep[][];
}

function App() {
  const [runData, setRunData] = useState<RunData | null>(null);
  const [videoFiles, setVideoFiles] = useState<VIAM.dataApi.BinaryData[]>([]);
  const [sanderClient, setSanderClient] = useState<VIAM.GenericComponentClient | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const machineInfo = window.location.pathname.split("/")[2];
      let apiKeyId: string;
      let apiKeySecret: string;
      let machineId: string;
      let hostname: string;

      ({
        apiKey: { id: apiKeyId, key: apiKeySecret },
        machineId: machineId,
        hostname: hostname,
      } = JSON.parse(Cookies.get(machineInfo)!));
      
      let filter = {
        robotId: machineId,
      } as VIAM.dataApi.Filter;
      
      const viamClient = await connect(apiKeyId, apiKeySecret);
      const robotClient = await viamClient.connectToMachine({host: hostname, id: machineId});
      const resources = await robotClient.resourceNames();
      
      if (resources.find((x) => (x.type == "service" && x.subtype == "generic" && x.name == "sander-module"))) {
        const sanderClient = new VIAM.GenericComponentClient(robotClient, "sander-module");
        setSanderClient(sanderClient);
      }
      
      const binaryData = await viamClient.dataClient.binaryDataByFilter( 
        filter, 
        undefined,
        VIAM.dataApi.Order.DESCENDING,
        undefined,
        false,
        false,
        false,
      );
      const filenames = binaryData.data.map((x: VIAM.dataApi.BinaryData) => x);
      setVideoFiles(filenames);

      const exampleRunData: RunData = {
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
      setRunData(exampleRunData);
    };
    
    fetchData();
  }, []);

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
}

async function connect(apiKeyId: string, apiKeySecret: string): Promise<VIAM.ViamClient> {
  const opts: VIAM.ViamClientOptions = {
    serviceHost: "https://app.viam.com",
    credentials: {
      type: "api-key",
      authEntity: apiKeyId,
      payload: apiKeySecret,
    },
  };

  return await VIAM.createViamClient(opts);
}

export default App;
