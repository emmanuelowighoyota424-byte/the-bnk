"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  VoiceLivenessClient,
  LivenessResult,
  EnrollmentResult,
  sendAudioChunk,
  stopStream,
} from "./client";

export interface UseVoiceLivenessOptions {
  baseUrl: string;
  onTokenRefresh?: (tokens: { access_token: string; refresh_token: string }) => void;
}

export interface UseVoiceLivenessReturn {
  // State
  isAnalyzing: boolean;
  isStreaming: boolean;
  isEnrolling: boolean;
  lastResult: LivenessResult | null;
  error: string | null;

  // Methods
  setTokens: (accessToken: string, refreshToken?: string) => void;
  analyzeLiveness: (audioFile: File | Blob) => Promise<LivenessResult | null>;
  enrollVoice: (audioFile: File | Blob) => Promise<EnrollmentResult | null>;
  startStreaming: (
    orgId: string,
    onResult?: (result: LivenessResult) => void,
    onEscalate?: (data: { action: string; reason: string }) => void
  ) => void;
  stopStreaming: () => void;
  sendAudioData: (audioData: ArrayBuffer) => void;
  clearError: () => void;
}

export function useVoiceLiveness(
  options: UseVoiceLivenessOptions
): UseVoiceLivenessReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [lastResult, setLastResult] = useState<LivenessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<VoiceLivenessClient | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Initialize client
  useEffect(() => {
    clientRef.current = new VoiceLivenessClient({
      baseUrl: options.baseUrl,
      onTokenRefresh: options.onTokenRefresh,
    });

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [options.baseUrl, options.onTokenRefresh]);

  // Set authentication tokens
  const setTokens = useCallback(
    (accessToken: string, refreshToken?: string) => {
      clientRef.current?.setTokens(accessToken, refreshToken);
    },
    []
  );

  // Analyze audio file
  const analyzeLiveness = useCallback(
    async (audioFile: File | Blob): Promise<LivenessResult | null> => {
      if (!clientRef.current) {
        setError("Client not initialized");
        return null;
      }

      setIsAnalyzing(true);
      setError(null);

      try {
        const result = await clientRef.current.analyzeLiveness(audioFile);
        setLastResult(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        setError(message);
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  // Enroll voiceprint
  const enrollVoice = useCallback(
    async (audioFile: File | Blob): Promise<EnrollmentResult | null> => {
      if (!clientRef.current) {
        setError("Client not initialized");
        return null;
      }

      setIsEnrolling(true);
      setError(null);

      try {
        const result = await clientRef.current.enrollVoice(audioFile);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Enrollment failed";
        setError(message);
        return null;
      } finally {
        setIsEnrolling(false);
      }
    },
    []
  );

  // Start real-time streaming
  const startStreaming = useCallback(
    (
      orgId: string,
      onResult?: (result: LivenessResult) => void,
      onEscalate?: (data: { action: string; reason: string }) => void
    ) => {
      if (!clientRef.current) {
        setError("Client not initialized");
        return;
      }

      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      setError(null);

      const ws = clientRef.current.createStreamConnection(
        orgId,
        (result) => {
          setLastResult(result);
          onResult?.(result);
        },
        onEscalate,
        (err) => setError(err.message)
      );

      if (ws) {
        wsRef.current = ws;

        ws.onopen = () => {
          setIsStreaming(true);
        };

        ws.onclose = () => {
          setIsStreaming(false);
          wsRef.current = null;
        };
      }
    },
    []
  );

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (wsRef.current) {
      stopStream(wsRef.current);
      wsRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  // Send audio data to stream
  const sendAudioData = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      sendAudioChunk(wsRef.current, audioData);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isAnalyzing,
    isStreaming,
    isEnrolling,
    lastResult,
    error,
    setTokens,
    analyzeLiveness,
    enrollVoice,
    startStreaming,
    stopStreaming,
    sendAudioData,
    clearError,
  };
}
