//@line 39 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/sanitize.js"

function Sanitizer() {}
Sanitizer.prototype = {
  // warning to the caller: this one may raise an exception (e.g. bug #265028)
  clearItem: function (aItemName)
  {
    if (this.items[aItemName].canClear)
      this.items[aItemName].clear();
  },

  canClearItem: function (aItemName)
  {
    return this.items[aItemName].canClear;
  },
  
  _prefDomain: "privacy.item.",
  getNameFromPreference: function (aPreferenceName)
  {
    return aPreferenceName.substr(this._prefDomain.length);
  },
  
  /**
   * Deletes privacy sensitive data in a batch, according to user preferences
   *
   * @returns  null if everything's fine;  an object in the form
   *           { itemName: error, ... } on (partial) failure
   */
  sanitize: function ()
  {
    var psvc = Components.classes["@mozilla.org/preferences-service;1"]
                         .getService(Components.interfaces.nsIPrefService);
    var branch = psvc.getBranch(this._prefDomain);
    var errors = null;
    for (var itemName in this.items) {
      var item = this.items[itemName];
      if ("clear" in item && item.canClear && branch.getBoolPref(itemName)) {
        // Some of these clear() may raise exceptions (see bug #265028)
        // to sanitize as much as possible, we catch and store them, 
        // rather than fail fast.
        // Callers should check returned errors and give user feedback
        // about items that could not be sanitized
        try {
          item.clear();
        } catch(er) {
          if (!errors) 
            errors = {};
          errors[itemName] = er;
          dump("Error sanitizing " + itemName + ": " + er + "\n");
        }
      }
    }
    return errors;
  },
  
  items: {
    cache: {
      clear: function ()
      {
        const cc = Components.classes;
        const ci = Components.interfaces;
        var cacheService = cc["@mozilla.org/network/cache-service;1"]
                             .getService(ci.nsICacheService);
        try {
          cacheService.evictEntries(ci.nsICache.STORE_ANYWHERE);
        } catch(er) {}
      },
      
      get canClear()
      {
        return true;
      }
    },
    
    cookies: {
      clear: function ()
      {
        var cookieMgr = Components.classes["@mozilla.org/cookiemanager;1"]
                                  .getService(Components.interfaces.nsICookieManager);
        cookieMgr.removeAll();
      },
      
      get canClear()
      {
        return true;
      }
    },
    
    history: {
      clear: function ()
      {
        var globalHistory = Components.classes["@mozilla.org/browser/global-history;2"]
                                      .getService(Components.interfaces.nsIBrowserHistory);
        globalHistory.removeAllPages();
        
        try {
          var os = Components.classes["@mozilla.org/observer-service;1"]
                             .getService(Components.interfaces.nsIObserverService);
          os.notifyObservers(null, "browser:purge-session-history", "");
        }
        catch (e) { }
      },
      
      get canClear()
      {
        // bug 347231: Always allow clearing history due to dependencies on
        // the browser:purge-session-history notification. (like error console)
        return true;
      }
    },
    
    formdata: {
      clear: function ()
      {
        //Clear undo history of all searchBars
        var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService();
        var windowManagerInterface = windowManager.QueryInterface(Components.interfaces.nsIWindowMediator);
        var windows = windowManagerInterface.getEnumerator("navigator:browser");
        while (windows.hasMoreElements()) {
          var searchBar = windows.getNext().document.getElementById("searchbar");
          if (searchBar) {
            searchBar.value = "";
            searchBar.textbox.editor.enableUndo(false);
            searchBar.textbox.editor.enableUndo(true);
          }
        }

        var formHistory = Components.classes["@mozilla.org/satchel/form-history;1"]
                                    .getService(Components.interfaces.nsIFormHistory2);
        formHistory.removeAllEntries();
      },
      
      get canClear()
      {
        var formHistory = Components.classes["@mozilla.org/satchel/form-history;1"]
                                    .getService(Components.interfaces.nsIFormHistory2);
        return formHistory.hasEntries;
      }
    },
    
    downloads: {
      clear: function ()
      {
        var dlMgr = Components.classes["@mozilla.org/download-manager;1"]
                              .getService(Components.interfaces.nsIDownloadManager);
        dlMgr.cleanUp();
      },

      get canClear()
      {
        var dlMgr = Components.classes["@mozilla.org/download-manager;1"]
                              .getService(Components.interfaces.nsIDownloadManager);
        return dlMgr.canCleanUp;
      }
    },
    
    passwords: {
      clear: function ()
      {
        var pwmgr = Components.classes["@mozilla.org/passwordmanager;1"]
                              .getService(Components.interfaces.nsIPasswordManager);
        var e = pwmgr.enumerator;
        var passwds = [];
        while (e.hasMoreElements()) {
          var passwd = e.getNext().QueryInterface(Components.interfaces.nsIPassword);
          passwds.push(passwd);
        }
        
        for (var i = 0; i < passwds.length; ++i)
          pwmgr.removeUser(passwds[i].host, passwds[i].user);
      },
      
      get canClear()
      {
        var pwmgr = Components.classes["@mozilla.org/passwordmanager;1"]
                              .getService(Components.interfaces.nsIPasswordManager);
        return pwmgr.enumerator.hasMoreElements();
      }
    },
    
    sessions: {
      clear: function ()
      {
        // clear all auth tokens
        var sdr = Components.classes["@mozilla.org/security/sdr;1"]
                            .getService(Components.interfaces.nsISecretDecoderRing);
        sdr.logoutAndTeardown();

        // clear plain HTTP auth sessions
        var authMgr = Components.classes['@mozilla.org/network/http-auth-manager;1']
                                .getService(Components.interfaces.nsIHttpAuthManager);
        authMgr.clearAll();
      },
      
      get canClear()
      {
        return true;
      }
    },
    
    linkpad: {
      clear: function ()
      {
        var lps = Components.classes["@netscape.com/linkpad/service;1"]
                            .getService(Components.interfaces.nsILinkpadService);
        lps.clearItems();
      },
      
      get canClear()
      {
        return true;
      }
    }
  }
};



