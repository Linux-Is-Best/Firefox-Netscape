//@line 39 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/bookmarks/content/bookmarks.js"

//@line 43 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/bookmarks/content/bookmarks.js"
const ADD_BM_DIALOG_FEATURES = "centerscreen,chrome,dialog,resizable,dependent";
//@line 45 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/bookmarks/content/bookmarks.js"

const kBATCH_LIMIT = 4;

var gNC_NS, gWEB_NS, gRDF_NS, gXUL_NS, gNC_NS_CMD;

// definition of the services frequently used for bookmarks
var kRDFContractID;
var kRDFSVCIID;
var kRDFRSCIID;
var kRDFLITIID;
var RDF;

var kRDFCContractID;
var kRDFCIID;
var RDFC;

var kRDFCUContractID;
var kRDFCUIID;
var RDFCU;

var BMDS;
var kBMSVCIID;
var BMSVC;

var kPREFContractID;
var kPREFIID;
var PREF;

var kSOUNDContractID;
var kSOUNDIID;
var SOUND;

var kWINDOWContractID;
var kWINDOWIID;
var WINDOWSVC;

var kDSContractID;
var kDSIID;
var DS;

var kIOContractID;
var kIOIID;
var IOSVC;

var kMICSUMContractID;
var kMICSUMIID;
var MICSUMSVC;

var gBmProperties;
var gBkmkTxnSvc;

// should be moved in a separate file
function initServices()
{
  gNC_NS     = "http://home.netscape.com/NC-rdf#";
  gWEB_NS    = "http://home.netscape.com/WEB-rdf#";
  gRDF_NS    = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
  gXUL_NS    = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  gNC_NS_CMD = gNC_NS + "command?cmd=";

  kRDFContractID   = "@mozilla.org/rdf/rdf-service;1";
  kRDFSVCIID       = Components.interfaces.nsIRDFService;
  kRDFRSCIID       = Components.interfaces.nsIRDFResource;
  kRDFLITIID       = Components.interfaces.nsIRDFLiteral;
  RDF              = Components.classes[kRDFContractID].getService(kRDFSVCIID);

  kRDFCContractID  = "@mozilla.org/rdf/container;1";
  kRDFCIID         = Components.interfaces.nsIRDFContainer;
  RDFC             = Components.classes[kRDFCContractID].createInstance(kRDFCIID);

  kRDFCUContractID = "@mozilla.org/rdf/container-utils;1";
  kRDFCUIID        = Components.interfaces.nsIRDFContainerUtils;
  RDFCU            = Components.classes[kRDFCUContractID].getService(kRDFCUIID);

  kPREFContractID  = "@mozilla.org/preferences-service;1";
  kPREFIID         = Components.interfaces.nsIPrefService;
  PREF             = Components.classes[kPREFContractID].getService(kPREFIID)
                               .getBranch(null);

  kSOUNDContractID = "@mozilla.org/sound;1";
  kSOUNDIID        = Components.interfaces.nsISound;
  SOUND            = Components.classes[kSOUNDContractID].createInstance(kSOUNDIID);

  kWINDOWContractID = "@mozilla.org/appshell/window-mediator;1";
  kWINDOWIID        = Components.interfaces.nsIWindowMediator;
  WINDOWSVC         = Components.classes[kWINDOWContractID].getService(kWINDOWIID);

  kDSContractID     = "@mozilla.org/widget/dragservice;1";
  kDSIID            = Components.interfaces.nsIDragService;
  DS                = Components.classes[kDSContractID].getService(kDSIID);

  kIOContractID     = "@mozilla.org/network/io-service;1";
  kIOIID            = Components.interfaces.nsIIOService;
  IOSVC             = Components.classes[kIOContractID].getService(kIOIID);
  
  kMICSUMContractID = "@mozilla.org/microsummary/service;1";
  kMICSUMIID        = Components.interfaces.nsIMicrosummaryService;
  MICSUMSVC         = Components.classes[kMICSUMContractID].getService(kMICSUMIID);
  
  gBmProperties     = [RDF.GetResource(gNC_NS+"Name"),
                       RDF.GetResource(gNC_NS+"URL"),
                       RDF.GetResource(gNC_NS+"ShortcutURL"),
                       RDF.GetResource(gNC_NS+"Description"),
                       RDF.GetResource(gNC_NS+"WebPanel"),
                       RDF.GetResource(gNC_NS+"FeedURL"),
                       RDF.GetResource(gNC_NS+"MicsumGenURI"),
                       RDF.GetResource(gNC_NS+"MicsumExpiration"),
                       RDF.GetResource(gNC_NS+"GeneratedTitle")];
  gBkmkTxnSvc = Components.classes["@mozilla.org/bookmarks/transactionmanager;1"]
                          .getService(Components.interfaces.nsIBookmarkTransactionManager);
}

function initBMService()
{
  kBMSVCIID = Components.interfaces.nsIBookmarksService;
  BMDS  = RDF.GetDataSource("rdf:bookmarks");
  BMSVC = BMDS.QueryInterface(kBMSVCIID);
}

/**
 * XXX - 24 Jul 04
 * If you add a command that needs to run from the main browser window,
 * it needs to be added to browser/base/content/browser-sets.inc as well!
 *
 * XXX - 04/16/01
 *  ACK! massive command name collision problems are causing big issues
 *  in getting this stuff to work in the Navigator window. For sanity's 
 *  sake, we need to rename all the commands to be of the form cmd_bm_*
 *  otherwise there'll continue to be problems. For now, we're just 
 *  renaming those that affect the personal toolbar (edit operations,
 *  which were clashing with the textfield controller)
 *
 * There are also several places that need to be updated if you need
 * to change a command name. 
 *   1) the controller...
 *      - in bookmarksTree.xml if the command is tree-specifc
 *      - in bookmarksMenu.js if the command is DOM-specific
 *      - in bookmarks.js otherwise
 *   2) the command nodes in the overlay or xul file
 *   3) the command human-readable name key in bookmarks.properties
 *   4) the function 'getCommands' in bookmarks.js
 */

