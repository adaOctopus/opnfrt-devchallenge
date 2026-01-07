# PostEvent OSINT Chrome Extension - Walkthrough Guide

## Overview

This walkthrough document provides step-by-step instructions for running and testing the PostEvent OSINT Chrome Extension in your environment. The extension automates OSINT (Open Source Intelligence) data collection from VirusTotal, IPInfo, and AbuseIPDB using Chrome DevTools Protocol (CDP) automation.

## Prerequisites

- Google Chrome browser (version 88 or later)
- Access to the internet (to reach OSINT sources)
- Basic understanding of Chrome extensions

## Installation Steps

### 1. Locate the Extension Directory

Navigate to the extension directory:
```bash
cd /home/gandalf/Cardano/cardano-development/quantum/takehome-assessment-chrome-ext-main/extension
```

### 2. Load the Extension in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/` in the address bar
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `extension` folder from the project directory
6. The extension should now appear in your extensions list

### 3. Verify Installation

- You should see "PostEvent OSINT Extension" in your extensions list
- The extension icon should appear in your Chrome toolbar
- Check that there are no error messages in the extensions page

## Testing the Extension

### Basic Functionality Test

1. **Open the Extension Popup**
   - Click the extension icon in your Chrome toolbar
   - You should see a popup with:
     - Title: "PostEvent OSINT Extension"
     - An input field with default value "1.1.1.1"
     - A "Get Intel" button

2. **Test with Default IP Address**
   - Click the "Get Intel" button (or press Enter)
   - The button should change to "Collecting Intel..."
   - Status message should appear: "Collecting OSINT data from multiple sources... This may take a minute."
   - Wait for the collection process to complete (typically 30-60 seconds)

3. **Verify Results Display**
   - After collection completes, you should see three result cards:
     - 🛡️ **VirusTotal**: Threat intelligence data
     - 🌍 **IPInfo**: Geolocation and network information
     - ⚠️ **AbuseIPDB**: Abuse reports and reputation
   - Each card should display relevant information extracted from the respective source

### Testing with Different IP Addresses

Test the extension with various IP addresses:

1. **Public IP Address**
   - Enter: `8.8.8.8` (Google DNS)
   - Click "Get Intel"
   - Verify all three sources return data

2. **Another Public IP**
   - Enter: `1.1.1.1` (Cloudflare DNS)
   - Click "Get Intel"
   - Verify results are different from previous test

3. **Invalid IP Format**
   - Enter: `invalid.ip`
   - Click "Get Intel"
   - Should show error: "Invalid IP address format"

### Testing Error Handling

1. **Network Issues**
   - Disconnect from internet
   - Try to collect OSINT data
   - Extension should handle errors gracefully and display error messages

2. **Invalid IP**
   - Enter: `999.999.999.999`
   - Click "Get Intel"
   - Should validate and show appropriate error

## Understanding the Results

### VirusTotal Results
- **Reputation**: Score out of maximum (e.g., "5/90")
- **Country**: Country associated with the IP
- **ASN**: Autonomous System Number
- **Network**: Network information
- **Last Analysis**: When the IP was last analyzed
- **Detection**: Any threat detections found

### IPInfo Results
- **Country**: Country code or name
- **Region**: State or region
- **City**: City name
- **Postal Code**: ZIP/postal code
- **Timezone**: Timezone information
- **Organization**: ISP or organization name
- **ASN**: Autonomous System Number
- **Location**: Geographic coordinates

### AbuseIPDB Results
- **Abuse Confidence**: Percentage score (0-100%)
- **Public IP**: Whether IP is public or private
- **Whitelisted**: Whether IP is whitelisted
- **Usage Type**: Type of usage (e.g., hosting, ISP)
- **ISP**: Internet Service Provider
- **Domain**: Associated domain
- **Country**: Country information
- **Last Reported**: Date of last abuse report
- **Recent Reports**: Number of abuse reports found

## Debugging

### View Background Service Worker Logs

1. Go to `chrome://extensions/`
2. Find "PostEvent OSINT Extension"
3. Click **"service worker"** link (or "Inspect views: service worker")
4. This opens the DevTools console for the background script
5. Check for any error messages or logs

### View Popup Console

1. Right-click the extension icon
2. Select **"Inspect popup"** (if available)
3. Or open the popup, then:
   - Right-click inside the popup
   - Select "Inspect"
