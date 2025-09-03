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

  if (!robotClient) {
    return (
      <div className="video-store-selector">
        <div className="text-gray-500 text-sm">
          Robot not connected
        </div>
      </div>
    );
  }

  return (
    <div className="video-store-selector mb-4">
      <label htmlFor="video-store-select" className="block text-sm font-medium text-gray-700 mb-2">
        Select Video Store Resource
      </label>
      
      <div className="space-y-3">
        {/* Dropdown for common resources */}
        <div className="relative">
          <select
            id="video-store-select"
            value={selectedResource}
            onChange={(e) => handleResourceSelect(e.target.value)}
            disabled={isLoading}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>


      </div>

      {error && (
        <div className="mt-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {resources.length === 0 && !isLoading && !error && (
        <div className="mt-2 text-sm text-gray-500">
          No video store resources found
        </div>
      )}

      {selectedResource && (
        <div className="mt-2 text-sm text-green-600">
          ✓ Connected to: {selectedResource}
        </div>
      )}
    </div>
  );
};

export default VideoStoreSelector;
