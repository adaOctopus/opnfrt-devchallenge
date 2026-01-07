/**
 * OSINT Data Type Definitions
 * Type-safe interfaces for all OSINT data structures
 */

export interface Reputation {
  score: number;
  maxScore: number;
}

export interface Detection {
  summary?: string;
  engines?: string[];
}

export interface VirusTotalData {
  source: 'VirusTotal';
  ip: string;
  url?: string;
  detection?: Detection;
  reputation?: Reputation;
  lastAnalysis?: string;
  country?: string;
  asn?: string;
  network?: string;
  rawContent?: string;
  error?: string;
}

export interface IPInfoData {
  source: 'IPInfo';
  ip: string;
  url?: string;
  country?: string;
  region?: string;
  city?: string;
  postal?: string;
  timezone?: string;
  org?: string;
  asn?: string;
  location?: string;
  rawContent?: string;
  error?: string;
}

export interface AbuseIPDBData {
  source: 'AbuseIPDB';
  ip: string;
  url?: string;
  abuseConfidence: number | null;
  isPublic: boolean | null;
  isWhitelisted?: boolean;
  usageType?: string;
  isp?: string;
  domain?: string;
  country?: string;
  reports: string[];
  lastReported?: string;
  rawContent?: string;
  error?: string;
}

export interface OSINTError {
  source: string;
  error: string;
}

export interface OSINTResults {
  ip: string;
  timestamp: string;
  sources: {
    virustotal?: VirusTotalData;
    ipinfo?: IPInfoData;
    abuseipdb?: AbuseIPDBData;
  };
  errors: OSINTError[];
}

export interface MessageRequest {
  action: 'collectOSINT' | 'getStoredResults';
  ipAddress?: string;
}

export interface MessageResponse {
  success: boolean;
  data?: OSINTResults;
  error?: string;
}