var BookmarksCommand = {

  /////////////////////////////////////////////////////////////////////////////
  // This method constructs a menuitem for a context menu for the given command.
  // This is implemented by the client so that it can intercept menuitem naming
  // as appropriate.
  createMenuItem: function (aDisplayName, aAccessKey, aCommandName, aSelection)
  {
    var xulElement = document.createElementNS(gXUL_NS, "menuitem");
    xulElement.setAttribute("cmd", aCommandName);
    var cmd = "cmd_" + aCommandName.substring(gNC_NS_CMD.length);
    xulElement.setAttribute("command", cmd);
    xulElement.setAttribute("label", aDisplayName);
    xulElement.setAttribute("accesskey", aAccessKey);
    return xulElement;
  },

  /////////////////////////////////////////////////////////////////////////////
  // Fill a context menu popup with menuitems that are appropriate for the current
  // selection.
  createContextMenu: function (aEvent, aSelection, aDS)
  {
    if (aSelection == undefined) {
      aEvent.preventDefault();
      return;
    }

    var popup = aEvent.target;
    // clear out the old context menu contents (if any)
    while (popup.hasChildNodes()) 
      popup.removeChild(popup.firstChild);
        
    var commonCommands = [];
    for (var i = 0; i < aSelection.length; ++i) {
      var commands = this.getCommands(aSelection.item[i], aSelection.parent[i], aDS);
      if (!commands) {
        aEvent.preventDefault();
        return;
      }
      commands = this.flattenEnumerator(commands);
      if (!commonCommands.length) commonCommands = commands;
      commonCommands = this.findCommonNodes(commands, commonCommands);
    }

    if (!commonCommands.length) {
      aEvent.preventDefault();
      return;
    }
    
    // Now that we should have generated a list of commands that is valid
    // for the entire selection, build a context menu.
    for (i = 0; i < commonCommands.length; ++i) {
      var currCommand = commonCommands[i].QueryInterface(kRDFRSCIID).Value;
      var element = null;
      if (currCommand != gNC_NS_CMD + "bm_separator") {
        var commandName = this.getCommandName(currCommand);
        var accessKey = this.getAccessKey(currCommand);
        element = this.createMenuItem(commandName, accessKey, currCommand, aSelection);
      }
      else if (i != 0 && i < commonCommands.length-1) {
        // Never append a separator as the first or last element in a context
        // menu.
        element = document.createElementNS(gXUL_NS, "menuseparator");
      }
      if (element) 
        popup.appendChild(element);
    }

    if (popup.firstChild.getAttribute("command") == "cmd_bm_open")
      popup.firstChild.setAttribute("default", "true");
  },
  
  /////////////////////////////////////////////////////////////////////////////
  // Given two unique arrays, return an array that contains only the elements
  // common to both. 
  findCommonNodes: function (aNewArray, aOldArray)
  {
    var common = [];
    for (var i = 0; i < aNewArray.length; ++i) {
      for (var j = 0; j < aOldArray.length; ++j) {
        if (common.length > 0 && common[common.length-1] == aNewArray[i])
          continue;
        if (aNewArray[i] == aOldArray[j])
          common.push(aNewArray[i]);
      }
    }
    return common;
  },

  flattenEnumerator: function (aEnumerator)
  {
    if ("_index" in aEnumerator)
      return aEnumerator._inner;
    
    var temp = [];
    while (aEnumerator.hasMoreElements()) 
      temp.push(aEnumerator.getNext());
    return temp;
  },
  
  /////////////////////////////////////////////////////////////////////////////
  // For a given URI (a unique identifier of a resource in the graph) return 
  // an enumeration of applicable commands for that URI. 
  getCommands: function (aNodeID, aParent, aDS)
  {
    var type = BookmarksUtils.resolveType(aNodeID, aDS);
    if (!type)
      return null;

    var ptype = null;
    aParent =  (aParent != null) ? aParent : BMSVC.getParent(aNodeID);
    if (aParent) {
      ptype = BookmarksUtils.resolveType(aParent, aDS);
      if (ptype == "Livemark") {
        type = "LivemarkBookmark";
      }
    }

    var commands = [];
    // menu order:
    // 
    // bm_open, bm_openfolder
    // bm_openinnewwindow
    // bm_openinnewtab
    // bm_openinsidebar
    // ---------------------
    // bm_newfolder
    // ---------------------
    // cut
    // copy
    // paste
    // ---------------------
    // delete
    // ---------------------
    // bm_refreshlivemark
    // bm_refreshmicrosummary
    // bm_sortbyname
    // ---------------------
    // bm_properties
    switch (type) {
    case "BookmarkSeparator":
      commands = ["bm_newbookmark", "bm_newfolder", "bm_newseparator", "bm_separator",
                  "cut", "copy", "paste", "bm_separator",
                  "delete", "bm_separator",
                  "bm_sortbyname", "bm_separator",
                  "bm_properties"];
      break;
    case "Bookmark":
      commands = ["bm_open", "bm_openinnewwindow", "bm_openinnewtab", "bm_openinsidebar","bm_separator",
                  "bm_newbookmark", "bm_newfolder", "bm_newseparator", "bm_separator",
                  "cut", "copy", "paste", "bm_separator",
                  "delete", "bm_separator",
                  "bm_sortbyname", "bm_separator",
                  "bm_properties"];
      // If this bookmark has a microsummary, add a command for refreshing it
      // right before the "sort by name" (bm_sortbyname) command.
      if (MICSUMSVC.hasMicrosummary(aNodeID))
        commands.splice(14, 0, "bm_refreshmicrosummary");
      break;
    case "Folder":
    case "PersonalToolbarFolder":
      commands = ["bm_openfolder", "bm_separator", "bm_newbookmark", 
                  "bm_newfolder", "bm_newseparator", "bm_separator",
                  "cut", "copy", "paste", "bm_separator",
                  "delete", "bm_separator",
                  "bm_sortbyname", "bm_separator",
                  "bm_properties"];
      break;
    case "IEFavoriteFolder":
      commands = ["bm_separator", "delete"];
      break;
    case "IEFavorite":
      commands = ["bm_open", "bm_openinnewwindow", "bm_openinnewtab", "bm_separator",
                  "copy"];
      break;
    case "FileSystemObject":
      commands = ["bm_open", "bm_openinnewwindow", "bm_openinnewtab", "bm_separator",
                  "copy"];
      break;
    case "Livemark":
      commands = ["bm_openfolder", "bm_separator",
                  "cut", "copy", "bm_separator",
                  "delete", "bm_separator",
                  "bm_refreshlivemark", "bm_sortbyname", "bm_separator",
                  "bm_properties"];
      break;
    case "LivemarkBookmark":
      commands = ["bm_open", "bm_openinnewwindow", "bm_openinnewtab", "bm_separator",
                  "copy"];
      break;
    case "ImmutableBookmark":
      commands = ["bm_open", "bm_openinnewwindow", "bm_openinnewtab","bm_openinsidebar"];
      break;
    default: 
      commands = [];
    }

    return new CommandArrayEnumerator(commands);
  },
  
  /////////////////////////////////////////////////////////////////////////////
  // Retrieve the human-readable name for a particular command. Used when 
  // manufacturing a UI to invoke commands.
  getCommandName: function (aCommand) 
  {
    var cmdName = aCommand.substring(gNC_NS_CMD.length);
    return BookmarksUtils.getLocaleString ("cmd_" + cmdName);
  },

  /////////////////////////////////////////////////////////////////////////////
  // Retrieve the access key for a particular command. Used when 
  // manufacturing a UI to invoke commands.
  getAccessKey: function (aCommand) 
  {
    var cmdName = aCommand.substring(gNC_NS_CMD.length);
    return BookmarksUtils.getLocaleString ("cmd_" + cmdName + "_accesskey");
  },
  
  ///////////////////////////////////////////////////////////////////////////
  // Execute a command with the given source and arguments
  doBookmarksCommand: function (aSource, aCommand, aArgumentsArray)
  {
    var rCommand = RDF.GetResource(aCommand);
  
    var kSuppArrayContractID = "@mozilla.org/supports-array;1";
    var kSuppArrayIID = Components.interfaces.nsISupportsArray;
    var sourcesArray = Components.classes[kSuppArrayContractID].createInstance(kSuppArrayIID);
    if (aSource) {
      sourcesArray.AppendElement(aSource);
    }
  
    var argsArray = Components.classes[kSuppArrayContractID].createInstance(kSuppArrayIID);
    var length = aArgumentsArray?aArgumentsArray.length:0;
    for (var i = 0; i < length; ++i) {
      var rArc = RDF.GetResource(aArgumentsArray[i].property);
      argsArray.AppendElement(rArc);
      var rValue = null;
      if ("resource" in aArgumentsArray[i]) { 
        rValue = RDF.GetResource(aArgumentsArray[i].resource);
      }
      else
        rValue = RDF.GetLiteral(aArgumentsArray[i].literal);
      argsArray.AppendElement(rValue);
    }

    // Exec the command in the Bookmarks datasource. 
    BMDS.DoCommand(sourcesArray, rCommand, argsArray);
  },

  undoBookmarkTransaction: function ()
  {
    gBkmkTxnSvc.undo();
    BookmarksUtils.refreshSearch();
    BookmarksUtils.flushDataSource();
  },

  redoBookmarkTransaction: function ()
  {
    gBkmkTxnSvc.redo();
    BookmarksUtils.refreshSearch();
    BookmarksUtils.flushDataSource();
  },

  manageFolder: function (aSelection)
  {
    openDialog("chrome://browser/content/bookmarks/bookmarksManager.xul", 
               "", "chrome,all,dialog=no", aSelection.item[0].Value);
  },
  
  cutBookmark: function (aSelection)
  {
    this.copyBookmark(aSelection);
    BookmarksUtils.removeAndCheckSelection("cut", aSelection);
  },

  copyBookmark: function (aSelection)
  {
    const kSuppArrayContractID = "@mozilla.org/supports-array;1";
    const kSuppArrayIID = Components.interfaces.nsISupportsArray;
    var itemArray = Components.classes[kSuppArrayContractID].createInstance(kSuppArrayIID);

    const kSuppWStringContractID = "@mozilla.org/supports-string;1";
    const kSuppWStringIID = Components.interfaces.nsISupportsString;
    var bmstring = Components.classes[kSuppWStringContractID].createInstance(kSuppWStringIID);
    var unicodestring = Components.classes[kSuppWStringContractID].createInstance(kSuppWStringIID);
    var htmlstring = Components.classes[kSuppWStringContractID].createInstance(kSuppWStringIID);
  
    var sBookmarkItem = ""; var sTextUnicode = ""; var sTextHTML = ""; var tmpBmItem = [];
    for (var i = 0; i < aSelection.length; ++i) {
      sBookmarkItem += aSelection.item[i].Value + "\n";

      // save the selection property into text string that we will use later in paste function
      // and in INSERT tranasactions
      // (if the selection is folder or livemark save all childs property)
      var aType = BookmarksUtils.resolveType(aSelection.item[i]);
      if (aType == "Livemark") {
        sBookmarkItem += "\n\n\n\n\n\n\n\n\n"; // don't change livemark properties
      } else {
         for (var j = 0; j < gBmProperties.length; ++j) {
            var itemValue = BMDS.GetTarget(aSelection.item[i], gBmProperties[j], true);
            if (itemValue)
                sBookmarkItem += itemValue.QueryInterface(kRDFLITIID).Value + "\n";
            else
                sBookmarkItem += "\n";
         }
      }
      var childCount = 1;
      if (aType == "Folder" || aType == "Livemark") {
         var propArray = [];
         BookmarksUtils.getAllChildren(aSelection.item[i], propArray);
         for (var k = 0; k < propArray.length; ++k) {
            for (var j = 0; j < gBmProperties.length + 1; ++j) {
               if (propArray[k][j])
                   sBookmarkItem += propArray[k][j].Value + "\n";
               else
                   sBookmarkItem += "\n";
            }
         }
         childCount += propArray.length;
      }
      tmpBmItem.push(childCount +  "\n" + sBookmarkItem);
      sBookmarkItem = "";

      var url;
      if (aType == "Livemark")
        url = BookmarksUtils.getProperty(aSelection.item[i], gNC_NS+"FeedURL");
      else
        url = BookmarksUtils.getProperty(aSelection.item[i], gNC_NS+"URL");

      var name = BookmarksUtils.getProperty(aSelection.item[i], gNC_NS+"Name");

      sTextUnicode += url + "\n";
      sTextHTML += "<A HREF=\"" + url + "\">" + name + "</A>";
    }
    sTextUnicode = sTextUnicode.replace(/\n$/,"");
    
    // generate unique separator and combine the array to one string 
    var bmSeparator = "]-[", extrarSeparator = "@";
    for (var i = 0; i < tmpBmItem.length; ++i) {
        while (tmpBmItem[i].indexOf(bmSeparator)>-1)
           bmSeparator += extrarSeparator;
    }
    for (var i = 0; i < tmpBmItem.length; ++i) {
      sBookmarkItem += tmpBmItem[i] + bmSeparator;
    }
    // insert the separator to sBookmarkItem so we can extract it in pasteBookmark
    sBookmarkItem = bmSeparator + "\n" + sBookmarkItem;
    
    const kXferableContractID = "@mozilla.org/widget/transferable;1";
    const kXferableIID = Components.interfaces.nsITransferable;
    var xferable = Components.classes[kXferableContractID].createInstance(kXferableIID);

    xferable.addDataFlavor("moz/bookmarkclipboarditem");
    bmstring.data = sBookmarkItem;
    xferable.setTransferData("moz/bookmarkclipboarditem", bmstring, sBookmarkItem.length*2);
    
    xferable.addDataFlavor("text/html");
    htmlstring.data = sTextHTML;
    xferable.setTransferData("text/html", htmlstring, sTextHTML.length*2);
    
    xferable.addDataFlavor("text/unicode");
    unicodestring.data = sTextUnicode;
    xferable.setTransferData("text/unicode", unicodestring, sTextUnicode.length*2);
    
    const kClipboardContractID = "@mozilla.org/widget/clipboard;1";
    const kClipboardIID = Components.interfaces.nsIClipboard;
    var clipboard = Components.classes[kClipboardContractID].getService(kClipboardIID);
    clipboard.setData(xferable, null, kClipboardIID.kGlobalClipboard);
  },

  pasteBookmark: function (aTarget)
  {
    const kXferableContractID = "@mozilla.org/widget/transferable;1";
    const kXferableIID = Components.interfaces.nsITransferable;
    var xferable = Components.classes[kXferableContractID].createInstance(kXferableIID);
    xferable.addDataFlavor("moz/bookmarkclipboarditem");
    xferable.addDataFlavor("text/x-moz-url");
    xferable.addDataFlavor("text/unicode");

    const kClipboardContractID = "@mozilla.org/widget/clipboard;1";
    const kClipboardIID = Components.interfaces.nsIClipboard;
    var clipboard = Components.classes[kClipboardContractID].getService(kClipboardIID);
    clipboard.getData(xferable, kClipboardIID.kGlobalClipboard);
    
    var flavour = { };
    var data    = { };
    var length  = { };
    xferable.getAnyTransferData(flavour, data, length);
    var items, name, url, childs, removedProps = [];
    data = data.value.QueryInterface(Components.interfaces.nsISupportsString).data;
    switch (flavour.value) {
    case "moz/bookmarkclipboarditem":
      var tmpItem = data.split("\n");
      var sep = tmpItem.shift();
      data = tmpItem.join("\n");
      items = data.split(sep);
      // since data are ended by separator, remove the last empty node
      items.pop(); 
      // convert propery from text string to array
      var p = gBmProperties.length+1;
      for (var i = 0; i < items.length; ++i) {
        childs = items[i].split("\n");
        childs.pop();
        var childCount = childs.shift();
        items[i] = RDF.GetResource(childs[0]);
        var propArray = [];
        for (var k = 0; k < childCount; ++k) {
          for (var j = 1; j < p; ++j) {
             var prop = childs[p*k+j];
             if (prop)
                 propArray.push(RDF.GetLiteral(prop));
             else
                 propArray.push(null);
          }
        }
        removedProps.push(propArray);
      }
      break;
    case "text/x-moz-url":
      // there should be only one item in this case
      var ix = data.indexOf("\n");
      items = data.substring(0, ix != -1 ? ix : data.length);
      name  = data.substring(ix);
      // XXX: we should infer the best charset
      var createdBookmarkResource = BookmarksUtils.createBookmark(null, items, null, name, null);
      items = [createdBookmarkResource];
      break;
    default: 
      return;
    }
   
    var selection = {item: items, parent:Array(items.length), length: items.length, prop: removedProps};
    BookmarksUtils.checkSelection(selection);
    BookmarksUtils.insertAndCheckSelection("paste", selection, aTarget, -1);
  },
  
  deleteBookmark: function (aSelection)
  {
    // call checkSelection here to update the immutable and other
    // flags on the selection; when new resources get created,
    // they're temporarily not valid because they're not in a
    // bookmark container.  So, they can't be removed until that's
    // fixed.
    BookmarksUtils.checkSelection(aSelection);
    BookmarksUtils.removeAndCheckSelection("delete", aSelection);
  },

  moveBookmark: function (aSelection)
  {
    var rv = { selectedFolder: null };      
    openDialog("chrome://browser/content/bookmarks/addBookmark.xul", "", 
               "centerscreen,chrome,modal=yes,dialog=yes,resizable=yes", null, 
               null, null, null, "selectFolder", rv);
    if (!rv.target)
      return;
    BookmarksUtils.moveAndCheckSelection("move", aSelection, rv.target);
  },

  openBookmark: function (aSelection, aTargetBrowser, aDS) 
  {
    if (!aTargetBrowser)
      return;

    // in this case, we can just use |aSelection.length| as "Open in Tabs"
    // is only available when you are only selecting multiple bookmarks
    // if you selected a folder of bookmarks, we check the number of tabs in
    // openGroupBookmark()
    if (aTargetBrowser == "tab" && !this._confirmOpenTabs(aSelection.length))
      return;

    for (var i=0; i<aSelection.length; ++i) {
      var type = aSelection.type[i];
      if (aTargetBrowser == "save") {
        this.saveBookmark(aSelection.item[i].Value, aDS);
      }
      else if (type == "Bookmark" || type == "ImmutableBookmark") {
        var webPanel = BMDS.GetTarget(aSelection.item[i],
                                      RDF.GetResource(gNC_NS + "WebPanel"),
                                      true);
        if (aTargetBrowser == "sidebar" || (webPanel && aTargetBrowser == "current"))
          this.openWebPanel(aSelection.item[i].Value, aDS);
        else
          this.openOneBookmark(aSelection.item[i].Value, aTargetBrowser, aDS);
      }
      else if (type == "Folder" || type == "PersonalToolbarFolder" || type == "Livemark")
        this.openGroupBookmark(aSelection.item[i].Value, aTargetBrowser);

    }
  },
  
  openBookmarkProperties: function (aSelection) 
  {
    // Bookmark Properties dialog is only ever opened with one selection 
    // (command is disabled otherwise)
    var bookmark = aSelection.item[0].Value;
    var value = {};
    openDialog("chrome://browser/content/bookmarks/bookmarksProperties.xul", "", "centerscreen,chrome,modal,resizable=no", bookmark, value);
    return value.ok;
  },

  // requires utilityOverlay.js if opening in new window for getTopWin()
  openWebPanel: function(aResource, aDS)
  {
    var url = BookmarksUtils.getProperty(aResource, gNC_NS+"URL", aDS);
    // Ignore "NC:" and empty urls.
    if (url == "")
      return;
    openWebPanel(BookmarksUtils.getProperty(aResource,  gNC_NS+"Name"), url);
  },

  // requires contentAreaUtils.js because it calls saveURL
  saveBookmark: function(aResource, aDS)
  {
    var url = BookmarksUtils.getProperty(aResource, gNC_NS+"URL", aDS);
    // Ignore "NC:" and empty urls.
    if (url == "")
      return;
    var fileName = BookmarksUtils.getProperty(aResource, gNC_NS+"Name", aDS);

    saveURL(url, fileName, null, true); 
  },

  // requires utilityOverlay.js because it calls openUILinkIn
  openOneBookmark: function (aURI, aTargetBrowser, aDS)
  {
    var url = BookmarksUtils.getProperty(aURI, gNC_NS+"URL", aDS);
    // Ignore "NC:" and empty urls.
    if (url == "")
      return;

    openUILinkIn(url, aTargetBrowser);
  },

  _confirmOpenTabs: function(numTabsToOpen) 
  {
    var reallyOpen = true;

    const kWarnOnOpenPref = "browser.tabs.warnOnOpen";
    if (PREF.getBoolPref(kWarnOnOpenPref))
    {
      if (numTabsToOpen >= PREF.getIntPref("browser.tabs.maxOpenBeforeWarn"))
      {
        var promptService = 
            Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
            getService(Components.interfaces.nsIPromptService);
 
        // default to true: if it were false, we wouldn't get this far
        var warnOnOpen = { value: true };
 
        var messageKey = "tabs.openWarningMultipleBranded";
        var openKey = "tabs.openButtonMultiple";

        var buttonPressed = promptService.confirmEx(window,
            BookmarksUtils.getLocaleString("tabs.openWarningTitle"),
            BookmarksUtils.getLocaleString(messageKey, 
              [numTabsToOpen, BookmarksUtils._brandShortName]),
            (promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_0)
            + (promptService.BUTTON_TITLE_CANCEL * promptService.BUTTON_POS_1),
            BookmarksUtils.getLocaleString(openKey),
            null, null,
            BookmarksUtils.getLocaleString("tabs.openWarningPromptMeBranded",
               [BookmarksUtils._brandShortName]),
            warnOnOpen);

         reallyOpen = (buttonPressed == 0);
         // don't set the pref unless they press OK and it's false
         if (reallyOpen && !warnOnOpen.value)
           PREF.setBoolPref(kWarnOnOpenPref, false);
       }
    }
    return reallyOpen;
  },

  openGroupBookmark: function (aURI, aTargetBrowser)
  {
    var w = getTopWin();
    if (!w)
      // no browser window is open, we have to open the group into a new window
      aTargetBrowser = "window";

    var resource = RDF.GetResource(aURI);
    var urlArc   = RDF.GetResource(gNC_NS+"URL");
    RDFC.Init(BMDS, resource);
    var containerChildren = RDFC.GetElements();
    var numTabsToOpen = 0;

    // we can't just use |RDFC.GetCount()| as that might include
    // folders, separators, deleted bookmarks, etc.
    while (containerChildren.hasMoreElements()) {
      var res = containerChildren.getNext().QueryInterface(kRDFRSCIID);
      var type = BookmarksUtils.resolveType(res);
      // these are the types in getCommands() that support the 
      // "bm_openinnewwindow" and "bm_openinnewtab" commands
      if (type == "Bookmark" || type == "LivemarkBookmark" || 
          type == "ImmutableBookmark" || type == "IEFavorite" ||
          type == "FileSystemObject")
        numTabsToOpen++;
    }

    if (!this._confirmOpenTabs(numTabsToOpen))
      return;

    // counting the number of tabs to open modified the 
    // containerChildren enumerator, so we need to reset it.
    containerChildren = RDFC.GetElements();
    if (aTargetBrowser == "current" || aTargetBrowser == "tab") {
      var browser  = w.document.getElementById("content");
      var tabPanels = browser.browsers;
      var tabCount  = tabPanels.length;
      var doReplace = PREF.getBoolPref("browser.tabs.loadFolderAndReplace");
      var loadInBackground = PREF.getBoolPref("browser.tabs.loadBookmarksInBackground");
      var index0;
      if (doReplace)
        index0 = 0;
      else {
        for (index0=tabCount-1; index0>=0; --index0)
        {
          var tab = tabPanels[index0];
          if (tab.webNavigation.currentURI.spec != "about:blank" ||
              tab.webProgress.isLoadingDocument)
            break;
        }
        ++index0;
      }

      var index = index0;
      while (containerChildren.hasMoreElements()) {
        var res = containerChildren.getNext().QueryInterface(kRDFRSCIID);
        var target = BMDS.GetTarget(res, urlArc, true);
        if (target) {
          var uri = target.QueryInterface(kRDFLITIID).Value;
          if (index < tabCount)
            tabPanels[index].loadURI(uri);
          else {
            // This is not a modal sub-action of a given tab/document within a window
            // since opening a bookmarks group replaces all existing tabs in the window,
            // closing extras. If this ever changes to be augmentative, this code will
            // have to change to probably just use <tabbrowser>.loadTabs() which figures
            // out whether or not owner should be set. 
            browser.addTab(uri);
          }
          ++index;
        }
      }

      // If the bookmark group was completely invalid, just bail.
      if (index == index0)
        return;

      // focus the first tab if prefs say to
      if (!loadInBackground || doReplace) {
        // Select the first tab in the group.
        // Set newly selected tab after quick timeout, otherwise hideous focus problems
        // can occur because new presshell is not ready to handle events
        function selectNewForegroundTab(browser, tab) {
          browser.selectedTab = tab;
        }
        var tabs = browser.mTabContainer.childNodes;
        setTimeout(selectNewForegroundTab, 0, browser, tabs[index0]);
      }

      // Close any remaining open tabs that are left over.
      // (Always skipped when we append tabs)
      for (var i = tabCount-1; i >= index; --i)
        browser.removeTab(tabs[i]);

      // and focus the content
      w.content.focus();

    } else if (aTargetBrowser == "window") {
      var URIs = [];

      while (containerChildren.hasMoreElements()) {
        var res = containerChildren.getNext().QueryInterface(kRDFRSCIID);
        var target = BMDS.GetTarget(res, urlArc, true);
        if (target)
          URIs.push(target.QueryInterface(kRDFLITIID).Value);
      }

      openDialog(getBrowserURL(), "_blank", "chrome,all,dialog=no", URIs.join("|"));
    }
  },

  createNewBookmark: function (aTarget)
  {
    var name     = BookmarksUtils.getLocaleString("ile_newbookmark");
    var resource = BMSVC.createBookmark(name, "", "", "", "", null);
    this.createNewResource(resource, aTarget, "newbookmark");
  },

  createNewLivemark: function (aTarget)
  {
    var name     = BookmarksUtils.getLocaleString("ile_newlivemark");
    var resource = BMSVC.createLivemark(name, "", "", null);
    this.createNewResource(resource, aTarget, "newlivemark");
  },

  createNewFolder: function (aTarget)
  {
    var name     = BookmarksUtils.getLocaleString("ile_newfolder");
    var resource = BMSVC.createFolder(name);
    this.createNewResource(resource, aTarget, "newfolder");
    // temporary hack...
    return resource;
  },

  createNewSeparator: function (aTarget)
  {
    var resource = BMSVC.createSeparator();
    this.createNewResource(resource, aTarget, "newseparator");
  },

  createNewResource: function(aResource, aTarget, aTxnType)
  {
    var selection = BookmarksUtils.getSelectionFromResource(aResource, aTarget.parent);
    var ok        = BookmarksUtils.insertAndCheckSelection(aTxnType, selection, aTarget, -1);
    if (ok && aTxnType != "newseparator") {
      ok = this.openBookmarkProperties(selection);
      if (!ok)
        BookmarksCommand.deleteBookmark(selection);
    }
  },

  importBookmarks: function ()
  {
      // XXX: ifdef it to be non-modal (non-"sheet") on mac (see bug 259039)
      var features = "modal,centerscreen,chrome,resizable=no";
      window.fromFile = false;
      window.openDialog("chrome://browser/content/migration/migration.xul", "migration", features, "bookmarks");
      if(window.fromFile)
      {
        this.importBookmarksFromFile();
      }
  },

  importBookmarksFromFile: function ()
  {
    ///transaction...
    try {
      const kFilePickerContractID = "@mozilla.org/filepicker;1";
      const kFilePickerIID = Components.interfaces.nsIFilePicker;
      const kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
    
      const kTitle = BookmarksUtils.getLocaleString("SelectImport");
      kFilePicker.init(window, kTitle, kFilePickerIID["modeOpen"]);
      kFilePicker.appendFilters(kFilePickerIID.filterHTML | kFilePickerIID.filterAll);
      kFilePicker.appendFilter("OPML Files","*.opml; *.xml; *.OPML; *.XML");
      var fileName;
      if (kFilePicker.show() != kFilePickerIID.returnCancel) {
        fileName = kFilePicker.file.path;
        if (!fileName) return;
      }
      else return;
    }
    catch (e) {
      return;
    }

    if (fileName.match(/\.(opml|xml)$/i)){
      this.importBookmarksFromOPMLFile(kFilePicker.file);
      return;
    }

    rTarget = RDF.GetResource("NC:BookmarksRoot");
    RDFC.Init(BMDS, rTarget);
    var countBefore = parseInt(BookmarksUtils.getProperty(rTarget, gRDF_NS+"nextVal"));
    var args = [{ property: gNC_NS+"URL", literal: fileName}];
    this.doBookmarksCommand(rTarget, gNC_NS_CMD+"import", args);
    var countAfter = parseInt(BookmarksUtils.getProperty(rTarget, gRDF_NS+"nextVal"));

    if (countAfter - countBefore > 1)
      gBkmkTxnSvc.startBatch();
    for (var index = countBefore; index < countAfter; index++) {
      var nChildArc = RDFCU.IndexToOrdinalResource(index);
      var rChild    = BMDS.GetTarget(rTarget, nChildArc, true);
      gBkmkTxnSvc.createAndCommitTxn(gBkmkTxnSvc.IMPORT, "IMPORT", rChild, index,
                                    rTarget, 0, null);
    }
    if (countAfter - countBefore > 1)
      gBkmkTxnSvc.endBatch();

    BookmarksUtils.flushDataSource();
  },

  importBookmarksFromOPMLFile : function (file) {
		var fix = Components.classes['@mozilla.org/docshell/urifixup;1'].getService(Components.interfaces.nsIURIFixup);
		var url = fix.createFixupURI(file.path, fix.FIXUP_FLAG_ALLOW_KEYWORD_LOOKUP);

		var reader = new XMLHttpRequest();
		reader.open("GET", url.spec, false);
		reader.overrideMimeType("application/xml");
		reader.send(null);
		
		var opmldoc = reader.responseXML;

    // At this point, we have an XML doc in opmldoc
    var nodes = opmldoc.getElementsByTagName("body")[0].childNodes;

    for (var i = 0; i < nodes.length; i++){
      if (nodes[i].nodeName == 'outline'){
        this.importOPMLOutline(nodes[i]);
      }
    }
  },

  importOPMLOutline : function (node, createIn)
  {
    if (!createIn) createIn = RDF.GetResource("NC:BookmarksRoot");

    var childNodes = node.getElementsByTagName("outline");

    if (childNodes.length > 0){
      var newCreateIn = BMSVC.createFolderInContainer(node.getAttribute("text"), createIn, null);
   
      for (var i = 0; i < node.childNodes.length; i++){
        if (node.childNodes[i].nodeName == 'outline'){
          this.importOPMLOutline(node.childNodes[i], newCreateIn);
        }
      }
    }
    else {
      if (node.getAttribute("type") == "link"){
        BMSVC.createBookmarkInContainer(node.getAttribute("text"), node.getAttribute("url"),  node.getAttribute("keyword"),  node.getAttribute("description"), null, null, createIn, null);
      }
      else {
         BMSVC.createLivemarkInContainer(node.getAttribute("text"), node.getAttribute("htmlUrl"),  node.getAttribute("xmlUrl"),  node.getAttribute("description"), createIn, null);
      }
    }
  },

  exportBookmarksPrompt : function ()
  {
    window.openDialog('chrome://browser/content/bookmarks/exportTypePrompt.xul','exportTypePrompt','chrome,centerscreen,modal');
  },

  exportBookmarks: function ()
  {
    try {
      const kFilePickerContractID = "@mozilla.org/filepicker;1";
      const kFilePickerIID = Components.interfaces.nsIFilePicker;
      const kFilePicker = Components.classes[kFilePickerContractID].createInstance(kFilePickerIID);
      
      const kTitle = BookmarksUtils.getLocaleString("EnterExport");
      kFilePicker.init(window, kTitle, kFilePickerIID["modeSave"]);
      kFilePicker.appendFilters(kFilePickerIID.filterHTML | kFilePickerIID.filterAll);
      kFilePicker.defaultString = "bookmarks.html";
      var fileName;
      if (kFilePicker.show() != kFilePickerIID.returnCancel) {
        fileName = kFilePicker.file.path;
        if (!fileName) return;
      }
      else return;

      var file = Components.classes["@mozilla.org/file/local;1"]
                           .createInstance(Components.interfaces.nsILocalFile);
      if (!file)
        return;
      file.initWithPath(fileName);
      if (!file.exists()) {
        file.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
      }
    }
    catch (e) {
      return;
    }
    var selection = RDF.GetResource("NC:BookmarksRoot");
    var args = [{ property: gNC_NS+"URL", literal: fileName}];
    this.doBookmarksCommand(selection, gNC_NS_CMD+"export", args);
  },

  exportOPML : function ()
  {
		// Show a dialog, allow the user to pick bookmarks or livemarks or all
		window.openDialog('chrome://browser/content/bookmarks/opmlExport.xul','exportOPML','chrome,centerscreen,modal');
	},
	
	doExportOPML : function (feeds, links, strictClean, nested, feedMode) {
		var filePrefix = "livemarks";
		var title = "Livemarks";
		
		if (feeds && links) {
			filePrefix = "livemarks-and-bookmarks";
			title = "Livemarks and Bookmarks";
		}
		else if (links) {
			filePrefix = "bookmarks";
			title = "Bookmarks";
		}
		
		var file = this.promptForOPMLFile(filePrefix);
		
		if (file){
			var root = RDF.GetResource("NC:BookmarksRoot");
			
			var data = '';
			data += '<?xml version="1.0" encoding="UTF-8"?>' + "\n";
			data += '<opml version="1.0">' + "\n";
			data += "\t" + '<head>' + "\n";
			data += "\t\t" + '<title>' + title + ' OPML Export</title>' + "\n";
			data += "\t\t" + '<dateCreated>' + new Date().toString() + '</dateCreated>' + "\n";
			data += "\t" + '</head>' + "\n";
			data += "\t" + '<body>' + "\n";
			
			data = this.addFolderToOPML(data, feeds, links, root, feedMode, 0, strictClean, true, nested);
			
			data += "\t" + '</body>' + "\n";
			data += '</opml>';
			
			// Convert to UTF-8
			var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].getService(Components.interfaces.nsIScriptableUnicodeConverter);
			converter.charset = 'UTF-8';
			data = converter.ConvertFromUnicode(data);
			
			var outputStream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);

			outputStream.init(file, 0x04 | 0x08 | 0x20, 420, 0 );
			outputStream.write(data, data.length);
			outputStream.close();
		}
	},
	
	addFolderToOPML : function (dataString, feeds, links, folder, feedMode, level, strictClean, isBase, nested) {
		level++;
		
		if (!isBase && nested) {
			dataString += "\t";
			
			for (var i = 1; i < level; i++){
				dataString += "\t";
			}
			
			dataString += '<outline text="' + this.cleanXMLText(this.getField(folder, "Name")) + '">' + "\n";
		}
		
		RDFC.Init(BMDS, folder);

		var elements = RDFC.GetElements();
		
		while(elements.hasMoreElements()) {
			var element = elements.getNext();
			element.QueryInterface(Components.interfaces.nsIRDFResource);

			var type = BookmarksUtils.resolveType(element);

			if ((type == "Folder") || (type == "PersonalToolbarFolder")){
				dataString = this.addFolderToOPML(dataString, feeds, links, element, feedMode, level, strictClean, false, nested);
			}
			else if ((type == 'Bookmark') || (type == 'Livemark')) {
				dataString += "\t\t";
				
				for (var i = 1; i < level; i++){
					dataString += "\t";
				}
				
				if ((links && (type == 'Bookmark')) || (feeds && (type == 'Livemark') && (feedMode == 'links'))){
					dataString += '<outline type="link" text="' + this.cleanXMLText(this.getField(element, "Name"), strictClean) + '" url="' + this.cleanXMLText(this.getField(element,"URL"), strictClean) + '" description="' + this.cleanXMLText(this.getField(element, "Description"), strictClean) + '" keyword="'+this.cleanXMLText(this.getField(element, "ShortcutURL"), strictClean) + '"/>' + "\n";
				}
				else if (feeds && (type == 'Livemark')) {
					dataString += '<outline type="rss" version="RSS" text="' + this.cleanXMLText(this.getField(element, "Name"), strictClean) + '" htmlUrl="' + this.cleanXMLText(this.getField(element, "URL"), strictClean) + '" xmlUrl="' + this.cleanXMLText(this.getField(element, "FeedURL"), strictClean) + '" description="' + this.cleanXMLText(this.getField(element, "Description"), strictClean) + '"/>' + "\n";
				}
			}
		}
		
		if (!isBase && nested) {
			dataString += "\t";
			
			for (var i = 1; i < level; i++){
				dataString += "\t";
			}
			
			dataString += '</outline>' + "\n";
		}
		
		return dataString;
	},
		
	promptForOPMLFile : function (filePrefix) {
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
		fp.init(window, "Save as...", nsIFilePicker.modeSave);
		
		fp.appendFilter("OPML Files","*.opml");
		fp.appendFilter("XML Files","*.opml; *.xml; *.rdf; *.html; *.htm");
		fp.appendFilter("All Files","*");
		
		fp.defaultString = filePrefix + ".opml";
		
		var result = fp.show();
		
		if (result == nsIFilePicker.returnCancel){
			return false;
		}
		else {
			return fp.file;
		}
	},
	
	cleanXMLText : function (str, strict) {
		var res = [
			{find : '&', replace : '&amp;'},
			{find : '"', replace : '&quot;'},
			{find : '<', replace : '&lt;'},
			{find : '>', replace : '&gt;'}
		];
		
		if (strict) {
			res.push({find : '[^0-9A-Za-z~!@#\\\$%\\\^\\\&\\\*()` \\\-_\\\+=\\\[\\\]\\\\\\\{\\\}\\\|;\':,\\\./\\\?]', replace : ''});
		}
		
		for (var i = 0; i < res.length; i++){
			var re = new RegExp(res[i].find, "g");
			
			str = str.replace(re, res[i].replace);
		}
		
		return str;
	},
	
	getField : function (e, field) {
		try {
			return BMDS.GetTarget(RDF.GetResource(e.Value), RDF.GetResource("http://home.netscape.com/NC-rdf#" + field), true).QueryInterface(kRDFLITIID).Value;
		} catch (ex) {
			return '';
		}
	},
	
  refreshLivemark: function (aSelection)
  {
    var exp = RDF.GetResource(gNC_NS+"LivemarkExpiration");
    for (var i = 0; i < aSelection.length; i++) {
      rsrc = RDF.GetResource(aSelection.item[i].Value);
      oldtgt = BMDS.GetTarget(rsrc, exp, true);
      if (oldtgt) {
        BMDS.Unassert(rsrc, exp, oldtgt);
      }
    }
  },

  refreshMicrosummary: function (aSelection)
  {
    for (var i = 0; i < aSelection.length; i++) {
      rsrc = RDF.GetResource(aSelection.item[i].Value);
      MICSUMSVC.refreshMicrosummary(rsrc);
    }
  },

  sortByName: function (aSelection)
  {
    // do the real sorting in a timeout, to make sure that
    // if we sort from a menu that the menu gets torn down
    // before we sort.  the template builder really doesn't
    // like it if we move things around; the menu code also
    // doesn't like it if we move the menuparent while a
    // popup is open.
    setTimeout(function () { BookmarksCommand.realSortByName(aSelection); }, 0);
  },

  realSortByName: function (aSelection)
  {
    var theFolder;

    if (aSelection.length != 1)
      return;

    var selType = BookmarksUtils.resolveType(aSelection.item[0]);
    if (selType == "Folder" || selType == "Bookmark" ||
        selType == "PersonalToolbarFolder" || selType == "Livemark")
    {
      theFolder = aSelection.parent[0];
    } else {
      // we're not going to try to sort ImmutableBookmark siblings or
      // any other such thing, since it'll probably just get us into
      // trouble
      return;
    }

    var toSort = [];
    RDFC.Init(BMDS, theFolder);
    var folderContents = RDFC.GetElements();
    while (folderContents.hasMoreElements()) {
        var rsrc = folderContents.getNext().QueryInterface(kRDFRSCIID);
        var rtype = BookmarksUtils.resolveType(rsrc);
        if (rtype == "BookmarkSeparator")
          continue;
        toSort.push(rsrc);
    }

    const kName = RDF.GetResource(gNC_NS+"Name");

    var localeService = Components.classes["@mozilla.org/intl/nslocaleservice;1"]
                                  .getService(Components.interfaces.nsILocaleService);
    var collationFactory = Components.classes["@mozilla.org/intl/collation-factory;1"]
                                     .getService(Components.interfaces.nsICollationFactory);
    var collation = collationFactory.CreateCollation(localeService.getApplicationLocale());

    toSort.sort (function (a, b) {
                   var atype = BookmarksUtils.resolveType(a);
                   var btype = BookmarksUtils.resolveType(b);

                   var aisfolder = (atype == "Folder") || (atype == "PersonalToolbarFolder");
                   var bisfolder = (btype == "Folder") || (btype == "PersonalToolbarFolder");

                   // folders above bookmarks
                   if (aisfolder && !bisfolder)
                     return -1;
                   if (bisfolder && !aisfolder)
                     return 1;

                   // then sort by name
                   var aname = BMDS.GetTarget(a, kName, true).QueryInterface(kRDFLITIID).Value;
                   var bname = BMDS.GetTarget(b, kName, true).QueryInterface(kRDFLITIID).Value;

                   return collation.compareString(0, aname, bname);
                 });

    // we now have the resources here sorted by name
    BMDS.beginUpdateBatch();

    RDFC.Init(BMDS, theFolder);

    // remove existing elements
    var folderContents = RDFC.GetElements();
    while (folderContents.hasMoreElements()) {
      RDFC.RemoveElement (folderContents.getNext(), false);
    }

    // and add our elements back
    for (var i = 0; i < toSort.length; i++) {
      RDFC.InsertElementAt (toSort[i], i+1, true);
    }

    BMDS.endUpdateBatch();
  }

}

  /////////////////////////////////////////////////////////////////////////////
  // Command handling & Updating.
