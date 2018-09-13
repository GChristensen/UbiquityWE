// BuildIn CmdUtils command definitions
// jshint esversion: 6 

CmdUtils.CreateCommand({
    names: ["change-ubiquity-settings", "change-ubiquity-options"],
    uuid: "D6E7CBA7-920D-4F86-910E-63AB3C119906",
    icon: "res/settings.png",
    builtIn: true,
    _namespace: "Ubiquity", // do not set this field in custom commands
    description: "Takes you to the Ubiquity command <a href=options.html target=_blank>settings page</a>.",
    execute: function() {
        CmdUtils.addTab("options.html");
    }
});

CmdUtils.CreateCommand({
    names: ["list-ubiquity-commands", "command-list", "help"],
    uuid: "B8D3B9C2-D8DB-40F3-833F-639588A9EA8D",
    description: "Opens Ubiquity command list page.",
    icon: "res/list_table.png",
    _namespace: "Ubiquity",
    builtIn: true,
    preview: "Lists all available commands",
    execute: function() {CmdUtils.addTab("commands.html")}
});

CmdUtils.CreateCommand({
    names: ["edit-ubiquity-commands", "hack-ubiquity"],
    uuid: "07E1ABDD-89BD-4666-8884-3E0B86611CE0",
    icon: "res/plugin_edit.png",
    _namespace: "Ubiquity",
    builtIn: true,
    description: "Takes you to the Ubiquity command <a href=edit.html target=_blank>editor page</a>.",
    execute: function() {
        CmdUtils.addTab("edit.html");
    }
});

CmdUtils.CreateCommand({
    names: ["reload-ubiquity"],
    uuid: "E9F2C758-FA25-46F1-90C4-02CB057A3269",
    _namespace: "Ubiquity",
    description: "Reloads Ubiquity extension.",
    icon: "res/arrow_refresh.png",
    builtIn: true,
    preview: "Reloads Ubiquity extension.",
    execute: function() {
        chrome.runtime.reload();
    }
});

CmdUtils.CreateCommand({
    names: ["debug-popup"],
    uuid: "6E788674-71FF-486E-AAD4-7D241670C0FC",
    description: "Debug the popup window in a separate tab.",
    _namespace: "Ubiquity",
    _hidden: true,
    builtIn: true,
    icon: "res/debug.png",
    preview: "Debug the popup window in a separate tab.",
    execute: function() {CmdUtils.addTab("popup.html")}
});

CmdUtils.CreateCommand({
    name: "switch-to-tab",
    uuid: "24616A75-C995-439B-B6F4-F3ED72662C89",
    argument: [{role: "object", nountype: noun_type_tab, label: "tab title or URL"}],
    description: "Switches to the tab whose title or URL matches the input.",
    previewDelay: 100,
    _namespace: "Browser",
    icon: "res/tab_go.png",
    builtIn: true,
    execute: function execute({object}) {
        if (object && object.data)
            chrome.tabs.update(object.data.id, {active: true});
    }
});

CmdUtils.CreateCommand({
    name: "close-tab",
    uuid: "26CCB2AC-053B-4C33-91AF-5C1C669901B5",
    argument: [{role: "object", nountype: noun_type_tab, label: "tab title or URL"}],
    description: "Closes the tab whose title or URL matches the input or the current tab if no tab matches.",
    previewDelay: 100,
    _namespace: "Browser",
    icon: "res/tab_delete.png",
    builtIn: true,
    execute: function execute({object}) {
        if (!object || !object.data)
            CmdUtils.closeTab();
        else
            chrome.tabs.remove(object.data.id);
    }
});

CmdUtils.CreateCommand({
    name: "close-all-tabs-with",
    uuid: "FA80916D-08ED-4E97-AF35-5BE34A9ECA00",
    argument: [{role: "object", nountype: noun_arb_text, label: "tab title or URL"}],
    description: "Closes all open tabs that have the given word in common.",
    previewDelay: 100,
    _namespace: "Browser",
    icon: "res/tab_delete.png",
    builtIn: true,
    execute: function execute({object: {text}}) {
        if (text) {
            CmdUtils.tabs.search(text, null, tabs => {
                for(let tab of tabs)
                    chrome.tabs.remove(tab.id);
            });
        }
    }
});


