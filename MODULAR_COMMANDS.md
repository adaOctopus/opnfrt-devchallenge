# Modular Commands Architecture

## Overview

The PostEvent OSINT Chrome Extension implements a modular command architecture inspired by Playwright's design philosophy. This document explains the modular commands system and how to interact with it.

## Architecture Philosophy

Similar to how Playwright's `context.newPage()` abstracts multiple CDP commands into a single, easy-to-use function, our implementation provides high-level abstractions over low-level Chrome DevTools Protocol (CDP) commands.

### Key Principles

1. **Abstraction**: Low-level CDP commands are abstracted into intuitive, high-level functions
2. **Composability**: Small, reusable commands can be composed into complex workflows
3. **Modularity**: Each command is self-contained and can be used independently
4. **Error Handling**: Built-in error handling and retry logic where appropriate

## Core CDP Module (`modules/cdp/core.js`)

### CDPContext Class

The `CDPContext` class manages the connection to a browser tab via the Chrome DevTools Protocol.

#### Methods

**`attach()`**
- Attaches the debugger to a tab
- Sets up event listeners for CDP events
- Must be called before using any CDP commands

**`detach()`**
- Detaches the debugger from the tab
- Cleans up event listeners
- Should be called when done with automation

**`sendCommand(domain, method, params)`**
- Sends a CDP command to the browser
- Returns a Promise that resolves with the command result
- Example: `context.sendCommand('Page', 'navigate', { url: 'https://example.com' })`

**`on(eventName, handler)`**
- Registers an event listener for CDP events
- Example: `context.on('Page.loadEventFired', () => console.log('Page loaded'))`

**`off(eventName, handler)`**
- Removes an event listener

### Page Class

The `Page` class provides high-level methods for browser automation, similar to Playwright's Page API.

#### Navigation Commands

**`goto(url)`**
- Navigates to a URL
- Waits for the page to fully load
- Composes multiple CDP commands: `Page.enable`, `Page.navigate`, and waits for `Page.loadEventFired`

**Example:**
```javascript
const page = await createPage(tabId);
await page.goto('https://example.com');
```

#### Element Interaction Commands

**`click(selector, options)`**
- Clicks an element matching the selector
- Composes multiple CDP commands:
  1. Waits for element to appear (`waitForSelector`)
  2. Gets element position via `Runtime.evaluate`
  3. Simulates mouse press via `Input.dispatchMouseEvent`
  4. Simulates mouse release via `Input.dispatchMouseEvent`

**Example:**
```javascript
await page.click('button#submit');
await page.click('.menu-item', { waitAfter: 1000 });
```

**`fill(selector, text)`**
- Fills an input field with text
- Composes multiple CDP commands:
  1. Clicks the input to focus it
  2. Selects all text (Ctrl+A)
  3. Types each character via `Input.dispatchKeyEvent`

**Example:**
```javascript
await page.fill('input[name="ip"]', '1.1.1.1');
```

#### Waiting Commands

**`waitForSelector(selector, options)`**
- Waits for an element to appear in the DOM
- Options:
  - `timeout`: Maximum wait time in milliseconds (default: 30000)
  - `visible`: Whether to wait for element to be visible (default: false)

**Example:**
```javascript
await page.waitForSelector('.results', { timeout: 10000, visible: true });
```

**`waitForTimeout(ms)`**
- Waits for a specified amount of time
- Useful for allowing dynamic content to load

**Example:**
```javascript
await page.waitForTimeout(2000); // Wait 2 seconds
```

**`waitForNetworkIdle(timeout)`**
- Waits for network activity to be idle
- Composes `Network.enable` and listens for network events
- Useful for waiting for AJAX requests to complete

**Example:**
```javascript
await page.waitForNetworkIdle(5000); // Wait 5 seconds of network idle
```

#### Data Extraction Commands

**`textContent(selector)`**
- Extracts text content from an element
- Uses `Runtime.evaluate` to query the DOM

**Example:**
```javascript
const title = await page.textContent('h1');
```

**`textContents(selector)`**
- Extracts text content from all matching elements
- Returns an array of text values

**Example:**
```javascript
const items = await page.textContents('.list-item');
// Returns: ['Item 1', 'Item 2', 'Item 3']
```

