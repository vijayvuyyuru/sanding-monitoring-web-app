import React from 'react';
import * as VIAM from "@viamrobotics/sdk";
import ImageDisplay from './ImageDisplay';

interface BeforeAfterModalProps {
  beforeImage: VIAM.dataApi.BinaryData | null;
  afterImage: VIAM.dataApi.BinaryData | null;
  onClose: () => void;
  viamClient: VIAM.ViamClient;
}

const BeforeAfterModal: React.FC<BeforeAfterModalProps> = ({
  beforeImage,
  afterImage,
  onClose,
  viamClient
}) => {
  const handleEscapeKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  React.useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey);
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!beforeImage && !afterImage) {
    return null;
  }

  return (
    <div className="before-after-modal-overlay" onClick={onClose}>
      <div className="before-after-modal" onClick={(e) => e.stopPropagation()}>
        <div className="before-after-modal-header">
          <h3>Before & After Comparison</h3>
          <button className="before-after-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="before-after-modal-content">
          <div className="before-after-grid">
            <div className="before-after-section">
              <h4 className="before-after-title">Before</h4>
              {beforeImage ? (
                <div className="before-after-image-container">
                  <ImageDisplay 
                    binaryData={beforeImage} 
                    viamClient={viamClient}
                    className="before-after-image"
                    alt="Before image"
                  />
                  <div className="before-after-info">
                    <p>{beforeImage.metadata?.timeRequested?.toDate().toLocaleString()}</p>
                  </div>
                </div>
              ) : (
                <div className="before-after-placeholder">
                  <div className="before-after-placeholder-content">
                    No before image available
                  </div>
                </div>
              )}
            </div>

            <div className="before-after-section">
              <h4 className="before-after-title">After</h4>
              {afterImage ? (
                <div className="before-after-image-container">
                  <ImageDisplay 
                    binaryData={afterImage} 
                    viamClient={viamClient}
                    className="before-after-image"
                    alt="After image"
                  />
                  <div className="before-after-info">
                    <p>{afterImage.metadata?.timeRequested?.toDate().toLocaleString()}</p>
                  </div>
                </div>
              ) : (
                <div className="before-after-placeholder">
                  <div className="before-after-placeholder-content">
                    No after image available
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BeforeAfterModal;