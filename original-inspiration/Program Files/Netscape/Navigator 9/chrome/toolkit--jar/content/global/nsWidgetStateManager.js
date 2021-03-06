//@line 39 "/cygdrive/c/builds/rklein/trunk/mozilla/toolkit/content/nsWidgetStateManager.js"

//@line 46 "/cygdrive/c/builds/rklein/trunk/mozilla/toolkit/content/nsWidgetStateManager.js"

var wsm;

// For panels displayed inside the main dialog, this value will be the child iframe
// window. For panels displayed in sub-dialogs, those launched by panels of the main
// dialog, this will be the sub dialog window. 
var gCurrentWindow = null;

function nsWidgetStateManager (aFrameID)
{

  this.dataManager = {
    /** Persisted Data Hash Table
     *  Page_ID -> Element_ID -> Property -> Value
     **/
    pageData: { },

    setPageData: function (aPageTag, aDataObject)
    {
      this.pageData[aPageTag] = aDataObject;
    },

    getPageData: function (aPageTag)
    {
      if (!(aPageTag in this.pageData))
        this.pageData[aPageTag] = { };

      if (!('elementIDs' in this.pageData[aPageTag]))
        this.pageData[aPageTag].elementIDs = new Object();

      if (!('userData' in this.pageData[aPageTag]))
        this.pageData[aPageTag].userData = new Object();

      return this.pageData[aPageTag];
    },

    setItemData: function (aPageTag, aItemID, aDataObject)
    {
      if (!(aPageTag in this.pageData))
        this.pageData[aPageTag] = new Object();
      
      this.pageData[aPageTag].elementIDs[aItemID] = aDataObject;
    },

    getItemData: function (aPageTag, aItemID)
    {
      if (!(aItemID in this.pageData[aPageTag].elementIDs))
        this.pageData[aPageTag].elementIDs[aItemID] = new Object();
      return this.pageData[aPageTag].elementIDs[aItemID];
    }
  }

  this.contentID    = aFrameID;

  wsm               = this;

  /** Element Handlers
   *  Provides default get and set handler functions for supported
   *  widgets. Clients can override or add new widgets.
   **/
  this.handlers     = {
    menulist:
      {  get: wsm.get_Menulist,    set: wsm.set_Menulist      },
    radiogroup:
      {  get: wsm.get_Radiogroup,  set: wsm.set_Radiogroup    },
    checkbox:
      {  get: wsm.get_Checkbox,    set: wsm.set_Checkbox      },
    textbox:
      {  get: wsm.get_Textbox,     set: wsm.set_Textbox       },
    listitem:
      {  get: wsm.get_Listitem,    set: wsm.set_Listitem      },
    data:
      {  get: wsm.get_Data,        set: wsm.set_Data          },
    default_handler:
      {  get: wsm.get_Default,     set: wsm.set_Default       }
  }

  // extra attributes to scan and save.
  this.attributes   = [];
}

