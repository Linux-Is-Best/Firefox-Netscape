//@line 39 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/EULA.js"

var gEULADialog = {
  /**
   * The nsIWebProgress object associated with the privacy policy frame.
   */
  _webProgress: null,

  /**
   * Initializes UI and starts the privacy policy loading.
   */
  init: function ()
  {
    sizeToContent();
    const Cc = Components.classes, Ci = Components.interfaces;

    // add progress listener to enable OK, radios when page loads
    var frame = document.getElementById("EULATextFrame");
    var webProgress = frame.docShell
                           .QueryInterface(Ci.nsIInterfaceRequestor)
                           .getInterface(Ci.nsIWebProgress);
    webProgress.addProgressListener(this._progressListener,
                                    Ci.nsIWebProgress.NOTIFY_STATE_WINDOW);

    this._webProgress = webProgress; // for easy use later

    var eulaURL = "chrome://browser/content/EULA.xhtml";

    // start loading the privacyURL
    const loadFlags = Ci.nsIWebNavigation.LOAD_FLAGS_NONE;
    frame.webNavigation.loadURI(eulaURL, loadFlags, null, null, null);

  },

  /**
   * The nsIWebProgressListener used to watch the status of the load of the
   * privacy policy; enables the OK button when the load completes.
   */
  _progressListener:
  {
    /**
     * True if we tried loading the first URL and encountered a failure.
     */
    _loadFailed: false,

    onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus)
    {
      // enable the OK button when the request completes
      const Ci = Components.interfaces, Cr = Components.results;
      if ((aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) &&
          (aStateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW)) {
        // check for failure
        if (!Components.isSuccessCode(aRequest.status)) {
          if (!this._loadFailed) {
            this._loadFailed = true;

            // fire off a load of the fallback policy
            const loadFlags = Ci.nsIWebNavigation.LOAD_FLAGS_NONE;
            const fallbackURL = "chrome://browser/content/preferences/fallbackEULA.xhtml";
            var frame = document.getElementById("EULATextFrame");
            frame.webNavigation.loadURI(fallbackURL, loadFlags, null, null, null);

            // disable radios
            document.getElementById("acceptOrDecline").disabled = true;
          }
          else {
            throw "Fallback policy failed to load -- what the hay!?!";
          }
        }
      }
    },
    
    onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress,
                               aMaxSelfProgress, aCurTotalProgress,
                               aMaxTotalProgress)
    {
    },

    onStatusChange : function(aWebProgress, aRequest, aStatus, aMessage)
    {
    },

    QueryInterface : function(aIID)
    {
      const Ci = Components.interfaces;
      if (aIID.equals(Ci.nsIWebProgressListener) ||
          aIID.equals(Ci.nsISupportsWeakReference) ||
          aIID.equals(Ci.nsISupports))
        return this;
      throw Components.results.NS_NOINTERFACE;
    }
  },

  /**
   * Make sure we set the pref on acceptance so we don't show the EULA again
   */
  accept: function ()
  {
    var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch);
    var EULAVersion = prefService.getIntPref("browser.EULA.version");
    prefService.setBoolPref("browser.EULA." + EULAVersion + ".accepted", true);
  },

  /**
   * If the user did not accept the EULA, kill the app.
   */
  cancel: function ()
  {
    const appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1']
                                 .getService(Components.interfaces.nsIAppStartup);
    appStartup.quit(appStartup.eForceQuit);
  },

  /**
   * Clean up any XPCOM-JS cycles we may have created.
   */
  uninit: function ()
  {
    // overly aggressive, but better safe than sorry
    this._webProgress.removeProgressListener(this._progressListener);
    this._progressListener = this._webProgress = null;
  },

  /**
   * Called when the user changes the agree/disagree radio.
   */
  onChangeRadio: function ()
  {
    var radio = document.getElementById("acceptOrDecline");
    document.documentElement.getButton("accept").disabled = (radio.value == "false");
  }
};
