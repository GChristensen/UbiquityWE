var active_document = document;
var active_window = window;

if (!CmdUtils) var CmdUtils = { 
    __globalObject: this,
    jQuery: jQuery,
};
noun_arb_text = 1;
CmdUtils.VERSION = 0.01;
CmdUtils.CommandList = [];
CmdUtils.CreateCommand = function CreateCommand(args) {
    var cmd_name = args.name;
    var cmd_list = CmdUtils.CommandList;
    if (cmd_name in cmd_list) {
        return;
    }
    //console.log("command created ", cmd_name);
    var to = parseFloat(args['timeout']);
    if (to>0) {
    	args['timeoutFunc'] = null;
    	if (typeof args['preview'] == 'function') {
		    args['preview_timeout'] = args['preview'];
			args['preview'] = function(b,a) {
                if (args['timeoutFunc'] !== null) {
                    clearTimeout(args['timeoutFunc']);
                }
                args['timeoutFunc'] = setTimeout(function () { 
                	args['preview_timeout'](b, a); 
                }, to);
			}    		
    	}
    	if (typeof args['execute'] == 'function') {
		    args['execute_timeout'] = args['execute'];
			args['execute'] = function(a) {
                if (args['timeoutFunc'] !== null) {
                    clearTimeout(args['timeoutFunc']);
                }
                args['timeoutFunc'] = setTimeout(function () {
					args['execute_timeout'](a);
                }, to);
			}    		
    	}
    }
    CmdUtils.CommandList.push(args);
};
CmdUtils.closeWindow = function closeWindow() {
    CmdUtils.saveLastCommand();
    CmdUtils.getWindow().close();
};
CmdUtils.getDocument = function getDocument() {
    return active_document;
};
CmdUtils.getLocation = function getLocation() {
    return CmdUtils.getDocument().location;
};
CmdUtils.getWindow = function getWindow() {
    return active_window;
};
CmdUtils.openWindow = function openWindow(url, name) {
    if (!name) {
        window.open(url);
    } else {
        window.open(url, name);
    }
};
// 2nd order function
CmdUtils.SimpleUrlBasedCommand = function SimpleUrlBasedCommand(url) {
    if (!url) return;
    var search_func = function(directObj) {
        if (!directObj) return;
        //ubiq_set_results(url);
        var text = directObj.text;
        text = encodeURIComponent(text);
        url = url.replace('{text}', text);
        url = url.replace('{location}', CmdUtils.getLocation());
        Utils.openUrlInBrowser(url);
        //CmdUtils.toggleUbiquityWindow();
    };
    return search_func;
};
CmdUtils.toggleUbiquityWindow = function toggleUbiquityWindow(w) {
    if (window.style.visibility == 'visible') {
        window.close();
    }
    return;
};
CmdUtils.ajaxGetJSON = function ajaxGetJSON(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            var resp = JSON.parse(xhr.responseText);
            callback(resp, xhr);
        }
    }
    xhr.send();
}
CmdUtils.ajaxGet = function ajaxGet(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            callback(xhr.responseText, xhr);
        }
    }
    xhr.send();
}
CmdUtils.get = function get(url) {
	return jQuery.ajax({
    	url: url,
        async: true
	});
}
CmdUtils.post = function post(url, data) {
	return jQuery.ajax({
    	url: url,
    	data: data,
        async: true
	});
}
CmdUtils.loadedScripts = [];
CmdUtils.loadScripts = function loadScripts(url, callback) {
	url = url || [];
	if (url.constructor === String) url = [url];

	if (url.length == 0) 
		return callback();

	var thisurl = url.shift();
	tempfunc = function(data, textStatus, jqXHR) {
		return loadScripts(url, callback);
	}
	if (CmdUtils.loadedScripts.indexOf(thisurl)==-1) {
		console.log("loading :::: ", thisurl);
		CmdUtils.loadedScripts.push(thisurl);
    	jQuery.ajax({
            url: thisurl,
            dataType: 'script',
            success: tempfunc,
            async: true
        });
    }
    else {
    	tempfunc();
    }
}

CmdUtils.setSelection = function setSelection(s) {
    s = s.replace('"', '\"');
    // http://jsfiddle.net/b3Fk5/2/
    var insertCode = `
    function replaceSelectedText(replacementText) {
        var sel, range;
        if (window.getSelection) {
            sel = window.getSelection();
            var activeElement = document.activeElement;
            if (activeElement.nodeName == "TEXTAREA" ||
                (activeElement.nodeName == "INPUT" && activeElement.type.toLowerCase() == "text")) {
                    var val = activeElement.value, start = activeElement.selectionStart, end = activeElement.selectionEnd;
                    activeElement.value = val.slice(0, start) + replacementText + val.slice(end);
                //alert("in text area");
            } else {
                if (sel.rangeCount) {
                    range = sel.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(document.createTextNode(replacementText));
                } else {
                    sel.deleteFromDocument();
                }
            }
        } else if (document.selection && document.selection.createRange) {
            range = document.selection.createRange();
            range.text = replacementText;
        }
    }
    replaceSelectedText("`+s+`");`;
    chrome.tabs.executeScript( { code: insertCode } );
}

// for measuring time the input is changed
CmdUtils.inputUpdateTime = performance.now();
CmdUtils.timeSinceInputUpdate = function timeSinceInputUpdate() {
	return (performance.now() - CmdUtils.inputUpdateTime)*0.001;
}

CmdUtils.displayMessage = function displayMessage(m) {
	$("#ubiq-command-preview").html( m );
}


// load custom scripts
chrome.storage.local.get('customscripts', function(result) {
	eval(result.customscripts || "");
});

