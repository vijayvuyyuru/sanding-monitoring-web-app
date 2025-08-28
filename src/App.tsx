import { useEffect, useState, useCallback } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import AppInterface from './AppInterface';
import Cookies from "js-cookie";
import { JsonValue } from '@viamrobotics/sdk';
import { Pass } from './AppInterface';

/*
TODO:
- detect if there is a sanding resource
    - if so show a button to start sanding
    - if not, show a warning that there is no sanding resource
- detect if there is a video-store resource
    - if so show request a video from the past 1 minute and show the video
- add pagination

*/

const videoStoreName = "video-store-1";
const sanderName = "sander-module";
const sandingSummaryName = "sanding-summary";
const sandingSummaryComponentType = "rdk:component:sensor";
const locationIdRegex = /main\.([^.]+)\.viam\.cloud/;
const machineNameRegex = /\/machine\/(.+?)-main\./;


// function duration(start: string, end: string): number {
//   return new Date(end).getTime() - new Date(start).getTime()
// }

function App() {
  const [passSummaries, setPassSummaries] = useState<Pass[]>([]);
  const [files, setFiles] = useState<VIAM.dataApi.BinaryData[]>([]);
  const [viamClient, setViamClient] = useState<VIAM.ViamClient | null>(null);
  // const [sanderClient, setSanderClient] = useState<VIAM.GenericComponentClient | null>(null);
  const [videoStoreClient, setVideoStoreClient] = useState<VIAM.GenericComponentClient | null>(null);
  const [robotClient, setRobotClient] = useState<VIAM.RobotClient | null>(null);
  const [sanderWarning, setSanderWarning] = useState<string | null>(null); // Warning state

  const machineNameMatch = window.location.pathname.match(machineNameRegex);
  const machineName = machineNameMatch ? machineNameMatch[1] : null;

  const locationIdMatch = window.location.pathname.match(locationIdRegex);
  const locationId = locationIdMatch ? locationIdMatch[1] : null;

  const machineInfo = window.location.pathname.split("/")[2];
    
  const {
    apiKey: { id: apiKeyId, key: apiKeySecret },
    machineId,
    hostname,
  } = JSON.parse(Cookies.get(machineInfo)!);

  // Only fetch videos for polling
  const fetchVideos = useCallback(async () => {
    if (!viamClient) return;
    
    console.log("Fetching videos only for polling");

    let filter = {
      robotId: machineId,
      mimeType: ["application/octet-stream"],
    } as VIAM.dataApi.Filter;

    // Only fetch recent files (last 100) for polling efficiency
    const binaryData = await viamClient.dataClient.binaryDataByFilter(
      filter,
      100, // limit
      VIAM.dataApi.Order.DESCENDING,
      undefined, // no pagination token
      false,
      false,
      false
    );
    
    // Update only the files state, keeping existing pass summaries
    setFiles(prevFiles => {
      // Merge new files with existing ones, avoiding duplicates
      const existingIds = new Set(prevFiles.map(f => f.metadata?.binaryDataId));
      const newFiles = binaryData.data.filter(f => !existingIds.has(f.metadata?.binaryDataId));
      
      if (newFiles.length > 0) {
        console.log(`Found ${newFiles.length} new files during polling`);
        // Return new files first (most recent) followed by existing files
        return [...newFiles, ...prevFiles];
      }
      
      return prevFiles;
    });
  }, [viamClient]);

  useEffect(() => {
    const fetchData = async () => {
      console.log("Fetching data start");
      
      let filter = {
        robotId: machineId,
      } as VIAM.dataApi.Filter;

      

      const viamClient = await connect(apiKeyId, apiKeySecret);

      setViamClient(viamClient);
      try {
        const robotClient = await viamClient.connectToMachine({
          host: hostname, 
          id: machineId,
        });
        setRobotClient(robotClient); // Store the robot client
        
        const videoStoreClient = new VIAM.GenericComponentClient(robotClient, videoStoreName);
        setVideoStoreClient(videoStoreClient);
      } catch (error) {
        console.error('Failed to create robot client or video store client:', error);
        setRobotClient(null);
        setVideoStoreClient(null);
      }
      // const resources = await robotClient.resourceNames();

      // console.log("Resources:", resources);

      // Check for sander module resource
      // if (resources.find((x) => (x.type == "service" && x.subtype == "generic" && x.name == sanderName))) {
        // const sanderClient = new VIAM.GenericComponentClient(robotClient, sanderName);
        // setSanderClient(sanderClient);
        // TODO: Add visual indication that sander resource is available
      // } else {
      //   setSanderWarning("No sanding module found on this robot");
      //   console.warn("No sander-module resource found");
      // }
      
      const organizations = await viamClient.appClient.listOrganizations();
      console.log("Organizations:", organizations);
      if (organizations.length != 1) {
        console.warn("expected 1 organization, got " + organizations.length);
        return;
      }
      const orgID = organizations[0].id;

      console.log("machineId:", machineId);
      console.log("orgID:", orgID);

      const mqlQuery: Record<string, JsonValue>[] = [
        {
          $match: {
            organization_id: orgID,
            location_id: locationId,
            component_name: sandingSummaryName,
            robot_id: machineId, // Filter by current robot
            component_type: sandingSummaryComponentType
          },
        },
        {
          $sort: {
            time_received: -1,
          },
        },
        {
          $limit: 100 // Get last 100 passes
        }
      ];

      const tabularData = await viamClient.dataClient.tabularDataByMQL(orgID, mqlQuery);
      console.log("Tabular Data:", tabularData);

      // Process tabular data into pass summaries
      const processedPasses: Pass[] = tabularData.map((item: any) => {
        // The actual data is nested in data.readings
        const pass = item.data!.readings!;
        

        return {
          start: new Date(pass.start),
          end: new Date(pass.end),
          steps: pass.steps ? pass.steps.map((x: any) => ({
            name: x.name!,
            start: new Date(x.start),
            end: new Date(x.end),
            pass_id: pass.pass_id,
            // duration_ms: duration(x.start, x.end),
          })): [],
          success: pass.success ?? true,
          pass_id: pass.pass_id,
          // duration_ms: duration(pass.start, pass.end),
          err_string: pass.err_string  || null
        };
      });


      setPassSummaries(processedPasses);

      let allFiles = [];
      let last = undefined;
      const earliestPassTime = new Date(Math.min(...processedPasses.map(p => p.start.getTime())));

      var i = 0
      while (true) {
        console.log("Fetching files files", i);
        const binaryData = await viamClient.dataClient.binaryDataByFilter(
          filter,
          50, // limit
          VIAM.dataApi.Order.DESCENDING,
          last, // pagination token
          false,
          false,
          false
        );
        
        allFiles.push(...binaryData.data);
        
        // Check if we've reached the earliest pass time or no more data
        const oldestFileTime = binaryData.data[binaryData.data.length - 1]?.metadata?.timeRequested?.toDate();
        if (!binaryData.last || !oldestFileTime || oldestFileTime < earliestPassTime) {
          break;
        }
        last = binaryData.last;
      }
      
      setFiles(allFiles);
      // console.log("Fetched video files:", binaryData.data);
      console.log("Fetching data end");
    };
    
    fetchData();
  }, []);

  return (
    <AppInterface 
      machineName={machineName}
      viamClient={viamClient!}
      passSummaries={passSummaries} // Pass the actual summaries
      // videoFiles={videoFiles}
      files={files}
      // sanderClient={null}
      videoStoreClient={videoStoreClient}
      // robotClient={null}
      // sanderWarning={sanderWarning} // Pass the sanding warning
      fetchVideos={fetchVideos}
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
