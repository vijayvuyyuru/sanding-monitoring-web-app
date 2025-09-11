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
  const [files, setFiles] = useState<VIAM.dataApi.BinaryData[]>([]);
  const [viamClient, setViamClient] = useState<VIAM.ViamClient | null>(null);
  const [robotClient, setRobotClient] = useState<VIAM.RobotClient | null>(null);
  const [lastFileToken, setLastFileToken] = useState<string | undefined>(undefined);
  const [hasMoreFiles, setHasMoreFiles] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
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

  // Only fetch videos for polling
  const fetchVideos = useCallback(async () => {
    if (!viamClient) return;
    
    console.log("Fetching videos only for polling");

    let filter = {
      robotId: machineId,
    } as VIAM.dataApi.Filter;

    const binaryData = await viamClient.dataClient.binaryDataByFilter(
      filter,
      100, // limit
      VIAM.dataApi.Order.DESCENDING,
      undefined, // no pagination token
      false,
      false,
      false
    );
    
    // Update files, filtering for videos by extension
    setFiles(prevFiles => {
      // Get existing non-video files
      const existingNonVideoFiles = prevFiles.filter(
        f => !f.metadata?.fileName?.toLowerCase().endsWith('.mp4')
      );
      
      // Get new video files from the fetched data
      const newVideoFiles = binaryData.data.filter(
        f => f.metadata?.fileName?.toLowerCase().endsWith('.mp4')
      );
      
      // Combine existing non-video files with new video files
      const existingVideoIds = new Set(prevFiles
        .filter(f => f.metadata?.fileName?.toLowerCase().endsWith('.mp4'))
        .map(f => f.metadata?.binaryDataId)
      );
      
      const uniqueNewVideos = newVideoFiles.filter(
        f => !existingVideoIds.has(f.metadata?.binaryDataId)
      );
      
      if (uniqueNewVideos.length > 0) {
        console.log(`Found ${uniqueNewVideos.length} new video files during polling`);
      }
      
      // Return combined files
      return [...existingNonVideoFiles, ...newVideoFiles];
    });
  }, [viamClient, machineId]);

  const loadMoreFiles = useCallback(async (passToLoad?: Pass) => {
    // If no pass is specified, use global loading state
    // Otherwise check if this specific pass is already loading
    if (!viamClient || !hasMoreFiles || 
        (!passToLoad && isLoadingFiles) || 
        (passToLoad && loadingPasses.has(passToLoad.pass_id))) {
      return false;
    }

    // Set appropriate loading state
    if (passToLoad) {
      setLoadingPasses(prev => new Set([...prev, passToLoad.pass_id]));
    } else {
      setIsLoadingFiles(true);
    }

    console.log("Loading more files...", passToLoad?.pass_id || "global");

    let filter = {
      robotId: machineId,
      mimeType: ["application/octet-stream"],
    } as VIAM.dataApi.Filter;

    // Add time range filtering if a specific pass is requested
    if (passToLoad) {
      // Create proper Timestamp objects
      const startTimestamp = Timestamp.fromDate(passToLoad.start);
      
      // Add 10 minute buffer to end time
      const endDateWithBuffer = new Date(passToLoad.end.getTime() + 10 * 60 * 1000); // Add 10 minutes in milliseconds
      const endTimestamp = Timestamp.fromDate(endDateWithBuffer);
      
      filter.interval = {
        start: startTimestamp,
        end: endTimestamp
      } as VIAM.dataApi.CaptureInterval;
      
      console.log("Filtering for pass time range:", {
        start: passToLoad.start.toISOString(),
        end: passToLoad.end.toISOString(),
        endWithBuffer: endDateWithBuffer.toISOString()
      });
    }

    try {
      let keepFetching = true;
      let loadedFiles = false;
      // When filtering by time, start fresh without a pagination token
      let currentToken = passToLoad ? undefined : lastFileToken;
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
          loadedFiles = true;

          if (passToLoad) {
            // For pass-specific queries, continue if there's a pagination token
            if (binaryData.last) {
              console.log(`Found ${binaryData.data.length} files for pass, continuing to next page...`);
              keepFetching = true;
            } else {
              console.log(`Found ${newFiles.length} total files for the pass`);
              keepFetching = false;
            }
          } else {
            // For general queries, stop after one page
            keepFetching = false;
          }
        } else {
          console.log("No more data from API.");
          keepFetching = false;
        }

        if (!binaryData.last) {
          console.log("No more pages to fetch.");
          // Only update hasMoreFiles if we're not doing a pass-specific query
          if (!passToLoad) {
            setHasMoreFiles(false);
          }
          keepFetching = false;
        }
      }

      // Update the global state once, after the loop is complete
      if (newFiles.length > 0) {
        setFiles(prevFiles => [...prevFiles, ...newFiles]);
        // Only update the token if we're not doing a pass-specific query
        if (!passToLoad) {
          setLastFileToken(currentToken);
        }
      }

      loadedFiles = newFiles.length > 0;
      return loadedFiles;
    } catch (error) {
      console.error("Failed to load more files:", error);
      return false;
    } finally {
      // Clear the appropriate loading state
      if (passToLoad) {
        setLoadingPasses(prev => {
          const next = new Set(prev);
          next.delete(passToLoad.pass_id);
          return next;
        });
      } else {
        setIsLoadingFiles(false);
      }
    }
  }, [viamClient, hasMoreFiles, isLoadingFiles, lastFileToken, machineId, loadingPasses]);

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
      loadingPasses={loadingPasses}
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
