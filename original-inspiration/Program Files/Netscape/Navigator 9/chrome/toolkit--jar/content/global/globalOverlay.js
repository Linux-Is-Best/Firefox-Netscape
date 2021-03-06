function closeWindow(aClose)
{
  var windowCount = 0;
   var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                      .getService(Components.interfaces.nsIWindowMediator);
  var e = wm.getEnumerator(null);
  
  while (e.hasMoreElements()) {
    var w = e.getNext();
    if (++windowCount == 2) 
      break;
  }

//@line 16 "/cygdrive/c/builds/rklein/trunk/mozilla/toolkit/content/globalOverlay.js"
  // If we're down to the last window and someone tries to shut down, check to make sure we can!
  if (windowCount == 1 && !canQuitApplication())
    return false;
//@line 20 "/cygdrive/c/builds/rklein/trunk/mozilla/toolkit/content/globalOverlay.js"

  if (aClose)    
    window.close();
  
  return true;
}

function canQuitApplication()
{
  var os = Components.classes["@mozilla.org/observer-service;1"]
                     .getService(Components.interfaces.nsIObserverService);
  if (!os) return true;
  
  try {
    var cancelQuit = Components.classes["@mozilla.org/supports-PRBool;1"]
                              .createInstance(Components.interfaces.nsISupportsPRBool);
    os.notifyObservers(cancelQuit, "quit-application-requested", null);
    
    // Something aborted the quit process. 
    if (cancelQuit.data)
      return false;
  }
  catch (ex) { }
  os.notifyObservers(null, "quit-application-granted", null);
  return true;
}

function goQuitApplication()
{
  if (!canQuitApplication())
    return false;

  var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService();
  var windowManagerInterface = windowManager.QueryInterface( Components.interfaces.nsIWindowMediator);
  var enumerator = windowManagerInterface.getEnumerator( null );
  var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
                     getService(Components.interfaces.nsIAppStartup);

  while ( enumerator.hasMoreElements()  )
  {
     var domWindow = enumerator.getNext();
     if (("tryToClose" in domWindow) && !domWindow.tryToClose())
       return false;
     domWindow.close();
  };
  appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
  return true;
}

/**
 * Command Updater
 */
var CommandUpdater = {
  /**
   * Gets a controller that can handle a particular command. 
   * @param   command
   *          A command to locate a controller for, preferring controllers that
   *          show the command as enabled.
   * @returns In this order of precedence:
   *            - the first controller supporting the specified command 
   *              associated with the focused element that advertises the
   *              command as ENABLED
   *            - the first controller supporting the specified command 
   *              associated with the global window that advertises the
   *              command as ENABLED
   *            - the first controller supporting the specified command
   *              associated with the focused element
   *            - the first controller supporting the specified command
   *              associated with the global window
   */
  _getControllerForCommand: function(command) {
    try {
      var controller = 
          top.document.commandDispatcher.getControllerForCommand(command);
      if (controller && controller.isCommandEnabled(command))
        return controller;
    }
    catch(e) {
    }
    var controllerCount = window.controllers.getControllerCount();
    for (var i = 0; i < controllerCount; ++i) {
      var current = window.controllers.getControllerAt(i);
      try {
        if (current.supportsCommand(command) && current.isCommandEnabled(command))
          return current;
      }
      catch (e) {
      }
    }
    return controller || window.controllers.getControllerForCommand(command);
  },
  
  /**
   * Updates the state of a XUL <command> element for the specified command
   * depending on its state.
   * @param   command
   *          The name of the command to update the XUL <command> element for
   */
  updateCommand: function(command) {
    var enabled = false;
    try {
      var controller = this._getControllerForCommand(command);
      if (controller)
        enabled = controller.isCommandEnabled(command);
    }
    catch(ex) { }

    this.enableCommand(command, enabled);
  },
  
  /**
   * Enables or disables a XUL <command> element.
   * @param   command
   *          The name of the command to enable or disable
   * @param   enabled
   *          true if the command should be enabled, false otherwise.
   */
  enableCommand: function(command, enabled) {
    var element = document.getElementById(command);
    if (!element)
      return;
    if (enabled)
      element.removeAttribute("disabled");
    else
      element.setAttribute("disabled", "true");
  },
  
  /**
   * Performs the action associated with a specified command using the most
   * relevant controller.
   * @param   command
   *          The command to perform.
   */
  doCommand: function(command) {
    var controller = this._getControllerForCommand(command);
    if (!controller)
      return;
    controller.doCommand(command);
  }, 
  
  /**
   * Changes the label attribute for the specified command.
   * @param   command
   *          The command to update.
   * @param   labelAttribute
   *          The label value to use.
   */
  setMenuValue: function(command, labelAttribute) {
    var commandNode = top.document.getElementById(command);
    if (commandNode)
    {
      var label = commandNode.getAttribute(labelAttribute);
      if ( label )
        commandNode.setAttribute('label', label);
    }
  },
  
  /**
   * Changes the accesskey attribute for the specified command.
   * @param   command
   *          The command to update.
   * @param   valueAttribute
   *          The value attribute to use.
   */
  setAccessKey: function(command, valueAttribute) {
    var commandNode = top.document.getElementById(command);
    if (commandNode)
    {
      var value = commandNode.getAttribute(valueAttribute);
      if ( value )
        commandNode.setAttribute('accesskey', value);
    }
  },

  /**
   * Inform all the controllers attached to a node that an event has occurred
   * (e.g. the tree controllers need to be informed of blur events so that they can change some of the
   * menu items back to their default values)
   * @param   node
   *          The node receiving the event
   * @param   event
   *          The event.
   */
  onEvent: function(node, event) {
    var numControllers = node.controllers.getControllerCount();
    var controller;

    for ( var controllerIndex = 0; controllerIndex < numControllers; controllerIndex++ )
    {
      controller = node.controllers.getControllerAt(controllerIndex);
      if ( controller )
        controller.onEvent(event);
    }
  }  
};
// Shim for compatibility with existing code. 
function goDoCommand(command) { CommandUpdater.doCommand(command); }
function goUpdateCommand(command) { CommandUpdater.updateCommand(command); }
function goSetCommandEnabled(command, enabled) { CommandUpdater.enableCommand(command, enabled); }
function goSetMenuValue(command, labelAttribute) { CommandUpdater.setMenuValue(command, labelAttribute); }
function goSetAccessKey(command, valueAttribute) { CommandUpdater.setAccessKey(command, valueAttribute); }
function goOnEvent(node, event) { CommandUpdater.onEvent(node, event); }

