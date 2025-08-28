import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const fetchData = async () => {
      console.log("Fetching data start");
      const machineInfo = window.location.pathname.split("/")[2];
      
      const {
        apiKey: { id: apiKeyId, key: apiKeySecret },
        machineId,
        hostname,
      } = JSON.parse(Cookies.get(machineInfo)!);

      let filter = {
        robotId: machineId,
      } as VIAM.dataApi.Filter;

      let locationId = "";

      const locationIdMatch = window.location.href.match(locationIdRegex);
      if (locationIdMatch && locationIdMatch.length > 1) {
        locationId = locationIdMatch[1];
      }

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

      // need to associate files to what they are, right now is a giant list. What hsould it be instead?
      
      setFiles(allFiles);
      // console.log("Fetched video files:", binaryData.data);
      console.log("Fetching data end");
    };

    fetchData();
  }, []);

  return (
    <AppInterface 
      viamClient={viamClient!}
      passSummaries={passSummaries} // Pass the actual summaries
      // videoFiles={videoFiles}
      files={files}
      // sanderClient={null}
      videoStoreClient={videoStoreClient}
      // robotClient={null}
      // sanderWarning={sanderWarning} // Pass the sanding warning
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