CmdUtils.CreateCommand({
    name: "print",
    uuid: "2909878D-DF99-4FD8-8DA6-FD2B5B7D0756",
    _namespace: "Browser",
    description: "Print the current page.",
    icon: "res/print.gif",
    builtIn: true,
    preview: "Print the current page.",
    execute: function (directObj) {
        chrome.tabs.executeScript( { code:"window.print();" } );
    }
});

CmdUtils.CreateCommand({
    name: "invert",
    uuid: "D962E2B8-8ECD-41F9-BC28-ED77594C6A75",
    _namespace: "Browser",
    description: "Inverts all colors on current page. Based on <a target=_blank href=https://stackoverflow.com/questions/4766201/javascript-invert-color-on-all-elements-of-a-page>this</a>.",
    builtIn: true,
    icon: "res/invert.png",
    execute: function execute(){
        chrome.tabs.executeScript({code:`
        javascript: (
            function () { 
            // the css we are going to inject
            var css = 'html {-webkit-filter: invert(100%);' +
                '-moz-filter: invert(100%);' + 
                '-o-filter: invert(100%);' + 
                '-ms-filter: invert(100%); }',
            
            head = document.getElementsByTagName('head')[0],
            style = document.createElement('style');
            
            // a hack, so you can "invert back" clicking the bookmarklet again
            if (!window.counter) { window.counter = 1;} else  { window.counter ++;
            if (window.counter % 2 == 0) { var css ='html {-webkit-filter: invert(0%); -moz-filter:    invert(0%); -o-filter: invert(0%); -ms-filter: invert(0%); }'}
             };
            
            style.type = 'text/css';
            if (style.styleSheet){
            style.styleSheet.cssText = css;
            } else {
            style.appendChild(document.createTextNode(css));
            }
            
            //injecting the css to the head
            head.appendChild(style);

            function invert(rgb) {
                rgb = Array.prototype.join.call(arguments).match(/(-?[0-9\.]+)/g);
                for (var i = 0; i < rgb.length; i++) {
                  rgb[i] = (i === 3 ? 1 : 255) - rgb[i];
                }
                return rgb;
            }

            document.body.style.backgroundColor = "rgb("+invert(window.getComputedStyle(document.body, null).getPropertyValue('background-color')).join(",")+")";
            }());
        `})
    },
});

CmdUtils.CreateCommand({
    names: ["base64decode","b64d","atob"],
    uuid: "E5C587CB-5733-463E-80DD-A6D4C085EE53",
    _namespace: "Utility",
    description: "base64decode",
    icon: "res/encoding.png",
    builtIn: true,
    author: {
        name: "rostok",
    },
    license: "GPL",
    arguments: [{role: "object", nountype: noun_arb_text, label: "text"}],
    execute: function execute({object: {text}}) {
        CmdUtils.setSelection(atob(text));
    },
    preview: function preview(pblock, {object: {text}}) {
        pblock.innerHTML = atob(text);
    },
});

CmdUtils.CreateCommand({
    names: ["base64encode","b64e", "btoa"],
    uuid: "A7337919-93A1-48AC-AE1F-B9C322B7169E",
    _namespace: "Utility",
    description: "base64encode",
    builtIn: true,
    icon: "res/encoding.png",
    author: {
        name: "rostok",
    },
    license: "GPL",
    arguments: [{role: "object", nountype: noun_arb_text, label: "text"}],
    execute: function execute({object: {text}}) {
        CmdUtils.setSelection(btoa(text));
    },
    preview: function preview(pblock, {object: {text}}) {
        pblock.innerHTML = btoa(text);
    },
});

CmdUtils.CreateCommand({
    names: ["urldecode"],
    uuid: "C042DDB6-FD05-4CD5-9356-1725C0533568",
    _namespace: "Utility",
    description: "urldecode",
    icon: "res/encoding.png",
    builtIn: true,
    author: {
        name: "rostok",
    },
    license: "GPL",
    arguments: [{role: "object", nountype: noun_arb_text, label: "text"}],
    execute: function execute({object: {text}}) {
        CmdUtils.setSelection(decodeURI(text));
    },
    preview: function preview(pblock, {object: {text}}) {
        pblock.innerHTML = decodeURI(text);
    },
});

