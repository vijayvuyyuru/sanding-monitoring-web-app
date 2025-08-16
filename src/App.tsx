import { useEffect, useState } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import MonitoringView from './MonitoringView';
import AppInterface from './AppInterface';
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

interface ReadingStep {
  name: string;
  start: string;
  end: string;
  duration_ms?: number;
}

interface Readings {
  start: string;
  end: string;
  steps: ReadingStep[];
  success: boolean;
  pass_id: string;
  err_string?: string | null;
}

interface RunData {
  success: boolean;
  err_string?: string | null;
  start: string;
  end: string;
  duration_ms: number;
  runs: ReadingStep[][];
  readings?: Readings; // Keep for backward compatibility
}

function App() {
  const [runData, setRunData] = useState<RunData | null>(null);
  const [videoFiles, setVideoFiles] = useState<VIAM.dataApi.BinaryData[]>([]);
  const [sanderClient, setSanderClient] = useState<VIAM.GenericComponentClient | null>(null);
  const [videoStoreClient, setVideoStoreClient] = useState<VIAM.GenericComponentClient | null>(null);

  // Check for showui URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const showUI = urlParams.has('showui');

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

      if (resources.find((x) => (x.type == "component" && x.subtype == "generic" && x.name == "generic-1"))) {
        const videoStoreClient = new VIAM.GenericComponentClient(robotClient, "generic-1");
        setVideoStoreClient(videoStoreClient);
      }
      
      // debugger;
      
      const binaryData = await viamClient.dataClient.binaryDataByFilter( 
        filter, 
        undefined,
        VIAM.dataApi.Order.DESCENDING,
        undefined,
        false,
        false,
        true,
      );
      const filenames = binaryData.data.map((x: VIAM.dataApi.BinaryData) => x);
      setVideoFiles(filenames);

      // Remove example data - components will handle their own data
    };
    
    fetchData();
  }, []);

  // Render different UI based on showui parameter
  if (showUI) {
    return <AppInterface videoStoreClient={videoStoreClient} runData={runData} videoFiles={videoFiles} sanderClient={sanderClient} />;
  }

  // Default monitoring interface
  return <MonitoringView videoStoreClient={videoStoreClient} runData={runData} videoFiles={videoFiles} sanderClient={sanderClient} />;
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
