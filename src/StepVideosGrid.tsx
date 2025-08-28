import React, { useState, useEffect, useRef } from "react";
import * as VIAM from "@viamrobotics/sdk";
import VideoModal from "./VideoModal";
import { Step } from "./AppInterface";
import { generateVideo } from "./lib/videoUtils";
import { VideoPollingManager } from "./lib/videoPollingManager";

interface StepVideosGridProps {
  stepVideos: VIAM.dataApi.BinaryData[];
  videoStoreClient?: VIAM.GenericComponentClient | null;
  viamClient: VIAM.ViamClient;
  step: Step;
  fetchVideos: () => Promise<void>;
}

const StepVideosGrid: React.FC<StepVideosGridProps> = ({
  stepVideos,
  videoStoreClient,
  viamClient,
  step,
  fetchVideos,
}) => {
  const [selectedVideo, setSelectedVideo] =
    useState<VIAM.dataApi.BinaryData | null>(null);
  const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null);

  const [isPolling, setIsPolling] = useState<boolean>(false);
  const requestIdRef = useRef<string | null>(null);
  const pollingManager = VideoPollingManager.getInstance();

  // Add CSS keyframes for spinner animation
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Update current videos in the polling manager and check for completed requests
  pollingManager.setFetchData(fetchVideos);
  pollingManager.updateCurrentVideos(stepVideos);
  pollingManager.forceVideoCheck();

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (requestIdRef.current) {
        pollingManager.removeRequest(requestIdRef.current);
      }
    };
  }, []);

  const handleVideoClick = (video: VIAM.dataApi.BinaryData) => {
    setSelectedVideo(video);
  };

  const closeVideoModal = () => {
    // Clean up video URL if it exists
    if (modalVideoUrl && modalVideoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(modalVideoUrl);
    }
    setSelectedVideo(null);
    setModalVideoUrl(null);
  };

  const handleGenerateVideo = async () => {
    if (!videoStoreClient) {
        console.error("No video store client available");
        return;
    }

    setIsPolling(true);
    
    try {
      // Start video generation
      await generateVideo(videoStoreClient, step);
      
      // Add to polling manager
      requestIdRef.current = pollingManager.addRequest(step, () => {
        setIsPolling(false);
      });
      
    } catch (error) {
      console.error("Error generating video:", error);
      setIsPolling(false);
    }
  };

  if (stepVideos.length === 0) {
    return (
      <>
        <div className="generate video">
          <button
            className="generate-video-button"
            onClick={() => handleGenerateVideo()}
            disabled={videoStoreClient == null || isPolling}
            style={{
              padding: '8px 16px',
              backgroundColor: videoStoreClient && !isPolling ? '#3b82f6' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: videoStoreClient && !isPolling ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '140px',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              if (videoStoreClient && !isPolling) {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }
            }}
            onMouseLeave={(e) => {
              if (videoStoreClient && !isPolling) {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }
            }}
                      >
              {isPolling ? (
                <>
                  <div 
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #ffffff',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                  Generating...
                </>
              ) : (
                'Generate Video'
              )}
            </button>
                      {isPolling && (
              <div 
                style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: '#6b7280',
                  textAlign: 'center'
                }}
              >
                This can take up to a minute.
              </div>
            )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="step-videos-grid">
        {stepVideos.map((video, videoIndex) => (
          <div
            key={videoIndex}
            className="step-video-item"
            onClick={() => handleVideoClick(video)}
          >
            <div className="video-thumbnail-container">
              <div className="video-thumbnail">
                <span className="video-icon">🎬</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <VideoModal
        selectedVideo={selectedVideo}
        onClose={closeVideoModal}
        viamClient={viamClient}
      />
    </>
  );
};

export default StepVideosGrid;
