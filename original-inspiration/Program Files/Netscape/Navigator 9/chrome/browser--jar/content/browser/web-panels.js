//@line 38 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
/*******************************************************************************
 * Constants used for quick acess to Components.
 ******************************************************************************/
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
/*******************************************************************************
 * Constants used in WebPanels.
 ******************************************************************************/
const nsIWebNavigation = Ci.nsIWebNavigation;
const MAX_HISTORY_MENU_ITEMS = 15;
const NS_ERROR_MODULE_NETWORK = 2152398848;
const NS_NET_STATUS_READ_FROM = NS_ERROR_MODULE_NETWORK + 8;
const NS_NET_STATUS_WROTE_TO  = NS_ERROR_MODULE_NETWORK + 9;
const TOPIC_PURGE = "browser:purge-session-history";
const TOPIC_PREF = "nsPref:changed";
const TOPIC_XPINSTALL = "xpinstall-install-blocked";
const PREF_AUTOFILL = "browser.urlbar.autoFill";
const PREF_SELECTSALL = "browser.urlbar.clickSelectsAll";
//@line 60 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
const BROWSER_ADD_BM_FEATURES = "centerscreen,chrome,dialog,resizable,dependent";
//@line 62 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
/*******************************************************************************
 * Global Variables
 ******************************************************************************/
var gLoadFired = false;
var gBidiUI = false;
var gBrowser = null; // need to have this since securityTab depends on it.
var gContextMenu = null;
/*******************************************************************************
 * Function to load a web panel.
 ******************************************************************************/
function loadWebPanel() {
  if (!gLoadFired)
    return;
  WebPanels.loadPanel();
}
/*******************************************************************************
 * Function to unload the web panel.
 ******************************************************************************/
function unloadWebPanel() {
  WebPanels.onUnload();
}
/*******************************************************************************
 * Main object that interacts between the user and the backend.
 ******************************************************************************/
