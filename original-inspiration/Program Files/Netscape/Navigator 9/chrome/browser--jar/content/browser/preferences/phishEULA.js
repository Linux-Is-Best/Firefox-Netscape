//@line 38 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/phishEULA.js"

/**
 * gPhishDialog controls the user interface for displaying the privacy policy of
 * an anti-phishing provider. 
 * 
 * The caller (gSecurityPane._userAgreedToPhishingEULA in main.js) invokes this
 * dialog with a single argument - a reference to an object with .providerNum
 * and .userAgreed properties.  This code displays the dialog for the provider
 * as dictated by .providerNum and loads the policy.  When that load finishes,
 * the OK button is enabled and the user can either accept or decline the
 * agreement (a choice which is communicated by setting .userAgreed to true if
 * the user did indeed agree).
 */ 
var gPhishDialog = {
  /**
   * The nsIWebProgress object associated with the privacy policy frame.
   */
  _webProgress: null,

  /**
   * Initializes UI and starts the privacy policy loading.
   */
  init: function ()
  {
    const Cc = Components.classes, Ci = Components.interfaces;

    var providerNum = window.arguments[0].providerNum;

    var phishBefore = document.getElementById("phishBefore");

    var prefb = Cc["@mozilla.org/preferences-service;1"].
                getService(Ci.nsIPrefService).
                getBranch("browser.safebrowsing.provider.");

    // init before-frame and after-frame strings
    // note that description only wraps when the string is the element's
    // *content* and *not* when it's the value attribute
    var providerName = prefb.getComplexValue(providerNum + ".name", Ci.nsISupportsString).data
    var strings = document.getElementById("bundle_phish");
    phishBefore.textContent = strings.getFormattedString("phishBeforeText", [providerName]);

    // guaranteed to be present, because only providers with privacy policies
    // are displayed in the prefwindow
    var formatter = Cc["@mozilla.org/toolkit/URLFormatterService;1"].
                    getService(Ci.nsIURLFormatter);
    var privacyURL = formatter.formatURLPref("browser.safebrowsing.provider." +
                                             providerNum +
                                             ".privacy.url",
                                             null);
    var fallbackURL = formatter.formatURLPref("browser.safebrowsing.provider." +
                                              providerNum +
                                              ".privacy.fallbackurl",
                                              null);
    this._progressListener._providerFallbackURL = fallbackURL;

    // add progress listener to enable OK, radios when page loads
    var frame = document.getElementById("phishPolicyFrame");
    var webProgress = frame.docShell
                           .QueryInterface(Ci.nsIInterfaceRequestor)
                           .getInterface(Ci.nsIWebProgress);
    webProgress.addProgressListener(this._progressListener,
                                    Ci.nsIWebProgress.NOTIFY_STATE_WINDOW);

    this._webProgress = webProgress; // for easy use later

    // start loading the privacyURL
    const loadFlags = Ci.nsIWebNavigation.LOAD_FLAGS_NONE;
    frame.webNavigation.loadURI(privacyURL, loadFlags, null, null, null);
  },

  /**
   * The nsIWebProgressListener used to watch the status of the load of the
   * privacy policy; enables the OK button when the load completes.
   */
  _progressListener:
  {
    /**
     * First we try to load the provider url (possibly remote). If that fails
     * to load, we try to load the provider fallback url (must be chrome://).
     * If that also fails, we display an error message.
     */
    _providerLoadFailed: false,
    _providerFallbackLoadFailed: false,
    
    _tryLoad: function(url) {
      const Ci = Components.interfaces;
      const loadFlags = Ci.nsIWebNavigation.LOAD_FLAGS_NONE;
      var frame = document.getElementById("phishPolicyFrame");
      frame.webNavigation.loadURI(url, loadFlags, null, null, null);
    },

    onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus)
    {
      // enable the OK button when the request completes
      const Ci = Components.interfaces, Cr = Components.results;
      if ((aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) &&
          (aStateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW)) {
        
        if (Components.isSuccessCode(aRequest.status)) {
          try {
            aRequest.QueryInterface(Ci.nsIHttpChannel);
          } catch (e) {
            // Not an http request url (might be, e.g., chrome:) that loaded
            // successfully, so we can exit.
            return;
          }

          // Any response other than 200 OK is an error.
          if (200 == aRequest.responseStatus)
            return;
        }

        // Something failed
        if (!this._providerLoadFailed) {
          this._provderLoadFailed = true;
          // Remote EULA failed to load; try loading provider fallback
          this._tryLoad(this._providerFallbackURL);
        } else if (!this._providerFallbackLoadFailed) {
          // Provider fallback failed to load; try loading fallback EULA
          this._providerFallbackLoadFailed = true;

          // fire off a load of the fallback policy
          const fallbackURL = "chrome://browser/content/preferences/fallbackEULA.xhtml";
          this._tryLoad(fallbackURL);

          // disable radios
          document.getElementById("acceptOrDecline").disabled = true;
        } else {
          throw "Fallback policy failed to load -- what the hay!?!";
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
   * Signals that the user accepted the privacy policy by setting the window
   * arguments appropriately.  Note that this does *not* change preferences;
   * the opener of this dialog handles that.
   */
  accept: function ()
  {
    window.arguments[0].userAgreed = true;
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
  onchangeRadio: function ()
  {
    var radio = document.getElementById("acceptOrDecline");
    document.documentElement.getButton("accept").disabled = (radio.value == "false");
  }
};
