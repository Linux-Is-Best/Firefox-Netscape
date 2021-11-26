//@line 39 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/pageReport.js"

var gSiteBox;
var gUnblockButton;
var gPageReport;

var permissionmanager =
        Components.classes["@mozilla.org/permissionmanager;1"]
          .getService(Components.interfaces.nsIPermissionManager);
var nsIPermissionManager = Components.interfaces.nsIPermissionManager;

function onLoad()
{
  gSiteBox = document.getElementById("siteBox");
  gUnblockButton = document.getElementById("unblockButton");
  gPageReport = opener.gBrowser.pageReport;

  buildSiteBox();
  // select the first item using a delay, otherwise the listitems
  // don't paint as selected.
  setTimeout(selectFirstItem, 0);
}

function selectFirstItem()
{
  gSiteBox.selectedIndex = 0;
}

function buildSiteBox()
{
  for (var i = 0; i < gPageReport.length; i++) {
    var found = false;
    for (var j = 0; j < gSiteBox.childNodes.length; j++) {
      if (gSiteBox.childNodes[j].label == gPageReport[i]) {
        found = true;
        break;
      }
    }

    if (!found)
      gSiteBox.appendItem(gPageReport[i]);
  }
}

function siteSelected()
{
  gUnblockButton.disabled = (gSiteBox.selectedItems.length == 0);
}

function whitelistSite()
{
  var selectedItem = gSiteBox.selectedItems[0];
  if (!selectedItem)
    return;

  var selectedIndex = gSiteBox.getIndexOfItem(selectedItem);

  var uri = Components.classes["@mozilla.org/network/io-service;1"]
                      .getService(Components.interfaces.nsIIOService)
                      .newURI(selectedItem.label, null, null);

  permissionmanager.add(uri, "popup", nsIPermissionManager.ALLOW_ACTION);
  gSiteBox.removeChild(selectedItem);

  if (gSiteBox.getRowCount() == 0) {
    // close if there are no other sites to whitelist
    window.close();
    return;
  }

  // make sure a site is selected
  if (selectedIndex > gSiteBox.getRowCount() - 1)
    selectedIndex -= 1;
  gSiteBox.selectedIndex = selectedIndex;
  document.documentElement.getButton("accept").focus()
}