**`getAttribute(selector, attribute)`**
- Gets an attribute value from an element

**Example:**
```javascript
const href = await page.getAttribute('a.link', 'href');
```

**`evaluate(expression)`**
- Executes JavaScript in the page context
- Returns the result of the expression

**Example:**
```javascript
const data = await page.evaluate(`
  (function() {
    return document.querySelectorAll('.item').length;
  })()
`);
```

#### Utility Commands

**`scrollTo(selector)`**
- Scrolls to an element
- Uses `Runtime.evaluate` to call `scrollIntoView`

**Example:**
```javascript
await page.scrollTo('#footer');
```

### Creating a Page Instance

**`createPage(tabId)`**
- Factory function that creates a new Page instance
- Similar to Playwright's `context.newPage()`
- Automatically attaches the CDP context

**Example:**
```javascript
const page = await createPage(tabId);
// Now you can use all Page methods
await page.goto('https://example.com');
await page.click('button');
const text = await page.textContent('.content');
await page.context.detach(); // Clean up
```

## Scraper Modules

Each scraper module uses the CDP commands to extract data from OSINT sources.

### VirusTotal Scraper (`modules/scrapers/virustotal.js`)

**Function: `scrapeVirusTotal(tabId, ipAddress)`**

**How it works:**
1. Creates a Page instance
2. Navigates to VirusTotal IP page
3. Waits for content to load
4. Extracts:
   - Reputation score
   - Detection information
   - Country, ASN, network info
   - Last analysis date
5. Returns structured data object

**Example Usage:**
```javascript
const data = await VirusTotalScraper.scrapeVirusTotal(tabId, '1.1.1.1');
console.log(data.reputation); // { score: 5, maxScore: 90 }
```

### IPInfo Scraper (`modules/scrapers/ipinfo.js`)

**Function: `scrapeIPInfo(tabId, ipAddress)`**

**How it works:**
1. Creates a Page instance
2. Navigates to IPInfo page
3. Extracts geolocation data:
   - Country, region, city
   - Postal code, timezone
   - Organization, ASN
   - Location coordinates
4. Returns structured data object

**Example Usage:**
```javascript
const data = await IPInfoScraper.scrapeIPInfo(tabId, '8.8.8.8');
console.log(data.country); // 'US'
console.log(data.city); // 'Mountain View'
```

### AbuseIPDB Scraper (`modules/scrapers/abuseipdb.js`)

**Function: `scrapeAbuseIPDB(tabId, ipAddress)`**

**How it works:**
1. Creates a Page instance
2. Navigates to AbuseIPDB check page
3. Extracts abuse data:
   - Abuse confidence score
   - IP status (public, whitelisted)
   - Usage type, ISP, domain
   - Country information
   - Recent abuse reports
4. Returns structured data object

**Example Usage:**
```javascript
const data = await AbuseIPDBScraper.scrapeAbuseIPDB(tabId, '1.1.1.1');
console.log(data.abuseConfidence); // 0
console.log(data.reports); // Array of report texts
```

## How to Interact with Modular Commands

### From Background Service Worker

The background service worker (`background.js`) uses `importScripts` to load modules:

```javascript
importScripts(
  'modules/cdp/core.js',
  'modules/scrapers/virustotal.js',
  'modules/scrapers/ipinfo.js',
  'modules/scrapers/abuseipdb.js'
);

// Now you can use:
const page = await CDP.createPage(tabId);
const data = await VirusTotalScraper.scrapeVirusTotal(tabId, ip);
```

### Creating Custom Scrapers

You can create new scrapers by composing CDP commands:

```javascript
// In a new scraper file
async function scrapeCustomSource(tabId, ipAddress) {
  const { createPage } = self.CDP;
  const page = await createPage(tabId);
  
  try {
    // Navigate
    await page.goto(`https://custom-source.com/ip/${ipAddress}`);
    
    // Wait for content
    await page.waitForSelector('.results', { timeout: 10000 });
    
    // Extract data
    const title = await page.textContent('h1');
    const items = await page.textContents('.data-item');
    
    return {
      source: 'CustomSource',
      ip: ipAddress,
      title: title,
      items: items
    };
  } finally {
    await page.context.detach();
  }
}

