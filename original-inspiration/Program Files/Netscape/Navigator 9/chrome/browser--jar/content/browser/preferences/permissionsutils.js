//@line 38 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/permissionsutils.js"

var gTreeUtils = {
  deleteAll: function (aTree, aView, aItems, aDeletedItems)
  {
    for (var i = 0; i < aItems.length; ++i)
      aDeletedItems.push(aItems[i]);
    aItems = [];
    var oldCount = aView.rowCount;
    aView._rowCount = 0;
    aTree.treeBoxObject.rowCountChanged(0, -oldCount);
  },
  
  deleteSelectedItems: function (aTree, aView, aItems, aDeletedItems)
  {
    var selection = aTree.view.selection;
    selection.selectEventsSuppressed = true;
    
    var rc = selection.getRangeCount();
    for (var i = 0; i < rc; ++i) {
      var min = { }; var max = { };
      selection.getRangeAt(i, min, max);
      for (var j = min.value; j <= max.value; ++j) {
        aDeletedItems.push(aItems[j]);
        aItems[j] = null;
      }
    }
    
    var nextSelection = 0;
    for (i = 0; i < aItems.length; ++i) {
      if (!aItems[i]) {
        var j = i;
        while (j < aItems.length && !aItems[j])
          ++j;
        aItems.splice(i, j - i);
        nextSelection = j < aView.rowCount ? j - 1 : j - 2;
        aView._rowCount -= j - i;
        aTree.treeBoxObject.rowCountChanged(i, i - j);
      }
    }

    if (aItems.length) {
      selection.select(nextSelection);
      aTree.treeBoxObject.ensureRowIsVisible(nextSelection);
      aTree.focus();
    }
    selection.selectEventsSuppressed = false;
  },
  
  sort: function (aTree, aView, aDataSet, aColumn, 
                  aLastSortColumn, aLastSortAscending) 
  {
    var ascending = (aColumn == aLastSortColumn) ? !aLastSortAscending : true;
    aDataSet.sort(function (a, b) { return a[aColumn].toLowerCase().localeCompare(b[aColumn].toLowerCase()); });
    if (!ascending)
      aDataSet.reverse();
    
    aTree.view.selection.select(-1);
    aTree.view.selection.select(0);
    aTree.treeBoxObject.invalidate();
    aTree.treeBoxObject.ensureRowIsVisible(0);
    
    return ascending;
  }
};

