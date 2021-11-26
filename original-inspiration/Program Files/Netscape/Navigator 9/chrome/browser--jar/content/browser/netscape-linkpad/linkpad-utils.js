/*******************************************************************************
 * Helper function to convert a linkpad item to and from transferable data.
 * If this is a copy or a drag operation the item will be a linkpad item.  
 * If this is a paste or drop operation the item will be the transferable data.
 ******************************************************************************/
function LinkpadConverter(item) {
  this._item = item;
}
LinkpadConverter.prototype = {
  _item: null,
  
  get: function lpv_get(contentType) {
    if (this._item instanceof Ci.nsILinkpadItem)
      return this._toData(contentType);
    return this._fromData(contentType);
  },
  
  toString: function lpv_toString(val) {
    var rv = Cc["@mozilla.org/supports-string;1"].
             createInstance(Ci.nsISupportsString);
    rv.data = val;
    return rv;
  },
  
  _toData: function lpv__toData(contentType) {   
    var rv = "";
    switch (contentType) {
    
    case "text/x-linkpad-item":
      rv = this._item.URL + "\n" + this._item.title + "\n" + this._item.ID +
           "\n" + String(this._item.sortIndex);
      break;  
    
    case "text/x-moz-url":
      rv = this._item.URL + "\n" + this._item.title;
      break;
      
    case "text/html":
      rv = "<A HREF=\"" + this._item.URL + "\">" + this._item.title + "</A>";
      break;
    
    case "text/unicode":
      rv = this._item.URL;
      break;

    case "moz/bookmarkclipboarditem":
      rv = this._item.title + "\n" + this._item.URL + "\n";
      rv += "\n\n\n\n\n\n\n";
      
      var tmpItems = [this._item.title, this._item.URL];
      var separator = "]-[";
      var extrarSeparator = "@";
      for (var i=0; i<tmpItems.length; i++) {
        while (tmpItems[i].indexOf(separator)>-1)
          separator += extrarSeparator;
      }
      rv = separator + "\n" + rv;
      break;
      
    default:
      rv["URL"] = "";
      rv["title"] = "";
      rv["ID"] = null;
      rv["sortIndex"] = 0;        
      break;
    }
    
    return rv;
  },
  
  _fromData: function lpv__fromData(contentType) {
    var data = this._item;
    data = data.split("\n");
      
    var rv = {};    
    switch (contentType) {
    
    case "text/x-linkpad-item":
      rv["URL"] = data[0];
      rv["title"] = data[1];
      rv["ID"] = data[2];
      rv["sortIndex"] = Number(data[3]);
      break;  
    
    case "text/x-moz-url":
      rv["URL"] = data[0];
      if (!data[1])
        rv["title"] = unescape(data[0]);
      else
        rv["title"] = data[1];
      rv["ID"] = null;
      rv["sortIndex"] = 0;
      break;
      
    case "text/unicode":
      rv["URL"] = data[0];
      rv["title"] = unescape(data[0]);
      rv["ID"] = null;
      rv["sortIndex"] = 0;
      break;
       
    case "moz/bookmarkclipboarditem":
      var sep = data.shift();
      var tmpItems = data.join("\n");
      tmpItems = tmpItems.split(sep);
      tmpItems.pop(); 
      for (var i=0; i<tmpItems.length; i++) {
        var childs = tmpItems[i].split("\n");
        childs.pop();
        rv["URL"] = childs[3];
        rv["title"] = childs[2];
        rv["ID"] = null;
        rv["sortIndex"] = 0;
        break;
      }
      break;  
      
    case "text/html":    
    default:
      rv["URL"] = "";
      rv["title"] = "";
      rv["ID"] = null;
      rv["sortIndex"] = 0;    
      break;
    }
    
    return rv;
  }
};
/*******************************************************************************
 * Helper function to deal with clipboard operations.
 ******************************************************************************/
