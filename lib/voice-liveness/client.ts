/**
 * Voice Liveness API Client
 *
 * Client library for interacting with the ML Liveness backend service.
 * Supports file upload, voice enrollment, and real-time WebSocket streaming.
 */

export interface LivenessResult {
  liveness_score: number;
  deepfake_probability: number;
  behavioral_risk: number;
  voice_match_score: number;
  overall_risk: number;
  recommendation: "PROCEED" | "REVIEW" | "ESCALATE";
  user_id: string;
  org_id: string;
}

export interface EnrollmentResult {
  success: boolean;
  message: string;
  user_id: string;
  org_id: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LivenessClientConfig {
  baseUrl: string;
  accessToken?: string;
  refreshToken?: string;
  onTokenRefresh?: (tokens: TokenResponse) => void;
}

export class VoiceLivenessClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onTokenRefresh?: (tokens: TokenResponse) => void;

  constructor(config: LivenessClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.accessToken = config.accessToken || null;
    this.refreshToken = config.refreshToken || null;
    this.onTokenRefresh = config.onTokenRefresh;
  }

  /**
   * Set authentication tokens
   */
  setTokens(accessToken: string, refreshToken?: string): void {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
  }

  /**
   * Make authenticated request with automatic token refresh
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)["Authorization"] =
        `Bearer ${this.accessToken}`;
    }

    let response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    // Try to refresh token if unauthorized
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshTokens();
      if (refreshed) {
        (headers as Record<string, string>)["Authorization"] =
          `Bearer ${this.accessToken}`;
        response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers,
        });
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (!response.ok) return false;

      const tokens: TokenResponse = await response.json();
      this.accessToken = tokens.access_token;
      this.refreshToken = tokens.refresh_token;

      if (this.onTokenRefresh) {
        this.onTokenRefresh(tokens);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get demo tokens for testing
   */
  async getTestTokens(
    userId: string,
    orgId: string,
    roles: string[] = ["Viewer"]
  ): Promise<TokenResponse> {
    const response = await fetch(`${this.baseUrl}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        org_id: orgId,
        roles,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get test tokens");
    }

    const tokens: TokenResponse = await response.json();
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;

    return tokens;
  }

  /**
   * Analyze audio file for liveness detection
   */
  async analyzeLiveness(audioFile: File | Blob): Promise<LivenessResult> {
    const formData = new FormData();
    formData.append("file", audioFile);

    return this.request<LivenessResult>("/liveness/upload", {
      method: "POST",
      body: formData,
    });
  }

  /**
   * Enroll user's voiceprint
   */
  async enrollVoice(audioFile: File | Blob): Promise<EnrollmentResult> {
    const formData = new FormData();
    formData.append("file", audioFile);

    return this.request<EnrollmentResult>("/enrollment/voice", {
      method: "POST",
      body: formData,
    });
  }

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<{
    user_id: string;
    org_id: string;
    roles: string[];
  }> {
    return this.request("/auth/me");
  }

  /**
   * Logout from current session
   */
  async logout(): Promise<void> {
    if (this.refreshToken) {
      await this.request("/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });
    }
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * Create WebSocket connection for real-time streaming
   */
  createStreamConnection(
    orgId: string,
    onResult: (result: LivenessResult & { type: string }) => void,
    onEscalate?: (data: { action: string; reason: string }) => void,
    onError?: (error: Error) => void
  ): WebSocket | null {
    if (!this.accessToken) {
      onError?.(new Error("No access token available"));
      return null;
    }

    const wsUrl = this.baseUrl
      .replace("http://", "ws://")
      .replace("https://", "wss://");

    const ws = new WebSocket(
      `${wsUrl}/ws/stream/${orgId}?token=${this.accessToken}`
    );

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "escalate" && onEscalate) {
          onEscalate(data);
        } else if (data.type === "liveness_update") {
          onResult(data);
        }
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error("Parse error"));
      }
    };

    ws.onerror = () => {
      onError?.(new Error("WebSocket connection error"));
    };

    return ws;
  }
}

/**
 * Send audio chunk to WebSocket in Twilio Media Stream format
 */
export function sendAudioChunk(ws: WebSocket, audioData: ArrayBuffer): void {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(audioData)));

  ws.send(
    JSON.stringify({
      event: "media",
      media: {
        payload: base64,
      },
    })
  );
}

/**
 * Stop the WebSocket stream
 */
export function stopStream(ws: WebSocket): void {
  ws.send(JSON.stringify({ event: "stop" }));
  ws.close();
}
