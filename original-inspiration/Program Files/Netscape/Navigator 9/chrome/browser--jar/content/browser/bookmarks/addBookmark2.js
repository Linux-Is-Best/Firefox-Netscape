//@line 40 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/bookmarks/content/addBookmark2.js"

/**
 * Add Bookmark Dialog. 
 * ====================
 * 
 * This is a generic bookmark dialog that allows for bookmark addition
 * and folder selection. It can be opened with various parameters that 
 * result in appearance/purpose differences and initial state. 
 * 
 * Use: Open with 'openDialog', with the flags 
 *        'centerscreen,chrome,dialog=no,resizable=yes'
 * 
 * Parameters: 
 *   Apart from the standard openDialog parameters, this dialog can 
 *   be passed additional information, which is contained in the 
 *   wArg object:
 *  
 *   wArg.name              : Bookmark Name. The value to be prefilled
 *                            into the "Name: " field (if visible).
 *   wArg.description       : Bookmark description. The value to be added
 *                          : to the boomarks description field.
 *   wArg.url               : Bookmark URL: The location of the bookmark.
 *                            The value to be filled in the "Location: "
 *                            field (if visible).
 *   wArg.folderURI         : Bookmark Folder. The RDF Resource URI of the
 *                            folder that this bookmark should be created in.
 *   wArg.charset           : Bookmark Charset. The charset that should be
 *                            used when adding a bookmark to the specified
 *                            URL. (Usually the charset of the current 
 *                            document when launching this window).
 *   wArg.bBookmarkAllTabs  : True if "Bookmark All Tabs" option is chosen,
 *                            false otherwise.
 *   wArg.objGroup[]        : If adding a group of tabs, this is an array
 *                            of wArg objects with name, URL and charset
 *                            properties, one for each group member.
 *   wArg.bWebPanel         : If the bookmark should become a web panel.
 *   wArg.keyword           : A suggested keyword for the bookmark. If this
 *                            argument is supplied, the keyword row is made
 *                            visible.
 *   wArg.bNeedKeyword      : Whether or not a keyword is required to add
 *                            the bookmark.
 *   wArg.postData          : PostData to be saved with this bookmark, 
 *                            in the format a string of name=value pairs
 *                            separated by CRLFs.
 *   wArg.feedURL           : feed URL for Livemarks (turns bookmark
 *                            into Livemark)
 */

var gSelectedFolder;
var gName;
var gKeyword;
var gKeywordRow;
var gExpander;
var gMenulist;
var gBookmarksTree;
var gKeywordRequired;
var gSuggestedKeyword;
var gRequiredFields = [];
var gPostData;
var gArg = window.arguments[0];
var gResource;

//@line 104 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/bookmarks/content/addBookmark2.js"
var WSucks;

function Startup()
{
  initServices();
  initBMService();
  gName = document.getElementById("name");
  gKeywordRow = document.getElementById("keywordRow");
  gKeyword = document.getElementById("keyword");
  gExpander = document.getElementById("expander");
  gMenulist = document.getElementById("select-menu");
  gBookmarksTree = document.getElementById("folder-tree");
  gName.value = gArg.name;
  gName.select();
  gName.focus();
  gSuggestedKeyword = gArg.keyword;
  gKeywordRequired = gArg.bNeedKeyword;
  if (!gSuggestedKeyword && !gKeywordRequired) {
    gKeywordRow.hidden = true;
  } else {
    if (gSuggestedKeyword)
      gKeyword.value = gSuggestedKeyword;
    if (gKeywordRequired)
      gRequiredFields.push(gKeyword);
  }
  sizeToContent();
  onFieldInput();
  initTitle();
  gExpander.setAttribute("tooltiptext", gExpander.getAttribute("tooltiptextdown"));
  gPostData = gArg.postData;
  
  if ("feedURL" in gArg) {
    var strings = document.getElementById("bookmarksBundle");
    document.title = strings.getString("addLiveBookmarkTitle");
  }

//@line 141 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/bookmarks/content/addBookmark2.js"
  WSucks = parseInt(gBookmarksTree.getAttribute("height"));
  if (!WSucks)
    WSucks = 150;

  // fix no more persisted class attribute in old profiles
  var localStore = RDF.GetDataSource("rdf:local-store");
  var rAttribute = RDF.GetResource("class");
  var rElement   = RDF.GetResource("chrome://browser/content/bookmarks/addBookmark2.xul#expander");
  var rDialog    = RDF.GetResource("chrome://browser/content/bookmarks/addBookmark2.xul");
  var rPersist   = RDF.GetResource(gNC_NS+"persist");
  
  var rOldValue = localStore.GetTarget(rElement, rAttribute, true);
  if (rOldValue) {
    localStore.Unassert(rElement, rAttribute, rOldValue, true);
    localStore.Unassert(rDialog, rPersist, rElement, true);
    gExpander.setAttribute("class", "down");
  }

  // Select the specified folder after the window is made visible
  function initMenulist() {
    if ("folderURI" in gArg) {
      var folderItem = document.getElementById(gArg.folderURI);
      if (folderItem)
        gMenulist.selectedItem = folderItem;
    }
    gSelectedFolder = RDF.GetResource(gMenulist.selectedItem.id);
  }
  setTimeout(initMenulist, 0);

  // Reset the |id| attribute on the toolbar folder attribute to the URI of the
  // Bookmarks toolbar folder. 
  var btfMenuItem = document.getElementById("btfMenuItem");
  btfMenuItem.id = BMSVC.getBookmarksToolbarFolder().Value;

  if (MicrosummaryPicker.enabled)
    MicrosummaryPicker.init();
} 

