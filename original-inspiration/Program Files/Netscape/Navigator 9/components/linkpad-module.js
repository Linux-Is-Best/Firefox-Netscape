/*******************************************************************************
 * Quick access to the Components object.
 ******************************************************************************/
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
/*******************************************************************************
 * Component definitions.
 ******************************************************************************/
const ITEM_CLASSNAME = "Netscape Link Pad Item";
const ITEM_CLASSID = Components.ID("{cf4d9c8c-b185-674d-a4bf-ac3a8c3516d3}");
const ITEM_CONTRACTID = "@netscape.com/linkpad/item;1";

const SERVICE_CLASSNAME = "Netscape Link Pad Service";
const SERVICE_CLASSID = Components.ID("{9c0f50e3-ab31-7d43-9ae6-67af64cf834b}");
const SERVICE_CONTRACTID = "@netscape.com/linkpad/service;1";
/*******************************************************************************
 * Contract IDs.
 ******************************************************************************/
const STORAGE_CONTRACTID = "@mozilla.org/storage/service;1"; 
const WRAPPER_CONTRACTID = "@mozilla.org/storage/statement-wrapper;1";
const ARRAY_CONTRACTID = "@mozilla.org/array;1";
const PREF_CONTRACTID = "@mozilla.org/preferences-service;1";
const DIR_CONTRACTID = "@mozilla.org/file/directory_service;1";
const IO_CONTRACTID = "@mozilla.org/network/io-service;1";
const OB_CONTRACTID = "@mozilla.org/observer-service;1";
/*******************************************************************************
 * Observer topics
 ******************************************************************************/
const TOPIC_DEFAULT = "netscape-linkpad";
const TOPIC_SHUTDOWN_XPCOM = "xpcom-shutdown";
/*******************************************************************************
 * LinkpadService values.
 ******************************************************************************/
const SERVICE_DIR = "ProfD";
const SERVICE_FILE = "linkpad.sqlite";
const SERVICE_TABLES = {
  items: "ID INTEGER PRIMARY KEY AUTOINCREMENT, URL TEXT, " + 
                  "title TEXT, sortIndex INTEGER"
};
const SERVICE_STMTS = {
  insertItem: "INSERT INTO items (URL, title, sortIndex) VALUES " +
              "(:URL, :title, :sortIndex)",
  updateItem: "UPDATE items SET URL = :URL, title = :title, " +
              "sortIndex = :sortIndex WHERE ID = :ID",
  removeItem: "DELETE FROM items WHERE ID = :ID",
  selectItems: "SELECT * FROM items ORDER BY sortIndex",
  clearItems: "DELETE FROM items"
};
const SERVICE_CREATE_ITEM = "createItem";
const SERVICE_UPDATE_ITEM = "updateItem";
const SERVICE_DELETE_ITEM = "deleteItem";
const SERVICE_CLEAR_ITEMS = "clearItems";
/*******************************************************************************
 * Helper function to create a mozIStorage statement wrappter that can be used 
 * to access the database.
 *
 * @param     conn           The database connection that the statement 
 *                           is applied to.
 * @param     sql            The sql statement that should be created.
 * @return                   The storage wrapper created.
 ******************************************************************************/
function createStatement(conn, sql) {
  var statement = conn.createStatement(sql);
  var rv = Cc[WRAPPER_CONTRACTID].
           createInstance(Ci.mozIStorageStatementWrapper);
  rv.initialize(statement);
  
  return rv;
}
/*******************************************************************************
 * Helper function to create an item component from a mozIStorage row.
 *
 * @param     row            The row containing the item data.
 * @return                   The created item.
 ******************************************************************************/
function createItemFromRow(row) {
  var rv = new LinkpadItem();
  
  rv.init(row.URL, row.ID, row.title, row.sortIndex);

  return rv;
}
/*******************************************************************************
 * Helper function to sort objects by sortIndex.
 ******************************************************************************/
function sorter(a, b) {
  if (a.sortIndex > b.sortIndex)
    return 1;
  else if (a.sortIndex == b.sortIndex)
    return 0;
  else
    return -1;
}
/*******************************************************************************
 * interfaced used to describe link items stored in the linkpad service.
 * 
 * @version   1.0
 ******************************************************************************/