var WebPanels = {
  
  _URLBar: null,
  get URLBar() { return this._URLBar; },
  set URLBar(val) { this._URLBar = val; },
  
  _branch: null,
  get branch() { return this._branch; },
  set branch(val) { this._branch = val; },
  
  _bundle: null,
  get bundle() { return this._bundle; },
  set bundle(val) { this._bundle = val; },
  
  _URIFixup: null,
  get URIFixup() { return this._URIFixup; },
  set URIFixup(val) { this._URIFixup = val; },
  
  _ignoreTitle: null,
  get ignoreTitle() { return this._ignoreTitle; },
  set ignoreTitle(val) { this._ignoreTitle = val; },
  
  _obService: null,
  get obService() { return this._obService; },
  set obService(val) { this._obService = val; },
  
  _lastURI: null,
  get lastURI() { return this._lastURI; },
  set lastURI(val) { this._lastURI = val; },
  
  _showingMessage: null,
  get showingMessage() { return this._showingMessage; },
  set showingMessage(val) { this._showingMessage = val; },
  
  _missingPlugins: null,
  get missingPlugins() { return this._missingPlugins; },
  set missingPlugins(val) { this._missingPlugins = val; },
  
  _isImage: null,
  get isImage() { return this._isImage; },
  set isImage(val) { this._isImage = val; },
  
  _mimeService: null,
  get mimeService() { return this._mimeService; },
  set mimeService(val) { this._mimeService = val; },
  
  _ioService: null,
  get ioService() { return this._ioService; },
  set ioService(val) { this._ioService = val; },
  
  onLoad: function wbp_onLoad() {
  
    // Setup the variables
    gBrowser = document.getElementById("web-panels-browser");
    gBidiUI = isBidiEnabled();
    this.URLBar = document.getElementById("urlbar");
    this.bundle = document.getElementById("bundle_browser");
    this.showingMessage = false;
    this.isImage = document.getElementById("isImage");
    
    // Set ignore title and the linked tooltip
    this.ignoreTitle = false;
    var btn = document.getElementById("linked-button");
    if (btn.getAttribute("checked") == "true")
      btn.setAttribute("tooltiptext", this.bundle.getString("linkedCmd.true"));
    else
      btn.setAttribute("tooltiptext", this.bundle.getString("linkedCmd.false"));
      
    // Get the preference branch
    this.branch = Cc["@mozilla.org/preferences-service;1"].
              getService(Ci.nsIPrefService).
              getBranch("");
    
    // Hookup preference observers
    var branch = this.branch.QueryInterface(Ci.nsIPrefBranch2);
    branch.addObserver(PREF_AUTOFILL, this, false);
    branch.addObserver(PREF_SELECTSALL, this, false);
        
    // Get the observer serivce and add observers
    this.obService = Cc["@mozilla.org/observer-service;1"].
                     getService(Ci.nsIObserverService);
    this.obService.addObserver(this, TOPIC_PURGE, false);
    this.obService.addObserver(this, TOPIC_XPINSTALL, false);
        
    // Get the URI Fixup service
    this.URIFixup = Cc["@mozilla.org/docshell/urifixup;1"].
                getService(Ci.nsIURIFixup);
    
    // Get the mime and io service
    this.mimeService = Cc["@mozilla.org/uriloader/external-helper-app-service;1"].
                       getService(Ci.nsIMIMEService);
    this.ioService = Cc["@mozilla.org/network/io-service;1"].
                     getService(Ci.nsIIOService);
                             
    // Hookup event listeners
    var self = this;
    gBrowser.addEventListener("DOMTitleChanged", function(event) { self.onTitleChanged(event); }, false);
    gBrowser.addEventListener("DOMUpdatePageReport", function(event) { self.onUpdatePageReport(event); }, false);
    gBrowser.addEventListener("PluginNotFound", function(event) { self.onMissingPlugin(event); }, true);    
    this.URLBar.addEventListener("dragdrop", function(event) { self.onURLBarDrop(event); }, true); 
         
    // Hookup progress listener
    gBrowser.webProgress.addProgressListener(this, Ci.nsIWebProgress.NOTIFY_ALL);
    
    // Toggle URLBar properties
    this.toggleAutoFill();
    this.toggleSelectsAll();
    urlCorrector.load();
    resizeTa.init();
                                                            
    // Initialize the security
    var securityUI = gBrowser.securityUI;
    this.onSecurityChange(null, null, securityUI.state);
  
    // Initialize the findbar
    gFindBar.initFindBar();
        
    // Load a panel
    this.loadPanel();
    
    // Mark that load has fired
    gLoadFired = true;
  },
  
  onUnload: function wbp_onUnload() {
    
    // Remove pref observers
    var branch = this.branch.QueryInterface(Ci.nsIPrefBranch2);
    branch.removeObserver(PREF_AUTOFILL, this);
    branch.removeObserver(PREF_SELECTSALL, this);
        
    // Remove observers
    this.obService.removeObserver(this, TOPIC_PURGE);
    this.obService.removeObserver(this, TOPIC_XPINSTALL);   
  
    // unhook the find bar
    gFindBar.uninitFindBar();
        
    // Unhook the progress listener
    try {
      gBrowser.webProgress.removeProgressListener(this);
    } catch(e) {}
    
    // make sure the browser is destroyed
    try {
      gBrowser.destroy();
      gBrowser.focusedWindow = null;
      gBrowser.focusedElement = null;      
    } catch(e) {} 
        
    // Remove variables
    gBrowser = null;
    gBidiUI = null;
    this.URLBar = null;
    this.branch = null;
    this.bundle = null;
    this.URIFixup = null;
    this.ignoreTitle = null;
    this.obService = null;
    this.lastURI = null;
    this.showingMessage = null;
    this.missingPlugins = null;
    this.isImage = null;
    this.mimeService = null;
    this.ioService = null;
  },

  onTextEntered: function wbp_onTextEntered(event) {
  
    // Canonize the url
    var postData = { };
    this.canonizeUrl(event, postData);

    // Things may go wrong when adding url to session history,
    // but don't let that interfere with the loading of the url.
    try {
      window.parent.addToUrlbarHistory(this.URLBar.value);
    } catch (e) {}

    // Load the typed url
    this.showingMessage = false;
    this.openLink(event, postData.value);
  },
  
  onTextReverted: function wbp_onTextReverted() {
  
    // Setup variables
    var url = this.getWebNav().currentURI.spec;
    var throbberElement = window.parent.document.getElementById("sidebar-throbber");
    var isScrolling = this.URLBar.popupOpen;

    // Don't revert to last valid url unless page is NOT loading
    // and user is NOT key-scrolling through autocomplete list
    if ((!throbberElement || !throbberElement.hasAttribute("loading")) && !isScrolling) {
      if (url != "about:blank") {
        this.URLBar.value = url;
        this.URLBar.select();
      
       // If about:blank, urlbar becomes ""  
      } else 
        this.URLBar.value = "";
    }

    // Tell widget to revert to last typed text only if the user
    // was scrolling when they hit escape
    return !isScrolling;
  },

  onTitleChanged: function wbp_onTitleChanged(event) {
    
    // Only listen for top level document title
    if (event.target != gBrowser.contentDocument)
      return;
      
    // Ignore title change
    if (this.ignoreTitle) {
      this.ignoreTitle = false;
      return;
    }

    // Set on the sidebar header  
    var title = gBrowser.contentTitle;
    if (!title)
      title = document.getElementById("bundle_browser").getString("webPanels");
    var sidebarTitle = window.parent.document.getElementById("sidebar-title");
    sidebarTitle.value = title;
    
    // Persist on the sidebar box
    this.setValue("webpaneltitle", title);
  },

  onUpdatePageReport: function wbp_onUpdatePageReport(event) {
    if (!gBrowser.pageReport)
      return;
    PopupHandler.onBlocked();
  },
  
  onMissingPlugin: function wbp_onMissingPlugin(event) {
  
    if (!(event.target instanceof HTMLObjectElement))
      event.target.addEventListener("click", PluginHandler.installSinglePlugin, false);

    var pluginInfo = getPluginInfo(event.target);
    PluginHandler.onMissing(pluginInfo);
  },
    
  onPurgeHistory: function wbp_onPurgeHistory() {
  
    // Disable navigation buttons
    var backCommand = document.getElementById("Browser:Back");
    backCommand.setAttribute("disabled", "true");
    var fwdCommand = document.getElementById("Browser:Forward");
    fwdCommand.setAttribute("disabled", "true");

    // Clear undo history of the URLBar
    var urlBar = this.URLBar;   
    urlBar.editor.enableUndo(false);
    urlBar.editor.enableUndo(true);
    
    // Clear the title and source
    this.setValue("webpaneltitle", "");
    this.setValue("webpanelsrc", "");
  },
  
  onXPInstallBlocked: function wbp_onXPInstallBlocked(docShell) {

    // see if the docshell is in this browser
    var shell = this.findDocShell(gBrowser.docShell, docShell);
    if (!shell)
      return;
    XPInstallHandler.onBlocked();  
  },
    
  onURLBarDrop: function wbp_onURLBarDrop(event) {
    nsDragAndDrop.drop(event, this);  
  },
  
  onDrop: function wbp_onDrop(event, xferData, dragSession) {
    var url = transferUtils.retrieveURLFromData(xferData.data, xferData.flavour.contentType);

    // do nothing without a url
    if (!url)
      return false;

    // Check the url security
    var docurl = gBrowser.contentDocument.location.href;
    try {
      urlSecurityCheck(url, docurl);
    } catch(e) {
      return false;
    }
     
    // Try to load the URL   
    this.URLBar.value = url;
    this.onTextEntered();
    return true;
  },
   
  loadPanel: function wbp_loadPanel() {
  
    // Ignore title changes  
    this.ignoreTitle = true;
  
    // Get the title and source attributes
    var sidebarBox = window.parent.document.getElementById("sidebar-box");
    var title = sidebarBox.getAttribute("webpaneltitle");
    var defaultTitle = document.getElementById("bundle_browser").getString("webPanels");
    var src = sidebarBox.getAttribute("webpanelsrc");
    var open = sidebarBox.getAttribute("webpanelopen");
    if (open)
      sidebarBox.removeAttribute("webpanelopen");
     
    // need to do based on startup 
    var startup = this.branch.getIntPref("browser.mini.startup.page");     
    switch(startup) {
      
      // blank page
      case 0:
      default:
        if (!open) {
          title = defaultTitle;
          src = "about:blank";
        }
        break;
      
      // home page
      case 1:
        if (!open) {
          this.ignoreTitle = false;
          title = defaultTitle;
          try {
            src = this.branch.getComplexValue("browser.mini.startup.homepage", Ci.nsIPrefLocalizedString).data;
          } catch (e) {
            src = null;
          }

          // use this if we can't find the pref
          if (!src) {
            var SBS = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService);
            var configBundle = SBS.createBundle("resource:/browserconfig.properties");
            src = configBundle.GetStringFromName("browser.mini.startup.homepage");
          }        
        }
        break;
      
      // last opened
      case 2:
        break;
    }
        
    // Make sure we have a title and source
    if (!title) {
      this.ignoreTitle = false;    
      title = defaultTitle;
    }
    if (!src)
      return;
            
    // Set on the sidebar header  
    var sidebarTitle = window.parent.document.getElementById("sidebar-title");
    sidebarTitle.value = title;
    
    // Load the source
    this.URLBar.value = src;
    this.onTextEntered();
  },
  
  loadURI: function wbp_loadURI(uri, referrer, postData, allowThirdPartyFixup, mainWindow) {
    try {
      if (mainWindow) {
        window.content.focus();
        window.parent.loadURI(uri, referrer, postData, allowThirdPartyFixup);
      } else {    
        if (postData === undefined)
          postData = null;
        var flags = nsIWebNavigation.LOAD_FLAGS_NONE;
        if (allowThirdPartyFixup) {
          flags = nsIWebNavigation.LOAD_FLAGS_ALLOW_THIRD_PARTY_FIXUP;
        }
        gBrowser.contentWindow.focus();     
        this.getWebNav().loadURI(uri, flags, referrer, postData, null);
      }
    } catch (e) {}
  },

  openLink: function wbp_openLink(event, postData) {
    var url = this.URLBar.value;

    // Do nothing for right clicks
    if (event instanceof MouseEvent && event.button == 2)
        return;
  
    // check for alt enter
    if (event && event.altKey) {
      this.onTextReverted();
      window.parent.gBrowser.loadOneTab(url, null, null, postData, false, true);
      event.preventDefault();
      event.stopPropagation();
    } else
      this.loadURI(url, null, postData, true, false);   
  },
  
  openUILink: function wbp_openUILink(url, event) {
    var where = whereToOpenLink(event);
    if (where == "current" && !this.isLinked()) {
      this.loadURI(url, null, null, false, false);
    } else
      openUILink(url, event);  
  },
     
  goBack: function wbp_goBack() {
    try {
      this.getWebNav().goBack();
    } catch(e) {}
  },

  goForward: function wbp_goForward() {
    try {
      this.getWebNav().goForward();
    } catch(e) {}
  },
  
  stop: function wbp_stop() {
    try {
      const stopFlags = nsIWebNavigation.STOP_ALL;
      this.getWebNav().stop(stopFlags);
    } catch(e) {}
  },

  reload: function wbp_reload() {
    const reloadFlags = nsIWebNavigation.LOAD_FLAGS_NONE;
    return this.reloadWithFlags(reloadFlags);
  },

  reloadSkipCache: function wbp_reloadSkipCache() {
    const reloadFlags = nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY | nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE;
    return this.reloadWithFlags(reloadFlags);
  },
  
  reloadWithFlags: function wbp_reloadWithFlags(reloadFlags) {
  
    /* First, we'll try to use the session history object to reload so
     * that framesets are handled properly. If we're in a special
     * window (such as view-source) that has no session history, fall
     * back on using the web navigation's reload method.
     */
    var webNav = this.getWebNav();
    try {
      var sh = webNav.sessionHistory;
      if (sh)
        webNav = sh.QueryInterface(nsIWebNavigation);
    } catch (e) {}

    try {
      webNav.reload(reloadFlags);
    } catch (e) {}
  },

  gotoHistoryIndex: function wbp_gotoHistoryIndex(event) {
    var index = event.target.getAttribute("index");
    if (!index)
      return false;

    try {
      this.getWebNav().gotoIndex(index);
    } catch(e) {
      return false;
    }
    return true;
  },
  
  setThrobber: function wbp_setThrobber(loading) {
    var throbber = window.parent.document.getElementById("sidebar-throbber");
    if (loading)
      throbber.setAttribute("loading", "true");
    else
      throbber.removeAttribute("loading");
  },
  
  setValue: function wbp_setValue(aName, aValue) {
    var sidebarBox = window.parent.document.getElementById("sidebar-box");
    sidebarBox.setAttribute(aName, aValue);
  },
  
  getWebNav: function wbp_getWebNav() {
    try {
      return gBrowser.webNavigation;
    } catch (e) {
      return null;
    }
  },
  
  backMenu: function wbp_backMenu(event) {
    return this.fillHistoryMenu(event.target, "back");
  },

  forwardMenu: function wbp_forwardMenu(event) {
    return this.fillHistoryMenu(event.target, "forward");
  },

  fillHistoryMenu: function wbp_fillHistoryMenu(parent, menu) {
 
    // Remove old entries if any
    this.deleteHistoryItems(parent);

    var webNav = this.getWebNav();
    if (!webNav)
      return true;
      
    var sessionHistory = webNav.sessionHistory;
    var count = sessionHistory.count;
    var index = sessionHistory.index;
    var end;
    var j;
    var entry;

    switch (menu) {

    // Fill the back menu
    case "back":
      end = (index > MAX_HISTORY_MENU_ITEMS) ? index - MAX_HISTORY_MENU_ITEMS : 0;
      if ((index - 1) < end) return false;
      for (j = index - 1; j >= end; j--) {
        entry = sessionHistory.getEntryAtIndex(j, false);
        if (entry)
          this.createMenuItem(parent, j, entry.title);
      }
      break;
      
    // Fill the forward menu
    case "forward":
      end  = ((count-index) > MAX_HISTORY_MENU_ITEMS) ? index + MAX_HISTORY_MENU_ITEMS : count - 1;
      if ((index + 1) > end) return false;
      for (j = index + 1; j <= end; j++) {
        entry = sessionHistory.getEntryAtIndex(j, false);
        if (entry)
          this.createMenuItem(parent, j, entry.title);
      }
      break;
    }
    return true;
  },

  deleteHistoryItems: function wbp_deleteHistoryItems(parent) {
    var children = parent.childNodes;
    for (var i = children.length - 1; i >= 0; --i) {
      var index = children[i].getAttribute("index");
      if (index)
        parent.removeChild(children[i]);
    }
  },

  createMenuItem: function wbp_createMenuItem(parent, index, label) {
    var menuitem = document.createElement( "menuitem" );
    menuitem.setAttribute( "label", label );
    menuitem.setAttribute( "index", index );
    parent.appendChild( menuitem );
  },

  getNotifyBox: function wbp_getNotifyBox() {
    return document.getElementById("notification-box");
  },
  
  findDocShell: function wbp_findDocShell(docShell, soughtShell) {
    if (docShell == soughtShell)
      return docShell;

    var node = docShell.QueryInterface(Ci.nsIDocShellTreeNode);
    for (var i = 0; i < node.childCount; ++i) {
      var shell = node.getChildAt(i);
      shell = this.findDocShell(shell, soughtShell);
      if (shell == soughtShell)
        return shell;
    }
    return null;
  },
  
  canonizeUrl: function wbp_canonizeUrl(event, postDataRef) {
    if (!this.URLBar.value)
      return;
    var url = this.URLBar.value;

    // Only add the suffix when the URL bar value isn't already "URL-like".
    // Since this function is called from onTextEntered, which receives
    // both mouse (from the go button) and keyboard events, we also make sure not
    // to do the fixup unless we get a keyboard event, to match user expectations.
    if (!/^(www|http)|\/\s*$/i.test(url) &&
        (event instanceof KeyEvent)) {
//@line 677 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
      var accel = event.ctrlKey;
//@line 679 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
      var shift = event.shiftKey;
 
      var suffix = "";

      switch (true) {
      case (accel && shift):
        suffix = ".org/";
        break;
      case (shift):
        suffix = ".net/";
        break;
      case (accel):
        try {
          suffix = this.branch.getCharPref("browser.fixup.alternate.suffix");
          if (suffix.charAt(suffix.length - 1) != "/")
            suffix += "/";
        } catch(e) {
          suffix = ".com/";
        }
        break;
      }

      if (suffix) {
        
        // Trim leading/trailing spaces (bug 233205)
        url = url.replace(/^\s+/, "").replace(/\s+$/, "");

        // Tack www. and suffix on.  If user has appended directories, insert
        // suffix before them (bug 279035).  Be careful not to get two slashes.
        var firstSlash = url.indexOf("/");
        if (firstSlash >= 0)
          url = "http://www." + url.substring(0, firstSlash) + suffix +
                url.substring(firstSlash + 1, url.length);
        else
          url = "http://www." + url + suffix;
      }
    }

    this.URLBar.value = getShortcutOrURI(url, postDataRef);

    // URL Correction should go here. // FINDME
    return urlCorrector.doFixup(this.URLBar);    
  },
 
  displaySecurityInfo: function wbp_displaySecurityInfo() {
    BrowserPageInfo(null, "securityTab");
  },
  
  updateNavButtons: function wbp_updateNavButtons() {
    var backBroadcaster = document.getElementById("Browser:Back");
    var forwardBroadcaster = document.getElementById("Browser:Forward");
    var webNav = this.getWebNav();

    var backDisabled = backBroadcaster.hasAttribute("disabled");
    var forwardDisabled = forwardBroadcaster.hasAttribute("disabled");
    if (backDisabled == webNav.canGoBack) {
      if (backDisabled)
        backBroadcaster.removeAttribute("disabled");
      else
        backBroadcaster.setAttribute("disabled", true);
    }

    if (forwardDisabled == webNav.canGoForward) {
      if (forwardDisabled)
        forwardBroadcaster.removeAttribute("disabled");
      else
        forwardBroadcaster.setAttribute("disabled", true);
    }
  },
  
  updateStop: function wbp_updateStop(disabled) {
    var stopBroadcaster = document.getElementById("Browser:Stop");
    var stopDisabled = stopBroadcaster.hasAttribute("disabled");
    if (stopDisabled == disabled)
      return;
    
    if (stopDisabled)
      stopBroadcaster.removeAttribute("disabled");
    else
      stopBroadcaster.setAttribute("disabled", "true");
  },
  
  updateReload: function wbp_updateReload(disabled) {
    var reloadBroadcaster = document.getElementById("Browser:Reload");   
    var reloadDisabled = reloadBroadcaster.hasAttribute("disabled");
    if (reloadDisabled == disabled)
      return;
      
    if (reloadDisabled)
      reloadBroadcaster.removeAttribute("disabled");
    else
      reloadBroadcaster.setAttribute("disabled", "true");   
  },
  
  handleClick: function wbp_handleClick(event) {
    
    // Handle the click 
    var rv = this.internalClick(event);
    
    // Show message if handled internally but in linked mode
    if (this.isLinked()) {
      if (rv == "message") {
        this.showMessage();
        rv = true;
      } else
        this.hideMessage();  
    } 
    return rv;
  },
  
  internalClick: function wbp_internalClick(event) {
  
    // allow gecko to handle untrusted events
    if (!event.isTrusted)
      return true;

    // determine where the link would open.
    // Ignore middle click so we can handle middle click paste    
    var where = whereToOpenLink(event, true, false);
    if (where != "current")
      return window.parent.contentAreaClick(event, true);
 
    // get the link node
    var target = event.target;
    var linkNode = this.determineLinkNode(target, event);
    
    // handle clicking on a link node
    var wrapper = null;
    if (linkNode) {
      wrapper = linkNode;
      
      // left mouse button
      if (event.button == 0) {

        // handle clicks with no target or targeting the main browser
        target = wrapper.getAttribute("target");
        var docWrapper = wrapper.ownerDocument;
        var locWrapper = docWrapper.location;
        if (!target || target == "_content" || target  == "_main") {
        
          // allow gecko to handle links without an href
          if (!wrapper.href)
            return true;
            
          // check the security
          try {
            urlSecurityCheck(wrapper.href, locWrapper.href)
          } catch(e) {
            return false;
          }

          // allow gecko to handle link with onclick
          if (wrapper.hasAttribute("onclick"))
            return "message";
                          
          // javascript links should be executed in the current browser
          if (wrapper.href.substr(0, 11) === "javascript:")
            return "message";
         
          // data links should be executed in the current browser
          if (wrapper.href.substr(0, 5) === "data:")
            return "message";
          
          // xpi links should be executed in the current browser
          var uri = this.ioService.newURI(wrapper.href, null, null);
          var mime = null;
          try {
            mime = this.mimeService.getTypeFromURI(uri);
          } catch(e) {}
          if (mime == "application/x-xpinstall")
            return "true";
            
          // we are going to load the url regardless if it is javascript or data
          var postData = { };
          var url = getShortcutOrURI(wrapper.href, postData);
          if (!url)
            return true;
          this.loadURI(url, null, postData.value, false, this.isLinked());
          event.preventDefault();
          return false;
           
        // handle clicks with a target of sidebar
        } else if (linkNode.getAttribute("rel") == "sidebar") {
         
           // This is the Opera convention for a special link that - when clicked - allows
           // you to add a sidebar panel.  We support the Opera convention here.  The link's
           // title attribute contains the title that should be used for the sidebar panel.
           var dialogArgs = {
             name: wrapper.getAttribute("title"),
             url: wrapper.href,
             bWebPanel: true
           }
//@line 872 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
           openDialog("chrome://browser/content/bookmarks/addBookmark2.xul", "",
                      BROWSER_ADD_BM_FEATURES, dialogArgs);
           event.preventDefault();
//@line 878 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
           return false;

         // handle clicks with a target of search           
         } else if (target == "_search") {
         
           // Used in WinIE as a way of transiently loading pages in a sidebar.  We
           // mimic that WinIE functionality here and also load the page transiently.

           // javascript links targeting the sidebar shouldn't be allowed
           // we copied this from IE, and IE blocks this completely
           if (wrapper.href.substr(0, 11) === "javascript:")
             return false;

           // data: URIs are just as dangerous
           if (wrapper.href.substr(0, 5) === "data:")
             return false;

           // security check the link
           try {
             urlSecurityCheck(wrapper.href, locWrapper.href);
           } catch(e) {
             return false;
           }

           // open the web panel
           openWebPanel(this.bundle.getString("webPanels"), wrapper.href);
           event.preventDefault();
           return false;
         
         // any other target
         } else 
         return "message";
         
       // middle mouse button or right mouse
       } else
         return window.parent.contentAreaClick(event, true);

       // if anything falls through our handling pass it back to gecko
       return "message";
     
     // no link node found try xlink  
     } else {

       var href, realHref, baseURI;
       linkNode = target;
       while (linkNode) {
         if (linkNode.nodeType == Node.ELEMENT_NODE) {
           wrapper = linkNode;

           realHref = wrapper.getAttributeNS("http://www.w3.org/1999/xlink", "href");
           if (realHref) {
             href = realHref;
             baseURI = wrapper.baseURI
           }
         }
         linkNode = linkNode.parentNode;
       }
       
       // we found an xlink so handle it
       if (href) {
       
         // left click
         if (event.button == 0) {
           href = window.parent.makeURLAbsolute(baseURI, href);
           this.loadURI(href, null, null, false, this.isLinked());
           event.preventDefault();
           return false;
           
         // middle or right click
         } else
           return window.parent.contentAreaClick(event, true);
       }
     }
   
     // we hit here if there was not a link node or xlink
     if (event.button == 1 && !event.getPreventDefault() &&
         this.branch.getBoolPref("middlemouse.contentLoadURL") &&
         !this.branch.getBoolPref("general.autoScroll"))
       middleMousePaste(event);
       
    // let gecko handle
    return true;
  },
  
  showMessage: function wbp_showMessage() {

    // Message disabled
    var show = this.branch.getBoolPref("browser.mini.showMessage");
    if (!show)
      return;

    var notifyBox = this.getNotifyBox();
    var notification = notifyBox.getNotificationWithValue("linked-message");
    if (!notification) {
      var message = this.bundle.getString("linkedCmd.message");
      var self = this;
      var buttons = [{
        label: this.bundle.getString("linkedCmd.button"),
        accessKey: this.bundle.getString("linkedCmd.accesskey"),
        callback: function() { self.disableMessage(); }
      }];
      const priority = notifyBox.PRIORITY_INFO_MEDIUM;
      notifyBox.appendNotification(message, "linked-message",
                                   "chrome://browser/skin/Info.png",
                                   priority, buttons);          
    }
    this.showingMessage = true;    
  },
  
  hideMessage: function wbp_hideMessage() {
    this.showingMessage = false;
    var notifyBox = this.getNotifyBox();
    var notification = notifyBox.getNotificationWithValue("linked-message");
    if (notification)
      notifyBox.removeNotification(notification);
  },
  
  disableMessage: function wbp_disableMessage() {
    this.showingMessage = false;
    this.branch.setBoolPref("browser.mini.showMessage", false);
  },
  
  determineLinkNode: function wbp_determineLinkNode(target, event) {

    // target should have an href attribute
    var linkNode = null;
    if (target instanceof HTMLAnchorElement ||
        target instanceof HTMLAreaElement ||
        target instanceof HTMLLinkElement) {
      if (target.hasAttribute("href"))
        linkNode = target;

      // xxxmpc: this is kind of a hack to work around a Gecko bug (see bug 266932)
      // we're going to walk up the DOM looking for a parent link node,
      // this shouldn't be necessary, but we're matching the existing behaviour for left click
      var parent = target.parentNode;
      while (parent) {
        if (parent instanceof HTMLAnchorElement ||
            parent instanceof HTMLAreaElement ||
            parent instanceof HTMLLinkElement) {
            if (parent.hasAttribute("href"))
              linkNode = parent;
        }
        parent = parent.parentNode;
      }
      
      // return the found linkNode
      return linkNode;
    }
   
    // walk up the from the target and see if we hit a link
    linkNode = event.originalTarget;
    while (linkNode && !(linkNode instanceof HTMLAnchorElement))
      linkNode = linkNode.parentNode;
     
    // <a> cannot be nested.  So if we find an anchor without an
    // href, there is no useful <a> around the target
    if (linkNode && !linkNode.hasAttribute("href"))
      linkNode = null;
  
    // return the found linkNode
    return linkNode;
  },
  
  fillInHTMLTooltip: function wbp_fillInHTMLTooltip(tipElement) {
    var retVal = false;
    if (tipElement.namespaceURI == "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul")
      return retVal;

    const XLinkNS = "http://www.w3.org/1999/xlink";
    var titleText = null;
    var XLinkTitleText = null;

    while (!titleText && !XLinkTitleText && tipElement) {
      if (tipElement.nodeType == Node.ELEMENT_NODE) {
        titleText = tipElement.getAttribute("title");
        XLinkTitleText = tipElement.getAttributeNS(XLinkNS, "title");
      }
      tipElement = tipElement.parentNode;
    }

    var texts = [titleText, XLinkTitleText];
    var tipNode = document.getElementById("htmlTooltip");

    for (var i = 0; i < texts.length; ++i) {
      var t = texts[i];
      if (t && t.search(/\S/) >= 0) {
        // XXX - Short-term fix to bug 67127: collapse whitespace here
        tipNode.setAttribute("label", t.replace(/\s+/g, " ") );
        retVal = true;
      }
    }

    return retVal;
  },
  
  isNewURI: function wbp_isNewURI(aLocation) {
    if (!this.lastURI)
      return true;

    var oldSpec = this.lastURI.spec;
    var oldIndexOfHash = oldSpec.indexOf("#");
    if (oldIndexOfHash != -1)
      oldSpec = oldSpec.substr(0, oldIndexOfHash);
    var newSpec = aLocation.spec;
    var newIndexOfHash = newSpec.indexOf("#");
    if (newIndexOfHash != -1)
      newSpec = newSpec.substr(0, newSpec.indexOf("#"));
    return (oldSpec != newSpec);
  },
    
  isLinked: function wbp_isLinked() {
    var btn = document.getElementById("linked-button");
    return (btn.getAttribute("checked") == "true");
  },
    
  toggleLinked: function wbp_toggleLinked() {
    var btn = document.getElementById("linked-button");
    if (btn.getAttribute("checked") == "true") {
      btn.setAttribute("checked", "false");
      btn.setAttribute("tooltiptext", this.bundle.getString("linkedCmd.false"));
    } else {
      btn.setAttribute("checked", "true");
      btn.setAttribute("tooltiptext", this.bundle.getString("linkedCmd.true"));
    }
  },
    
  toggleAutoFill: function wbp_toggleAutoFill() {

    var prefValue = false;
    try {
      prefValue = this.branch.getBoolPref(PREF_AUTOFILL);
    } catch (e) {}

    if (prefValue)
      this.URLBar.setAttribute("completedefaultindex", "true");
    else
      this.URLBar.removeAttribute("completedefaultindex");
  },
  
  toggleSelectsAll: function wbp_toggleSelectsAll() {

    var prefValue = false;
    try {
      prefValue = this.branch.getBoolPref(PREF_SELECTSALL);
    } catch (e) {}

    if (prefValue)
      this.URLBar.setAttribute("clickSelectsAll", "true");
    else
      this.URLBar.removeAttribute("clickSelectsAll");
  },
  
  getSupportedFlavours: function wbp_getSupportedFlavours() {
      var flavourSet = new FlavourSet();

      // Plain text drops are often misidentified as "text/x-moz-url", so favor plain text.
      flavourSet.appendFlavour("text/unicode");
      flavourSet.appendFlavour("text/x-moz-url");
      flavourSet.appendFlavour("application/x-moz-file", "nsIFile");
      return flavourSet;
  },
            
  onProgressChange: function wbp_onProgressChange(webProgress, request, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress) {},
  onStatusChange: function wbp_onStatusChange(webProgress, request, status, message) {},
  onSecurityChange: function wbp_onSecurityChange(webProgress, request, state) {
    const wpl = Ci.nsIWebProgressListener;

    // Set the security level on the urlbar
    switch (state) {
      case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_HIGH:
        this.URLBar.setAttribute("level", "high");
        break;
      case wpl.STATE_IS_SECURE | wpl.STATE_SECURE_LOW:
        this.URLBar.setAttribute("level", "low");
        break;
      case wpl.STATE_IS_BROKEN:
        this.URLBar.setAttribute("level", "broken");
        break;
      case wpl.STATE_IS_INSECURE:
      default:
        this.URLBar.removeAttribute("level");
        break;
    }

    // Set the lock icon tooltiptext
    var lockIcon = document.getElementById("lock-icon");
    var securityUI = gBrowser.securityUI;
    if (lockIcon)
      lockIcon.setAttribute("tooltiptext", securityUI.tooltipText);
  },
  
  onLocationChange: function wbp_onLocationChange(webProgress, request, location) {
    
    // Remove old notifications
    if (this.isNewURI(location)) {
      var notifyBox = this.getNotifyBox();
      if (this.showingMessage) {
        var notification = notifyBox.getNotificationWithValue("linked-message");
        if (notification) {
          var allNotifications = notifyBox.allNotifications;
          for (var n = allNotifications.length -1; n >= 0; n--) {
            if (allNotifications[n].value != "linked-message")
              notifyBox.removeNotification(allNotifications[n]);
          }
        }      
        this.showingMessage = false;
      } else
        notifyBox.removeAllNotifications(true);
    }
    
    // save the previous location
    this.lastURI = location;
    
    // clear the missing plugin array
    this.missingPlugins = null;
    
    // test if dom image
    var domw = webProgress.DOMWindow;   
    this.testIsImage(domw);
        
    // Update the reload button      
    var loc = location.spec;
    if (loc == "about:blank" || loc == "")  {
      loc = "";         
      this.updateReload(true);
    } else
      this.updateReload(false);

    // update the find field
    var findField = document.getElementById("find-field");
    if (findField)
      setTimeout(function() { findField.value = gBrowser.findString; }, 0, findField, gBrowser);
        
    if (loc) {
       try {
         var locationURI = this.URIFixup.createExposableURI(loc);
         loc = locationURI.spec;
       } catch (e) {}
    }
        
    // update the urlbar
    this.URLBar.value = ""; 
    this.URLBar.value = loc;
  
    // Update the back forward buttons
    this.updateNavButtons();
      
    // Close the Find toolbar if we're in old-style TAF mode
    if (findField && gFindBar.mFindMode != FIND_NORMAL)
      gFindBar.closeFindBar();

    //fix bug 253793 - turn off highlight when page changes
    if (document.getElementById("highlight").checked)
      document.getElementById("highlight").removeAttribute("checked");
        
    // Persist the source on the sidebar box
    this.setValue("webpanelsrc", this.URLBar.value);
  },
  
  onStateChange: function wbp_onStateChange(webProgress, request, stateFlags, status) {
    const nsIWebProgressListener = Ci.nsIWebProgressListener;
    const nsIChannel = Ci.nsIChannel;
  
    // No Request
    if (!request)
      return;

    // Ignore local/resource:/chrome: files
    if (status == NS_NET_STATUS_READ_FROM || status == NS_NET_STATUS_WROTE_TO)
      return;

    // start the throbber and enable stop button    
    var domw = webProgress.DOMWindow;   
    if (stateFlags & nsIWebProgressListener.STATE_START &&
        stateFlags & nsIWebProgressListener.STATE_IS_NETWORK) {
      this.setThrobber(true);
      this.updateStop(true); 

    // stop the throbber and disable the stop button            
    } else if (stateFlags & nsIWebProgressListener.STATE_STOP &&
               stateFlags & nsIWebProgressListener.STATE_IS_NETWORK) {
      this.setThrobber(false);
      this.updateStop(true); 
      this.testIsImage(domw);                  
      setTimeout(function() { if (document.getElementById("highlight").checked) toggleHighlight(true); }, 0);
    }    
  },
  
  mimeTypeIsTextBased: function wbp_mimeTypeIsTextBased(contentType) {
    return /^text\/|\+xml$/.test(contentType) ||
           contentType == "application/x-javascript" ||
           contentType == "application/xml" ||
           contentType == "mozilla.application/cached-xul";
  },
  
  testIsImage: function wbp_testIsImage(domw) {
    if (domw.document && this.mimeTypeIsTextBased(domw.document.contentType))
      this.isImage.removeAttribute('disabled');
    else
      this.isImage.setAttribute('disabled', 'true');      
  },
    
  observe: function wbp_observe(subject, topic, data) {
  
    switch (topic) {

    // The purge topic    
    case TOPIC_PURGE:
      this.onPurgeHistory();
      break;
    
    // XPInstall blocked topic
    case TOPIC_XPINSTALL:
      var shell = subject.QueryInterface(Ci.nsIDocShell);
      this.onXPInstallBlocked(shell);
      break;
      
    // The pref changed topic  
    case TOPIC_PREF:
      if (data == PREF_AUTOFILL)
        this.toggleAutoFill();
      else if (data == PREF_SELECTSALL)
        this.toggleSelectsAll();
      break;
    }
  },
  
  QueryInterface: function wbp_QI(iid) {
    if (iid.equals(Ci.nsIWebProgressListener) ||
        iid.equals(Ci.nsIObserver) ||
        iid.equals(Ci.nsISupportsWeakReference) ||
        iid.equals(Ci.nsISupports))
      return this;
    throw Cr.NS_NOINTERFACE;
  }
};
/*******************************************************************************
 * Context Menu object.
 ******************************************************************************/
