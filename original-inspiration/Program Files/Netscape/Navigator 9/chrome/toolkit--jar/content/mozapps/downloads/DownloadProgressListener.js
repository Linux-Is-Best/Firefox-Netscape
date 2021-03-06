//@line 39 "/cygdrive/c/builds/rklein/trunk/mozilla/toolkit/mozapps/downloads/content/DownloadProgressListener.js"

var gStrings = [];
const interval = 500; // Update every 500 milliseconds.

function DownloadProgressListener (aDocument, aStringBundle) 
{
  this.doc = aDocument;
  
  this._statusFormat = aStringBundle.getString("statusFormat");
  this._statusFormatKBMB = aStringBundle.getString("statusFormatKBMB");
  this._statusFormatKBKB = aStringBundle.getString("statusFormatKBKB");
  this._statusFormatMBMB = aStringBundle.getString("statusFormatMBMB");
  this._statusFormatUnknownMB = aStringBundle.getString("statusFormatUnknownMB");
  this._statusFormatUnknownKB = aStringBundle.getString("statusFormatUnknownKB");
  this._remain = aStringBundle.getString("remain");
  this._unknownFilesize = aStringBundle.getString("unknownFilesize");
  this._longTimeFormat = aStringBundle.getString("longTimeFormat");
  this._shortTimeFormat = aStringBundle.getString("shortTimeFormat");
  
}

