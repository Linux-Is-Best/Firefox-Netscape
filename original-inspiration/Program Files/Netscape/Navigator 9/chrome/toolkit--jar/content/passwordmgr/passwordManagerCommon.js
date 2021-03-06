//@line 41 "/cygdrive/c/builds/rklein/trunk/mozilla/toolkit/components/passwordmgr/resources/content/passwordManagerCommon.js"

/*** =================== INITIALISATION CODE =================== ***/

var kObserverService;
var gSelectUserInUse = false;

// interface variables
var passwordmanager     = null;

// password-manager lists
var signons             = [];
var rejects             = [];
var deletedSignons      = [];
var deletedRejects      = [];

var signonsTree;
var rejectsTree;

var showingPasswords = false;

function Startup() {
  // xpconnect to password manager interfaces
  passwordmanager = Components.classes["@mozilla.org/passwordmanager;1"].getService(Components.interfaces.nsIPasswordManager);

  // be prepared to reload the display if anything changes
  kObserverService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
  kObserverService.addObserver(signonReloadDisplay, "signonChanged", false);

  // be prepared to disable the buttons when selectuser dialog is in use
  kObserverService.addObserver(signonReloadDisplay, "signonSelectUser", false);

  signonsTree = document.getElementById("signonsTree");
  rejectsTree = document.getElementById("rejectsTree");
}

function Shutdown() {
  kObserverService.removeObserver(signonReloadDisplay, "signonChanged");
  kObserverService.removeObserver(signonReloadDisplay, "signonSelectUser");
}

var signonReloadDisplay = {
  observe: function(subject, topic, state) {
    if (topic == "signonChanged") {
      if (state == "signons") {
        signons.length = 0;
        if (lastSignonSortColumn == "host") {
          lastSignonSortAscending = !lastSignonSortAscending; // prevents sort from being reversed
        }
        LoadSignons();
      } else if (state == "rejects") {
        rejects.length = 0;
        if (lastRejectSortColumn == "host") {
          lastRejectSortAscending = !lastRejectSortAscending; // prevents sort from being reversed
        }
        LoadRejects();
      }
    } else if (topic == "signonSelectUser") {
      if (state == "suspend") {
        gSelectUserInUse = true;
        document.getElementById("removeSignon").disabled = true;
        document.getElementById("removeAllSignons").disabled = true;
        document.getElementById("togglePasswords").disabled = true;
      } else if (state == "resume") {
        gSelectUserInUse = false;
        var selections = GetTreeSelections(signonsTree);
        if (selections.length > 0) {
          document.getElementById("removeSignon").disabled = false;
        }
        if (signons.length > 0) {
          document.getElementById("removeAllSignons").disabled = false;
          document.getElementById("togglePasswords").disabled = false;
        }
      } else if (state == "inUse") {
        gSelectUserInUse = true;
      }
    }
  }
}

/*** =================== GENERAL CODE =================== ***/

function DeleteAllFromTree(tree, view, table, deletedTable, removeButton, removeAllButton) {

  // remove all items from table and place in deleted table
  for (var i=0; i<table.length; i++) {
    deletedTable[deletedTable.length] = table[i];
  }
  table.length = 0;

  // clear out selections
  view.selection.select(-1); 

  // update the tree view and notify the tree
  view.rowCount = 0;

  var box = tree.treeBoxObject;
  box.rowCountChanged(0, -deletedTable.length);
  box.invalidate();


  // disable buttons
  document.getElementById(removeButton).setAttribute("disabled", "true")
  document.getElementById(removeAllButton).setAttribute("disabled","true");
}

function DeleteSelectedItemFromTree
    (tree, view, table, deletedTable, removeButton, removeAllButton) {

  var box = tree.treeBoxObject;

  // Remove selected items from list (by setting them to null) and place in
  // deleted list.  At the same time, notify the tree of the row count changes.

  var selection = box.view.selection;
  var oldSelectStart = table.length;
  box.beginUpdateBatch();

  var selCount = selection.getRangeCount();
  var min = new Object();
  var max = new Object();

  for (var s = 0; s < selCount; ++s) {
    selection.getRangeAt(s, min, max);
    var minVal = min.value;
    var maxVal = max.value;

    oldSelectStart = minVal < oldSelectStart ? minVal : oldSelectStart;

    var rowCount = maxVal - minVal + 1;
    view.rowCount -= rowCount;
    box.rowCountChanged(minVal, -rowCount);

    for (var i = minVal; i <= maxVal; ++i) {
      deletedTable[deletedTable.length] = table[i];
      table[i] = null;
    }
  }

  // collapse list by removing all the null entries
  for (var j = 0; j < table.length; ++j) {
    if (!table[j]) {
      var k = j;
      while (k < table.length && !table[k])
        k++;

      table.splice(j, k-j);
    }
  }

  box.endUpdateBatch();

  // update selection and/or buttons
  var removeBtn = document.getElementById(removeButton);
  var removeAllBtn = document.getElementById(removeAllButton);

  if (table.length) {
    removeBtn.removeAttribute("disabled");
    removeAllBtn.removeAttribute("disabled");

    selection.select(oldSelectStart < table.length ? oldSelectStart : table.length - 1);
  } else {
    removeBtn.setAttribute("disabled", "true");
    removeAllBtn.setAttribute("disabled", "true");
  }
}

function GetTreeSelections(tree) {
  var selections = [];
  var select = tree.view.selection;
  if (select) {
    var count = select.getRangeCount();
    var min = new Object();
    var max = new Object();
    for (var i=0; i<count; i++) {
      select.getRangeAt(i, min, max);
      for (var k=min.value; k<=max.value; k++) {
        if (k != -1) {
          selections[selections.length] = k;
        }
      }
    }
  }
  return selections;
}

function SortTree(tree, view, table, column, lastSortColumn, lastSortAscending, updateSelection) {

  // remember which item was selected so we can restore it after the sort
  var selections = GetTreeSelections(tree);
  var selectedNumber = selections.length ? table[selections[0]].number : -1;

  // determine if sort is to be ascending or descending
  var ascending = (column == lastSortColumn) ? !lastSortAscending : true;

  // do the sort
  var compareFunc;
  if (ascending) {
    compareFunc = function compare(first, second) {
      return CompareLowerCase(first[column], second[column]);
    }
  } else {
    compareFunc = function compare(first, second) {
      return CompareLowerCase(second[column], first[column]);
    }
  }
  table.sort(compareFunc);

  // restore the selection
  var selectedRow = -1;
  if (selectedNumber>=0 && updateSelection) {
    for (var s=0; s<table.length; s++) {
      if (table[s].number == selectedNumber) {
        // update selection
        // note: we need to deselect before reselecting in order to trigger ...Selected()
        tree.view.selection.select(-1);
        tree.view.selection.select(s);
        selectedRow = s;
        break;
      }
    }
  }

  // display the results
  tree.treeBoxObject.invalidate();
  if (selectedRow >= 0) {
    tree.treeBoxObject.ensureRowIsVisible(selectedRow)
  }

  return ascending;
}

/**
 * Case insensitive string comparator.
 */
function CompareLowerCase(first, second) {

  var firstLower  = first.toLowerCase();
  var secondLower = second.toLowerCase();

  if (firstLower < secondLower) {
    return -1;
  }

  if (firstLower > secondLower) {
    return 1;
  }

  return 0;
}
