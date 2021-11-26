//@line 38 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/bookmarks/content/selectBookmark.js"

var gBookmarkTree;
var gOK;
var gUrls;
var gNames;

function Startup()
{
  initServices();
  initBMService();
  gOK = document.documentElement.getButton("accept");
  gBookmarkTree = document.getElementById("bookmarks-view");  
  gBookmarkTree.treeBoxObject.view.selection.select(0);
  gBookmarkTree.focus();
}

function onDblClick()
{
  if (!gOK.disabled)
    document.documentElement.acceptDialog();
}

function updateOK()
{
  var selection = gBookmarkTree._selection;
  var ds = gBookmarkTree.tree.database;
  var url, name;
  gUrls = [];
  gNames = [];
  for (var i=0; i<selection.length; ++i) {
    var type     = selection.type[i];
// XXX protocol is broken since we have unique id...
//    var protocol = selection.protocol[i];
//    if ((type == "Bookmark" || type == "") && 
//        protocol != "find" && protocol != "javascript") {
    if (type == "Bookmark" || type == "") {
      url = BookmarksUtils.getProperty(selection.item[i], gNC_NS+"URL", ds);
      name = BookmarksUtils.getProperty(selection.item[i], gNC_NS+"Name", name);
      if (url && name) {
        gUrls.push(url);
        gNames.push(name);
      }
    } else if (type == "Folder" || type == "PersonalToolbarFolder") {
      RDFC.Init(ds, selection.item[i]);
      var children = RDFC.GetElements();
      while (children.hasMoreElements()) {
        var child = children.getNext().QueryInterface(kRDFRSCIID);
        type      = BookmarksUtils.getProperty(child, gRDF_NS+"type", ds);
// XXX protocol is broken since we have unique id...
//        protocol  = child.Value.split(":")[0];
//        if (type == gNC_NS+"Bookmark" && protocol != "find" && 
//            protocol != "javascript") {
          if (type == gNC_NS+"Bookmark") {
          url = BookmarksUtils.getProperty(child, gNC_NS+"URL", ds);
          name = BookmarksUtils.getProperty(child, gNC_NS+"Name", ds);
          if (url && name) {
            gUrls.push(url);
            gNames.push(name);
          }
        }
      }
    }
  }
  gOK.disabled = gUrls.length == 0;
}

function onOK(aEvent)
{
  window.arguments[0].urls = gUrls;
  window.arguments[0].names = gNames;
}
