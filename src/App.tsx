import { useEffect, useState, useCallback } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import AppInterface from './AppInterface';
import Cookies from "js-cookie";
import { JsonValue } from '@viamrobotics/sdk';
import { Pass } from './AppInterface';
import { Timestamp } from '@bufbuild/protobuf';

const sandingSummaryName = "sanding-summary";
const sandingSummaryComponentType = "rdk:component:sensor";
const locationIdRegex = /main\.([^.]+)\.viam\.cloud/;
const machineNameRegex = /\/machine\/(.+?)-main\./;

function App() {
  const [passSummaries, setPassSummaries] = useState<Pass[]>([]);
  const [files, setFiles] = useState<Map<string, VIAM.dataApi.BinaryData>>(new Map());
  const [videoFiles, setVideoFiles] = useState<Map<string, VIAM.dataApi.BinaryData>>(new Map());
  const [viamClient, setViamClient] = useState<VIAM.ViamClient | null>(null);
  const [robotClient, setRobotClient] = useState<VIAM.RobotClient | null>(null);
  const [fetchTimestamp, setFetchTimestamp] = useState<Date | null>(null);
  const [loadingPasses, setLoadingPasses] = useState<Set<string>>(new Set());

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

  const fetchFiles = async (start: Date, shouldSetLoadingState: boolean = true) => {
    if (!viamClient) return;

    const end = new Date();
    
    console.log("Fetching for time range:", start, end);
    if (shouldSetLoadingState) {
      setFetchTimestamp(start);
    }

    let filter = {
      robotId: machineId,
      interval: {
        start: Timestamp.fromDate(start),
        end: Timestamp.fromDate(end),
      } as VIAM.dataApi.CaptureInterval,
    } as VIAM.dataApi.Filter;

    let paginationToken: string | undefined = undefined;

    // Process files in batches using a while loop to eliminate code duplication
    while (true) {
      let binaryData = await viamClient.dataClient.binaryDataByFilter(
        filter,
        100, // limit
        VIAM.dataApi.Order.DESCENDING,
        paginationToken,
        false,
        false,
        false
      );
      
      // Process files once and build both files and videoFiles lists
      const newFiles = new Map<string, VIAM.dataApi.BinaryData>();
      const newVideoFiles = new Map<string, VIAM.dataApi.BinaryData>();
      
      binaryData.data.forEach(file => {
        if (file.metadata?.binaryDataId) {
          if (file.metadata.fileName?.toLowerCase().includes('.mp4')) {
            // Video files go to videoFiles
            newVideoFiles.set(file.metadata.binaryDataId, file);
          } else {
            // Non-video files go to files
            newFiles.set(file.metadata.binaryDataId, file);
          }
        }
      });

      paginationToken = binaryData.last;

      if (binaryData.data.length > 0 && shouldSetLoadingState) {
        setFetchTimestamp(binaryData.data[binaryData.data.length - 1].metadata!.timeRequested!.toDate());
      }
      
      // Update both states with the processed files
      setFiles(prevFiles => {
        const updatedFiles = new Map(prevFiles);
        newFiles.forEach((file, id) => {
          updatedFiles.set(id, file);
        });
        return updatedFiles;
      });
      
      setVideoFiles(prevVideoFiles => {
        const updatedVideoFiles = new Map(prevVideoFiles);
        newVideoFiles.forEach((file, id) => {
          updatedVideoFiles.set(id, file);
        });
        return updatedVideoFiles;
      });
      
      // Break if no more data to fetch
      if (!binaryData.last) break;
    }
    console.log("total files count:", files.size);
    console.log("total video files count:", videoFiles.size);
    
    setFetchTimestamp(null)
  };

  useEffect(() => {
    const fetchPasses = async () => {
      console.log("Fetching data start");

      const viamClient = await connect(apiKeyId, apiKeySecret);
      setViamClient(viamClient);

      try {
        const robotClient = await viamClient.connectToMachine({
          host: hostname, 
          id: machineId,
        });
        setRobotClient(robotClient);
      } catch (error) {
        console.error('Failed to create robot client:', error);
        setRobotClient(null);
      }
      
      const organizations = await viamClient.appClient.listOrganizations();
      console.log("Organizations:", organizations);
      if (organizations.length !== 1) {
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
            robot_id: machineId,
            component_type: sandingSummaryComponentType
          },
        },
        {
          $sort: {
            time_received: -1,
          },
        },
        {
          $limit: 100
        }
      ];

      const tabularData = await viamClient.dataClient.tabularDataByMQL(orgID, mqlQuery);
      console.log("Tabular Data:", tabularData);

      // Process tabular data into pass summaries
      const processedPasses: Pass[] = tabularData.map((item: any) => {
        const pass = item.data!.readings!;
        
        return {
          start: new Date(pass.start),
          end: new Date(pass.end),
          steps: pass.steps ? pass.steps.map((x: any) => ({
            name: x.name!,
            start: new Date(x.start),
            end: new Date(x.end),
            pass_id: pass.pass_id,
          })): [],
          success: pass.success ?? true,
          pass_id: pass.pass_id,
          err_string: pass.err_string || null
        };
      });
      setPassSummaries(processedPasses);
      console.log("Fetching data end");
    };
    
      fetchPasses();
    }, [apiKeyId, apiKeySecret, hostname, machineId, locationId]);


  // Fetch videos when passSummaries and viamClient are available
  useEffect(() => {
    if (passSummaries.length > 0 && viamClient) {
      const earliestVideoTime = passSummaries[passSummaries.length - 1].start;
      fetchFiles(earliestVideoTime);
    }
  }, [passSummaries, viamClient]);

  return (
    <AppInterface 
      machineName={machineName}
      viamClient={viamClient!}
      passSummaries={passSummaries}
      files={files}
      videoFiles={videoFiles}
      robotClient={robotClient}
      fetchVideos={fetchFiles}
      loadingPasses={loadingPasses}
      fetchTimestamp={fetchTimestamp}
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