function nsContextMenu( xulMenu ) {
    this.target            = null;
    this.menu              = null;
    this.onTextInput       = false;
    this.onKeywordField    = false;
    this.onImage           = false;
    this.onLoadedImage     = false;
    this.onLink            = false;
    this.onMailtoLink      = false;
    this.onSaveableLink    = false;
    this.onMetaDataItem    = false;
    this.onMathML          = false;
    this.link              = false;
    this.linkURL           = "";
    this.linkURI           = null;
    this.linkProtocol      = null;
    this.inFrame           = false;
    this.hasBGImage        = false;
    this.isTextSelected    = false;
    this.isContentSelected = false;
    this.inDirList         = false;
    this.shouldDisplay     = true;
    this.isDesignMode      = false;
    this.possibleSpellChecking = false;

    // Initialize new menu.
    this.initMenu( xulMenu );
}

// Prototype for nsContextMenu "class."
nsContextMenu.prototype = {
    
    // Initialize context menu.
    initMenu: function ctx_initMenu(popup) {
        // Save menu.
        this.menu = popup;

        // Get contextual info.
        this.setTarget( document.popupNode, document.popupRangeParent,
                        document.popupRangeOffset );

        this.isTextSelected = this.isTextSelection();
        this.isContentSelected = this.isContentSelection();

        // Initialize (disable/remove) menu items.
        this.initItems();
    },
    
    initItems: function ctx_initItems() {
        this.initOpenItems();
        this.initNavItems();
        this.initViewItems();
        this.initMiscItems();
        this.initSpellingItems();
        this.initSaveItems();
        this.initClipboardItems();
        this.initMetadataItems();
    },
    
    initOpenItems: function ctx_initOpenItems() {
        var shouldShow = this.onSaveableLink || (this.inDirList && this.onLink);
        this.showItem( "context-openlink", shouldShow);
        this.showItem( "context-openlinkintab", shouldShow);
        this.showItem( "context-openlinkinsidebar", shouldShow);
        this.showItem( "context-sep-open", shouldShow);
    },
    
    initNavItems: function ctx_initNavItems() {
        var shouldShow = !(this.isContentSelected || this.onLink || this.onImage || this.onTextInput);
        this.showItem( "context-back", shouldShow);
        this.showItem( "context-forward", shouldShow);
        this.showItem( "context-reload", shouldShow);
        this.showItem( "context-stop", shouldShow);
        this.showItem( "context-sep-stop", shouldShow);
    },
    
    initSaveItems: function ctx_initSaveItems() {
        var shouldShow = !(this.inDirList || this.isContentSelected || this.onTextInput || this.onLink || this.onImage);
        this.showItem( "context-savepage", shouldShow);
        this.showItem( "context-sendpage", shouldShow);

        // Save+Send link depends on whether we're in a link.
        this.showItem( "context-savelink", this.onSaveableLink );
        this.showItem( "context-sendlink", this.onSaveableLink );
        this.showItem( "context-linkpadlink", this.onSaveableLink );
        
        // Save+Send image depends on whether we're on an image.
        this.showItem( "context-saveimage", this.onLoadedImage );
        this.showItem( "context-sendimage", this.onImage );
    },
    
    initViewItems: function ctx_initViewItems() {
        // View source is always OK, unless in directory listing.
        this.showItem( "context-viewpartialsource-selection",  this.isContentSelected);
        this.showItem( "context-viewpartialsource-mathml", this.onMathML && !this.isContentSelected);
        
        var shouldShow = !(this.inDirList || this.onImage || this.isContentSelected || this.onLink || this.onTextInput);
        this.showItem( "context-viewsource", shouldShow);
        this.showItem( "context-viewinfo", shouldShow);

        this.showItem( "context-sep-properties", !( this.inDirList || this.isContentSelected || this.onTextInput ) );
        
        // Set as Desktop background depends on whether an image was clicked on,
        // and only works if we have a shell service.
        var haveSetDesktopBackground = false;
//@line 1424 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
        // Only enable Set as Desktop Background if we can get the shell service.
        var shell = getShellService();
        if (shell)
          haveSetDesktopBackground = true;
//@line 1429 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
        this.showItem( "context-setDesktopBackground", haveSetDesktopBackground && this.onLoadedImage );

        if ( haveSetDesktopBackground && this.onLoadedImage )
            this.setItemAttr( "context-setDesktopBackground", "disabled", this.disableSetDesktopBackground());

        // View Image depends on whether an image was clicked on.
        this.showItem( "context-viewimage", this.onImage  && ( !this.onStandaloneImage || this.inFrame ) );

        // View background image depends on whether there is one.
        this.showItem( "context-viewbgimage", shouldShow);
        this.showItem( "context-sep-viewbgimage", shouldShow);
        this.setItemAttr( "context-viewbgimage", "disabled", this.hasBGImage ? null : "true");
    },
    
    initMiscItems: function ctx_initMiscItems() {
        // Use "Bookmark This Link" if on a link.
        this.showItem( "context-bookmarkpage", !( this.isContentSelected || this.onTextInput || this.onLink || this.onImage ) );
        this.showItem( "context-bookmarklink", this.onLink && !this.onMailtoLink );
        this.showItem( "context-searchselect", this.isTextSelected);
        this.showItem( "context-keywordfield", this.onTextInput && this.onKeywordField );
        this.showItem( "frame", this.inFrame );
        this.showItem( "frame-sep", this.inFrame );

        // BiDi UI
        this.showItem( "context-sep-bidi", gBidiUI);
        this.showItem( "context-bidi-text-direction-toggle", this.onTextInput && gBidiUI);
        this.showItem( "context-bidi-page-direction-toggle", !this.onTextInput && gBidiUI);


        if (this.onImage) {
          var blockImage = document.getElementById("context-blockimage");

          var uri = this.target.QueryInterface(Ci.nsIImageLoadingContent).currentURI;

          var hostLabel;
          // this throws if the image URI doesn't have a host (eg, data: image URIs)
          // see bug 293758 for details
          try {
            hostLabel = uri.host;
          } catch (ex) { }

          if (hostLabel) {
            var shortenedUriHost = hostLabel.replace(/^www\./i,"");
            if (shortenedUriHost.length > 15)
              shortenedUriHost = shortenedUriHost.substr(0,15) + "...";
            blockImage.label = WebPanels.bundle.getFormattedString("blockImages", [shortenedUriHost]);

            if (this.isImageBlocked())
              blockImage.setAttribute("checked", "true");
            else
              blockImage.removeAttribute("checked");
          }
        }

        // Only show the block image item if the image can be blocked
        this.showItem( "context-blockimage", this.onImage && hostLabel); 
    },
    
    initSpellingItems: function ctx_initSpellingItems() {
        var canSpell = InlineSpellCheckerUI.canSpellCheck;
        var onMisspelling = InlineSpellCheckerUI.overMisspelling;
        this.showItem("spell-check-enabled", canSpell);
        this.showItem("spell-separator", canSpell || this.possibleSpellChecking);
        if (canSpell)
            document.getElementById("spell-check-enabled").setAttribute("checked",
                                                                        InlineSpellCheckerUI.enabled);
        this.showItem("spell-add-to-dictionary", onMisspelling);

        // suggestion list
        this.showItem("spell-suggestions-separator", onMisspelling);
        if (onMisspelling) {
            var menu = document.getElementById("contentAreaContextMenu");
            var suggestionsSeparator = document.getElementById("spell-add-to-dictionary");
            var numsug = InlineSpellCheckerUI.addSuggestionsToMenu(menu, suggestionsSeparator, 5);
            this.showItem("spell-no-suggestions", numsug == 0);
        } else {
            this.showItem("spell-no-suggestions", false);
        }

        // dictionary list
        this.showItem("spell-dictionaries", InlineSpellCheckerUI.enabled);
        if (canSpell) {
            var dictMenu = document.getElementById("spell-dictionaries-menu");
            var dictSep = document.getElementById("spell-language-separator");
            InlineSpellCheckerUI.addDictionaryListToMenu(dictMenu, dictSep);
            this.showItem("spell-add-dictionaries-main", false);
        } else if (this.possibleSpellChecking) {
            // when there is no spellchecker but we might be able to spellcheck
            // add the add to dictionaries item. This will ensure that people
            // with no dictionaries will be able to download them
            this.showItem("spell-add-dictionaries-main", true);
        } else {
            this.showItem("spell-add-dictionaries-main", false);
        }
    },
    
    initClipboardItems: function ctx_initClipboardItems() {

        // Copy depends on whether there is selected text.
        // Enabling this context menu item is now done through the global
        // command updating system
        // this.setItemAttr( "context-copy", "disabled", !this.isTextSelected() );

        goUpdateGlobalEditMenuItems();

        this.showItem( "context-undo", this.onTextInput );
        this.showItem( "context-sep-undo", this.onTextInput );
        this.showItem( "context-cut", this.onTextInput );
        this.showItem( "context-copy", this.isContentSelected || this.onTextInput );
        this.showItem( "context-paste", this.onTextInput );
        this.showItem( "context-delete", this.onTextInput );
        this.showItem( "context-sep-paste", this.onTextInput );
        this.showItem( "context-selectall", !( this.onLink || this.onImage ) || this.isDesignMode );
        this.showItem( "context-sep-selectall", this.isContentSelected );

        // XXX dr
        // ------
        // nsDocumentViewer.cpp has code to determine whether we're
        // on a link or an image. we really ought to be using that...

        // Copy email link depends on whether we're on an email link.
        this.showItem( "context-copyemail", this.onMailtoLink );

        // Copy link location depends on whether we're on a link.
        this.showItem( "context-copylink", this.onLink );
        this.showItem( "context-sep-copylink", this.onLink && this.onImage);

//@line 1557 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
        // Copy image contents depends on whether we're on an image.
        this.showItem( "context-copyimage-contents", this.onImage );
//@line 1560 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
        // Copy image location depends on whether we're on an image.
        this.showItem( "context-copyimage", this.onImage );
        this.showItem( "context-sep-copyimage", this.onImage );
    },
    
    initMetadataItems: function ctx_initMetadataItems() {
        // Show if user clicked on something which has metadata.
        this.showItem( "context-metadata", this.onMetaDataItem );
    },
    
    // Set various context menu attributes based on the state of the world.
    setTarget: function ctx_setTarget(node, rangeParent, rangeOffset) {
        const xulNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
        if ( node.namespaceURI == xulNS ) {
          this.shouldDisplay = false;
          return;
        }

        // Initialize contextual info.
        this.onImage           = false;
        this.onLoadedImage     = false;
        this.onStandaloneImage = false;
        this.onMetaDataItem    = false;
        this.onTextInput       = false;
        this.onKeywordField    = false;
        this.imageURL          = "";
        this.onLink            = false;
        this.linkURL           = "";
        this.linkURI           = null;
        this.linkProtocol      = "";
        this.onMathML          = false;
        this.inFrame           = false;
        this.hasBGImage        = false;
        this.bgImageURL        = "";
        this.possibleSpellChecking = false;

        // Clear any old spellchecking items from the menu, this used to
        // be in the menu hiding code but wasn't getting called in all
        // situations. Here, we can ensure it gets cleaned up any time the
        // menu is shown. Note: must be before uninit because that clears the
        // internal vars
        InlineSpellCheckerUI.clearSuggestionsFromMenu();
        InlineSpellCheckerUI.clearDictionaryListFromMenu();

        InlineSpellCheckerUI.uninit();

        // Remember the node that was clicked.
        this.target = node;
        
        // Remember the URL of the document containing the node
        // for referrer header and for security checks.
        this.docURL = node.ownerDocument.location.href;

        // First, do checks for nodes that never have children.
        if ( this.target.nodeType == Node.ELEMENT_NODE ) {
            // See if the user clicked on an image.
            if ( this.target instanceof Ci.nsIImageLoadingContent && this.target.currentURI  ) {
                this.onImage = true;
                this.onMetaDataItem = true;
                        
                var request = this.target.getRequest( Ci.nsIImageLoadingContent.CURRENT_REQUEST );
                if (request && (request.imageStatus & request.STATUS_SIZE_AVAILABLE))
                    this.onLoadedImage = true;
                this.imageURL = this.target.currentURI.spec;

                if ( this.target.ownerDocument instanceof ImageDocument)
                   this.onStandaloneImage = true;
            } else if ( this.target instanceof HTMLInputElement ) {
               this.onTextInput = this.isTargetATextBox(this.target);
               // allow spellchecking UI on all writable text boxes except passwords
               if (this.onTextInput && ! this.target.readOnly && this.target.type != "password") {
                   this.possibleSpellChecking = true;
                   InlineSpellCheckerUI.init(this.target.QueryInterface(Ci.nsIDOMNSEditableElement).editor);
                   InlineSpellCheckerUI.initFromEvent(rangeParent, rangeOffset);
               }
               this.onKeywordField = this.isTargetAKeywordField(this.target);
            } else if ( this.target instanceof HTMLTextAreaElement ) {
                 this.onTextInput = true;
                 if (! this.target.readOnly) {
                     this.possibleSpellChecking = true;
                     InlineSpellCheckerUI.init(this.target.QueryInterface(Ci.nsIDOMNSEditableElement).editor);
                     InlineSpellCheckerUI.initFromEvent(rangeParent, rangeOffset);
                 }
            } else if ( this.target instanceof HTMLHtmlElement ) {
               // pages with multiple <body>s are lame. we'll teach them a lesson.
               var bodyElt = this.target.ownerDocument.getElementsByTagName("body")[0];
               if ( bodyElt ) {
                 var computedURL = this.getComputedURL( bodyElt, "background-image" );
                 if ( computedURL ) {
                   this.hasBGImage = true;
                   this.bgImageURL = window.parent.makeURLAbsolute( bodyElt.baseURI, computedURL );
                 }
               }
            } else if ( "HTTPIndex" in this.target.ownerDocument &&
                        this.target.ownerDocument.HTTPIndex instanceof Ci.nsIHTTPIndex ) {
                this.inDirList = true;
                // Bubble outward till we get to an element with URL attribute
                // (which should be the href).
                var root = this.target;
                while ( root && !this.link ) {
                    if ( root.tagName == "tree" ) {
                        // Hit root of tree; must have clicked in empty space;
                        // thus, no link.
                        break;
                    }
                    if ( root.getAttribute( "URL" ) ) {
                        // Build pseudo link object so link-related functions work.
                        this.onLink = true;
                        this.link = { href : root.getAttribute("URL"),
                                      getAttribute: function (attr) {
                                          if (attr == "title") {
                                              return root.firstChild.firstChild.getAttribute("label");
                                          } else {
                                              return "";
                                          }
                                      }
                                    };
                        // If element is a directory, then you can't save it.
                        if ( root.getAttribute( "container" ) == "true" ) {
                            this.onSaveableLink = false;
                        } else {
                            this.onSaveableLink = true;
                        }
                    } else {
                        root = root.parentNode;
                    }
                }
            }
        }

        // Second, bubble out, looking for items of interest that can have childen.
        // Always pick the innermost link, background image, etc.
        
        const XMLNS = "http://www.w3.org/XML/1998/namespace";
        var elem = this.target;
        while ( elem ) {
            if ( elem.nodeType == Node.ELEMENT_NODE ) {
            
                // Link?
                if ( !this.onLink &&
                     ( (elem instanceof HTMLAnchorElement && elem.href) ||
                        elem instanceof HTMLAreaElement ||
                        elem instanceof HTMLLinkElement ||
                        elem.getAttributeNS( "http://www.w3.org/1999/xlink", "type") == "simple" ) ) {
                    
                    // Target is a link or a descendant of a link.
                    this.onLink = true;
                    this.onMetaDataItem = true;

                    // xxxmpc: this is kind of a hack to work around a Gecko bug (see bug 266932)
                    // we're going to walk up the DOM looking for a parent link node,
                    // this shouldn't be necessary, but we're matching the existing behaviour for left click
                    var realLink = elem;
                    var parent = elem.parentNode;
                    while (parent) {
                      try {
                        if ( (parent instanceof HTMLAnchorElement && elem.href) ||
                             parent instanceof HTMLAreaElement ||
                             parent instanceof HTMLLinkElement ||
                             parent.getAttributeNS( "http://www.w3.org/1999/xlink", "type") == "simple")
                          realLink = parent;
                      } catch (e) {}
                      parent = parent.parentNode;
                    }
                    
                    // Remember corresponding element.
                    this.link = realLink;
                    this.linkURL = this.getLinkURL();
                    this.linkURI = this.getLinkURI();
                    this.linkProtocol = this.getLinkProtocol();
                    this.onMailtoLink = (this.linkProtocol == "mailto");
                    this.onSaveableLink = this.isLinkSaveable( this.link );
                }

                // Metadata item?
                if ( !this.onMetaDataItem ) {
                    // We display metadata on anything which fits
                    // the below test, as well as for links and images
                    // (which set this.onMetaDataItem to true elsewhere)
                    if ( ( elem instanceof HTMLQuoteElement && elem.cite)    ||
                         ( elem instanceof HTMLTableElement && elem.summary) ||
                         ( elem instanceof HTMLModElement &&
                             ( elem.cite || elem.dateTime ) )                ||
                         ( elem instanceof HTMLElement &&
                             ( elem.title || elem.lang ) )                   ||
                         elem.getAttributeNS(XMLNS, "lang") ) {
                        this.onMetaDataItem = true;
                    }
                }

                // Background image?  Don't bother if we've already found a
                // background image further down the hierarchy.  Otherwise,
                // we look for the computed background-image style.
                if ( !this.hasBGImage ) {
                    var bgImgUrl = this.getComputedURL( elem, "background-image" );
                    if ( bgImgUrl ) {
                        this.hasBGImage = true;
                        this.bgImageURL = window.parent.makeURLAbsolute( elem.baseURI, bgImgUrl );
                    }
                }
            }
            elem = elem.parentNode;
        }
        
        // See if the user clicked on MathML
        const NS_MathML = "http://www.w3.org/1998/Math/MathML";
        if ((this.target.nodeType == Node.TEXT_NODE &&
             this.target.parentNode.namespaceURI == NS_MathML)
             || (this.target.namespaceURI == NS_MathML))
          this.onMathML = true;

        // See if the user clicked in a frame.
        var doc = gBrowser.contentDocument;
        if ( this.target.ownerDocument != doc ) {
            this.inFrame = true;
        }

        // if the document is editable, show context menu like in text inputs
        var win = this.target.ownerDocument.defaultView;
        if (win) {
          var editingSession = win.QueryInterface(Ci.nsIInterfaceRequestor)
                                  .getInterface(Ci.nsIWebNavigation)
                                  .QueryInterface(Ci.nsIInterfaceRequestor)
                                  .getInterface(Ci.nsIEditingSession);
          if (editingSession.windowIsEditable(win)) {
            this.onTextInput       = true;
            this.onKeywordField    = false;
            this.onImage           = false;
            this.onLoadedImage     = false;
            this.onMetaDataItem    = false;
            this.onMathML          = false;
            this.inFrame           = false;
            this.hasBGImage        = false;
            this.isDesignMode      = true;
            this.possibleSpellChecking = true;
            InlineSpellCheckerUI.init(editingSession.getEditorForWindow(win));
            var canSpell = InlineSpellCheckerUI.canSpellCheck;
            InlineSpellCheckerUI.initFromEvent(rangeParent, rangeOffset);
            this.showItem("spell-check-enabled", canSpell);
            this.showItem("spell-separator", canSpell);
          }
        }
    },
    
    // Returns the computed style attribute for the given element.
    getComputedStyle: function ctx_getComputedStyle(elem, prop) {
         return elem.ownerDocument.defaultView.getComputedStyle( elem, '' ).getPropertyValue( prop );
    },
    
    // Returns a "url"-type computed style attribute value, with the url() stripped.
    getComputedURL: function ctx_getComputedURL(elem, prop) {
         var url = elem.ownerDocument.defaultView.getComputedStyle( elem, '' ).getPropertyCSSValue( prop );
         return ( url.primitiveType == CSSPrimitiveValue.CSS_URI ) ? url.getStringValue() : null;
    },
    
    // Returns true if clicked-on link targets a resource that can be saved.
    isLinkSaveable: function ctx_isLinkSaveable(link) {
        // We don't do the Right Thing for news/snews yet, so turn them off
        // until we do.
        return this.linkProtocol && !(
                 this.linkProtocol == "mailto"     ||
                 this.linkProtocol == "javascript" ||
                 this.linkProtocol == "news"       ||
                 this.linkProtocol == "snews"      );
    },

    // Open linked-to URL in a new window.
    openLink: function ctx_openLink() {
        openNewWindowWith(this.linkURL, this.docURL, null, false);
    },
    
    // Open linked-to URL in a new tab.
    openLinkInTab: function ctx_openLinkInTab() {
        openNewTabWith(this.linkURL, this.docURL, null, null, false);
    },
    
    openLinkInSidebar: function ctx_openLinkInSidebar() {
        openWebPanel(this.linkText(), this.linkURL);
    },
    
    // Open frame in a new tab.
    openFrameInTab: function ctx_openFrameInTab() {
        openNewTabWith(this.target.ownerDocument.location.href, null, null, null, false);
    },
    
    // Reload clicked-in frame.
    reloadFrame: function ctx_reloadFrame() {
        this.target.ownerDocument.location.reload();
    },
    
    // Open clicked-in frame in its own window.
    openFrame: function ctx_openFrame() {
        openNewWindowWith(this.target.ownerDocument.location.href, null, null, false);
    },
    
    // Open clicked-in frame in the same window.
    showOnlyThisFrame: function ctx_showOnlyThisFrame() {
      const nsIScriptSecMan = Ci.nsIScriptSecurityManager;
      var frameURL = this.target.ownerDocument.location.href;

      try {
        urlSecurityCheck(frameURL, gBrowser.currentURI.spec,
                         nsIScriptSecMan.DISALLOW_SCRIPT);
        WebPanels.loadURI(frameURL, null, null, false, false);             
      } catch(e) {}
    },
    
    // View Partial Source
    viewPartialSource: function ctx_viewPartialSource( context ) {
        var focusedWindow = document.commandDispatcher.focusedWindow;
        if (focusedWindow == window)
          focusedWindow = gBrowser.contentDocument;
        var docCharset = null;
        if (focusedWindow)
          docCharset = "charset=" + focusedWindow.document.characterSet;

        // "View Selection Source" and others such as "View MathML Source"
        // are mutually exclusive, with the precedence given to the selection
        // when there is one
        var reference = null;
        if (context == "selection")
          reference = focusedWindow.getSelection();
        else if (context == "mathml")
          reference = this.target;
        else
          throw "not reached";

        var docUrl = null; // unused (and play nice for fragments generated via XSLT too)
        window.openDialog("chrome://global/content/viewPartialSource.xul",
                          "_blank", "scrollbars,resizable,chrome,dialog=no",
                          docUrl, docCharset, reference, context);
    },
    
    // Open new "view source" window with the frame's URL.
    viewFrameSource: function ctx_viewFrameSource() {
        BrowserViewSourceOfDocument(this.target.ownerDocument);
    },
    
    viewInfo: function ctx_viewInfo() {
      BrowserPageInfo();
    },
    
    viewFrameInfo: function ctx_viewFrameInfo() {
      BrowserPageInfo(this.target.ownerDocument);
    },
    
    // Change current window to the URL of the image.
    viewImage: function ctx_viewImage(e) {
        const nsIScriptSecMan = Ci.nsIScriptSecurityManager;
        urlSecurityCheck( this.imageURL, gBrowser.currentURI.spec,
                          nsIScriptSecMan.DISALLOW_SCRIPT );
                          
        WebPanels.openUILink( this.imageURL, e);
    },
    
    // Change current window to the URL of the background image.
    viewBGImage: function ctx_viewBGImage(e) {
        const nsIScriptSecMan = Ci.nsIScriptSecurityManager;
        urlSecurityCheck( this.bgImageURL, gBrowser.currentURI.spec,
                          nsIScriptSecMan.DISALLOW_SCRIPT );
        WebPanels.openUILink( this.bgImageURL, e);
    },
    
    disableSetDesktopBackground: function ctx_disableSetDesktopBackground() {
        // Disable the Set as Desktop Background menu item if we're still trying
        // to load the image or the load failed.

        const nsIImageLoadingContent = Ci.nsIImageLoadingContent;
        if (!(this.target instanceof nsIImageLoadingContent))
            return true;

        if (("complete" in this.target) && !this.target.complete)
            return true;

        if (this.target.currentURI.schemeIs("javascript"))
            return true;

        var request = this.target.QueryInterface(nsIImageLoadingContent)
                                 .getRequest(nsIImageLoadingContent.CURRENT_REQUEST);
        if (!request)
            return true;

        return false;
    },
    
    setDesktopBackground: function ctx_setDesktopBackground() {
      // Paranoia: check disableSetDesktopBackground again, in case the
      // image changed since the context menu was initiated.
      if (this.disableSetDesktopBackground())
        return;

      
      urlSecurityCheck(this.target.currentURI.spec, this.docURL);

      // Confirm since it's annoying if you hit this accidentally.
      const kDesktopBackgroundURL = 
                    "chrome://browser/content/setDesktopBackground.xul";
//@line 1973 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
      // On non-Mac platforms, the Set Wallpaper dialog is modal.
      openDialog(kDesktopBackgroundURL, "",
                 "centerscreen,chrome,dialog,modal,dependent",
                 this.target);
//@line 1978 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
    },
    
    // Save URL of clicked-on frame.
    saveFrame: function ctx_saveFrame() {
        saveDocument( this.target.ownerDocument );
    },
    
    // Save URL of clicked-on link.
    saveLink: function ctx_saveLink() {
        urlSecurityCheck(this.linkURL, this.docURL);
        saveURL( this.linkURL, this.linkText(), null, true, false,
                 makeURI(this.docURL, this.target.ownerDocument.characterSet) );
    },
    
    saveToLinkpad: function ctx_saveToLinkpad() {
        urlSecurityCheck(this.linkURL, this.docURL);
        window.parent.Linkpad.saveLink(this.linkURL, this.linkText());
    },
                        
    sendLink: function ctx_sendLink() {
        MailIntegration.sendMessage( this.linkURL, "" ); // we don't know the title of the link so pass in an empty string
    },
    
    // Save URL of clicked-on image.
    saveImage: function ctx_saveImage() {
        urlSecurityCheck(this.imageURL, this.docURL);
        saveImageURL( this.imageURL, null, "SaveImageTitle", false,
                      false, makeURI(this.docURL) );
    },
    
    sendImage: function ctx_sendImage() {
        MailIntegration.sendMessage(this.imageURL, "");
    },
    

    toggleImageBlocking : function ctx_toggleImageBlocking(block) {
      var nsIPermissionManager = Ci.nsIPermissionManager;
      var permissionmanager =
        Cc["@mozilla.org/permissionmanager;1"]
                  .getService(nsIPermissionManager);

      var uri = this.target.QueryInterface(Ci.nsIImageLoadingContent).currentURI;

      permissionmanager.add(uri, "image",
                            block ? nsIPermissionManager.DENY_ACTION : nsIPermissionManager.ALLOW_ACTION);

      var savedmenu = this;
      function undoImageBlock() {
        savedmenu.toggleImageBlocking(!block);
      }

      var brandBundle = document.getElementById("bundle_brand");
      var app = brandBundle.getString("brandShortName");
      var message;
      if (block)
        message = WebPanels.bundle.getFormattedString("imageBlockedWarning",
                                                      [app, uri.host]);
      else 
        message = WebPanels.bundle.getFormattedString("imageAllowedWarning",
                                                      [app, uri.host]);

      var notifyBox = WebPanels.getNotifyBox();
      var notification = notifyBox.getNotificationWithValue("images-blocked");

      if (notification)
        notification.label = message;
      else {
        var buttons = [{
          label: WebPanels.bundle.getString("undo"),
          accessKey: WebPanels.bundle.getString("undo.accessKey"),
          callback: undoImageBlock
         }];
         const priority = notifyBox.PRIORITY_WARNING_MEDIUM;
         notifyBox.appendNotification(message, "images-blocked",
                                            "chrome://browser/skin/Info.png",
                                             priority, buttons);
      }

      // Reload the page to show the effect instantly
      WebPanels.reload();
    },
    
    isImageBlocked: function ctx_isImageBlocked() {
      var nsIPermissionManager = Ci.nsIPermissionManager;
      var permissionmanager =
        Cc["@mozilla.org/permissionmanager;1"]
          .getService(Ci.nsIPermissionManager);

      var uri = this.target.QueryInterface(Ci.nsIImageLoadingContent).currentURI;

      return permissionmanager.testPermission(uri, "image") == nsIPermissionManager.DENY_ACTION;
    },
    
    // Generate email address and put it on clipboard.
    copyEmail: function ctx_copyEmail() {
        // Copy the comma-separated list of email addresses only.
        // There are other ways of embedding email addresses in a mailto:
        // link, but such complex parsing is beyond us.
        var url = this.linkURL;

        var qmark = url.indexOf( "?" );
        var addresses;

        if ( qmark > 7 ) {                   // 7 == length of "mailto:"
            addresses = url.substring( 7, qmark );
        } else {
            addresses = url.substr( 7 );
        }

        // Let's try to unescape it using a character set
        // in case the address is not ASCII.
        try {
          var characterSet = this.target.ownerDocument.characterSet;
          const textToSubURI = Cc["@mozilla.org/intl/texttosuburi;1"]
                                         .getService(Ci.nsITextToSubURI);
          addresses = textToSubURI.unEscapeURIForUI(characterSet, addresses);
        }
        catch(ex) {
          // Do nothing.
        }

        var clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].
                        getService(Ci.nsIClipboardHelper);
        clipboard.copyString(addresses);
    },
    
    addBookmark: function ctx_addBookmark() {
      var docshell = WebPanels..getWebNav();
//@line 2107 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
      BookmarksUtils.addBookmark( docshell.currentURI.spec,
                                  docshell.document.title,
                                  docshell.document.charset,
                                  BookmarksUtils.getDescriptionFromDocument(docshell.document));
//@line 2114 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
    },
    
    addBookmarkForFrame: function ctx_addBookmarkForFrame() {
//@line 2118 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
      var doc = this.target.ownerDocument;
      var uri = doc.location.href;
      var title = doc.title;
      var description = BookmarksUtils.getDescriptionFromDocument(doc);
      if ( !title )
        title = uri;
      BookmarksUtils.addBookmark(uri, title, doc.charset, description);
//@line 2128 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
    },
    
    // Open Metadata window for node
    showMetadata: function ctx_showMetadata() {
        window.openDialog(  "chrome://browser/content/metaData.xul",
                            "_blank",
                            "scrollbars,resizable,chrome,dialog=no",
                            this.target);
    },

    ///////////////
    // Utilities //
    ///////////////


    // Show/hide one item (specified via name or the item element itself).
    showItem: function ctx_showItem(itemOrId, show) {
        var item = itemOrId.constructor == String ? document.getElementById(itemOrId) : itemOrId;
        if (item)
          item.hidden = !show;
    },
    
    // Set given attribute of specified context-menu item.  If the
    // value is null, then it removes the attribute (which works
    // nicely for the disabled attribute).
    setItemAttr: function ctx_setItemAttr(id, attr, val) {
        var elem = document.getElementById( id );
        if ( elem ) {
            if ( val == null ) {
                // null indicates attr should be removed.
                elem.removeAttribute( attr );
            } else {
                // Set attr=val.
                elem.setAttribute( attr, val );
            }
        }
    },
    
    // Set context menu attribute according to like attribute of another node
    // (such as a broadcaster).
    setItemAttrFromNode: function ctx_setItemAttrFromNode(item_id, attr, other_id) {
        var elem = document.getElementById( other_id );
        if ( elem && elem.getAttribute( attr ) == "true" ) {
            this.setItemAttr( item_id, attr, "true" );
        } else {
            this.setItemAttr( item_id, attr, null );
        }
    },

    // Generate fully qualified URL for clicked-on link.
    getLinkURL: function ctx_getLinkURL() {
        var href = this.link.href;
        
        if (href) {
          return href;
        }

        var href = this.link.getAttributeNS("http://www.w3.org/1999/xlink",
                                          "href");

        if (!href || !href.match(/\S/)) {
          throw "Empty href"; // Without this we try to save as the current doc, for example, HTML case also throws if empty
        }
        href = window.parent.makeURLAbsolute(this.link.baseURI, href);
        return href;
    },
    
    getLinkURI: function ctx_getLinkURI() {
         var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
         try {
           return ioService.newURI(this.linkURL, null, null);
         } catch (ex) {
           // e.g. empty URL string
           return null;
         }
    },
    
    getLinkProtocol: function ctx_getLinkProtocol() {
        if (this.linkURI) {
            return this.linkURI.scheme; // can be |undefined|
        } else {
            return null;
        }
    },

    // Get text of link.
    linkText: function ctx_linkText() {
        var text = gatherTextUnder( this.link );
        if (!text || !text.match(/\S/)) {
          text = this.link.getAttribute("title");
          if (!text || !text.match(/\S/)) {
            text = this.link.getAttribute("alt");
            if (!text || !text.match(/\S/)) {
              text = this.linkURL;
            }
          }
        }

        return text;
    },

    // Get selected text. Only display the first 15 chars.
    isTextSelection: function ctx_isTextSelection() {
      // Get 16 characters, so that we can trim the selection if it's greater
      // than 15 chars
      var selectedText = getBrowserSelection(16);

      if (!selectedText)
        return false;

      if (selectedText.length > 15)
        selectedText = selectedText.substr(0,15) + "...";

      // Use the current engine if the search bar is visible, the default
      // engine otherwise.
      var engineName = "";
      var ss = Cc["@mozilla.org/browser/search-service;1"].
               getService(Ci.nsIBrowserSearchService);
      if (BrowserSearch.getSearchBar())
        engineName = ss.currentEngine.name;
      else
        engineName = ss.defaultEngine.name;

      // format "Search <engine> for <selection>" string to show in menu
      var menuLabel = WebPanels.bundle.getFormattedString("contextMenuSearchText",
                                                          [engineName, selectedText]);
      this.setItemAttr("context-searchselect", "label", menuLabel);
      return true;
    },

    // Returns true if anything is selected.
    isContentSelection: function ctx_isContentSelection() {
        return !document.commandDispatcher.focusedWindow.getSelection().isCollapsed;
    },

    isTargetATextBox: function ctx_isTargetATextBox(node) {
      if (node instanceof HTMLInputElement)
        return (node.type == "text" || node.type == "password")

      return (node instanceof HTMLTextAreaElement);
    },
    
    isTargetAKeywordField: function ctx_isTargetAKeywordField(node) {
      var form = node.form;
      if (!form)
        return false;
      var method = form.method.toUpperCase();

      // These are the following types of forms we can create keywords for:
      //
      // method   encoding type       can create keyword
      // GET      *                                 YES
      //          *                                 YES
      // POST                                       YES
      // POST     application/x-www-form-urlencoded YES
      // POST     text/plain                        NO (a little tricky to do)
      // POST     multipart/form-data               NO
      // POST     everything else                   YES
      return (method == "GET" || method == "") ||
             (form.enctype != "text/plain") && (form.enctype != "multipart/form-data");
    },

    addDictionaries: function ctx_addDictionaries()
    {
      var uri = window.parent.formatURL("browser.dictionaries.download.url", true);

      var locale = "-";
      try {
        locale = WebPanels.branch.getComplexValue("intl.accept_languages",
                                  Ci.nsIPrefLocalizedString).data;
      }
      catch (e) { }

      var version = "-";
      try {
        version = Cc["@mozilla.org/xre/app-info;1"]
                            .getService(Ci.nsIXULAppInfo)
                            .version;
      }
      catch (e) { }

      uri = uri.replace(/%LOCALE%/, escape(locale));
      uri = uri.replace(/%VERSION%/, version);

      var newWindowPref = WebPanels.branch.getIntPref("browser.link.open_newwindow");
      var where = newWindowPref == 3 ? "tab" : "window";

      openUILinkIn(uri, where);
    }
}
/*******************************************************************************
 * Get the browser element
 ******************************************************************************/
