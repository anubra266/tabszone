// Background script for TabsZone extension
chrome.runtime.onInstalled.addListener(() => {
  //console.log("TabsZone extension installed");
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  //console.log("TabsZone icon clicked");
});