function LinkpadItem() {}
LinkpadItem.prototype = {
  _URL: null,
  _ID: null,
  _title: null,
  _sortIndex: null,
  
  // nsISupports
  QueryInterface: function ITEM_QI(iid) {
    if (iid.equals(Ci.nsILinkpadItem) ||
        iid.equals(Ci.nsISupports))
      return this;
    throw Cr.NS_ERROR_NO_INTERFACE; 
  },
    
  // nsILinkpadItem  
  get URL() { return this._URL; },  
  get ID() { return this._ID; },
  get title() { return this._title; },
  
  get sortIndex() { return this._sortIndex; },
  set sortIndex(val) { this._sortIndex = val; },
    
  init: function ITEM_init(URL, ID, title, sortIndex) {
    this._URL = URL;
    this._ID = ID;
    this._title = title;
    this._sortIndex = sortIndex;
  },
  
  clone: function ITEM_clone() {
    var rv = new LinkpadItem();
    rv.init(this._URL, this._ID, this._title, this._sortIndex);
    return rv;
  }  
};
/*******************************************************************************
 * Service used to store URIs for later use.  URIs will be stored in an
 * sqlite database in fifo order and returned in the same order.
 * 
 * @version   1.0
 ******************************************************************************/
function LinkpadService() {
  this._load();
}
LinkpadService.prototype = { 
  _statements: null,
  _conn: null,
  _obs: null,
  _items: null,
    
  // nsISupports
  QueryInterface: function SERVICE_QI(iid) {
    if (iid.equals(Ci.nsILinkpadService) ||
        iid.equals(Ci.nsIObserver) ||
        iid.equals(Ci.nsISupports))
      return this;
    throw Cr.NS_ERROR_NO_INTERFACE; 
  },
  
  // nsIObserver
  observe: function SERVICE_observe(subject, topic, data) {
    switch (topic) {
    
    case TOPIC_SHUTDOWN_XPCOM:
      this._unloadFinal();
      break;
              
    default:
      return;
    }
  },
  
  // nsILinkpadService
  get databaseFile() { 
    if (!this._conn) 
      return null; 
    return this._conn.databaseFile; 
  },
   
  hasItem: function SERVICE_hasItem(ID) {
    return this._items.some(function(o) { return o.ID == ID; });
  },
  
  getItem: function SERVICE_getItem(ID) {
    if (!this.hasItem(ID))
      return null;
    return this._items.filter(function(o) { return o.ID == ID; }).shift();
  },
  
  getItems: function SERVICE_getItems() {
    var rv = Cc[ARRAY_CONTRACTID].createInstance(Ci.nsIMutableArray);      
      
    var index = 0;
    this._items.sort(sorter);
    while (index < this._items.length) {
      rv.appendElement(this._items[index], false);
      index++;
    }
    return rv.QueryInterface(Ci.nsIArray);
  },
  
  createItem: function SERVICE_createItem(URL, title, sortIndex) {
    var statement = this._statements["insertItem"];
    var params = statement.params;
  
    var newIndex = 0;
    if (sortIndex == newIndex) {
      if (this._items.length > 0) {
        this._items.sort(sorter);
        newIndex = this._items[this._items.length-1].sortIndex + 100;
      } else
        newIndex = 100;
    } else
      newIndex = sortIndex;

    params.URL = URL;
    params.title = title;     
    params.sortIndex = newIndex;
    statement.execute();
    
    var ID = this._conn.lastInsertRowID;
    
    var item = new LinkpadItem();
    item.init(URL, ID, title, newIndex);
    this._items[this._items.length] = item;
    this._items.sort(sorter);
    
    this._notify(item, SERVICE_CREATE_ITEM);
  },

  updateItem: function SERVICE_updateItem(item) {
    if (!this.hasItem(item.ID))
      return;
      
    var statement = this._statements["updateItem"];
    var params = statement.params;
    
    params.ID = item.ID;
    params.URL = item.URL;
    params.title = item.title;
    params.sortIndex = item.sortIndex;
    statement.execute();
    
    var items = this._items.filter(function(o) { return o.ID != ID; });
    this._items = items;
    this._items[this._items.length] = item.clone();
    this._items.sort(sorter);
    
    this._notify(item, SERVICE_UPDATE_ITEM);
  },
      
  deleteItem: function SERVICE_deleteItem(ID) {
    var item = this.getItem(ID);
    if (!item)
      return;

    var statement = this._statements["removeItem"]; 
    statement.params.ID = ID;
    statement.execute();
    
    var items = this._items.filter(function(o) { return o.ID != ID; });
    this._items = items;
    this._items.sort(sorter);
    
    this._notify(item, SERVICE_DELETE_ITEM);
  },

  clearItems: function SERVICE_clearItems() {
    var statement = this._statements["clearItems"]; 
    statement.execute();  
    this._items = [];
    
    this._notify(this, SERVICE_CLEAR_ITEMS);
  },
  
  compactDB: function SERVICE_compactDB() {
    if (this._conn.transactionInProgress)
      throw Cr.NS_ERROR_FAILURE;    
    this._conn.executeSimpleSQL("VACUUM");  
  },
    
  _load: function SERVICE__load() {
    
    // get observer service and add observers
    this._obs = Cc[OB_CONTRACTID].getService(Ci.nsIObserverService);
    this._obs.addObserver(this, TOPIC_SHUTDOWN_XPCOM, false);
    
    // setup empty cache
    this._items = [];
    
    // setup the database
    this._loadDB();
  },
  
  _loadDB: function SERVICE__loadDB() {
  
    // get the database file
    var dir = Cc[DIR_CONTRACTID].getService(Ci.nsIProperties);
    var file = dir.get(SERVICE_DIR, Ci.nsIFile);    
    file.append(SERVICE_FILE);
    
    // open a connection to the database
    var storage = Cc[STORAGE_CONTRACTID].getService(Ci.mozIStorageService);
    try {
      this._conn = storage.openDatabase(file);
    } catch(e) {
      
      // database is corrupt - remove and try again
      if (e.result == 0x805200b) {
        file.remove(false);
        this._conn = storage.openDatabase(file);
        
      // unknown error  
      } else
        throw e;
    }
    
    // create the table
    for (var name in SERVICE_TABLES) {
      if (!this._conn.tableExists(name))
      this._conn.createTable(name, SERVICE_TABLES[name]);
    }
    
    // create the needed statements
    this._statements = {};
    for (name in SERVICE_STMTS)
      this._statements[name] = createStatement(this._conn, SERVICE_STMTS[name]); 
    
    // load the cache
    var statement = this._statements["selectItems"];
    while (statement.step())
      this._items[this._items.length] = createItemFromRow(statement.row);  
    statement.reset();
  },
    
  _unloadFinal: function SERVICE__unloadFinal() {
         
    // remove observers
    this._obs.removeObserver(this, TOPIC_SHUTDOWN_XPCOM);    
    
    // remove variables
    this._statements = null;
    this._conn = null;
    this._obs = null;
    this._items = null;
  },
  
  _notify: function SERVICE__notify(subject, data) {
    try {
      this._obs.notifyObservers(subject, TOPIC_DEFAULT, data);
    } catch(e) {
      Components.utils.reportError(e);
    }
  }
};
/*******************************************************************************
 * Generic object used as a factory based on a passed in constructor.
 ******************************************************************************/
