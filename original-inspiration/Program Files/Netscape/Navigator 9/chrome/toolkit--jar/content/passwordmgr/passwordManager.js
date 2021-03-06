//@line 41 "/cygdrive/c/builds/rklein/trunk/mozilla/toolkit/components/passwordmgr/resources/content/passwordManager.js"

/*** =================== SAVED SIGNONS CODE =================== ***/

var kSignonBundle;

function SignonsStartup() {
  kSignonBundle = document.getElementById("signonBundle");
  document.getElementById("togglePasswords").label = kSignonBundle.getString("showPasswords");
  LoadSignons();
}

var signonsTreeView = {
  rowCount : 0,
  setTree : function(tree) {},
  getImageSrc : function(row,column) {},
  getProgressMode : function(row,column) {},
  getCellValue : function(row,column) {},
  getCellText : function(row,column) {
    var rv="";
    if (column.id=="siteCol") {
      rv = signons[row].host;
    } else if (column.id=="userCol") {
      rv = signons[row].user;
    } else if (column.id=="passwordCol") {
      rv = signons[row].password;
    }
    return rv;
  },
  isSeparator : function(index) { return false; },
  isSorted : function() { return false; },
  isContainer : function(index) { return false; },
  cycleHeader : function(column) {},
  getRowProperties : function(row,prop) {},
  getColumnProperties : function(column,prop) {},
  getCellProperties : function(row,column,prop) {}
 };

function Signon(number, host, user, rawuser, password) {
  this.number = number;
  this.host = host;
  this.user = user;
  this.rawuser = rawuser;
  this.password = password;
}

function LoadSignons() {
  // loads signons into table
  var enumerator = passwordmanager.enumerator;
  var count = 0;

  while (enumerator.hasMoreElements()) {
    var nextPassword;
    try {
      nextPassword = enumerator.getNext();
    } catch(e) {
      /* user supplied invalid database key */
      window.close();
      return false;
    }
    nextPassword = nextPassword.QueryInterface(Components.interfaces.nsIPassword);
    var host = nextPassword.host;
    var user;
    var password;
    // try/catch in case decryption fails (invalid signon entry)
    try {
      user = nextPassword.user;
      password = nextPassword.password;
    } catch (e) {
      // hide this entry
      dump("could not decrypt user/password for host " + host + "\n");
      continue;
    }
    var rawuser = user;

    // if no username supplied, try to parse it out of the url
    if (user == "") {
      var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                    .getService(Components.interfaces.nsIIOService);
      try {
        user = ioService.newURI(host, null, null).username;
        if (user == "") {
          user = "<>";
        }
      } catch(e) {
        user = "<>";
      }
    }

    signons[count] = new Signon(count++, host, user, rawuser, password);
  }
  signonsTreeView.rowCount = signons.length;

  // sort and display the table
  signonsTree.treeBoxObject.view = signonsTreeView;
  SignonColumnSort('host');

  // disable "remove all signons" button if there are no signons
  var element = document.getElementById("removeAllSignons");
  var toggle = document.getElementById("togglePasswords");
  if (signons.length == 0 || gSelectUserInUse) {
    element.setAttribute("disabled","true");
    toggle.setAttribute("disabled","true");
  } else {
    element.removeAttribute("disabled");
    toggle.removeAttribute("disabled");
  }
 
  return true;
}

function SignonSelected() {
  var selections = GetTreeSelections(signonsTree);
  if (selections.length && !gSelectUserInUse) {
    document.getElementById("removeSignon").removeAttribute("disabled");
  }
}

function DeleteSignon() {
  DeleteSelectedItemFromTree(signonsTree, signonsTreeView,
                             signons, deletedSignons,
                             "removeSignon", "removeAllSignons");
  FinalizeSignonDeletions();
}

function DeleteAllSignons() {
  var prompter = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                           .getService(Components.interfaces.nsIPromptService);

  // Confirm the user wants to remove all passwords
  var dummy = { value: false };
  if (prompter.confirmEx(window,
                         null,
                         kSignonBundle.getString("removeAllPasswordsPrompt"),
                         prompter.STD_YES_NO_BUTTONS + prompter.BUTTON_POS_1_DEFAULT,
                         null, null, null, null, dummy) == 1) // 1 == "No" button
    return;

  DeleteAllFromTree(signonsTree, signonsTreeView,
                        signons, deletedSignons,
                        "removeSignon", "removeAllSignons");
  FinalizeSignonDeletions();
}

function TogglePasswordVisible() {
  if (!showingPasswords && !ConfirmShowPasswords())
    return;

  showingPasswords = !showingPasswords;
  document.getElementById("togglePasswords").label = kSignonBundle.getString(showingPasswords ? "hidePasswords" : "showPasswords");
  document.getElementById("passwordCol").hidden = !showingPasswords;
}

function AskUserShowPasswords() {
  var prompter = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
  var dummy = { value: false };

  // Confirm the user wants to display passwords
  return prompter.confirmEx(window,
          null,
          kSignonBundle.getString("noMasterPasswordPrompt"),
          prompter.BUTTON_TITLE_YES * prompter.BUTTON_POS_0 + prompter.BUTTON_TITLE_NO * prompter.BUTTON_POS_1,
          null, null, null, null, dummy) == 0;    // 0=="Yes" button
}

function ConfirmShowPasswords() {
  // This doesn't harm if passwords are not encrypted
  var tokendb = Components.classes["@mozilla.org/security/pk11tokendb;1"]
                    .createInstance(Components.interfaces.nsIPK11TokenDB);
  var token = tokendb.getInternalKeyToken();

  // If there is no master password, still give the user a chance to opt-out of displaying passwords
  if (token.checkPassword(""))
    return AskUserShowPasswords();

  // So there's a master password. But since checkPassword didn't succeed, we're logged out (per nsIPK11Token.idl).
  try {
    // Relogin and ask for the master password.
    token.login(true);  // 'true' means always prompt for token password. User will be prompted until
                        // clicking 'Cancel' or entering the correct password.
  } catch (e) {
    // An exception will be thrown if the user cancels the login prompt dialog.
    // User is also logged out of Software Security Device.
  }

  return token.isLoggedIn();
}

function FinalizeSignonDeletions() {
  for (var s=0; s<deletedSignons.length; s++) {
    passwordmanager.removeUser(deletedSignons[s].host, deletedSignons[s].rawuser);
  }
  deletedSignons.length = 0;
}

function HandleSignonKeyPress(e) {
  if (e.keyCode == 46) {
    DeleteSignon();
  }
}

var lastSignonSortColumn = "";
var lastSignonSortAscending = false;

function SignonColumnSort(column) {
  lastSignonSortAscending =
    SortTree(signonsTree, signonsTreeView, signons,
                 column, lastSignonSortColumn, lastSignonSortAscending);
  lastSignonSortColumn = column;
}
