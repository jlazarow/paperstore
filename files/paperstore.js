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

var AUTHOR_DATABASE_TIDDLER = "$:/paper/authors";
    
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

var REBUILD = false;
var PAPER_PREFIX = "$:/paper/";
    
function PaperStore(wiki, debug) {
    this.wiki = wiki;
    this.debug = debug;
    
    // we'll store a paper by all possible IDs that can identify it, including Tiddler title (if associated).
    this.papers = {};
    this.authors = {};
    this.syncer = new PaperSyncer($tw.wiki);

    this.readAuthors();
}

PaperStore.prototype.getPaper = function(name) {
    if (name in this.papers) {
        return this.papers[name];
    }

    // path for ID based lookups.
    var tiddler = null;
    if ((name.startsWith(FIELD_MA_ID) ||
         name.startsWith(FIELD_ARXIV_ID) ||
         name.startsWith(FIELD_S2_ID) ||
         name.startsWith(FIELD_DOI))) {
        var matchingTiddlers = this.findTiddlerByID(name);
        if (matchingTiddlers && matchingTiddlers.length > 0) {
            tiddler = $tw.wiki.getTiddler(matchingTiddlers[0]);
        }
    } else {
        tiddler = $tw.wiki.getTiddler(name);
    }
    
    if (!tiddler) {
        return null;
    }
        
    var paper = PaperStore.parsePaperFromTiddler(tiddler);

    this.papers[name] = paper;
    return paper;
}

PaperStore.prototype.findTiddlerByID = function(id) {
    if (id.startsWith(FIELD_MA_ID)) {
        return this.wiki.filterTiddlers("[!has[draft.of]field:ma[" + id + "]]");        
    }
    
    if (id.startsWith(FIELD_ARXIV_ID)) {
        return this.wiki.filterTiddlers("[!has[draft.of]field:arxiv[" + id + "]]");        
    }

    if (id.startsWith(FIELD_S2_ID)) {
        return this.wiki.filterTiddlers("[!has[draft.of]field:s2[" + id + "]]");        
    }

    if (id.startsWith(FIELD_DOI)) {
        return this.wiki.filterTiddlers("[!has[draft.of]field:doi[" + id + "]]");        
    }

    return null;
}

PaperStore.prototype.findTiddler = function(paper) {
    if (paper.arxivID != null) {
        var arxivMatches = this.wiki.filterTiddlers("[!has[draft.of]field:arxiv[" + paper.arxivID + "]]");

        if (arxivMatches.length > 0) {
            return arxivMatches[0];
        }
    }

    if (paper.doi != null) {
        var doiMatches = this.wiki.filterTiddlers("[!has[draft.of]field:doi[" + paper.doi + "]]");

        if (doiMatches.length > 0) {
            return doiMatches[0];
        }
    }

    if (paper.maID != null) {
        var maMatches = this.wiki.filterTiddlers("[!has[draft.of]field:ma[" + paper.maID + "]]");

        if (maMatches.length > 0) {
            return maMatches[0];
        }
    }

    if (paper.s2ID != null) {
        var s2Matches = this.wiki.filterTiddlers("[!has[draft.of]field:s2[" + paper.s2ID + "]]");

        if (s2Matches.length > 0) {
            return s2Matches[0];
        }
    }

    return null;
}

PaperStore.getAuthorAbbreviation = function(paper) {
    var authors = paper.authors;
    if (authors.length == 0) {
        console.log("no authors!");
        return null;
    }

    
    // todo, handle names better.
    var firstAuthorNameParts = authors[0].name.split(" ");
    var firstAuthorName = firstAuthorNameParts[firstAuthorNameParts.length - 1];
    if (authors.length == 1) {
        return firstAuthorName;
    }

    if (authors.length == 2) {
        var secondAuthorNameParts = authors[1].name.split(" ");
        var secondAuthorName = secondAuthorNameParts[secondAuthorNameParts.length - 1];

        return firstAuthorName + " and " + secondAuthorName;
    }

    return firstAuthorName + " et al";
}

