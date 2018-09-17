// CmdUtils

if (!CmdUtils) var CmdUtils = {
    VERSION: chrome.runtime.getManifest().version,
    DEBUG: undefined,
    MORE_COMMANDS: false,
    BROWSER: (typeof chrome !== "undefined")
        ? ((typeof browser !== "undefined")
            ? "Firefox"
            : "Chrome")
        : undefined,
    parserVersion: 3,
    CommandList: [],
    DisabledCommands: {},
    ContextMenuCommands: [],
    jQuery: jQuery,
    backgroundWindow: window,
    popupWindow: null,
    log: console.log,
    maxSuggestions: 5,
    maxSearchResults: 10,
    maxHistoryItems: 20,
    selectedContextMenuCommand: undefined,
    active_tab: null,   // tab that is currently active, updated via background.js 
    selectedText: "",   // currently selected text, update via content script selection.js
    selectedHTML: "",   // currently selected html, update via content script selection.js
    get nlParser() {
        return (CmdUtils.parserVersion === 2 ? NLParser2: NLParser3);
    },
    setPreview: function(message, prepend) { console.log(message); },
};

var _ = a => a;


var _ = function(x, data) {
    return data
        ? TrimPath.parseTemplate(x).process(data, {keepWhitespace: true})
        : x
};

var H = Utils.escapeHtml;

// stub for original ubiquity string formatter
function L(pattern) {
    for (let sub of Array.prototype.slice.call(arguments, 1)) {
        pattern = pattern.replace("%S", sub);
    }

    return pattern;
}

// debug log
CmdUtils.deblog = function () {
    if(CmdUtils.DEBUG){
        console.log.apply(console, arguments);
    }
};

CmdUtils.renderTemplate = function (template, data) {
    return TrimPath.parseTemplate(template).process(data);
};

CmdUtils.makeParser = function() {
    return CmdUtils.nlParser.makeParserForLanguage(CmdUtils.parserLanguage, CmdUtils.CommandList);
};

// creates command and adds it to command array, name or names must be provided and preview execute functions
CmdUtils.CreateCommand = function CreateCommand(options) {
    if (Array.isArray(options.name)) {
        options.names = options.name;
        options.name = options.name[0];
    } else {
        options.name = options.name || options.names[0];
        options.names = options.names || [options.name];
    }

    let args = options.arguments || options.argument;
    if (!args)
        args = options.arguments = [];

    options.id = options.uuid? options.uuid: Utils.hash(options.name + JSON.stringify(args));

    let nounId = 0;
    function toNounType(obj, key) {
        var val = obj[key];
        if (!val) return;
        var noun = obj[key] = NounUtils.NounType(val);
        if (!noun.id) noun.id = options.id + "#n" + nounId++;
    }

    ASSIGN_ARGUMENTS:
    {
        // handle simplified syntax
        if (typeof args.suggest === "function")
        // argument: noun
            args = [{role: "object", nountype: args}];
        else if (!Utils.isArray(args)) {
            // arguments: {role: noun, ...}
            // arguments: {"role label": noun, ...}
            let a = [], re = /^[a-z]+(?=(?:[$_:\s]([^]+))?)/;
            for (let key in args) {
                let [role, label] = re.exec(key) || [];
                if (role) a.push({role: role, label: label, nountype: args[key]});
            }
            args = a;
        }
        for (let arg of args) toNounType(arg, "nountype");
        options.arguments = args;
    }

    options._preview = options.preview;

    if (CmdUtils.BROWSER)

    var to = parseFloat(options.timeout || options.previewDelay);
    if (to > 0) {
    	if (typeof options._preview === 'function') {
			options.preview = function(pblock) {
			    let args = arguments;
			    let callback = CmdUtils.previewCallback(pblock, options._preview);
                if (options.preview_timeout !== null)
                    clearTimeout(options.preview_timeout);
                options.preview_timeout = setTimeout(function () {
                        callback.apply(options, args);
                    }, to);
			};
    	}
    }

    options.previewDefault = CmdUtils.CreateCommand.previewDefault;
    CmdUtils.CommandList.push(options);
};

CmdUtils.CreateCommand.previewDefault = function previewDefault(pb) {
    var html = "";
    if ("previewHtml" in this) html = this.previewHtml;
    else {
        if ("description" in this)
            html += '<div class="description">' + this.description + '</div>';
        if ("help" in this)
            html += '<p class="help">' + this.help + '</p>';
        if (!html) html = L(
            "Execute the %S command.",
            '<strong class="name">' + Utils.escapeHtml(this.name) + "</strong>");
        html = '<div class="default">' + html + '</div>';
    }
    return (pb || 0).innerHTML = html;
};

