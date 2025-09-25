import React, { useState, useEffect } from 'react';
import * as VIAM from "@viamrobotics/sdk";

interface VideoStoreSelectorProps {
  robotClient: VIAM.RobotClient | null;
  onVideoStoreSelected: (client: VIAM.GenericComponentClient | null) => void;
}

interface Resource {
  name: string;
  type: string;
  subtype: string;
}

const VideoStoreSelector: React.FC<VideoStoreSelectorProps> = ({
  robotClient,
  onVideoStoreSelected
}) => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResource, setSelectedResource] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available resources when robotClient changes
  useEffect(() => {
    const fetchResources = async () => {
      if (!robotClient) {
        setResources([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Get resource names from the robot client
        const resourceNames = await robotClient.resourceNames();

        // Filter for components with type "component" and subtype "generic"
        const filteredResources = resourceNames.filter(
          (resource: any) =>
            resource.type === "component" &&
            resource.subtype === "generic"
        );

        setResources(filteredResources);

        // Clear selection when resources change
        setSelectedResource('');
        onVideoStoreSelected(null);
      } catch (err) {
        console.error('Failed to fetch resources:', err);
        setError('Failed to fetch available resources');
        setResources([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResources();
  }, [robotClient, onVideoStoreSelected]);

  const handleResourceSelect = (resourceName: string) => {
    setSelectedResource(resourceName);

    if (resourceName && robotClient) {
      try {
        const videoStoreClient = new VIAM.GenericComponentClient(robotClient, resourceName);
        onVideoStoreSelected(videoStoreClient);
        setError(null);
      } catch (err) {
        console.error('Failed to create video store client:', err);
        setError(`Failed to connect to selected video store`);
        onVideoStoreSelected(null);
      }
    } else {
      onVideoStoreSelected(null);
    }
  };

  return (
    <div className="video-store-selector">
      <label htmlFor="video-store-select" className="video-store-selector-label">
        Select video store resource
      </label>

      <div style={{ position: 'relative' }}>
        <select
          id="video-store-select"
          value={selectedResource}
          onChange={(e) => handleResourceSelect(e.target.value)}
          disabled={isLoading}
          className="video-store-selector-select"
        >
          <option value="">
            {isLoading ? 'Loading resources...' : 'Select a video store resource'}
          </option>
          {resources.map((resource) => (
            <option key={resource.name} value={resource.name}>
              {resource.name}
            </option>
          ))}
        </select>

        {isLoading && (
          <div className="video-store-selector-spinner-container">
            <div className="video-store-selector-spinner"></div>
          </div>
        )}
      </div>

      {error && (
        <div className="video-store-selector-message error">
          {error}
        </div>
      )}

      {resources.length === 0 && !isLoading && !error && (
        <div className="video-store-selector-message info">
          No video store resources found
        </div>
      )}

      {selectedResource && !error && (
        <div className="video-store-selector-message success">
          ✓ Connected to: {selectedResource}
        </div>
      )}
    </div>
  );
};

export default VideoStoreSelector;
