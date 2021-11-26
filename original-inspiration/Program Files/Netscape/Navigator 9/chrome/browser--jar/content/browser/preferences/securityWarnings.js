//@line 38 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/securityWarnings.js"

function secWarningSyncTo(aEvent) {
  var prefName = aEvent.target.getAttribute("preference") + ".show_once";
  var prefOnce = document.getElementById(prefName);
  prefOnce.value = false;
  return undefined;    
}