CmdUtils.getCommandByUUID = function(uuid) {
    return CmdUtils.CommandList.find(c => c.uuid.toLowerCase() === uuid.toLowerCase());
};

CmdUtils.commandHistoryPush = function(input) {
    if (input) {
        input = input.trim();
        Utils.getPref("commandHistory", history => {
            if (!history)
                history = [];

            ADD_ITEM: {
                if (history.length > 0 && history[0].toLowerCase() === input.toLowerCase())
                    break ADD_ITEM;

                history = [input].concat(history);

                if (history.length > CmdUtils.maxHistoryItems)
                    history.splice(history.length - 1, 1);

                Utils.setPref("commandHistory", history);
            }
        });
    }
};

// helper to avoid stealing focus in preview
CmdUtils._restoreFocusToInput = function(event) {
    var wnd = event.currentTarget || event.view;
    var doc;
    if (!wnd.closed && !((doc = wnd.document).hidden || doc.webkitHidden || doc.mozHidden || doc.msHidden)) {
        wnd.setTimeout( function() {
            wnd.document.getElementById('ubiq_input').focus();
        }, 0);
        var self = wnd._ubiq_recent_cmd;
        // may be scrolled by set of focus - so restore it now:
        if (self.prevAttrs.scroll) {
            var scrollOffs = self.prevAttrs.scroll;
            wnd.setTimeout( function() {
                var pblock = wnd.document.getElementById('ubiq-preview-div');
                pblock.scrollLeft = scrollOffs[0];
                pblock.scrollTop = scrollOffs[1];
            }, 0);
        }
        wnd.setTimeout(function() {
            wnd.removeEventListener("blur", CmdUtils._restoreFocusToInput, { capture: true });
        }, 150);
    } else {
        wnd.removeEventListener("blur", CmdUtils._restoreFocusToInput, { capture: true });
    }
};