CmdUtils.CreateCommand({
    names: ["urlencode"],
    uuid: "80F43371-F330-4685-A153-9A493B07A553",
    _namespace: "Utility",
    description: "urlencode",
    icon: "res/encoding.png",
    builtIn: true,
    author: {
        name: "rostok",
    },
    license: "GPL",
    arguments: [{role: "object", nountype: noun_arb_text, label: "text"}],
    execute: function execute({object: {text}}) {
        CmdUtils.setSelection(encodeURI(text));
    },
    preview: function preview(pblock, {object: {text}}) {
        pblock.innerHTML = encodeURI(text);
    },
});

const noun_calc = {
    label: "expression",
    uuid: "F48E9D0A-06AA-499F-B724-7332529D1D8E",
    suggest: function (txt, htm, cb, si) {
        if (!this._mathlike.test(txt)) return []
        try {
            var result = Parser.evaluate(txt)
                , score = result === txt ? .3 : 1
        }
        catch (e) {
            result = e.message
            score  = .1
        }
        return [CmdUtils.makeSugg(txt, htm, result, score, si)];
    },
    _mathlike: /^[\w.+\-*\/^%(, )|]+$/,
};

CmdUtils.CreateCommand({
    name: "calculate",
    uuid: "53E7B63A-4084-449F-B142-9D62D82B9772",
    description:
        'Calculates using\
         <a href="http://silentmatt.com/javascript-expression-evaluator/">\
         JavaScript Expression Evaluator</a>.',
    help: "Try: <code>22/7, 3^4^5, sin(sqrt(log(PI)))</code>",
    icon: "res/calculator.png",
    _namespace: "Utility",
    builtIn: true,
    author: "satyr",
    license: "Public domain",
    argument: noun_calc,
    preview: function (pb, {object: {data, score}}) {
        pb.innerHTML = data? (score < .3 ? "<em style='color: red'>" : "<strong>") + data: "";
    },
});


var bitly_api_user = "ubiquityopera";
var bitly_api_key = "R_59da9e09c96797371d258f102a690eab";
CmdUtils.CreateCommand({
    names: ["shorten-url", "bitly"],
    uuid: "6475BAAA-4547-4FF0-BCA7-EE4236F20386",
    _namespace: "Utility",
    icon: "res/bitly.png",
    builtIn: true,
    description: "Shorten your URLs with the least possible keystrokes",
    homepage: "http://bit.ly",
    author: {
        name: "Cosimo Streppone",
        email: "cosimo@cpan.org"
    },
    license: "GPL",
    arguments: [{role: "object", nountype: noun_arb_text, label: "text"}],
    preview: async function (pblock, {object: {text}}) {
        var words = text.split(' ');
        var host = words[1];
        pblock.innerHTML = "Shortens an URL (or the current tab) with bit.ly";
    },
    execute: async function (directObject) {
        var url = "http://api.bit.ly/shorten?version=2.0.1&longUrl={QUERY}&login=" +
            bitly_api_user + "&apiKey=" + bitly_api_key;
        var query = directObject.text;
        // Get the url from current open tab if none specified
        if (!query || query == "") query = CmdUtils.getLocation();
        var urlString = url.replace("{QUERY}", query);

        var url = "http://api.bit.ly/shorten?version=2.0.1&longUrl={QUERY}&login=" + bitly_api_user + "&apiKey=" + bitly_api_key;
        // Get the url from current open tab if none specified
        var ajax = await CmdUtils.get(urlString);
        //ajax = JSON.parse(ajax);
        //if (!ajax) return;
        var err_code = ajax.errorCode;
        var err_msg = ajax.errorMessage;
        // Received an error from bit.ly API?
        if (err_code > 0 || err_msg) {
            CmdUtils.setPreview('<br/><p style="font-size: 18px; color:orange">' + 'Bit.ly API error ' + err_code + ': ' + err_msg + '</p>');
            return;
        }

        var short_url = ajax.results[query].shortUrl;
        CmdUtils.setPreview('<br/><p style="font-size: 24px; font-weight: bold; color: #ddf">' +
            '<a target=_blank href="' + short_url + '">' + short_url + '</a>' +
            '</p>');
        CmdUtils.setClipboard(short_url);
    }
});