var BookmarksController = {

  supportsCommand: function (aCommand)
  {
    var isCommandSupported;
    switch(aCommand) {
    case "cmd_undo":
    case "cmd_redo":
    case "cmd_bm_undo":
    case "cmd_bm_redo":
    case "cmd_cut":
    case "cmd_copy":
    case "cmd_paste":
    case "cmd_delete":
    case "cmd_selectAll":
    case "cmd_bm_open":
    case "cmd_bm_openinnewwindow":
    case "cmd_bm_openinnewtab":
    case "cmd_bm_openinsidebar":
    case "cmd_bm_openfolder":
    case "cmd_bm_managefolder":
    case "cmd_bm_newbookmark":
    case "cmd_bm_newlivemark":
    case "cmd_bm_newfolder":
    case "cmd_bm_newseparator":
    case "cmd_bm_properties":
    case "cmd_bm_rename":
    case "cmd_bm_setnewbookmarkfolder":
    case "cmd_bm_setpersonaltoolbarfolder":
    case "cmd_bm_setnewsearchfolder":
    case "cmd_bm_import":
    case "cmd_bm_export":
    case "cmd_bm_exportopml":
    case "cmd_bm_exportprompt":
    case "cmd_bm_movebookmark":
    case "cmd_bm_refreshlivemark":
    case "cmd_bm_refreshmicrosummary":
    case "cmd_bm_sortbyname":
      isCommandSupported = true;
      break;
    default:
      isCommandSupported = false;
    }
    //if (!isCommandSupported)
    //  dump("Bookmark command '"+aCommand+"' is not supported!\n");
    return isCommandSupported;
  },

  isCommandEnabled: function (aCommand, aSelection, aTarget)
  {
    var item0, type0, junk, parent0, ptype0;
    var length = 0;
    if (aSelection && aSelection.length != 0) {
      length = aSelection.length;
      item0 = aSelection.item[0].Value;
      type0 = aSelection.type[0];
      parent0 =  (aSelection.parent[0] != null) ? aSelection.parent[0] : BMSVC.getParent(aSelection.item[0]);
      ptype0 = BookmarksUtils.resolveType(parent0);
    }
    var i;

    switch(aCommand) {
    case "cmd_undo":
    case "cmd_bm_undo":
      return gBkmkTxnSvc.canUndo();
    case "cmd_redo":
    case "cmd_bm_redo":
      return gBkmkTxnSvc.canRedo();
    case "cmd_paste":
      if (ptype0 == "Livemark" || (aTarget && !BookmarksUtils.isValidTargetContainer(aTarget.parent)))
        return false;
      const kClipboardContractID = "@mozilla.org/widget/clipboard;1";
      const kClipboardIID = Components.interfaces.nsIClipboard;
      var clipboard = Components.classes[kClipboardContractID].getService(kClipboardIID);
      const kSuppArrayContractID = "@mozilla.org/supports-array;1";
      const kSuppArrayIID = Components.interfaces.nsISupportsArray;
      var flavourArray = Components.classes[kSuppArrayContractID].createInstance(kSuppArrayIID);
      const kSuppStringContractID = "@mozilla.org/supports-cstring;1";
      const kSuppStringIID = Components.interfaces.nsISupportsCString;
    
      var flavours = ["moz/bookmarkclipboarditem", "text/x-moz-url"];
      for (i = 0; i < flavours.length; ++i) {
        const kSuppString = Components.classes[kSuppStringContractID].createInstance(kSuppStringIID);
        kSuppString.data = flavours[i];
        flavourArray.AppendElement(kSuppString);
      }
      var hasFlavours = clipboard.hasDataMatchingFlavors(flavourArray, kClipboardIID.kGlobalClipboard);
      return hasFlavours;
    case "cmd_copy":
      return length > 0;
    case "cmd_cut":
    case "cmd_delete":
      return length > 0 && !aSelection.containsImmutable && ptype0 != "Livemark" && !aSelection.containsPTF;
    case "cmd_selectAll":
      return true;
    case "cmd_bm_open":
    case "cmd_bm_managefolder":
      return length == 1;
    case "cmd_bm_openinnewwindow":
    case "cmd_bm_openinnewtab":
    case "cmd_bm_openinsidebar":
      return true;
    case "cmd_bm_openfolder":
      for (i=0; i<length; ++i) {
        if (aSelection.type[i] == "ImmutableBookmark" ||
            aSelection.type[i] == "ImmutableFolder" ||
            aSelection.type[i] == "Bookmark" ||
            aSelection.type[i] == "BookmarkSeparator")
          return false;
        RDFC.Init(BMDS, aSelection.item[i]);
        var children = RDFC.GetElements();
        while (children.hasMoreElements()) {
          var childType = BookmarksUtils.resolveType(children.getNext());
          if (childType == "Bookmark" || childType == "LivemarkBookmark")
            return true;
        }
      }
      return false;
    case "cmd_bm_import":
    case "cmd_bm_export":
    case "cmd_bm_exportprompt":
    case "cmd_bm_exportopml":
      return true;
    case "cmd_bm_newbookmark":
    case "cmd_bm_newlivemark":
    case "cmd_bm_newfolder":
    case "cmd_bm_newseparator":
      return (ptype0 != "Livemark" && ((type0 == "PersonalToolbarFolder") ||
              (aTarget && BookmarksUtils.isValidTargetContainer(aTarget.parent))));
    case "cmd_bm_properties":
    case "cmd_bm_rename":
      if (length != 1 ||
          aSelection.item[0].Value == "NC:BookmarksRoot" ||
          ptype0 == "Livemark")
        return false;
      return true;
    case "cmd_bm_setpersonaltoolbarfolder":
      if (length != 1 || type0 == "Livemark")
        return false;
      return item0 != BMSVC.getBookmarksToolbarFolder().Value && 
             item0 != "NC:BookmarksRoot" && type0 == "Folder";
    case "cmd_bm_movebookmark":
      return length > 0 && !aSelection.containsImmutable && ptype0 != "Livemark";
    case "cmd_bm_refreshlivemark":
      for (i=0; i<length; ++i) {
        if (aSelection.type[i] != "Livemark")
          return false;
      }
      return length > 0;
    case "cmd_bm_refreshmicrosummary":
      for (i=0; i<length; ++i) {
        if (!MICSUMSVC.hasMicrosummary(aSelection.item[i]))
          return false;
      }
      return length > 0;
    case "cmd_bm_sortbyname":
      if (length == 1 && (aSelection.type[0] == "Folder" ||
                          aSelection.type[0] == "Bookmark" ||
                          aSelection.type[0] == "PersonalToolbarFolder" ||
                          aSelection.type[0] == "Livemark"))
        return true;
      return false;
    default:
      return false;
    }
  },

  doCommand: function (aCommand, aSelection, aTarget, aDS)
  {
    var resource0, type0, realTarget;
    if (aSelection && aSelection.length == 1) {
      resource0 = aSelection.item[0];
      type0 = aSelection.type[0];
    }

    if (type0 == "PersonalToolbarFolder" && aTarget == null)
      realTarget = { parent: resource0, index: -1 };
    else
      realTarget = aTarget;

    switch (aCommand) {
    case "cmd_undo":
    case "cmd_bm_undo":
      BookmarksCommand.undoBookmarkTransaction();
      break;
    case "cmd_redo":
    case "cmd_bm_redo":
      BookmarksCommand.redoBookmarkTransaction();
      break;
    case "cmd_bm_open":
      var where = nsWhereToOpenLink("browser.bookmarks.open");
      BookmarksCommand.openBookmark(aSelection, where, aDS);
      break;
    case "cmd_bm_openinnewwindow":
      BookmarksCommand.openBookmark(aSelection, "window", aDS);
      break;
    case "cmd_bm_openinnewtab":
      BookmarksCommand.openBookmark(aSelection, "tab", aDS);
      break;
    case "cmd_bm_openinsidebar":
      BookmarksCommand.openBookmark(aSelection, "sidebar", aDS);
      break;
    case "cmd_bm_openfolder":
      BookmarksCommand.openBookmark(aSelection, "current", aDS);
      break;
    case "cmd_bm_managefolder":
      BookmarksCommand.manageFolder(aSelection);
      break;
    case "cmd_bm_setnewbookmarkfolder":
    case "cmd_bm_setpersonaltoolbarfolder":
    case "cmd_bm_setnewsearchfolder":
      BookmarksCommand.doBookmarksCommand(aSelection.item[0], gNC_NS_CMD+aCommand.substring("cmd_bm_".length), []);
      break;
    case "cmd_bm_rename":
    case "cmd_bm_properties":
      junk = BookmarksCommand.openBookmarkProperties(aSelection);
      break;
    case "cmd_cut":
      BookmarksCommand.cutBookmark(aSelection);
      break;
    case "cmd_copy":
      BookmarksCommand.copyBookmark(aSelection);
      break;
    case "cmd_paste":
      BookmarksCommand.pasteBookmark(realTarget);
      break;
    case "cmd_delete":
      BookmarksCommand.deleteBookmark(aSelection);
      break;
    case "cmd_bm_movebookmark":
      BookmarksCommand.moveBookmark(aSelection);
      break;
    case "cmd_bm_newbookmark":
      BookmarksCommand.createNewBookmark(realTarget);
      break;
    case "cmd_bm_newlivemark":
      BookmarksCommand.createNewLivemark(realTarget);
      break;
    case "cmd_bm_newfolder":
      BookmarksCommand.createNewFolder(realTarget);
      break;
    case "cmd_bm_newseparator":
      BookmarksCommand.createNewSeparator(realTarget);
      break;
    case "cmd_bm_import":
      BookmarksCommand.importBookmarks();
      break;
    case "cmd_bm_export":
      BookmarksCommand.exportBookmarks();
      break;
    case "cmd_bm_exportprompt":
      BookmarksCommand.exportBookmarksPrompt();
      break;
    case "cmd_bm_exportopml":
      BookmarksCommand.exportOPML();
      break;
    case "cmd_bm_refreshlivemark":
      BookmarksCommand.refreshLivemark(aSelection);
      break;
    case "cmd_bm_refreshmicrosummary":
      BookmarksCommand.refreshMicrosummary(aSelection);
      break;
    case "cmd_bm_sortbyname":
      BookmarksCommand.sortByName(aSelection);
      break;
    default: 
      dump("Bookmark command "+aCommand+" not handled!\n");
    }

  },

  onCommandUpdate: function (aSelection, aTarget)
  {
    var commands = ["cmd_bm_newbookmark", "cmd_bm_newlivemark", "cmd_bm_newfolder", "cmd_bm_newseparator",
                    "cmd_undo", "cmd_redo", "cmd_bm_properties", "cmd_bm_rename", 
                    "cmd_copy", "cmd_paste", "cmd_cut", "cmd_delete",
                    "cmd_bm_setpersonaltoolbarfolder", "cmd_bm_movebookmark",
                    "cmd_bm_openfolder", "cmd_bm_managefolder", "cmd_bm_refreshlivemark",
                    "cmd_bm_refreshmicrosummary", "cmd_bm_sortbyname"];
    for (var i = 0; i < commands.length; ++i) {
      var enabled = this.isCommandEnabled(commands[i], aSelection, aTarget);
      var commandNode = document.getElementById(commands[i]);
     if (commandNode) { 
        if (enabled) 
          commandNode.removeAttribute("disabled");
        else 
          commandNode.setAttribute("disabled", "true");
      }
    }
  }
}