// Export
self.CustomScraper = { scrapeCustomSource };
```

### Direct CDP Command Usage

For advanced use cases, you can use CDP commands directly:

```javascript
const { CDPContext } = self.CDP;
const context = new CDPContext(tabId);
await context.attach();

// Send raw CDP command
const result = await context.sendCommand('Runtime', 'evaluate', {
  expression: 'document.title'
});

console.log(result.result.value); // Page title

await context.detach();
```

### Composing Complex Workflows

You can compose multiple commands for complex automation:

```javascript
const page = await createPage(tabId);

try {
  // Navigate and wait
  await page.goto('https://example.com');
  await page.waitForNetworkIdle(3000);
  
  // Interact with form
  await page.fill('input[name="search"]', 'query');
  await page.click('button[type="submit"]');
  
  // Wait for results
  await page.waitForSelector('.results', { visible: true });
  
  // Extract data
  const results = await page.textContents('.result-item');
  
  // Scroll and get more
  await page.scrollTo('.load-more');
  await page.click('.load-more');
  await page.waitForTimeout(2000);
  
  const moreResults = await page.textContents('.result-item');
  
  return { results, moreResults };
} finally {
  await page.context.detach();
}
```

## Command Composition Examples

### Example 1: Form Submission

```javascript
async function submitForm(tabId, formData) {
  const page = await createPage(tabId);
  try {
    await page.goto('https://example.com/form');
    await page.fill('input[name="email"]', formData.email);
    await page.fill('input[name="message"]', formData.message);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.success-message', { timeout: 5000 });
    const message = await page.textContent('.success-message');
    return message;
  } finally {
    await page.context.detach();
  }
}
```

### Example 2: Data Extraction with Pagination

```javascript
async function extractAllPages(tabId, baseUrl) {
  const page = await createPage(tabId);
  const allData = [];
  
  try {
    let pageNum = 1;
    let hasMore = true;
    
    while (hasMore) {
      await page.goto(`${baseUrl}?page=${pageNum}`);
      await page.waitForSelector('.data-item');
      
      const items = await page.textContents('.data-item');
      allData.push(...items);
      
      // Check for next button
      const nextButton = await page.evaluate(`
        document.querySelector('.next-button') !== null
      `);
      
      if (nextButton) {
        await page.click('.next-button');
        await page.waitForTimeout(1000);
        pageNum++;
      } else {
        hasMore = false;
      }
    }
    
    return allData;
  } finally {
    await page.context.detach();
  }
}
```

## Best Practices

1. **Always Detach**: Always call `page.context.detach()` in a `finally` block
2. **Error Handling**: Wrap operations in try-catch blocks
3. **Timeouts**: Set appropriate timeouts for `waitForSelector` operations
4. **Resource Cleanup**: Close tabs and detach contexts when done
5. **Modular Design**: Keep scrapers focused on single sources
6. **Composability**: Build complex workflows from simple commands

## Debugging Commands

### View CDP Traffic

Open the background service worker console to see CDP command execution:

```javascript
// In background.js, you can add logging:
const originalSendCommand = CDPContext.prototype.sendCommand;
CDPContext.prototype.sendCommand = function(domain, method, params) {
  console.log(`[CDP] ${domain}.${method}`, params);
  return originalSendCommand.call(this, domain, method, params);
};
```

### Test Individual Commands

Test commands in the service worker console:

```javascript
// Create a test tab
chrome.tabs.create({url: 'https://example.com', active: false}, async (tab) => {
  const page = await CDP.createPage(tab.id);
  const title = await page.textContent('h1');
  console.log('Title:', title);
  await page.context.detach();
  chrome.tabs.remove(tab.id);
});
```

## Summary

The modular commands system provides:

- **High-level abstractions** over low-level CDP commands
- **Composable functions** that can be combined for complex workflows
- **Reusable scrapers** for different OSINT sources
- **Easy extensibility** for adding new sources or commands
- **Playwright-like API** that's intuitive and developer-friendly

This architecture makes it easy to:
- Add new OSINT sources
- Create custom automation workflows
- Debug and test individual components
- Maintain and extend the codebase

