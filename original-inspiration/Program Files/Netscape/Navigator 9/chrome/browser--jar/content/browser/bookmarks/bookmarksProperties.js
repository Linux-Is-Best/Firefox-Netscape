//@line 37 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/bookmarks/content/bookmarksProperties.js"

// This is the RDF Resource we're dealing with.
var gResource;
// This is the set of fields that are visible in the window.
var gFields;
// ...and this is a parallel array that contains the RDF properties
// that they are associated with.
var gProperties;

function showDescription()
{
  initServices();
  initBMService();

  gResource = RDF.GetResource(window.arguments[0]);
 
  if (gResource == BMSVC.getBookmarksToolbarFolder()) {
    var description = BookmarksUtils.getLocaleString("description_PersonalToolbarFolder");
    var box = document.getElementById("description-box");
    box.hidden = false;
    var textNode = document.createTextNode(description);
    document.getElementById("bookmarkDescription").appendChild(textNode);
  }
}

function Init()
{

  // assume the user will press cancel (only used when creating new resources)
  window.arguments[1].ok = false;

  // This is the set of fields that are visible in the window.
  gFields     = ["name", "url", "shortcut", "description", "webpanel", "feedurl"];

  // ...and this is a parallel array that contains the RDF properties
  // that they are associated with.
  gProperties = [RDF.GetResource(gNC_NS+"Name"),
                 RDF.GetResource(gNC_NS+"URL"),
                 RDF.GetResource(gNC_NS+"ShortcutURL"),
                 RDF.GetResource(gNC_NS+"Description"),
                 RDF.GetResource(gNC_NS+"WebPanel"),
                 RDF.GetResource(gNC_NS+"FeedURL"),
                 RDF.GetResource(gNC_NS+"GeneratedTitle")];

  var x;
  // Initialize the properties panel by copying the values from the
  // RDF graph into the fields on screen.

  for (var i=0; i<gFields.length; ++i) {
    var field = document.getElementById(gFields[i]);
    var value = BMDS.GetTarget(gResource, gProperties[i], true);
    
    if (value)
      value = value.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;

    if (gFields[i] == "webpanel")
      field.checked = (value != undefined);
    else if (value) //make sure were aren't stuffing null into any fields
      field.value = value;
  }

  if (MicrosummaryPicker.enabled)
    MicrosummaryPicker.init();

  var nameNode = document.getElementById("name");
  document.title = document.title.replace(/\*\*bm_title\*\*/gi, nameNode.value);

  // if its a container, disable some things
  var isContainerFlag = RDFCU.IsContainer(BMDS, gResource);
  if (!isContainerFlag) {
    // XXX To do: the "RDFCU.IsContainer" call above only works for RDF sequences;
    //            if its not a RDF sequence, we should to more checking to see if
    //            the item in question is really a container of not.  A good example
    //            of this is the "File System" container.
  }

  var isLivemark = BookmarksUtils.resolveType(gResource) == "Livemark";
  var isSeparator = BookmarksUtils.resolveType(gResource) == "BookmarkSeparator";

  if (isContainerFlag || isSeparator) {
    // Hide the "Load in sidebar" checkbox unless it's a bookmark.
    var webpanelCheckbox = document.getElementById("webpanel");
    webpanelCheckbox.hidden = true;

    // If it is a folder, it has no URL or Keyword
    document.getElementById("locationrow").setAttribute("hidden", "true");
    document.getElementById("shortcutrow").setAttribute("hidden", "true");
    if (isSeparator) {
      document.getElementById("descriptionrow").setAttribute("hidden", "true");
    }
  }

  if (isLivemark) {
    document.getElementById("locationrow").hidden = true;
    document.getElementById("shortcutrow").hidden = true;
  } else {
    document.getElementById("feedurlrow").hidden = true;
  }

  sizeToContent();
  
  // set initial focus
  nameNode.focus();
  nameNode.select();
}


function Commit()
{
  var changed = false;

  // Grovel through the fields to see if any of the values have
  // changed. If so, update the RDF graph and force them to be saved
  // to disk.
  for (var i=0; i<gFields.length; ++i) {
    var field = document.getElementById(gFields[i]);

    if (! field)
      continue;

    // Get the new value as a literal, using 'null' if the value is empty.
    var newValue = field.value;

    if (gFields[i] == "name" && MicrosummaryPicker.enabled) {
      // If the microsummary picker is enabled, the value of the name field
      // won't necessarily contain the user-entered name for the bookmark.
      // But the first item in the microsummary drop-down menu will always
      // contain the user-entered name, so get the name from there instead.
      var nameItem = document.getElementById("userEnteredNameItem");
      newValue = nameItem.getAttribute("label");

      // Make any necessary changes to the microsummary for this bookmark.
      changed |= MicrosummaryPicker.commit();
      MicrosummaryPicker.destroy();

      // The rest of the code in this "for" loop will proceed to save changes
      // to the user-entered name, whether or not the user subsequently chose
      // to display a microsummary.  Presumably this is the correct behavior,
      // as we should trust that the user intended to both change the name
      // and display a microsummary.
    }

    if (gFields[i] == "webpanel")
      newValue = field.checked ? "true" : undefined;
 
    var oldValue = BMDS.GetTarget(gResource, gProperties[i], true);

    if (oldValue)
      oldValue = oldValue.QueryInterface(Components.interfaces.nsIRDFLiteral);

    if (newValue && gFields[i] == "shortcut") {
      // shortcuts are always lowercased internally
      newValue = newValue.toLowerCase();
      // strip trailing and leading whitespace
      newValue = newValue.replace(/(^\s+|\s+$)/g, '');
    }
    else if (newValue && gFields[i] == "url") {
      if (newValue.indexOf(":") < 0)
        // we're dealing with the URL attribute;
        // if a scheme isn't specified, use "http://"
        newValue = "http://" + newValue;
    }

    if (newValue)
      newValue = RDF.GetLiteral(newValue);

    changed |= updateAttribute(gProperties[i], oldValue, newValue);

    if (gFields[i] == "url" && oldValue && oldValue.Value != newValue.Value) {
      // if the URL was updated, clear out the favicon
      var icon = BMDS.GetTarget(gResource, RDF.GetResource(gNC_NS+"Icon"), true);
      if (icon) BMDS.Unassert(gResource, RDF.GetResource(gNC_NS+"Icon"), icon);
    }
  }

  if (changed) {
    var remote = BMDS.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
    if (remote)
      remote.Flush();
  }

  window.arguments[1].ok = true;
  window.close();
  return true;
}

function Cancel()
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

function updateAttribute(aProperty, aOldValue, aNewValue)
{
  if ((aOldValue || aNewValue) && aOldValue != aNewValue) {
    if (aOldValue && !aNewValue)
      BMDS.Unassert(gResource, aProperty, aOldValue);
    else if (!aOldValue && aNewValue)
      BMDS.Assert(gResource, aProperty, aNewValue, true);
    else /* if (aOldValue && aNewValue) */
      BMDS.Change(gResource, aProperty, aOldValue, aNewValue);
    return true;
  }
  return false;
}
