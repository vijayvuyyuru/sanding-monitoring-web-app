import React, { useState, useEffect } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import { extractCameraName } from './lib/videoUtils';

interface VideoModalProps {
  selectedVideo: VIAM.dataApi.BinaryData | null;
  onClose: () => void;
  onVideoClick: (video: VIAM.dataApi.BinaryData) => Promise<void>;
}

const VideoModal: React.FC<VideoModalProps> = ({ 
  selectedVideo, 
  onClose, 
  onVideoClick 
}) => {
  const [modalVideoUrl, setModalVideoUrl] = useState<string | null>(null);
  const [loadingModalVideo, setLoadingModalVideo] = useState(false);

  const closeVideoModal = () => {
    // Clean up video URL if it exists
    if (modalVideoUrl && modalVideoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(modalVideoUrl);
    }
    setModalVideoUrl(null);
    onClose();
  };

  const handleVideoClick = async (video: VIAM.dataApi.BinaryData) => {
    setLoadingModalVideo(true);
    try {
      await onVideoClick(video);
      // The parent component should handle setting the video URL
      // This is a bit of a workaround - ideally we'd pass the URL back
      // For now, we'll keep the existing logic in the parent
    } catch (error) {
      console.error("Error fetching video:", error);
    } finally {
      setLoadingModalVideo(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (modalVideoUrl && modalVideoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(modalVideoUrl);
      }
    };
  }, [modalVideoUrl]);

  if (!selectedVideo) {
    return null;
  }

  return (
    <div className="video-modal-overlay" onClick={closeVideoModal}>
      <div className="video-modal" onClick={(e) => e.stopPropagation()}>
        <div className="video-modal-header">
          <button className="video-modal-close" onClick={closeVideoModal}>×</button>
        </div>
        <div className="video-modal-content">
          <div className="video-modal-player">
            {loadingModalVideo ? (
              <>
                <div className="loading-spinner">⏳</div>
                <p>Loading video...</p>
              </>
            ) : modalVideoUrl ? (
              <video 
                controls 
                autoPlay
                src={modalVideoUrl}
                style={{ 
                  width: '100%', 
                  height: '100%',
                  borderRadius: '8px'
                }}
                onError={(e) => {
                  console.error("Video playback error:", e);
                  alert("Error playing video");
                }}
              />
            ) : (
              <>
                <span className="video-icon-large">🎬</span>
                <p>Video Preview</p>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (selectedVideo) {
                        await handleVideoClick(selectedVideo);
                      }
                    }}
                    className="fetch-video-btn"
                    style={{
                      marginTop: '10px',
                      padding: '8px 16px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Load Video from Store
                  </button>
              </>
            )}
          </div>
          <div className="video-modal-info">
            <p><strong>Time:</strong> {selectedVideo.metadata?.timeRequested ? 
              selectedVideo.metadata.timeRequested.toDate().toLocaleString() : 
              'Unknown'
            }</p>
            <p><strong>File:</strong> {selectedVideo.metadata?.fileName || 'Unknown'}</p>
            {modalVideoUrl && (
              <p style={{ fontSize: '12px', color: '#28a745', marginTop: '10px' }}>
                ✅ Video loaded from base64 data
              </p>
            )}
          </div>
          <div className="video-modal-actions">
            <a 
              href={selectedVideo.metadata?.uri} 
              target="_blank" 
              rel="noopener noreferrer"
              className="video-modal-button primary"
            >
              Open in New Tab
            </a>
            <a 
              href={selectedVideo.metadata?.uri} 
              download={selectedVideo.metadata?.fileName || 'video.mp4'}
              className="video-modal-button secondary"
            >
              Download
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoModal;