nsWidgetStateManager.prototype =
{
  get contentArea ()
  {
    return window.frames[this.contentID];
  },

  savePageData: function (aPageTag, aWindow)
  {
    gCurrentWindow = aWindow || this.contentArea;
      
    if (!(aPageTag in this.dataManager.pageData))
      return;

    if ("GetFields" in gCurrentWindow) {
      // save page data based on user supplied function in content area
      var dataObject = gCurrentWindow.GetFields();
      if (dataObject)        
        this.dataManager.pageData[aPageTag].userData = dataObject;
    }

    // Automatic element retrieval. This is done in two ways.
    // 1) if an element id array is present in the document, this is
    //    used to build a list of elements to persist. <-- performant
    // 2) otherwise, all elements with "wsm_persist" set to true
    //    are persisted <-- non-performant.
    var elements;
    if ("_elementIDs" in gCurrentWindow) {
      elements = [];
      for (var i = 0; i < gCurrentWindow._elementIDs.length; i++) {
        var elt = gCurrentWindow.document.getElementById(gCurrentWindow._elementIDs[i]);
        if (elt)
          elements[elements.length] = elt;
        else {
          // see bug #40329. People forget this too often, and it breaks Prefs
          dump("*** FIX ME: '_elementIDs' in '" + gCurrentWindow.location.href.split('/').pop() +
               "' contains a reference to a non-existent element ID '" +
          gCurrentWindow._elementIDs[i] + "'.\n");
        }
      }
    }
    else 
      elements = gCurrentWindow.document.getElementsByAttribute("wsm_persist", "true");

    for (var ii = 0; ii < elements.length; ii++) {
      var elementID   = elements[ii].id;
      var elementType = elements[ii].localName;
 
      // persist attributes
      var get_Func = (elementType in this.handlers) ?
      this.handlers[elementType].get :
      this.handlers.default_handler.get;
      this.dataManager.setItemData(aPageTag, elementID, get_Func(elementID));
    }
  },

  setPageData: function (aPageTag, aWindow)
  {
    gCurrentWindow = aWindow || this.contentArea;

    var pageData = this.dataManager.getPageData(aPageTag);
    if ("SetFields" in gCurrentWindow)
      gCurrentWindow.SetFields(pageData.userData)

    if (!('elementIDs' in pageData))
      return;

    for (var elementID in pageData.elementIDs) {
      var element = gCurrentWindow.document.getElementById(elementID);
      if (element) {
        var elementType = element.localName;
        var set_Func = (elementType in this.handlers) ?
          this.handlers[elementType].set :
          this.handlers.default_handler.set;
        set_Func(elementID, pageData.elementIDs[elementID]);
      }
    }
  },


  /** Widget Get/Set Function Implementations
   *  These can be overridden by the client.
   **/
  generic_Set: function (aElement, aDataObject)
  {
    if (aElement) {
      for (var property in aDataObject) {
        if (property == "localname")
          continue;
        if (!aDataObject[property] && typeof aDataObject[property] == "boolean")
          aElement.removeAttribute(property);
        else
          aElement.setAttribute(property, aDataObject[property]);
      }
      
      if (!aElement.getAttribute("disabled","true"))
        aElement.removeAttribute("disabled");
    }
  },

  generic_Get: function (aElement)
  {
    if (aElement) {
      var dataObject = new Object();
      var wsmAttributes = aElement.getAttribute("wsm_attributes");
      var attributes = wsm.attributes;              // make a copy
      if (wsmAttributes != "")
        attributes.push(wsmAttributes.split(" "));  // modify the copy

      for (var i = 0; i < attributes.length; i++)
        dataObject[attributes[i]] = aElement.getAttribute(attributes[i]);

      dataObject.localname = aElement.localName;
      return dataObject;
    }
    return null;
  },

  // <menulist>
  set_Menulist: function (aElementID, aDataObject)
  {
    var element = gCurrentWindow.document.getElementById(aElementID);
    // set all generic properties
    wsm.generic_Set(element, aDataObject);
    // set menulist specific properties
    if ("value" in aDataObject) {
      try {
        element.value = aDataObject.value;
      }
      catch (ex) {
        dump(aElementID + ", ex: " + ex + "\n");
      }
    }
  },

  get_Menulist: function (aElementID)
  {
    var element     = gCurrentWindow.document.getElementById(aElementID);
    // retrieve all generic attributes
    var dataObject  = wsm.generic_Get(element);
    // retrieve all menulist specific attributes
    if (dataObject) {
      dataObject.value = element.getAttribute("value");
      return dataObject;
    }
    return null;
  },

  // <radiogroup>
  set_Radiogroup: function (aElementID, aDataObject)
  {
    var element = gCurrentWindow.document.getElementById(aElementID);
    wsm.generic_Set(element, aDataObject);
    if ("value" in aDataObject)
      element.value = aDataObject.value;
    if ("disabled" in aDataObject)
      element.disabled = aDataObject.disabled;
  },

  get_Radiogroup: function (aElementID)
  {
    var element = gCurrentWindow.document.getElementById(aElementID);
    var dataObject = wsm.generic_Get(element);
    if (dataObject) {
      dataObject.value = element.getAttribute("value");
      return dataObject;
    }
    return null;
  },

  // <textbox>
  set_Textbox: function (aElementID, aDataObject)
  {
    var element = gCurrentWindow.document.getElementById(aElementID);
    wsm.generic_Set(element, aDataObject);
  },

  get_Textbox: function (aElementID)
  {
    var element = gCurrentWindow.document.getElementById(aElementID);
    var dataObject = wsm.generic_Get(element);
    if (dataObject) {
      dataObject.value = element.value;
      return dataObject;
    }
    return null;
  },

  // <checkbox>
  set_Checkbox: function (aElementID, aDataObject)
  {
    var element = gCurrentWindow.document.getElementById(aElementID);
    // Set generic properites. 
    wsm.generic_Set(element, aDataObject);
    // Handle reversed boolean values.
    if ("checked" in aDataObject && element.hasAttribute("reversed"))
      element.checked = !aDataObject.checked; 
  },

  get_Checkbox: function (aElementID)
  {
    var element = gCurrentWindow.document.getElementById(aElementID);
    var dataObject = wsm.generic_Get(element);
    if (dataObject) {
      var checked = element.checked;
      dataObject.checked = element.getAttribute("reversed") == "true" ? !checked : checked;
      return dataObject;
    }
    return null;
  },

  // <listitem>
  set_Listitem: function (aElementID, aDataObject)
  {
    var element = gCurrentWindow.document.getElementById(aElementID);
    wsm.generic_Set(element, aDataObject);
  },

  get_Listitem: function (aElementID)
  {
    var element = gCurrentWindow.document.getElementById(aElementID);
    var dataObject = wsm.generic_Get(element);
    if (dataObject) {
      if (element.getAttribute("type") == "checkbox")
        dataObject.checked = element.checked;
      return dataObject;
    }
    return null;
  },

  // <data>
  set_Data: function (aElementID, aDataObject)
  {
    var element = gCurrentWindow.document.getElementById(aElementID);
    wsm.generic_Set(element, aDataObject);
    if ("value" in aDataObject)
      element.setAttribute("value", aDataObject.value);
  },

  get_Data: function (aElementID)
  {
    var element = gCurrentWindow.document.getElementById(aElementID);
    var dataObject = wsm.generic_Get(element);
    if (dataObject) {
      dataObject.value = element.getAttribute("value");
      return dataObject;
    }
    return null;
  },

  // <default>
  set_Default: function (aElementID, aDataObject)
  {
    var element = gCurrentWindow.document.getElementById(aElementID);
    wsm.generic_Set(element, aDataObject);
  },

  get_Default: function (aElementID)
  {
    var element = gCurrentWindow.document.getElementById(aElementID);
    var dataObject = wsm.generic_Get(element);
    return dataObject ? dataObject : null;
  }
}


