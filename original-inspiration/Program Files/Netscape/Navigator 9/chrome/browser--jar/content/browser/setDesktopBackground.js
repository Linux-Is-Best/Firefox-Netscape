//@line 38 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/shell/content/setDesktopBackground.js"

const kXUL_NS            = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const kIShellService    = Components.interfaces.nsIShellService;
//@line 44 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/shell/content/setDesktopBackground.js"

var gSetBackground = {
  _position         : kIShellService.BACKGROUND_STRETCH,
  _monitor          : null,
  _image            : null,
  _backgroundColor  : 0,

//@line 52 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/shell/content/setDesktopBackground.js"
  // Converts a color string in the format "#RRGGBB" to an integer.
  _hexStringToLong: function (aString)
  {
    return parseInt(aString.substring(1,3), 16) << 16 | 
           parseInt(aString.substring(3,5), 16) << 8 |
           parseInt(aString.substring(5,7), 16);
  },
  
  _rgbToHex: function(aR, aG, aB) 
  {
    var rHex = aR.toString(16).toUpperCase();
    var gHex = aG.toString(16).toUpperCase();
    var bHex = aB.toString(16).toUpperCase();

    if (rHex.length == 1) rHex ='0' + rHex;
    if (gHex.length == 1) gHex ='0' + gHex;
    if (bHex.length == 1) bHex ='0' + bHex;

    return '#' + rHex + gHex + bHex;
  },
//@line 73 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/shell/content/setDesktopBackground.js"

  get _shell()
  {
    return Components.classes["@mozilla.org/browser/shell-service;1"]
                     .getService(Components.interfaces.nsIShellService);
  },

  load: function ()
  {
    this._monitor = document.getElementById("monitor");
//@line 86 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/shell/content/setDesktopBackground.js"
    this.init(window.arguments[0]);
  },
        
  init: function (aImage)
  {
    this._image = aImage;
 
//@line 94 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/shell/content/setDesktopBackground.js"
    this._initColor();
    var position = parseInt(document.getElementById("menuPosition").value);
//@line 110 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/shell/content/setDesktopBackground.js"
    this.updatePosition(position);
  },
        
//@line 114 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/shell/content/setDesktopBackground.js"
  _initColor: function ()
  {
    var color = this._shell.desktopBackgroundColor;

    const rMask = 4294901760;
    const gMask = 65280;
    const bMask = 255;
    var r = (color & rMask) >> 16;
    var g = (color & gMask) >> 8;
    var b = (color & bMask);
    this._backgroundColor = this._rgbToHex(r, g, b);

    var colorpicker = document.getElementById("desktopColor");
    colorpicker.color = this._rgbToHex(r, g, b);
  },
//@line 130 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/shell/content/setDesktopBackground.js"

  observe: function (aSubject, aTopic, aData)
  {
    if (aTopic == "shell:desktop-background-changed") {
      var setDesktopBackground = document.getElementById("setDesktopBackground");
      setDesktopBackground.hidden = true;
      
      var showDesktopPreferences = document.getElementById("showDesktopPreferences");
      showDesktopPreferences.hidden = false;

      var os = Components.classes["@mozilla.org/observer-service;1"]
                         .getService(Components.interfaces.nsIObserverService);
      os.removeObserver(this, "shell:desktop-background-changed");
    }
  },

//@line 166 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/shell/content/setDesktopBackground.js"
  setDesktopBackground: function () 
  {
    this._shell.setDesktopBackground(this._image, this._position);
    this._shell.desktopBackgroundColor = this._hexStringToLong(this._backgroundColor);
    document.persist("menuPosition", "value");
  },
//@line 173 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/shell/content/setDesktopBackground.js"

  updateColor: function (color)
  {
//@line 177 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/shell/content/setDesktopBackground.js"
    this._backgroundColor = color;
    
    if (this._position != kIShellService.BACKGROUND_TILE)
      this._monitor.style.backgroundColor = color;
//@line 182 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/shell/content/setDesktopBackground.js"
  },
  
  updatePosition: function (aPosition)
  {
    if (this._monitor.childNodes.length)
      this._monitor.removeChild(this._monitor.firstChild);
      
    this._position = aPosition;
    if (this._position == kIShellService.BACKGROUND_TILE)
      this._tileImage();
    else if (this._position == kIShellService.BACKGROUND_STRETCH)
      this._stretchImage();
    else
      this._centerImage();
  },

  _createImage: function ()
  {
    const nsIImageLoadingContent = Components.interfaces.nsIImageLoadingContent;
    if (!(this._image instanceof nsIImageLoadingContent))
        return false;

    var request = this._image.QueryInterface(nsIImageLoadingContent)
                             .getRequest(nsIImageLoadingContent.CURRENT_REQUEST);
    if (!request)
      return false;

    var imgURI = this._image.currentURI;
    if (imgURI.schemeIs("javascript"))
      return false;

    var img = document.createElementNS(kXUL_NS, "image");
    img.setAttribute("src", imgURI.spec);
    return img;
  },
        
  _stretchImage: function ()
  {  
    this.updateColor(this._backgroundColor);

    var img = this._createImage();
    img.width = parseInt(this._monitor.style.width);
    img.height = parseInt(this._monitor.style.height);
    this._monitor.appendChild(img);
  },
        
  _tileImage: function ()
  {
    var bundle = document.getElementById("backgroundBundle");

    this._monitor.style.backgroundColor = "white";

    var text = document.createElementNS(kXUL_NS, "label");
    text.setAttribute("id", "noPreviewAvailable");
    text.setAttribute("value", bundle.getString("DesktopBackgroundNoPreview"));
    this._monitor.appendChild(text);
  },
        
  _centerImage: function ()
  {
    this.updateColor(this._backgroundColor);
             
    var img = this._createImage();
    // Use naturalHeight/Width here so we don't scale an image improperly in
    // the preview window if the image is resized in the browser window.
    var width = this._image.naturalWidth * this._monitor.boxObject.width / screen.width;
    var height = this._image.naturalHeight * this._monitor.boxObject.height / screen.height;
    img.width = Math.floor(width);
    img.height = Math.floor(height);
    this._monitor.appendChild(img);
  }
};