CmdUtils._afterLoadPreview = function(ifrm) {
    var doc = ifrm.ownerDocument;
    var wnd = doc.defaultView || doc.parentWindow;
    wnd.focus();
    // jump to anchor (try multiple one by one):
    if (this.prevAttrs.anchor != null) {
      var url = ifrm.src;
      for (var ha of this.prevAttrs.anchor) {
        ifrm.src = url.replace(/(?:\#[^#]+)?$/, '#' + ha);
      }
    }
    // restore focus:
    wnd.focus();
    wnd.removeEventListener("blur", CmdUtils._restoreFocusToInput, { capture: true });
};

CmdUtils.tabs = {
    search(text, maxResults, callback) {
        let matcher = new RegExp(text, "i");

        chrome.tabs.query({}, tabs => {
            let results = [];
            for (let tab of tabs) {
                let match = matcher.exec(tab.title) || matcher.exec(tab.url);
                if (!match) continue;
                tab.match = match;
                results.push(tab);
                if (maxResults && results.length >= maxResults) break;
            }
            callback(results);
        });
    }
};

// closes current tab
CmdUtils.closeTab = function closeTab() {
	chrome.tabs.query({active:true,currentWindow:true},function(tabs){
        if (tabs && tabs[0]) 
            chrome.tabs.remove(tabs[0].id, function() { });
        else 
            console.error("closeTab failed because 'tabs' is not set");
	});
};

// returns active tabs URL if avaiable
CmdUtils.getLocation = function getLocation() {
    if (CmdUtils.active_tab && CmdUtils.active_tab.url) 
        return CmdUtils.active_tab.url;
    else 
        return ""; 
};

// opens new tab with provided url
Utils.openUrlInBrowser = CmdUtils.addTab = function addTab(url, callback) {
    chrome.tabs.create({ "url": url }, tab => {if (callback) callback(tab)});
};

// opens new tab with post request and provided data
CmdUtils.postNewTab = function postNewTab(url, data) {
	var form = document.createElement("form");
	form.setAttribute("method", "post");
	form.setAttribute("action", url);
	form.setAttribute("target", "_blank");

	if (typeof data === 'string') data = Utils.urlToParams(data);
	for (var i in data) {
		if (data.hasOwnProperty(i)) {
			var input = document.createElement('input');
			input.type = 'hidden';
			input.name = i;
			input.value = data[i];
			form.appendChild(input);
		}
	}

	document.body.appendChild(form);
	form.submit();
	document.body.removeChild(form);
};

CmdUtils.getContextMenuCommand = function(input) {
    if (!input)
        return null;
    return CmdUtils.ContextMenuCommands.find(c => c.command.toLowerCase() === input.toLowerCase());
};

CmdUtils.addContextMenuCommand = function(cmdDef, label, command) {
    CmdUtils.ContextMenuCommands.push({
        uuid: cmdDef.uuid,
        icon: cmdDef.icon,
        label: label,
        command: command
    });

    Utils.setPref("contextMenuCommands", CmdUtils.ContextMenuCommands, () => CmdUtils.createContextMenu());
};

CmdUtils._executeContextMenuItem = function(command, contextMenuCmdData) {
    let commandDef = CmdUtils.getCommandByUUID(contextMenuCmdData.uuid);

    if (!commandDef.preview || typeof commandDef.preview !== "function"
        || contextMenuCmdData.execute) {
        let parser = CmdUtils.makeParser();
        let query = parser.newQuery(command, null, CmdUtils.maxSuggestions, true);

        query.onResults = () => {
            let sent = query.suggestionList
            && query.suggestionList.length > 0? query.suggestionList[0]: null;
            if (sent && sent.getCommand().uuid.toLowerCase() === commandDef.uuid.toLowerCase()) {

                Utils.callPersistent(sent.getCommand().uuid, sent, sent.execute);

                if (CmdUtils.rememberContextMenuCommands)
                    CmdUtils.commandHistoryPush(contextMenuCmdData.command);

                if (CmdUtils.DEBUG)
                    parser.strengthenMemory(sent);
            }
            else
                CmdUtils.deblog("Context menu command/parser result mismatch")
        };

        query.run();
        return true;
    }

    return false;
};

CmdUtils.createContextMenu = function() {
    chrome.contextMenus.removeAll();

    let contexts = ["selection", "link", "page", "editable"];

    for (let c of CmdUtils.ContextMenuCommands) {
        let menuInfo = {
            id: c.command,
            title: c.label,
            contexts: contexts
        };

        let commandDef = CmdUtils.getCommandByUUID(c.uuid);

        if (CmdUtils.BROWSER === "Firefox")
            menuInfo.icons = {"16": commandDef && commandDef.icon? commandDef.icon: "/res/icons/icon-24.png"};

        chrome.contextMenus.create(menuInfo);
    }

    if (CmdUtils.ContextMenuCommands.length > 0)
        chrome.contextMenus.create({
            id: "final-separator",
            type: "separator",
            contexts: contexts
        });

    let menuInfo = {
        id: "ubiquity-settings",
        title: "Ubiquity Settings",
        contexts: contexts
    };

    if (CmdUtils.BROWSER === "Firefox")
        menuInfo.icons = {"32": "/res/icons/icon-32.png"};

    chrome.contextMenus.create(menuInfo);

    if (!CmdUtils.contextMenuListener) {
        CmdUtils.contextMenuListener = function(info, tab) {
            switch(info.menuItemId) {
                case "ubiquity-settings":
                    chrome.tabs.create({"url": "res/options.html"});
                    break;
                default:
                    if (info.selectionText) { // TODO: add html selection
                        CmdUtils.selectedText = info.selectionText;
                        CmdUtils.selectedHtml = info.selectionText;
                    }
                    if (info.linkUrl) {
                        CmdUtils.selectedText = info.linkUrl;
                        CmdUtils.selectedHtml = info.linkUrl;
                    }

                    let contextMenuCmdData = CmdUtils.getContextMenuCommand(info.menuItemId);
                    if (contextMenuCmdData
                            && !CmdUtils._executeContextMenuItem(info.menuItemId, contextMenuCmdData))
                        if (CmdUtils.BROWSER === "Firefox") {
                            CmdUtils.selectedContextMenuCommand = info.menuItemId;
                            chrome.browserAction.openPopup();
                        }
                        else
                            CmdUtils.notify("Only command execution is supported in Google Chrome.", "Error");
            }
        }
        chrome.contextMenus.onClicked.addListener(CmdUtils.contextMenuListener);
    }
};

// gets json with xhr
CmdUtils.ajaxGetJSON = function ajaxGetJSON(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            var resp = JSON.parse(xhr.responseText);
            callback(resp, xhr);
        }
    };
    xhr.send();
};

// gets page with xhr
CmdUtils.ajaxGet = function ajaxGet(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            callback(xhr.responseText, xhr);
        }
    };
    xhr.send();
};