function getBrowser() {
  return gBrowser;
}
/*******************************************************************************
 * PageInfo function used by the context menu.
 ******************************************************************************/
function BrowserPageInfo(doc, initialTab) {
  var args = {doc: doc, initialTab: initialTab};
  openDialogByTypeAndUrl("Browser:page-info",
                         doc ? doc.location : gBrowser.contentDocument.location,
                         "chrome://browser/content/pageInfo.xul",
                         "chrome,dialog=no", args);
}
/*******************************************************************************
 * function to open a dialog by type and url used by page info.
 ******************************************************************************/
function openDialogByTypeAndUrl(inType, relatedUrl, windowUri, features, extraArgument)
{
  var mediator = Cc['@mozilla.org/appshell/window-mediator;1'].
                 getService(Ci.nsIWindowMediator);
  var windows = mediator.getEnumerator(inType);

  // Check for windows matching the url
  while (windows.hasMoreElements()) {
    var current = windows.getNext();
    if (current.document.documentElement.getAttribute("relatedUrl") == relatedUrl) {
      current.focus();
      return;
    }
  }

  // We didn't find a matching window, so open a new one.
  if (features)
    window.openDialog(windowUri, "_blank", features, extraArgument);
  else
    window.openDialog(windowUri, "_blank", "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar", extraArgument);
}
/*******************************************************************************
 * function to bookmark a page used by the context menu.
 ******************************************************************************/