function LinkpadClipboard() {
  this._board = Cc["@mozilla.org/widget/clipboard;1"].
                getService(Ci.nsIClipboard);
}
LinkpadClipboard.prototype = {
  _board: null,

  getTypes: function lpc_getTypes(action) {
    var types = ["text/x-linkpad-item", "moz/bookmarkclipboarditem", 
                 "text/x-moz-url", "text/unicode"];
    if (action == "copy")
      types.push("text/html");
    return types;
  },
  
  hasData: function lpc_hasData() {
  
    // loop through the types and add to a supports array
    var types = this.getTypes("paste");
    var flavors = Cc["@mozilla.org/supports-array;1"].
                  createInstance(Ci.nsISupportsArray);
    for (var i = 0; i < types.length; ++i) {
      var cstring = Cc["@mozilla.org/supports-cstring;1"].
                    createInstance(Ci.nsISupportsCString);
      cstring.data = types[i];
      flavors.AppendElement(cstring);
    }

    // see if clipboard has any types
    return this._board.hasDataMatchingFlavors(flavors, 
                                              Ci.nsIClipboard.kGlobalClipboard);    
  },
  
  onCopy: function lpc_onCopy(item) {
  
    // create a transferable
    var converter = new LinkpadConverter(item);
    var xferable = Cc["@mozilla.org/widget/transferable;1"].
                   createInstance(Ci.nsITransferable);                   
 
    // loop through the types and add to the transferable
    var types = this.getTypes("copy");
    var data;
    for (var i=0; i<types.length; i++) {
      data = converter.get(types[i]);
      xferable.addDataFlavor(types[i]);
      xferable.setTransferData(types[i], converter.toString(data), 
                               data.length*2);    
    }
    
    // set the transferable on the clipboard 
    this._board.setData(xferable, null, Ci.nsIClipboard.kGlobalClipboard);
  },
  
  onPaste: function lpc_onPaste() {
  
    // create a transferable
    var types = this.getTypes("paste");
    var xferable = Cc["@mozilla.org/widget/transferable;1"].
                   createInstance(Ci.nsITransferable);
                   
    // loop through the types and add to the transferable           
    for (var i=0; i<types.length; i++)
      xferable.addDataFlavor(types[i]);  
    
    // get the transferable off the clipboard   
    this._board.getData(xferable, Ci.nsIClipboard.kGlobalClipboard);

    // get the data out of the transferable
    var data = {};
    var type = {};
    try {
      xferable.getAnyTransferData(type, data, {});
      type = type.value;
      data = data.value.QueryInterface(Ci.nsISupportsString).data;
      
      // convert the data and return it    
      var converter = new LinkpadConverter(data);
      return converter.get(type);
    } catch(e) { return {}; }     
  }
};
/*******************************************************************************
 * Helper function to deal with drag and drop operations.
 ******************************************************************************/
