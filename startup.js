/*\
title: $:/plugins/jlazarow/paperstore/startup.js
type: application/javascript
module-type: startup

Sync tiddlers associated with PDFs.

\*/
(function(){

/*jslint node: true, browser: false */
/*global $tw: false */
"use strict";

var PaperStore = require("$:/plugins/jlazarow/paperstore/paperstore.js").PaperStore;
    
exports.name = "load-paperstore";

exports.synchronous = true;
exports.startup = function() {

    // I think the PDF store should just initialize this.
    if (!$tw.papers) {
        $tw.papers = new PaperStore();
    }
}

})();
