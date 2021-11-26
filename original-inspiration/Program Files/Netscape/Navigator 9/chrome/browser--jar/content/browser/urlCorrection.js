var urlCorrector = {
	get strings() { return document.getElementById("url_correction_bundle"); },

	prefBranch : "browser.urlbar.",

	load : function () {
		addEventListener("unload", function () { urlCorrector.unload(); }, false);
		
		this.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch(this.prefBranch);
		this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this.prefs.addObserver("", this, false);

		this.addTypoFixer();
	},

	unload : function () {
		this.prefs.removeObserver("", this);
	},
	
	observe : function (subject, topic, data) {
		if (topic != 'nsPref:changed') {
			return;
		}

		var menuOption = document.getElementById("url-fixer-askFirst");
		
		if (menuOption) {
			switch (data) {
				case 'offerCorrections':
					menuOption.setAttribute("disabled", !this.prefs.getBoolPref("offerCorrections"));
				break;
				case 'confirmCorrections':
					menuOption.setAttribute("checked", this.prefs.getBoolPref("confirmCorrections"));
				break;
			}
		}
	},

	addTypoFixer : function() {
		var urlbar = document.getElementById('urlbar');
			
		if (urlbar) {
			urlbar.addEventListener("popupshowing", function (event) { urlCorrector.addAskFirstOption(event); }, true);
		}
	},

	doFixup : function (urlBar) {
		// Called from browser.js's canonize function
		if (!this.prefs.getBoolPref("offerCorrections")){
			return true;
		}

					var url = urlBar.value;
					
					var res = [
						{find : ";//", replace : "://"},
					
						// Comma or semicolon instead of dot
						{find : "[,;]", replace : "."},
						
						// Incomplete protocol
						{find: "^h?t{1,2}p?(s?)://", "replace" : "http$1://"},
						{find: "^h.{1,3}p(s?)://", "replace" : "http$1://"},
						{find: "^f.{0,2}p://", "replace" : "ftp://"},
						{find: "^(i.{0,2}c|[irc]{2,4})://", "replace" : "irc://"},
						
						// Extra letter before or after protocol
						{find: "^.?(https|http|irc|ftp).?://", "replace" : "$1://"},
						
						// Only two of the three w's
						{find: "^w{2,4}(\\.)", "replace" : "www."},
						{find: "//ww(\\.)", "replace" : "//www."},
						
						// Missing the dot
						{find: "([^\\.])(com|net|org|edu|mil|gov)$", replace : "$1.$2"},
						
						// One letter off/missing one letter
						{nomatch : "(\\.(cc|mm|co|cm|mc|om|mo)$)", find : "\\.(co[^m]|c[^o]m|[^c]om|[com]{2,3})$", replace : ".com"},
						{nomatch : "(\\.(ee|tt|ne|nt|et|tn)$)", find : "\\.(ne[^t]|n[^e]t|[^n]et|[net]{2,3})$", replace : ".net"},
						{nomatch : "(\\.(gg|ro|gr)$)", find : "\\.(or[^g]|o[^r]g|[^o]rg|[org]{2,3})$", replace : ".org"},
						{nomatch : "(\\.(ee|eu|de)$)", find : "\\.(ed[^u]|e[^d]u|[^e]du|[edu]{2,3})$", replace : ".edu"},
						
						{nomatch : "(\\.(gg|vg)$)", find : "\\.(go[^v]|g[^o]v|[^g]ov|[gov]{2,3})$", replace : ".gov"},
						{nomatch : "(\\.(mm|ml|im|il|li)$)", find : "\\.(mi[^l]|m[^i]l|[^m]il|[mil]{2,3})$", replace : ".mil"},
						
						// Extra letter
						{find : "\\.(c.om|co.m)$", replace : ".com"},
						{find : "\\.(n.et|ne.t)$", replace : ".net"},
						{find : "\\.(o.rg|or.g)$", replace : ".org"},
						{find : "\\.(e.du|ed.u)$", replace : ".edu"},
						{find : "\\.(g.ov|go.v)$", replace : ".gov"},
						
						// Extra letter at the end or before the tld
						{find: "\\..?(com|net|org|edu|mil|gov).?$", replace : ".$1"}
					];
					
					var urlValue;
					
					// Get the domain part
					if (url.indexOf("/") == -1){
						// No slashes - only domain
						urlValue = url;
					}
					else if (url.indexOf("//") == -1){
						// 1+ singles slashes: no protocol, path may be there
						urlValue = url.substring(0, url.indexOf("/"));
					}
					else if (url.indexOf("//") != -1){
						// Protocol is there.
						
						if (url.indexOf("/",url.indexOf("//") + 2) == -1){
							// only //: protocol and domain
							urlValue = url;
						}
						else {
							urlValue = url.substring(0, url.indexOf("/",url.indexOf("//") + 2));
						}
					}
					
					// Save the domain part we found so we can tell if it changed
					var oldValue = urlValue;

					for (var i = 0; i < res.length; i++){
						urlValue = this.applyRE(urlValue, res[i]);
					}
					
					urlValue = urlValue.toLowerCase();

					if (urlValue != oldValue.toLowerCase()){
						urlValue = url.replace(oldValue, urlValue);
						
						if (this.prefs.getBoolPref("confirmCorrections")){
							var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
							
							var check = {value: false};
							var flags = 
								prompts.BUTTON_TITLE_YES * prompts.BUTTON_POS_0 +
								prompts.BUTTON_TITLE_CANCEL * prompts.BUTTON_POS_1 +
								prompts.BUTTON_TITLE_NO * prompts.BUTTON_POS_2;
							
							var button = prompts.confirmEx(window, this.strings.getString("urlCorrection.confirmTitle"), this.strings.getFormattedString("urlCorrection.didYouMean", [ urlValue ]), flags, this.strings.getString("urlCorrection.acceptButtonLabel"), this.strings.getString("urlCorrection.cancelButtonLabel"), this.strings.getString("urlCorrection.denyButtonLabel"), null, check);
							
							if (button == 1){
								// Cancel
								return false;
							}
							else if (button == 0){
								// Yes, I meant that.
								urlBar.value = urlValue;
							}
						}
						else {
							// Autocorrect
							urlBar.value = urlValue;
						}
					}
					
					return true;
	},
	
	addAskFirstOption : function (e) {
		var itemID = "url-fixer-askFirst";
		var itemLabel = this.strings.getString("urlCorrection.confirmOption");
		var itemOncommand = "urlCorrector.toggleAskFirst();";
		
		if ((e.originalTarget.localName == "menupopup") && (!document.getElementById(itemID))){
			var mi = document.createElement("menuitem");
			mi.setAttribute("id", itemID);
			mi.setAttribute("label", itemLabel);
			mi.setAttribute("type","checkbox");
			mi.setAttribute("checked",this.prefs.getBoolPref("confirmCorrections"));
			mi.setAttribute("oncommand", itemOncommand);
			mi.setAttribute("accesskey", this.strings.getString("urlCorrection.confirmAccessKey"));
			mi.setAttribute("disabled", !this.prefs.getBoolPref("offerCorrections"));
				
			e.originalTarget.appendChild(document.createElement("menuseparator"));
			e.originalTarget.appendChild(mi);
		}
	},
	
	toggleAskFirst : function () {
		this.prefs.setBoolPref("confirmCorrections",!this.prefs.getBoolPref("confirmCorrections"));
		
		if (document.getElementById("url-fixer-askFirst")){
			document.getElementById("url-fixer-askFirst").setAttribute("checked",this.prefs.getBoolPref("confirmCorrections"));
		}
	},
	
	applyRE : function (string, re){
		if (!re.nomatch || !string.match(new RegExp(re.nomatch))){
			if (re.res){
				for (var i = 0; i < re.res.length; i++){
					string = this.applyRE(string, re.res[i]);
				}
			}
			else {
				string = string.replace(new RegExp(re.find, "gi"), re.replace);
			}
		}
		
		return string;
	}
};
