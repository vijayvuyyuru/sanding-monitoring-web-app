import React, { useState } from "react";
import * as VIAM from "@viamrobotics/sdk";
import VideoModal from "./VideoModal";
import { Step } from "./AppInterface";
import { generateVideo } from "./lib/videoUtils";

interface StepVideosGridProps {
  stepVideos: VIAM.dataApi.BinaryData[];
  videoStoreClient?: VIAM.GenericComponentClient | null;
  viamClient: VIAM.ViamClient;
  step: Step;
}

const StepVideosGrid: React.FC<StepVideosGridProps> = ({
  stepVideos,
  videoStoreClient,
  viamClient,
  step,
}) => {
  const [selectedVideo, setSelectedVideo] =
    useState<VIAM.dataApi.BinaryData | null>(null);
  const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null);

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

    const result = await generateVideo(videoStoreClient, step);
    console.log("generateVideo result", result);
  };

  if (stepVideos.length === 0) {
    return (
      <>
        <div className="generate video">
          <button
            className="generate-video-button"
            onClick={() => handleGenerateVideo()}
            disabled={videoStoreClient == null}
            style={{
              padding: '8px 16px',
              backgroundColor: videoStoreClient ? '#3b82f6' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: videoStoreClient ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              if (videoStoreClient) {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }
            }}
            onMouseLeave={(e) => {
              if (videoStoreClient) {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }
            }}
          >
            Generate Video
          </button>
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