function addBookmarkAs() {
  var webNav = WebPanels.getWebNav();
  var url = webNav.currentURI.spec;
  var title, charSet = null;
  var description;
  try {
    title = webNav.document.title || url;
    charSet = webNav.document.characterSet;
    description = BookmarksUtils.getDescriptionFromDocument(webNav.document);
  }
  catch (e) {
    title = url;
  }
  BookmarksUtils.addBookmark(url, title, charSet, false, description);  
}
/*******************************************************************************
 *  Escape for data used by AddKeywordForSearchField.
 ******************************************************************************/
function escapeNameValuePair(name, value, isFormUrlEncoded)
{
  if (isFormUrlEncoded)
    return escape(name + "=" + value);
  else
    return escape(name) + "=" + escape(value);
}
/*******************************************************************************
 *  Add a keyword for a field used by the context menu.
 ******************************************************************************/
function AddKeywordForSearchField() {
  var node = document.popupNode;

  var docURI = makeURI(node.ownerDocument.URL,
                       node.ownerDocument.characterSet);

  var formURI = makeURI(node.form.getAttribute("action"),
                        node.ownerDocument.characterSet,
                        docURI);

  var spec = formURI.spec;

  var isURLEncoded = 
               (node.form.method.toUpperCase() == "POST"
                && (node.form.enctype == "application/x-www-form-urlencoded" ||
                    node.form.enctype == ""));

  var el, type;
  var formData = [];

  for (var i=0; i < node.form.elements.length; i++) {
    el = node.form.elements[i];

    if (!el.type) // happens with fieldsets
      continue;

    if (el == node) {
      formData.push((isURLEncoded) ? escapeNameValuePair(el.name, "%s", true) :
                                     // Don't escape "%s", just append
                                     escapeNameValuePair(el.name, "", false) + "%s");
      continue;
    }

    type = el.type.toLowerCase();
    
    if ((type == "text" || type == "hidden" || type == "textarea") ||
        ((type == "checkbox" || type == "radio") && el.checked)) {
      formData.push(escapeNameValuePair(el.name, el.value, isURLEncoded));
    } else if (el instanceof HTMLSelectElement && el.selectedIndex >= 0) {
      for (var j=0; j < el.options.length; j++) {
        if (el.options[j].selected)
          formData.push(escapeNameValuePair(el.name, el.options[j].value,
                                            isURLEncoded));
      }
    }
  }

  var postData;

  if (isURLEncoded)
    postData = formData.join("&");
  else
    spec += "?" + formData.join("&");

//@line 2444 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
  var dialogArgs = {
    name: "",
    url: spec,
    charset: node.ownerDocument.characterSet,
    bWebPanel: false,
    keyword: "",
    bNeedKeyword: true,
    postData: postData,
    description: BookmarksUtils.getDescriptionFromDocument(node.ownerDocument)
  }
  openDialog("chrome://browser/content/bookmarks/addBookmark2.xul", "",
             BROWSER_ADD_BM_FEATURES, dialogArgs);
//@line 2459 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
}
/*******************************************************************************
 *  View the source of a document used by the context menu.
 ******************************************************************************/