function LinkpadDnD(parent) {
  this.parentNode = parent;
}
LinkpadDnD.prototype = {

  _parentNode: null,  
  get parentNode() { return this._parentNode; },
  set parentNode(val) { this._parentNode = val; },

  _dropTarget: null,  
  get dropTarget() { return this._dropTarget; },
  set dropTarget(val) { this._dropTarget = val; },

  _prevTarget: null,  
  get prevTarget() { return this._prevTarget; },
  set prevTarget(val) { this._prevTarget = val; },
  
  _statusText: null,
  get statusText() {
    if (!this._statusText)
      this._statusText = this.getString("linkpad.overlay.drop");
    return this._statusText; 
  },
  
  getTypes: function lpd_getTypes() {
    var types = ["text/x-linkpad-item", "moz/bookmarkclipboarditem", 
                 "text/x-moz-url", "text/unicode", "text/html"];
    return types;
  },
  
  getString: function lpp_getString(name, replace) { 
    var bundle = document.getElementById("linkpad_bundle");
    if (!bundle)
      return null;
      
    if (!replace)
      return bundle.getString(name);
    else
      return bundle.getFormattedString(name, replace);
  },
     
  setDragOver: function lpd_setDragOver(node, enable, value) {
    // set dragover
    if (enable) {
      if (node.getAttribute("dragover") != value)
        node.setAttribute("dragover", value);
        
    // remove dragover
    } else
      node.removeAttribute("dragover");
  },
    
  onDragStart: function lpd_onDragStart(event, xfer, action, item) {
    // do nothing if we do not have a drag parent
    if (!this.parentNode)
      return;
    
    // create transfer data
    xfer.data = new TransferData();
    
    // loop through the types and add to the xfer
    var types = this.getTypes();
    var converter = new LinkpadConverter(item);
    for (var i=0; i<types.length; i++) 
      xfer.data.addDataForFlavour(types[i], converter.get(types[i]));  
    
    // set action to copy if the ctrl key is pressed  
    if (event.ctrlKey)
      action.action = Ci.nsIDragService.DRAGDROP_ACTION_COPY; 
  },

  onDragEnter: function lpd_onDragEnter(event, session) {
      
    // set the statusbar text
    var el = window.top.document.getElementById("statusbar-display");
    el.label = this.statusText;
    
    // set the dragover attribute
    if (!this.parentNode)
      this.setDragOver(event.target, true, "true");
  },
  
  onDragOver: function lpd_onDragOver(event, flavour, session) {
    // set the canDrop
    session.canDrop = true;
    
    // set the action to link if we do not have a parent
    if (!this.parentNode) {
      session.dragAction = Ci.nsIDragService.DRAGDROP_ACTION_LINK;
      return;
    }
    
    // loop up until the drop target is a listitem or listbox
    var dropTarget = event.target;
    var listbox = dropTarget;
    while (listbox && listbox != this.parentNode) {
      dropTarget = listbox;
      listbox = listbox.parentNode;
    }

    // save the current drop target and clear the variable
    this.prevTarget = this.dropTarget;
    this.dropTarget = null;
    
    /** target is listbox either we have no children or we are before
        the first element or after the last element **/
    var value = "bottom";    
    var center;
    if (dropTarget == this.parentNode) {
    
      // no children so set the drop target to null
      if (!this.parentNode.hasChildNodes())
        this.dropTarget = null;
      
      // if mouse is after the center of the lastChild set target to last  
      else {
        center = this.parentNode.lastChild.boxObject.y + 
                 (this.parentNode.lastChild.boxObject.height / 2);
        if (event.clientY > center)
          this.dropTarget = this.parentNode.lastChild;          
        else {
          this.dropTarget = this.parentNode.firstChild;
          value = "top";
        }
      }
    
    // drop target is a list item  
    } else {
      
      // if mouse after center set target to the previous sibling
      center = dropTarget.boxObject.y + (dropTarget.boxObject.height / 2);
      if (dropTarget == this.parentNode.firstChild && (event.clientY < center)) {
        this.dropTarget = dropTarget;
        value = "top";
      } else if (event.clientY > center)
        this.dropTarget = dropTarget;
      else
        this.dropTarget = dropTarget.previousSibling;
    }
    
    // remove drag over on the previous target
    if (this.prevTarget && this.dropTarget != this.prevTarget)
      this.setDragOver(this.prevTarget, false);
    
    // set drag over on the current target
    if (this.dropTarget)
      this.setDragOver(this.dropTarget, true, value);
  },
  
  onDragExit: function lpd_onDragExit(event, session) {
     
    // clear the statusbar
    var el = window.top.document.getElementById("statusbar-display");    
    el.label = "";
    
    // clear the drag over attribute
    this.setDragOver(event.target, false);    
    if (this.prevTarget) {
      this.setDragOver(this.prevTarget, false);
      this.prevTarget = null;
    }
    if (this.dropTarget) {
      this.setDragOver(this.dropTarget, false);
      this.dropTarget = null;
    }    
  },
  
  onDrop: function lpd_onDrop(event, xfer, session) {
    var converter = new LinkpadConverter(xfer.data);
    var item = converter.get(xfer.flavour.contentType);
    return item;
  },

  getFlavours: function lpd_getFavours() {
    var flavourSet = new FlavourSet();
    flavourSet.appendFlavour("text/x-linkpad-item");  
    flavourSet.appendFlavour("moz/bookmarkclipboarditem");  
    flavourSet.appendFlavour("text/x-moz-url");
    flavourSet.appendFlavour("text/unicode");
    return flavourSet;
  }  
};
/*******************************************************************************
 * Helper function to determine if the converted linkpad item is valid.
 ******************************************************************************/
function isValidLinkpadItem(item) {
  function isURL(s) {
    var regexp = /(ftp|http|https|gopher|file):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    return regexp.test(s);
  }

  var properties = ["URL", "title", "ID", "sortIndex"];
  for (var i=0; i<properties.length; i++) {
    if (!item.hasOwnProperty(properties[i]))
      return false;
  }
  if (item["URL"] === "")
    return false;
  if (item["title"] === "")
    return false;
  if (isURL(item["URL"]))
    return true;
  return false;
}