function initTitle()
{
  if(gArg.bBookmarkAllTabs)
    document.title = document.getElementById("bookmarksBundle").getString("bookmarkAllTabsTitle");
  else
    document.title = document.getElementById("bookmarksBundle").getString("bookmarkCurTabTitle");
}

function onFieldInput()
{
  var ok = document.documentElement.getButton("accept");
  ok.disabled = false;
  for (var i = 0; i < gRequiredFields.length; ++i) {
    if (gRequiredFields[i].value == "") {
      ok.disabled = true;
      return;
    }
  }
}

function onOK()
{
  RDFC.Init(BMDS, gSelectedFolder);
  
  var url;
  var livemarkFeed = gArg.feedURL;
  if (gArg.bBookmarkAllTabs) {
    gResource = BMDS.createFolder(gName.value);
    const groups = gArg.objGroup;
    for (var i = 0; i < groups.length; ++i) {
      url = getNormalizedURL(groups[i].url);
      BMDS.createBookmarkInContainer(groups[i].name, url, gKeyword.value, 
                                     groups[i].description, groups[i].charset, 
                                     gPostData, gResource, -1);
    }
  } else if (livemarkFeed != null) {
    url = getNormalizedURL(gArg.url);
    gResource = BMDS.createLivemark(gName.value, url, livemarkFeed, 
                                    gArg.description);
  } else {
    url = getNormalizedURL(gArg.url);

    var name = gName.value;

    // If the microsummary picker is enabled, the value of the name field
    // won't necessarily contain the user-entered name for the bookmark.
    // But the first item in the microsummary drop-down menu will always
    // contain the user-entered name, so get the name from there instead.
    if (MicrosummaryPicker.enabled) {
      var menuPopup = document.getElementById("microsummaryMenuPopup");
      name = menuPopup.childNodes[0].getAttribute("label");
    }

    gResource = BMDS.createBookmark(name, url, gKeyword.value, 
                                    gArg.description, gArg.charset, 
                                    gPostData);
  }

  var selection = BookmarksUtils.getSelectionFromResource(gResource);
  var target    = BookmarksUtils.getTargetFromFolder(gSelectedFolder);
  BookmarksUtils.insertAndCheckSelection("newbookmark", selection, target);

  if (MicrosummaryPicker.enabled) {
    MicrosummaryPicker.commit();
    MicrosummaryPicker.destroy();
  }

  if (gArg.bWebPanel && gResource) {
    // Assert that we're a web panel.
    BMDS.Assert(gResource, RDF.GetResource(gNC_NS+"WebPanel"),
                RDF.GetLiteral("true"), true);
  }
  
  // in insertSelection, the ds flush is delayed. It will never be performed,
  // since this dialog is destroyed before.
  // We have to flush manually
  var remoteDS = BMDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
  remoteDS.Flush();
}

function onCancel()
{
  // Destroy the microsummary picker controller to prevent memory leaks,
  // catching exceptions so we don't prevent the dialog from closing.
  try {
    if (MicrosummaryPicker.enabled)
      MicrosummaryPicker.destroy();
  }
  catch(e) {
    Components.utils.reportError(e);
  }

  return true;
}

