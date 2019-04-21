/*\
title: $:/plugins/jlazarow/paperstore/syncer.js
type: application/javascript
module-type: library

\*/
(function(){

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var HIDDEN_TITLE_PREFIX = "$:/pdf/";    

var Publication = require("$:/plugins/jlazarow/paperstore/publication.js");        
var AcademicAPI = require("$:/plugins/jlazarow/paperstore/academic-api.js").AcademicAPI;        
var SemanticScholarAPI = require("$:/plugins/jlazarow/paperstore/semantic-scholar-api.js").SemanticScholarAPI;

var REBUILD = true;

var PDF_FIELD_NAME = "pdf";    
var FILTER_WITH_PDF = "[!has[draft.of]has[" + PDF_FIELD_NAME + "]]";

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

var CONFIGURATION_TIDDLER = "$:/plugins/jlazarow/paperstore/config";
var DATABASE_TIDDLER = "$:/papers";
    
function PaperSyncer(wiki) {
    this.wiki = wiki;
    this.configuration = this.wiki.getTiddlerData(CONFIGURATION_TIDDLER).configuration;
    this.academicAPIKey = this.configuration.academicAPIKey;
    this.academicAPI = new AcademicAPI(this.academicAPIKey);
}
    
PaperSyncer.prototype.syncTiddlers = function() {
    console.log("PaperSyncer: starting synchronization of store");
    
    // find those Tiddlers with a "pdf" associated (and title).
    var matchingTitles = this.wiki.filterTiddlers(FILTER_WITH_PDF);
    console.log("found " + matchingTitles.length + " tiddlers with associated PDFs");
    
    for (var matchingIndex = 0; matchingIndex < matchingTitles.length; matchingIndex++) {
        var matchingTitle = matchingTitles[matchingIndex];
        var matchingTiddler = this.wiki.getTiddler(matchingTitle);

        this.syncTiddler(matchingTiddler);
    }
}

PaperSyncer.prototype.associate = function(paper, tiddler) {
    console.log("associating paper to tiddler");
    
    if (paper == null) {
        return;
    }

    var fields = {};

    fields[FIELD_PAPER_RETRIEVED] = Date.now();
    fields[FIELD_PAPER_TITLE] = paper.title;
    fields[FIELD_DATE] = paper.year;
    fields[FIELD_DOI] = paper.doi;    
    fields[FIELD_MA_ID] = paper.maID;
    fields[FIELD_ARXIV_ID] = paper.arxivID;
    fields[FIELD_S2_ID] = paper.s2ID;

    var referenceIDs = [];
    var influentialReferenceIDs = [];
    for (var referenceIndex = 0; referenceIndex < paper.references.length; referenceIndex++) {
        var reference = paper.references[referenceIndex];
        if (reference.paper == null) {
            console.log("something up");
            continue;
        }
        
        referenceIDs.push(reference.paper.id);

        if (!!reference.isInfluential) {
            influentialReferenceIDs.push(reference.paper.id);
        }
    }

    fields[FIELD_REF_ID] = referenceIDs.join(",");
    fields[FIELD_INFL_REF_ID] = influentialReferenceIDs.join(",");    
    
    var citationIDs = [];
    var influentialCitationIDs = [];
    for (var citationIndex = 0; citationIndex < paper.citations.length; citationIndex++) {
        var citation = paper.citations[citationIndex];
        if (citation.paper == null) {
            console.log("something up");
            continue;
        }
        
        citationIDs.push(citation.paper.id);

        if (!!citation.isInfluential) {
            influentialCitationIDs.push(citation.paper.id);
        }
    }

    fields[FIELD_CITE_ID] = citationIDs.join(",");
    fields[FIELD_INFL_CITE_ID] = influentialCitationIDs.join(",");    
    
    var authorIDs = [];
    var authorNames = [];
    for (var authorIndex = 0; authorIndex < paper.authors.length; authorIndex++) {
        authorIDs.push(paper.authors[authorIndex].id);
        authorNames.push(paper.authors[authorIndex].name);
    }
    
    fields[FIELD_AUTHOR_ID] = authorIDs.join(",");
    fields[FIELD_AUTHOR_NAME] = authorNames.join(",");

    var associated = new $tw.Tiddler(
        tiddler,
        fields,
        this.wiki.getModificationFields());
    this.wiki.addTiddler(associated);

    return Promise.resolve(paper);
}

PaperSyncer.prototype.syncTiddler = function(tiddler) {
    // ask the PDF store.
    var pdfName = tiddler.fields[PDF_FIELD_NAME];
    var pdf = $tw.pdfs.getPDF(pdfName);
    var pdfTitle = pdf.metadata.title;
    if (!pdfTitle) {
        console.log("No PDF title associated: " + tiddler.fields.title + ". Skipping");
        return Promise.resolve(null);
    }

    return this.academicAPI.getPaper(pdfTitle).then(function(papers) {
        let paperPromises = [];

        for (let paperIndex = 0; paperIndex < papers.length; paperIndex++) {
            let paper = papers[paperIndex];
            
            paperPromises.push(SemanticScholarAPI.resolve(paper));
        }

        return Promise.all(paperPromises);
    }).then(function(papers) {
        // at some point we might get > 1 and choose the "best". for now, pick the most cited.
        console.log("found " + papers.length + " papers. choosing the most cited.");
        papers.sort(function(firstEl, secondEl) {
            return secondEl.citations.length -  firstEl.citations.length;
        });
        
        var match = papers[0];
        return this.associate(match, tiddler);
    }.bind(this));
}

exports.PaperSyncer = PaperSyncer;
    
})();
