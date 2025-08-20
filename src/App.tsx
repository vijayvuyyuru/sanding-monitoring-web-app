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
  const [passSummaries, setPassSummaries] = useState<Readings[]>([]); // Add state for pass summaries
  const [videoFiles, setVideoFiles] = useState<VIAM.dataApi.BinaryData[]>([]);
  const [sanderClient, setSanderClient] = useState<VIAM.GenericComponentClient | null>(null);
  const [videoStoreClient, setVideoStoreClient] = useState<VIAM.GenericComponentClient | null>(null);
  const [robotClient, setRobotClient] = useState<VIAM.RobotClient | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const machineInfo = window.location.pathname.split("/")[2];
      
      const {
        apiKey: { id: apiKeyId, key: apiKeySecret },
        machineId,
        hostname,
      } = JSON.parse(Cookies.get(machineInfo)!);

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
      
      const organizations = await viamClient.appClient.listOrganizations();
      console.log("Organizations:", organizations);

      const mqlQuery: Record<string, JsonValue>[] = [
        {
          $match: {
            component_name: "sanding-summary",
            robot_id: machineId // Filter by current robot
          },
        },
        {
          $sort: {
            time_received: -1,
          },
        },
        {
          $limit: 50 // Get last 50 passes
        }
      ];

      const tabularData = await viamClient.dataClient.tabularDataByMQL(organizations[0].id, mqlQuery);
      console.log("Tabular Data:", tabularData);

      // Process tabular data into pass summaries
      const processedPasses: Readings[] = tabularData.map((item: any) => {
        // The actual data is nested in data.readings
        const readings = item.data?.readings || item.readings || item;
        
        // Parse steps if they're stored as JSON string or array
        let steps: ReadingStep[] = [];
        if (readings.steps) {
          if (typeof readings.steps === 'string') {
            try {
              steps = JSON.parse(readings.steps);
            } catch (e) {
              console.error("Failed to parse steps:", e);
              steps = [];
            }
          } else if (Array.isArray(readings.steps)) {
            steps = readings.steps;
          }
        }

        return {
          start: readings.start || item.time_received,
          end: readings.end || item.time_received,
          steps: steps,
          success: readings.success ?? true,
          pass_id: readings.pass_id || `pass-${item.id || Math.random()}`,
          err_string: readings.err_string || readings.error || null
        };
      });

      setPassSummaries(processedPasses);

      // Create RunData from pass summaries for compatibility
      if (processedPasses.length > 0) {
        const runs = processedPasses.map(pass => pass.steps || []);
        const firstPass = processedPasses[0];
        const lastPass = processedPasses[processedPasses.length - 1];
        
        const runDataFromPasses: RunData = {
          success: processedPasses.every(p => p.success),
          err_string: processedPasses.find(p => !p.success)?.err_string || null,
          start: lastPass.start, // Oldest
          end: firstPass.end, // Newest
          duration_ms: new Date(firstPass.end).getTime() - new Date(lastPass.start).getTime(),
          runs: runs,
          readings: firstPass // Use the most recent pass as the main reading
        };
        
        setRunData(runDataFromPasses);
      }

      // Fetch binary data (video files)
      let allFiles = [];
      let last = undefined;
      const earliestPassTime = new Date(Math.min(...processedPasses.map(p => new Date(p.start).getTime())));

      while (true) {
        const binaryData = await viamClient.dataClient.binaryDataByFilter(
          filter,
          50, // limit
          VIAM.dataApi.Order.DESCENDING,
          last, // pagination token
          false,
          false,
          true
        );
        
        allFiles.push(...binaryData.data);
        
        // Check if we've reached the earliest pass time or no more data
        const oldestFileTime = binaryData.data[binaryData.data.length - 1]?.metadata?.timeRequested?.toDate();
        if (!binaryData.last || !oldestFileTime || oldestFileTime < earliestPassTime) {
          break;
        }
        last = binaryData.last;
      }
      
      setVideoFiles(allFiles);
      // console.log("Fetched video files:", binaryData.data);
    };

    fetchData();
  }, []);

  return (
    <AppInterface 
      runData={runData}
      passSummaries={passSummaries} // Pass the actual summaries
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