// performs jQuery get and returns jqXHR that implements Promise 
CmdUtils.get = function get(url) {
	return jQuery.ajax({
    	url: url,
        async: true
	});
};

// performs jQuery post and return jsXHR
CmdUtils.post = function post(url, data) {
	return jQuery.ajax({
    	url: url,
    	data: data,
        async: true
	});
};

// loads remote scripts into specified window (or backround if not specified)
CmdUtils.loadScripts = function loadScripts(url, callback, wnd=window) {
    // this array will hold all loaded scripts into this window
    wnd.loadedScripts = wnd.loadedScripts || [];
	url = url || [];
	if (url.constructor === String) url = [url];

    if (typeof wnd.jQuery === "undefined") {
        console.error("there's no jQuery at "+wnd+".");
        return false;
    }
	if (url.length == 0) 
		return callback();

	var thisurl = url.shift();
	tempfunc = function(data, textStatus, jqXHR) {
		return loadScripts(url, callback, wnd);
	};
	if (wnd.loadedScripts.indexOf(thisurl)==-1) {
		console.log("loading :::: ", thisurl);
		wnd.loadedScripts.push(thisurl);
    	wnd.jQuery.ajax({
            url: thisurl,
            dataType: 'script',
            success: tempfunc,
            async: true
        });
    }
    else {
    	tempfunc();
    }
};

CmdUtils.loadCSS = function(doc, id, file) {
    if (!doc.getElementById(id)) {
        let head = doc.getElementsByTagName('head')[0];
        let link = doc.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = file;
        link.media = 'all';
        head.appendChild(link);
    }
};

// updates selectedText variable
CmdUtils.updateSelection = function (tab_id, callback) {
    try {
        chrome.tabs.executeScript(tab_id, {code: "__ubiq_get_sel()"}, function (selection) {
            if (selection && selection.length > 0 &&  selection[0]) {
                CmdUtils.selectedText = selection[0].text || "";
                CmdUtils.selectedHtml = selection[0].html || "";
            }
            if (callback)
                callback();
        });
    }
    catch (e) {
        console.log(e);
        if (callback)
            callback();
    }
};

CmdUtils._internalClearSelection = function() {
    CmdUtils.selectedText = "";
    CmdUtils.selectedHtml = "";
};

// called when tab is switched or changed, updates selectedText and activeTab
CmdUtils.updateActiveTab = function (callback) {
    CmdUtils.active_tab = null;
    CmdUtils.selectedText = '';
    if (chrome.tabs && chrome.tabs.query)
        try {
            chrome.tabs.query({active: true}, function (tabs) {
                if (tabs.length > 0) {
                    var tab = tabs[0];
                    if (tab.url.match('^https?://')) {
                        CmdUtils.active_tab = tab;
                        if (!CmdUtils.selectedContextMenuCommand)
                            CmdUtils.updateSelection(tab.id, callback);
                        else
                            if (callback)
                                callback();
                    }
                    else if (callback)
                        callback();
                }
                else if (callback)
                    callback();
            });
        }
        catch (e) {
            console.log(e);
            if (callback)
                callback();
        }
};

ContextUtils.getSelection = CmdUtils.getSelection = () => CmdUtils.selectedText;
ContextUtils.getHtmlSelection = CmdUtils.getHtmlSelection = () => CmdUtils.selectedHtml;

