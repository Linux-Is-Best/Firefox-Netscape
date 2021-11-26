var resizeTa =
{
  loaded: null,
  TAlength: 0,

  init: function (){
    if (resizeTa.loaded)
      return;
    else{
        resizeTa.loaded = true;
        var appcontent = document.getElementById("appcontent");
        if(appcontent)
        appcontent.addEventListener("load", resizeTa.pageload, true);
        }
  },

pageload: function (aEvent){
    resizeTa.doc = aEvent.originalTarget;
    resizeTa.TA = resizeTa.doc.getElementsByTagName('TEXTAREA');
    resizeTa.TAlength = resizeTa.TA.length;
    if(resizeTa.TAlength == 0){
        return;
    }else{
    resizeTa.rootElem = resizeTa.doc.getElementsByTagName('HTML')[0];
    var i = resizeTa.TAlength;
        while(i--){
            resizeTa.newdiv('5' ,'1' ,'gripH_',i,'w' );
            resizeTa.newdiv('1' ,'5' ,'gripV_',i,'n' );
            resizeTa.newdiv('10','10','gripX_',i,'se');
            }
        resizeTa.newdiv('0','0','showCursor','','w');
        CursorDiv = resizeTa.doc.getElementById('showCursor');
        CursorDiv.removeEventListener('mousedown', resizeTa.activate, true);
        CursorDiv.style.left = '0px';
        CursorDiv.style.top  = '0px';
        resizeTa.posdivs();
        window.addEventListener("resize",resizeTa.posdivs,true);
        }
    },

newdiv: function (w,h,id,nr,cu){
    var grip = resizeTa.doc.createElement("div");
    grip.setAttribute("ID", id+nr);
    grip.setAttribute("STYLE", "position:absolute;width:"+w+"px;height:"+h+"px;cursor:"+cu+"-resize");
    grip.addEventListener('mousedown', resizeTa.activate, true);
    resizeTa.rootElem.appendChild(grip);
    },

getposition: function (i){
  var curElem = resizeTa.TA[i];
  var curX = curElem.offsetLeft;
  while (curElem.offsetParent) {
        curX += curElem.offsetParent.offsetLeft;
        curElem = curElem.offsetParent;
        }
  curElem = resizeTa.TA[i];
  var curY = curElem.offsetTop;
  while (curElem.offsetParent) {
        curY += curElem.offsetParent.offsetTop;
        curElem = curElem.offsetParent;
        }
    return [curX,curY]
    },

posdivs: function (){
    var k = resizeTa.TAlength;
    while(k--){
        curPos = resizeTa.getposition(k);
        resizeTa.doc.getElementById('gripH_'+k).style.left   = curPos[0]+resizeTa.TA[k].offsetWidth -3 + "px";
        resizeTa.doc.getElementById('gripH_'+k).style.top    = curPos[1]                               + "px";
        resizeTa.doc.getElementById('gripH_'+k).style.height =           resizeTa.TA[k].offsetHeight-8 + "px";
        resizeTa.doc.getElementById('gripV_'+k).style.left   = curPos[0]                               + "px";
        resizeTa.doc.getElementById('gripV_'+k).style.top    = curPos[1]+resizeTa.TA[k].offsetHeight-3 + "px";
        resizeTa.doc.getElementById('gripV_'+k).style.width  =           resizeTa.TA[k].offsetWidth -8 + "px";
        resizeTa.doc.getElementById('gripX_'+k).style.left   = curPos[0]+resizeTa.TA[k].offsetWidth -8 + "px";
        resizeTa.doc.getElementById('gripX_'+k).style.top    = curPos[1]+resizeTa.TA[k].offsetHeight-8 + "px";
        }
    },

activate: function (e){
  resizeTa.doc = e.target.ownerDocument;
  resizeTa.TA = resizeTa.doc.getElementsByTagName('TEXTAREA');
  CursorDiv = resizeTa.doc.getElementById('showCursor');
  resizeTa.TAlength = resizeTa.TA.length;
  var curTargetId = e.target.getAttribute('ID').split("_");
    curTarget = curTargetId[0];
    curTA_Nr = parseInt(curTargetId[1]);
    resizeTa.doc.addEventListener('mouseup', resizeTa.deactivate, true);
    switch(curTarget){
        case "gripH": resizeTa.doc.addEventListener('mousemove', resizeTa.resizeta_h, true); break;
        case "gripV": resizeTa.doc.addEventListener('mousemove', resizeTa.resizeta_v, true); break;
        case "gripX": resizeTa.doc.addEventListener('mousemove', resizeTa.resizeta_x, true); break;
        }
    CursorDiv.style.width = resizeTa.rootElem.offsetWidth + "px";
  CursorDiv.style.height = resizeTa.rootElem.offsetHeight + "px";
  CursorDiv.style.cursor = e.target.style.cursor;
  },

deactivate: function (){
    resizeTa.doc.removeEventListener('mouseup', resizeTa.deactivate, true);
    switch(curTarget){
        case "gripH": resizeTa.doc.removeEventListener('mousemove', resizeTa.resizeta_h, true); break;
        case "gripV": resizeTa.doc.removeEventListener('mousemove', resizeTa.resizeta_v, true); break;
        case "gripX": resizeTa.doc.removeEventListener('mousemove', resizeTa.resizeta_x, true); break;
        }
    CursorDiv.style.width = '0px';
    CursorDiv.style.height = '0px';
    resizeTa.posdivs();
    },

resizeta_h: function (e){
  curPos = resizeTa.getposition(curTA_Nr);
    resizeTa.TA[curTA_Nr].style.width = e.pageX - curPos[0] + "px";
    },

resizeta_v: function (e){
  curPos = resizeTa.getposition(curTA_Nr);
    resizeTa.TA[curTA_Nr].style.height = e.pageY - curPos[1] + "px";
    },

resizeta_x: function (e){
  curPos = resizeTa.getposition(curTA_Nr);
    resizeTa.TA[curTA_Nr].style.width = e.pageX - curPos[0] + 2 + "px";
    resizeTa.TA[curTA_Nr].style.height = e.pageY - curPos[1] + 2 + "px";
    }
}