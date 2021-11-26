//@line 38 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/utilityOverlay.js"

/**
 * Communicator Shared Utility Library
 * for shared application glue for the Communicator suite of applications
 **/

var goPrefWindow = 0;
var gBidiUI = false;

function getBrowserURL()
{
  return "chrome://browser/content/browser.xul";
}

function goToggleToolbar( id, elementID )
{
  var toolbar = document.getElementById(id);
  var element = document.getElementById(elementID);
  if (toolbar)
  {
    var isHidden = toolbar.hidden;
    toolbar.hidden = !isHidden;
    document.persist(id, 'hidden');
    if (element) {
      element.setAttribute("checked", isHidden ? "true" : "false");
      document.persist(elementID, 'checked');
    }
  }
}

function getTopWin()
{
  var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1']
                                .getService(Components.interfaces.nsIWindowMediator);
  return windowManager.getMostRecentWindow("navigator:browser");
}

function openTopWin( url )
{
  openUILink(url, {})
}

function getBoolPref ( prefname, def )
{
  try { 
    var pref = Components.classes["@mozilla.org/preferences-service;1"]
                       .getService(Components.interfaces.nsIPrefBranch);
    return pref.getBoolPref(prefname);
  }
  catch(er) {
    return def;
  }
}

function getIntPref ( prefname, def )
{
  try { 
    var pref = Components.classes["@mozilla.org/preferences-service;1"]
                       .getService(Components.interfaces.nsIPrefBranch);
    return pref.getIntPref(prefname);
  }
  catch(er) {
    return def;
  }
}

function nsWhereToOpenLink(pref, e, ignoreButton, ignoreAlt)
{
  var where = whereToOpenLink(e, ignoreButton, ignoreAlt);
  if (where != "current")
    return where;

  var prefVal = getIntPref(pref);
  switch (prefVal) {
  case 3:
    where = "tab";
    break;
  case 2:
    where = "window";
    break;
  case 1:
  default:
    where = "current";
    break;
  }
  return where;   
}

// openUILink handles clicks on UI elements that cause URLs to load.
function openUILink( url, e, ignoreButton, ignoreAlt, allowKeywordFixup, postData )
{
  var where = whereToOpenLink(e, ignoreButton, ignoreAlt);
  openUILinkIn(url, where, allowKeywordFixup, postData);
}


/* whereToOpenLink() looks at an event to decide where to open a link.
 *
 * The event may be a mouse event (click, double-click, middle-click) or keypress event (enter).
 *
 * On Windows, the modifiers are:
 * Ctrl        new tab, selected
 * Shift       new window
 * Ctrl+Shift  new tab, in background
 * Alt         save
 *
 * You can swap Ctrl and Ctrl+shift by toggling the hidden pref
 * browser.tabs.loadBookmarksInBackground (not browser.tabs.loadInBackground, which
 * is for content area links).
 *
 * Middle-clicking is the same as Ctrl+clicking (it opens a new tab) and it is
 * subject to the shift modifier and pref in the same way.
 *
 * Exceptions: 
 * - Alt is ignored for menu items selected using the keyboard so you don't accidentally save stuff.  
 *    (Currently, the Alt isn't sent here at all for menu items, but that will change in bug 126189.)
 * - Alt is hard to use in context menus, because pressing Alt closes the menu.
 * - Alt can't be used on the bookmarks toolbar because Alt is used for "treat this as something draggable".
 * - The button is ignored for the middle-click-paste-URL feature, since it's always a middle-click.
 */
function whereToOpenLink( e, ignoreButton, ignoreAlt )
{
  if (!e)
    e = { shiftKey:false, ctrlKey:false, metaKey:false, altKey:false, button:0 };

  var shift = e.shiftKey;
  var ctrl =  e.ctrlKey;
  var meta =  e.metaKey;
  var alt  =  e.altKey && !ignoreAlt;

  // ignoreButton allows "middle-click paste" to use function without always opening in a new window.
  var middle = !ignoreButton && e.button == 1;
  var middleUsesTabs = getBoolPref("browser.tabs.opentabfor.middleclick", true);

  // Don't do anything special with right-mouse clicks.  They're probably clicks on context menu items.

//@line 177 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/utilityOverlay.js"
  if (ctrl || (middle && middleUsesTabs)) {
//@line 179 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/utilityOverlay.js"
    if (shift)
      return "tabshifted";
    else
      return "tab";
  }
  else if (alt) {
    return "save";
  }
  else if (shift || (middle && !middleUsesTabs)) {
    return "window";
  }
  else {
    return "current";
  }
}

/* openUILinkIn opens a URL in a place specified by the parameter |where|.
 *
 * |where| can be:
 *  "current"     current tab            (if there aren't any browser windows, then in a new window instead)
 *  "tab"         new tab                (if there aren't any browser windows, then in a new window instead)
 *  "tabshifted"  same as "tab" but in background if default is to select new tabs, and vice versa
 *  "window"      new window
 *  "save"        save to disk (with no filename hint!)
 *
 * allowThirdPartyFixup controls whether third party services such as Google's
 * I Feel Lucky are allowed to interpret this URL. This parameter may be
 * undefined, which is treated as false.
 */
