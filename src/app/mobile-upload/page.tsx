"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type UploadStatus = "idle" | "uploading" | "success" | "error";

function MobileUploadContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);

  // Check if session is valid on mount
  useEffect(() => {
    if (!token) {
      setSessionValid(false);
      setError("No upload token provided");
      return;
    }

    // Validate token by making a test request (we'll create a status endpoint)
    fetch(`/api/mobile-upload/status?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setSessionValid(true);
        } else {
          setSessionValid(false);
          setError(data.error || "Invalid or expired session");
        }
      })
      .catch(() => {
        setSessionValid(false);
        setError("Failed to validate session");
      });
  }, [token]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !token) return;

    setUploadStatus("uploading");
    setError(null);

    try {
      // Upload all selected files
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("token", token);

        const res = await fetch("/api/mobile-upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          const errorMsg = data.details
            ? `${data.error}: ${data.details}`
            : (data.error || "Upload failed");
          throw new Error(errorMsg);
        }

        const data = await res.json();
        return data.url;
      });

      const urls = await Promise.all(uploadPromises);
      setUploadedImages((prev) => [...prev, ...urls]);
      setUploadStatus("success");

      // Reset file input
      e.target.value = "";

      // Auto-reset status after 2 seconds
      setTimeout(() => setUploadStatus("idle"), 2000);
    } catch (err) {
      setUploadStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  if (sessionValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Validating session...</p>
        </div>
      </div>
    );
  }

  if (!sessionValid || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Session</h1>
          <p className="text-gray-600">{error || "This upload link has expired or is invalid."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <div className="max-w-2xl mx-auto pt-8 pb-16">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Upload Product Images</h1>
              <p className="text-sm text-gray-600">Desert Candle Works</p>
            </div>
          </div>
          {uploadedImages.length > 0 && (
            <div className="mt-4 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium">
                {uploadedImages.length} {uploadedImages.length === 1 ? "image" : "images"} uploaded successfully
              </p>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <label
            htmlFor="file-input"
            className={`
              block w-full py-6 px-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all
              ${uploadStatus === "uploading" ? "border-gray-300 bg-gray-50 cursor-not-allowed" : "border-amber-300 bg-amber-50 hover:bg-amber-100 hover:border-amber-400"}
            `}
          >
            {uploadStatus === "uploading" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
                <span className="text-gray-600 font-medium">Uploading...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">Select Photos</p>
                  <p className="text-sm text-gray-600 mt-1">Tap to choose from your camera or gallery</p>
                </div>
              </div>
            )}
          </label>
          <input
            id="file-input"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            disabled={uploadStatus === "uploading"}
            className="hidden"
          />

          {error && uploadStatus === "error" && (
            <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Tips:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Take clear, well-lit photos</li>
              <li>• You can upload multiple images at once</li>
              <li>• Supported formats: JPEG, PNG, WebP, HEIC</li>
              <li>• Maximum size: 10MB per image</li>
            </ul>
          </div>
        </div>

        {/* Uploaded Images Preview */}
        {uploadedImages.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Uploaded Images</h2>
            <div className="grid grid-cols-2 gap-4">
              {uploadedImages.map((url, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={url}
                    alt={`Uploaded ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>This upload session will expire in 5 minutes</p>
          <p className="mt-1">Close this page when you&apos;re done uploading</p>
        </div>
      </div>
    </div>
  );
}

export default function MobileUploadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <MobileUploadContent />
    </Suspense>
  );
}