DownloadProgressListener.prototype = 
{
  rateChanges: 0,
  rateChangeLimit: 0,
  priorRate: 0,
  lastUpdate: -500,
  doc: null,
  onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus, aDownload)
  {
    if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP) {
      var aDownloadID = aDownload.targetFile.path;
      var download = this.doc.getElementById(aDownloadID);
      if (download)
        download.setAttribute("status", "");
    }
  },

  onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress,
                              aCurTotalProgress, aMaxTotalProgress, aDownload)
  {
    var overallProgress = aCurTotalProgress;
    // Get current time.
    var now = (new Date()).getTime();
    
    // If interval hasn't elapsed, ignore it.
    if (now - this.lastUpdate < interval && aMaxTotalProgress != "-1" &&  
        parseInt(aCurTotalProgress) < parseInt(aMaxTotalProgress)) {
      return;
    }

    // Update this time.
    this.lastUpdate = now;

    var aDownloadID = aDownload.targetFile.path;
    var download = this.doc.getElementById(aDownloadID);

    // Calculate percentage.
    var percent;
    if (aMaxTotalProgress > 0) {
      percent = Math.floor((overallProgress*100.0)/aMaxTotalProgress);
      if (percent > 100)
        percent = 100;

      // Advance progress meter.
      if (download) {
        download.setAttribute("progress", percent);

        download.setAttribute("progressmode", "normal");
        
        onUpdateProgress();
      }
    }
    else {
      percent = -1;

      // Progress meter should be barber-pole in this case.
      download.setAttribute("progressmode", "undetermined");
    }

    // Now that we've set the progress and the time, update the UI with 
    // all the the pertinent information (bytes transferred, bytes total,
    // download rate, time remaining). 
    var status = this._statusFormat;

    // Insert the progress so far using the formatting routine. 
    var KBProgress = parseInt(overallProgress/1024 + .5);
    var KBTotal = parseInt(aMaxTotalProgress/1024 + .5);
    var kbProgress = this._formatKBytes(KBProgress, KBTotal);
    status = this._replaceInsert(status, 1, kbProgress);
    if (download)
      download.setAttribute("status-internal", kbProgress);

    var rate = aDownload.QueryInterface(Components.interfaces.nsIDownload_MOZILLA_1_8_BRANCH).speed;
    if (rate) {
      // rate is bytes/sec
      var kRate = rate / 1024; // K bytes/sec;
      kRate = parseInt( kRate * 10 + .5 ); // xxx (3 digits)
      // Don't update too often!
      if (kRate != this.priorRate) {
        if (this.rateChanges++ == this.rateChangeLimit) {
            // Time to update download rate.
            this.priorRate = kRate;
            this.rateChanges = 0;
        }
        else {
          // Stick with old rate for a bit longer.
          kRate = this.priorRate;
        }
      }
      else
        this.rateChanges = 0;

      var fraction = kRate % 10;
      kRate = parseInt((kRate - fraction) / 10);

      // Insert 3 is the download rate (in kilobytes/sec).
      if (kRate < 100)
        kRate += "." + fraction;
      status = this._replaceInsert(status, 2, kRate);
    }
    else
      status = this._replaceInsert(status, 2, "??.?");

    // Update time remaining.
    if (rate && (aMaxTotalProgress > 0)) {
      var rem = (aMaxTotalProgress - aCurTotalProgress) / rate;
      rem = parseInt(rem + .5);
      
      status = this._replaceInsert(status, 3, this._formatSeconds(rem, this.doc) + " " + this._remain);
    }
    else
      status = this._replaceInsert(status, 3, this._unknownFilesize);
    
    if (download)
      download.setAttribute("status", status);
  },
  onLocationChange: function(aWebProgress, aRequest, aLocation, aDownload)
  {
  },
  onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage, aDownload)
  {
  },
  onSecurityChange: function(aWebProgress, aRequest, state, aDownload)
  {
  },
  QueryInterface : function(iid)
  {
    if (iid.equals(Components.interfaces.nsIDownloadProgressListener) ||
        iid.equals(Components.interfaces.nsISupports))
    return this;

    throw Components.results.NS_NOINTERFACE;
  },

  _replaceInsert: function ( text, index, value ) 
  {
    var result = text;
    var regExp = new RegExp( "#"+index );
    result = result.replace( regExp, value );
    return result;
  },
  
  // aBytes     aTotalKBytes    returns:
  // x, < 1MB   y < 1MB         x of y KB
  // x, < 1MB   y >= 1MB        x KB of y MB
  // x, >= 1MB  y >= 1MB        x of y MB
  _formatKBytes: function (aKBytes, aTotalKBytes)
  {
    var progressHasMB = parseInt(aKBytes/1024) > 0;
    var totalHasMB = parseInt(aTotalKBytes/1024) > 0;
    
    var format = "";
    if (!progressHasMB && !totalHasMB) {
      if (!aTotalKBytes) {
      	 format = this._statusFormatUnknownKB;
        format = this._replaceInsert(format, 1, aKBytes);
      } else {
        format = this._statusFormatKBKB;
        format = this._replaceInsert(format, 1, aKBytes);
        format = this._replaceInsert(format, 2, aTotalKBytes);
      }
    }
    else if (progressHasMB && totalHasMB) {
      format = this._statusFormatMBMB;
      format = this._replaceInsert(format, 1, (aKBytes / 1024).toFixed(1));
      format = this._replaceInsert(format, 2, (aTotalKBytes / 1024).toFixed(1));
    }
    else if (totalHasMB && !progressHasMB) {
      format = this._statusFormatKBMB;
      format = this._replaceInsert(format, 1, aKBytes);
      format = this._replaceInsert(format, 2, (aTotalKBytes / 1024).toFixed(1));
    }
    else if (progressHasMB && !totalHasMB) {
      format = this._statusFormatUnknownMB;
      format = this._replaceInsert(format, 1, (aKBytes / 1024).toFixed(1));
    }
    else {
      // This is an undefined state!
      dump("*** huh?!\n");
    }
    
    return format;  
  },

  _formatSeconds: function (secs, doc)
  {
    // Round the number of seconds to remove fractions.
    secs = parseInt(secs + .5);
    var hours = parseInt(secs/3600);
    secs -= hours * 3600;
    
    var mins = parseInt(secs/60);
    secs -= mins * 60;
    var result = hours ? this._longTimeFormat : this._shortTimeFormat;

    if (hours < 10)
      hours = "0" + hours;
    if (mins < 10)
      mins = "0" + mins;
    if (secs < 10)
      secs = "0" + secs;

    // Insert hours, minutes, and seconds into result string.
    result = this._replaceInsert(result, 1, hours);
    result = this._replaceInsert(result, 2, mins);
    result = this._replaceInsert(result, 3, secs);

    return result;
  }
  
}; 
