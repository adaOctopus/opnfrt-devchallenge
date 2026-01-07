/**
 * Chrome Extension API Type Definitions
 * Extended types for our specific use cases
 */

/// <reference types="chrome"/>

// Type aliases for CDP commands (using existing Chrome types)
type CDPCommand = string;
type EventHandler = (source: chrome.debugger.Debuggee, method: string, params?: any) => void;