function visitLink(aEvent) {
  var node = aEvent.target;
  while (node.nodeType != Node.ELEMENT_NODE)
    node = node.parentNode;
  var url = node.getAttribute("link");
  if (!url)
    return;

  var protocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
                              .getService(Components.interfaces.nsIExternalProtocolService);
  var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                            .getService(Components.interfaces.nsIIOService);
  var uri = ioService.newURI(url, null, null);

  // if the scheme is not an exposed protocol, then opening this link
  // should be deferred to the system's external protocol handler
  if (protocolSvc.isExposedProtocol(uri.scheme)) {
    var win = window.top;
    if (win instanceof Components.interfaces.nsIDOMChromeWindow) {
      while (win.opener && !win.opener.closed)
        win = win.opener;
    }
    win.open(uri.spec);
  } else
    protocolSvc.loadUrl(uri);
}

function isValidLeftClick(aEvent, aName)
{
  return (aEvent.button == 0 && aEvent.originalTarget.localName == aName);
}

function setTooltipText(aID, aTooltipText)
{
  var element = document.getElementById(aID);
  if (element)
    element.setAttribute("tooltiptext", aTooltipText);
}

function FillInTooltip ( tipElement )
{
  var retVal = false;
  var textNode = document.getElementById("TOOLTIP-tooltipText");
  if (textNode) {
    while (textNode.hasChildNodes())
      textNode.removeChild(textNode.firstChild);
    var tipText = tipElement.getAttribute("tooltiptext");
    if (tipText) {
      var node = document.createTextNode(tipText);
      textNode.appendChild(node);
      retVal = true;
    }
  }
  return retVal;
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

//@line 44 "/cygdrive/c/builds/rklein/trunk/mozilla/toolkit/content/debug.js"

var gTraceOnAssert = true;

/**
 * This function provides a simple assertion function for JavaScript.
 * If the condition is true, this function will do nothing.  If the
 * condition is false, then the message will be printed to the console
 * and an alert will appear showing a stack trace, so that the (alpha
 * or nightly) user can file a bug containing it.  For future enhancements, 
 * see bugs 330077 and 330078.
 *
 * To suppress the dialogs, you can run with the environment variable
 * XUL_ASSERT_PROMPT set to 0 (if unset, this defaults to 1).
 *
 * @param condition represents the condition that we're asserting to be
 *                  true when we call this function--should be
 *                  something that can be evaluated as a boolean.
 * @param message   a string to be displayed upon failure of the assertion
 */

function NS_ASSERT(condition, message) {
  if (condition)
    return;

  var assertionText = "ASSERT: " + message + "\n";

//@line 72 "/cygdrive/c/builds/rklein/trunk/mozilla/toolkit/content/debug.js"
  Components.util.reportError(assertionText);
  return;
//@line 108 "/cygdrive/c/builds/rklein/trunk/mozilla/toolkit/content/debug.js"
}
