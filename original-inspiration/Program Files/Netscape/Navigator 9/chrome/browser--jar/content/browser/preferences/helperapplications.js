//@line 38 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/helperapplications.js"

var gRDF;

const kPluginHandlerContractID = "@mozilla.org/content/plugin/document-loader-factory;1";
const kDisabledPluginTypesPref = "plugin.disable_full_page_plugin_for_types";
const kRootTypePrefix = "urn:mimetype:";

///////////////////////////////////////////////////////////////////////////////
// MIME Types DataSource Wrapper

function NC_URI(aProperty)
{
  return "http://home.netscape.com/NC-rdf#" + aProperty;
}

function MIME_URI(aType)
{
  return "urn:mimetype:" + aType;
}

function HANDLER_URI(aHandler)
{
  return "urn:mimetype:handler:" + aHandler;
}

function APP_URI(aType)
{
  return "urn:mimetype:externalApplication:" + aType;
}

function ArrayEnumerator(aItems)
{
  this._index = 0;
  
  if (aItems) {
    for (var i = 0; i < aItems.length; ++i) {    
      if (!aItems[i])
        aItems.splice(i, 1);      
    }
  }
  
  this._contents = aItems || [];

  this.push = function (aElement) 
  {
    if (aElement)
      this._contents.push(aElement);
  };
  
  this.hasMoreElements = function ()
  {
    return this._index < this._contents.length;
  };
  
  this.getNext = function ()
  {
    return this._contents[this._index++];      
  };
};

function HelperApps()
{
  if (!gRDF) {
    gRDF = Components.classes["@mozilla.org/rdf/rdf-service;1"]
                     .getService(Components.interfaces.nsIRDFService);
  }
  
  const mimeTypes = "UMimTyp";
  var fileLocator = Components.classes["@mozilla.org/file/directory_service;1"]
                              .getService(Components.interfaces.nsIProperties);
  
  var file = fileLocator.get(mimeTypes, Components.interfaces.nsIFile);

  var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                            .getService(Components.interfaces.nsIIOService);
  var fileHandler = ioService.getProtocolHandler("file")
                             .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
  this._inner = gRDF.GetDataSourceBlocking(fileHandler.getURLSpecFromFile(file));
  this._inner.AddObserver(this);

  this._fileTypeArc         = gRDF.GetResource(NC_URI("FileType"));
  this._fileMimeTypeArc     = gRDF.GetResource(NC_URI("FileMIMEType"));
  this._fileHandlerArc      = gRDF.GetResource(NC_URI("FileHandler"));
  this._filePluginAvailable = gRDF.GetResource(NC_URI("FilePluginAvailable"));
  this._fileHandledByPlugin = gRDF.GetResource(NC_URI("FileHandledByPlugin"));
  this._fileIconArc         = gRDF.GetResource(NC_URI("FileIcon"));
  this._largeFileIconArc    = gRDF.GetResource(NC_URI("LargeFileIcon"));
  this._fileExtensionArc    = gRDF.GetResource(NC_URI("FileExtension"));
  this._fileExtensionsArc   = gRDF.GetResource(NC_URI("FileExtensions"));
  this._handleAutoArc       = gRDF.GetResource(NC_URI("FileHandleAuto"));
  this._valueArc            = gRDF.GetResource(NC_URI("value"));
  this._handlerPropArc      = gRDF.GetResource(NC_URI("handlerProp"));
  this._externalAppArc      = gRDF.GetResource(NC_URI("externalApplication"));
  this._childArc            = gRDF.GetResource(NC_URI("child"));
  this._mimeTypes           = gRDF.GetResource("urn:mimetypes");
  this._mimeTypesRoot       = gRDF.GetResource("urn:mimetypes:root");
  
  // Read enabled plugin type information from the category manager
  var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                        .getService(Components.interfaces.nsIPrefBranch);
  var disabled = "";
  if (prefs.prefHasUserValue(kDisabledPluginTypesPref)) 
    disabled = prefs.getCharPref(kDisabledPluginTypesPref);

  for (var i = 0; i < navigator.plugins.length; ++i) {
    var plugin = navigator.plugins[i];
    for (var j = 0; j < plugin.length; ++j) {
      var currType = plugin[j].type;
      this._availableTypes[currType] = { mimeURI: MIME_URI(currType),
                                         pluginAvailable: true,
                                         pluginEnabled: disabled.indexOf(currType) == -1 };
    }
  }
}

