import { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@tutem/api';
import { useAuth } from './useAuth';
import { ConvexError } from 'convex/values';

type UploadState = {
  isUploading: boolean;
  error: string | null;
};

export function useFileUpload() {
  const getPresignedUrl = useAction(api.actions.upload.getPresignedUrl);
  const { sessionToken } = useAuth();

  const [state, setState] = useState<UploadState>({
    isUploading: false,
    error: null,
  });

  const uploadFile = async (
    fileUri: string | undefined,
    fileKey: string
  ): Promise<string | undefined> => {
    if (!fileUri || !fileUri.startsWith('file://')) return;

    setState({ isUploading: true, error: null });

    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();
      const extension = fileUri.split('.').pop() || 'jpg';

      if (!sessionToken) {
        throw new ConvexError('No active session token');
      }

      const { url: presignedUrl, key } = await getPresignedUrl({
        sessionToken,
        key: `${fileKey}-${Date.now()}.${extension}`,
        contentType: blob.type,
      });

      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': blob.type },
      });

      if (!uploadResponse.ok) {
        throw new ConvexError("Couldn't upload image");
      }

      setState({ isUploading: false, error: null });
      return key;
    } catch (err) {
      setState({
        isUploading: false,
        error: 'Failed to upload image',
      });
      throw err;
    }
  };

  return {
    uploadFile,
    ...state,
  };
}
