/*\
title: $:/plugins/jlazarow/paperstore/paperstore.js
type: application/javascript
module-type: library

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var PaperSyncer = require("$:/plugins/jlazarow/paperstore/syncer.js").PaperSyncer;
var Publication = require("$:/plugins/jlazarow/paperstore/publication.js");     

var FIELD_PAPER_RETRIEVED = "paper-retrieved";
var FIELD_PAPER_TITLE = "paper-title";
var FIELD_DATE = "date";
var FIELD_DOI = "doi";
var FIELD_MA_ID = "ma"
var FIELD_ARXIV_ID = "arxiv";
var FIELD_S2_ID = "s2";    
var FIELD_REF_ID = "ref-id";
var FIELD_INFL_REF_ID = "infl-ref-id";
var FIELD_CITE_ID = "cite-id";    
var FIELD_INFL_CITE_ID = "infl-cite-id";
var FIELD_AUTHOR_ID = "author-id";
var FIELD_AUTHOR_NAME = "author-name";
    
function PaperStore(wiki, debug) {
    this.wiki = wiki;
    this.debug = debug;
    
    // we'll store a paper by all possible IDs that can identify it, including Tiddler title (if associated).
    this.papers = {};
    this.syncer = new PaperSyncer($tw.wiki);
}

PaperStore.prototype.getPaper = function(name) {
    if (name in this.papers) {
        return this.papers[name];
    }

    var tiddler = this.wiki.getTiddler(name);    
    var paper = PaperStore.parsePaperFromTiddler(tiddler);

    this.papers[name] = paper;
    return paper;
}

// theoretically we could walk referenced tiddlers and reconstitute more data.
PaperStore.parsePaperFromTiddler = function(tiddler) {
    var title = null;
    var date = null;
    var doi = null;
    var maID = null;
    var arxivID = null;
    var s2ID = null;
    var references = [];
    var citations = [];
    var authors = [];

    if (FIELD_PAPER_TITLE in tiddler.fields) {
        title = tiddler.fields[FIELD_PAPER_TITLE];
    }
    
    if (FIELD_DATE in tiddler.fields) {
        date = tiddler.fields[FIELD_DATE];
    }

    if (FIELD_DOI in tiddler.fields) {
        doi = tiddler.fields[FIELD_DOI];
    }

    if (FIELD_MA_ID in tiddler.fields) {
        maID = tiddler.fields[FIELD_MA_ID];
    }

    if (FIELD_ARXIV_ID in tiddler.fields) {
        arxivID = tiddler.fields[FIELD_ARXIV_ID];
    }
    
    if (FIELD_S2_ID in tiddler.fields) {
        s2ID = tiddler.fields[FIELD_S2_ID];
    }

    if (FIELD_REF_ID in tiddler.fields) {
        var referenceIDs = tiddler.fields[FIELD_REF_ID].split(",");

        var influentialReferenceIDs = [];
        if (FIELD_INFL_REF_ID in tiddler.fields) {
            influentialReferenceIDs = tiddler.fields[FIELD_INFL_REF_ID].split(",");
        }

        for (var referenceIndex = 0; referenceIndex < referenceIDs.length; referenceIndex++) {
            var referenceID = referenceIDs[referenceIndex];
            var isInfluential = influentialReferenceIDs.indexOf(referenceID) >= 0;

            references.push(new Publication.PaperReference(referenceID, isInfluential));
        }
    }

    if (FIELD_CITE_ID in tiddler.fields) {
        var citationIDs = tiddler.fields[FIELD_CITE_ID].split(",");

        var influentialCitationIDs = [];
        if (FIELD_INFL_CITE_ID in tiddler.fields) {
            influentialCitationIDs = tiddler.fields[FIELD_INFL_CITE_ID].split(",");
        }

        for (var citationIndex = 0; citationIndex < citationIDs.length; citationIndex++) {
            var citationID = citationIDs[citationIndex];
            var isInfluential = influentialCitationIDs.indexOf(citationID) >= 0;

            citations.push(new Publication.PaperReference(citationID, isInfluential));
        }
    }

    if (FIELD_AUTHOR_ID in tiddler.fields) {
        var authorIDs = tiddler.fields[FIELD_AUTHOR_ID].split(",");
        var authorNames = [];

        if (FIELD_AUTHOR_NAME in tiddler.fields) {
            authorNames = tiddler.fields[FIELD_AUTHOR_NAME].split(",");

            // but ignore it if it's not compatible.
            if (authorIDs.length != authorNames.length) {
                authorNames = [];
            }
        }

        for (var authorIndex = 0; authorIndex < authorIDs.length; authorIndex++) {
            var authorID = authorIDs[authorIndex];
            var authorName = null;

            if (authorNames.length > authorIndex) {
                authorName = authorNames[authorIndex];
            }

            authors.push(new Publication.Author(authorID, authorName));
        }
    }

    // figure out some "ID", not important".
    var id = null;
    if (maID != null) {
        id = maID;
    }
    else if (arxivID  != null) {
        id = arxivID;
    }
    else if (doi != null) {
        id = doi;
    }
    else if (s2ID != null) {
        id = s2ID;
    }

    return new Publication.Paper(
        id, title, null, date, references, citations, authors, null, doi, arxivID, s2ID, maID, []);
}
    

PaperStore.prototype.sync = function() {
    return this.syncer.syncTiddlers();
}

PaperStore.prototype.syncTiddler = function(tiddler) {
    // check if we already have this one.
    if (FIELD_PAPER_RETRIEVED in tiddler.fields) {
        console.log("paper already present. skipping " + tiddler.fields.title);
        var paper = this.getPaper(tiddler.fields.title);
        
        return Promise.resolve(paper);
    }
    
    return this.syncer.syncTiddler(tiddler);
}
    
exports.PaperStore = PaperStore;

})();