function CommandArrayEnumerator (aCommandArray)
{
  this._inner = [];
  for (var i = 0; i < aCommandArray.length; ++i)
    this._inner.push(RDF.GetResource(gNC_NS_CMD + aCommandArray[i]));
    
  this._index = 0;
}

CommandArrayEnumerator.prototype = {
  getNext: function () 
  {
    return this._inner[this._index];
  },
  
  hasMoreElements: function ()
  {
    return this._index < this._inner.length;
  }
};

var BookmarksUtils = {

  DROP_BEFORE: Components.interfaces.nsITreeView.DROP_BEFORE,
  DROP_ON    : Components.interfaces.nsITreeView.DROP_ON,
  DROP_AFTER : Components.interfaces.nsITreeView.DROP_AFTER,

  _bundle        : null,
  _brandShortName: null,

  /////////////////////////////////////////////////////////////////////////////////////
  // returns a property from chrome://browser/locale/bookmarks/bookmarks.properties
  getLocaleString: function (aStringKey, aReplaceString)
  {
    if (!this._bundle) {
      // for those who would xblify Bookmarks.js, there is a need to create string bundle 
      // manually instead of using <xul:stringbundle/> see bug 63370 for details
      var LOCALESVC = Components.classes["@mozilla.org/intl/nslocaleservice;1"]
                                .getService(Components.interfaces.nsILocaleService);
      var BUNDLESVC = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                .getService(Components.interfaces.nsIStringBundleService);
      var bookmarksBundle  = "chrome://browser/locale/bookmarks/bookmarks.properties";
      this._bundle         = BUNDLESVC.createBundle(bookmarksBundle, LOCALESVC.getApplicationLocale());
      var brandBundle      = "chrome://branding/locale/brand.properties";
      this._brandShortName = BUNDLESVC.createBundle(brandBundle,     LOCALESVC.getApplicationLocale())
                                      .GetStringFromName("brandShortName");
    }
   
    var bundle;
    try {
      if (!aReplaceString)
        bundle = this._bundle.GetStringFromName(aStringKey);
      else if (typeof(aReplaceString) == "string")
        bundle = this._bundle.formatStringFromName(aStringKey, [aReplaceString], 1);
      else
        bundle = this._bundle.formatStringFromName(aStringKey, aReplaceString, aReplaceString.length);
    } catch (e) {
      dump("Bookmark bundle "+aStringKey+" not found!\n");
      bundle = "";
    }

    bundle = bundle.replace(/%brandShortName%/, this._brandShortName);
    return bundle;
  },
    
  /////////////////////////////////////////////////////////////////////////////
  // returns the literal targeted by the URI aArcURI for a resource or uri
  getProperty: function (aInput, aArcURI, aDS)
  {
    var node;
    var arc  = RDF.GetResource(aArcURI);
    if (typeof(aInput) == "string") 
      aInput = RDF.GetResource(aInput);
    if (!aDS)
      node = BMDS.GetTarget(aInput, arc, true);
    else
      node = aDS .GetTarget(aInput, arc, true);
    try {
      return node.QueryInterface(kRDFRSCIID).Value;
    }
    catch (e) {
      return node? node.QueryInterface(kRDFLITIID).Value : "";
    }    
  },

  /////////////////////////////////////////////////////////////////////////////
  // Determine the rdf:type property for the given resource.
  resolveType: function (aResource, aDS)
  {
    var type = this.getProperty(aResource, gRDF_NS+"type", aDS);
    if (type != "")
      type = type.split("#")[1];
    if (type == "Folder") {
      if (aResource == BMSVC.getBookmarksToolbarFolder())
        type = "PersonalToolbarFolder";
    }
    // Treat microsummary bookmarks like regular bookmarks, since they behave
    // like regular bookmarks in almost every regard.
    if (type == "MicsumBookmark")
      type = "Bookmark";

    if (type == "") {
      // we're not sure what type it is.  figure out if it's a container.
      var child = this.getProperty(aResource, gNC_NS+"child", aDS);
      if (child || RDFCU.IsContainer(aDS?aDS:BMDS, RDF.GetResource(aResource)))
        return "ImmutableFolder";

      // not a container; make sure it has at least a URL
      if (this.getProperty(aResource, gNC_NS+"URL") != null)
        return "ImmutableBookmark";
    }

    return type;
  },

  
  /////////////////////////////////////////////////////////////////////////////
  // Caches frequently used informations about the selection
  checkSelection: function (aSelection)
  {
    if (aSelection.length == 0)
      return;

    aSelection.type        = new Array(aSelection.length);
    aSelection.isContainer = new Array(aSelection.length);
    aSelection.containsPTF = false;
    aSelection.containsImmutable = false;
    var index, item, parent, type, ptype, protocol, isContainer, isImmutable;
    for (var i=0; i<aSelection.length; ++i) {
      item        = aSelection.item[i];
      parent      = aSelection.parent[i];
      type        = BookmarksUtils.resolveType(item);
      protocol    = item.Value.split(":")[0];
      isContainer = RDFCU.IsContainer(BMDS, item) ||
                    protocol == "find" || protocol == "file";
      isImmutable = false;
      if (item.Value == "NC:BookmarksRoot") {
        isImmutable = true;
      }
      else if (type != "Bookmark" && type != "BookmarkSeparator" && 
               type != "Folder"   && type != "PersonalToolbarFolder" &&
               type != "Livemark")
        isImmutable = true;
      else if (parent) {
        var ptype = BookmarksUtils.resolveType(parent);
        if (ptype == "Livemark")
          isImmutable = true;
        var parentProtocol = parent.Value.split(":")[0];
        if (parentProtocol == "find" || parentProtocol == "file")
          aSelection.parent[i] = null;
      }
      if (isImmutable)
        aSelection.containsImmutable = true;

      aSelection.type       [i] = type;
      aSelection.isContainer[i] = isContainer;
    }
    if (this.isContainerChildOrSelf(BMSVC.getBookmarksToolbarFolder(), aSelection))
      aSelection.containsPTF = true;
  },

  isSelectionValidForInsertion: function (aSelection, aTarget)
  {
    return BookmarksUtils.isValidTargetContainer(aTarget.parent, aSelection)
  },

  isSelectionValidForDeletion: function (aSelection)
  {
    return !aSelection.containsImmutable && !aSelection.containsPTF;
  },

  /////////////////////////////////////////////////////////////////////////////
  // Returns true is aContainer is a member or a child of the selection
  isContainerChildOrSelf: function (aContainer, aSelection)
  {
    var folder = aContainer;
    do {
      for (var i=0; i<aSelection.length; ++i) {
        if (aSelection.isContainer[i] && aSelection.item[i].Value == folder.Value)
          return true;
      }
      folder = BMSVC.getParent(folder);
      if (!folder)
        return false; // sanity check
    } while (folder.Value != "NC:BookmarksRoot")
    return false;
  },

  /////////////////////////////////////////////////////////////////////////////
  // Returns true if aSelection can be inserted in aFolder
  isValidTargetContainer: function (aFolder, aSelection)
  {
    if (!aFolder)
      return false;
    if (aFolder.Value == "NC:BookmarksTopRoot")
      return false;
    if (aFolder.Value == "NC:BookmarksRoot")
      return true;

    // don't insert items in an invalid container
    // 'file:' and 'find:' items have a 'Bookmark' type
    var type = BookmarksUtils.resolveType(aFolder);
    if (type != "Folder" && type != "PersonalToolbarFolder")
      return false;

    // bail if we just check the container
    if (!aSelection)
      return true;

    // check that the selected folder is not the selected item nor its child
    if (this.isContainerChildOrSelf(aFolder, aSelection))
      return false;

    return true;
  },

  /////////////////////////////////////////////////////////////////////////////
  removeAndCheckSelection: function (aAction, aSelection)
  {
    var isValid = BookmarksUtils.isSelectionValidForDeletion(aSelection);
    if (!isValid) {
      SOUND.beep();
      return false;
    }
    this.removeSelection(aAction, aSelection);
    BookmarksUtils.flushDataSource();
    BookmarksUtils.refreshSearch();
    return true;
  },

  removeSelection: function (aAction, aSelection)
  {
    if (aSelection.length > 1)
      gBkmkTxnSvc.startBatch();
    if (aSelection.length > kBATCH_LIMIT && aAction != "move")
      BMDS.beginUpdateBatch();

    for (var i = 0; i < aSelection.length; ++i) {
      // try to put back aSelection.parent[i] if it's null, so we can delete after searching
      if (aSelection.parent[i] == null)
          aSelection.parent[i] = BMDS.getParent(aSelection.item[i]);

      if (aSelection.parent[i]) {
        RDFC.Init(BMDS, aSelection.parent[i]);

        // save the selection property into array that is used later in
        // when performing the REMOVE transaction
        // (if the selection is folder save all childs property)
        var propArray;
        if (aAction != "move") {
            propArray = new Array(gBmProperties.length);
            var aType = BookmarksUtils.resolveType(aSelection.item[i]);            
            if (aType != "Livemark") {// don't change livemark properties
               for (var j = 0; j < gBmProperties.length; ++j) {
                  var oldValue = BMDS.GetTarget(aSelection.item[i], gBmProperties[j], true);
                  if (oldValue)
                      propArray[j] = oldValue.QueryInterface(kRDFLITIID);
               }
            }
            if (aType == "Folder" || aType == "Livemark")
                BookmarksUtils.getAllChildren(aSelection.item[i], propArray);
        }

        var proplength = propArray ? propArray.length : 0;
        gBkmkTxnSvc.createAndCommitTxn(gBkmkTxnSvc.REMOVE, aAction, 
                                       aSelection.item[i], 
                                       RDFC.IndexOf(aSelection.item[i]),
                                       aSelection.parent[i], 
                                       proplength, propArray);
      }
    }
    if (aSelection.length > 1)
      gBkmkTxnSvc.endBatch();
    if (aSelection.length > kBATCH_LIMIT && aAction != "move")
      BMDS.endUpdateBatch();
    return true;
  },

  //  this recursive function return array of all childrens properties for given folder
  getAllChildren: function (folder, propArray)
  {
    var container = Components.classes[kRDFCContractID].createInstance(kRDFCIID);
    container.Init(BMDS, folder);
    var children = container.GetElements();
    while (children.hasMoreElements()){
      var child = children.getNext() ;
      if (child instanceof Components.interfaces.nsIRDFResource){
         var aType = BookmarksUtils.resolveType(child);
         var childResource = child.QueryInterface(kRDFRSCIID);
         var props = new Array(gBmProperties.length);
         // don't change livemark properties
         if (aType != "Livemark") {
            for (var j = 0; j < gBmProperties.length; ++j) {
               var oldValue = BMDS.GetTarget(childResource, gBmProperties[j], true);
               if (oldValue)
                   props[(j)] = oldValue.QueryInterface(kRDFLITIID);
            }
         }
         propArray.push(props);
         if (aType == "Folder" || aType == "Livemark")
             BookmarksUtils.getAllChildren(child, propArray);
      }
    }
  },

  // if we are in search mode i.e. "find:" is in ref attribute we refresh the Search
  refreshSearch: function ()
  {
   var bmTree, bmView = document.getElementById("bookmarks-view");
   if (bmView) bmTree = bmView.tree;
   else return;
   var aRef = bmTree.getAttribute("ref");
   var aProtocol = aRef.split(":")[0];
   if (aProtocol == "find"){
      bmTree.setAttribute("ref", "");
      bmTree.setAttribute("ref", aRef);
   }
  },
        
  insertAndCheckSelection: function (aAction, aSelection, aTarget, aTargetIndex)
  {
    var isValid = BookmarksUtils.isSelectionValidForInsertion(aSelection, aTarget);
    if (!isValid) {
      SOUND.beep();
      return false;
    }
    this.insertSelection(aAction, aSelection, aTarget, aTargetIndex);
    BookmarksUtils.flushDataSource();
    BookmarksUtils.refreshSearch();
    return true;
  },

  insertSelection: function (aAction, aSelection, aTarget, aTargetIndex)
  {
    var item, removedProps;
    var index = aTarget.index;
    var brokenIndex = aTarget.index;

    if (aSelection.length > 1)
      gBkmkTxnSvc.startBatch();
    if (aSelection.length > kBATCH_LIMIT && aAction != "move")
      BMDS.beginUpdateBatch();

    for (var i=0; i<aSelection.length; ++i) {
      var rSource = aSelection.item[i];
      if (BMSVC.isBookmarkedResource(rSource))
        rSource = BMSVC.cloneResource(rSource);
      item = rSource;
      // we only have aSelection.prop if insertSelection call by paste action we don't use it for move
      removedProps = aSelection.prop ? aSelection.prop[i] : null;
      // Broken Insert Code attempts to always insert items in the
      // right place (i.e. after the selected item).  However, because
      // of RDF Container suckyness, this code gets very confused, due
      // to rdf container indexes not matching up to number of items,
      // and because we can't trust GetCount to return a real count.
      // The -1 is there to handle inserting into the persontal toolbar
      // folder via right-click on the PTF.
      if (aTarget.index == -1) {
        index = -1;
      } else {
//@line 1984 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/bookmarks/content/bookmarks.js"
      index = brokenIndex++;
//@line 1986 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/bookmarks/content/bookmarks.js"
      }
      var proplength = removedProps ? removedProps.length : 0;
      gBkmkTxnSvc.createAndCommitTxn(gBkmkTxnSvc.INSERT, aAction, item, index,
                                     aTarget.parent, proplength, removedProps);
    }
    if (aSelection.length > 1)
      gBkmkTxnSvc.endBatch();
    if (aSelection.length > kBATCH_LIMIT && aAction != "move")
      BMDS.endUpdateBatch();
  },

  moveAndCheckSelection: function (aAction, aSelection, aTarget)
  {
    var isValid = BookmarksUtils.isSelectionValidForDeletion(aSelection) &&
                  BookmarksUtils.isSelectionValidForInsertion(aSelection, aTarget);
    if (!isValid) {
      SOUND.beep();
      return false;
    }
    this.moveSelection(aAction, aSelection, aTarget);
    BookmarksUtils.flushDataSource();
    return true;
  },

  moveSelection: function (aAction, aSelection, aTarget)
  {
    if (aSelection.length > kBATCH_LIMIT)
      BMDS.beginUpdateBatch();

    gBkmkTxnSvc.startBatch();
    BookmarksUtils.removeSelection("move", aSelection);
    BookmarksUtils.insertSelection("move", aSelection, aTarget);
    gBkmkTxnSvc.endBatch();
    if (aSelection.length > kBATCH_LIMIT)
      BMDS.endUpdateBatch();
  }, 

  // returns true if this selection should be copied instead of moved,
  // if a move was originally requested
  shouldCopySelection: function (aAction, aSelection)
  {
    for (var i = 0; i < aSelection.length; i++) {
      var parentType = BookmarksUtils.resolveType(aSelection.parent[i]);
      if (aSelection.type[i] == "ImmutableBookmark" ||
          aSelection.type[i] == "ImmutableFolder" ||
          aSelection.parent[i] == null ||
          (aSelection.type[i] == "Bookmark" && parentType == "Livemark"))
      {
        return true;            // if any of these are found
      }
    }

    return false;
  },

  getXferDataFromSelection: function (aSelection)
  {
    if (aSelection.length == 0)
      return null;
    var dataSet = new TransferDataSet();
    var data, item, itemUrl, itemName, parent, name;
    for (var i=0; i<aSelection.length; ++i) {
      data     = new TransferData();
      item     = aSelection.item[i].Value;
      itemUrl  = this.getProperty(item, gNC_NS+"URL");
      itemName = this.getProperty(item, gNC_NS+"Name");
      parent   = aSelection.parent[i].Value;
      data.addDataForFlavour("moz/rdfitem",    item+"\n"+(parent?parent:""));
      data.addDataForFlavour("text/x-moz-url", itemUrl+"\n"+itemName);
      data.addDataForFlavour("text/html",      "<A HREF='"+itemUrl+"'>"+itemName+"</A>");
      data.addDataForFlavour("text/unicode",   itemUrl);
      dataSet.push(data);
    }
    return dataSet;
  },

  getSelectionFromXferData: function (aDragSession)
  {
    var selection    = {};
    selection.item   = [];
    selection.parent = [];
    var trans = Components.classes["@mozilla.org/widget/transferable;1"]
                          .createInstance(Components.interfaces.nsITransferable);
    trans.addDataFlavor("moz/rdfitem");
    trans.addDataFlavor("text/x-moz-url");
    trans.addDataFlavor("text/unicode");
    var uri, extra, rSource, rParent, parent;
    for (var i = 0; i < aDragSession.numDropItems; ++i) {
      var bestFlavour = {}, dataObj = {}, len = {};
      aDragSession.getData(trans, i);
      trans.getAnyTransferData(bestFlavour, dataObj, len);
      dataObj = dataObj.value.QueryInterface(Components.interfaces.nsISupportsString);
      if (!dataObj)
        continue;
      dataObj = dataObj.data.substring(0, len.value).split("\n");
      uri     = dataObj[0];
      if (dataObj.length > 1 && dataObj[1] != "")
        extra = dataObj[1];
      else
        extra = null;
      switch (bestFlavour.value) {
      case "moz/rdfitem":
        rSource = RDF.GetResource(uri);
        parent  = extra;
        break;
      case "text/x-moz-url":
      case "text/unicode":
        rSource = BookmarksUtils.createBookmark(null, uri, null, extra, null);
        parent = null;
        break;
      }
      selection.item.push(rSource);
      if (parent)
        rParent = RDF.GetResource(parent);
      else
        rParent = null;
      selection.parent.push(rParent);
    }
    selection.length = selection.item.length;
    BookmarksUtils.checkSelection(selection);
    return selection;
  },

  getTargetFromFolder: function(aResource)
  {
    var index = parseInt(this.getProperty(aResource, gRDF_NS+"nextVal"));
    if (isNaN(index))
      return {parent: null, index: -1};
    else
      return {parent: aResource, index: index};
  },

  getSelectionFromResource: function (aItem, aParent)
  {
    var selection    = {};
    selection.length = 1;
    selection.item   = [aItem  ];
    selection.parent = [aParent];
    this.checkSelection(selection);
    return selection;
  },

  createBookmark: function (aName, aURL, aCharSet, aDefaultName)
  {
    if (!aName) {
      // look up in the history ds to retrieve the name
      var rSource = RDF.GetResource(aURL);
      var HISTDS  = RDF.GetDataSource("rdf:history");
      var nameArc = RDF.GetResource(gNC_NS+"Name");
      var rName   = HISTDS.GetTarget(rSource, nameArc, true);
      aName       = rName ? rName.QueryInterface(kRDFLITIID).Value : aDefaultName;
      if (!aName)
        aName = aURL;
    }
    if (!aCharSet) {
      var fw = document.commandDispatcher.focusedWindow;
      if (fw)
        aCharSet = fw.document.characterSet;
    }
    return BMSVC.createBookmark(aName, aURL, null, null, aCharSet, null);
  },

  createLivemark: function (aName, aURL, aFeedURL, aDefaultName)
  {
    if (!aName) {
      // look up in the history ds to retrieve the name
      var rSource = RDF.GetResource(aURL);
      var HISTDS  = RDF.GetDataSource("rdf:history");
      var nameArc = RDF.GetResource(gNC_NS+"Name");
      var rName   = HISTDS.GetTarget(rSource, nameArc, true);
      aName       = rName ? rName.QueryInterface(kRDFLITIID).Value : aDefaultName;
      if (!aName)
        aName = aURL;
    }
    return BMSVC.createLivemark(aName, aURL, aFeedURL, null);
  },

  flushDataSource: function ()
  {
    var remoteDS = BMDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
    setTimeout(function () {remoteDS.Flush()}, 100);
  },

  addBookmark: function (aURL, aTitle, aCharset, aIsWebPanel, aDescription)
  {
    var dArgs = {
      name: aTitle,
      url: aURL,
      charset: aCharset,
      bWebPanel: aIsWebPanel,
      description: aDescription
    }
    openDialog("chrome://browser/content/bookmarks/addBookmark2.xul", "",
               ADD_BM_DIALOG_FEATURES, dArgs);
  },
 
  addLivemark: function (aURL, aFeedURL, aTitle, aDescription)
  {
    var dArgs = {
      name: aTitle,
      url: aURL,
      bWebPanel: false,
      feedURL: aFeedURL,
      description: aDescription
    };
    try {
      var toolbarFolderURI = BMDS.getBookmarksToolbarFolder().Value;
      dArgs.folderURI = toolbarFolderURI;
    }
    catch (e) { 
    }
    openDialog("chrome://browser/content/bookmarks/addBookmark2.xul", "",
               ADD_BM_DIALOG_FEATURES, dArgs);
  },
 
  getDescriptionFromDocument: function (aDocument) {
    var metaElements = aDocument.getElementsByTagName('META');
    for (var m = 0; m < metaElements.length; m++) {
      if (metaElements[m].name.toLowerCase() == 'description' || metaElements[m].httpEquiv.toLowerCase() == 'description')
        return metaElements[m].content;
    }
    return '';
  },
 
  loadFavIcon: function (aURL, aFavIconURL) {
    if (!RDF || !BMSVC)
      return;
 
    var urlLiteral = RDF.GetLiteral(aURL);
    // don't do anything if this URI isn't bookmarked
    var bmResources = BMSVC.GetSources(RDF.GetResource(gNC_NS+"URL"), urlLiteral, true);
    var toUpdate = 0;

    while (bmResources.hasMoreElements()) {
      var bmResource = bmResources.getNext();
 
      // don't flag this as needing update if it already has a data: icon url set
      var oldIcon = BMDS.GetTarget(bmResource, RDF.GetResource(gNC_NS+"Icon"), true);
      if (oldIcon && (oldIcon.QueryInterface(kRDFLITIID).Value.substring(0,5) == "data:"))
        continue;

      toUpdate++;
    }

    if (toUpdate == 0)
      return;

    var chan = IOSVC.newChannel(aFavIconURL, null, null);
    var listener = new bookmarksFavIconLoadListener (aURL, aFavIconURL, chan);
    chan.notificationCallbacks = listener;
    chan.asyncOpen(listener, null);
  }
}

