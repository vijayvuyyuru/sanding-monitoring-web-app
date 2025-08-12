import React, { useState, useEffect } from 'react';
import './App.css';
import * as VIAM from "@viamrobotics/sdk";
import Cookies from "js-cookie";

function App() {

  const [list, setList] = useState<VIAM.dataApi.BinaryData[]>([]);

  useEffect(() => {
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
    connect(apiKeyId, apiKeySecret).then(async (robot) => {
        const binaryData = await robot.dataClient.binaryDataByFilter( 
            {
              robotId: machineId,
            } as VIAM.dataApi.Filter, 
            undefined,
            VIAM.dataApi.Order.DESCENDING,
            undefined,
            false,
            false,
            false,
          );
        const filenames = binaryData.data.map((x: VIAM.dataApi.BinaryData) => x);
        setList(filenames);
    });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Sanding Monitoring Web App</h1>
      </header>
      <main>
    <div className="string-list">
        <h2>List of Items</h2>
        <div className="grid">
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
