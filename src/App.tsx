import { useEffect, useState, useCallback } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import AppInterface from './AppInterface';
import Cookies from "js-cookie";
import { JsonValue } from '@viamrobotics/sdk';
import { Pass } from './AppInterface';

const sandingSummaryName = "sanding-summary";
const sandingSummaryComponentType = "rdk:component:sensor";
const locationIdRegex = /main\.([^.]+)\.viam\.cloud/;
const machineNameRegex = /\/machine\/(.+?)-main\./;

function App() {
  const [passSummaries, setPassSummaries] = useState<Pass[]>([]);
  const [files, setFiles] = useState<VIAM.dataApi.BinaryData[]>([]);
  const [viamClient, setViamClient] = useState<VIAM.ViamClient | null>(null);
  const [robotClient, setRobotClient] = useState<VIAM.RobotClient | null>(null);
  const [lastFileToken, setLastFileToken] = useState<string | undefined>(undefined);
  const [hasMoreFiles, setHasMoreFiles] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

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
  }, [viamClient, machineId]);

  const loadMoreFiles = useCallback(async (passToLoad?: Pass) => {
    if (!viamClient || !hasMoreFiles || isLoadingFiles) return false;

    setIsLoadingFiles(true);
    console.log("Loading more files...");

    let filter = {
      robotId: machineId,
    } as VIAM.dataApi.Filter;

    try {
      let keepFetching = true;
      let loadedFiles = false;
      let currentToken = lastFileToken;
      const newFiles: VIAM.dataApi.BinaryData[] = [];

      while (keepFetching) {
        console.log(`Fetching page with token: ${currentToken}`);
        const binaryData = await viamClient.dataClient.binaryDataByFilter(
          filter,
          50, // limit
          VIAM.dataApi.Order.DESCENDING,
          currentToken,
          false,
          false,
          false
        );

        if (binaryData.data.length > 0) {
          newFiles.push(...binaryData.data);
          currentToken = binaryData.last;

          if (passToLoad) {
            const passStart = new Date(passToLoad.start);
            const passEnd = new Date(passToLoad.end);
            const found = binaryData.data.some(file => {
              if (!file.metadata?.timeRequested) return false;
              const fileTime = file.metadata.timeRequested.toDate();
              return fileTime >= passStart && fileTime <= passEnd;
            });

            if (found) {
              console.log("Found relevant files for the pass, stopping fetch.");
              keepFetching = false;
            }
          } else {
            keepFetching = false;
          }
        } else {
          console.log("No more data from API.");
          keepFetching = false;
        }

        if (!binaryData.last) {
          console.log("No more pages to fetch.");
          setHasMoreFiles(false);
          keepFetching = false;
        }
      }

      // Update the global state once, after the loop is complete
      if (newFiles.length > 0) {
        setFiles(prevFiles => [...prevFiles, ...newFiles]);
        setLastFileToken(currentToken);
      }

      loadedFiles = true;
      return loadedFiles;
    } catch (error) {
      console.error("Failed to load more files:", error);
      return false;
    } finally {
      setIsLoadingFiles(false);
    }
  }, [viamClient, hasMoreFiles, isLoadingFiles, lastFileToken, machineId]);

  useEffect(() => {
    const fetchData = async () => {
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
    
    fetchData();
  }, [apiKeyId, apiKeySecret, hostname, machineId, locationId]);

  return (
    <AppInterface 
      machineName={machineName}
      viamClient={viamClient!}
      passSummaries={passSummaries}
      files={files}
      robotClient={robotClient}
      fetchVideos={fetchVideos}
      loadMoreFiles={loadMoreFiles}
      hasMoreFiles={hasMoreFiles}
      isLoadingFiles={isLoadingFiles}
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