var BookmarkEditMenuTxnListener =
{
  didDo: function (aTxmgr, aTxn)
  {
    this.updateMenuItem(aTxmgr, aTxn);
  },

  didUndo: function (aTxmgr, aTxn)
  {
    this.updateMenuItem(aTxmgr, aTxn);
  },

  didRedo: function (aTxmgr, aTxn)
  {
    this.updateMenuItem(aTxmgr, aTxn);
  },

  didMerge       : function (aTxmgr, aTxn) {},
  didBeginBatch  : function (aTxmgr, aTxn) {},
  didEndBatch    : function (aTxmgr, aTxn) {
    this.updateMenuItem(aTxmgr, aTxn);
  },
  willDo         : function (aTxmgr, aTxn) {},
  willUndo       : function (aTxmgr, aTxn) {},
  willRedo       : function (aTxmgr, aTxn) {},
  willMerge      : function (aTxmgr, aTxn) {},
  willBeginBatch : function (aTxmgr, aTxn) {},
  willEndBatch   : function (aTxmgr, aTxn) {},

  updateMenuItem: function bkmkMenuListenerUpdate(aTxmgr, aTxn) {
    var node, transactionNumber, transactionList, transactionLabel, action, item;
    node = document.getElementById("cmd_undo");
    transactionNumber = aTxmgr.numberOfUndoItems;
    dump("N UNDO: "+transactionNumber+"\n");
    if (transactionNumber == 0) {
      transactionLabel = BookmarksUtils.getLocaleString("cmd_bm_undo");
    } else {
      transactionList  = aTxmgr.getUndoList();
      if (!transactionList.itemIsBatch(transactionNumber-1)) {
        item = transactionList.getItem(transactionNumber-1);
        action = item.wrappedJSObject.action;
      } else {
        var childList = transactionList.getChildListForItem(transactionNumber-1);
        item = childList.getItem(0);
        action = item.wrappedJSObject.action;
      }
      transactionLabel = BookmarksUtils.getLocaleString("cmd_bm_"+action+"_undo");
    }
    node.setAttribute("label", transactionLabel);
      
    node = document.getElementById("cmd_redo");
    transactionNumber = aTxmgr.numberOfRedoItems;
    dump("N REDO: "+transactionNumber+"\n");
    if (transactionNumber == 0) {
      transactionLabel = BookmarksUtils.getLocaleString("cmd_bm_redo");
    } else {
      transactionList  = aTxmgr.getRedoList();
      if (!transactionList.itemIsBatch(transactionNumber-1)) {
        item = transactionList.getItem(transactionNumber-1);
        action = item.wrappedJSObject.action;
      } else {
        var childList = transactionList.getChildListForItem(transactionNumber-1);
        item = childList.getItem(0);
        action = item.wrappedJSObject.action;
      }
      transactionLabel = BookmarksUtils.getLocaleString("cmd_bm_"+action+"_redo");
    }
    node.setAttribute("label", transactionLabel);
  }
}

