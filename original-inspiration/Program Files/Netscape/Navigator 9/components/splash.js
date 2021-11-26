const SPLASH_CMDLINE_CONTRACTID    = "@mozilla.org/commandlinehandler/general-startup;1?type=splash";
const SPLASH_CMDLINE_CLSID         = Components.ID('{D00F48F6-4B49-11DC-9531-EC7356D89593}');
const CATMAN_CONTRACTID            = "@mozilla.org/categorymanager;1";
const nsISupports                  = Components.interfaces.nsISupports;

const nsICategoryManager           = Components.interfaces.nsICategoryManager;
const nsICmdLineHandler            = Components.interfaces.nsICmdLineHandler;
const nsICommandLine               = Components.interfaces.nsICommandLine;
const nsICommandLineHandler        = Components.interfaces.nsICommandLineHandler;
const nsIComponentRegistrar        = Components.interfaces.nsIComponentRegistrar;
const nsISupportsString            = Components.interfaces.nsISupportsString;
const nsIWindowWatcher             = Components.interfaces.nsIWindowWatcher;

function SplashCmdLineHandler() {}

SplashCmdLineHandler.prototype = {
  firstTime: true,
  
  /* nsISupports */
  QueryInterface : function handler_QI(iid) {
    if (iid.equals(nsISupports))
      return this;

    if (nsICommandLineHandler && iid.equals(nsICommandLineHandler))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  /* nsICmdLineHandler */
  commandLineArgument : "",
  chromeUrlForTask : "chrome://browser/content/splash.xul",
  helpText : "Start with Splash.",
  handlesArgs : true,
  defaultArgs : "",
  openWindowWithArgs : true,

  /* nsICommandLineHandler */
  handle : function handler_handle(cmdLine) {
	var showSplash = false;
	
	if (this.firstTime) {
		// There are two cases in which to show the splash screen:
		// 1) browser.startup.splashscreen is set to True
		// 2) The -splash flag is included in the command line arguments
		// But don't show the splash screen if Navigator was invoked by 
		// an external URL
		if (cmdLine.findFlag("url", false) == -1){
			if (Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("browser.startup.").getBoolPref("splashscreen")){
				showSplash = true;
			}
			else if (cmdLine.findFlag("splash", false) != -1){
				showSplash = true;
			}
		}
	}
	
	if (showSplash){
		var wwatch = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(nsIWindowWatcher);
		wwatch.openWindow(null, this.chromeUrlForTask, "_blank", "chrome,centerscreen,alwaysRaised=yes,titlebar=no,modal=yes,popup=yes", null);
		this.firstTime = false;
	}
  },

  helpInfo : "  Splash \n"
};

var SplashCmdLineFactory = {
  createInstance : function(outer, iid) {
    if (outer != null) {
      throw Components.results.NS_ERROR_NO_AGGREGATION;
    }

    return new SplashCmdLineHandler().QueryInterface(iid);
  }
};


var SplashCmdLineModule = {
  registerSelf: function(compMgr, fileSpec, location, type) {
    compMgr = compMgr.QueryInterface(nsIComponentRegistrar);

    compMgr.registerFactoryLocation(SPLASH_CMDLINE_CLSID,
                                    "Splash CommandLine Service",
                                    SPLASH_CMDLINE_CONTRACTID,
                                    fileSpec,
                                    location,
                                    type);

    var catman = Components.classes[CATMAN_CONTRACTID].getService(nsICategoryManager);
    catman.addCategoryEntry("command-line-argument-handlers",
                            "splash command line handler",
                            SPLASH_CMDLINE_CONTRACTID, true, true);
    catman.addCategoryEntry("command-line-handler",
                            "k-splash",
                            SPLASH_CMDLINE_CONTRACTID, true, true);
  },

  unregisterSelf: function(compMgr, fileSpec, location) {
    compMgr = compMgr.QueryInterface(nsIComponentRegistrar);

    compMgr.unregisterFactoryLocation(SPLASH_CMDLINE_CLSID, fileSpec);
    catman = Components.classes[CATMAN_CONTRACTID].getService(nsICategoryManager);
    catman.deleteCategoryEntry("command-line-argument-handlers",
                               "splash command line handler", true);
    catman.deleteCategoryEntry("command-line-handler",
                               "k-splash", true);
  },

  getClassObject: function(compMgr, cid, iid) {
    if (cid.equals(SPLASH_CMDLINE_CLSID)) {
      return SplashCmdLineFactory;
    }

    if (!iid.equals(Components.interfaces.nsIFactory)) {
      throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    }

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  canUnload: function(compMgr) {
    return true;
  }
};

function NSGetModule(compMgr, fileSpec) {
  return SplashCmdLineModule;
}

