import React, { useState, useEffect } from 'react';
import * as VIAM from "@viamrobotics/sdk";
import { createVideoStreamFromBase64 } from './lib/videoUtils';

interface VideoModalProps {
  selectedVideo: VIAM.dataApi.BinaryData | null;
  onClose: () => void;
  viamClient: VIAM.ViamClient;
}

const VideoModal: React.FC<VideoModalProps> = ({ 
  selectedVideo, 
  onClose, 
  viamClient
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

  const handleDownload = async () => {
    if (!selectedVideo || !modalVideoUrl) return;
    
    try {
      // Fetch the blob data from the modalVideoUrl
      const response = await fetch(modalVideoUrl);
      const blob = await response.blob();
      
      // Create a download link
      const fileName = selectedVideo.metadata?.fileName || 'video.mp4';
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
    }
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeVideoModal();
      }
    };

    if (selectedVideo) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [selectedVideo]);

  // Fetch video when selectedVideo changes
  useEffect(() => {
    if (selectedVideo) {
      const fetchVideo = async () => {
        setLoadingModalVideo(true);
        try {
          console.log("fetching video", selectedVideo.metadata!.binaryDataId);
          const binaryData = await viamClient.dataClient.binaryDataByIds([selectedVideo.metadata!.binaryDataId]);
          if (binaryData.length > 0) {
            setModalVideoUrl(createVideoStreamFromBase64(binaryData[0].binary));
          }
        } catch (error) {
          console.error("Error fetching video:", error);
        } finally {
          setLoadingModalVideo(false);
        }
      };
      fetchVideo();
    }

    return () => {
      if (modalVideoUrl && modalVideoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(modalVideoUrl);
      }
    };
  }, [selectedVideo, viamClient]);

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
                <div className="loading-spinner">⏳</div>
                <p>Loading video...</p>
              </>
            )}
          </div>
          <div className="video-modal-info">
            <p><strong>File:</strong> {selectedVideo.metadata?.fileName || 'Unknown'}</p>
          </div>
          <div className="video-modal-actions">
            <button 
              onClick={handleDownload}
              disabled={!modalVideoUrl}
              className="video-modal-button secondary"
              style={{
                padding: '8px 16px',
                backgroundColor: modalVideoUrl ? '#3b82f6' : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: modalVideoUrl ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (modalVideoUrl) {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }
              }}
              onMouseLeave={(e) => {
                if (modalVideoUrl) {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                }
              }}
            >
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoModal;
