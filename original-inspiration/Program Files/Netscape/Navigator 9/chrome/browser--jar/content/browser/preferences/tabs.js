//@line 39 "/cygdrive/c/builds/rklein/trunk/mozilla/browser/components/preferences/tabs.js"

var gTabsPane = {

  /**
   * Ensures that pages opened in new windows by web pages and pages opened by
   * external applications both open in the same way (e.g. in a new tab, window,
   * etc.).
   *
   * @returns 2 if such links should be opened in new windows,
   *          3 if such links should be opened in new tabs
   */
  writeLinkTarget: function() {
    var linkTargeting = document.getElementById("openBehaviorDiverted");
    document.getElementById("browser.link.open_newwindow").value = linkTargeting.value;
    return linkTargeting.value;
  },
  
  writeBMTarget: function() {
    var linkTargeting = document.getElementById("openBehaviorBookmarks");
    document.getElementById("extensions.netscape.linkpad.open").value = linkTargeting.value;
    return linkTargeting.value;
  }
};

