import React, { useState, useEffect, useRef } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import './RobotOperator.css';

interface RobotOperatorProps {
  sanderClient: VIAM.GenericComponentClient | null;
  robotClient?: VIAM.RobotClient | null;
}

const RobotOperator: React.FC<RobotOperatorProps> = ({ sanderClient, robotClient }) => {
  const [cameraClient, setCameraClient] = useState<VIAM.CameraClient | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const intervalIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Initialize camera client when robot client is available
    if (robotClient) {
      try {
        const camera = new VIAM.CameraClient(robotClient, 'sensing-camera');
        setCameraClient(camera);
        setStreamError(null);
      } catch (error) {
        console.error("Failed to initialize camera:", error);
        setStreamError("Failed to connect to sensing camera");
      }
    }

    // Cleanup function
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [robotClient]);

  const startVideoStream = async () => {
    if (!cameraClient) {
      setStreamError("Camera not available");
      return;
    }

    try {
      // Function to get and display camera image
      const updateImage = async () => {
        try {
          const image = await cameraClient.getImage();
          
          // Convert Uint8Array to blob and create URL
          const buffer = new ArrayBuffer(image.length);
          const view = new Uint8Array(buffer);
          view.set(image);
          
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          
          // Revoke previous URL to prevent memory leak
          if (imageUrl) {
            URL.revokeObjectURL(imageUrl);
          }
          
          setImageUrl(url);
          setStreamError(null);
        } catch (error) {
          console.error("Failed to get camera image:", error);
          setStreamError("Failed to get camera image");
        }
      };

      // Get initial image
      await updateImage();

      // Set up interval to update image (10 fps)
      intervalIdRef.current = window.setInterval(updateImage, 100);
      setIsStreaming(true);
      setStreamError(null);
      
    } catch (error) {
      console.error("Failed to start video stream:", error);
      setStreamError("Failed to start video stream");
      setIsStreaming(false);
    }
  };

  const stopVideoStream = () => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl(null);
    }
    
    setIsStreaming(false);
  };

  const handleStartSanding = async () => {
    if (!sanderClient) {
      alert("Sander module not available");
      return;
    }

    try {
      const command = VIAM.Struct.fromJson({
        "startSandingOption": true
      });
      
      const response = await sanderClient.doCommand(command);
      console.log("Sanding started:", response);
      alert("Sanding operation started successfully");
    } catch (error) {
      console.error("Failed to start sanding:", error);
      alert("Failed to start sanding operation");
    }
  };

  const handleStopSanding = async () => {
    if (!sanderClient) {
      alert("Sander module not available");
      return;
    }

    try {
      const command = VIAM.Struct.fromJson({
        "stopSandingOption": true
      });
      
      const response = await sanderClient.doCommand(command);
      console.log("Sanding stopped:", response);
      alert("Sanding operation stopped");
    } catch (error) {
      console.error("Failed to stop sanding:", error);
      alert("Failed to stop sanding operation");
    }
  };

  return (
    <div className="robot-operator">
      <div className="operator-grid">
        {/* Live Video Feed Section */}
        <div className="video-section">
          <h3>Live Camera Feed - Sensing Camera</h3>
          
          <div className="video-container">
            {isStreaming && imageUrl ? (
              <img
                src={imageUrl}
                alt="Live feed from sensing camera"
                className="live-video"
              />
            ) : (
              <div className="video-placeholder">
                <span className="camera-icon">📹</span>
                <p>Camera feed not active</p>
              </div>
            )}
            {streamError && (
              <div className="stream-error">
                {streamError}
              </div>
            )}
          </div>
          <div className="video-controls">
            {!isStreaming ? (
              <button 
                onClick={startVideoStream} 
                className="control-btn primary"
                disabled={!cameraClient}
              >
                Start Video Feed
              </button>
            ) : (
              <button 
                onClick={stopVideoStream} 
                className="control-btn secondary"
              >
                Stop Video Feed
              </button>
            )}
          </div>
        </div>

        {/* Robot Controls Section */}
        <div className="controls-section">
          <h3>Robot Controls</h3>
          <div className="control-panel">
            <div className="control-group">
              <h4>Sanding Operations</h4>
              <div className="control-buttons">
                <button 
                  onClick={handleStartSanding}
                  className="control-btn success"
                  disabled={!sanderClient}
                >
                  Start Sanding
                </button>
                <button 
                  onClick={handleStopSanding}
                  className="control-btn danger"
                  disabled={!sanderClient}
                >
                  Stop Sanding
                </button>
              </div>
            </div>

            <div className="control-group">
              <h4>System Status</h4>
              <div className="status-indicators">
                {/* Camera Status for each camera */}
                <div className="status-item">
                  <span className="status-label">Sensing Camera:</span>
                  <span className={`status-value ${cameraClient ? 'connected' : 'disconnected'}`}>
                    {cameraClient ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="status-item">
                  <span className="status-label">Sander Module:</span>
                  <span className={`status-value ${sanderClient ? 'connected' : 'disconnected'}`}>
                    {sanderClient ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RobotOperator;
