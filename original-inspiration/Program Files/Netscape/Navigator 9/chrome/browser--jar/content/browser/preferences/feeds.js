//@line 38 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/feeds.js"

//@line 40 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/feeds.js"
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var TYPE_MAYBE_FEED = "application/vnd.mozilla.maybe.feed";
const kXULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
//@line 46 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/feeds.js"

/*
 * Preferences:
 *
 * browser.feeds.handler
 * - "bookmarks", "reader" (clarified further using the .default preference),
 *   or "ask" -- indicates the default handler being used to process feeds
 *
 * browser.feeds.handler.default
 * - "bookmarks", "client" or "web" -- indicates the chosen feed reader used
 *   to display feeds, either transiently (i.e., when the "use as default"
 *   checkbox is unchecked, corresponds to when browser.feeds.handler=="ask")
 *   or more permanently (i.e., the item displayed in the dropdown in Feeds
 *   preferences)
 *
 * browser.feeds.handler.webservice
 * - the URL of the currently selected web service used to read feeds
 *
 * browser.feeds.handlers.application
 * - nsILocalFile, stores the current client-side feed reading app if one has
 *   been chosen
 */
   
const PREF_SELECTED_APP    = "browser.feeds.handlers.application";
const PREF_SELECTED_WEB    = "browser.feeds.handlers.webservice";
const PREF_SELECTED_ACTION = "browser.feeds.handler";
const PREF_SELECTED_READER = "browser.feeds.handler.default";