function getNormalizedURL(url)
{
  // Check to see if the item is a local directory path, and if so, convert
  // to a file URL so that aggregation with rdf:files works
  try {
    const kLF = Components.classes["@mozilla.org/file/local;1"]
                          .createInstance(Components.interfaces.nsILocalFile);
    kLF.initWithPath(url);
    if (kLF.exists()) {
      var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                                .getService(Components.interfaces.nsIIOService);
      var fileHandler = ioService.getProtocolHandler("file")
                                 .QueryInterface(Components.interfaces.nsIFileProtocolHandler);

      url = fileHandler.getURLSpecFromFile(kLF);
    }
  }
  catch (e) {
  }

  return url;
}

function selectMenulistFolder(aEvent)
{
  gSelectedFolder = RDF.GetResource(aEvent.target.id);
  if (!gBookmarksTree.collapsed)
    selectFolder(gSelectedFolder);
}

function selectTreeFolder()
{
  // If no item is selected, we obviously can't do anything with the selection.
  // This happens when the bookmarks tree rebuilds, since the rebuild starts
  // by removing all items from the tree, including the currently selected item,
  // and removing the selection also triggers the "select" handler which calls
  // this function.
  if (gBookmarksTree.currentIndex == -1)
    return;

  var resource = gBookmarksTree.currentResource;
  if (resource == gSelectedFolder)
    return;
  gSelectedFolder = resource;
  var menuitem = document.getElementById(gSelectedFolder.Value);
  gMenulist.selectedItem = menuitem;
  if (!menuitem) {
    gMenulist.removeItemAt(gMenulist.firstChild.childNodes.length-1);
    var newItem = gMenulist.appendItem(BookmarksUtils.getProperty(gSelectedFolder, gNC_NS+"Name"), gSelectedFolder.Value);
    newItem.setAttribute("class", "menuitem-iconic folder-icon");
    newItem.setAttribute("id", gSelectedFolder.Value);
    gMenulist.selectedItem = newItem;
  }
}

function selectFolder(aFolder)
{
  gBookmarksTree.treeBoxObject.view.selection.selectEventsSuppressed = true;
  gBookmarksTree.treeBoxObject.view.selection.clearSelection();
  gBookmarksTree.selectResource(aFolder);
  var index = gBookmarksTree.currentIndex;
  gBookmarksTree.treeBoxObject.ensureRowIsVisible(index);
  gBookmarksTree.treeBoxObject.view.selection.selectEventsSuppressed = false;
//@line 338 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/bookmarks/content/addBookmark2.js"
}

function expandTree()
{
  setFolderTreeHeight();
  var willCollapse = !gBookmarksTree.collapsed;
  gExpander.setAttribute("class",willCollapse?"down":"up");
  gExpander.setAttribute("tooltiptext", gExpander.getAttribute("tooltiptext"+(willCollapse?"down":"up")));
  if (willCollapse) {
    document.documentElement.buttons = "accept,cancel";
    WSucks = gBookmarksTree.boxObject.height;
  } else {
    document.documentElement.buttons = "accept,cancel,extra2";
//@line 352 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/bookmarks/content/addBookmark2.js"
    if (!gBookmarksTree.treeBoxObject.view.isContainerOpen(0))
      gBookmarksTree.treeBoxObject.view.toggleOpenState(0);
    selectFolder(gSelectedFolder);
    gBookmarksTree.focus();
  }
  gBookmarksTree.collapsed = willCollapse;
  resizeTo(window.outerWidth, window.outerHeight+(willCollapse?-WSucks:+WSucks));
}

function setFolderTreeHeight()
{
  var isCollapsed = gBookmarksTree.collapsed;
  if (!isCollapsed)
    gBookmarksTree.setAttribute("height", gBookmarksTree.boxObject.height);
}

function newFolder()
{
  gBookmarksTree.focus();
  // we should use goDoCommand, but the current way of inserting
  // resources do not insert in folders.
  //goDoCommand("cmd_bm_newfolder");
  var target = BookmarksUtils.getTargetFromFolder(gSelectedFolder);
  var folder = BookmarksCommand.createNewFolder(target);
  if (!BMSVC.isBookmarkedResource(folder))
    return; // new folder cancelled
  selectFolder(folder);
}