// favicon loaders

function bookmarksFavIconLoadListener(uri, faviconurl, channel) {
  this.mURI = uri;
  this.mFavIconURL = faviconurl;
  this.mCountRead = 0;
  this.mChannel = channel;
}

bookmarksFavIconLoadListener.prototype = {
  mURI : null,
  mFavIconURL : null,
  mCountRead : null,
  mChannel : null,
  mBytes : Array(),
  mStream : null,

  QueryInterface: function (iid) {
    if (!iid.equals(Components.interfaces.nsISupports) &&
        !iid.equals(Components.interfaces.nsIInterfaceRequestor) &&
        !iid.equals(Components.interfaces.nsIRequestObserver) &&
        !iid.equals(Components.interfaces.nsIChannelEventSink) &&
        !iid.equals(Components.interfaces.nsIProgressEventSink) && // see below
        !iid.equals(Components.interfaces.nsIStreamListener)) {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    return this;
  },

  // nsIInterfaceRequestor
  getInterface: function (iid) {
    try {
      return this.QueryInterface(iid);
    } catch (e) {
      throw Components.results.NS_NOINTERFACE;
    }
  },

  // nsIRequestObserver
  onStartRequest : function (aRequest, aContext) {
    this.mStream = Components.classes['@mozilla.org/binaryinputstream;1'].createInstance(Components.interfaces.nsIBinaryInputStream);
  },

  onStopRequest : function (aRequest, aContext, aStatusCode) {
    var httpChannel = this.mChannel.QueryInterface(Components.interfaces.nsIHttpChannel);
    if ((httpChannel && httpChannel.requestSucceeded) &&
        Components.isSuccessCode(aStatusCode) &&
        this.mCountRead > 0)
    {
      var dataurl;
      // XXX - arbitrary size beyond which we won't store a favicon.  This is /extremely/
      // generous, and is probably too high.
      if (this.mCountRead > 16384) {
        dataurl = "data:";      // hack meaning "pretend this doesn't exist"
      } else {
        // get us a mime type for this
        var mimeType = null;

        const nsICategoryManager = Components.interfaces.nsICategoryManager;
        const nsIContentSniffer = Components.interfaces.nsIContentSniffer;

        var catMgr = Components.classes["@mozilla.org/categorymanager;1"].getService(nsICategoryManager);
        var sniffers = catMgr.enumerateCategory("content-sniffing-services");
        while (mimeType == null && sniffers.hasMoreElements()) {
          var snifferCID = sniffers.getNext().QueryInterface(Components.interfaces.nsISupportsCString).toString();
          var sniffer = Components.classes[snifferCID].getService(nsIContentSniffer);

          try {
            mimeType = sniffer.getMIMETypeFromContent (this.mBytes, this.mCountRead);
          } catch (e) {
            mimeType = null;
            // ignore
          }
        }
      }

      if (mimeType == null) {
        BMSVC.updateBookmarkIcon(this.mURI, null, null, 0);
      } else {
        BMSVC.updateBookmarkIcon(this.mURI, mimeType, this.mBytes, this.mCountRead);
      }
    }

    this.mChannel = null;
  },

  // nsIStreamObserver
  onDataAvailable : function (aRequest, aContext, aInputStream, aOffset, aCount) {
    // we could get a different aInputStream, so we don't save this;
    // it's unlikely we'll get more than one onDataAvailable for a
    // favicon anyway
    this.mStream.setInputStream(aInputStream);

    var chunk = this.mStream.readByteArray(aCount);
    this.mBytes = this.mBytes.concat(chunk);
    this.mCountRead += aCount;
  },

  // nsIChannelEventSink
  onChannelRedirect : function (aOldChannel, aNewChannel, aFlags) {
    this.mChannel = aNewChannel;
  },

  // nsIProgressEventSink: the only reason we support
  // nsIProgressEventSink is to shut up a whole slew of xpconnect
  // warnings in debug builds.  (see bug #253127)
  onProgress : function (aRequest, aContext, aProgress, aProgressMax) { },
  onStatus : function (aRequest, aContext, aStatus, aStatusArg) { }
}

