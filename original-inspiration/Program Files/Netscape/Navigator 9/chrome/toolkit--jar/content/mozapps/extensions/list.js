//@line 39 "/cygdrive/c/builds/rklein/trunk/mozilla/toolkit/mozapps/extensions/content/list.js"

const kXULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const kDialog = "dialog";

/**
 * This dialog can be initialized from parameters supplied via window.arguments
 * or it can be used to display blocklist notification and blocklist blocked
 * installs via nsIDialogParamBlock as is done by nsIExtensionManager.
 *
 * When using this dialog with window.arguments it must be opened modally, the
 * caller can inspect the user action after the dialog closes by inspecting the
 * value of the |result| parameter on this object which is set to the dlgtype
 * of the button used to close the dialog.
 * 
 * window.arguments[0] is an array of strings to display in the tree. If the
 * array is empty the tree will not be displayed.
 * window.arguments[1] a JS Object with the following properties:
 * 
 * title:    A title string, to be displayed in the title bar of the dialog.
 * message1: A message string, displayed above the addon list
 * message2: A message string, displayed below the addon list
 * message3: A bolded message string, displayed below the addon list
 * moreInfoURL: An url for displaying more information
 * iconClass  : Can be one of the following values (default is alert-icon)
 *              alert-icon, error-icon, or question-icon
 *
 * If no value is supplied for message1, message2, message3, or moreInfoURL,
 * the element is not displayed.
 *
 * buttons: {
 *  accept: { label: "A Label for the Accept button",
 *            focused: true },
 *  cancel: { label: "A Label for the Cancel button" },
 *  ...
 * },
 *
 * result:  The dlgtype of button that was used to dismiss the dialog. 
 */

var gButtons = { };

function init() {
  var de = document.documentElement;
  var items = [];
  if (window.arguments[0] instanceof Components.interfaces.nsIDialogParamBlock) {
    var args = window.arguments[0];
    var fromInstall = args.GetInt(0) == 1 ? true : false;
    var numberOfItems = args.GetInt(1);
    for (var i = 0; i < numberOfItems; ++i)
      items.push(args.GetString(i));

    var extensionsBundle = document.getElementById("extensionsBundle");
    try {
      var formatter = Components.classes["@mozilla.org/toolkit/URLFormatterService;1"]
                                .getService(Components.interfaces.nsIURLFormatter);
      var url = formatter.formatURLPref("extensions.blocklist.detailsURL");
    }
    catch (e) { }

    if (fromInstall) { // Blocklist blocked install
      var params = {
        message1: extensionsBundle.getFormattedString("blocklistedInstallMsg",
                                                      [items[0]]),
        moreInfoURL: url,
        title: extensionsBundle.getString("blocklistedInstallTitle")
      };
      items = [];
      var button = document.getElementById("centeredButton");
      button.setAttribute("dlgtype", "accept");
      de.buttons = "accept";
      de.getButton("accept").focus();
    }
    else { // Blocklist background notification
      // only hide when not used due to focus issues
      document.getElementById("buttonCenteredBox").hidden = true;
      var brandBundle = document.getElementById("brandBundle");
      var brandShortName = brandBundle.getString("brandShortName");
      params = {
        message1: extensionsBundle.getFormattedString("blocklistNotifyMsg",
                                                      [brandShortName]),
        message2: extensionsBundle.getFormattedString("blocklistRestartMsg",
                                                      [brandShortName]),
        moreInfoURL: url,
        title: extensionsBundle.getString("blocklistNotifyTitle")
      };
      de.buttons = "extra1,cancel";
      button = de.getButton("cancel");
      button.label = extensionsBundle.getString("laterButton");
      de.setAttribute("ondialogextra1", "restartApp();");
      button.focus();
      button = de.getButton("extra1");
      button.label = extensionsBundle.getFormattedString("restartButton",
                                                         [brandShortName]);
    }
  }
  else {
    // only hide when not used due to focus issues
    document.getElementById("buttonCenteredBox").hidden = true;
    items = window.arguments[0];
    params = window.arguments[1];
  }

  var addons = document.getElementById("addonsChildren");
  if (items.length > 0)
    document.getElementById("addonsTree").hidden = false;

  // Fill the addons list
  for (i = 0; i < items.length; ++i) {
    var treeitem = document.createElementNS(kXULNS, "treeitem");
    var treerow  = document.createElementNS(kXULNS, "treerow");
    var treecell = document.createElementNS(kXULNS, "treecell");
    treecell.setAttribute("label", items[i]);
    treerow.appendChild(treecell);
    treeitem.appendChild(treerow);
    addons.appendChild(treeitem);
  }

  // Set the messages
  var messages = ["message1", "message2", "message3"];
  for (i = 0; i < messages.length; ++i) {
    if (messages[i] in params) {
      var message = document.getElementById(messages[i]);
      message.hidden = false;
      message.appendChild(document.createTextNode(params[messages[i]]));
    }
  }
  
  document.getElementById("infoIcon").className =
    params["iconClass"] ? "spaced " + params["iconClass"] : "spaced alert-icon";

  if ("moreInfoURL" in params && params["moreInfoURL"]) {
    message = document.getElementById("moreInfo");
    message.value = extensionsBundle.getString("moreInfoText");
    message.setAttribute("href", params["moreInfoURL"]);
    document.getElementById("moreInfoBox").hidden = false;
  }

  // Set the window title
  if ("title" in params)
    document.title = params.title;

  // Set up the buttons
  if ("buttons" in params) {
    gButtons = params.buttons;
    var buttonString = "";
    for (var buttonType in gButtons)
      buttonString += "," + buttonType;
    de.buttons = buttonString.substr(1);
    for (buttonType in gButtons) {
      button = de.getButton(buttonType);
      button.label = gButtons[buttonType].label;
      if (gButtons[buttonType].focused)
        button.focus();
      document.addEventListener(kDialog + buttonType, handleButtonCommand, true);
    }
  }
}

function shutdown() {
  for (buttonType in gButtons)
    document.removeEventListener(kDialog + buttonType, handleButtonCommand, true);
}

function restartApp() {
  const nsIAppStartup = Components.interfaces.nsIAppStartup;
  // Notify all windows that an application quit has been requested.
  var os = Components.classes["@mozilla.org/observer-service;1"]
                     .getService(Components.interfaces.nsIObserverService);
  var cancelQuit = Components.classes["@mozilla.org/supports-PRBool;1"]
                             .createInstance(Components.interfaces.nsISupportsPRBool);
  os.notifyObservers(cancelQuit, "quit-application-requested", null);

  // Something aborted the quit process. 
  if (cancelQuit.data)
    return;

  // Notify all windows that an application quit has been granted.
  os.notifyObservers(null, "quit-application-granted", null);

  // Enumerate all windows and call shutdown handlers
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
  var windows = wm.getEnumerator(null);
  while (windows.hasMoreElements()) {
    var win = windows.getNext();
    if (("tryToClose" in win) && !win.tryToClose())
      return;
  }
  Components.classes["@mozilla.org/toolkit/app-startup;1"].getService(nsIAppStartup)
            .quit(nsIAppStartup.eRestart | nsIAppStartup.eAttemptQuit);
}

/**
 * Watch for the user hitting one of the buttons to dismiss the dialog
 * and report the result back to the caller through the |result| property on
 * the arguments object.
 */
function handleButtonCommand(event) {
  window.arguments[1].result = event.type.substr(kDialog.length);
}