PaperStore.prototype.addPaper = function(paper, name) {
    this.papers[name] = paper;

    // did we see any new authors?
    for (var authorIndex = 0; authorIndex < paper.authors.length; authorIndex++) {
        var author = paper.authors[authorIndex];

        if (!(author.id in this.authors)) {
            this.authors[author.id] = author;
        }
    }

    // // did we see any new referenced (or cited) papers?
    var referencedPapers = paper.references || [];
    var citingPapers = paper.citations || [];
    var relatedPapers = referencedPapers.concat(citingPapers);

    for (var paperIndex = 0; paperIndex < relatedPapers.length; paperIndex++) {
        var reference = relatedPapers[paperIndex];
        if (reference.paper == null ){
            continue;
        }

        // do we know about this paper?
        var referenceTiddler = this.findTiddler(reference.paper);
        if (referenceTiddler != null) {
            // nothing to do.
            continue;
        }

        // add this as a $:/ tiddler.
        var paperTitle = reference.paper.title + " (" + PaperStore.getAuthorAbbreviation(reference.paper) + ")";
        var placeholderTiddlerData = {
            "title": PAPER_PREFIX + paperTitle,
            "type": "text/x-markdown",
            "tags": ["paper"],
            "text": "# Paper",
            "caption": paperTitle,
            "retrieved": Date.now()
        }

        var placeholderTiddler = new $tw.Tiddler(placeholderTiddlerData);
        $tw.wiki.addTiddler(placeholderTiddler);

        this.syncer.associate(reference.paper, placeholderTiddler);
    }
}

PaperStore.prototype.save = function() {
    // write authors.
    var authorIDs = Object.keys(this.authors);
    var authorsData = [];
    for (var authorIndex = 0; authorIndex < authorIDs.length; authorIndex++) {
        var authorID = authorIDs[authorIndex];
        var author = this.authors[authorID];

        authorsData.push({
            "id": authorID,
            "name": author.name || null,
            "institution": author.institution || null
        });
    }

    var authorsTiddlerData = {
        "title": AUTHOR_DATABASE_TIDDLER,
        "type": "application/json",
        "text": JSON.stringify(authorsData, null, 2),
    };

    var authorTiddler = new $tw.Tiddler(authorsTiddlerData);
    $tw.wiki.addTiddler(authorTiddler);
}

PaperStore.prototype.readAuthors = function() {
    var authorsTiddler = $tw.wiki.getTiddler(AUTHOR_DATABASE_TIDDLER);
    if (!authorsTiddler) {
        return;
    }

    // TODO, figure out how to join these based off some heuristics.
    var authorsData = JSON.parse(authorsTiddler.fields.text);
    for (var authorIndex = 0; authorIndex < authorsData.length; authorIndex++) {
        let authorData = authorsData[authorIndex];

        let authorID = authorData["id"];
        let authorName = authorData["name"];
        let authorInstitution = authorData["institution"];
        let author = new Publication.Author(
            authorID, authorName, authorInstitution);
        
        this.authors[authorID] = author;
    }
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

            // try and get the paper reference.
            var referencingPaper = $tw.papers.getPaper(referenceID);
            var isInfluential = influentialReferenceIDs.indexOf(referenceID) >= 0;

            references.push(new Publication.PaperReference(referencingPaper, isInfluential));
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

            var referencingPaper = $tw.papers.getPaper(citationID);

            citations.push(new Publication.PaperReference(referencingPaper, isInfluential));
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
    if (FIELD_PAPER_RETRIEVED in tiddler.fields && !REBUILD) {
        console.log("paper already present. skipping " + tiddler.fields.title);
        var paper = this.getPaper(tiddler.fields.title);
        
        return Promise.resolve(paper);
    }
    
    return this.syncer.syncTiddler(tiddler);
}
    
exports.PaperStore = PaperStore;

})();