// replaces current selection with string provided
ContextUtils.setSelection = CmdUtils.setSelection = function setSelection(s) {
    //console.log("CmdUtils.setSelection"+s)
    if (typeof s!=='string') s = s+'';
    s = s.replace(/(['"])/g, "\\$1");
    s = s.replace(/\\\\/g, "\\");
    // http://jsfiddle.net/b3Fk5/2/

    var insertCode = `
    function replaceSelectedText(replacementText) {
        var sel, range;
        sel = window.getSelection();
        var activeElement = document.activeElement;
                    console.log("Allahu akbar");
        if (activeElement.nodeName == "TEXTAREA" ||
            (activeElement.nodeName == "INPUT" && (activeElement.type.toLowerCase() == "text"
                || activeElement.type.toLowerCase() == "search"))) {
                var val = activeElement.value, start = activeElement.selectionStart, end = activeElement.selectionEnd;
                activeElement.value = val.slice(0, start) + replacementText + val.slice(end);
        } else {
            if (sel.rangeCount) {
                range = sel.getRangeAt(0);
                range.deleteContents();

                var el = document.createElement("div");
                el.innerHTML = replacementText;
                var frag = document.createDocumentFragment(), node, lastNode;
                while ( (node = el.firstChild) ) {
                    lastNode = frag.appendChild(node);
                }
                range.insertNode(frag);
            } else {
                sel.deleteFromDocument();
            }
        }
    }
    replaceSelectedText("`+s+`");`;
    if (CmdUtils.active_tab && CmdUtils.active_tab.id)
        return chrome.tabs.executeScript( CmdUtils.active_tab.id, { code: insertCode } );
    else 
        return chrome.tabs.executeScript( { code: insertCode } );
};

// for measuring time the input is changed
CmdUtils.inputUpdateTime = performance.now();
CmdUtils.timeSinceInputUpdate = function timeSinceInputUpdate() {
	return (performance.now() - CmdUtils.inputUpdateTime)*0.001;
};

// returns command with this name
CmdUtils.getcmd = function getcmd(cmdname) {
    for (let c in CmdUtils.CommandList)
        if (CmdUtils.CommandList[c].name === cmdname || CmdUtils.CommandList[c].names.indexOf(cmdname) > -1)
            return CmdUtils.CommandList[c];
    return null;
};

// sets clipboard
CmdUtils.copyToClipboard = CmdUtils.setClipboard = function setClipboard (t) {
    var input = document.createElement('textarea');
    document.body.appendChild(input);
    input.value = t;
    input.focus();
    input.select();
    document.execCommand('Copy');
    input.remove();
};

CmdUtils.unloadCustomScripts = function unloadCustomScripts() {
    CmdUtils.CommandList = CmdUtils.CommandList.filter((c)=>{
        return c['builtIn'] == true;
    });
};

CmdUtils.loadCustomScripts = function loadCustomScripts(callback) {
    CmdUtils.unloadCustomScripts();
    // mark built-int commands
    CmdUtils.CommandList.forEach((c) => {c['builtIn'] = true;});

    // load custom scripts
    Utils.getCustomScripts(customscripts => {
        for (let n in customscripts) {
            try {
                eval(customscripts[n].scripts || "");
                for (let cc of CmdUtils.CommandList.filter((c)=>{return !c.builtIn && !c._namespace}))
                    cc._namespace = n;
            } catch (e) {
                console.error("custom scripts eval failed", e);
            }
        }
        if (callback)
           callback(customscripts);
    });
};

CmdUtils.enableCommand = function(cmd) {
    if (cmd.name in CmdUtils.DisabledCommands) {
        delete CmdUtils.DisabledCommands[cmd.name];
        Utils.setPref("disabledCommands", CmdUtils.DisabledCommands);
    }
};

CmdUtils.disableCommand = function(cmd) {
    if (!(cmd.name in CmdUtils.DisabledCommands)) {
        CmdUtils.DisabledCommands[cmd.name] = true;
        Utils.setPref("disabledCommands", CmdUtils.DisabledCommands);
    }
};

// show browser notification with simple limiter 
CmdUtils.lastNotification = "";
CmdUtils.notify = function (message, title) {
    if (typeof message === "object") {
        title = message.title;
        message = message.text;
    }
    if (CmdUtils.lastNotification === title + "/" + message) return;
    chrome.notifications.create({
        "type": "basic",
        "iconUrl": chrome.extension.getURL("/res/icons/icon-128.png"),
        "title": title || "UbiquityWE",
        "message": message
    });
    CmdUtils.lastNotification = title + "/" + message;
};

var displayMessage = Utils.notify;

// === {{{ CmdUtils.absUrl(data, baseUrl) }}} ===
// Fixes relative URLs in {{{data}}} (e.g. as returned by Ajax calls).
// Useful for displaying fetched content in command previews.
//
// {{{data}}} is the data containing relative URLs, which can be
// an HTML string or a jQuery/DOM object.
//
// {{{baseUrl}}} is the URL used for base
// (that is to say; the URL that the relative paths are relative to).

CmdUtils.absUrl = function (data, baseUrl) {
    switch (typeof data) {
        case "string": return data.replace(
            /<[^>]+>/g,
            tag => tag.replace(
                /\b(href|src|action)=(?![\"\']?[a-z]+:\/\/)([\"\']?)([^\s>\"\']+)\2/i,
                (_, a, q, path) =>
                    a + "=" + q + new URL(path, baseUrl).href + q));
        case "object": {
            let $data = jQuery(data);
            for (let name of ["href", "src", "action"]) {
                let sl = "*[" + name + "]", fn = function absUrl_each() {
                    this.setAttribute(name, new URL(this.getAttribute(name), baseUrl).href);
                };
                $data.filter(sl).each(fn).end().find(sl).each(fn);
            }
            return data;
        }
    }
    return null;
};

CmdUtils.previewCallback = function(pblock, callback, abortCallback) {
    var previewChanged = false;
    function onPreviewChange() {
        pblock.removeEventListener("preview-change", onPreviewChange, false);
        previewChanged = true;
        if (abortCallback) abortCallback();
    }
    pblock.addEventListener("preview-change", onPreviewChange, false);

    return function wrappedCallback() {
        if (previewChanged) return null;

        pblock.removeEventListener("preview-change", onPreviewChange, false);
        return callback.apply(this, arguments);
    };
};

CmdUtils.previewAjax = function(pblock, options) {
    var xhr;
    function abort() { if (xhr) xhr.abort() }

    var newOptions = {__proto__: options};
    for (var key in options) if (typeof options[key] === "function")
        newOptions[key] = CmdUtils.previewCallback(pblock, options[key], abort);

    // see scripts/jquery_setup.js
    var wrappedXhr = newOptions.xhr || jQuery.ajaxSettings.xhr;
    newOptions.xhr = function backgroundXhr() {
        var newXhr = wrappedXhr.apply(this, arguments);
        newXhr.mozBackgroundRequest = true;
        return newXhr;
    };

    return xhr = jQuery.ajax(newOptions);
};

// === {{{ CmdUtils.previewGet(pblock, url, data, callback, type) }}} ===
// === {{{ CmdUtils.previewPost(pblock, url, data, callback, type) }}} ===
// Does an asynchronous request to a remote web service.
// It is used just like {{{jQuery.get()}}}/{{{jQuery.post()}}},
// which is documented at [[http://docs.jquery.com/Ajax]].
// The difference is that {{{previewGet()}}}/{{{previewPost()}}} is designed to
// handle command previews, which can be cancelled by the user between the
// time that it's requested and the time it displays.  If the preview
// is cancelled, the given callback will not be called.

for (let method of ["Get", "Post"]) {
    let x = method
    CmdUtils["preview" + x] = function previewXet(pblock, url, data, cb, type) {
        if (typeof data == "function") {
            cb = data
            data = null
        }
        return this.previewAjax(pblock, {
            type: x,
            url: url,
            data: data,
            success: cb,
            dataType: type,
        })
    }
}

CmdUtils.makeSearchCommand = function(options) {
    if (!("url" in options)) options.url = options.parser.url;
    var [baseUrl, domain] = /^\w+:\/\/([^?#/]+)/.exec(options.url) || [""];
    var [name] = [].concat(options.names || options.name);
    if (!name) name = options.name = domain;
    var htmlName = Utils.escapeHtml(name);
    if (!("icon" in options)) options.icon = baseUrl + "/favicon.ico";
    if (!("description" in options))
        options.description = L(
            "Searches %S for your words.",
            "defaultUrl" in options ? htmlName.link(options.defaultUrl) : htmlName);
    if (!("arguments" in options || "argument" in options))
        options.argument = noun_arb_text;
    if (!("execute" in options)) options.execute = CmdUtils.makeSearchCommand.execute;
    if (!("preview" in options)) {
        options.preview = CmdUtils.makeSearchCommand.preview;
        if ("parser" in options) {
            let {parser} = options;
            function fallback(n3w, old) {
                if (n3w in parser || !(old in parser)) return;
                Utils.reportWarning(
                    "makeSearchCommand: parser." + old + " is deprecated. " +
                    "Use parser." + n3w + " instead.", 2);
                parser[n3w] = parser[old];
            }
            fallback("body", "preview");
            fallback("baseUrl", "baseurl");
            if (!("baseUrl" in parser)) parser.baseUrl = baseUrl;
            if ("type" in parser) parser.type = parser.type.toLowerCase();
            parser.keys = ["title", "body", "href", "thumbnail"].filter((k) => k in parser);
            if ("log" in parser && typeof parser.log !== "function")
                parser.log = CmdUtils.makeSearchCommand.log;
        }
    }
    return CmdUtils.CreateCommand(options);
};

CmdUtils.makeSearchCommand.log = function searchLog(it, type) {
    Utils.log("SearchCommand: " + type + " =", it);
};
CmdUtils.makeSearchCommand.query = function searchQuery(target, query, charset) {
    var re = /%s|{QUERY}/g, fn = encodeURIComponent;
    if (charset) {
        //query = Utils.convertFromUnicode(charset, query);
        fn = escape;
    }
    return typeof target == "object"
        ? Object.keys(target).map(key => fn(key) + "=" + fn(target[key])).join("&")
        : target && target.replace(re, fn(query));
};
CmdUtils.makeSearchCommand.execute = function searchExecute({object: {text}}) {
    if (!text && "defaultUrl" in this)
        Utils.openUrlInBrowser(this.defaultUrl);
    else
        Utils.openUrlInBrowser(
            CmdUtils.makeSearchCommand.query(this.url, text, this.charset),
            CmdUtils.makeSearchCommand.query(this.postData, text, this.charset))
};
CmdUtils.makeSearchCommand.preview = function searchPreview(pblock, {object: {text}}) {
    if (!text) return void this.previewDefault(pblock);

    function put() {
        pblock.innerHTML =
            "<div class='search-command'>" + Array.prototype.join.call(arguments, "") + "</div>";
    }
    var {parser, global} = this, queryHtml =
        "<strong class='query'>" + Utils.escapeHtml(text) + "</strong>";
    put(L("Searches %S for: %S", Utils.escapeHtml(this.name), queryHtml),
        !parser ? "" :
            "<p class='loading'>" + L("Loading results...") + "</p>");
    if (!parser) return;

    var {type, keys} = parser;
    var params = {
        url: CmdUtils.makeSearchCommand.query(parser.url || this.url, text, this.charset),
        dataType: parser.type || "text",
        success: searchParse,
        error: function searchError(xhr) {
            put("<em class='error'>", xhr.status, " ", xhr.statusText, "</em>");
        },
    };
    var pdata = parser.postData || this.postData;
    if (pdata) {
        params.type = "POST";
        params.data = CmdUtils.makeSearchCommand.query(pdata, text, this.charset);
    }
    CmdUtils.previewAjax(pblock, params);
    function searchParse(data) {
        if (!data) {
            put("<em class='error'>" + L("Error parsing search results.") + "</em>");
            return;
        }
        if (parser.log) parser.log(data, "data");
        switch (type) {
            case "json": return parseJson(data);
            case "xml" : return parseDocument(data);
            default: return Utils.parseHtml(data, parseDocument);
        }
    }
    function parseJson(data) {
        // TODO: Deal with key names that include dots.
        function dig(dat, key) {
            var path = parser[key];
            if (path.call) return path.call(dat, dat);
            for (let p of path && path.split(".")) dat = dat[p] || 0;
            return dat;
        }
        var results = [];
        if ("container" in parser)
            for (let dat of dig(data, "container")) {
                let res = {};
                for (let key of keys) res[key] = dig(dat, key);
                results.push(res);
            }
        else {
            let vals = keys.map(k => dig(data, k));
            for (let j in vals[0])
                results.push(keys.reduce((r, k, i) => (r[k] = vals[i][j], r), {}));
        }
        onParsed(results);
    }
    function parseDocument(doc) {
        var $ = jQuery, results = [], $doc = $(doc);
        function find($_, key) {
            var path = parser[key];
            return !path ? $() : path.call ? path.call($_, $_) : $_.find(path);
        }
        if ("container" in parser)
            find($doc, "container").each(function eachContainer() {
                var res = {}, $this = $(this);
                for (let k of keys) res[k] = find($this, k);
                results.push(res);
            });
        else {
            let qs = keys.map(k => find($doc, k));
            for (let j of Utils.seq(qs[0].length))
                results.push(keys.reduce((r, k, i) => (r[k] = qs[i].eq(j), r), {}));
        }
        function pluck() { return this.innerHTML || this.textContent }
        function toCont(key) {
            for (let r of results) r[key] = r[key].map(pluck).get().join(" ");
        }
        function toAttr(key, lnm, anm) {
            for (let res of results) {
                let $_ = res[key], atr = ($_.is(lnm) ? $_ : $_.find(lnm)).attr(anm);
                res[key] = atr && Utils.escapeHtml(atr);
            }
        }
        "thumbnail" in parser && toAttr("thumbnail", "img", "src");
        "body" in parser && toCont("body");
        if (!("href" in parser)) for (let r of results) r.href = r.title;
        toAttr("href", "a", "href");
        toCont("title");
        onParsed(results);
    }
    function onParsed(results) {
        if (parser.log) parser.log(results, "results");
        for (let k of parser.plain || [])
            for (let r of results) r[k] = r[k] && Utils.escapeHtml(r[k]);
        var list = "", i = 0, max = parser.maxResults || 10;
        for (let {title, href, body, thumbnail} of results) if (title) {
            if (href) {
                let key = i + 1;
                title = ("<kbd >" + key + "</kbd>. <a href='" + href +
                     "' accesskey='" + key + "'>" + title + "</a>");
            }
            list += "<dt class='title'>" + title + "</dt>";
            if (thumbnail)
                list += "<dd class='thumbnail'><img src='" + thumbnail + "'/></dd>";
            if (body)
                list += "<dd class='body'>" + body + "</dd>";
            if (++i >= max) break;
        }

        put(list
            ? ("<span class='found'>" +
                L("Results for %S:", queryHtml) +
                "</span><dl class='list'>" + list + "</dl>")
            : ("<span class='empty'>" +
                L("No results for %S.", queryHtml) +
                "</span>"));
        CmdUtils.absUrl(pblock, parser.baseUrl);
    }
};

// === {{{ CmdUtils.previewList(block, htmls, [callback], [css]) }}} ===
// Creates a simple clickable list in the preview block and
// returns the list element.
// * Activating {{{accesskey="0"}}} rotates the accesskeys
//   in case the list is longer than the number of available keys.
// * The buttons are disabled upon activation to prevent duplicate calls.
//   To re-enable them, make {{{callback}}} return {{{true}}}.
//
// {{{block}}} is the DOM element the list will be placed into.
//
// {{{htmls}}} is the array/dictionary of HTML string to be listed.
//
// {{{callback(id, ev)}}} is the function called
// when one of the list item becomes focused.
// *{{{id}}} : one of the keys of {{{htmls}}}
// *{{{ev}}} : the event object
//
// {{{css}}} is an optional CSS string inserted along with the list.

CmdUtils.previewList = function(block, htmls, callback, css) {
    var {escapeHtml} = Utils, list = "", num = 0, CU = this;
    for (let key in htmls) {
        let k = ++num < 36 ? num.toString(36) : "-";
        list += ('<li key="' + escapeHtml(key) + '" accesskey="' + k + '"><span id="' + num +
            '">' + k + '</span>. ' + htmls[key] + '</li>');
    }
    block.innerHTML = (
        '<ol id="preview-list">' +
        '<style>' + CmdUtils.previewList.CSS + (css || "") + '</style>' + list + '</ol>');
    var ol = block.firstChild, start = 0;
    callback && ol.addEventListener("click", function onPreviewListClick(ev) {
        var {target} = ev;
        if (target.tagName !== "LI") return;
        ev.preventDefault();
        if (callback)
            callback.call(this, target.getAttribute("key"), ev);
    }, false);
    return ol;
};
CmdUtils.previewList.CSS = `\
  #preview-list {margin: 0; padding: 2px; list-style-type: none}
  #preview-list > li {position: relative; min-height: 3ex; margin-right: 3px; cursor: pointer}
  #preview-list > li:hover {outline: 1px solid;}
`;

(function ( $ ) {
    $.fn.blankify = function( url ) {
        console.log("tryeing to blnk",this.find("a"));
        return this.find("a").not('[href^="http"],[href^="//:"],[href^="mailto:"],[href^="#"]').each(function() {
            console.log("bln");
            $(this).attr("target", "_blank").attr('href', function(index, value) {
                if (value.substr(0,1) !== "/") value = "/"+value;
                return url + value;
            });
});
        };
}( jQuery ));

// https://stackoverflow.com/questions/8498592/extract-hostname-name-from-string
function url_domain(data) {
    var    a      = document.createElement('a');
           a.href = data;
    return a.hostname;
}

(function ( $ ) {
    $.fn.loadAbs = function( url, complete ) {
        var result = this;
        return this.load(url, function() {
            url = "http://"+url_domain( url );
            result.find("a")
                    .not('[href^="http"],[href^="//:"],[href^="mailto:"],[href^="#"]')
                    .attr("target", "_blank")
                    .attr('href', function(index, value) {
                if (typeof value === "undefined") return url;
                if (value.substr(0,1) !== "/") value = "/" + value;
                return url + value;
            });
            result.find("img")
                    .not('[src^="http"],[src^="//:"],[src^="mailto:"],[src^="#"]')
                    .attr('src', function(index, value) {
                if (typeof value === "undefined") return url;
                if (value.substr(0,1) !== "/") value = "/" + value;
                return url + value;
            });
            if (typeof complete === 'function') complete();
        });
    };
}( jQuery ));