function openUILinkIn( url, where, allowThirdPartyFixup, postData )
{
  if (!where || !url)
    return;

  if (where == "save") {
    saveURL(url, null, null, true);
    return;
  }

  var w = getTopWin();

  if (!w || where == "window") {
    openDialog(getBrowserURL(), "_blank", "chrome,all,dialog=no", url,
               null, null, postData, allowThirdPartyFixup);
    return;
  }

  var loadInBackground = getBoolPref("browser.tabs.loadBookmarksInBackground", false);

  switch (where) {
  case "current":
    w.loadURI(url, null, postData, allowThirdPartyFixup);
    w.content.focus();
    break;
  case "tabshifted":
    loadInBackground = !loadInBackground;
    // fall through
  case "tab":
    var browser = w.getBrowser();
    browser.loadOneTab(url, null, null, postData, loadInBackground,
                       allowThirdPartyFixup || false);
    break;
  }
}

// Used as an onclick handler for UI elements with link-like behavior.
// e.g. onclick="checkForMiddleClick(this, event);"
function checkForMiddleClick(node, event)
{
  // We should be using the disabled property here instead of the attribute,
  // but some elements that this function is used with don't support it (e.g.
  // menuitem).
  if (node.getAttribute("disabled") == "true")
    return; // Do nothing

  if (event.button == 1) {
    /* Execute the node's oncommand.
     *
     * XXX: we should use node.oncommand(event) once bug 246720 is fixed.
     */
    var fn = new Function("event", node.getAttribute("oncommand"));
    fn.call(node, event);

    // If the middle-click was on part of a menu, close the menu.
    // (Menus close automatically with left-click but not with middle-click.)
    closeMenus(event.target);
  }
}

// Closes all popups that are ancestors of the node.
function closeMenus(node)
{
  if ("tagName" in node) {
    if (node.namespaceURI == "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
    && (node.tagName == "menupopup" || node.tagName == "popup"))
      node.hidePopup();

    closeMenus(node.parentNode);
  }
}

// update menu items that rely on focus
function goUpdateGlobalEditMenuItems()
{
  goUpdateCommand('cmd_undo');
  goUpdateCommand('cmd_redo');
  goUpdateCommand('cmd_cut');
  goUpdateCommand('cmd_copy');
  goUpdateCommand('cmd_paste');
  goUpdateCommand('cmd_selectAll');
  goUpdateCommand('cmd_delete');
  if (gBidiUI)
    goUpdateCommand('cmd_switchTextDirection');
}

// update menu items that rely on the current selection
function goUpdateSelectEditMenuItems()
{
  goUpdateCommand('cmd_cut');
  goUpdateCommand('cmd_copy');
  goUpdateCommand('cmd_delete');
  goUpdateCommand('cmd_selectAll');
}

// update menu items that relate to undo/redo
function goUpdateUndoEditMenuItems()
{
  goUpdateCommand('cmd_undo');
  goUpdateCommand('cmd_redo');
}

// update menu items that depend on clipboard contents
function goUpdatePasteMenuItems()
{
  goUpdateCommand('cmd_paste');
}

// Gather all descendent text under given document node.
function gatherTextUnder ( root ) 
{
  var text = "";
  var node = root.firstChild;
  var depth = 1;
  while ( node && depth > 0 ) {
    // See if this node is text.
    if ( node.nodeType == Node.TEXT_NODE ) {
      // Add this text to our collection.
      text += " " + node.data;
    } else if ( node instanceof HTMLImageElement) {
      // If it has an alt= attribute, use that.
      var altText = node.getAttribute( "alt" );
      if ( altText && altText != "" ) {
        text = altText;
        break;
      }
    }
    // Find next node to test.
    // First, see if this node has children.
    if ( node.hasChildNodes() ) {
      // Go to first child.
      node = node.firstChild;
      depth++;
    } else {
      // No children, try next sibling.
      if ( node.nextSibling ) {
        node = node.nextSibling;
      } else {
        // Last resort is our next oldest uncle/aunt.
        node = node.parentNode.nextSibling;
        depth--;
      }
    }
  }
  // Strip leading whitespace.
  text = text.replace( /^\s+/, "" );
  // Strip trailing whitespace.
  text = text.replace( /\s+$/, "" );
  // Compress remaining whitespace.
  text = text.replace( /\s+/g, " " );
  return text;
}

function getShellService()
{
  var shell = null;
  try {
    shell = Components.classes["@mozilla.org/browser/shell-service;1"]
      .getService(Components.interfaces.nsIShellService);
  } catch (e) {dump("*** e = " + e + "\n");}
  return shell;
}

function isBidiEnabled() {
  var rv = false;

  try {
    var localeService = Components.classes["@mozilla.org/intl/nslocaleservice;1"]
                                  .getService(Components.interfaces.nsILocaleService);
    var systemLocale = localeService.getSystemLocale().getCategory("NSILOCALE_CTYPE").substr(0,3);

    switch (systemLocale) {
      case "ar-":
      case "he-":
      case "fa-":
      case "ur-":
      case "syr":
        rv = true;
    }
  } catch (e) {}

  // check the overriding pref
  if (!rv)
    rv = getBoolPref("bidi.browser.ui");

  return rv;
}

