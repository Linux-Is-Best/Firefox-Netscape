//@line 39 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/safeMode.js"

function restartApp() {
  var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
                             .getService(Components.interfaces.nsIAppStartup);
  appStartup.quit(appStartup.eForceQuit | appStartup.eRestart);
}

function clearAllPrefs() {
  var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefService);
  prefService.resetUserPrefs();

  // Remove the pref-overrides dir, if it exists
  try {
    var fileLocator = Components.classes["@mozilla.org/file/directory_service;1"]
                                .getService(Components.interfaces.nsIProperties);
    const NS_APP_PREFS_OVERRIDE_DIR = "PrefDOverride";
    var prefOverridesDir = fileLocator.get(NS_APP_PREFS_OVERRIDE_DIR,
                                           Components.interfaces.nsIFile);
    prefOverridesDir.remove(true);
  } catch (ex) {
    Components.utils.reportError(ex);
  }
}

function restoreDefaultBookmarks() {
  var prefBranch  = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefBranch);
  prefBranch.setBoolPref("browser.bookmarks.restore_default_bookmarks", true);
}

function deleteLocalstore() {
  const nsIDirectoryServiceContractID = "@mozilla.org/file/directory_service;1";
  const nsIProperties = Components.interfaces.nsIProperties;
  var directoryService =  Components.classes[nsIDirectoryServiceContractID]
                                    .getService(nsIProperties);
  var localstoreFile = directoryService.get("LStoreS", Components.interfaces.nsIFile);
  if (localstoreFile.exists())
    localstoreFile.remove(false);
}

function disableAddons() {
  // Disable addons
  const nsIUpdateItem = Components.interfaces.nsIUpdateItem;
  var em = Components.classes["@mozilla.org/extensions/manager;1"]
                     .getService(Components.interfaces.nsIExtensionManager);
  var type = nsIUpdateItem.TYPE_EXTENSION + nsIUpdateItem.TYPE_LOCALE +
             nsIUpdateItem.TYPE_PLUGIN;
  var items = em.getItemList(type, { });
  for (var i = 0; i < items.length; ++i)
    em.disableItem(items[i].id);

  // Select the default theme
  var prefB = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefBranch);
  prefB.clearUserPref("general.skins.selectedSkin");
}

function restoreDefaultSearchEngines() {
  var searchService = Components.classes["@mozilla.org/browser/search-service;1"]
                                .getService(Components.interfaces.nsIBrowserSearchService);

  searchService.restoreDefaultEngines();
}

function onOK() {
  try {
    if (document.getElementById("resetUserPrefs").checked)
      clearAllPrefs();
    if (document.getElementById("resetBookmarks").checked)
      restoreDefaultBookmarks();
    if (document.getElementById("resetToolbars").checked)
      deleteLocalstore();
    if (document.getElementById("disableAddons").checked)
      disableAddons();
    if (document.getElementById("restoreSearch").checked)
      restoreDefaultSearchEngines();
  } catch(e) {
  }

  restartApp();
}

function onCancel() {
  var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
                             .getService(Components.interfaces.nsIAppStartup);
  appStartup.quit(appStartup.eForceQuit);
}

function onLoad() {
  document.getElementById("tasks")
          .addEventListener("CheckboxStateChange", UpdateOKButtonState, false);
}

function UpdateOKButtonState() {
  document.documentElement.getButton("accept").disabled = 
    !document.getElementById("resetUserPrefs").checked &&
    !document.getElementById("resetBookmarks").checked &&
    !document.getElementById("resetToolbars").checked &&
    !document.getElementById("disableAddons").checked &&
    !document.getElementById("restoreSearch").checked;
}
