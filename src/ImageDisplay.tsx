import React, { useState, useEffect } from 'react';
import * as VIAM from "@viamrobotics/sdk";

interface ImageDisplayProps {
  binaryData: VIAM.dataApi.BinaryData;
  viamClient: VIAM.ViamClient;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ 
  binaryData, 
  viamClient, 
  className,
  style,
  alt = "Pass capture"
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    let currentObjectUrl: string | null = null;

    const getImageUrl = async (binaryData: VIAM.dataApi.BinaryData): Promise<void> => {
      try {
        let data = binaryData.binary;
        const binaryId = binaryData.metadata?.binaryDataId;

        if ((!data || data.length === 0) && binaryId) {
          const results = await viamClient.dataClient.binaryDataByIds([binaryId]);
          if (results && results.length > 0 && results[0].binary && results[0].binary.length > 0) {
            data = results[0].binary;
          } else {
            throw new Error(`Failed to retrieve binary data for ID ${binaryId}`);
          }
        }

        if (!data || data.length === 0) {
          const errMsg = `No binary data available for image ${binaryData.metadata?.fileName || binaryId}`;
          throw new Error(errMsg);
        }

        let mimeType = 'image/jpeg';
        const fileName = binaryData.metadata?.fileName?.toLowerCase();
        const fileExt = binaryData.metadata?.fileExt?.toLowerCase();
        
        if (fileName?.endsWith('.png') || fileExt === 'png') {
          mimeType = 'image/png';
        } else if (fileName?.endsWith('.jpg') || fileName?.endsWith('.jpeg') || fileExt === 'jpg' || fileExt === 'jpeg') {
          mimeType = 'image/jpeg';
        }

        if (data.length === 0) {
          throw new Error('Cannot create image from empty data');
        }

        const buffer = new ArrayBuffer(data.length);
        const view = new Uint8Array(buffer);
        view.set(data);
        
        const blob = new Blob([buffer], { type: mimeType });
        currentObjectUrl = URL.createObjectURL(blob);
        
        if (isMounted) {
          setImageUrl(currentObjectUrl);
          setIsLoading(false);
          setHasError(false);
          setErrorMessage('');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        if (isMounted) {
          setImageUrl(null);
          setIsLoading(false);
          setHasError(true);
          setErrorMessage(errorMsg);
        }
      }
    };

    getImageUrl(binaryData);

    return () => {
      isMounted = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [binaryData, viamClient]);

  const defaultStyle = {
    width: '100%',
    maxWidth: '100%',
    maxHeight: '225px',
    borderRadius: '4px',
    objectFit: 'contain' as const,
    display: 'block' as const
  };

  if (isLoading) {
    return (
      <div style={{ 
        width: '300px', 
        height: '100%', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6b7280',
        ...style
      }} className={className}>
        Loading...
      </div>
    );
  }

  if (hasError || !imageUrl) {
    return (
      <div style={{ 
        width: '300px', 
        height: '225px', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ef4444',
        fontSize: '14px',
        textAlign: 'center',
        padding: '20px',
        ...style
      }} className={className}>
        <div>Failed to load image</div>
        {errorMessage && (
          <div style={{ fontSize: '12px', marginTop: '8px', color: '#9ca3af', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {errorMessage}
          </div>
        )}
        {binaryData.metadata?.fileName && (
          <div style={{ fontSize: '12px', marginTop: '8px', color: '#9ca3af' }}>
            {binaryData.metadata.fileName.split('/').pop()}
          </div>
        )}
      </div>
    );
  }

  return (
    <img 
      src={imageUrl} 
      alt={alt}
      style={{ ...defaultStyle, ...style }}
      className={className}
      onError={() => {
        setHasError(true);
        setErrorMessage('Image failed to render after loading');
      }}
    />
  );
};

export default ImageDisplay;