4. Check the Console tab for any errors

### Common Issues and Solutions

#### Issue: Extension doesn't load
- **Solution**: Check that all files are present in the extension directory
- Verify `manifest.json` is valid JSON
- Check for syntax errors in JavaScript files

#### Issue: "Debugger attached" error
- **Solution**: This is normal - the extension uses `chrome.debugger` API
- If you see persistent errors, try reloading the extension

#### Issue: No results displayed
- **Solution**: 
  - Check the background service worker console for errors
  - Verify internet connection
  - Check that the OSINT websites are accessible
  - Some sites may have rate limiting or require CAPTCHA

#### Issue: Tabs not closing
- **Solution**: The extension creates non-active tabs for scraping
- They should close automatically after data collection
- If they don't close, manually close them

#### Issue: "Invalid IP address format" for valid IPs
- **Solution**: Check the IP validation regex in `popup.js`
- Ensure the IP follows the format: `xxx.xxx.xxx.xxx` (0-255 per octet)

## Architecture Overview

### Modular Commands Structure

The extension follows a Playwright-like architecture with modular CDP commands:

```
extension/
├── modules/
│   ├── cdp/
│   │   └── core.js          # Core CDP abstraction layer
│   └── scrapers/
│       ├── virustotal.js    # VirusTotal scraper
│       ├── ipinfo.js        # IPInfo scraper
│       └── abuseipdb.js     # AbuseIPDB scraper
├── popup/
│   ├── popup.html           # Popup UI structure
│   ├── popup.js             # Popup controller
│   └── popup.css            # Popup styling
├── background.js            # Service worker orchestration
└── manifest.json            # Extension manifest
```

### How It Works

1. **User Input**: User enters IP address in popup
2. **Message to Background**: Popup sends message to background service worker
3. **Tab Creation**: Background creates 3 non-active tabs (one per source)
4. **CDP Automation**: Each scraper uses CDP commands to:
   - Navigate to the source website
   - Wait for content to load
   - Extract relevant information using DOM queries
   - Return structured data
5. **Data Aggregation**: Background worker collects all results
6. **Storage**: Results stored in `chrome.storage.local`
7. **Display**: Results sent back to popup for display

## Advanced Testing

### Testing CDP Commands Directly

The CDP core module can be tested independently:

1. Open background service worker console
2. The `CDP` namespace is available globally
3. You can test individual commands (for debugging)

### Testing Individual Scrapers

Each scraper can be tested independently by:
1. Opening background service worker console
2. Creating a test tab
3. Calling the scraper function directly

Example (in service worker console):
```javascript
// Create a test tab
chrome.tabs.create({url: 'https://www.virustotal.com/gui/ip-address/1.1.1.1', active: false}, async (tab) => {
  const data = await VirusTotalScraper.scrapeVirusTotal(tab.id, '1.1.1.1');
  console.log(data);
});
```

## Performance Considerations

- **Collection Time**: Typically 30-60 seconds for all three sources
- **Parallel Processing**: All three sources are scraped in parallel
- **Tab Management**: Tabs are created as non-active to avoid disrupting user workflow
- **Error Handling**: If one source fails, others continue processing

## Security Notes

- The extension requires `debugger` permission to use CDP
- It requires `<all_urls>` host permission to access OSINT sources
- No data is sent to external servers (except the OSINT sources themselves)
- All data is stored locally in `chrome.storage.local`

## Troubleshooting Checklist

- [ ] Extension loads without errors
- [ ] Popup opens correctly
- [ ] IP validation works
- [ ] Background service worker is active
- [ ] Tabs are created (check in Chrome task manager)
- [ ] Data is collected from all three sources
- [ ] Results are displayed correctly
- [ ] Tabs close after collection
- [ ] No console errors in background or popup

## Next Steps

After successful testing, you can:
1. Customize the scrapers to extract additional data
2. Add more OSINT sources
3. Enhance the UI with additional features
4. Add export functionality for results
5. Implement caching to avoid redundant requests

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify all files are present and correctly formatted
3. Ensure Chrome is up to date
4. Try reloading the extension
5. Check that OSINT websites are accessible from your network

---

**Note**: This extension is for educational and assessment purposes. Ensure compliance with terms of service of the OSINT sources when using in production environments.

