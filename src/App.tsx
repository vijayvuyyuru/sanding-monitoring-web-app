import { useState, useEffect } from 'react';
import './App.css';
import * as VIAM from "@viamrobotics/sdk";
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

function App() {

  const [list, setList] = useState<VIAM.dataApi.BinaryData[]>([]);
  const [sanderClient, setSanderClient] = useState<VIAM.GenericComponentClient| null>(null);
//   const command = new VIAM.Struct({"startSandingOption": true})


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
        setList(filenames);
    };
    
    fetchData();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Sanding Monitoring Web App</h1>
      </header>
      <main>
    <div className="string-list">
        <h2>List of Files</h2>
        <div className="grid">
            {sanderClient && <button onClick={() => 
            console.log("sanding")
                // sanderClient.doCommand(command)
                }>Start Sanding</button>}
            {list.map((item: VIAM.dataApi.BinaryData, index: number) => (
                <div key={index} className="grid-item">
                    <div className="timestamp">{item.metadata?.timeRequested?.toDate().toISOString()}</div>
                    <div className="filename"><a href={item.metadata?.uri} target="_blank" rel="noopener noreferrer">{item.metadata?.fileName}</a></div>
                </div>
            ))}
        </div>
    </div>
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