function openAboutDialog()
{
//@line 411 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/utilityOverlay.js"
  window.openDialog("chrome://browser/content/aboutDialog.xul", "About", "modal,centerscreen,chrome,resizable=no");
//@line 413 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/utilityOverlay.js"
}

function openPreferences(paneID)
{
  var instantApply = getBoolPref("browser.preferences.instantApply", false);
  var features = "chrome,titlebar,toolbar,centerscreen" + (instantApply ? ",dialog=no" : ",modal");

  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
  var win = wm.getMostRecentWindow("Browser:Preferences");
  if (win) {
    win.focus();
    if (paneID) {
      var pane = win.document.getElementById(paneID);
      win.document.documentElement.showPane(pane);
    }
  }
  else
    openDialog("chrome://browser/content/preferences/preferences.xul",
               "Preferences", features, paneID);
}

/**
 * Opens the release notes page for this version of the application.
 * @param   event
 *          The DOM Event that caused this function to be called, used to
 *          determine where the release notes page should be displayed based
 *          on modifiers (e.g. Ctrl = new tab)
 */
function openReleaseNotes(event)
{
  var formatter = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                            .getService(Components.interfaces.nsIURLFormatter);
  var relnotesURL = formatter.formatURLPref("app.releaseNotesURL");
  
  openUILink(relnotesURL, event, false, true);
}
  
/**
 * Opens the update manager and checks for updates to the application.
 */
function checkForUpdates()
{
  var um = 
      Components.classes["@mozilla.org/updates/update-manager;1"].
      getService(Components.interfaces.nsIUpdateManager);
  var prompter = 
      Components.classes["@mozilla.org/updates/update-prompt;1"].
      createInstance(Components.interfaces.nsIUpdatePrompt);

  // If there's an update ready to be applied, show the "Update Downloaded"
  // UI instead and let the user know they have to restart the browser for
  // the changes to be applied. 
  if (um.activeUpdate && um.activeUpdate.state == "pending")
    prompter.showUpdateDownloaded(um.activeUpdate);
  else
    prompter.checkForUpdates();
}

function buildHelpMenu()
{
  var updates = 
      Components.classes["@mozilla.org/updates/update-service;1"].
      getService(Components.interfaces.nsIApplicationUpdateService);
  var um = 
      Components.classes["@mozilla.org/updates/update-manager;1"].
      getService(Components.interfaces.nsIUpdateManager);

  // Disable the UI if the update enabled pref has been locked by the 
  // administrator or if we cannot update for some other reason
  var checkForUpdates = document.getElementById("checkForUpdates");
  var canUpdate = updates.canUpdate;
  checkForUpdates.setAttribute("disabled", !canUpdate);
  if (!canUpdate)
    return; 

  var strings = document.getElementById("bundle_browser");
  var activeUpdate = um.activeUpdate;
  
  // If there's an active update, substitute its name into the label
  // we show for this item, otherwise display a generic label.
  function getStringWithUpdateName(key) {
    if (activeUpdate && activeUpdate.name)
      return strings.getFormattedString(key, [activeUpdate.name]);
    return strings.getString(key + "Fallback");
  }
  
  // By default, show "Check for Updates..."
  var key = "default";
  if (activeUpdate) {
    switch (activeUpdate.state) {
    case "downloading":
      // If we're downloading an update at present, show the text:
      // "Downloading Firefox x.x..." otherwise we're paused, and show
      // "Resume Downloading Firefox x.x..."
      key = updates.isDownloading ? "downloading" : "resume";
      break;
    case "pending":
      // If we're waiting for the user to restart, show: "Apply Downloaded
      // Updates Now..."
      key = "pending";
      break;
    }
  }
  checkForUpdates.label = getStringWithUpdateName("updatesItem_" + key);
  if (um.activeUpdate && updates.isDownloading)
    checkForUpdates.setAttribute("loading", "true");
  else
    checkForUpdates.removeAttribute("loading");
}

function openWebPanel(aTitle, aURI) {

  // Get the top browser window
  var w = getTopWin();
  if (!w)
    w = openDialog(getBrowserURL(), "_blank", "chrome,all,dialog=no");
                 
  // Set the title and source
  var sidebarBox = w.document.getElementById("sidebar-box");
  sidebarBox.setAttribute("webpanelopen", "true");
  sidebarBox.setAttribute("webpaneltitle", aTitle);
  sidebarBox.setAttribute("webpanelsrc", aURI);
      
  // Ensure that the web panels sidebar is open.
  w.toggleSidebar('viewWebPanelsSidebar', true);
  
  /**
   * Tell the Web Panels sidebar to load the uri.  If the web panel sidebar
   * is not ready to load, it will pick it up in its on onload handler.
   */
  var sidebar = w.document.getElementById("sidebar");
  if (sidebar.docShell && sidebar.contentDocument && 
      sidebar.contentDocument.getElementById('web-panels-browser'))
    sidebar.contentWindow.loadWebPanel();  
}