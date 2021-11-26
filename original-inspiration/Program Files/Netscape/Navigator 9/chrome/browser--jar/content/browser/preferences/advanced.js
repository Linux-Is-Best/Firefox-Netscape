//@line 39 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/advanced.js"

var gAdvancedPane = {
  _inited: false,
  
  /**
   * Brings the appropriate tab to the front and initializes various bits of UI.
   */
  init: function ()
  {
    this._inited = true;
    var advancedPrefs = document.getElementById("advancedPrefs");
    var preference = document.getElementById("browser.preferences.advanced.selectedTabIndex");
    if (preference.value === null)
      return;
    advancedPrefs.selectedIndex = preference.value;
    
    this.updateAppUpdateItems();
    this.updateAutoItems();
    this.updateModeItems();
    
    // get database file       
    this.getDBSize();   

    // set up the "use current page" label-changing listener
    this.updateMiniUseCurrentButton();
    window.addEventListener("focus", this.updateMiniUseCurrentButton, false);            
  },

  /**
   * Stores the identity of the current tab in preferences so that the selected
   * tab can be persisted between openings of the preferences window.
   */
  tabSelectionChanged: function ()
  {
    if (!this._inited)
      return;
    var advancedPrefs = document.getElementById("advancedPrefs");
    var preference = document.getElementById("browser.preferences.advanced.selectedTabIndex");
    preference.valueFromPreferences = advancedPrefs.selectedIndex;
  },
  
  // GENERAL TAB

  /*
   * Preferences:
   *
   * accessibility.browsewithcaret
   * - true enables keyboard navigation and selection within web pages using a
   *   visible caret, false uses normal keyboard navigation with no caret
   * accessibility.typeaheadfind
   * - when set to true, typing outside text areas and input boxes will
   *   automatically start searching for what's typed within the current
   *   document; when set to false, no search action happens
   * general.autoScroll
   * - when set to true, clicking the scroll wheel on the mouse activates a
   *   mouse mode where moving the mouse down scrolls the document downward with
   *   speed correlated with the distance of the cursor from the original
   *   position at which the click occurred (and likewise with movement upward);
   *   if false, this behavior is disabled
   * general.smoothScroll
   * - set to true to enable finer page scrolling than line-by-line on page-up,
   *   page-down, and other such page movements
   * layout.spellcheckDefault
   * - an integer:
   *     0  disables spellchecking
   *     1  enables spellchecking, but only for multiline text fields
   *     2  enables spellchecking for all text fields
   */

  /**
   * Stores the original value of the spellchecking preference to enable proper
   * restoration if unchanged (since we're mapping a tristate onto a checkbox).
   */
  _storedSpellCheck: 0,

  /**
   * Returns true if any spellchecking is enabled and false otherwise, caching
   * the current value to enable proper pref restoration if the checkbox is
   * never changed.
   */
  readCheckSpelling: function ()
  {
    var pref = document.getElementById("layout.spellcheckDefault");
    this._storedSpellCheck = pref.value;

    return (pref.value != 0);
  },

  /**
   * Returns the value of the spellchecking preference represented by UI,
   * preserving the preference's "hidden" value if the preference is
   * unchanged and represents a value not strictly allowed in UI.
   */
  writeCheckSpelling: function ()
  {
    var checkbox = document.getElementById("checkSpelling");
    return checkbox.checked ? (this._storedSpellCheck == 2 ? 2 : 1) : 0;
  },

  /**
   * Shows a dialog in which the preferred language for web content may be set.
   */
  showLanguages: function ()
  {
    document.documentElement.openSubDialog("chrome://browser/content/preferences/languages.xul",
                                           "", null);
  },

  // Mini Browser Tab

  setMiniHomePageToCurrent: function () {
    var win;
    if (document.documentElement.instantApply) {
      // If we're in instant-apply mode, use the most recent browser window
      var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                         .getService(Components.interfaces.nsIWindowMediator);
      win = wm.getMostRecentWindow("navigator:browser");
    }
    else
      win = window.opener;

    if (win) {
      var homePage = document.getElementById("browser.mini.startup.homepage");
      var browser = win.document.getElementById("content");
      homePage.value = browser.browsers[0].currentURI.spec;
    }
  },

  setMiniHomePageToBookmark: function () {
    var rv = { urls: null, names: null };
    document.documentElement.openSubDialog("chrome://browser/content/bookmarks/selectBookmark.xul",
                                           "resizable", rv);  
    if (rv.urls && rv.names) {
      var homePage = document.getElementById("browser.mini.startup.homepage");
      homePage.value = rv.urls[0];
    }
  },

  updateMiniUseCurrentButton: function () {
    var useCurrent = document.getElementById("miniUseCurrent");

    var win;
    if (document.documentElement.instantApply) {
      const Cc = Components.classes, Ci = Components.interfaces;
      // If we're in instant-apply mode, use the most recent browser window
      var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                 .getService(Ci.nsIWindowMediator);
      win = wm.getMostRecentWindow("navigator:browser");
    }
    else
      win = window.opener;

    if (win && win.document.documentElement
                  .getAttribute("windowtype") == "navigator:browser")
      miniUseCurrent.disabled = false;
    else
      miniUseCurrent.disabled = true;
  },

  restoreMiniHomePage: function () {
    var homePage = document.getElementById("browser.mini.startup.homepage");
    homePage.value = homePage.defaultValue;
  },
  
  // Linkpad Tab
  
  getDBSize: function lpr_getDBSize() {
    var lpService = Components.classes["@netscape.com/linkpad/service;1"].
                    getService(Components.interfaces.nsILinkpadService);  
    var dbFile = lpService.databaseFile;
    var format, value;
    if (!dbFile) {
      format = "linkpad.prefs.database.unknown";
      value = this.getString(format);
    } else {
      var fileSize = dbFile.fileSize;
      var KB = parseInt(fileSize/1024);
      var MB = parseInt(KB/1024);
      if (MB > 0) {
        format = "linkpad.prefs.database.MB";
        value = this.getString(format, [MB]);
      } else if (KB > 0) {
        format = "linkpad.prefs.database.KB";
        value = this.getString(format, [KB]);
      } else {
        format = "linkpad.prefs.database.B";
        value = this.getString(format, [fileSize]);
      }
    }
    document.getElementById("database_label").value = value;
  },
  
  getString: function lpr_getString(name, replace) { 
    var bundle = document.getElementById("linkpad_bundle");
    if (!bundle)
      return null;
      
    if (!replace)
      return bundle.getString(name);
    else
      return bundle.getFormattedString(name, replace);
  },
  
  compactDB: function lpr_compactDB() {
    var lpService = Components.classes["@netscape.com/linkpad/service;1"].
                    getService(Components.interfaces.nsILinkpadService);
      
    try {
      lpService.compactDB();
      var label = this.getString("linkpad.prefs.database.unknown");
      document.getElementById("database_label").value = label;
    } catch(e) {}
  },
  
  // NETWORK TAB

  /*
   * Preferences:
   *
   * browser.cache.disk.capacity
   * - the size of the browser cache in KB
   */

  /**
   * Displays a dialog in which proxy settings may be changed.
   */
  showConnections: function ()
  {
    document.documentElement.openSubDialog("chrome://browser/content/preferences/connection.xul",
                                           "", null);
  },

  /**
   * Converts the cache size from units of KB to units of MB and returns that
   * value.
   */
  readCacheSize: function ()
  {
    var preference = document.getElementById("browser.cache.disk.capacity");
    return preference.value / 1000;
  },

  /**
   * Converts the cache size as specified in UI (in MB) to KB and returns that
   * value.
   */
  writeCacheSize: function ()
  {
    var cacheSize = document.getElementById("cacheSize");
    var intValue = parseInt(cacheSize.value, 10);
    return isNaN(intValue) ? 0 : intValue * 1000;
  },

  /**
   * Clears the cache.
   */
  clearCache: function ()
  {
    var cacheService = Components.classes["@mozilla.org/network/cache-service;1"]
                         	       .getService(Components.interfaces.nsICacheService);
    try {
      cacheService.evictEntries(Components.interfaces.nsICache.STORE_ANYWHERE);
    } catch(ex) {}
  },

  // UPDATE TAB

  /*
   * Preferences:
   *
   * app.update.enabled
   * - true if updates to the application are enabled, false otherwise
   * extensions.update.enabled
   * - true if updates to extensions and themes are enabled, false otherwise
   * browser.search.update
   * - true if updates to search engines are enabled, false otherwise
   * app.update.auto
   * - true if updates should be automatically downloaded and installed,
   *   possibly with a warning if incompatible extensions are installed (see
   *   app.update.mode); false if the user should be asked what he wants to do
   *   when an update is available
   * app.update.mode
   * - an integer:
   *     0    do not warn if an update will disable extensions or themes
   *     1    warn if an update will disable extensions or themes
   *     2    warn if an update will disable extensions or themes *or* if the
   *          update is a major update
   */

  /**
   * Enables and disables various UI preferences as necessary to reflect locked,
   * disabled, and checked/unchecked states.
   *
   * UI state matrix for update preference conditions
   * 
   * UI Components:                                     Preferences
   * 1 = Firefox checkbox                               i   = app.update.enabled
   * 2 = When updates for Firefox are found label       ii  = app.update.auto
   * 3 = Automatic Radiogroup (Ask vs. Automatically)   iii = app.update.mode
   * 4 = Warn before disabling extensions checkbox
   * 
   * States:
   * Element     p   val     locked    Disabled 
   * 1           i   t/f     f         false
   *             i   t/f     t         true
   *             ii  t/f     t/f       false
   *             iii 0/1/2   t/f       false
   * 2,3         i   t       t/f       false
   *             i   f       t/f       true
   *             ii  t/f     f         false
   *             ii  t/f     t         true
   *             iii 0/1/2   t/f       false
   * 4           i   t       t/f       false
   *             i   f       t/f       true
   *             ii  t       t/f       false
   *             ii  f       t/f       true
   *             iii 0/1/2   f         false
   *             iii 0/1/2   t         true   
   * 
   */
  updateAppUpdateItems: function () 
  {
    var aus = 
        Components.classes["@mozilla.org/updates/update-service;1"].
        getService(Components.interfaces.nsIApplicationUpdateService);

    var enabledPref = document.getElementById("app.update.enabled");
    var enableAppUpdate = document.getElementById("enableAppUpdate");

    enableAppUpdate.disabled = !aus.canUpdate || enabledPref.locked;
  },

  /**
   * Enables/disables UI for "when updates are found" based on the values,
   * and "locked" states of associated preferences.
   */
  updateAutoItems: function () 
  {
    var enabledPref = document.getElementById("app.update.enabled");
    var autoPref = document.getElementById("app.update.auto");
    
    var updateModeLabel = document.getElementById("updateModeLabel");
    var updateMode = document.getElementById("updateMode");
    
    var disable = enabledPref.locked || !enabledPref.value ||
                  autoPref.locked;
    updateModeLabel.disabled = updateMode.disabled = disable;
  },

  /**
   * Enables/disables the "warn if incompatible extensions/themes exist" UI
   * based on the values and "locked" states of various preferences.
   */
  updateModeItems: function () 
  {
    var enabledPref = document.getElementById("app.update.enabled");
    var autoPref = document.getElementById("app.update.auto");
    var modePref = document.getElementById("app.update.mode");
    
    var warnIncompatible = document.getElementById("warnIncompatible");
    
    var disable = enabledPref.locked || !enabledPref.value || autoPref.locked ||
                  !autoPref.value || modePref.locked;
    warnIncompatible.disabled = disable;
  },

  /**
   * The Extensions checkbox and button are disabled only if the enable Addon
   * update preference is locked. 
   */
  updateAddonUpdateUI: function ()
  {
    var enabledPref = document.getElementById("extensions.update.enabled");
    var enableAddonUpdate = document.getElementById("enableAddonUpdate");

    enableAddonUpdate.disabled = enabledPref.locked;
  },  

  /**
   * Stores the value of the app.update.mode preference, which is a tristate
   * integer preference.  We store the value here so that we can properly
   * restore the preference value if the UI reflecting the preference value
   * is in a state which can represent either of two integer values (as
   * opposed to only one possible value in the other UI state).
   */
  _modePreference: -1,

  /**
   * Reads the app.update.mode preference and converts its value into a
   * true/false value for use in determining whether the "Warn me if this will
   * disable extensions or themes" checkbox is checked.  We also save the value
   * of the preference so that the preference value can be properly restored if
   * the user's preferences cannot adequately be expressed by a single checkbox.
   *
   * app.update.modee         Checkbox State    Meaning
   * 0                        Unchecked         Do not warn
   * 1                        Checked           Warn if there are incompatibilities
   * 2                        Checked           Warn if there are incompatibilities,
   *                                            or the update is major.
   */
  readAddonWarn: function ()
  {
    var preference = document.getElementById("app.update.mode");
    var doNotWarn = preference.value != 0;
    gAdvancedPane._modePreference = doNotWarn ? preference.value : 1;
    return doNotWarn;
  },

  /**
   * Converts the state of the "Warn me if this will disable extensions or
   * themes" checkbox into the integer preference which represents it,
   * returning that value.
   */
  writeAddonWarn: function ()
  {
    var warnIncompatible = document.getElementById("warnIncompatible");
    return !warnIncompatible.checked ? 0 : gAdvancedPane._modePreference;
  },

  /**
   * Displays the history of installed updates.
   */
  showUpdates: function ()
  {
    var prompter = Components.classes["@mozilla.org/updates/update-prompt;1"]
                             .createInstance(Components.interfaces.nsIUpdatePrompt);
    prompter.showUpdateHistory(window);
  },
  
  // ENCRYPTION TAB

  /*
   * Preferences:
   *
   * security.enable_ssl3
   * - true if SSL 3 encryption is enabled, false otherwise
   * security.enable_tls
   * - true if TLS encryption is enabled, false otherwise
   * security.default_personal_cert
   * - a string:
   *     "Select Automatically"   select a certificate automatically when a site
   *                              requests one
   *     "Ask Every Time"         present a dialog to the user so he can select
   *                              the certificate to use on a site which
   *                              requests one
   */

  /**
   * Displays the user's certificates and associated options.
   */
  showCertificates: function ()
  {
    document.documentElement.openWindow("mozilla:certmanager",
                                        "chrome://pippki/content/certManager.xul",
                                        "", null);
  },

  /**
   * Displays a dialog which describes the user's CRLs.
   */
  showCRLs: function ()
  {
    document.documentElement.openWindow("Mozilla:CRLManager", 
                                        "chrome://pippki/content/crlManager.xul",
                                        "", null);
  },

  /**
   * Displays a dialog in which OCSP preferences can be configured.
   */
  showOCSP: function ()
  {
    document.documentElement.openSubDialog("chrome://mozapps/content/preferences/ocsp.xul",
                                           "", null);
  },

  /**
   * Displays a dialog from which the user can manage his security devices.
   */
  showSecurityDevices: function ()
  {
    document.documentElement.openWindow("mozilla:devicemanager",
                                        "chrome://pippki/content/device_manager.xul",
                                        "", null);
  }
};
