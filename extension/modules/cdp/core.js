/**
 * Core CDP (Chrome DevTools Protocol) abstraction layer
 * Similar to Playwright's architecture - provides high-level abstractions over low-level CDP commands
 */
/**
 * CDPContext manages the connection to a browser tab via Chrome DevTools Protocol
 */
class CDPContext {
    constructor(tabId) {
        this.attached = false;
        this.eventListeners = new Map();
        this._listener = null;
        this.tabId = tabId;
    }
    /**
     * Attach debugger to the tab
     */
    async attach() {
        if (this.attached) {
            return;
        }
        return new Promise((resolve, reject) => {
            try {
                chrome.debugger.attach({ tabId: this.tabId }, '1.3', () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    this.attached = true;
                    this._setupEventListeners();
                    resolve();
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Detach debugger from the tab
     */
    async detach() {
        if (!this.attached) {
            return;
        }
        return new Promise((resolve, reject) => {
            try {
                chrome.debugger.detach({ tabId: this.tabId }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    this.attached = false;
                    this._removeEventListeners();
                    resolve();
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Send a CDP command and wait for response
     */
    async sendCommand(domain, method, params = {}) {
        if (!this.attached) {
            throw new Error('CDP context not attached. Call attach() first.');
        }
        return new Promise((resolve, reject) => {
            chrome.debugger.sendCommand({ tabId: this.tabId }, `${domain}.${method}`, params, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(result);
            });
        });
    }
    /**
     * Setup event listeners for CDP events
     */
    _setupEventListeners() {
        const listener = (source, method, params) => {
            if (source.tabId === this.tabId) {
                const key = `${source.method || method}`;
                const handlers = this.eventListeners.get(key) || [];
                handlers.forEach((handler) => handler(params));
            }
        };
        chrome.debugger.onEvent.addListener(listener);
        this._listener = listener;
    }
    /**
     * Remove event listeners
     */
    _removeEventListeners() {
        if (this._listener) {
            chrome.debugger.onEvent.removeListener(this._listener);
            this._listener = null;
        }
        this.eventListeners.clear();
    }
    /**
     * Add event listener for specific CDP events
     */
    on(eventName, handler) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        this.eventListeners.get(eventName).push(handler);
    }
    /**
     * Remove event listener
     */
    off(eventName, handler) {
        const handlers = this.eventListeners.get(eventName);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
}
/**
 * Page abstraction - similar to Playwright's page object
 * Provides high-level methods that compose multiple CDP commands
 */
class Page {
    constructor(context) {
        this.context = context;
        this.tabId = context.tabId;
    }
    /**
     * Navigate to a URL (abstracts Page.navigate CDP command)
     */
    async goto(url) {
        console.log('[CDP] Enabling Page domain');
        await this.context.sendCommand('Page', 'enable');
        console.log('[CDP] Navigating to:', url);
        await this.context.sendCommand('Page', 'navigate', { url });
        console.log('[CDP] Navigate command sent');
        // Wait for page to load with timeout and fallback
        return new Promise((resolve) => {
            let resolved = false;
            // Fallback: resolve after 5 seconds regardless (some pages don't fire events)
            const fallbackTimeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    this.context.off('Page.loadEventFired', onLoad);
                    this.context.off('Page.frameStoppedLoading', onFrameLoad);
                    console.log('[CDP] Using fallback timeout (5s), page should be loaded');
                    resolve();
                }
            }, 5000);
            const onLoad = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(fallbackTimeout);
                    this.context.off('Page.loadEventFired', onLoad);
                    this.context.off('Page.frameStoppedLoading', onFrameLoad);
                    console.log('[CDP] Page.loadEventFired received');
                    resolve();
                }
            };
            const onFrameLoad = (params) => {
                // Also listen for frameStoppedLoading as fallback
                if (!resolved && params?.frameId) {
                    resolved = true;
                    clearTimeout(fallbackTimeout);
                    this.context.off('Page.loadEventFired', onLoad);
                    this.context.off('Page.frameStoppedLoading', onFrameLoad);
                    console.log('[CDP] Page.frameStoppedLoading received');
                    resolve();
                }
            };
            console.log('[CDP] Setting up event listeners');
            this.context.on('Page.loadEventFired', onLoad);
            this.context.on('Page.frameStoppedLoading', onFrameLoad);
        });
    }
    /**
     * Wait for an element to appear in the DOM
     */
    async waitForSelector(selector, options = {}) {
        // Special case: body should always exist after navigation
        if (selector === 'body') {
            console.log('[CDP] Skipping waitForSelector for body (always exists)');
            await this._sleep(1000); // Just wait a bit for page to settle
            return;
        }
        const timeout = options.timeout || 30000;
        const startTime = Date.now();
        // Enable Runtime domain for evaluate
        try {
            await this.context.sendCommand('Runtime', 'enable');
        }
        catch (error) {
            console.log('[CDP] Runtime domain already enabled or error:', error);
        }
        while (Date.now() - startTime < timeout) {
            try {
                const result = await this.context.sendCommand('Runtime', 'evaluate', {
                    expression: `
            (function() {
              try {
                const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
                return element ? { found: true, visible: element.offsetParent !== null } : { found: false };
              } catch(e) {
                return { found: false, error: e.message };
              }
            })()
          `,
                    returnByValue: true,
                });
                const value = result.result?.value;
                if (value?.found) {
                    if (!options.visible || value.visible) {
                        console.log(`[CDP] Selector found: ${selector}`);
                        return;
                    }
                }
            }
            catch (error) {
                console.log(`[CDP] Error checking selector ${selector}:`, error);
                // Continue waiting
            }
            await this._sleep(500);
        }
        console.error(`[CDP] Timeout waiting for selector: ${selector}`);
        throw new Error(`Timeout waiting for selector: ${selector}`);
    }
    /**
     * Click an element (abstracts multiple CDP commands)
     */
    async click(selector, options = {}) {
        await this.waitForSelector(selector, {
            visible: true,
            timeout: options.timeout,
        });
        // Get element position and click
        const result = await this.context.sendCommand('Runtime', 'evaluate', {
            expression: `
        (function() {
          const element = document.querySelector('${selector}');
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          };
        })()
      `,
        });
        const value = result.result?.value;
        if (!value) {
            throw new Error(`Element not found: ${selector}`);
        }
        const { x, y } = value;
        // Simulate mouse click
        await this.context.sendCommand('Input', 'dispatchMouseEvent', {
            type: 'mousePressed',
            x: Math.round(x),
            y: Math.round(y),
            button: 'left',
            clickCount: 1,
        });
        await this.context.sendCommand('Input', 'dispatchMouseEvent', {
            type: 'mouseReleased',
            x: Math.round(x),
            y: Math.round(y),
            button: 'left',
            clickCount: 1,
        });
        if (options.waitAfter) {
            await this._sleep(options.waitAfter);
        }
    }
    /**
     * Fill an input field
     */
    async fill(selector, text) {
        await this.waitForSelector(selector, { visible: true });
        // Focus and clear the input
        await this.click(selector);
        await this._sleep(100);
        // Select all and replace
        await this.context.sendCommand('Input', 'dispatchKeyEvent', {
            type: 'keyDown',
            windowsVirtualKeyCode: 17, // Ctrl
        });
        await this.context.sendCommand('Input', 'dispatchKeyEvent', {
            type: 'keyDown',
            windowsVirtualKeyCode: 65, // A
        });
        await this.context.sendCommand('Input', 'dispatchKeyEvent', {
            type: 'keyUp',
            windowsVirtualKeyCode: 65,
        });
        await this.context.sendCommand('Input', 'dispatchKeyEvent', {
            type: 'keyUp',
            windowsVirtualKeyCode: 17,
        });
        // Type the text
        for (const char of text) {
            await this.context.sendCommand('Input', 'dispatchKeyEvent', {
                type: 'char',
                text: char,
            });
        }
    }
    /**
     * Extract text content from an element
     */
    async textContent(selector) {
        // Don't wait for body selector
        if (selector !== 'body') {
            await this.waitForSelector(selector);
        }
        // Enable Runtime domain
        try {
            await this.context.sendCommand('Runtime', 'enable');
        }
        catch (error) {
            // Already enabled
        }
        const result = await this.context.sendCommand('Runtime', 'evaluate', {
            expression: `
        (function() {
          try {
            const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
            return element ? element.textContent.trim() : null;
          } catch(e) {
            return null;
          }
        })()
      `,
            returnByValue: true,
        });
        return result.result?.value || null;
    }
    /**
     * Extract multiple text contents from matching selectors
     */
    async textContents(selector) {
        // Enable Runtime domain
        try {
            await this.context.sendCommand('Runtime', 'enable');
        }
        catch (error) {
            // Already enabled
        }
        const result = await this.context.sendCommand('Runtime', 'evaluate', {
            expression: `
        (function() {
          try {
            const elements = Array.from(document.querySelectorAll('${selector.replace(/'/g, "\\'")}'));
            return elements.map(el => el.textContent.trim()).filter(text => text);
          } catch(e) {
            return [];
          }
        })()
      `,
            returnByValue: true,
        });
        return result.result?.value || [];
    }
    /**
     * Get attribute value from an element
     */
    async getAttribute(selector, attribute) {
        await this.waitForSelector(selector);
        const result = await this.context.sendCommand('Runtime', 'evaluate', {
            expression: `
        (function() {
          const element = document.querySelector('${selector}');
          return element ? element.getAttribute('${attribute}') : null;
        })()
      `,
        });
        return result.result?.value || null;
    }
    /**
     * Wait for a specific amount of time
     */
    async waitForTimeout(ms) {
        return this._sleep(ms);
    }
    /**
     * Execute JavaScript in page context
     */
    async evaluate(expression) {
        // Enable Runtime domain
        try {
            await this.context.sendCommand('Runtime', 'enable');
        }
        catch (error) {
            // Already enabled
        }
        const result = await this.context.sendCommand('Runtime', 'evaluate', {
            expression,
            returnByValue: true,
        });
        return result.result?.value;
    }
    /**
     * Wait for network idle (no requests for specified time)
     */
    async waitForNetworkIdle(timeout = 5000) {
        await this.context.sendCommand('Network', 'enable');
        return new Promise((resolve) => {
            let idleTimer = null;
            let requestCount = 0;
            const onRequest = () => {
                requestCount++;
                if (idleTimer) {
                    clearTimeout(idleTimer);
                }
            };
            const onResponse = () => {
                requestCount--;
                if (requestCount <= 0) {
                    if (idleTimer) {
                        clearTimeout(idleTimer);
                    }
                    idleTimer = setTimeout(() => {
                        this.context.off('Network.requestWillBeSent', onRequest);
                        this.context.off('Network.responseReceived', onResponse);
                        resolve();
                    }, timeout);
                }
            };
            this.context.on('Network.requestWillBeSent', onRequest);
            this.context.on('Network.responseReceived', onResponse);
            // Start idle timer
            idleTimer = setTimeout(() => {
                this.context.off('Network.requestWillBeSent', onRequest);
                this.context.off('Network.responseReceived', onResponse);
                resolve();
            }, timeout);
        });
    }
    /**
     * Scroll to element
     */
    async scrollTo(selector) {
        await this.waitForSelector(selector);
        await this.context.sendCommand('Runtime', 'evaluate', {
            expression: `
        (function() {
          const element = document.querySelector('${selector}');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        })()
      `,
        });
        await this._sleep(500);
    }
    /**
     * Private sleep utility
     */
    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
/**
 * Create a new page context (similar to Playwright's context.newPage())
 */
async function createPage(tabId) {
    const context = new CDPContext(tabId);
    await context.attach();
    return new Page(context);
}
if (typeof window !== 'undefined') {
    window.CDP = { CDPContext, Page, createPage };
}
else {
    // For service worker context
    self.CDP = { CDPContext, Page, createPage };
}
//# sourceMappingURL=core.js.map