HelperApps.prototype = {
  _availableTypes: { },

  mimeHandlerExists: function (aMIMEType)
  {
    var valueProperty = gRDF.GetUnicodeResource(NC_URI("value"));
    var mimeSource = gRDF.GetUnicodeResource(MIME_URI(aMIMEType));
    var mimeLiteral = gRDF.GetLiteral(aMIMEType);
    return this._inner.HasAssertion(mimeSource, valueProperty, mimeLiteral, true);
  },

  updateTypeInfo: function (aMIMEInfo) 
  {
    var mimeType = aMIMEInfo.MIMEType;
    var isNewMIMEType = this.mimeHandlerExists(mimeType);
    var entry = new HandlerOverride(MIME_URI(mimeType), this._inner);
    entry.mimeType    = mimeType;
    entry.isEditable  = true;
    entry.alwaysAsk = aMIMEInfo.alwaysAskBeforeHandling;
    
    // If not updating (i.e., a newly encountered mime type),
    // then update extension list and description.
    if (!isNewMIMEType) {
      var extEnumerator = aMIMEInfo.getFileExtensions();
      while (extEnumerator.hasMore()) {
          entry.addExtension(extEnumerator.getNext());
      }
      entry.description = aMIMEInfo.description;
      entry.appDisplayName = "";
    }
    
    const nsIMIMEInfo = Components.interfaces.nsIMIMEInfo;
    if (aMIMEInfo.preferredAction == nsIMIMEInfo.saveToDisk) {
      entry.saveToDisk = true;
      if (!isNewMIMEType) {
        // Creating a new entry, set path.
        entry.appPath = "";
      }
    } 
    else if (aMIMEInfo.preferredAction == nsIMIMEInfo.useSystemDefault ||
             aMIMEInfo.preferredApplicationHandler == null) {
      entry.useSystemDefault = true;
      if (!isNewMIMEType) {
        // Creating a new entry, set path.
        entry.appPath = "";
      }
    } 
    else {
      entry.saveToDisk       = false;
      entry.useSystemDefault = false;
      entry.handleInternal   = false;
      entry.appPath = aMIMEInfo.preferredApplicationHandler.path;
      entry.appDisplayName = aMIMEInfo.applicationDescription;
    }
    
    // Do RDF magic.
    entry.buildLinks();
    this.flush();
  },

  getLiteralValue: function (aResource, aProperty)
  {
    var res = gRDF.GetResource(aResource);
    var prop = gRDF.GetResource(NC_URI(aProperty));
    var val = this.GetTarget(res, prop, true);
    if (val) {
      val = val.QueryInterface(Components.interfaces.nsIRDFLiteral);
      return val.Value;
    }
    return "";
  },
  
  enableFullPagePluginForType: function (aContentType, aEnabled)
  {
    this._availableTypes[aContentType].pluginEnabled = aEnabled;
  },

  /* nsIRDFDataSource */
  get URI() {
    return this._inner.URI;
  },
  
  GetSource: function (aProperty, aTarget, aTruthValue) {
    return this._inner.GetSource(aProperty, aTarget, aTruthValue);
  },
  GetSources: function (aProperty, aTarget, aTruthValue) {
    return this._inner.GetSources(aProperty, aTarget, aTruthValue);
  },         
  
  _isRootTypeResource: function (aResource) {
    aResource = aResource.QueryInterface(Components.interfaces.nsIRDFResource);  
    return (aResource.Value.substr(0, kRootTypePrefix.length) == kRootTypePrefix);
  },
  
  _getTypeFromResource: function (aResource) {
    var value = aResource.Value;
    return value.substr(kRootTypePrefix.length, value.length);
  },
  
  getMIMEInfo: function (aResource) {
    var types = this._inner.GetTarget(aResource, this._valueArc, true);
    var mimeSvc = Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"]
                            .getService(Components.interfaces.nsIMIMEService);
    if (types) {
      types = types.QueryInterface(Components.interfaces.nsIRDFLiteral);
      types = types.Value.split(", ");
      
      // We're using helper app service as our MIME Service here because the helper app service
      // talks to OS Specific hooks that on some platforms (MacOS X) are required to get a 
      // fully populated MIME Info object. Thus it is this object that we return. 
      return mimeSvc.getFromTypeAndExtension(types[0], null);
    }
    else {
      var type = this._getTypeFromResource(aResource);
      if (type in this._availableTypes && this._availableTypes[type].pluginAvailable)
        return mimeSvc.getFromTypeAndExtension(type, null);
    }
    
    return null;
  },
   
  GetTarget: function (aSource, aProperty, aTruthValue) {
    if (this._isRootTypeResource(aSource)) {
      var typeInfo = this.getMIMEInfo(aSource);
      if (typeInfo) {
        dump("*** " + aSource.Value + " p = " + aProperty.Value + "\n");
        var bundleUCT = document.getElementById("bundleUCT");
        if (aProperty.EqualsNode(this._handleAutoArc)) {
          var handler = this.GetTarget(aSource, this._handlerPropArc, true);
          if (handler) {
            dump("*** hashandler\n");
            handler = handler.QueryInterface(Components.interfaces.nsIRDFResource);
            return gRDF.GetLiteral(!(this.getLiteralValue(handler.Value, "alwaysAsk") == "true"));
          }
          dump("*** nohandler\n");
          return gRDF.GetLiteral("true");
        }
        else if (aProperty.EqualsNode(this._fileTypeArc)) {
          if (typeInfo.description == "") {
            try {
              var literal = bundleUCT.getFormattedString("fileEnding", [typeInfo.primaryExtension.toUpperCase()]);
              return gRDF.GetLiteral(literal);
            }
            catch (e) { 
              // Wow, this sucks, just show the MIME type as a last ditch effort to display
              // the type of file that this is. 
              return gRDF.GetLiteral(typeInfo.MIMEType);
            }
          }
          return gRDF.GetLiteral(typeInfo.description);
        }
        else if (aProperty.EqualsNode(this._fileMimeTypeArc))
          return gRDF.GetLiteral(typeInfo.MIMEType);
        else if (aProperty.EqualsNode(this._fileHandlerArc)) {
          // Look for a plugin handler first
          if (this._availableTypes[typeInfo.MIMEType].pluginAvailable && 
              this._availableTypes[typeInfo.MIMEType].pluginEnabled) {
            for (var i = 0; i < navigator.plugins.length; ++i) {
              var plugin = navigator.plugins[i];
              for (var j = 0; j < plugin.length; ++j) {
                if (typeInfo.MIMEType == plugin[j].type)
                  return gRDF.GetLiteral(bundleUCT.getFormattedString("openWith", [plugin.name]));
              }
            }
          }
          
          var handler = this.GetTarget(aSource, this._handlerPropArc, true);
          if (handler) {
            handler = handler.QueryInterface(Components.interfaces.nsIRDFResource);
            if (this.getLiteralValue(handler.Value, "saveToDisk") == "true") {
              var saveToDisk = bundleUCT.getString("saveToDisk");
              return gRDF.GetLiteral(saveToDisk);
            }
            else if (this.getLiteralValue(handler.Value, "useSystemDefault") == "false") {
              var extApp = this.GetTarget(handler, this._externalAppArc, true);
              if (extApp) {
                extApp = extApp.QueryInterface(Components.interfaces.nsIRDFResource);
                var openWith = bundleUCT.getFormattedString("openWith", [this.getLiteralValue(extApp.Value, "prettyName")]);
                return gRDF.GetLiteral(openWith);
              }
            }
          }     
          var openWith2 = bundleUCT.getFormattedString("openWith", [typeInfo.defaultDescription]);
          return gRDF.GetLiteral(openWith2);
        }
        else if (aProperty.EqualsNode(this._filePluginAvailable)) {
          var pluginAvailable = this._availableTypes[typeInfo.MIMEType].pluginAvailable;
          return gRDF.GetLiteral(pluginAvailable ? "true" : "false");
        }
        else if (aProperty.EqualsNode(this._fileHandledByPlugin)) {
          var handledByPlugin = (this._availableTypes[typeInfo.MIMEType].pluginAvailable && 
                                 this._availableTypes[typeInfo.MIMEType].pluginEnabled);
          return gRDF.GetLiteral(handledByPlugin ? "true" : "false");
        }
        else if (aProperty.EqualsNode(this._fileIconArc)) {
          try {
            return gRDF.GetLiteral("moz-icon://goat." + typeInfo.primaryExtension + "?size=16");
          }
          catch (e) { }
          return gRDF.GetLiteral("moz-icon://goat?size=16&contentType=" + typeInfo.MIMEType);
        }
        else if (aProperty.EqualsNode(this._largeFileIconArc)) {
          try {
            return gRDF.GetLiteral("moz-icon://goat." + typeInfo.primaryExtension + "?size=32");
          }
          catch (e) { }
          return gRDF.GetLiteral("moz-icon://goat?size=32&contentType=" + typeInfo.MIMEType);
        }
        else if (aProperty.EqualsNode(this._fileExtensionArc)) {
          try {
            return gRDF.GetLiteral(typeInfo.primaryExtension.toUpperCase());
          }
          catch (e) { }
          return gRDF.GetLiteral(bundleUCT.getString("extensionNone"));
        }
        else if (aProperty.EqualsNode(this._fileExtensionsArc)) {
          var extns = typeInfo.getFileExtensions();
          
          // Prevent duplicates.
          var hash = { };
          while (extns.hasMore())
            hash[extns.getNext().toUpperCase()] = 0;
          
          var str = "";
          for (var extn in hash)
            str += extn + ",";
          str = str.substring(0, str.length - 1);

          return gRDF.GetLiteral(str);
        }
      }
    }

    return this._inner.GetTarget(aSource, aProperty, aTruthValue);
  },      
  
  GetTargets: function (aSource, aProperty, aTruthValue) {
    if (this._isRootTypeResource(aSource)) { 
      return new ArrayEnumerator([this.GetTarget(aSource, aProperty, aTruthValue)]);
    }
    
    if (aSource.EqualsNode(this._mimeTypes)) {
      if (aProperty.EqualsNode(this._childArc)) {
        var ctr = Components.classes["@mozilla.org/rdf/container;1"]
                            .createInstance(Components.interfaces.nsIRDFContainer);
        ctr.Init(this._inner, this._mimeTypesRoot);
        var elements = ctr.GetElements();
        while (elements.hasMoreElements()) {
          var type = elements.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
          var mi = this.getMIMEInfo(type);
          if (!(mi.MIMEType in this._availableTypes)) {
            this._availableTypes[mi.MIMEType] = { mimeURI: MIME_URI(mi.MIMEType),
                                                  pluginAvailable: false,
                                                  pluginEnabled: false };
          }
        }
        var types = [];
        for (var type in this._availableTypes)
          types.push(gRDF.GetResource(this._availableTypes[type].mimeURI));
        return new ArrayEnumerator(types);
      }
      return new ArrayEnumerator([]);
    }
    
    return this._inner.GetTargets(aSource, aProperty, aTruthValue);
  }, 
  Assert: function (aSource, aProperty, aTarget, aTruthValue) {
    return this._inner.Assert(aSource, aProperty, aTarget, aTruthValue);
  },
  Unassert: function (aSource, aProperty, aTarget) {
    return this._inner.Unassert(aSource, aProperty, aTarget);
  },
  Change: function (aSource, aProperty, aOldTarget, aNewTarget) {
    if (aOldTarget)
      var ot = aOldTarget.QueryInterface(Components.interfaces.nsIRDFLiteral);
    if (aNewTarget)
      var nt = aNewTarget.QueryInterface(Components.interfaces.nsIRDFLiteral);

    return this._inner.Change(aSource, aProperty, aOldTarget, aNewTarget);
  },
  Move: function (aOldSource, aNewSource, aProperty, aTarget) {
    return this._inner.Assert(aOldSource, aNewSource, aProperty, aTarget);
  },
  HasAssertion: function (aSource, aProperty, aTarget, aTruthValue) {
    if (this._isRootTypeResource(aSource)) {
      // Don't show entries in the list for types that we DO NOT handle
      // automatically. i.e. this list is a means of editing and removing
      // automatic overrides only. 
      if (aProperty.EqualsNode(this._handleAutoArc)) {
        var handler = this.GetTarget(aSource, this._handlerPropArc, true);
        if (handler) {
          handler = handler.QueryInterface(Components.interfaces.nsIRDFResource);
          return !(this.getLiteralValue(handler.Value, "alwaysAsk") == "true");
        }
        else {
          // If there is no handler, at check to see if this type is handled
          // by a full-page plugin, and that that full page plugin mode is
          // enabled...
          var type = this._getTypeFromResource(aSource);
          if (type in this._availableTypes && 
              this._availableTypes[type].pluginAvailable && 
              type != "*" && type != "none")
            return true;
        } 
      }
    }
    return this._inner.HasAssertion(aSource, aProperty, aTarget, aTruthValue);
  },
  AddObserver: function (aObserver) {
    this._inner.AddObserver(aObserver);
  },
  RemoveObserver: function (aObserver) {
    this._inner.RemoveObserver(aObserver);
  },
  ArcLabelsIn: function (aNode) {
    return this._inner.ArcLabelsIn(aNode);
  },
  ArcLabelsOut: function (aNode) {
    return this._inner.ArcLabelsOut(aNode);
  },
  GetAllResources: function () {
    return this._inner.GetAllResources();
  },
  hasArcIn: function (aNode, aArc) {
    return this._inner.hasArcIn(aNode, aArc);
  },
  hasArcOut: function (aNode, aArc) {
    return this._inner.hasArcOut(aNode, aArc);
  },
  
  _observers: [],
  AddObserver: function (aObserver) {
    this._observers.push(aObserver);
  },
  
  RemoveObserver: function (aObserver) {
    for (var i = 0; i < this._observers.length; ++i) {
      if (this._observers[i] == aObserver) {
        this._observers.splice(i, 1);
        break;
      }
    }
  },
  
  onAssert: function (aDataSource, aSource, aProperty, aTarget) {
    for (var i = 0; i < this._observers.length; ++i)
      this._observers[i].onAssert(aDataSource, aSource, aProperty, aTarget);
  },

  onUnassert: function (aDataSource, aSource, aProperty, aTarget) {
    for (var i = 0; i < this._observers.length; ++i)
      this._observers[i].onUnassert(aDataSource, aSource, aProperty, aTarget);
  },
  
  onChange: function (aDataSource, aSource, aProperty, aOldTarget, aNewTarget) {
    for (var i = 0; i < this._observers.length; ++i)
      this._observers[i].onChange(aDataSource, aSource, aProperty, aOldTarget, aNewTarget);
  },
  
  onMove: function (aDataSource, aOldSource, aNewSource, aProperty, aTarget) {
    for (var i = 0; i < this._observers.length; ++i)
      this._observers[i].onMove(aDataSource, aOldSource, aNewSource, aProperty, aTarget);
  },
  
  beginUpdateBatch: function (aDataSource) {
    for (var i = 0; i < this._observers.length; ++i)
      this._observers[i].beginUpdateBatch(aDataSource);
  },
  
  endUpdateBatch: function (aDataSource) {
    for (var i = 0; i < this._observers.length; ++i)
      this._observers[i].endUpdateBatch(aDataSource);
  },

  flush: function () {
    var rds = this._inner.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource);
    if (rds) 
      rds.Flush();
  },
  
  destroy: function () {
    this._inner.RemoveObserver(this);
  },
  
  QueryInterface: function nsExtensionManager_QueryInterface (aIID) 
  {
    if (!aIID.equals(Components.interfaces.nsIRDFRemoteDataSource) &&
        !aIID.equals(Components.interfaces.nsIRDFDataSource) &&
        !aIID.equals(Components.interfaces.nsIRDFObserver) &&
        !aIID.equals(Components.interfaces.nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }  
};

/**
 * Handler Override class
 **/
function HandlerOverride(aURI, aDatasource)
{
  this.URI = aURI;
  this._DS = aDatasource;
}

HandlerOverride.prototype = {
  // general information
  get mimeType()
  {
    return this.getLiteralForContentType(this.URI, "value");
  },
  
  set mimeType(aMIMETypeString)
  {
    this.changeMIMEStuff(MIME_URI(aMIMETypeString), "value", aMIMETypeString.toLowerCase());
    return aMIMETypeString;
  },
  
  get description()
  {
    return this.getLiteralForContentType(this.URI, "description");
  },  
  
  set description(aDescriptionString)
  {
    this.changeMIMEStuff(MIME_URI(this.mimeType), "description", aDescriptionString);
    return aDescriptionString;
  },
  
  get isEditable()
  {
    return this.getLiteralForContentType(this.URI, "editable");
  },
  
  set isEditable(aIsEditableString)
  {
    this.changeMIMEStuff(MIME_URI(this.mimeType), "editable", aIsEditableString);
    return aIsEditableString;
  },

  get extensions()
  {
    var extensionResource = gRDF.GetUnicodeResource(NC_URI("fileExtensions"));
    var contentTypeResource = gRDF.GetUnicodeResource(MIME_URI(this.mimeType));
    var extensionTargets = this._DS.GetTargets(contentTypeResource, extensionResource, true);
    var extString = "";
    if (extensionTargets) {
      while (extensionTargets.hasMoreElements()) {
        var currentExtension = extensionTargets.getNext();
        if (currentExtension) {
          currentExtension = currentExtension.QueryInterface(Components.interfaces.nsIRDFLiteral);
          if (extString != "") {
            extString += " ";
          }
          extString += currentExtension.Value.toLowerCase();
        }
      }
    }
    return extString;
  },
  
  addExtension: function (aExtensionString)
  {
    this.assertMIMEStuff(MIME_URI(this.mimeType), "fileExtensions", aExtensionString.toLowerCase());
  },
  
  removeExtension: function (aExtensionString)
  {
    this.unassertMIMEStuff(MIME_URI(this.mimeType), "fileExtensions", aExtensionString.toLowerCase());
  },

  clearExtensions: function ()
  {
    var extArray = this.extensions.split(" ");
    for (i = extArray.length - 1; i >= 0; --i) {
      this.removeExtension(extArray[i]);
    }
  },
  
  // content handling
  get saveToDisk()
  {
    return this.getHandlerInfoForType(this.URI, "saveToDisk");
  },
  
  set saveToDisk(aSavedToDisk)
  {
    this.changeMIMEStuff(HANDLER_URI(this.mimeType), "saveToDisk", aSavedToDisk);
    this.setHandlerProcedure("handleInternal", "false");
    this.setHandlerProcedure("useSystemDefault", "false");
    return aSavedToDisk;
 },

  get useSystemDefault()
  {
    return this.getHandlerInfoForType(this.URI, "useSystemDefault");
  },

  set useSystemDefault(aUseSystemDefault)
  {
    this.changeMIMEStuff(HANDLER_URI(this.mimeType), "useSystemDefault", aUseSystemDefault);
    this.setHandlerProcedure("handleInternal", "false");
    this.setHandlerProcedure("saveToDisk", "false");
    return aUseSystemDefault;
  },
  
  get handleInternal()
  {
    return this.getHandlerInfoForType(this.URI, "handleInternal");
  },
  
  set handleInternal(aHandledInternally)
  {
    this.changeMIMEStuff(HANDLER_URI(this.mimeType), "handleInternal", aHandledInternally);
    this.setHandlerProcedure("saveToDisk", "false");
    this.setHandlerProcedure("useSystemDefault", "false");
    return aHandledInternally;
  },

  setHandlerProcedure: function (aHandlerProcedure, aValue)
  {
    var handlerSource = gRDF.GetUnicodeResource(HANDLER_URI(this.mimeType));
    var handlerProperty = gRDF.GetUnicodeResource(NC_URI(aHandlerProcedure));
    var oppositeValue = aValue == "false" ? "true" : "false";
    var trueLiteral = gRDF.GetLiteral(oppositeValue);
    var hasCounterpart = this._DS.HasAssertion(handlerSource, handlerProperty, trueLiteral, true);
    if (hasCounterpart) {
      var falseLiteral = gRDF.GetLiteral(aValue);
      this._DS.Change(handlerSource, handlerProperty, trueLiteral, falseLiteral);
    }
  },
  
  get alwaysAsk()
  {
    return this.getHandlerInfoForType(this.URI, "alwaysAsk");
  },
  
  set alwaysAsk(aAlwaysAsk)
  {
    this.changeMIMEStuff(HANDLER_URI(this.mimeType), "alwaysAsk", aAlwaysAsk);
    return aAlwaysAsk;
  },
  
  // helper application
  get appDisplayName()
  {
    return getHelperAppInfoForType(this.URI, "prettyName");
  },
  
  set appDisplayName(aDisplayName)
  {
    this.changeMIMEStuff(APP_URI(this.mimeType), "prettyName", aDisplayName);
    return aDisplayName;
  },
  
  get appPath()
  {
    return this.getHelperAppInfoForType(this.URI, "path");
  },
  
  set appPath(aAppPath)
  {
    this.changeMIMEStuff(APP_URI(this.mimeType), "path", aAppPath);
    return aAppPath;
  },

  /**
   * After setting the various properties on this override, we need to
   * build the links between the mime type resource, the handler for that
   * resource, and the helper app (if any) associated with the resource.
   * We also need to add this mime type to the RDF seq (list) of types.
   **/
  buildLinks: function()
  {
    // assert the handler resource
    var mimeSource = gRDF.GetUnicodeResource(MIME_URI(this.mimeType));
    var handlerProperty = gRDF.GetUnicodeResource(NC_URI("handlerProp"));
    var handlerResource = gRDF.GetUnicodeResource(HANDLER_URI(this.mimeType));
    this._DS.Assert(mimeSource, handlerProperty, handlerResource, true);
    // assert the helper app resource
    var helperAppProperty = gRDF.GetUnicodeResource(NC_URI("externalApplication"));
    var helperAppResource = gRDF.GetUnicodeResource(APP_URI(this.mimeType));
    this._DS.Assert(handlerResource, helperAppProperty, helperAppResource, true);
    // add the mime type to the MIME types seq
    var container = Components.classes["@mozilla.org/rdf/container;1"].createInstance();
    if (container) {
      container = container.QueryInterface(Components.interfaces.nsIRDFContainer);
      if (container) {
        var containerRes = gRDF.GetUnicodeResource("urn:mimetypes:root");
        container.Init(this._DS, containerRes);
        var element = gRDF.GetUnicodeResource(MIME_URI(this.mimeType));
        if (container.IndexOf(element) == -1)
          container.AppendElement(element);
      }
    }
  }, 
  
  // Implementation helper methods
  
  getLiteralForContentType: function (aURI, aProperty)
  {
    var contentTypeResource = gRDF.GetUnicodeResource(aURI);
    var propertyResource = gRDF.GetUnicodeResource(NC_URI(aProperty));
    return this.getLiteral(contentTypeResource, propertyResource);
  },

  getLiteral: function (aSource, aProperty)
  {
    var node = this._DS.GetTarget(aSource, aProperty, true);
    if (node) {
      node = node.QueryInterface(Components.interfaces.nsIRDFLiteral);
      return node.Value;
    }
    return "";
  },

  getHandlerInfoForType: function (aURI, aPropertyString)
  {
    // get current selected type
    var handler = HANDLER_URI(this.getLiteralForContentType(aURI, "value"));
    var source = gRDF.GetUnicodeResource(handler);
    var property = gRDF.GetUnicodeResource(NC_URI(aPropertyString));
    var target = this._DS.GetTarget(source, property, true);
    if (target) {
      target = target.QueryInterface(Components.interfaces.nsIRDFLiteral);
      return target.Value;
    }
    return "";
  },

  getHelperAppInfoForType: function (aURI, aPropertyString)
  {
    var appURI      = APP_URI(this.getLiteralForContentType(aURI, "value"));
    var appRes      = gRDF.GetUnicodeResource(appURI);
    var appProperty = gRDF.GetUnicodeResource(NC_URI(aPropertyString));
    return getLiteral(appRes, appProperty);
  },

  // write to the ds
  assertMIMEStuff: function (aMIMEString, aPropertyString, aValueString)
  {
    var mimeSource = gRDF.GetUnicodeResource(aMIMEString);
    var valueProperty = gRDF.GetUnicodeResource(NC_URI(aPropertyString));
    var mimeLiteral = gRDF.GetLiteral(aValueString);
    this._DS.Assert(mimeSource, valueProperty, mimeLiteral, true);
  },

  changeMIMEStuff: function(aMIMEString, aPropertyString, aValueString)
  {
    var mimeSource = gRDF.GetUnicodeResource(aMIMEString);
    var valueProperty = gRDF.GetUnicodeResource(NC_URI(aPropertyString));
    var mimeLiteral = gRDF.GetLiteral(aValueString);
    var currentValue = this._DS.GetTarget(mimeSource, valueProperty, true);
    if (currentValue) {
      this._DS.Change(mimeSource, valueProperty, currentValue, mimeLiteral);
    } else {
      this._DS.Assert(mimeSource, valueProperty, mimeLiteral, true);
    } 
  },

  unassertMIMEStuff: function(aMIMEString, aPropertyString, aValueString)
  {
    var mimeSource = gRDF.GetUnicodeResource(aMIMEString);
    var valueProperty = gRDF.GetUnicodeResource(NC_URI(aPropertyString));
    var mimeLiteral = gRDF.GetLiteral(aValueString);
    this._DS.Unassert(mimeSource, valueProperty, mimeLiteral, true);
  }
};

