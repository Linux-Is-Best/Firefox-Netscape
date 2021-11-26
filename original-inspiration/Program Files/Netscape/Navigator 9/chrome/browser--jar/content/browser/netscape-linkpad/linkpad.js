/*******************************************************************************
 * Main object that interacts between the user and the backend.
 ******************************************************************************/
var Linkpad = {
  
  // nsISupports
  QueryInterface: function lp_QI(iid) {
    if (iid.equals(Ci.nsISupports))
      return this;
    throw Cr.NS_ERROR_NO_INTERFACE; 
  },  
  
  _lpService: null,
  get lpService() { return this._lpService; },
  set lpService(val) { this._lpService = val; },

  _branch: null,
  get domain() { return "extensions.netscape.linkpad."; },
  get branch() { return this._branch; },
  set branch(val) { this._branch = val; },
  
  _dragCount: null,
  get dragCount() { return this._dragCount; },
  set dragCount(val) { this._dragCount = val; },
  
  _dnd: null,
  get dnd() { return this._dnd; },
  set dnd(val) { this._dnd = val; },
  
  _flashCount: null,
  get flashCount() { return this._flashCount; },
  set flashCount(val) { this._flashCount = val; },
  
  _flashTimeout: null,
  get flashTimeout() { return this._flashTimeout; },
  set flashTimeout(val) { this._flashTimeout = val; },
  
  onLoad: function lp_onLoad() {
    this.dnd = new LinkpadDnD(null);
    this.flashCount = 6;
    
    // get the linkpad service
    this.lpService = Cc["@netscape.com/linkpad/service;1"].
                   getService(Ci.nsILinkpadService);
    
    // get the preference branch
    var pbService = Cc["@mozilla.org/preferences-service;1"].
                    getService(Ci.nsIPrefService);
    this.branch = pbService.getBranch(this.domain);  
  },
  
  onUnload: function lp_onUnload() {
    if (this.flashTimeout)
      window.clearInterval(this.flashTimeout);
      
    // remove variables
    this.lpService = null;
    this.branch = null;
    this.dragCount = null;
    this.dnd = null;
    this.flashCount = null;
    this.flashTimeout = null;
  },
  
  openPanel: function lp_openPanel(force) {
    toggleSidebar("linkpad_panel", force);
  },
  
  checkClick: function lp_checkClick(event) {
    if (event.button === 0)
      this.openPanel(false);
    else if (event.button == 1)
      this.nextLink();
  },
  
  nextLink: function lp_nextLink() {
    
    var items = this.lpService.getItems();
    if (items.length === 0)
      return;
      
    var item = items.queryElementAt(0, Ci.nsILinkpadItem);
    var where = nsWhereToOpenLink(this.domain + "open");
    
    this.lpService.deleteItem(item.ID);
    openUILinkIn(item.URL, where);
    window.content.focus();  
  },
  
  saveLink: function lp_saveLink(url, title) {
    var self = this;
    this.lpService.createItem(url, title, 0);
    if (!this.flashTimeout)
      this.flashTimeout = window.setInterval(function() { self.flashPanel(); }, 500);    
  },

  flashPanel: function lp_flashPanel() {
    var panel = document.getElementById("linkpad_status");
    if (this.flashCount-- === 0) {
      window.clearInterval(this.flashTimeout);
      this.flashTimeout = null;
      panel.removeAttribute("dragover");
      this.flashCount = 6;
      return;
    }
   
    panel.setAttribute("dragover", (this.flashCount % 2 === 0) ? "false" : "true");
  },
          
  // nsDragAndDrop   
  onDragStart: function lp_onDragStart(event, xfer, action) {
    this.dnd.onDragStart(event, xfer, action, null);
  },
      
  onDragEnter: function lp_onDragEnter(event, session) {
    this.dragCount = this.branch.getIntPref("panelOpenDelay");
    this.dnd.onDragEnter(event, session);
  },
  
  onDragOver: function lp_onDragOver(event, flavour, session) { 
    this.dragCount--;
    if (this.dragCount === 0)
      this.openPanel(true);
      
    this.dnd.onDragOver(event, flavour, session);
  },
  
  onDragExit: function lp_onDragExit(event, session) {
    this.dragCount = this.branch.getIntPref("panelOpenDelay");
    this.dnd.onDragExit(event, session);
  },
  
  onDrop: function lp_onDrop(event, xfer, session) {    
    var item = this.dnd.onDrop(event, xfer, session);
    if (isValidLinkpadItem(item))
      this.lpService.createItem(item.URL, item.title, 0);
    event.stopPropagation();
  },

  getSupportedFlavours: function lp_getSupportedFavours() {
    return this.dnd.getFlavours();
  }
};