// "Static" members
Sanitizer.prefDomain          = "privacy.sanitize.";
Sanitizer.prefPrompt          = "promptOnSanitize";
Sanitizer.prefShutdown        = "sanitizeOnShutdown";
Sanitizer.prefDidShutdown     = "didShutdownSanitize";

Sanitizer._prefs = null;
Sanitizer.__defineGetter__("prefs", function() 
{
  return Sanitizer._prefs ? Sanitizer._prefs
    : Sanitizer._prefs = Components.classes["@mozilla.org/preferences-service;1"]
                         .getService(Components.interfaces.nsIPrefService)
                         .getBranch(Sanitizer.prefDomain);
});

// Shows sanitization UI
Sanitizer.showUI = function(aParentWindow) 
{
  var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                     .getService(Components.interfaces.nsIWindowWatcher);
//@line 279 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/sanitize.js"
  ww.openWindow(aParentWindow,
//@line 281 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/sanitize.js"
                "chrome://browser/content/sanitize.xul",
                "Sanitize",
                "chrome,titlebar,centerscreen,modal",
                null);
};

/** 
 * Deletes privacy sensitive data in a batch, optionally showing the 
 * sanitize UI, according to user preferences
 *
 * @returns  null if everything's fine (no error or displayed UI,  which
 *           should handle errors);  
 *           an object in the form { itemName: error, ... } on (partial) failure
 */
Sanitizer.sanitize = function(aParentWindow) 
{
  if (Sanitizer.prefs.getBoolPref(Sanitizer.prefPrompt)) {
    Sanitizer.showUI(aParentWindow);
    return null;
  }
  return new Sanitizer().sanitize();
};

Sanitizer.onStartup = function() 
{
  // we check for unclean exit with pending sanitization
  Sanitizer._checkAndSanitize();
};

Sanitizer.onShutdown = function() 
{
  // we check if sanitization is needed and perform it
  Sanitizer._checkAndSanitize();
};

// this is called on startup and shutdown, to perform pending sanitizations
Sanitizer._checkAndSanitize = function() 
{
  const prefs = Sanitizer.prefs;
  if (prefs.getBoolPref(Sanitizer.prefShutdown) && 
      !prefs.prefHasUserValue(Sanitizer.prefDidShutdown)) {
    // this is a shutdown or a startup after an unclean exit
    Sanitizer.sanitize(null) || // sanitize() returns null on full success
      prefs.setBoolPref(Sanitizer.prefDidShutdown, true);
  }
};