function GenericFactory(ctor) {
  this._ctor = ctor;
}  
GenericFactory.prototype = {
  _ctor: null,
  
  // nsISupports
  QueryInterface: function gf_QI(iid) {
    if (iid.equals(Ci.nsIFactory) ||
        iid.equals(Ci.nsISupports))
      return this;
    throw Cr.NS_ERROR_NO_INTERFACE; 
  },
  
  // nsIFactory
  createInstance: function gf_createInstance(outer, iid) {
    if (outer !== null)
      throw Cr.NS_ERROR_NO_AGGREGATION;
    return (new this._ctor()).QueryInterface(iid);
  },

  lockFactory: function gf_lockFactory(loc) {
    throw Cr.NS_ERROR_NOT_IMPLEMENTED;
  }
};
/*******************************************************************************
 * Object implementing the nsIModule interface.  This is used to retrieve 
 * the different components and services the module implements.
 ******************************************************************************/
var Module = {

  // nsISupports
  QueryInterface: function mod_QI(iid) {
    if (iid.equals(Ci.nsIModule) ||
        iid.equals(Ci.nsISupports))
      return this;
    throw Cr.NS_ERROR_NO_INTERFACE;
  },
  
  // nsIModule
  getClassObject: function mod_getClassObject(cm, cid, iid) {
    if (!iid.equals(Ci.nsIFactory))
      throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    
    if (cid.equals(ITEM_CLASSID))
      return new GenericFactory(LinkpadItem);
    else if (cid.equals(SERVICE_CLASSID))
      return new GenericFactory(LinkpadService);
          
    throw Cr.NS_ERROR_NO_INTERFACE;
  },

  registerSelf: function mod_registerSelf(cm, file, location, type) {
    var cr = cm.QueryInterface(Ci.nsIComponentRegistrar);  
    
    cr.registerFactoryLocation(ITEM_CLASSID, ITEM_CLASSNAME, ITEM_CONTRACTID,
                               file, location, type);
    cr.registerFactoryLocation(SERVICE_CLASSID, SERVICE_CLASSNAME, SERVICE_CONTRACTID,
                               file, location, type);                                                                                           
  },

  unregisterSelf: function mod_unregisterSelf(cm, location, type) {
    var cr = cm.QueryInterface(Ci.nsIComponentRegistrar);
    
    cr.unregisterFactoryLocation(ITEM_CLASSID, location);
    cr.unregisterFactoryLocation(SERVICE_CLASSID, location);
  },

  canUnload: function mod_canUnload(cm) { return true; }
};
/*******************************************************************************
 * Entry point used to retrieve the module object.
 ******************************************************************************/
function NSGetModule(cm, file) { return Module; }    