function BrowserViewSourceOfDocument(aDocument) {
  var pageCookie;
  var webNav;

  // Get the document charset
  var docCharset = "charset=" + aDocument.characterSet;

  // Get the nsIWebNavigation associated with the document
  try {
      var win;
      var ifRequestor;

      // Get the DOMWindow for the requested document.  If the DOMWindow
      // cannot be found, then just use the content window...
      //
      // XXX:  This is a bit of a hack...
      win = aDocument.defaultView;
      if (win == window) {
        win = content;
      }
      ifRequestor = win.QueryInterface(Ci.nsIInterfaceRequestor);

      webNav = ifRequestor.getInterface(nsIWebNavigation);
  } catch(e) {
      // If nsIWebNavigation cannot be found, just get the one for the whole
      // window...
      webNav = WebPanels.getWebNav();
  }
  
  //
  // Get the 'PageDescriptor' for the current document. This allows the
  // view-source to access the cached copy of the content rather than
  // refetching it from the network...
  //
  try{
    var PageLoader = webNav.QueryInterface(Ci.nsIWebPageDescriptor);

    pageCookie = PageLoader.currentDescriptor;
  } catch(e) {
    // If no page descriptor is available, just use the view-source URL...
  }

  ViewSourceOfURL(webNav.currentURI.spec, pageCookie, aDocument);
}
/*******************************************************************************
 *  View the source of url used by BrowserViewSourceOfDocument.
 ******************************************************************************/
