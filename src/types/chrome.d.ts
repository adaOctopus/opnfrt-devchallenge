/**
 * Chrome Extension API Type Definitions
 * Extended types for our specific use cases
 */

/// <reference types="chrome"/>

declare namespace chrome {
  namespace debugger {
    interface Debuggee {
      tabId?: number;
      extensionId?: string;
      targetId?: string;
    }

    interface AttachOptions {
      tabId: number;
    }

    interface DetachOptions {
      tabId: number;
    }

    interface SendCommandOptions {
      tabId: number;
    }

    type CDPCommand = string;
    type CDPDomain = string;
    type CDPMethod = string;

    function attach(
      target: AttachOptions,
      requiredVersion: string,
      callback?: () => void
    ): void;

    function detach(
      target: DetachOptions,
      callback?: () => void
    ): void;

    function sendCommand(
      target: SendCommandOptions,
      method: CDPCommand,
      commandParams?: any,
      callback?: (result?: any) => void
    ): void;

    interface DebuggerEvent {
      method: string;
      params?: any;
    }

    interface EventListener {
      (source: Debuggee, method: string, params?: any): void;
    }

    const onEvent: {
      addListener(callback: EventListener): void;
      removeListener(callback: EventListener): void;
    };
  }
}

