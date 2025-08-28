import React, { useState } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import { extractCameraName } from './lib/videoUtils';
import VideoModal from './VideoModal';

interface StepVideosGridProps {
  stepVideos: VIAM.dataApi.BinaryData[];
  videoStoreClient?: VIAM.GenericComponentClient | null;
}

const StepVideosGrid: React.FC<StepVideosGridProps> = ({ 
  stepVideos, 
  videoStoreClient 
}) => {
  const [selectedVideo, setSelectedVideo] = useState<VIAM.dataApi.BinaryData | null>(null);
  const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null);

  const handleVideoClick = async (video: VIAM.dataApi.BinaryData) => {
    setSelectedVideo(video);
  };

  const closeVideoModal = () => {
    // Clean up video URL if it exists
    if (modalVideoUrl && modalVideoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(modalVideoUrl);
    }
    setSelectedVideo(null);
    setModalVideoUrl(null);
  };
  const formatShortTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };
  if (stepVideos.length === 0) {
    return <div className="no-videos-message">No videos found</div>;
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
            <div className="video-info">
              <div className="camera-name" title={extractCameraName(video.metadata?.fileName || '')}>
                {extractCameraName(video.metadata?.fileName || '')}
              </div>
              <div className="video-time">
                {video.metadata?.timeRequested ?
                  formatShortTimestamp(video.metadata.timeRequested.toDate().toISOString()) :
                  'Unknown'
                }
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Video Modal */}
      <VideoModal
        selectedVideo={selectedVideo}
        onClose={closeVideoModal}
        onVideoClick={handleVideoClick}
      />
    </>
  );
};

export default StepVideosGrid;