function ViewSourceOfURL(aURL, aPageDescriptor, aDocument) {
  var external = false;
  try {
    external = WebPanels.branch.getBoolPref("view_source.editor.external");
  } catch(e) {}
  if (external)
    gViewSourceUtils.openInExternalEditor(aURL, aPageDescriptor, aDocument);
  else
    gViewSourceUtils.openInInternalViewer(aURL, aPageDescriptor, aDocument);
}
/*******************************************************************************
 *  Switch a documents direction.  Used by the context menu.
 ******************************************************************************/
function SwitchDocumentDirection(aWindow) {
  aWindow.document.dir = (aWindow.document.dir == "ltr" ? "rtl" : "ltr");
  for (var run = 0; run < aWindow.frames.length; run++)
    SwitchDocumentDirection(aWindow.frames[run]);
}
/*******************************************************************************
 *  Get the selected text in a browser.  Used by the context menu.
 ******************************************************************************/
function getBrowserSelection(aCharLen) {
  // selections of more than 150 characters aren't useful
  const kMaxSelectionLen = 150;
  const charLen = Math.min(aCharLen || kMaxSelectionLen, kMaxSelectionLen);

  var focusedWindow = document.commandDispatcher.focusedWindow;
  var selection = focusedWindow.getSelection().toString();

  if (selection) {
    if (selection.length > charLen) {
      // only use the first charLen important chars. see bug 221361
      var pattern = new RegExp("^(?:\\s*.){0," + charLen + "}");
      pattern.test(selection);
      selection = RegExp.lastMatch;
    }

    selection = selection.replace(/^\s+/, "")
                         .replace(/\s+$/, "")
                         .replace(/\s+/g, " ");

    if (selection.length > charLen)
      selection = selection.substr(0, charLen);
  }
  return selection;
}
/*******************************************************************************
 *  Paste a url using the middle click.
 ******************************************************************************/
function middleMousePaste(event) {
  var url = window.parent.readFromClipboard();
  if (!url)
    return;
  var postData = { };
  url = getShortcutOrURI(url, postData);
  if (!url)
    return;

  WebPanels.URLBar.value = url;
  WebPanels.onTextEntered();
  event.stopPropagation();
}
/*******************************************************************************
 *  Get shortcut or URI
 ******************************************************************************/
function getShortcutOrURI(aURL, aPostDataRef) {
  return window.parent.getShortcutOrURI(aURL, aPostDataRef);
}
/*******************************************************************************
 *  Get plugin information from an element.
 ******************************************************************************/
function getPluginInfo(pluginElement) {
  var tagMimetype;
  var pluginsPage;
  if (pluginElement instanceof HTMLAppletElement) {
    tagMimetype = "application/x-java-vm";
  } else {
    if (pluginElement instanceof HTMLObjectElement)
      pluginsPage = pluginElement.getAttribute("codebase");
    else
      pluginsPage = pluginElement.getAttribute("pluginspage");

    // only attempt if a pluginsPage is defined.
    if (pluginsPage) {
      var doc = pluginElement.ownerDocument;
      var docShell = window.parent.findChildShell(doc, gBrowser.docShell, null);
      try {
        pluginsPage = makeURI(pluginsPage, doc.characterSet, docShell.currentURI).spec;
      } catch (ex) { 
        pluginsPage = "";
      }
    }

    tagMimetype = pluginElement.QueryInterface(Ci.nsIPluginElement).actualType;
    if (tagMimetype == "") {
      tagMimetype = pluginElement.type;
    }
  }
  return {mimetype: tagMimetype, pluginsPage: pluginsPage};
}
/*******************************************************************************
 * Object for integrating mail functions in the context menu.
 ******************************************************************************/
const MailIntegration = {
  sendLinkForContent: function mli_sendLinkForContent() {
    var doc = gBrowser.contentDocument;
    this.sendMessage(doc.location.href, doc.title);
  },

  sendMessage: function mli_sendMessage(aBody, aSubject) {
    window.parent.MailIntegration.sendMessage(aBody, aSubject);
  }
};
/*******************************************************************************
 * Object for integrating search functions in the context menu.
 ******************************************************************************/
const BrowserSearch = {

  /**
   * Loads a search results page, given a set of search terms. Uses the current
   * engine if the search bar is visible, or the default engine otherwise.
   *
   * @param searchText
   *        The search terms to use for the search.
   *
   * @param useNewTab
   *        Boolean indicating whether or not the search should load in a new
   *        tab.
   */
  loadSearch: function BrowserSearch_search(searchText, useNewTab) {
    var ss = Cc["@mozilla.org/browser/search-service;1"].
             getService(Ci.nsIBrowserSearchService);
    var engine;
  
    // If the search bar is visible, use the current engine, otherwise, fall
    // back to the default engine.
    if (this.getSearchBar())
      engine = ss.currentEngine;
    else
      engine = ss.defaultEngine;
  
    var submission = engine.getSubmission(searchText, null); // HTML response

    // getSubmission can return null if the engine doesn't have a URL
    // with a text/html response type.  This is unlikely (since
    // SearchService._addEngineToStore() should fail for such an engine),
    // but let's be on the safe side.
    if (!submission)
      return;
  
    if (useNewTab) {
      window.parent.gBrowser.loadOneTab(submission.uri.spec, null, null,
                                        submission.postData, null, false);
    } else 
      WebPanels.loadURI(submission.uri.spec, null, submission.postData, false, WebPanels.isLinked());
  },

  /**
   * Returns the search bar element if it is present in the toolbar and not
   * hidden, null otherwise.
   */
  getSearchBar: function BrowserSearch_getSearchBar() {
    var searchBar = window.parent.document.getElementById("searchbar");
    if (searchBar) {
      var style = window.parent.getComputedStyle(searchBar.parentNode, null);
      if (style.visibility == "visible" && style.display != "none")
        return searchBar;
    }
    return null;
  }
}
/*******************************************************************************
 * Object for handling xpinstall block messages
 ******************************************************************************/
