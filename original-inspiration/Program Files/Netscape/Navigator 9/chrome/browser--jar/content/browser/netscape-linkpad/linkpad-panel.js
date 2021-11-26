/*******************************************************************************
 * Constants used for quick access to the Components object.
 ******************************************************************************/
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const kXULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
/*******************************************************************************
 * Main object that interacts between the user and the backend.
 ******************************************************************************/
var LinkpadPanel = {
 
  // nsISupports
  QueryInterface: function lpp_QI(iid) {
    if (iid.equals(Ci.nsIObserver) ||
        iid.equals(Ci.nsIController) ||
        iid.equals(Ci.nsISupports))
      return this;
    throw Cr.NS_ERROR_NO_INTERFACE; 
  }, 
  
  // nsIObserver
  observe: function lpp_observe(subject, topic, data) {
    if (topic == "netscape-linkpad") {
      var self = this;
      window.setTimeout(function() { try { self[data](subject); } catch(e) {} },0);
    } else if (topic == "nsPref:changed" && data == "openClickCount") {
      var count = this.branch.getIntPref("openClickCount");
      this.listbox.setAttribute("clickcount", String(count));
    }
  },
  
  _obService: null,
  get obService() { return this._obService; },
  set obService(val) { this._obService = val; },
  
  _lpService: null,
  get lpService() { return this._lpService; },
  set lpService(val) { this._lpService = val; },

  _branch: null,
  get domain() { return "extensions.netscape.linkpad."; },
  get branch() { return this._branch; },
  set branch(val) { this._branch = val; },
  
  _clipboard: null,
  get clipboard() { return this._clipboard; },
  set clipboard(val) { this._clipboard = val; },
  
  _dnd: null,
  get dnd() { return this._dnd; },
  set dnd(val) { this._dnd = val; },
  
  get listbox() { return document.getElementById("linkpad_listbox"); },
      
  onLoad: function lpp_onLoad() {
  
    // hookup the command controller and add the helper objects
    this.listbox.controllers.appendController(this);
    this.clipboard = new LinkpadClipboard();
    this.dnd = new LinkpadDnD(this.listbox);
    
    // get the linkpad service
    this.lpService = Cc["@netscape.com/linkpad/service;1"].
                   getService(Ci.nsILinkpadService);
    
    // get the preference branch
    var pbService = Cc["@mozilla.org/preferences-service;1"].
                    getService(Ci.nsIPrefService);
    this.branch = pbService.getBranch(this.domain);
    this.branch.QueryInterface(Ci.nsIPrefBranch2).addObserver("", this, false);
    var count = this.branch.getIntPref("openClickCount");
    this.listbox.setAttribute("clickcount", String(count));
      
    // get the observer service and add ourself               
    this.obService = Cc["@mozilla.org/observer-service;1"].
                     getService(Ci.nsIObserverService);
    this.obService.addObserver(this, "netscape-linkpad", false);
    
    // load the listbox and focus it                 
    this.loadListbox();
    this.setSelection();
    this.listbox.focus();
  },
  
  onUnload: function lpp_onUnload() {
  
    // unhook the command controller
    this.listbox.controllers.removeController(this);
    this.dnd.parentNode = null;
    
    // remove the observer
    this.branch.QueryInterface(Ci.nsIPrefBranch2).removeObserver("", this);
    this.obService.removeObserver(this, "netscape-linkpad");

    // remove variables
    this.queue = null;
    this.timer = null; 
    this.obService = null;
    this.lpService = null;
    this.branch = null;
    this.clipboard = null;
    this.dnd = null;
  },
    
  loadListbox: function lpp_loadListbox() {
    var listbox = this.listbox;
    
    // fill listbox  
    var items = this.lpService.getItems();
    var index = 0;
    while (index < items.length) {
      this.createItem(items.queryElementAt(index, Ci.nsILinkpadItem));
      index++;
    }
  },

  createItem: function lpp_createItem(item) {
    item = item.QueryInterface(Ci.nsILinkpadItem);    
    this.createNode(item);
  },
  
  updateItem: function lpp_updateItem(item) {
    item = item.QueryInterface(Ci.nsILinkpadItem);    
    this.deleteItem(item);
    this.createItem(item);
  },
  
  deleteItem: function lpp_deleteItem(item) {
    item = item.QueryInterface(Ci.nsILinkpadItem);  
    var node = document.getElementById(item.ID + "_listitem");
    if (!node)
      return;
      
    node.parentNode.removeChild(node);
  },
  
  clearItems: function lpp_clearItems(service) {
    service = service.QueryInterface(Ci.nsILinkpadService);
    
    var listbox = this.listbox;
    while (listbox.hasChildNodes())
      listbox.removeChild(listbox.lastChild);
  },
  
  createNode: function lpp_createNode(item) {  
    var ID = item.ID;
    var visited = item.visited; 
 
    // create the list item
    var node = document.createElementNS(kXULNS, "listitem");
    node.setAttribute("id", ID + "_listitem");
    node.setAttribute("itemid", ID);
    node.setAttribute("class", "linkpad-item listitem-iconic");
    node.setAttribute("label", item.title);
    node.setAttribute("value", item.URL);
    node.setAttribute("tooltiptext", item.URL);
    node.setAttribute("sortIndex", String(item.sortIndex));
    
    // set the visited attribute
    if (visited)
      node.setAttribute("visited", "true");
      
    // add to dom document
    this.addNode(node);
  },
        
  addNode: function lpp_addNode(node) {
  
    // append since we have no children
    var parent = this.listbox;
    if (!parent.hasChildNodes()) {
      parent.appendChild(node);
      return;
    }

    // append since the sort index is greater than the last child's
    var child = parent.lastChild;    
    var childIndex = Number(child.getAttribute("sortIndex"));
    var sortIndex = Number(node.getAttribute("sortIndex"));
    if (sortIndex >= childIndex) {
      parent.appendChild(node);
      return;
    }
   
    // insert before the first because sort index is less than first child's
    child = parent.firstChild;      
    childIndex = Number(child.getAttribute("sortIndex"));
    if (sortIndex <= childIndex) {
      parent.insertBefore(node, child);
      return;
    }
    
    // loop through the children
    while (child) {
    
      // last node so leave
      var next = child.nextSibling;
      if (!next)
        break;
    
      // sort index is in between so insert before next
      childIndex = Number(child.getAttribute("sortIndex"));
      var nextIndex = Number(next.getAttribute("sortIndex"));
      if (childIndex <= sortIndex && nextIndex >= sortIndex) {
        parent.insertBefore(node, next);
        return;
      }
      
      // set the current to the next
      child = next;
    }
    
    // could not find the correct position so append 
    parent.appendChild(node);
  },
  
  getOS: function lpp_getOS() {
    var app = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo).
              QueryInterface(Ci.nsIXULRuntime);  
    return app.OS.toLowerCase();          
  },
  
  getInsertionPoint: function lpp_getInsertionPoint(target) {
    var listbox = this.listbox;
    var sortIndex = 0;
    
    // no target so append
    if (!target)
      sortIndex = 0;
    
    // target is last child so append  
    else if (target == listbox.lastChild)
      sortIndex = 0;
    
    // target is the first child and dropping before
    else if (target == listbox.firstChild && 
             (listbox.firstChild.getAttribute("dragover") == "top"))
      sortIndex = Number(listbox.firstChild.getAttribute("sortIndex"))/2;
    
    else {
      var current = Number(target.getAttribute("sortIndex"));
      var next = Number(target.nextSibling.getAttribute("sortIndex"));
      sortIndex = current + ((next-current)/2);    
    }
    
    return sortIndex;    
  },
  
  openLink: function lpp_openLink(override) {
    var item = this.listbox.selectedItem;
    if (!item)
      return;
      
    var where = (!override) ? nsWhereToOpenLink(this.domain + "open") : override;
    if (this.branch.getBoolPref("removeLinkOnOpen")) {
      this.setSelection(item);
      this.lpService.deleteItem(item.getAttribute("itemid"));
    }
    
    if (where == "sidebar")
      openWebPanel(item.label, item.value);
    else {
      openUILinkIn(item.value, where);
      window.content.focus();
    }
  },
  
  copyLink: function lpp_copyLink() {
    var item = this.listbox.selectedItem;
    if (!item)
      return;
    
    item = this.lpService.getItem(item.getAttribute("itemid"));  
    this.clipboard.onCopy(item);
  },
  
  pasteLink: function lpp_pasteLink() {
    var item = this.clipboard.onPaste();    
    if (!isValidLinkpadItem(item))
      return;
      
    var sortIndex = this.getInsertionPoint(this.listbox.selectedItem);
    this.lpService.createItem(item.URL, item.title, sortIndex);    
  },
  
  removeLink: function lpp_removeLink() {
    var item = this.listbox.selectedItem;
    this.setSelection(item);
    this.lpService.deleteItem(item.getAttribute("itemid"));
  },
  
  checkClick: function lpp_checkClick(event, count) {
    if (event.originalTarget.localName != "listitem")
      return;
    
    if ((event.button !== 0) && (event.button != 1))
      return;
    
    if (count != this.branch.getIntPref("openClickCount"))
      return;
          
    var where = nsWhereToOpenLink(this.domain + "open", event, false, false);
    this.openLink(where);
  },
  
  setSelection: function lpp_setSelection(item) {
    var listbox = this.listbox;
    if (listbox.getRowCount() === 0) {
      listbox.clearSelection();
      return;
    }
    
    if (!item) {
      listbox.selectItem(listbox.getItemAtIndex(0));
      return;
    }
    
    var next = listbox.getNextItem(item, 1);
    if (!next)
      next = listbox.getPreviousItem(item, 1);
    if (!next)
      listbox.clearSelection();
    else
      listbox.selectItem(next);   
  },
  
  confirmClear: function lpp_confirmClear() {
    var dontAsk = !this.branch.getBoolPref("showClear");
    if (dontAsk)
      return true;
      
    var title = this.dnd.getString("linkpad.panel.clear.title");
    var message = this.dnd.getString("linkpad.panel.clear.message");
    var show = this.dnd.getString("linkpad.panel.clear.show");
    
    var ptService = Cc["@mozilla.org/embedcomp/prompt-service;1"].
                    getService(Ci.nsIPromptService);
    var checkbox = { value: false };
    var clear =  ptService.confirmCheck(window, title, message, show, checkbox);
    if (!clear)
      return false;
        
    this.branch.setBoolPref("showClear", !checkbox.value);
    return true;
  },
    
  // nsIController         
  supportsCommand: function lpp_supportsCommand(id) {
    switch (id) {
    case "cmd_cut":
    case "cmd_copy":
    case "cmd_paste":     
    case "cmd_delete":
    case "linkpad_open":
    case "linkpad_openWin":
    case "linkpad_openTab":
    case "linkpad_openSidebar":
    case "linkpad_clear":
      return true;
     default:
       return false;
    }
  },
  
  isCommandEnabled: function lpp_isCommandEnabled(id) {
    var listbox = this.listbox;
    switch (id) {
    case "cmd_cut":
    case "cmd_copy":
    case "cmd_delete":
    case "linkpad_open":
    case "linkpad_openWin":
    case "linkpad_openTab":
    case "linkpad_openSidebar":
        return (listbox.selectedItem !== null);
    case "cmd_paste": 
      return this.clipboard.hasData();
    case "linkpad_clear":
      return (listbox.getRowCount() > 0);
    default:
      return false;
    }
  },
  
  doCommand: function lpp_doCommand(id) {
    switch (id) {
      case "cmd_cut":
        this.copyLink();
        this.removeLink();     
        break;
      case "cmd_copy":
        this.copyLink();      
        break;
      case "cmd_paste":
        this.pasteLink();
        break;
      case "cmd_delete":
        this.removeLink();  
        break;
      case "linkpad_open":
        this.openLink();
        break;
      case "linkpad_openWin":
        this.openLink("window");
        break;
      case "linkpad_openTab":
        this.openLink("tab");      
        break;
      case "linkpad_openSidebar":
        this.openLink("sidebar");
        break;
      case "linkpad_clear":
        if (this.confirmClear())
          this.lpService.clearItems();
        break;
      default:
        return;
    }
  },
  
  onEvent: function lpp_onEvent(name) {
    goUpdateGlobalEditMenuItems();
    goUpdateCommand("linkpad_open");    
    goUpdateCommand("linkpad_openWin");
    goUpdateCommand("linkpad_openTab");
    goUpdateCommand("linkpad_openSidebar");  
    goUpdateCommand("linkpad_clear");  
  },
          
  // nsDragAndDrop       
  onDragStart: function lpp_onDragStart(event, xfer, action) {
    var item = this.listbox.selectedItem;
    if (!item)
      return;
      
    item = this.lpService.getItem(item.getAttribute("itemid"));  
    this.dnd.onDragStart(event, xfer, action, item);
  },
  
  onDragEnter: function lpp_onDragEnter(event, session, action) {
    this.dnd.onDragEnter(event, session, action);
  },
  
  onDragOver: function lpp_onDragOver(event, flavour, session) {
    this.dnd.onDragOver(event, flavour, session);
  },
  
  onDragExit: function lpp_onDragExit(event, session) {  
    this.dnd.onDragExit(event, session);
  },
  
  onDrop: function lp_onDrop(event, xfer, session) {    
    var item = this.dnd.onDrop(event, xfer, session);
    if (!isValidLinkpadItem(item))
      return;
    
    // text/x-linkpad-item  
    var sortIndex = this.getInsertionPoint(this.dnd.dropTarget);
    if (item.ID !== null && 
        session.dragAction == Ci.nsIDragService.DRAGDROP_ACTION_MOVE)
        this.lpService.deleteItem(item.ID);
    
    // insert the item
    this.lpService.createItem(item.URL, item.title, sortIndex);
    event.stopPropagation();
  },

  getSupportedFlavours: function lp_getSupportedFavours() {
    return this.dnd.getFlavours();
  },

  buildContextMenu: function lpp_buildContextMenu(event) {
  
    var target = event.explicitOriginalTarget;
    if (target.localName == "listitem")
      this.listbox.selectItem(target);    
            
    // setup variables
    var separator = null;
    var command = null;
    var visibleItemsBeforeSep = false;
    var anyVisible = false;
    
    // loop through the context menu
    var popup = event.target;
    for (var i=0; i<popup.childNodes.length; ++i) {
    
      // get the menuitem
      var item = popup.childNodes[i];
      
      // determine if item should be visible
      if (item.localName != "menuseparator") {
        command = document.getElementById(item.getAttribute("command"));
        item.hidden = command.hasAttribute("disabled");

        // item is visible mark variables as such
        if (!item.hidden) {
          visibleItemsBeforeSep = true;
          anyVisible = true;
 
          // show the separator above the menu-item if any
          if (separator) {
            separator.hidden = false;
            separator = null;
          }
        }
      }

      // menuseparator
      else {

        // initially hide it. It will be unhidden if there will be at least one
        // visible menu-item above and below it.
        item.hidden = true;

        // we won't show the separator at all if no items are visible above it
        if (visibleItemsBeforeSep)
          separator = item;
 
        // new separator, count again:
        visibleItemsBeforeSep = false;
      }
    }

    return anyVisible;
  }
};          