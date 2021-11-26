//@line 38 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/bookmarks/content/bookmarksPanel.js"

function manageBookmarks() {
  openDialog("chrome://browser/content/bookmarks/bookmarksManager.xul", "", "chrome,dialog=no,resizable=yes");
}

function addBookmark() {
  var contentArea = top.document.getElementById('content');                   
  if (contentArea) {
    const browsers = contentArea.browsers;
    if (browsers.length > 1)
      BookmarksUtils.addBookmarkForTabBrowser(contentArea);
    else
      BookmarksUtils.addBookmarkForBrowser(contentArea.webNavigation, true);    
  }
  else
    BookmarksUtils.addBookmark(null, null, undefined, true);
}
