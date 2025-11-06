import React, { useState, useRef } from 'react';
import Uppy from '@uppy/core';
import XHRUpload from '@uppy/xhr-upload';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, File, Image } from 'lucide-react';

interface ObjectUploaderProps {
  onUploadComplete?: (files: any[]) => void;
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  onGetUploadParameters?: (file: File) => Promise<{ url: string; fields?: Record<string, string>; objectPath?: string }>;
  onComplete?: (result: any) => void;
  buttonClassName?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

export function ObjectUploader({ 
  onUploadComplete,
  maxNumberOfFiles,
  maxFileSize,
  allowedFileTypes,
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
  disabled
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isUploading = uploadStatus === 'uploading';

  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles: maxNumberOfFiles ?? 10,
        maxFileSize: maxFileSize ?? 10 * 1024 * 1024, // 10MB default
        allowedFileTypes: allowedFileTypes ?? ['image/*', 'video/*', '.pdf', '.doc', '.docx', '.txt'],
      },
      autoProceed: false,
    })
      .use(XHRUpload, {
        endpoint: '/api/sprites/upload',
        formData: true,
        fieldName: 'image',
        headers: () => {
          const token = localStorage.getItem('auth_token');
          return token ? { 'Authorization': `Bearer ${token}` } : { 'Authorization': '' };
        },
        getResponseData: (xhr: XMLHttpRequest) => {
          const text = xhr.responseText ?? '';
          try {
            return JSON.parse(text);
          } catch {
            return {
              url: xhr.getResponseHeader('location') || (xhr as any).responseURL || '',
              success: xhr.status >= 200 && xhr.status < 300,
              message: text || 'Upload completed'
            } as any;
          }
        },
      })
      .on("upload", () => {
        setUploadStatus('uploading');
        setUploadProgress(0);
      })
      .on("upload-progress", (file, progress) => {
        if (progress.bytesTotal) {
          const percentage = Math.round((progress.bytesUploaded / progress.bytesTotal) * 100);
          setUploadProgress(percentage);
        }
      })
      .on("upload-success", (file, response) => {
        toast({
          title: 'Upload successful',
          description: `${file?.name || 'file'} has been uploaded successfully`,
        });
      })
      .on("upload-error", (file, error) => {
        setUploadStatus('error');
        const status = (error as any)?.request?.status || (error as any)?.status || (error as any)?.xhr?.status;
        const baseMessage = (error as any)?.message || 'Unknown error';
        const description = status === 401
          ? 'Unauthorized. Please log in to upload sprites.'
          : `Failed to upload ${file?.name || 'file'}: ${baseMessage}`;
        toast({
          title: 'Upload failed',
          description,
          variant: 'destructive',
        });
      })
      .on("complete", (result) => {
        if (result.successful && result.successful.length > 0) {
          setUploadStatus('success');
          setUploadProgress(100);
          
          // Add uploadURL to each successful file for compatibility
          const filesWithUploadURL = result.successful.map(file => {
            const uploadURL = file.response?.body?.imageUrl || (file.response as any)?.imageUrl || file.uploadURL || file.meta?.uploadURL;
            return {
              ...file,
              uploadURL: uploadURL
            };
          });
          
          // Update the result object with the modified files
          const updatedResult = {
            ...result,
            successful: filesWithUploadURL
          };
          
          onUploadComplete?.(filesWithUploadURL);
          onComplete?.(updatedResult);
          setShowModal(false);
          // Reset status after a delay
          setTimeout(() => {
            setUploadStatus('idle');
            setUploadProgress(0);
          }, 2000);
        } else if (result.failed && result.failed.length > 0) {
          setUploadStatus('error');
        }
      })
  );

  const handleOpenModal = () => {
    if (isUploading || disabled) return;
    setShowModal(true);
    setUploadStatus('idle');
    setUploadProgress(0);
    setSelectedFiles([]);
  };

  const handleCloseModal = () => {
    if (isUploading) return;
    setShowModal(false);
    setSelectedFiles([]);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const files = Array.from(event.dataTransfer.files);
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      // If onGetUploadParameters is provided, use custom upload logic
      if (onGetUploadParameters) {
        const uploadedFiles = [];

        // Early auth check for clearer UX when not logged in
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setUploadStatus('error');
          toast({
            title: 'Login required',
            description: 'You must be logged in to upload sprites. Please log in and retry.',
            variant: 'destructive',
          });
          return;
        }
        
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          
          try {
            // Get upload parameters for this file
            const { url: uploadURL, fields, objectPath } = await onGetUploadParameters(file);
            
            // Update progress
            const progressPerFile = 100 / selectedFiles.length;
            const baseProgress = i * progressPerFile;
            
            // Create FormData for upload
            const formData = new FormData();
            
            // Add any additional fields first
            if (fields) {
              Object.entries(fields).forEach(([key, value]) => {
                formData.append(key, value);
              });
            }
            
            // Add the file
            formData.append('file', file);
            
            // Upload the file
            const response = await fetch(uploadURL, {
              method: 'PUT',
              body: file, // For presigned URLs, usually just send the file directly
              headers: {
                'Content-Type': file.type,
              },
            });
            
            if (!response.ok) {
              throw new Error(`Upload failed: ${response.statusText}`);
            }
            
            // Use objectPath for image access if available, otherwise fall back to uploadURL
            const imageUrl = objectPath || uploadURL;
            
            // Create a result object similar to Uppy's format
            const uploadedFile = {
              id: `${file.name}-${Date.now()}`,
              name: file.name,
              type: file.type,
              size: file.size,
              data: file, // Preserve the original File object
              uploadURL: imageUrl, // Use the correct URL for accessing the image
              response: {
                body: { imageUrl: imageUrl },
                status: response.status,
              },
              meta: { uploadURL: imageUrl },
            };
            
            uploadedFiles.push(uploadedFile);
            
            // Update progress
            setUploadProgress(Math.round(baseProgress + progressPerFile));
            
            toast({
              title: 'Upload successful',
              description: `${file.name} has been uploaded successfully`,
            });
            } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            setUploadStatus('error');
            const message = (error as Error)?.message || '';
            const unauthorized = message.includes('401') || /unauthorized/i.test(message) || (error as any)?.status === 401;
            toast({
              title: unauthorized ? 'Login required' : 'Upload failed',
              description: unauthorized
                ? 'Unauthorized. Please log in to upload sprites.'
                : `Failed to upload ${file.name}: ${message || 'Unknown error'}`,
              variant: 'destructive',
            });
            return;
          }
        }
        
        // All files uploaded successfully
        setUploadStatus('success');
        setUploadProgress(100);
        
        const result = {
          successful: uploadedFiles,
          failed: [],
        };
        
        onUploadComplete?.(uploadedFiles);
        onComplete?.(result);
        setShowModal(false);
        
        // Reset status after a delay
        setTimeout(() => {
          setUploadStatus('idle');
          setUploadProgress(0);
        }, 2000);
        
      } else {
        // Use original Uppy logic for backward compatibility
        // Clear any existing files from Uppy to prevent duplicates
        uppy.getFiles().forEach(file => {
          uppy.removeFile(file.id);
        });

        // Add files to Uppy
        selectedFiles.forEach(file => {
          try {
            uppy.addFile({
              name: file.name,
              type: file.type,
              data: file,
            });
          } catch (error) {
            const err = error as { message?: string };
            if (typeof err.message === 'string' && err.message.includes('duplicate file')) {
              console.warn(`Skipping duplicate file: ${file.name}`);
            } else {
              throw error;
            }
          }
        });

        // Start upload
        await uppy.upload();
      }
    } catch (error) {
      const err = error as Error;
      console.error('Upload failed:', err);
      setUploadStatus('error');
      const msg = err?.message || '';
      const unauthorized = msg.includes('401') || /unauthorized/i.test(msg) || (err as any)?.status === 401;
      toast({
        title: unauthorized ? 'Login required' : 'Upload failed',
        description: unauthorized
          ? 'Unauthorized. Please log in to upload sprites.'
          : (err instanceof Error ? err.message : 'There was an error uploading your files.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Button
        ref={buttonRef}
        onClick={handleOpenModal}
        disabled={isUploading || !!disabled}
        className={buttonClassName || "flex items-center gap-2"}
      >
        {children || (
          <>
            <Upload className="h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </>
        )}
      </Button>

      {/* Custom Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Upload Files</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseModal}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* File Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">
                Drag and drop files here, or{' '}
                <button
                  type="button"
                  className="text-blue-500 hover:text-blue-600 underline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || !!disabled}
                >
                  browse
                </button>
              </p>
              <p className="text-sm text-gray-500">
                Supports images, videos, and documents
              </p>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept={allowedFileTypes ? allowedFileTypes.join(',') : 'image/*,video/*,.pdf,.doc,.docx,.txt'}
            />

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium mb-2">Selected Files:</h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      {file.type.startsWith('image/') ? (
                        <Image className="h-4 w-4 text-blue-500" />
                      ) : (
                        <File className="h-4 w-4 text-gray-500" />
                      )}
                      <span className="truncate">{file.name}</span>
                      <span className="text-gray-500">
                        ({(file.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {isUploading && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload Button */}
            <div className="mt-6 flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || isUploading || !!disabled}
                className="flex-1"
              >
                {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} file(s)`}
              </Button>
              <Button
                variant="outline"
                onClick={handleCloseModal}
                disabled={isUploading || !!disabled}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