var gFeedsPane = {
  element: function(aID) {
    return document.getElementById(aID);
  },

  /* ........ QueryInterface .............. */
  QueryInterface: function(aIID) {
    if (aIID.equals(Ci.nsISupports) ||
        aIID.equals(Ci.nsIObserver) ||
        aIID.equals(Ci.nsIDOMEventListener))
      return this;
      
    throw Cr.NS_ERROR_NO_INTERFACE;
  },

  /**
   * See nsIObserver
   */
  observe: function(aSubject, aTopic, aData) {
    if (aTopic != "nsPref:changed" || aData != PREF_SELECTED_WEB)
      return;

    if (this.element(PREF_SELECTED_ACTION).value == "reader") {
      var wccr = 
        Cc["@mozilla.org/embeddor.implemented/web-content-handler-registrar;1"].
        getService(Ci.nsIWebContentConverterService);
      var handlerURL = this.element(PREF_SELECTED_WEB).valueFromPreferences;
      var handler =
        wccr.getWebContentHandlerByURI(TYPE_MAYBE_FEED, handlerURL);
      if (handler)
        wccr.setAutoHandler(TYPE_MAYBE_FEED, handler);
    }
  },

  /**
   * See nsIDOMEventListener
   */
  handleEvent: function(aEvent) {
    if (aEvent.type == "unload") {
      var prefBranch = Cc["@mozilla.org/preferences-service;1"].
        getService(Ci.nsIPrefBranch2);
      prefBranch.removeObserver(PREF_SELECTED_WEB, this);
      window.removeEventListener("unload", this, false);
    }
  },

  /**
   * Initializes this.
   */
  init: function () {
    var _delayedPaneLoad = function(self) {
      self._initFeedReaders();
      self.updateSelectedReader();
    }
    setTimeout(_delayedPaneLoad, 0, this);

    // For web readers, we need to call setAutoHandler if the
    // preview page should be skipped (i.e. PREF_SELECTED_ACTION="reader")
    // To do so, we've to add a pref-observer in order to be notified on
    // actual pref-changes (i.e. not on pref changes which may not take
    // affect when the prefwindow is closed)
    var prefBranch = Cc["@mozilla.org/preferences-service;1"].
      getService(Ci.nsIPrefBranch2);

    prefBranch.addObserver(PREF_SELECTED_WEB, this, false);
    window.addEventListener("unload", this, false);
  },

//@line 143 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/feeds.js"
  /**
   * Returns the system default feed reader as a nsILocalFile object if any,
   * null otherwise.
   */
  _getSystemDefaultReader: function() {
    var defaultReader;
    try {
      const WRK = Ci.nsIWindowsRegKey;
      var regKey =
          Cc["@mozilla.org/windows-registry-key;1"].createInstance(WRK);
      regKey.open(WRK.ROOT_KEY_CLASSES_ROOT, 
                  "feed\\shell\\open\\command", WRK.ACCESS_READ);
      var path = regKey.readStringValue("");
      if (path.charAt(0) == "\"") {
        // Everything inside the quotes
        path = path.substr(1);
        path = path.substr(0, path.indexOf("\""));
      }
      else {
        // Everything up to the first space
        path = path.substr(0, path.indexOf(" "));
      }

      defaultReader = Cc["@mozilla.org/file/local;1"].
                      createInstance(Ci.nsILocalFile);
      defaultReader.initWithPath(path);

      return defaultReader;
    }
    catch (ex) { }

    return null;
  },
//@line 177 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/feeds.js"


  /**
   * Populates the UI list of available feed readers.
   */
  _initFeedReaders: function() {
    this.updateSelectedApplicationInfo();

    var readersList = this.element("readers");
//@line 187 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/feeds.js"
    // On Windows, list the system default feed reader if it is
    // not the last-selected application already
    try {
      var systemDefaultReader = this._getSystemDefaultReader();
      if (systemDefaultReader) {
        var defaultSystemReaderFilefield = this.element("defaultSystemReaderFilefield");
        defaultSystemReaderFilefield.file = systemDefaultReader;
        var selectedAppFile = this.element("selectedAppFilefield").file;
        if (!selectedAppFile || defaultSystemReaderFilefield.file.path !=
            selectedAppFile.path) {
          var defaultReaderItem = document.createElementNS(kXULNS, "listitem");
          defaultReaderItem.id = "defaultSystemReaderListitem";
          defaultReaderItem.className = "listitem-iconic";
          defaultReaderItem.setAttribute("label", defaultSystemReaderFilefield.label);
          defaultReaderItem.setAttribute("image", defaultSystemReaderFilefield.image);
          readersList.appendChild(defaultReaderItem);
        }
      }
    }
    catch(ex) { }
//@line 208 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/feeds.js"

    // List of web handlers
    var wccr = 
        Cc["@mozilla.org/embeddor.implemented/web-content-handler-registrar;1"].
        getService(Ci.nsIWebContentConverterService);
    var handlers = wccr.getContentHandlers(TYPE_MAYBE_FEED, {});
    if (handlers.length == 0)
      return;

    var ios = 
        Cc["@mozilla.org/network/io-service;1"].
        getService(Ci.nsIIOService);
    for (var i = 0; i < handlers.length; ++i) {
      var row = document.createElementNS(kXULNS, "listitem");
      row.className = "listitem-iconic";
      row.setAttribute("label", handlers[i].name);
      row.setAttribute("webhandlerurl", handlers[i].uri);

      var uri = ios.newURI(handlers[i].uri, null, null);
      if (/^https?/.test(uri.scheme))
        row.setAttribute("image", uri.prePath + "/favicon.ico");

      readersList.appendChild(row);
    }
  },

  /**
   * Updates the label and image of the client feed reader listitem
   */
  updateSelectedApplicationInfo: function() {
    var appItemCell = this.element("selectedApplicationCell");
    var selectedAppFilefield = this.element("selectedAppFilefield");
    selectedAppFilefield.file = this.element(PREF_SELECTED_APP).value;
    if (selectedAppFilefield.file) {
      appItemCell.setAttribute("label", selectedAppFilefield.label);
      appItemCell.setAttribute("image", selectedAppFilefield.image);
    }
    else {
      var noAppString =
        this.element("stringbundle").getString("noApplicationSelected");
      appItemCell.setAttribute("label", noAppString);
      appItemCell.setAttribute("image", "");
    }
  },

  /**
   * Selects a item in the list without triggering a preference change.
   *
   * @param aItem
   *        the listitem to be selected
   */
  _silentSelectReader: function(aItem) {
    var readers = this.element("readers");
    readers.setAttribute("suppressonselect", "true");
    readers.selectItem(aItem);
    readers.removeAttribute("suppressonselect");
  },

  /**
   * Helper for updateSelectedReader. Syncs the selected item in the readers
   * list with value stored invalues stored in PREF_SELECTED_WEB
   */
  _updateSelectedWebHandlerItem: function() {
    // We should select the new web handler only if the default handler
    // is "web"
    var readers = this.element("readers")
    var readerElts =
        readers.getElementsByAttribute("webhandlerurl",
                                       this.element(PREF_SELECTED_WEB).value);

    // XXXmano: handle the addition of a new web handler
    if (readerElts.length > 0)
      this._silentSelectReader(readerElts[0]);
  },

  /**
   * Syncs the selected item in the readers list with the values stored in
   * preferences.
   */
  updateSelectedReader: function() {
    var defaultReader = this.element(PREF_SELECTED_READER).value ||
                        "bookmarks";
    switch (defaultReader) {
      case "bookmarks":
        this._silentSelectReader(this.element("liveBookmarksListItem"));
        break;
      case "client":
//@line 296 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/feeds.js"
        // Keep the system default feed reader item selected if the
        // last-selected application is the the system default feed reader
        // and if it is already selected
        var currentItem = this.element("readers").currentItem;
        if (currentItem && currentItem.id == "defaultSystemReaderListitem") {
          var defaultSystemReaderFile = this.element("defaultSystemReaderFilefield").file;
          var selectedAppFile = this.element("selectedAppFilefield").file;
          if (selectedAppFile && defaultSystemReaderFile &&
              defaultSystemReaderFile.path == selectedAppFile.path)
            break;
        }
//@line 308 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/feeds.js"

        this._silentSelectReader(this.element("selectedApplicationListitem"));
        break;
      case "web":
        this._updateSelectedWebHandlerItem();
        break;
    }
  },

  /**
   * Displays a prompt from which the user may choose an a (client) feed reader.
   */
  chooseClientApp: function () {
    var fp = Cc["@mozilla.org/filepicker;1"]
               .createInstance(Ci.nsIFilePicker);
    fp.init(window, document.title, Ci.nsIFilePicker.modeOpen);
    fp.appendFilters(Ci.nsIFilePicker.filterApps);
    if (fp.show() == Ci.nsIFilePicker.returnOK && fp.file) {
      // XXXben - we need to compare this with the running instance executable
      //          just don't know how to do that via script...
      if (fp.file.leafName == "navigator.exe")
        return;

      this.element(PREF_SELECTED_APP).value = fp.file;
      this.element(PREF_SELECTED_READER).value = "client";
    }
  },

  /**
   * Disables the readers list if "Show preview..." is selected, enables
   * it otherwise.
   */
  onReadingMethodSelect: function() {
    var disableList = this.element("readingMethod").value == "ask";
    this.element("readers").disabled = disableList;
    this.element("chooseClientApp").disabled = disableList;
  },

  /**
   * Maps the value of PREF_SELECTED_ACTION to the parallel
   * value in the radiogroup
   */
  onReadingMethodSyncFromPreference: function() {
    var pref = this.element(PREF_SELECTED_ACTION);
    var newVal = pref.instantApply ? pref.valueFromPreferences : pref.value;
    if (newVal != "ask")
      return "reader";

    return "ask";
  },

  /**
   * Returns the value to be used for PREF_SELECTED_ACTION
   * according to the current UI state.
   */
  onReadingMethodSyncToPreference: function() {
    var readers = this.element("readers");

    // A reader must be choosed in order to skip the preview page
    if (this.element("readingMethod").value == "ask" ||
        !readers.currentItem)
      return "ask";

    if (readers.currentItem.id == "liveBookmarksListItem")
      return "bookmarks";

    return "reader";
  },

  /**
   * Syncs PREF_SELECTED_READER with the selected item in the readers list
   * Also updates PREF_SELECTED_ACTION if necessary
   */
  writeSelectedFeedReader: function() {
    // Force update of the action pref. This is needed for the case in which
    // the user flipped from a reader to live bookmarks or vice-versa
    this.element(PREF_SELECTED_ACTION).value =
      this.onReadingMethodSyncToPreference();

    var currentItem = this.element("readers").currentItem;
    if (currentItem.hasAttribute("webhandlerurl")) {
      this.element(PREF_SELECTED_WEB).value =
        currentItem.getAttribute("webhandlerurl");
      this.element(PREF_SELECTED_READER).value = "web";
    }
    else {
      switch (currentItem.id) {
        case "liveBookmarksListItem":
          this.element(PREF_SELECTED_READER).value = "bookmarks";
          break;
        case "selectedApplicationListitem":
          // PREF_SELECTED_APP is saved in chooseClientApp
          this.element(PREF_SELECTED_READER).value = "client";
          break;
//@line 403 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/feeds.js"
        case "defaultSystemReaderListitem":
          this.element(PREF_SELECTED_APP).value = this.element("defaultSystemReaderFilefield").file;
          this.element(PREF_SELECTED_READER).value = "client";
          break;
//@line 408 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/feeds.js"
      }
    }
  }
};
