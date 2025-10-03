import { useEffect, useState } from 'react';
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
const BATCH_SIZE = 100;

function App() {
  const [passSummaries, setPassSummaries] = useState<Pass[]>([]);
  const [files, setFiles] = useState<Map<string, VIAM.dataApi.BinaryData>>(new Map());
  const [videoFiles, setVideoFiles] = useState<Map<string, VIAM.dataApi.BinaryData>>(new Map());
  const [imageFiles, setImageFiles] = useState<Map<string, VIAM.dataApi.BinaryData>>(new Map());
  const [viamClient, setViamClient] = useState<VIAM.ViamClient | null>(null);
  const [robotClient, setRobotClient] = useState<VIAM.RobotClient | null>(null);
  const [fetchTimestamp, setFetchTimestamp] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7; // 7 days per page

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

    // Process files in batches
    while (true) {
      let binaryData = await viamClient.dataClient.binaryDataByFilter(
        filter,
        100,
        VIAM.dataApi.Order.DESCENDING,
        paginationToken,
        false,
        false,
        false
      );

      const newFiles = new Map<string, VIAM.dataApi.BinaryData>();
      const newVideoFiles = new Map<string, VIAM.dataApi.BinaryData>();
      const newImages = new Map<string, VIAM.dataApi.BinaryData>();

      binaryData.data.forEach(file => {
        if (file.metadata?.binaryDataId) {
          const isVideo = file.metadata.fileName?.toLowerCase().includes('.mp4');
          const isImageFile = file.metadata.fileName?.toLowerCase().match(/\.(png|jpg|jpeg)$/);
          const isCameraCapture = file.metadata.captureMetadata?.componentName && file.metadata.captureMetadata?.methodName;

          if (isVideo) {
            // Video files go to videoFiles
            newVideoFiles.set(file.metadata.binaryDataId, file);
          } else if (isImageFile || isCameraCapture) {
            // Image files go to images
            newImages.set(file.metadata.binaryDataId, file);
          } else {
            // Other files go to files
            newFiles.set(file.metadata.binaryDataId, file);
          }
        }
      });

      paginationToken = binaryData.last;

      if (binaryData.data.length > 0 && shouldSetLoadingState) {
        setFetchTimestamp(binaryData.data[binaryData.data.length - 1].metadata!.timeRequested!.toDate());
      }

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

      setImageFiles(prevImageFiles => {
        const updatedImageFiles = new Map(prevImageFiles);
        newImages.forEach((file, id) => {
          updatedImageFiles.set(id, file);
        });
        return updatedImageFiles;
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

      // batched fetching of pass summaries
      let allTabularData: any[] = [];
      let hasMoreData = true;
      let oldestTimeReceived: string | null = null;

      while (hasMoreData) {
        const baseQuery: Record<string, JsonValue>[] = [
          {
            $match: {
              organization_id: orgID,
              location_id: locationId,
              component_name: sandingSummaryName,
              robot_id: machineId,
              component_type: sandingSummaryComponentType
            }
          },
          {
            $sort: {
              time_received: -1
            }
          }
        ];

        // Add time filter for pagination if we have a previous batch
        if (oldestTimeReceived) {
          (baseQuery[0].$match as Record<string, JsonValue>).time_received = {
            $lt: oldestTimeReceived
          };
        }

        // Add limit
        const mqlQuery = [
          ...baseQuery,
          {
            $limit: BATCH_SIZE
          }
        ];

        console.log(`Fetching batch of sanding summaries${oldestTimeReceived ? ' older than ' + new Date(oldestTimeReceived).toISOString() : ''}`);
        const batchData = await viamClient.dataClient.tabularDataByMQL(orgID, mqlQuery);
        console.log(`Received ${batchData.length} records in batch`);

        // If we have data, process it
        if (batchData.length > 0) {
          // Get the oldest time_received from this batch for next query
          const lastItem = batchData[batchData.length - 1];

          if ('time_received' in lastItem) {
            oldestTimeReceived = lastItem.time_received as string;
          } else {
            console.error("Cannot find 'time_received' field for pagination in tabular data response:", lastItem);
            hasMoreData = false;
          }

          allTabularData = [...allTabularData, ...batchData];

          // If we have fewer records than the batch size, we're done
          if (batchData.length < BATCH_SIZE) {
            hasMoreData = false;
          }
        } else {
          // No more data
          hasMoreData = false;
        }
      }

      console.log(`Total tabular data records fetched: ${allTabularData.length}`);

      // Process tabular data into pass summaries
      const processedPasses: Pass[] = allTabularData.map((item: any) => {
        const pass = item.data!.readings!;
        const buildInfo = pass.build_info ? pass.build_info : {};

        return {
          start: new Date(pass.start),
          end: new Date(pass.end),
          steps: pass.steps ? pass.steps.map((x: any) => ({
            name: x.name!,
            start: new Date(x.start),
            end: new Date(x.end),
            pass_id: pass.pass_id,
          })) : [],
          success: pass.success ?? true,
          pass_id: pass.pass_id,
          err_string: pass.err_string || null,
          build_info: buildInfo
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

  // After fetching all pass summaries, add grouping by day logic
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Group passes by day
  const groupedByDay = passSummaries.reduce((acc: Record<string, Pass[]>, pass) => {
    // Use a consistent date key (YYYY-MM-DD)
    const dateKey = pass.start.toISOString().split('T')[0];
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(pass);
    return acc;
  }, {});

  // Get sorted day keys (dates)
  const sortedDays = Object.keys(groupedByDay).sort().reverse(); // Most recent first

  // Paginate by days
  const indexOfLastDay = currentPage * itemsPerPage;
  const indexOfFirstDay = indexOfLastDay - itemsPerPage;
  const currentDays = sortedDays.slice(indexOfFirstDay, indexOfLastDay);

  // Get all passes for the current days
  const currentPassSummaries = currentDays.flatMap(day => groupedByDay[day]);

  const totalPages = Math.ceil(sortedDays.length / itemsPerPage);

  return (
    <AppInterface
      machineName={machineName}
      viamClient={viamClient!}
      passSummaries={currentPassSummaries}
      files={files}
      videoFiles={videoFiles}
      imageFiles={imageFiles}
      robotClient={robotClient}
      fetchVideos={fetchFiles}
      fetchTimestamp={fetchTimestamp}
      pagination={{
        currentPage,
        totalPages,
        itemsPerPage,
        totalItems: sortedDays.length,
        totalEntries: passSummaries.length,
        onPageChange: handlePageChange,
        currentDaysDisplayed: currentDays.length,
        daysPerPage: true
      }}
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
