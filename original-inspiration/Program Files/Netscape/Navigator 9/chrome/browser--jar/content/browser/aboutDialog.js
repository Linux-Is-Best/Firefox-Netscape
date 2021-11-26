//@line 36 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/aboutDialog.js"

var gSelectedPage = 0;

function init(aEvent) 
{
  if (aEvent.target != document)
    return;
  var userAgentField = document.getElementById("userAgent");
  userAgentField.value = navigator.userAgent;

  var button = document.documentElement.getButton("extra2");
  button.setAttribute("label", document.documentElement.getAttribute("creditslabel"));
  button.addEventListener("command", switchPage, false);

  document.documentElement.getButton("accept").focus();
//@line 56 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/base/content/aboutDialog.js"
}

function uninit(aEvent)
{
  if (aEvent.target != document)
    return;
  var iframe = document.getElementById("creditsIframe");
  iframe.setAttribute("src", "");
}

function switchPage(aEvent)
{
  var button = aEvent.target;
  if (button.localName != "button")
    return;

  var iframe = document.getElementById("creditsIframe");
  if (gSelectedPage == 0) { 
    iframe.setAttribute("src", "chrome://browser/content/credits.xhtml");
    button.setAttribute("label", document.documentElement.getAttribute("aboutlabel"));
    gSelectedPage = 1;
  }
  else {
    iframe.setAttribute("src", ""); 
    button.setAttribute("label", document.documentElement.getAttribute("creditslabel"));
    gSelectedPage = 0;
  }
  var modes = document.getElementById("modes");
  modes.setAttribute("selectedIndex", gSelectedPage);
}

