import { useEffect, useState } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import AppInterface from './AppInterface';
import Cookies from "js-cookie";
import { JsonValue } from '@viamrobotics/sdk';

/*
TODO:
- detect if there is a sanding resource
    - if so show a button to start sanding
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
  readings?: Readings; 
}

function App() {
  const [runData, setRunData] = useState<RunData | null>(null);
  const [videoFiles, setVideoFiles] = useState<VIAM.dataApi.BinaryData[]>([]);
  const [sanderClient, setSanderClient] = useState<VIAM.GenericComponentClient | null>(null);
  const [videoStoreClient, setVideoStoreClient] = useState<VIAM.GenericComponentClient | null>(null);
  const [robotClient, setRobotClient] = useState<VIAM.RobotClient | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const machineInfo = window.location.pathname.split("/")[2];
      let apiKeyId: string;
      let apiKeySecret: string;
      let machineId: string;
      let hostname: string;

      const foo = ({
        apiKey: { id: apiKeyId, key: apiKeySecret },
        machineId: machineId,
        hostname: hostname,
      } = JSON.parse(Cookies.get(machineInfo)!));
      
      let filter = {
        robotId: machineId,
      } as VIAM.dataApi.Filter;
      
      const viamClient = await connect(apiKeyId, apiKeySecret);
      const robotClient = await viamClient.connectToMachine({host: hostname, id: machineId});
      setRobotClient(robotClient); // Store the robot client
      const resources = await robotClient.resourceNames();

      // debugger;

      // Check for sander module resource
      if (resources.find((x) => (x.type == "service" && x.subtype == "generic" && x.name == "sander-module"))) {
        const sanderClient = new VIAM.GenericComponentClient(robotClient, "sander-module");
        setSanderClient(sanderClient);
        // TODO: Add visual indication that sander resource is available
      } else {
        // TODO: Show warning that there is no sanding resource
        console.warn("No sander-module resource found");
      }

      // Check for video-store resource
      if (resources.find((x) => (x.type == "component" && x.subtype == "generic" && x.name == "generic-1"))) {
        const videoStoreClient = new VIAM.GenericComponentClient(robotClient, "generic-1");
        setVideoStoreClient(videoStoreClient);
        // TODO: Request a video from the past 1 minute and show the video
      } else {
        console.warn("No video-store resource found");
      }
      
      // Fetch binary data (video files)
      const binaryData = await viamClient.dataClient.binaryDataByFilter( 
        filter, 
        undefined,
        VIAM.dataApi.Order.DESCENDING,
        undefined,
        false,
        false,
        true, // Include metadata
      );
      const filenames = binaryData.data.map((x: VIAM.dataApi.BinaryData) => x);
      setVideoFiles(filenames);

      const organizations = await viamClient.appClient.listOrganizations();
      console.log("Organizations:", organizations);

      const mqlQuery: Record<string, JsonValue>[] = [
        {
          $match: {
            component_name: "sanding-summary",
          },
        },
        {
          $sort: {
            time_received: -1,
          },
        }
      ];

        const tabluarData = await viamClient.dataClient.tabularDataByMQL(organizations[0].id, mqlQuery);

        console.log("Tabular Data:", tabluarData);

        // TODO: Fetch and display runtime start/end and substep durations
        // TODO: Implement pagination for large datasets
      };
      
      fetchData();
  }, []);

  return (
    <AppInterface 
      runData={runData}
      videoFiles={videoFiles}
      sanderClient={sanderClient!}
      videoStoreClient={videoStoreClient}
      robotClient={robotClient}
    />
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