const XPInstallHandler = {

  onBlocked: function xpi_onBlocked() {
    var brandBundle = document.getElementById("bundle_brand");
    var browserBundle = document.getElementById("bundle_browser");
    
    var webNav = WebPanels.getWebNav();    
    var host = webNav.currentURI.host;
    var brandShortName = brandBundle.getString("brandShortName");
    var notificationName, messageString, buttons;
    
    // Install disabled
    if (!WebPanels.branch.getBoolPref("xpinstall.enabled")) {    
      notificationName = "xpinstall-disabled";
      
      // Show locked message
      if (WebPanels.branch.prefIsLocked("xpinstall.enabled")) {
        messageString = browserBundle.getString("xpinstallDisabledMessageLocked");
        buttons = [];

      // Show disabled message      
      } else {
        messageString = browserBundle.getFormattedString("xpinstallDisabledMessage",
                                                         [brandShortName, host]);
        buttons = [{
          label: browserBundle.getString("xpinstallDisabledButton"),
          accessKey: browserBundle.getString("xpinstallDisabledButton.accesskey"),
          popup: null,
          callback: function editPrefs() {
            WebPanels.branch.setBoolPref("xpinstall.enabled", true);
            return false;
          }
        }];
      }
    
    // Install blocked
    } else {
      notificationName = "xpinstall"
      messageString = browserBundle.getFormattedString("xpinstallPromptWarning",
                                                       [brandShortName, host]);

      buttons = [{
        label: browserBundle.getString("xpinstallPromptWarningButton"),
        accessKey: browserBundle.getString("xpinstallPromptWarningButton.accesskey"),
        popup: null,
        callback: function() { return XPInstallHandler.editPermissions(); }
      }];
    }

    // Show the notification
    var notifyBox = WebPanels.getNotifyBox();
    if (!notifyBox.getNotificationWithValue(notificationName)) {
      const priority = notifyBox.PRIORITY_WARNING_MEDIUM;
      const iconURL = "chrome://mozapps/skin/xpinstall/xpinstallItemGeneric.png";
      notifyBox.appendNotification(messageString, notificationName,
                                   iconURL, priority, buttons);
    }
  },

  editPermissions: function xpi_editPermissions() {
    var bundlePreferences = document.getElementById("bundle_preferences");
    var webNav = WebPanels.getWebNav();
    var params = { blockVisible   : false,
                   sessionVisible : false,
                   allowVisible   : true,
                   prefilledHost  : webNav.currentURI.host,
                   permissionType : "install",
                   windowTitle    : bundlePreferences.getString("addons_permissions_title"),
                   introText      : bundlePreferences.getString("addonspermissionstext") };
    var mediator = Cc["@mozilla.org/appshell/window-mediator;1"].
                   getService(Ci.nsIWindowMediator);
    var win = mediator.getMostRecentWindow("Browser:Permissions");
    if (win) {
      win.initWithParams(params);
      win.focus();
    } else
      window.openDialog("chrome://browser/content/preferences/permissions.xul",
                        "_blank", "resizable,dialog=no,centerscreen", params);
    return false; 
  }
};
/*******************************************************************************
 * Object for handling popup block messages
 ******************************************************************************/
const PopupHandler = {
  _kIPM: Ci.nsIPermissionManager,

  onBlocked: function pop_onBlocked() {

    if (WebPanels.branch.getBoolPref("privacy.popups.showBrowserMessage")) {
      var bundle_browser = document.getElementById("bundle_browser");
      var brandBundle = document.getElementById("bundle_brand");
      var brandShortName = brandBundle.getString("brandShortName");
      var message;
      var popupCount = gBrowser.pageReport.length;
//@line 2780 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
      var popupButtonText = bundle_browser.getString("popupWarningButton");
      var popupButtonAccesskey = bundle_browser.getString("popupWarningButton.accesskey");
//@line 2786 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/web-panels.js"
      if (popupCount > 1)
        message = bundle_browser.getFormattedString("popupWarningMultiple", [brandShortName, popupCount]);
      else
        message = bundle_browser.getFormattedString("popupWarning", [brandShortName]);

      var notifyBox = WebPanels.getNotifyBox();
      var notification = notifyBox.getNotificationWithValue("popup-blocked");
      if (notification)
        notification.label = message;
      else {
        var buttons = [{
          label: popupButtonText,
          accessKey: popupButtonAccesskey,
          popup: "blockedPopupOptions",
          callback: null
        }];
        const priority = notifyBox.PRIORITY_WARNING_MEDIUM;
        notifyBox.appendNotification(message, "popup-blocked",
                                     "chrome://browser/skin/Info.png",
                                     priority, buttons);
      }
    }
  },

  toggleAllowPopupsForSite: function pop_toggleAllowPopupsForSite(aEvent) {
    var currentURI = WebPanels.getWebNav().currentURI;
    var pm = Cc["@mozilla.org/permissionmanager;1"].getService(this._kIPM);
    var shouldBlock = aEvent.target.getAttribute("block") == "true";
    var perm = shouldBlock ? this._kIPM.DENY_ACTION : this._kIPM.ALLOW_ACTION;
    pm.add(currentURI, "popup", perm);
    WebPanels.getNotifyBox().removeCurrentNotification();
  },

  fillPopupList: function pop_fillPopupList(aEvent) {
  
    var bundle_browser = document.getElementById("bundle_browser");
    // XXXben - rather than using |currentURI| here, which breaks down on multi-framed sites
    //          we should really walk the pageReport and create a list of "allow for <host>"
    //          menuitems for the common subset of hosts present in the report, this will
    //          make us frame-safe.
    //
    // XXXjst - Note that when this is fixed to work with multi-framed sites,
    //          also back out the fix for bug 343772 where
    //          nsGlobalWindow::CheckOpenAllow() was changed to also
    //          check if the top window's location is whitelisted.
    var uri = WebPanels.getWebNav().currentURI;
    var blockedPopupAllowSite = document.getElementById("blockedPopupAllowSite");
    try {
      blockedPopupAllowSite.removeAttribute("hidden");
      var pm = Cc["@mozilla.org/permissionmanager;1"].getService(this._kIPM);
      if (pm.testPermission(uri, "popup") == this._kIPM.ALLOW_ACTION) {
        // Offer an item to block popups for this site, if a whitelist entry exists
        // already for it.
        var blockString = bundle_browser.getFormattedString("popupBlock", [uri.host]);
        blockedPopupAllowSite.setAttribute("label", blockString);
        blockedPopupAllowSite.setAttribute("block", "true");
      }
      else {
        // Offer an item to allow popups for this site
        var allowString = bundle_browser.getFormattedString("popupAllow", [uri.host]);
        blockedPopupAllowSite.setAttribute("label", allowString);
        blockedPopupAllowSite.removeAttribute("block");
      }
    }
    catch (e) {
      blockedPopupAllowSite.setAttribute("hidden", "true");
    }

    var item = aEvent.target.lastChild;
    while (item && item.getAttribute("observes") != "blockedPopupsSeparator") {
      var next = item.previousSibling;
      item.parentNode.removeChild(item);
      item = next;
    }

    var foundUsablePopupURI = false;
    var pageReport = gBrowser.pageReport;
    if (pageReport) {
      for (var i = 0; i < pageReport.length; ++i) {
        var popupURIspec = pageReport[i].popupWindowURI.spec;

        // Sometimes the popup URI that we get back from the pageReport
        // isn't useful (for instance, netscape.com's popup URI ends up
        // being "http://www.netscape.com", which isn't really the URI of
        // the popup they're trying to show).  This isn't going to be
        // useful to the user, so we won't create a menu item for it.
        if (popupURIspec == "" || popupURIspec == "about:blank" ||
            popupURIspec == uri.spec)
          continue;

        // Because of the short-circuit above, we may end up in a situation
        // in which we don't have any usable popup addresses to show in
        // the menu, and therefore we shouldn't show the separator.  However,
        // since we got past the short-circuit, we must've found at least
        // one usable popup URI and thus we'll turn on the separator later.
        foundUsablePopupURI = true;

        var menuitem = document.createElement("menuitem");
        var label = bundle_browser.getFormattedString("popupShowPopupPrefix",
                                                      [popupURIspec]);
        menuitem.setAttribute("label", label);
        menuitem.setAttribute("popupWindowURI", popupURIspec);
        menuitem.setAttribute("popupWindowFeatures", pageReport[i].popupWindowFeatures);
        menuitem.setAttribute("popupWindowName", pageReport[i].popupWindowName);
        menuitem.setAttribute("oncommand", "PopupHandler.showBlockedPopup(event);");
        menuitem.requestingWindow = pageReport[i].requestingWindow;
        menuitem.requestingDocument = pageReport[i].requestingDocument;
        aEvent.target.appendChild(menuitem);
      }
    }

    // Show or hide the separator, depending on whether we added any
    // showable popup addresses to the menu.
    var blockedPopupsSeparator =
      document.getElementById("blockedPopupsSeparator");
    if (foundUsablePopupURI)
      blockedPopupsSeparator.removeAttribute("hidden");
    else
      blockedPopupsSeparator.setAttribute("hidden", true);

    var blockedPopupDontShowMessage = document.getElementById("blockedPopupDontShowMessage");
    var showMessage = WebPanels.branch.getBoolPref("privacy.popups.showBrowserMessage");
    blockedPopupDontShowMessage.setAttribute("checked", !showMessage);
    if (aEvent.target.localName == "popup")
      blockedPopupDontShowMessage.setAttribute("label", bundle_browser.getString("popupWarningDontShowFromMessage"));
    else
      blockedPopupDontShowMessage.setAttribute("label", bundle_browser.getString("popupWarningDontShowFromStatusbar"));
  },

  showBlockedPopup: function pop_showBlockedPopup(aEvent) {
    var target = aEvent.target;
    var popupWindowURI = target.getAttribute("popupWindowURI");
    var features = target.getAttribute("popupWindowFeatures");
    var name = target.getAttribute("popupWindowName");

    var dwi = target.requestingWindow;

    // If we have a requesting window and the requesting document is
    // still the current document, open the popup.
    if (dwi && dwi.document == target.requestingDocument) {
      dwi.open(popupWindowURI, name, features);
    }
  },

  editPopupSettings: function pop_editPopupSettings() {
    var host = "";
    try {
      var uri = WebPanels.getWebNav().currentURI;
      host = uri.host;
    }
    catch (e) { }

    var bundlePreferences = document.getElementById("bundle_preferences");
    var params = { blockVisible   : false,
                   sessionVisible : false,
                   allowVisible   : true,
                   prefilledHost  : host,
                   permissionType : "popup",
                   windowTitle    : bundlePreferences.getString("popuppermissionstitle"),
                   introText      : bundlePreferences.getString("popuppermissionstext") };
    var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
    var win = wm.getMostRecentWindow("Browser:Permissions");
    if (win) {
      win.initWithParams(params);
      win.focus();
    }
    else
      window.openDialog("chrome://browser/content/preferences/permissions.xul",
                        "_blank", "resizable,dialog=no,centerscreen", params);
  },

  dontShowMessage: function pop_dontShowMessage() {
    var showMessage = WebPanels.branch.getBoolPref("privacy.popups.showBrowserMessage");
    WebPanels.branch.setBoolPref("privacy.popups.showBrowserMessage", !showMessage);
    WebPanels.getNotifyBox().removeCurrentNotification();
  }
};
/*******************************************************************************
 * Object for handling missing plugin messages
 ******************************************************************************/
const PluginHandler = {

  onMissing: function plg_onMissing(pluginInfo) {
  
    // save the plugin info
    if (!WebPanels.missingPlugins)
      WebPanels.missingPlugins = new Object();
    WebPanels.missingPlugins[pluginInfo.mimetype] = pluginInfo;

    var notifyBox = WebPanels.getNotifyBox();
    if (!notifyBox.getNotificationWithValue("missing-plugins")) {
      var bundle_browser = document.getElementById("bundle_browser");
      var messageString = bundle_browser.getString("missingpluginsMessage.title");
      var buttons = [{
        label: bundle_browser.getString("missingpluginsMessage.button.label"),
        accessKey: bundle_browser.getString("missingpluginsMessage.button.accesskey"),
        popup: null,
        callback: function() { PluginHandler.showWizard(); }
      }];

      const priority = notifyBox.PRIORITY_WARNING_MEDIUM;
      const iconURL = "chrome://mozapps/skin/xpinstall/xpinstallItemGeneric.png";
      notifyBox.appendNotification(messageString, "missing-plugins",
                                   iconURL, priority, buttons);
    }
  },

  installSinglePlugin: function plg_installSinglePlugin(event) {
    var missingPluginsArray = new Object;
    var pluginInfo = getPluginInfo(event.target);
    missingPluginsArray[pluginInfo.mimetype] = pluginInfo;

    if (missingPluginsArray)
      PluginHandler.showWizard(missingPluginsArray);
    event.preventDefault();
  },
  
  showWizard: function plg_showWizard(missingPlugins) {
    var missingPluginsArray = (missingPlugins) ? missingPlugins : WebPanels.missingPlugins;
    if (missingPluginsArray)
      window.openDialog("chrome://mozapps/content/plugins/pluginInstallerWizard.xul",
      "PFSWindow", "modal,chrome,resizable=yes", {plugins: missingPluginsArray, 
      tab: null, callback: function(success) { PluginHandler.callback(success); } });
  },
  
  callback: function nplg_callback(success) {
    if (!success)
      return;
    
    // Remove the notification
    var notifyBox = WebPanels.getNotifyBox();
    var notification = notifyBox.getNotificationWithValue("missing-plugins");
    if (notification)
      notifyBox.removeNotification(notification);
      
    // clear the missing plugins
    WebPanels.missingPlugins = null;
    
    // Reload the page
    WebPanels.reload();  
  }
}
