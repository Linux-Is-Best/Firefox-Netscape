/*******************************************************************************
 * Quick access to the Components object.
 ******************************************************************************/
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
/*******************************************************************************
 * Component definition.
 ******************************************************************************/
const CACHE_CLASSNAME = "Netscape Expiring Cache";
const CACHE_CLASSID = Components.ID("{ac16f41b-a841-1e4e-b3c9-c791ddf50947}");
const CACHE_CONTRACTID = "@netscape.com/cache/expiring;1";
/*******************************************************************************
 * Contract IDs.
 ******************************************************************************/
const TIMER_CONTRACTID = "@mozilla.org/timer;1";
/*******************************************************************************
 * Observer topics
 ******************************************************************************/
const TOPIC_TIMER = "timer-callback";
/*******************************************************************************
 * Constants
 ******************************************************************************/
const DEFAULT_SEC = 1000;                                    // 1 second
const DEFAULT_MIN = 60*DEFAULT_SEC;                          // 1 minute
const CACHE_PURGE = DEFAULT_MIN*10;                          // purge 10 minutes
const CACHE_FILL = 0.80;                                     // 80% of the size
/*******************************************************************************
 * Object used to store values in the expiring cache.
 *
 * @param     key            The key used to store the object in the cache.
 * @param     value          Value to store in the cache.
 ******************************************************************************/
function CacheItem(key, value) {

  this.key = key;

  this.value = value;

  this.updateAccessed();
}
CacheItem.prototype = {

  _key: null,
  get key() { return this._key; },
  set key(val) { this._key = val; },

  _value: null,
  get value() { return this._value; },
  set value(val) { this._value = val; },

  _lastAccessed: null,
  get lastAccessed() { return this._lastAccessed; },
  set lastAccessed(val) { this._lastAccessed = val; },

  updateAccessed: function ci_updateAccessed() {
    this.lastAccessed = (new Date()).getTime();
  }
};
/*******************************************************************************
 * Interface used to store an item in memory for a finite amount of time.  A
 * maximum size and percentage of fill can be specified to limit the amount of
 * data stored.
 * 
 * @version   1.0
 ******************************************************************************/
function Cache() {}
Cache.prototype = {
  _timer: null,
  _items: null,
  
  // nsISupports
  QueryInterface: function Cache_QI(iid) {
    if (iid.equals(Ci.nsIExpiringCache) ||
        iid.equals(Ci.nsIObserver) ||
        iid.equals(Ci.nsISupports))
      return this;
    throw Cr.NS_ERROR_NO_INTERFACE; 
  },
  
  // nsIObserver
  observe: function Cache_observe(subject, topic, data) {
    if (topic != TOPIC_TIMER)
      return;
    this.purge();
  },
  
  init: function Cache_init(maxSize, expireRate, updateAccessed) {
    this.maxSize = maxSize;
    this.expireRate = expireRate;
    this.updateAccessed = updateAccessed;
    
    // create an object ot hold the key-values
    this._items = {};
    
    // startup the purge timer
    this._timer = Cc[TIMER_CONTRACTID].createInstance(Ci.nsITimer);
    this._timer.init(this, CACHE_PURGE, Ci.nsITimer.TYPE_REPEATING_SLACK);
  },
  
  destroy: function Cache_destroy() {
    
    // stop the timer
    this._timer.cancel();
    
    // remove the items
    this.clear();
    
    // cleanup the variables
    this.maxSize = null;
    this.expireRate = null;
    this._timer = null;
    this._items = null;
  },
  
  _maxSize: null,
  get maxSize() { return this._maxSize; },
  set maxSize(val) { this._maxSize = val; },
  
  _expireRate: null,
  get expireRate() { return this._expireRate; },
  set expireRate(val) { this._expireRate = val; },
  
  _updateAccessed: null,
  get updateAccessed() { return this._updateAccessed; },
  set updateAccessed(val) { this._updateAccessed = val; },
    
  hasKey: function Cache_hasKey(key) {
    if (this._items.hasOwnProperty(key)) {
      if (this.updateAccessed)
        this._items[key].updateAccessed();
      return true;
    }
    return false;
  },

  getKeys: function Cache_getKeys(count) {
    var keys = [];
    for (var key in this._items)
      keys.push(key);
    
    keys.sort();
    
    count.value = keys.length;
    return keys;
  },
    
  getValue: function Cache_getValue(key) {

    // return null if we do not have the item
    if (!this.hasKey(key))
      return null;
      
    // return the item
    return this._items[key].value;
  },
  
  setValue: function Cache_setValue(key, value) {
    var item = new CacheItem(key, value);
    this._items[key] = item;  
  },
  
  deleteValue: function Cache_deleteValue(key) {
    
    // return early if key not stored
    if (!this.hasKey(key))
      return;
    
    // remove the item
    delete this._items[key];  
  },

  clear: function Cache_clear() {
    var keys = this.getKeys({});
    for (var i=0; i<keys.length; i++)
      this.deleteValue(keys[i]);
  },
  
  purge: function Cache_purge() {
    var purgeSize = this.maxSize * CACHE_FILL;
    var temp = [];

    

    // loop through the cache, expire items that should be expired
    // otherwise, add the item to an array
    for (var key in this._items) {
        var item = this._items[key];
        if (this._isExpired(item)) 
          this.deleteValue(key);
        else
          temp.push(item);
    }

    // no max
    if (this.maxSize < 0)
      return;
      
    // if we have more items than the max size of the cache remove the oldest
    if (temp.length > this.maxSize) {

      // sort this array last accessed date
      temp = temp.sort(function(a, b) { return b.lastAccessed - a.lastAccessed; });       

      // remove items from the end of the array
      while (temp.length > purgeSize) {
        var ritem = temp.pop();
        this.deleteValue(ritem.key);
      }
    }   
  },
  
  _isExpired: function Cache__isExpired(item) {
    var now = (new Date()).getTime();
    var expires = item.lastAccessed + this.expireRate;
    if (expires < now)
      return true;
    return false;
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
    
    if (cid.equals(CACHE_CLASSID))
      return new GenericFactory(Cache);
          
    throw Cr.NS_ERROR_NO_INTERFACE;
  },

  registerSelf: function mod_registerSelf(cm, file, location, type) {
    var cr = cm.QueryInterface(Ci.nsIComponentRegistrar);  
    cr.registerFactoryLocation(CACHE_CLASSID, CACHE_CLASSNAME, CACHE_CONTRACTID,
                               file, location, type);                                                                                      
  },

  unregisterSelf: function mod_unregisterSelf(cm, location, type) {
    var cr = cm.QueryInterface(Ci.nsIComponentRegistrar);
    cr.unregisterFactoryLocation(CACHE_CLASSID, location);
  },

  canUnload: function mod_canUnload(cm) { return true; }
};
/*******************************************************************************
 * Entry point used to retrieve the module object.
 ******************************************************************************/
function NSGetModule(cm, file) { return Module; }     